import type { ServiceApp } from "@kandamkulathi/server";
import { verifiedIdentitySchema } from "../../../packages/contracts/src/identity";
import {
  transcriptionRequestSchema,
  validateTranscriptionAudio,
} from "../../../packages/contracts/src/transcription";
import { transaction } from "../../../packages/database/src/client";
import {
  type TranscriptionTicket,
  transcriptionAdmission,
} from "../../../packages/database/src/transcription-admission";
import type { createTranscriptionProvider } from "../../../packages/providers/src/transcription";
import { validateCurrentIdentity } from "../../../packages/server/src/authorization";
import type { createConfiguredIdentityRuntime } from "./runtime";

type ConfiguredRuntime = ReturnType<typeof createConfiguredIdentityRuntime>;
export type TranscriptionRuntime = Pick<
  ConfiguredRuntime,
  "dependencies" | "mutation" | "withSessionInTransaction"
> & {
  identity: Pick<ConfiguredRuntime["identity"], "withClient" | "now">;
};
/** Parent passes the canonical, event-bound native/session transaction guard. No detached authority. */
export function registerTranscriptionRoutes(
  app: ServiceApp,
  runtime: TranscriptionRuntime,
  provider: ReturnType<typeof createTranscriptionProvider>,
) {
  app.post("/v1/transcription", async (c) => {
    c.header("Cache-Control", "no-store");
    const request = c.req.raw;
    // P1 native-only bearer path; never ambient cookie authorization.
    if (
      request.headers.has("cookie") ||
      request.headers.has("origin") ||
      !/^Bearer n1_[A-Za-z0-9_.-]+$/.test(request.headers.get("authorization") ?? "")
    )
      return c.json({ status: "denied" }, 403);
    if (!provider.policyVersion) return c.json({ status: "not-configured" }, 503);
    try {
      if (request.headers.get("content-type") !== "application/json")
        return c.json({ status: "invalid" }, 400);
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ status: "invalid" }, 400);
      }
      const input = transcriptionRequestSchema.safeParse(body);
      if (!input.success) return c.json({ status: "invalid" }, 400);
      if (input.data.processingPolicyVersion !== provider.policyVersion)
        return c.json({ status: "denied" }, 403);
      const bytes = Uint8Array.from(atob(input.data.audio), (value) => value.charCodeAt(0));
      try {
        validateTranscriptionAudio(bytes);
      } catch {
        return c.json({ status: "invalid" }, 400);
      }
      const verification = await runtime.dependencies.verifySession(request);
      if (verification.status === "unauthenticated") return c.json({ status: "denied" }, 401);
      if (verification.status !== "verified") return c.json({ status: "unknown" }, 503);
      const identity = verifiedIdentitySchema.parse(verification.identity);
      const mutation = await runtime.mutation(request, identity);
      if (mutation !== "allowed")
        return c.json(
          { status: mutation === "denied" ? "denied" : "unknown" },
          mutation === "denied" ? 403 : 503,
        );
      const ticket: TranscriptionTicket = {
        actorId: identity.actorId,
        operationId: crypto.randomUUID(),
        fence: crypto.randomUUID(),
        policyVersion: input.data.processingPolicyVersion,
      };
      const current = (action: "reserve" | "check") =>
        runtime.identity.withClient((client) =>
          transaction(client, () =>
            runtime.withSessionInTransaction(client, request, identity, async (authority) => {
              const valid = validateCurrentIdentity(identity, authority, runtime.identity.now());
              if (!valid.allowed)
                return {
                  allowed: false,
                  status: valid.status,
                  reply: valid.status === 503 ? "unknown" : "denied",
                } as const;
              const admission = await transcriptionAdmission(client, action, ticket);
              return admission === (action === "reserve" ? "admitted" : "allowed")
                ? ({ allowed: true } as const)
                : ({
                    allowed: false,
                    status: admission === "rate-limited" ? 429 : 503,
                    reply:
                      admission === "not-configured" || admission === "rate-limited"
                        ? admission
                        : "unknown",
                  } as const);
            }),
          ),
        );
      const rejected = (result: { status: 401 | 403 | 429 | 503; reply: string }) =>
        c.json({ status: result.reply }, result.status);
      const before = await current("reserve");
      if (!before.allowed) return rejected(before);
      // Reservation/usage COMMIT before external work. Fresh fence before dispatch and result.
      let completed = true; // No dispatch yet: safe to release a reservation if the second fence denies.
      try {
        const dispatch = await current("check");
        if (!dispatch.allowed) return rejected(dispatch);
        request.signal.throwIfAborted();
        completed = false;
        const result = await provider.transcribe(bytes, request.signal);
        completed = result.status !== "unknown";
        const after = await current("check");
        if (!after.allowed) return rejected(after);
        return c.json(
          result,
          result.status === "review" || result.status === "empty"
            ? 200
            : result.status === "rate-limited"
              ? 429
              : 503,
        );
      } finally {
        // Token-only cleanup must remain possible after session/privacy revocation.
        // Failed/expired cleanup stays blocking. Unknown uses quota AND retains its slot.
        await runtime.identity.withClient((client) =>
          transaction(client, async () => {
            await client.query("SELECT set_config('identity.actor_id',$1,true)", [
              identity.actorId,
            ]);
            await transcriptionAdmission(client, completed ? "complete" : "uncertain", ticket);
          }),
        );
      }
    } catch {
      return c.json({ status: "unknown" }, 503);
    }
  });
}
