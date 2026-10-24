import { z } from "zod";
import { canonicalUuidSchema } from "./identifiers.ts";

export const whatsappWebhookPath = "/v1/channels/whatsapp/webhook";
export const channelLimits = { bodyBytes: 65_536, events: 100, textCharacters: 4096 } as const;
export const whatsappNumericIdSchema = z.string().regex(/^\d{1,32}$/);
export const whatsappProviderIdSchema = z.string().regex(/^[A-Za-z0-9_.=+-]{1,256}$/);
export const whatsappConfigSchema = z
  .object({
    appSecret: z.string().min(16).max(512),
    verifyToken: z.string().min(16).max(512),
    businessAccountId: whatsappNumericIdSchema,
    receivingPhoneNumberId: whatsappNumericIdSchema,
  })
  .strict();
export type WhatsAppConfig = z.infer<typeof whatsappConfigSchema>;
export const channelErrorCodeSchema = z.enum([
  "CHANNEL_UNAVAILABLE",
  "CHALLENGE_DENIED",
  "INVALID_CHALLENGE",
  "METHOD_NOT_ALLOWED",
  "INVALID_BODY",
  "PAYLOAD_TOO_LARGE",
  "SIGNATURE_DENIED",
  "CHANNEL_IDENTITY_DENIED",
  "RECEIPT_UNAVAILABLE",
]);
export type ChannelErrorCode = z.infer<typeof channelErrorCodeSchema>;
export const channelErrorSchema = z
  .object({
    error: z
      .object({
        code: channelErrorCodeSchema,
        message: z.string().min(1),
        requestId: canonicalUuidSchema,
      })
      .strict(),
  })
  .strict();

export const channelIdentitySchema = z
  .object({
    businessAccountId: whatsappNumericIdSchema,
    receivingPhoneNumberId: whatsappNumericIdSchema,
    senderId: whatsappNumericIdSchema,
  })
  .strict();
export type ChannelIdentity = Readonly<z.infer<typeof channelIdentitySchema>>;

/** Transport identity is not proof of an authenticated application account. */
export type WhatsAppInboxEvent = Readonly<
  {
    businessAccountId: string;
    receivingPhoneNumberId: string;
    providerEventId: string;
    occurredAtSeconds: string;
  } & (
    | { kind: "text"; senderId: string; text: string }
    | { kind: "audio"; senderId: string; mediaId: string; mimeType: string; mediaSha256: string }
    | { kind: "status"; recipientId: string; status: "sent" | "delivered" | "read" | "failed" }
  )
>;

export type SemanticInboxReceipt = Readonly<{
  /** JSON tuple, not a raw payload hash: envelope changes do not bypass deduplication. */
  semanticKey: string;
  contentSha256: string;
  event: WhatsAppInboxEvent;
}>;

const inboxEventBase = {
  businessAccountId: whatsappNumericIdSchema,
  receivingPhoneNumberId: whatsappNumericIdSchema,
  providerEventId: whatsappProviderIdSchema,
  occurredAtSeconds: z.string().regex(/^\d{1,12}$/),
};
export const channelInboxReceiptSchema = z
  .object({
    semanticKey: z.string().min(1).max(2048),
    contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
    event: z.discriminatedUnion("kind", [
      z
        .object({
          ...inboxEventBase,
          kind: z.literal("text"),
          senderId: whatsappNumericIdSchema,
          text: z.string().max(channelLimits.textCharacters),
        })
        .strict(),
      z
        .object({
          ...inboxEventBase,
          kind: z.literal("audio"),
          senderId: whatsappNumericIdSchema,
          mediaId: whatsappProviderIdSchema,
          mimeType: z.string().max(128),
          mediaSha256: z.string().max(256),
        })
        .strict(),
      z
        .object({
          ...inboxEventBase,
          kind: z.literal("status"),
          recipientId: whatsappNumericIdSchema,
          status: z.enum(["sent", "delivered", "read", "failed"]),
        })
        .strict(),
    ]),
  })
  .strict();

export type InboxCommitResult = Readonly<{
  outcome: "committed";
  inserted: number;
  duplicates: number;
}>;

/**
 * Trusted server-injected port, never constructed from request input.
 * Resolve ONLY after a real durable transaction commits every receipt and processing obligation.
 * Enforce unique semanticKey + same contentSha256 on replay; conflicting content must fail.
 * Duplicate means an already committed receipt, not an in-flight attempt. Roll back the entire
 * batch on failure. Raw messages/media references are private data; no logs or queue payloads.
 */
export interface DurableChannelInbox {
  commitBatch(receipts: readonly SemanticInboxReceipt[]): Promise<InboxCommitResult>;
}

export const conversationOwnershipSchema = z
  .object({
    /** Immutable owning customer account, not the staff actor performing a takeover. */
    accountId: canonicalUuidSchema,
    conversationId: canonicalUuidSchema,
    epoch: z.number().int().safe().nonnegative(),
    owner: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("bot") }).strict(),
      z.object({ kind: z.literal("human"), agentId: canonicalUuidSchema }).strict(),
    ]),
  })
  .strict();
export type ConversationOwnership = Readonly<z.infer<typeof conversationOwnershipSchema>>;

/**
 * IDs come from verified server identity/scope, never request/model claims. Permission booleans
 * are planning-time snapshots, not grants that survive revocation or authorize a transaction.
 */
export const trustedChannelActorSchema = z
  .object({
    accountId: canonicalUuidSchema,
    conversationId: canonicalUuidSchema,
    conversationAccountId: canonicalUuidSchema,
    mayTakeOver: z.boolean(),
    mayResumeBot: z.boolean(),
  })
  .strict();
export type TrustedChannelActor = Readonly<z.infer<typeof trustedChannelActorSchema>>;

export type ChannelMutationOutcome = "committed" | "denied" | "conflict";
export type ChannelMutationPlan<State> =
  | Readonly<{ outcome: "ready"; next: State }>
  | Readonly<{ outcome: "denied" | "conflict" }>;
export const ownershipChangeCommandSchema = z
  .object({
    actor: trustedChannelActorSchema,
    intent: z.enum(["take-over", "resume-bot"]),
    expected: conversationOwnershipSchema,
  })
  .strict();
export type OwnershipChangeCommand = Readonly<z.infer<typeof ownershipChangeCommandSchema>>;

export interface OwnershipRepository {
  /**
   * The repository is bound to verified server authentication; actor.accountId is an identity
   * assertion to compare to that binding, never a credential or a way to select a different user.
   * One short transaction: load the canonical conversation by actor.conversationId, compare its
   * immutable account/conversation identity AND complete expected state; reload the actor's
   * current eligibility/scope/permission for this intent, and derive the next owner/epoch from
   * canonical state, never from expected state or the actor's planning-time permission booleans.
   * Serialize permission revocation with the effect (authorization-row locks or equivalent
   * version/serialization checks through COMMIT). Merely checking permission before the CAS
   * is insufficient. Atomically commit the effect, actor+intent audit and stale-unsent-work fence.
   * Denied/conflict changes nothing; committed resolves only post-COMMIT. No provider I/O or
   * database locks held across external calls. This cannot retract already submitted provider I/O.
   */
  commitChange(command: OwnershipChangeCommand): Promise<ChannelMutationOutcome>;
}

const sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const accountLinkGrantSchema = z
  .object({
    grantId: canonicalUuidSchema,
    revision: z.number().int().safe().nonnegative(),
    accountId: canonicalUuidSchema,
    identity: channelIdentitySchema,
    tokenSha256: sha256HexSchema,
    expiresAtMs: z.number().int().safe().nonnegative(),
    consumed: z.boolean(),
  })
  .strict();
export type AccountLinkGrant = Readonly<z.infer<typeof accountLinkGrantSchema>>;

export const trustedLinkAuthorizationSchema = z
  .object({
    accountId: canonicalUuidSchema,
    mayLinkChannel: z.boolean(),
    /** Explicit authenticated user confirmation, not inferred from chat content. */
    confirmedGrantId: canonicalUuidSchema,
  })
  .strict();
export type TrustedLinkAuthorization = Readonly<z.infer<typeof trustedLinkAuthorizationSchema>>;
export const accountLinkConsumptionSchema = z
  .object({
    grantId: canonicalUuidSchema,
    token: sha256HexSchema,
    identity: channelIdentitySchema,
    authorization: trustedLinkAuthorizationSchema,
    nowMs: z.number().int().safe().nonnegative(),
  })
  .strict();

export interface AccountLinkRepository {
  loadGrant(grantId: string): Promise<AccountLinkGrant | null>;
  /**
   * One transaction: recheck revision, unused state, identity/account and expiry against database
   * time, consume grant and create the unique account/channel link. The repository must be bound
   * to the trusted authorization context and recheck mutable permissions. Never return true precommit.
   */
  consumeAndLink(grant: AccountLinkGrant): Promise<boolean>;
}

export const reviewableTranscriptSchema = z
  .object({
    transcriptId: canonicalUuidSchema,
    accountId: canonicalUuidSchema,
    conversationId: canonicalUuidSchema,
    revision: z.number().int().safe().nonnegative(),
    text: z.string().max(channelLimits.textCharacters),
    state: z.enum(["pending-review", "confirmed"]),
  })
  .strict();
export type ReviewableTranscript = Readonly<z.infer<typeof reviewableTranscriptSchema>>;

/** Verified server principal/scope with a planning-time permission snapshot, not request claims. */
export const trustedTranscriptActorSchema = z
  .object({
    accountId: canonicalUuidSchema,
    conversationId: canonicalUuidSchema,
    mayReview: z.boolean(),
  })
  .strict();
export type TrustedTranscriptActor = Readonly<z.infer<typeof trustedTranscriptActorSchema>>;
export const transcriptReviewSchema = z
  .object({
    transcriptId: canonicalUuidSchema,
    expectedRevision: z.number().int().safe().nonnegative(),
    reviewedText: z.string().max(channelLimits.textCharacters),
    explicitlyConfirmed: z.boolean(),
  })
  .strict();
export type TranscriptReview = Readonly<z.infer<typeof transcriptReviewSchema>>;
export const transcriptConfirmationCommandSchema = z
  .object({
    actor: trustedTranscriptActorSchema,
    intent: z.literal("confirm-reviewed-text"),
    expected: reviewableTranscriptSchema,
    review: transcriptReviewSchema,
  })
  .strict();
export type TranscriptConfirmationCommand = Readonly<
  z.infer<typeof transcriptConfirmationCommandSchema>
>;

export interface TranscriptRepository {
  /**
   * Bound to verified server authentication, not authenticated by the supplied actor.accountId.
   * One short transaction: load canonical transcript by review.transcriptId; compare immutable
   * transcript/account/conversation identity and the complete expected state. Recheck current
   * authenticated actor identity, conversation scope, eligibility and review permission against
   * authoritative data, not expected.accountId or planning-time mayReview. Serialize revocation
   * through COMMIT with the text/revision update and actor+intent audit; derive the update from
   * canonical state plus the explicit review. Denied/conflict writes nothing. No provider I/O.
   * Resolve committed only post-COMMIT. Confirmation authorizes no subsequent domain action.
   */
  confirmReview(command: TranscriptConfirmationCommand): Promise<ChannelMutationOutcome>;
}
