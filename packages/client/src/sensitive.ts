import type { ClientSession } from "@kandamkulathi/contracts/client";
import {
  type ApprovedEntry,
  approvedEntrySchema,
  chatInputSchema,
  draftSchema,
  type Handoff,
  handoffSchema,
  type KnowledgeDraft,
  type KnowledgeReply,
  localeSchema,
  replySchema,
  reviewReady,
  saveDraftSchema,
} from "@kandamkulathi/contracts/knowledge";
import {
  type Appointment,
  appointmentSchema,
  type Checkout,
  type Consent,
  consentSchema,
  consentSubmissionSchema,
  type IntakeSubmission,
  intakeSubmissionSchema,
  logoutSchema,
  type Payment,
  type ProviderReceipt,
  paymentSchema,
  providerReceiptSchema,
  referenceSchema,
  type SecurityContext,
  securityContextSchema,
  signInSchema,
  type VideoGrant,
  videoGrantSchema,
} from "@kandamkulathi/contracts/sensitive";
import { apiOrigin } from "./index";

export type SensitiveResult<T> =
  | { status: "ready"; data: T }
  | {
      status:
        | "anonymous"
        | "denied"
        | "unavailable"
        | "error"
        | "conflict"
        | "unknown"
        | "busy"
        | "expired";
    };
interface Schema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}
type OperationIdentity = string | { id: string };
const failure = <T>(
  status: Exclude<SensitiveResult<T>["status"], "ready">,
): SensitiveResult<T> => ({ status });

/** One in-memory lifetime per verified session. This is not a server authorization mechanism. */
export function sensitiveClient(options: {
  origin: string;
  local: boolean;
  session: ClientSession | null;
  transport?: typeof fetch;
  now?: () => number;
  uuid?: () => string;
  onRevoked?: () => void;
}) {
  const origin = apiOrigin(options.origin, options.local);
  const now = options.now ?? Date.now;
  const transport = options.transport ?? fetch;
  const uuid = options.uuid ?? (() => crypto.randomUUID());
  let context: SecurityContext | undefined;
  let disposed = false;
  let generation = 0;
  let mutating = false;
  let videoAttempt = 0;
  const controllers = new Set<AbortController>();
  const operationIds = new Map<string, string>();
  const valid = () =>
    !disposed && options.session !== null && Date.parse(options.session.expiresAt) > now();
  const clear = () => {
    generation++;
    context = undefined;
    operationIds.clear();
    for (const controller of controllers) controller.abort();
    controllers.clear();
  };
  const revoke = () => {
    disposed = true;
    clear();
    options.onRevoked?.();
  };
  async function request<T>(
    path: string,
    schema: Schema<T>,
    body?: unknown,
    operation?: OperationIdentity,
  ): Promise<SensitiveResult<T>> {
    const allowed = () => (path === "/v1/auth/start" ? !disposed : valid());
    if (!allowed()) return failure("anonymous");
    const epoch = generation;
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 5000);
    const mutation = body !== undefined;
    const retryKey = typeof operation === "string" ? operation : undefined;
    try {
      if (mutation && (!context || Date.parse(context.expiresAt) <= now()))
        return failure("anonymous");
      let operationId: string | undefined;
      if (typeof operation === "object") {
        // Caller-owned identities (chat/handoff) already identify the same explicit action.
        if (!referenceSchema.safeParse(operation.id).success) return failure("error");
        operationId = operation.id;
      } else if (retryKey) {
        operationId = operationIds.get(retryKey);
        if (!operationId) {
          operationId = uuid();
          if (!referenceSchema.safeParse(operationId).success) return failure("error");
          // Retain only ambiguous operations for retry; never evict an unresolved identity.
          if (operationIds.size >= 64) return failure("error");
          operationIds.set(retryKey, operationId);
        }
      }
      const response = await transport(`${origin}${path}`, {
        method: mutation ? "POST" : "GET",
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(mutation
            ? {
                "Content-Type": "application/json",
                "X-CSRF-Token": context?.csrfToken ?? "",
                ...(operationId ? { "Idempotency-Key": operationId } : {}),
              }
            : {}),
        },
        ...(mutation ? { body: JSON.stringify(body) } : {}),
      });
      if (epoch !== generation || !allowed()) return failure("anonymous");
      if (controller.signal.aborted) return failure(mutation ? "unknown" : "error");
      if (response.status === 401) {
        revoke();
        return failure("anonymous");
      }
      // These contract responses definitively reject the action. A new attempt is a new action.
      if ([403, 409, 410].includes(response.status)) {
        if (retryKey) operationIds.delete(retryKey);
        return failure(
          response.status === 403 ? "denied" : response.status === 409 ? "conflict" : "expired",
        );
      }
      if (response.status === 503) return failure("unavailable");
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
        return failure(mutation ? "unknown" : "error");
      const reader = response.body?.getReader();
      if (!reader) return failure(mutation ? "unknown" : "error");
      const chunks: Uint8Array[] = [];
      let length = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 65536) {
          await reader.cancel();
          return failure(mutation ? "unknown" : "error");
        }
        chunks.push(value);
      }
      if (epoch !== generation || !allowed()) return failure("anonymous");
      if (controller.signal.aborted) return failure(mutation ? "unknown" : "error");
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const parsed = schema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
      if (!parsed.success) return failure(mutation ? "unknown" : "error");
      // A validated result closes this action, even when its business status is still pending.
      // Later reconciliation must verify current state rather than replay this completed poll.
      if (retryKey) operationIds.delete(retryKey);
      return { status: "ready", data: parsed.data };
    } catch {
      return failure(
        epoch !== generation || !allowed() ? "anonymous" : mutation ? "unknown" : "error",
      );
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
    }
  }
  async function security() {
    const result = await request("/v1/security/context", securityContextSchema);
    if (result.status !== "ready") return result;
    if (
      !options.session ||
      result.data.userId !== options.session.userId ||
      Date.parse(result.data.expiresAt) <= now() ||
      Date.parse(result.data.expiresAt) > Date.parse(options.session.expiresAt)
    ) {
      revoke();
      return failure<SecurityContext>("anonymous");
    }
    if (context && context.sessionId !== result.data.sessionId) {
      revoke();
      return failure<SecurityContext>("anonymous");
    }
    context = result.data;
    return result;
  }
  async function mutate<T>(
    path: string,
    schema: Schema<T>,
    body: unknown,
    operation: OperationIdentity,
  ) {
    if (mutating) return failure<T>("busy");
    mutating = true; // Reserve before the first await; one caller owns the mutation slot.
    try {
      const secured = await security();
      if (secured.status !== "ready") return failure<T>(secured.status);
      return await request(path, schema, body, operation);
    } finally {
      mutating = false;
    }
  }
  const reference = (value: string) => referenceSchema.safeParse(value).success;
  return {
    dispose: () => {
      disposed = true;
      clear();
    },
    security,
    chat: (input: unknown) => {
      const parsed = chatInputSchema.safeParse(input);
      return parsed.success
        ? mutate("/v1/chat/replies", replySchema, parsed.data, { id: parsed.data.operationId })
        : Promise.resolve(failure<KnowledgeReply>("error"));
    },
    approvedEntry: (id: string) =>
      reference(id)
        ? request(`/v1/knowledge/approved/${id}`, approvedEntrySchema)
        : Promise.resolve(failure<ApprovedEntry>("error")),
    knowledgeDraft: (id: string) =>
      reference(id)
        ? request(`/v1/knowledge/drafts/${id}`, draftSchema)
        : Promise.resolve(failure<KnowledgeDraft>("error")),
    saveKnowledgeDraft: (input: unknown, operationId: string) => {
      const parsed = saveDraftSchema.safeParse(input);
      return parsed.success && reference(operationId)
        ? mutate(
            "/v1/knowledge/drafts",
            draftSchema,
            parsed.data,
            `draft:${parsed.data.id ?? operationId}:${parsed.data.expectedRevision ?? "new"}`,
          )
        : Promise.resolve(failure<KnowledgeDraft>("error"));
    },
    reviewKnowledge: async (
      id: string,
      revision: number,
      action: "request_review" | "approve" | "withdraw",
    ): Promise<SensitiveResult<KnowledgeDraft>> => {
      if (
        !reference(id) ||
        !Number.isSafeInteger(revision) ||
        revision < 1 ||
        !["request_review", "approve", "withdraw"].includes(action)
      )
        return failure("error");
      const current = await request(`/v1/knowledge/drafts/${id}`, draftSchema);
      if (current.status !== "ready") return current;
      const draft = current.data;
      if (draft.id !== id || draft.revision !== revision) return failure("conflict");
      const allowed =
        action === "request_review"
          ? draft.state === "draft" && draft.permissions.edit && reviewReady(draft.document)
          : action === "approve"
            ? draft.state === "in_review" &&
              draft.permissions.approve &&
              draft.authorId !== options.session?.userId &&
              reviewReady(draft.document)
            : draft.state === "approved" && draft.permissions.withdraw;
      return allowed
        ? mutate(
            `/v1/knowledge/drafts/${id}/${action}`,
            draftSchema,
            { expectedRevision: revision },
            `review:${id}:${revision}:${action}`,
          )
        : failure("denied");
    },
    requestHandoff: (operationId: string, locale: string) =>
      reference(operationId) && localeSchema.safeParse(locale).success
        ? mutate("/v1/support/handoffs", handoffSchema, { locale }, { id: operationId })
        : Promise.resolve(failure<Handoff>("error")),
    consents: () => request("/v1/consents/current", consentSchema),
    saveConsents: (input: unknown) => {
      const parsed = consentSubmissionSchema.safeParse(input);
      return parsed.success
        ? mutate(
            "/v1/consents",
            consentSchema,
            parsed.data,
            `consent:${JSON.stringify(parsed.data)}`,
          )
        : Promise.resolve(failure<Consent>("error"));
    },
    payment: (id: string) =>
      reference(id)
        ? request(`/v1/payments/${id}`, paymentSchema)
        : Promise.resolve(failure<Payment>("error")),
    reconcile: (id: string, receipt?: ProviderReceipt) => {
      if (!reference(id) || (receipt && !providerReceiptSchema.safeParse(receipt).success))
        return Promise.resolve(failure<Payment>("error"));
      // Reconciliation is read/verify-only on the server. It must NEVER create another charge.
      return mutate(
        `/v1/payments/${id}/reconcile`,
        paymentSchema,
        { ...(receipt ? { receipt } : {}) },
        `reconcile:${id}:${receipt?.razorpay_payment_id ?? "current"}`,
      );
    },
    appointment: (id: string) =>
      reference(id)
        ? request(`/v1/appointments/${id}`, appointmentSchema)
        : Promise.resolve(failure<Appointment>("error")),
    submitIntake: (id: string, input: IntakeSubmission) => {
      const parsed = intakeSubmissionSchema.safeParse(input);
      return reference(id) && parsed.success
        ? mutate(
            `/v1/appointments/${id}/intake`,
            appointmentSchema,
            parsed.data,
            `intake:${id}:${parsed.data.revision}`,
          )
        : Promise.resolve(failure<Appointment>("error"));
    },
    videoGrant: async (id: string, revision: string): Promise<SensitiveResult<VideoGrant>> => {
      if (!reference(id) || !/^[A-Za-z0-9._-]{1,80}$/.test(revision)) return failure("error");
      const result = await mutate(
        `/v1/appointments/${id}/video-grants`,
        videoGrantSchema,
        { revision },
        `video:${id}:${++videoAttempt}`,
      );
      if (
        result.status === "ready" &&
        (result.data.appointmentId !== id ||
          result.data.revision !== revision ||
          Date.parse(result.data.expiresAt) <= now() ||
          Date.parse(result.data.expiresAt) - now() > 5 * 60 * 1000)
      )
        return failure("denied");
      return result;
    },
    signIn: async () => {
      // Same API origin only. WorkOS redirects/state/PKCE and final cookies are server-owned.
      const result = await request("/v1/auth/start", signInSchema);
      return result.status === "ready"
        ? { status: "ready" as const, data: `${origin}${result.data.redirectPath}` }
        : result;
    },
    signOut: async () => {
      const result = await mutate("/v1/session/logout", logoutSchema, {}, "logout");
      revoke(); // Clear this client's memory even if remote revocation could not be confirmed.
      return result;
    },
  };
}
export type SensitiveClient = ReturnType<typeof sensitiveClient>;

export function bookingExpired(appointment: Appointment, now = Date.now()) {
  return (
    appointment.status === "expired" ||
    ((appointment.status === "held" || appointment.status === "payment_pending") &&
      (!appointment.holdExpiresAt || Date.parse(appointment.holdExpiresAt) <= now))
  );
}
export function mayJoin(appointment: Appointment, now = Date.now()) {
  return (
    appointment.status === "confirmed" &&
    appointment.role !== "staff" &&
    appointment.identityVerified &&
    appointment.consentCurrent &&
    appointment.intake.physicianApproved &&
    appointment.intake.status === "accepted" &&
    now >= Date.parse(appointment.startsAt) &&
    now < Date.parse(appointment.endsAt)
  );
}

/** SDK completion/cancel/error are hints. Only a subsequent API response can establish payment state. */
export function paymentFlow(
  client: SensitiveClient,
  open: (checkout: Checkout, isCurrent: () => boolean) => Promise<unknown>,
  now = Date.now,
) {
  let busy = false;
  let disposed = false;
  return {
    dispose: () => {
      disposed = true;
    },
    async pay(
      id: string,
      expected: Pick<Payment, "revision" | "amountPaise">,
    ): Promise<SensitiveResult<Payment>> {
      if (busy) return failure("busy");
      if (disposed) return failure("anonymous");
      busy = true;
      try {
        const current = await client.payment(id);
        if (disposed) return failure("anonymous");
        if (current.status !== "ready") return current;
        if (current.data.id !== id) return failure("error");
        if (
          Date.parse(current.data.expiresAt) <= now() &&
          current.data.status === "requires_payment"
        )
          return failure("expired");
        if (current.data.status !== "requires_payment" || !current.data.checkout) return current;
        if (
          current.data.revision !== expected.revision ||
          current.data.amountPaise !== expected.amountPaise
        )
          return failure("conflict");
        let receipt: ProviderReceipt | undefined;
        try {
          const parsed = providerReceiptSchema.safeParse(
            await open(
              current.data.checkout,
              () => !disposed && Date.parse(current.data.expiresAt) > now(),
            ),
          );
          if (parsed.success && parsed.data.razorpay_order_id === current.data.checkout.order_id)
            receipt = parsed.data;
        } catch {
          /* Cancellation, timeout and SDK failure all need current-state reconciliation. */
        }
        if (disposed) return failure("anonymous");
        const result = await client.reconcile(id, receipt);
        return result.status === "ready" && result.data.id !== id ? failure("error") : result;
      } finally {
        busy = false;
      }
    },
  };
}
