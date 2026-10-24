import { z } from "zod";
import type { NativeStart } from "../../../contracts/src/native-auth.ts";
import type { WorkosOptions } from "./index.ts";

export async function nativeProviderJson(response: Response): Promise<unknown> {
  if (!response.ok || !response.body) throw new Error("Native provider unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 65536) throw new Error("Native provider response invalid");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes));
}

/** Fixed official endpoints. Callers enforce approved environment redirect and admission. */
export function createNativeWorkosOAuth(
  options: WorkosOptions,
  transport: typeof fetch,
  now = Date.now,
) {
  const request = (url: string, init: RequestInit = {}) =>
    transport(url, { ...init, redirect: "error", signal: AbortSignal.timeout(5000) });
  return {
    authorizationUrl(proof: NativeStart) {
      const url = new URL("https://api.workos.com/user_management/authorize");
      for (const [key, value] of Object.entries({
        provider: "authkit",
        response_type: "code",
        client_id: options.clientId,
        redirect_uri: proof.redirectUri,
        state: proof.state,
        screen_hint: "sign-in",
        code_challenge: proof.codeChallenge,
        code_challenge_method: "S256",
      }))
        url.searchParams.set(key, value);
      return url.href;
    },
    async exchange(code: string, codeVerifier: string, redirectUri: string) {
      const result = z
        .object({
          access_token: z.string().min(1).max(16377),
          user: z.object({ id: z.string().regex(/^user_[A-Za-z0-9]+$/) }),
          impersonator: z.unknown().optional(),
        })
        .parse(
          await nativeProviderJson(
            await request("https://api.workos.com/user_management/authenticate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                client_id: options.clientId,
                client_secret: options.apiKey,
                grant_type: "authorization_code",
                code,
                code_verifier: codeVerifier,
                redirect_uri: redirectUri,
              }),
            }),
          ),
        );
      if (result.impersonator != null) throw new Error("Native impersonation denied");
      // No refresh port exists. Drop refresh/third-party tokens, never expose or retain them.
      return { accessToken: result.access_token, userId: result.user.id };
    },
    async active(userId: string, sessionId: string) {
      if (!/^user_[A-Za-z0-9]+$/.test(userId) || !/^session_[A-Za-z0-9]+$/.test(sessionId))
        throw new Error("Invalid native provider binding");
      let cursor: string | null = null;
      const seen = new Set<string>();
      for (let page = 0; page < 10; page++) {
        const url = new URL(`https://api.workos.com/user_management/users/${userId}/sessions`);
        url.searchParams.set("limit", "100");
        if (cursor) url.searchParams.set("after", cursor);
        const result = z
          .object({
            data: z
              .array(
                z.object({
                  id: z.string().regex(/^session_[A-Za-z0-9]+$/),
                  user_id: z.string(),
                  status: z.string(),
                  ended_at: z.iso.datetime().nullish(),
                  expires_at: z.iso.datetime(),
                }),
              )
              .max(100),
            list_metadata: z.object({ after: z.string().max(256).nullable() }),
          })
          .parse(
            await nativeProviderJson(
              await request(url.href, { headers: { Authorization: `Bearer ${options.apiKey}` } }),
            ),
          );
        if (result.data.some((entry) => entry.user_id !== userId))
          throw new Error("Invalid native provider binding");
        const found = result.data.filter((entry) => entry.id === sessionId);
        if (found.length > 1) throw new Error("Invalid native provider binding");
        if (found[0]) {
          // This endpoint documents ACTIVE sessions only. Do not infer completion
          // from an undocumented status or contradictory/future ended timestamp.
          if (
            found[0].status !== "active" ||
            (found[0].ended_at != null && Date.parse(found[0].ended_at) > now())
          )
            throw new Error("Unknown native provider state");
          return found[0].ended_at == null && Date.parse(found[0].expires_at) > now();
        }
        cursor = result.list_metadata.after;
        if (!cursor) return false; // Fully enumerated documented active-session list.
        if (seen.has(cursor)) throw new Error("Invalid native provider pagination");
        seen.add(cursor);
      }
      throw new Error("Native provider pagination limit");
    },
    async revoke(sessionId: string) {
      if (!/^session_[A-Za-z0-9]+$/.test(sessionId))
        throw new Error("Invalid native provider binding");
      const response = await request("https://api.workos.com/user_management/sessions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.apiKey}` },
        body: JSON.stringify({ session_id: sessionId }),
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error("Native logout pending");
      // Success is reconciled using the active list; undocumented revoke idempotency isn't assumed.
    },
  };
}
