import { apiOrigin } from "@kandamkulathi/client";
import type { SensitiveResult } from "@kandamkulathi/client/sensitive";
import { sessionSchema } from "@kandamkulathi/contracts/client";
import {
  type ConsentBootstrap,
  consentBootstrapSchema,
} from "../../../packages/contracts/src/consent-bootstrap";
import {
  nativeCredentialSchema,
  nativeExchangeResponseSchema,
  nativeExchangeSchema,
  nativeLogoutKeySchema,
  nativeStartResponseSchema,
  nativeStartSchema,
} from "../../../packages/contracts/src/native-auth";
import type { NativeSignInBackend } from "./signIn";

export type NativeBootstrap = ConsentBootstrap;
export type NativeLogoutResult = SensitiveResult<{ revoked: true }> | { status: "logout_pending" };
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).sort().join(",") === [...keys].sort().join(",");
export const nativeCredential = (value: unknown): value is string =>
  nativeCredentialSchema.safeParse(value).success;
export function parseNativeBootstrap(value: unknown): NativeBootstrap | undefined {
  const parsed = consentBootstrapSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** Actual native bearer protocol. No cookie/CSRF shim or provider token is persisted. */
export function nativeAuthHttp(options: {
  origin: string;
  local: boolean;
  transport?: typeof fetch;
  sha256(text: string): Promise<string>;
  now?: () => number;
}) {
  const origin = apiOrigin(options.origin, options.local);
  const transport = options.transport ?? fetch;
  async function request<T>(
    path: string,
    parse: (value: unknown) => T | undefined,
    signal: AbortSignal,
    body?: unknown,
    credential?: string,
    operationId?: string,
  ): Promise<SensitiveResult<T>> {
    if (signal.aborted || (credential !== undefined && !nativeCredential(credential)))
      return { status: "anonymous" };
    const abort = new AbortController();
    const uncertain = (): SensitiveResult<T> => ({
      status: signal.aborted ? "anonymous" : body === undefined ? "error" : "unknown",
    });
    let cancel = () => {};
    const cancelled = new Promise<SensitiveResult<T>>((resolve) => {
      cancel = () => {
        abort.abort();
        resolve(uncertain());
      };
    });
    signal.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(cancel, 5000);
    const perform = async (): Promise<SensitiveResult<T>> => {
      const response = await transport(`${origin}${path}`, {
        method: body === undefined ? "GET" : "POST",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        signal: abort.signal,
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
          ...(operationId ? { "Idempotency-Key": operationId } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (abort.signal.aborted) return uncertain();
      if (response.status === 401) return { status: "anonymous" };
      if (response.status === 403) return { status: "denied" };
      if (response.status === 409) return { status: "conflict" };
      if (response.status === 410) return { status: "expired" };
      if (response.status === 429) return { status: "busy" };
      if (response.status === 503) return { status: "unavailable" };
      if (response.status === 400) return { status: "error" };
      if (
        !response.ok ||
        response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
          "application/json"
      )
        return uncertain();
      const reader = response.body?.getReader();
      if (!reader) return uncertain();
      let text = "";
      let bytes = 0;
      const decoder = new TextDecoder("utf-8", { fatal: true });
      for (;;) {
        const chunk = await reader.read();
        if (abort.signal.aborted) {
          void reader.cancel().catch(() => {});
          return uncertain();
        }
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 300000) {
          void reader.cancel().catch(() => {});
          return uncertain();
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
      const value = parse(JSON.parse(text));
      return abort.signal.aborted
        ? uncertain()
        : value === undefined
          ? uncertain()
          : { status: "ready", data: value };
    };
    try {
      return await Promise.race([cancelled, perform()]);
    } catch {
      return uncertain();
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
    }
  }
  const backend: NativeSignInBackend = {
    async start(proof, signal) {
      const parsed = nativeStartSchema.safeParse(proof);
      if (!parsed.success) return { status: "error" };
      return request(
        "/v1/native-auth/start",
        (value) => {
          const result = nativeStartResponseSchema.safeParse(value);
          return result.success ? result.data.authorizationUrl : undefined;
        },
        signal,
        parsed.data,
      );
    },
    async exchange(input, signal) {
      const parsed = nativeExchangeSchema.safeParse(input);
      if (!parsed.success) return { status: "error" };
      return request(
        "/v1/native-auth/exchange",
        (value) => {
          const result = nativeExchangeResponseSchema.safeParse(value);
          return result.success ? result.data.credential : undefined;
        },
        signal,
        parsed.data,
      );
    },
    session: (credential, signal) =>
      request(
        "/v1/session",
        (value) => {
          const parsed = sessionSchema.safeParse(value);
          return parsed.success ? parsed.data : undefined;
        },
        signal,
        undefined,
        credential,
      ),
  };
  return {
    ...backend,
    async bootstrap(
      credential: string,
      signal: AbortSignal,
    ): Promise<SensitiveResult<NativeBootstrap>> {
      const result = await request(
        "/v1/consent-bootstrap",
        parseNativeBootstrap,
        signal,
        undefined,
        credential,
      );
      if (result.status !== "ready") return result;
      try {
        if (
          Date.parse(result.data.expiresAt) <= (options.now ?? Date.now)() ||
          (await options.sha256(result.data.policy.text)) !== result.data.policy.sha256
        )
          return { status: "unavailable" };
        return signal.aborted ? { status: "anonymous" } : result;
      } catch {
        return { status: "unavailable" };
      }
    },
    consent(
      credential: string,
      bootstrap: NativeBootstrap,
      decision: "granted" | "declined",
      signal: AbortSignal,
    ) {
      const parsed = consentBootstrapSchema.safeParse(bootstrap);
      if (
        !parsed.success ||
        !["granted", "declined"].includes(decision) ||
        Date.parse(parsed.data.expiresAt) <= (options.now ?? Date.now)()
      )
        return Promise.resolve<SensitiveResult<{ id: string }>>({ status: "expired" });
      return request(
        "/v1/consents",
        (value) =>
          record(value) &&
          exact(value, ["id"]) &&
          sessionSchema.shape.userId.safeParse(value.id).success
            ? { id: String(value.id) }
            : undefined,
        signal,
        { requirement: parsed.data.requirement, decision },
        credential,
      );
    },
    async logout(
      credential: string,
      operationId: string,
      signal: AbortSignal,
    ): Promise<NativeLogoutResult> {
      if (!nativeLogoutKeySchema.safeParse(operationId).success) return { status: "error" };
      const result = await request(
        "/v1/native-auth/logout",
        (value) =>
          record(value) && exact(value, ["revoked"]) && value.revoked === true
            ? { revoked: true as const }
            : undefined,
        signal,
        {},
        credential,
        operationId,
      );
      return result.status === "unavailable" ? { status: "logout_pending" } : result;
    },
  };
}
