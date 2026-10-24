import {
  type AccountLinkGrant,
  type AccountLinkRepository,
  accountLinkConsumptionSchema,
  accountLinkGrantSchema,
  type ChannelIdentity,
  type ChannelMutationPlan,
  type ConversationOwnership,
  channelIdentitySchema,
  channelLimits,
  conversationOwnershipSchema,
  type OwnershipChangeCommand,
  type OwnershipRepository,
  ownershipChangeCommandSchema,
  type ReviewableTranscript,
  reviewableTranscriptSchema,
  type TranscriptConfirmationCommand,
  type TranscriptRepository,
  type TranscriptReview,
  type TrustedChannelActor,
  type TrustedLinkAuthorization,
  type TrustedTranscriptActor,
  transcriptConfirmationCommandSchema,
  transcriptReviewSchema,
  trustedChannelActorSchema,
  trustedLinkAuthorizationSchema,
  trustedTranscriptActorSchema,
} from "@kandamkulathi/contracts/channels";

function sameIdentity(left: ChannelIdentity, right: ChannelIdentity): boolean {
  return (
    left.businessAccountId === right.businessAccountId &&
    left.receivingPhoneNumberId === right.receivingPhoneNumberId &&
    left.senderId === right.senderId
  );
}

function validEpoch(epoch: number): boolean {
  return Number.isSafeInteger(epoch) && epoch >= 0 && epoch < Number.MAX_SAFE_INTEGER;
}

/** This guard is required both before generation and again when committing/claiming unsent work. */
export function mayBotProceed(state: ConversationOwnership, expectedEpoch: number): boolean {
  const parsed = conversationOwnershipSchema.safeParse(state);
  return (
    parsed.success &&
    validEpoch(parsed.data.epoch) &&
    parsed.data.owner.kind === "bot" &&
    parsed.data.epoch === expectedEpoch
  );
}

export function planOwnershipChange(
  stateInput: ConversationOwnership,
  actorInput: TrustedChannelActor,
  intent: "take-over" | "resume-bot",
): ConversationOwnership | null {
  const parsedState = conversationOwnershipSchema.safeParse(stateInput);
  const parsedActor = trustedChannelActorSchema.safeParse(actorInput);
  if (!parsedState.success || !parsedActor.success) return null;
  const state = parsedState.data;
  const actor = parsedActor.data;
  if (
    !actor.accountId ||
    !state.accountId ||
    !state.conversationId ||
    actor.conversationId !== state.conversationId ||
    actor.conversationAccountId !== state.accountId ||
    !validEpoch(state.epoch)
  )
    return null;
  if (intent === "take-over") {
    if (!actor.mayTakeOver) return null;
    return { ...state, epoch: state.epoch + 1, owner: { kind: "human", agentId: actor.accountId } };
  }
  if (intent !== "resume-bot" || !actor.mayResumeBot || state.owner.kind !== "human") return null;
  return { ...state, epoch: state.epoch + 1, owner: { kind: "bot" } };
}

export async function changeOwnership(
  repository: OwnershipRepository,
  state: ConversationOwnership,
  actor: TrustedChannelActor,
  intent: "take-over" | "resume-bot",
): Promise<"committed" | "denied" | "conflict" | "unavailable"> {
  const command = ownershipChangeCommandSchema.safeParse({ actor, intent, expected: state });
  if (
    !command.success ||
    !planOwnershipChange(command.data.expected, command.data.actor, command.data.intent)
  )
    return "denied";
  try {
    return await repository.commitChange(command.data);
  } catch {
    return "unavailable";
  }
}

/**
 * Adapter-side policy helper, NOT a transaction. The adapter must obtain canonical/currentActor
 * from its verified authentication binding and authoritative storage; serialize revocation through
 * the same COMMIT as the returned effect. A planning-time actor is not current authorization.
 */
export function evaluateOwnershipChange(
  canonicalInput: ConversationOwnership,
  currentActorInput: TrustedChannelActor,
  commandInput: OwnershipChangeCommand,
): ChannelMutationPlan<ConversationOwnership> {
  const parsedCanonical = conversationOwnershipSchema.safeParse(canonicalInput);
  const parsedActor = trustedChannelActorSchema.safeParse(currentActorInput);
  const parsedCommand = ownershipChangeCommandSchema.safeParse(commandInput);
  if (!parsedCanonical.success || !parsedActor.success || !parsedCommand.success)
    return { outcome: "denied" };
  const canonical = parsedCanonical.data;
  const currentActor = parsedActor.data;
  const command = parsedCommand.data;
  if (
    currentActor.accountId !== command.actor.accountId ||
    currentActor.conversationId !== command.actor.conversationId ||
    currentActor.conversationAccountId !== command.actor.conversationAccountId ||
    canonical.conversationId !== command.actor.conversationId ||
    canonical.accountId !== command.actor.conversationAccountId ||
    (command.intent === "take-over" && !currentActor.mayTakeOver) ||
    (command.intent === "resume-bot" && !currentActor.mayResumeBot)
  )
    return { outcome: "denied" };
  // Only currently authorized actors may observe a conflict; eligibility follows the CAS check.
  const expected = command.expected;
  if (
    expected.accountId !== canonical.accountId ||
    expected.conversationId !== canonical.conversationId ||
    expected.epoch !== canonical.epoch ||
    expected.owner.kind !== canonical.owner.kind ||
    (expected.owner.kind === "human" &&
      canonical.owner.kind === "human" &&
      expected.owner.agentId !== canonical.owner.agentId)
  )
    return { outcome: "conflict" };
  const next = planOwnershipChange(canonical, currentActor, command.intent);
  if (!next) return { outcome: "denied" };
  return { outcome: "ready", next };
}

export function mayConsumeLinkGrant(
  grantInput: AccountLinkGrant,
  authorizationInput: TrustedLinkAuthorization,
  identityInput: ChannelIdentity,
  tokenSha256: string,
  nowMs: number,
): boolean {
  const parsedGrant = accountLinkGrantSchema.safeParse(grantInput);
  const parsedAuthorization = trustedLinkAuthorizationSchema.safeParse(authorizationInput);
  const parsedIdentity = channelIdentitySchema.safeParse(identityInput);
  if (!parsedGrant.success || !parsedAuthorization.success || !parsedIdentity.success) return false;
  const grant = parsedGrant.data;
  const authorization = parsedAuthorization.data;
  const identity = parsedIdentity.data;
  return (
    Boolean(authorization.accountId) &&
    authorization.mayLinkChannel &&
    authorization.accountId === grant.accountId &&
    authorization.confirmedGrantId === grant.grantId &&
    sameIdentity(grant.identity, identity) &&
    tokenSha256 === grant.tokenSha256 &&
    !grant.consumed &&
    validEpoch(grant.revision) &&
    Number.isSafeInteger(nowMs) &&
    nowMs >= 0 &&
    Number.isSafeInteger(grant.expiresAtMs) &&
    nowMs < grant.expiresAtMs
  );
}

/**
 * Grant issuance must use 32 random bytes, store only their SHA-256, and bind the full channel
 * identity and authenticated account. This consumer accepts no phone-only authentication.
 */
export async function consumeAccountLink(
  repository: AccountLinkRepository,
  inputValue: Readonly<{
    grantId: string;
    token: string;
    identity: ChannelIdentity;
    authorization: TrustedLinkAuthorization;
    nowMs: number;
  }>,
): Promise<"linked" | "denied" | "conflict" | "unavailable"> {
  const parsedInput = accountLinkConsumptionSchema.safeParse(inputValue);
  if (!parsedInput.success) return "denied";
  const input = parsedInput.data;
  if (!input.authorization.mayLinkChannel || input.authorization.confirmedGrantId !== input.grantId)
    return "denied";
  try {
    const parsedGrant = accountLinkGrantSchema.safeParse(await repository.loadGrant(input.grantId));
    if (!parsedGrant.success || parsedGrant.data.grantId !== input.grantId) return "denied";
    const grant = parsedGrant.data;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.token));
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    if (!mayConsumeLinkGrant(grant, input.authorization, input.identity, hash, input.nowMs))
      return "denied";
    return (await repository.consumeAndLink(grant)) ? "linked" : "conflict";
  } catch {
    return "unavailable";
  }
}

/** Review saves only text. No tool invocation, checkout, booking or medical permission is created. */
export function planTranscriptConfirmation(
  stateInput: ReviewableTranscript,
  authorizationInput: TrustedTranscriptActor,
  reviewInput: TranscriptReview,
): ReviewableTranscript | null {
  const parsedState = reviewableTranscriptSchema.safeParse(stateInput);
  const parsedAuthorization = trustedTranscriptActorSchema.safeParse(authorizationInput);
  const parsedReview = transcriptReviewSchema.safeParse(reviewInput);
  if (!parsedState.success || !parsedAuthorization.success || !parsedReview.success) return null;
  const state = parsedState.data;
  const authorization = parsedAuthorization.data;
  const input = parsedReview.data;
  if (
    !authorization.accountId ||
    !authorization.mayReview ||
    authorization.accountId !== state.accountId ||
    !state.conversationId ||
    authorization.conversationId !== state.conversationId ||
    !input.explicitlyConfirmed ||
    input.transcriptId !== state.transcriptId ||
    input.expectedRevision !== state.revision ||
    state.state !== "pending-review" ||
    !validEpoch(state.revision) ||
    !input.reviewedText.trim() ||
    input.reviewedText.length > channelLimits.textCharacters
  )
    return null;
  return { ...state, revision: state.revision + 1, text: input.reviewedText, state: "confirmed" };
}

export async function confirmTranscript(
  repository: TranscriptRepository,
  state: ReviewableTranscript,
  authorization: TrustedTranscriptActor,
  input: TranscriptReview,
): Promise<"confirmed" | "denied" | "conflict" | "unavailable"> {
  const command = transcriptConfirmationCommandSchema.safeParse({
    actor: authorization,
    intent: "confirm-reviewed-text",
    expected: state,
    review: input,
  });
  if (
    !command.success ||
    !planTranscriptConfirmation(command.data.expected, command.data.actor, command.data.review)
  )
    return "denied";
  try {
    const result = await repository.confirmReview(command.data);
    return result === "committed" ? "confirmed" : result;
  } catch {
    return "unavailable";
  }
}

/** Same transactional/authorization-serialization obligation as evaluateOwnershipChange. */
export function evaluateTranscriptConfirmation(
  canonicalInput: ReviewableTranscript,
  currentActorInput: TrustedTranscriptActor,
  commandInput: TranscriptConfirmationCommand,
): ChannelMutationPlan<ReviewableTranscript> {
  const parsedCanonical = reviewableTranscriptSchema.safeParse(canonicalInput);
  const parsedActor = trustedTranscriptActorSchema.safeParse(currentActorInput);
  const parsedCommand = transcriptConfirmationCommandSchema.safeParse(commandInput);
  if (!parsedCanonical.success || !parsedActor.success || !parsedCommand.success)
    return { outcome: "denied" };
  const canonical = parsedCanonical.data;
  const currentActor = parsedActor.data;
  const command = parsedCommand.data;
  if (
    command.intent !== "confirm-reviewed-text" ||
    currentActor.accountId !== command.actor.accountId ||
    currentActor.conversationId !== command.actor.conversationId ||
    canonical.accountId !== command.actor.accountId ||
    canonical.conversationId !== command.actor.conversationId ||
    canonical.transcriptId !== command.review.transcriptId ||
    !currentActor.mayReview
  )
    return { outcome: "denied" };
  // A completed/changed review is stale for an authorized actor, not a permission denial.
  const expected = command.expected;
  if (
    expected.transcriptId !== canonical.transcriptId ||
    expected.accountId !== canonical.accountId ||
    expected.conversationId !== canonical.conversationId ||
    expected.revision !== canonical.revision ||
    expected.state !== canonical.state ||
    expected.text !== canonical.text
  )
    return { outcome: "conflict" };
  const next = planTranscriptConfirmation(canonical, currentActor, command.review);
  if (!next) return { outcome: "denied" };
  return { outcome: "ready", next };
}
