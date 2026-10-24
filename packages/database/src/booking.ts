import { z } from "zod";
import {
  type BookingAuthority,
  type BookingRecord,
  bookingAuthoritySchema,
  bookingFeeSnapshotSchema,
  bookingIdSchema,
  bookingPolicySchema,
  bookingRecordSchema,
  doctorAvailabilitySchema,
  doctorDirectoryEntrySchema,
  doctorLeaveSchema,
  holdBookingRequestSchema,
  revisionSchema,
  type VerifiedBookingPayment,
  verifiedBookingPaymentSchema,
} from "../../contracts/src/booking.ts";
import { verifiedIdentitySchema } from "../../contracts/src/identity.ts";
import {
  bufferedInterval,
  decideBookingHold,
  decideBookingTransition,
} from "../../domain/src/booking/index.ts";
import { type DatabaseContext, inTransaction, transaction } from "./client.ts";
import { enqueue } from "./outbox.ts";

export class BookingRuntimeError extends Error {
  readonly code: "DENIED" | "CONFLICT" | "UNAVAILABLE";
  constructor(code: "DENIED" | "CONFLICT" | "UNAVAILABLE") {
    super(code);
    this.code = code;
  }
}
export const isBookingValidationError = (error: unknown): boolean => error instanceof z.ZodError;
export const bookingPrincipalSchema = verifiedIdentitySchema;
export type BookingPrincipal = z.infer<typeof bookingPrincipalSchema>;
/** Required identity-owned SQL adapter: lock/recheck current session/account/grants
 * using THIS connection and transaction, keeping its authority fences through commit.
 * Must not call providers or use a cached session projection as current authority.
 */
export type BookingAuthorityLoader = (
  context: DatabaseContext,
  principal: BookingPrincipal,
) => Promise<BookingAuthority>;
export const persistedHoldSchema = z.strictObject({
  operationId: bookingIdSchema,
  bookingId: bookingIdSchema,
  request: holdBookingRequestSchema,
});

const denied = (): never => {
  throw new BookingRuntimeError("DENIED");
};
const conflict = (): never => {
  throw new BookingRuntimeError("CONFLICT");
};

async function now(context: DatabaseContext): Promise<string> {
  const result = await context.client.query<{ now: Date }>("SELECT clock_timestamp() AS now");
  const value = result.rows[0]?.now;
  if (!value) throw new BookingRuntimeError("UNAVAILABLE");
  return value.toISOString();
}

async function authorize(
  context: DatabaseContext,
  input: BookingPrincipal,
  loadAuthority: BookingAuthorityLoader,
  action: "booking:create" | "booking:read",
): Promise<BookingAuthority> {
  const principal = bookingPrincipalSchema.parse(input);
  const clock = Date.parse(await now(context));
  if (Date.parse(principal.expiresAt) <= clock || Date.parse(principal.authenticatedAt) > clock)
    return denied();
  const authority = bookingAuthoritySchema.safeParse(await loadAuthority(context, principal));
  if (!authority.success) return denied();
  const value = authority.data;
  if (value.kind !== "customer" && value.kind !== "front_desk") return denied();
  if (
    value.kind === "front_desk" &&
    (!principal.organizationId ||
      !principal.mfa ||
      Date.parse(principal.mfa.verifiedAt) > clock ||
      Date.parse(principal.mfa.expiresAt) <= clock)
  )
    return denied();
  if ((value.kind === "customer" ? value.customerId : value.staffId) !== principal.actorId)
    return denied();
  const fence = await context.client.query(
    "SELECT actor_id FROM clinical.mathew_booking_grant_fence WHERE actor_id=$1 FOR SHARE",
    [principal.actorId],
  );
  if (fence.rowCount !== 1) return denied();
  const grants = await context.client.query<{ scope: "self" | "clinic"; clinic_id: string | null }>(
    `SELECT scope, clinic_id FROM clinical.mathew_booking_grant WHERE actor_id=$1 AND action=$2
      AND revoked_at IS NULL AND valid_from <= clock_timestamp() AND expires_at > clock_timestamp()`,
    [principal.actorId, action],
  );
  if (value.kind === "customer") {
    if (!grants.rows.some((grant) => grant.scope === "self")) return denied();
  } else {
    value.clinicIds = value.clinicIds.filter((clinicId) =>
      grants.rows.some((grant) => grant.scope === "clinic" && grant.clinic_id === clinicId),
    );
    if (value.clinicIds.length === 0) return denied();
  }
  await context.client.query(
    "SELECT set_config('booking.owner', $1, true), set_config('booking.clinics', $2, true)",
    [
      value.kind === "customer" ? value.customerId : "",
      JSON.stringify(value.kind === "front_desk" ? value.clinicIds : []),
    ],
  );
  return value;
}

async function configuration(context: DatabaseContext, id: string) {
  const result = await context.client.query<{
    availability: unknown;
    policy: unknown;
    fees: unknown;
  }>(
    `SELECT c.availability, c.policy, c.fees FROM clinical.mathew_booking_configuration c
      JOIN clinical.mathew_booking_directory d ON d.doctor_id = c.doctor_id
      WHERE c.availability_id = $1 AND c.enabled AND d.published FOR SHARE OF c, d`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return denied();
  return {
    availability: doctorAvailabilitySchema.parse(row.availability),
    policy: bookingPolicySchema.parse(row.policy),
    fees: z.array(bookingFeeSnapshotSchema).parse(row.fees),
  };
}

/** Financial CORE target/bind adapters call this first in their existing tx,
 * using the real verified identity and the same current-identity loader.
 */
export async function authorizeBookingInTransaction(
  context: DatabaseContext,
  identity: BookingPrincipal,
  action: "booking:create" | "booking:read",
  loadAuthority: BookingAuthorityLoader,
): Promise<BookingAuthority> {
  if (!inTransaction(context.client)) throw new BookingRuntimeError("UNAVAILABLE");
  return authorize(context, identity, loadAuthority, action);
}

async function audit(context: DatabaseContext, booking: BookingRecord) {
  await context.client.query(
    "INSERT INTO clinical.mathew_booking_audit(booking_id, revision, document) VALUES ($1,$2,$3)",
    [booking.id, booking.revision, booking],
  );
}

function visible(authority: BookingAuthority, booking: BookingRecord): boolean {
  return (
    (authority.kind === "customer" && authority.customerId === booking.ownerId) ||
    (authority.kind === "front_desk" && authority.clinicIds.includes(booking.slot.clinicId))
  );
}

/** No automatic retry after uncertain COMMIT. Reconcile using stable operationId/bookingId. */
export async function persistBookingHold(
  context: DatabaseContext,
  principal: BookingPrincipal,
  input: unknown,
  loadAuthority: BookingAuthorityLoader,
): Promise<BookingRecord> {
  const command = persistedHoldSchema.parse(input);
  try {
    return await transaction(context.client, async () => {
      const authority = await authorize(context, principal, loadAuthority, "booking:create");
      const { request } = command;
      if (
        (authority.kind === "customer" && authority.customerId !== request.ownerId) ||
        (authority.kind === "front_desk" &&
          (!authority.clinicIds.includes(request.clinicId) || request.modality !== "in_clinic"))
      )
        return denied();
      // Serializes equal-operation retries without trusting an unlocked pre-read.
      await context.client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        command.operationId,
      ]);
      const existing = await context.client.query<{ document: unknown; matches: boolean }>(
        `SELECT document, id = $2 AND request = $3::jsonb AS matches FROM clinical.mathew_booking_booking WHERE operation_id = $1`,
        [command.operationId, command.bookingId, request],
      );
      if (existing.rows[0]) {
        if (!existing.rows[0].matches) return conflict();
        const booking = bookingRecordSchema.parse(existing.rows[0].document);
        if (!visible(authority, booking)) return denied();
        return booking;
      }
      const config = await configuration(context, request.availabilityId);
      const leaves = await context.client.query<{ document: unknown }>(
        "SELECT document FROM clinical.mathew_booking_leave WHERE doctor_id = $1",
        [request.doctorId],
      );
      const fee = config.fees.filter((value) => value.modality === request.modality);
      const approvedFee = fee[0];
      if (fee.length !== 1 || !approvedFee) return denied();
      const decision = decideBookingHold({
        request,
        authority,
        now: await now(context),
        bookingId: command.bookingId,
        // Explicit unbound internal identity, never a claim of provider order creation.
        paymentOrderId: `unbound_${command.bookingId}`,
        ...config,
        fee: approvedFee,
        leaves: leaves.rows.map((row) => doctorLeaveSchema.parse(row.document)),
        // Other owners' rows remain private. GiST, not this snapshot, is authoritative.
        occupied: [],
      });
      if (decision.kind === "rejected") return conflict();
      const booking = bookingRecordSchema.parse(decision.booking);
      const interval = bufferedInterval(booking.slot.interval, booking.slot.buffers);
      if (!interval) return conflict();
      await context.client.query(
        `INSERT INTO clinical.mathew_booking_booking(id,operation_id,request,owner_id,doctor_id,clinic_id,
          revision,state,occupied,expires_at,document)
         VALUES($1,$2,$3,$4,$5,$6,1,'held',tstzrange($7,$8,'[)'),$9,$10)`,
        [
          booking.id,
          command.operationId,
          request,
          booking.ownerId,
          booking.slot.doctorId,
          booking.slot.clinicId,
          interval.start,
          interval.end,
          booking.holdExpiresAt,
          booking,
        ],
      );
      await audit(context, booking);
      return booking;
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      ["23P01", "23505", "40001", "40P01", "55P03"].includes(String(error.code))
    )
      return conflict();
    throw error;
  }
}

export async function readBooking(
  context: DatabaseContext,
  principal: BookingPrincipal,
  id: string,
  loadAuthority: BookingAuthorityLoader,
): Promise<BookingRecord> {
  bookingIdSchema.parse(id);
  return transaction(context.client, async () => {
    const authority = await authorize(context, principal, loadAuthority, "booking:read");
    const result = await context.client.query<{ document: unknown }>(
      "SELECT document FROM clinical.mathew_booking_booking WHERE id = $1",
      [id],
    );
    if (!result.rows[0]) return denied();
    const booking = bookingRecordSchema.parse(result.rows[0].document);
    return visible(authority, booking) ? booking : denied();
  });
}

export async function readBookingDirectory(context: DatabaseContext) {
  const result = await context.client.query<{ document: unknown }>(
    "SELECT document FROM clinical.mathew_booking_directory WHERE published ORDER BY doctor_id LIMIT 100",
  );
  return result.rows.map((row) => doctorDirectoryEntrySchema.parse(row.document));
}

export async function readBookingAvailability(context: DatabaseContext, doctorId: string) {
  bookingIdSchema.parse(doctorId);
  const result = await context.client.query<{ availability: unknown; fees: unknown }>(
    `SELECT c.availability, c.fees FROM clinical.mathew_booking_configuration c JOIN clinical.mathew_booking_directory d USING(doctor_id)
      WHERE c.doctor_id = $1 AND c.enabled AND d.published ORDER BY c.availability_id LIMIT 100`,
    [doctorId],
  );
  // These are configured windows, NOT a promise that a slot remains free.
  return result.rows.map((row) => ({
    availability: doctorAvailabilitySchema.parse(row.availability),
    fees: z.array(bookingFeeSnapshotSchema).parse(row.fees),
  }));
}

async function saveTransition(
  context: DatabaseContext,
  previous: BookingRecord,
  next: BookingRecord,
) {
  const result = await context.client.query(
    `UPDATE clinical.mathew_booking_booking SET revision = $4, state = $5, document = $6
      WHERE id = $1 AND owner_id = $2 AND revision = $3`,
    [previous.id, previous.ownerId, previous.revision, next.revision, next.state, next],
  );
  if (result.rowCount !== 1) return conflict();
  await audit(context, next);
}

/** Jobs-role only. Receipts are immutable verified evidence from the financial owner.
 * This function performs SQL only; it neither verifies providers nor sends refunds.
 */
export async function applyVerifiedBookingCapture(
  context: DatabaseContext,
  receiptId: string,
  expectedRevision: number,
): Promise<BookingRecord> {
  bookingIdSchema.parse(receiptId);
  revisionSchema.parse(expectedRevision);
  return transaction(context.client, async () => {
    const receipt = await context.client.query<{ document: unknown }>(
      "SELECT document FROM clinical.mathew_booking_verified_capture WHERE id = $1",
      [receiptId],
    );
    if (!receipt.rows[0]) return denied();
    const payment = verifiedBookingPaymentSchema.parse(receipt.rows[0].document);
    if (payment.verificationReference !== receiptId) return denied();
    return applyVerifiedBookingPayment(context, payment, expectedRevision);
  });
}

/** Internal financial callback ONLY: caller has durably inserted a verified receipt
 * in this same transaction, using the jobs credential. Never call with HTTP JSON.
 */
export async function applyVerifiedBookingPayment(
  context: DatabaseContext,
  input: VerifiedBookingPayment,
  expectedRevision?: number,
): Promise<BookingRecord> {
  if (!inTransaction(context.client)) throw new BookingRuntimeError("UNAVAILABLE");
  const payment = verifiedBookingPaymentSchema.parse(input);
  // One global payment lock, then booking lock; event identities also serialize globally.
  for (const key of [
    `payment:${payment.provider}:${payment.paymentId}`,
    `event:${payment.provider}:${payment.eventId}`,
  ].sort()) {
    await context.client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);
  }
  const stored = await context.client.query<{ document: unknown }>(
    "SELECT document FROM clinical.mathew_booking_booking WHERE id = $1 FOR UPDATE",
    [payment.bookingId],
  );
  if (!stored.rows[0]) return denied();
  const booking = bookingRecordSchema.parse(stored.rows[0].document);
  // An internal pending identity can never act as a verified provider order.
  if (booking.paymentOrderId.startsWith("unbound_") && payment.orderId === booking.paymentOrderId)
    return conflict();
  const registry = await context.client.query<{ booking_id: string }>(
    "SELECT booking_id FROM clinical.mathew_booking_payment WHERE provider = $1 AND payment_id = $2",
    [payment.provider, payment.paymentId],
  );
  if (registry.rows[0] && registry.rows[0].booking_id !== booking.id) return conflict();
  const event = await context.client.query<{ payment_id: string }>(
    "SELECT payment_id FROM clinical.mathew_booking_delivery WHERE provider = $1 AND event_id = $2",
    [payment.provider, payment.eventId],
  );
  if (event.rows[0] && event.rows[0].payment_id !== payment.paymentId) return conflict();
  // Retired configuration must not prevent durable late-payment reconciliation.
  const config = await context.client.query<{ policy: unknown }>(
    "SELECT policy FROM clinical.mathew_booking_configuration WHERE availability_id = $1 FOR SHARE",
    [booking.slot.availabilityId],
  );
  if (!config.rows[0]) throw new BookingRuntimeError("UNAVAILABLE");
  const decision = decideBookingTransition({
    booking,
    expectedRevision: expectedRevision ?? booking.revision,
    expectedOwnerId: booking.ownerId,
    authority: { kind: "payment_service", verificationReference: payment.verificationReference },
    now: await now(context),
    policy: bookingPolicySchema.parse(config.rows[0].policy),
    cancellationAllowed: false,
    action: { kind: "payment_captured", payment },
  });
  if (decision.kind === "rejected") return conflict();
  if (decision.kind === "transition_intent") {
    const next = bookingRecordSchema.parse(decision.next);
    await saveTransition(context, booking, next);
    await context.client.query(
      "INSERT INTO clinical.mathew_booking_payment(provider,payment_id,booking_id,document) VALUES($1,$2,$3,$4)",
      [payment.provider, payment.paymentId, booking.id, payment],
    );
    for (const obligation of decision.obligations) {
      const id = crypto.randomUUID();
      await context.client.query(
        "INSERT INTO clinical.mathew_booking_obligation(id,operation_key,booking_id,document) VALUES($1,$2,$3,$4)",
        [id, obligation.operationId, booking.id, obligation],
      );
      const timestamp = new Date(await now(context));
      await enqueue(context, {
        id: crypto.randomUUID(),
        operationId: id,
        channel: "financial",
        kind: "commerce.reconcile",
        subjectId: id,
        revision: 1,
        dueAt: timestamp,
        deadlineAt: new Date(timestamp.getTime() + 86_400_000),
      });
    }
  }
  await context.client.query(
    "INSERT INTO clinical.mathew_booking_delivery(provider,event_id,payment_id,receipt_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    [payment.provider, payment.eventId, payment.paymentId, payment.verificationReference],
  );
  return decision.kind === "transition_intent" ? bookingRecordSchema.parse(decision.next) : booking;
}

/** Financial integration uses a scoped core or jobs connection and the existing transaction helper.
 * No client-supplied price, actor or order association route exists.
 */
export async function loadBookingPaymentTarget(context: DatabaseContext, bookingId: string) {
  if (!inTransaction(context.client)) throw new BookingRuntimeError("UNAVAILABLE");
  bookingIdSchema.parse(bookingId);
  const result = await context.client.query<{ document: unknown }>(
    "SELECT document FROM clinical.mathew_booking_booking WHERE id=$1 FOR UPDATE",
    [bookingId],
  );
  if (!result.rows[0]) return denied();
  const booking = bookingRecordSchema.parse(result.rows[0].document);
  if (booking.state !== "held" || booking.holdExpiresAt <= (await now(context))) return conflict();
  return {
    bookingId: booking.id,
    ownerId: booking.ownerId,
    revision: booking.revision,
    amountPaise: booking.fee.amountPaise,
    currency: booking.fee.currency,
    paymentOrderId: booking.paymentOrderId,
    holdExpiresAt: booking.holdExpiresAt,
  };
}

export async function bindBookingPaymentOrder(
  context: DatabaseContext,
  bookingId: string,
  expectedRevision: number,
  orderId: string,
): Promise<BookingRecord> {
  const target = await loadBookingPaymentTarget(context, bookingId);
  revisionSchema.parse(expectedRevision);
  verifiedBookingPaymentSchema.shape.orderId.parse(orderId);
  if (orderId.startsWith("unbound_")) return conflict();
  const result = await context.client.query<{ document: unknown }>(
    "SELECT document FROM clinical.mathew_booking_booking WHERE id=$1",
    [bookingId],
  );
  const previous = bookingRecordSchema.parse(result.rows[0]?.document);
  if (target.paymentOrderId === orderId) return previous;
  if (target.revision !== expectedRevision || !target.paymentOrderId.startsWith("unbound_"))
    return conflict();
  const next = bookingRecordSchema.parse({
    ...previous,
    revision: previous.revision + 1,
    paymentOrderId: orderId,
  });
  const changed = await context.client.query(
    "UPDATE clinical.mathew_booking_booking SET revision=$4, document=$5 WHERE id=$1 AND owner_id=$2 AND revision=$3",
    [previous.id, previous.ownerId, previous.revision, next.revision, next],
  );
  if (changed.rowCount !== 1) return conflict();
  await audit(context, next);
  return next;
}

/** Bounded Cron pickup. Booking state/deadline is the durable expiry obligation.
 * SKIP LOCKED allows independent workers; each row is CAS checked and audited.
 */
export async function expireDueBookingHolds(context: DatabaseContext, limit = 50): Promise<number> {
  z.number().int().min(1).max(100).parse(limit);
  return transaction(context.client, async () => {
    const due = await context.client.query<{ document: unknown }>(
      `SELECT document FROM clinical.mathew_booking_booking WHERE state = 'held' AND expires_at <= clock_timestamp()
        ORDER BY expires_at, id FOR UPDATE SKIP LOCKED LIMIT $1`,
      [limit],
    );
    for (const row of due.rows) {
      const booking = bookingRecordSchema.parse(row.document);
      const next = bookingRecordSchema.parse({
        ...booking,
        revision: booking.revision + 1,
        state: "expired",
      });
      await saveTransition(context, booking, next);
    }
    return due.rows.length;
  });
}
