import {
  type BookingAction,
  type BookingAuthority,
  type BookingBuffers,
  type BookingFeeSnapshot,
  type BookingInterval,
  type BookingPolicy,
  type BookingRecord,
  type BookingSlot,
  bookingActionSchema,
  bookingAuthoritySchema,
  bookingFeeSnapshotSchema,
  bookingIdSchema,
  bookingIntervalSchema,
  bookingPolicySchema,
  bookingRecordSchema,
  type DoctorAvailability,
  type DoctorLeave,
  doctorAvailabilitySchema,
  doctorLeaveSchema,
  type HoldBookingRequest,
  holdBookingRequestSchema,
  revisionSchema,
  utcInstantSchema,
  type VerifiedBookingPayment,
  verifiedBookingPaymentSchema,
} from "@kandamkulathi/contracts/booking";

export type Immutable<T> = T extends object ? { readonly [K in keyof T]: Immutable<T[K]> } : T;

function immutable<T>(value: T): Immutable<T> {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value as Immutable<T>;
}

/** Half-open intervals: equality at the boundary is not overlap. */
export function intervalsOverlap(a: BookingInterval, b: BookingInterval): boolean {
  const left = bookingIntervalSchema.parse(a);
  const right = bookingIntervalSchema.parse(b);
  return left.start < right.end && right.start < left.end;
}

function instantAt(ms: number): string | null {
  if (!Number.isSafeInteger(ms) || Math.abs(ms) > 8_640_000_000_000_000) return null;
  const parsed = utcInstantSchema.safeParse(new Date(ms).toISOString());
  return parsed.success ? parsed.data : null;
}

/** Returns null on overflow, not a wrapped/invalid date that could evade conflict checks. */
export function bufferedInterval(
  interval: BookingInterval,
  buffers: BookingBuffers,
): BookingInterval | null {
  const parsed = bookingIntervalSchema.parse(interval);
  // Reuse the strict buffer contract without trusting JS arithmetic from a caller.
  const parsedBuffers = doctorAvailabilitySchema.shape.buffers.parse(buffers);
  const start = instantAt(Date.parse(parsed.start) - parsedBuffers.beforeMs);
  const end = instantAt(Date.parse(parsed.end) + parsedBuffers.afterMs);
  return start && end ? { start, end } : null;
}

export type BookingDenial =
  | "DENIED"
  | "OWNER_MISMATCH"
  | "STALE_REVISION"
  | "STALE_AVAILABILITY"
  | "POLICY_MISMATCH"
  | "MODALITY_UNAVAILABLE"
  | "INVALID_SLOT"
  | "DOCTOR_UNAVAILABLE"
  | "FEE_MISMATCH"
  | "INVALID_STATE"
  | "NOT_EXPIRED"
  | "PAYMENT_CONFLICT";
type Denied = { kind: "rejected"; reason: BookingDenial };
const rejected = (reason: BookingDenial): Denied => ({ kind: "rejected", reason });

/** This is a requirement for the future adapter, NOT an implemented guarantee. */
export const bookingTransactionRequirements = Object.freeze({
  database: "PostgreSQL 17 / reviewed platform driver" as const,
  isolation:
    "Re-read current identity/scope, owner, revisions, schedule, leave and fee in one transaction" as const,
  exclusion:
    "Doctor-global GiST half-open interval exclusion including buffers for held/confirmed rows; no clinic partition" as const,
  atomicity:
    "CAS booking + unique payment business/event identities + audit + durable outbox commit atomically" as const,
  externalWork:
    "No network calls while locks are held; reconcile unknown commit/provider outcomes before retry" as const,
});

export type HoldIntent = Immutable<{
  kind: "hold_intent";
  persisted: false;
  booking: BookingRecord;
  guard: {
    mustNotExist: string;
    availabilityId: string;
    availabilityRevision: number;
    policyId: string;
    policyRevision: number;
    doctorId: string;
    occupiedInterval: BookingInterval;
  };
}>;

export interface HoldDecisionInput {
  request: HoldBookingRequest;
  /** Only server-verified identity, never request JSON/header actor claims. */
  authority: BookingAuthority;
  now: string;
  bookingId: string;
  /** Bound/reconciled server order reference; creating it is outside this pure function. */
  paymentOrderId: string;
  availability: DoctorAvailability;
  leaves: readonly DoctorLeave[];
  /** Complete doctor-global held/confirmed snapshot, not filtered to the requested clinic. */
  occupied: readonly BookingRecord[];
  fee: BookingFeeSnapshot;
  policy: BookingPolicy;
}

/** Pure proposal only. The future transaction must re-evaluate before INSERT/exclusion. */
export function decideBookingHold(input: HoldDecisionInput): HoldIntent | Denied {
  const request = holdBookingRequestSchema.parse(input.request);
  const authority = bookingAuthoritySchema.parse(input.authority);
  const now = utcInstantSchema.parse(input.now);
  const id = bookingIdSchema.parse(input.bookingId);
  const availability = doctorAvailabilitySchema.parse(input.availability);
  const leaves = input.leaves.map((value) => doctorLeaveSchema.parse(value));
  const occupied = input.occupied.map((value) => bookingRecordSchema.parse(value));
  const fee = bookingFeeSnapshotSchema.parse(input.fee);
  const policy = bookingPolicySchema.parse(input.policy);

  if (authority.kind === "customer") {
    if (authority.customerId !== request.ownerId) return rejected("DENIED");
  } else if (authority.kind === "front_desk") {
    if (!authority.clinicIds.includes(request.clinicId) || request.modality !== "in_clinic") {
      return rejected("DENIED");
    }
  } else return rejected("DENIED");

  if (
    request.availabilityId !== availability.id ||
    request.expectedAvailabilityRevision !== availability.revision
  )
    return rejected("STALE_AVAILABILITY");
  if (request.doctorId !== availability.doctorId || request.clinicId !== availability.clinicId) {
    return rejected("INVALID_SLOT");
  }
  if (!availability.modalities.includes(request.modality)) return rejected("MODALITY_UNAVAILABLE");
  if (
    fee.doctorId !== request.doctorId ||
    fee.clinicId !== request.clinicId ||
    fee.modality !== request.modality ||
    fee.approvedPolicyId !== policy.id
  )
    return rejected("FEE_MISMATCH");
  const end = instantAt(Date.parse(request.start) + availability.slotLengthMs);
  const expiry = instantAt(Date.parse(now) + policy.holdDurationMs);
  if (
    !end ||
    !expiry ||
    request.start <= now ||
    request.start < availability.window.start ||
    end > availability.window.end ||
    expiry > request.start ||
    (Date.parse(request.start) - Date.parse(availability.window.start)) %
      availability.slotLengthMs !==
      0
  ) {
    return rejected("INVALID_SLOT");
  }
  const slot: BookingSlot = {
    doctorId: request.doctorId,
    clinicId: request.clinicId,
    clinicTimezone: availability.clinicTimezone,
    availabilityId: availability.id,
    availabilityRevision: availability.revision,
    interval: { start: request.start, end },
    buffers: availability.buffers,
    modality: request.modality,
  };
  const interval = bufferedInterval(slot.interval, slot.buffers);
  if (!interval) return rejected("INVALID_SLOT");
  if (
    leaves.some(
      (leave) => leave.doctorId === request.doctorId && intervalsOverlap(interval, leave.interval),
    )
  ) {
    return rejected("DOCTOR_UNAVAILABLE");
  }
  for (const booking of occupied) {
    if (
      booking.slot.doctorId !== slot.doctorId ||
      (booking.state !== "held" && booking.state !== "confirmed")
    )
      continue;
    // An elapsed deadline alone is NOT a committed expiry/release of exclusion.
    const other = bufferedInterval(booking.slot.interval, booking.slot.buffers);
    if (!other || intervalsOverlap(interval, other)) return rejected("DOCTOR_UNAVAILABLE");
  }
  const booking = bookingRecordSchema.parse({
    id,
    revision: 1,
    ownerId: request.ownerId,
    state: "held",
    provenance:
      authority.kind === "customer"
        ? { source: "online", customerId: authority.customerId }
        : { source: "front_desk", staffId: authority.staffId },
    slot,
    fee,
    policyId: policy.id,
    policyRevision: policy.revision,
    createdAt: now,
    holdExpiresAt: expiry,
    paymentOrderId: input.paymentOrderId,
    payments: [],
  });
  return immutable({
    kind: "hold_intent",
    persisted: false,
    booking,
    guard: {
      mustNotExist: id,
      availabilityId: availability.id,
      availabilityRevision: availability.revision,
      policyId: policy.id,
      policyRevision: policy.revision,
      doctorId: slot.doctorId,
      occupiedInterval: interval,
    },
  });
}

export type { BookingAction } from "@kandamkulathi/contracts/booking";

export interface TransitionDecisionInput {
  booking: BookingRecord | Immutable<BookingRecord>;
  expectedRevision: number;
  expectedOwnerId: string;
  authority: BookingAuthority;
  /** Current server clock, never a callback/client event timestamp. */
  now: string;
  /** Current reviewed server policy; stale policies cannot authorize confirmation. */
  policy: BookingPolicy;
  /** Explicit current policy decision; no built-in cancellation/refund formula. */
  cancellationAllowed: boolean;
  action: BookingAction;
}

export interface BookingObligation {
  kind: "rebook_or_refund_required";
  operationId: string;
  bookingId: string;
  paymentId: string;
  reason:
    | "late_payment"
    | "additional_payment"
    | "payment_mismatch"
    | "policy_changed"
    | "cancelled";
  /** Neither a new booking nor a settled refund is asserted. */
  status: "pending_review_and_reconciliation";
}

export type TransitionIntent = Immutable<{
  kind: "transition_intent";
  persisted: false;
  compareAndSwap: { bookingId: string; expectedRevision: number; expectedOwnerId: string };
  next: BookingRecord;
  obligations: BookingObligation[];
}>;

function obligation(
  booking: BookingRecord,
  paymentId: string,
  reason: BookingObligation["reason"],
): BookingObligation {
  return {
    kind: "rebook_or_refund_required",
    operationId: `booking:${booking.id}:payment:${paymentId}:rebook-or-refund`,
    bookingId: booking.id,
    paymentId,
    reason,
    status: "pending_review_and_reconciliation",
  };
}

function samePayment(a: VerifiedBookingPayment, b: VerifiedBookingPayment): boolean {
  // Different delivery IDs/verification receipts may describe the SAME captured payment.
  return (
    a.provider === b.provider &&
    a.paymentId === b.paymentId &&
    a.orderId === b.orderId &&
    a.bookingId === b.bookingId &&
    a.amountPaise === b.amountPaise &&
    a.currency === b.currency &&
    a.status === b.status
  );
}

/** No I/O or mutation: the returned CAS/outbox proposal is not a persisted booking. */
export function decideBookingTransition(
  input: TransitionDecisionInput,
): TransitionIntent | Denied | { kind: "idempotent"; persisted: false; revision: number } {
  const booking = bookingRecordSchema.parse(input.booking);
  const authority = bookingAuthoritySchema.parse(input.authority);
  const expectedRevision = revisionSchema.parse(input.expectedRevision);
  const expectedOwnerId = bookingIdSchema.parse(input.expectedOwnerId);
  const now = utcInstantSchema.parse(input.now);
  const policy = bookingPolicySchema.parse(input.policy);
  const action = bookingActionSchema.parse(input.action);
  if (expectedOwnerId !== booking.ownerId) return rejected("OWNER_MISMATCH");
  if (now < booking.createdAt) return rejected("INVALID_STATE");
  if (action.kind === "payment_captured") {
    if (authority.kind !== "payment_service") return rejected("DENIED");
  } else if (action.kind === "expire") {
    if (authority.kind !== "expiry_service") return rejected("DENIED");
  } else if (action.kind === "cancel") {
    if (
      input.cancellationAllowed !== true ||
      !(
        (authority.kind === "customer" && authority.customerId === booking.ownerId) ||
        (authority.kind === "front_desk" && authority.clinicIds.includes(booking.slot.clinicId))
      )
    )
      return rejected("DENIED");
  } else return rejected("DENIED");

  const obligations: BookingObligation[] = [];
  let state = booking.state;
  if (action.kind === "payment_captured") {
    const payment = verifiedBookingPaymentSchema.parse(action.payment);
    if (
      authority.kind !== "payment_service" ||
      authority.verificationReference !== payment.verificationReference ||
      payment.bookingId !== booking.id
    )
      return rejected("DENIED");
    const duplicate = booking.payments.find((p) => p.payment.paymentId === payment.paymentId);
    const event = booking.payments.find((p) => p.payment.eventId === payment.eventId);
    if (event && event.payment.paymentId !== payment.paymentId) return rejected("PAYMENT_CONFLICT");
    if (duplicate) {
      if (!samePayment(duplicate.payment, payment)) return rejected("PAYMENT_CONFLICT");
      // Authorized semantic replay is a no-op, even when its original expected revision is stale.
      return { kind: "idempotent", persisted: false, revision: booking.revision };
    }
    if (expectedRevision !== booking.revision) return rejected("STALE_REVISION");
    let reason: BookingObligation["reason"] | null = null;
    if (state === "held" && now >= booking.holdExpiresAt) state = "expired";
    if (state === "cancelled") reason = "cancelled";
    else if (state === "expired") reason = "late_payment";
    else if (state === "confirmed") reason = "additional_payment";
    else if (
      payment.orderId !== booking.paymentOrderId ||
      payment.amountPaise !== booking.fee.amountPaise ||
      payment.currency !== booking.fee.currency
    )
      reason = "payment_mismatch";
    else if (policy.id !== booking.policyId || policy.revision !== booking.policyRevision)
      reason = "policy_changed";
    if (reason) obligations.push(obligation(booking, payment.paymentId, reason));
    else state = "confirmed";
    booking.payments.push({
      payment,
      disposition: reason ? "rebook_or_refund_required" : "applied",
    });
  } else {
    if (expectedRevision !== booking.revision) return rejected("STALE_REVISION");
    if (
      action.kind === "cancel" &&
      (policy.id !== booking.policyId || policy.revision !== booking.policyRevision)
    )
      return rejected("POLICY_MISMATCH");
    if (action.kind === "expire") {
      if (state !== "held") return rejected("INVALID_STATE");
      if (now < booking.holdExpiresAt) return rejected("NOT_EXPIRED");
      state = "expired";
    } else {
      if (state !== "held" && state !== "confirmed") return rejected("INVALID_STATE");
      state = "cancelled";
      for (const { payment, disposition } of booking.payments) {
        if (disposition === "applied")
          obligations.push(obligation(booking, payment.paymentId, "cancelled"));
      }
    }
  }
  const next = bookingRecordSchema.parse({ ...booking, state, revision: booking.revision + 1 });
  return immutable({
    kind: "transition_intent",
    persisted: false,
    compareAndSwap: { bookingId: booking.id, expectedRevision, expectedOwnerId },
    next,
    obligations,
  });
}
