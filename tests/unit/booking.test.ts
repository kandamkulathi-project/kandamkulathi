import { describe, expect, it } from "vitest";
import {
  bookingActionSchema,
  bookingAuthoritySchema,
  bookingClinicalFoundationSchema,
  bookingRecordSchema,
  clinicTimezoneSchema,
  doctorAvailabilitySchema,
  doctorDirectoryEntrySchema,
  holdBookingRequestSchema,
  utcInstantSchema,
} from "../../packages/contracts/src/booking";
import {
  bufferedInterval,
  decideBookingHold,
  decideBookingTransition,
  type HoldDecisionInput,
  type HoldIntent,
  intervalsOverlap,
  type TransitionDecisionInput,
  type TransitionIntent,
} from "../../packages/domain/src/booking/index";

// Synthetic, explicitly injected test values; NOT company fee/duration/clinical policy.
const id = (n: number) => `aabbccdd-eeff-4000-8000-${n.toString().padStart(12, "0")}`;
const time = (minute: number) => new Date(Date.UTC(2026, 9, 23, 9, minute)).toISOString();
const interval = (start: number, end: number) => ({ start: time(start), end: time(end) });

function fixture(): HoldDecisionInput {
  return {
    request: {
      doctorId: id(1),
      clinicId: id(2),
      ownerId: id(3),
      availabilityId: id(4),
      expectedAvailabilityRevision: 2,
      modality: "online",
      start: time(30),
    },
    authority: { kind: "customer", customerId: id(3) },
    now: time(0),
    bookingId: id(5),
    paymentOrderId: "order_synthetic",
    availability: {
      id: id(4),
      revision: 2,
      doctorId: id(1),
      clinicId: id(2),
      clinicTimezone: "Asia/Kolkata",
      window: interval(0, 180),
      slotLengthMs: 30 * 60_000,
      buffers: { beforeMs: 0, afterMs: 0 },
      modalities: ["online", "in_clinic"],
    },
    leaves: [],
    occupied: [],
    fee: {
      feeId: id(6),
      revision: 3,
      doctorId: id(1),
      clinicId: id(2),
      modality: "online",
      amountPaise: 12345,
      currency: "INR",
      approvedPolicyId: id(7),
    },
    policy: { id: id(7), revision: 1, holdDurationMs: 5 * 60_000 },
  };
}

function hold(input = fixture()): HoldIntent {
  const result = decideBookingHold(input);
  expect(result.kind).toBe("hold_intent");
  if (result.kind !== "hold_intent") throw new Error("Expected synthetic hold intent");
  return result;
}

function transitionFixture(): TransitionDecisionInput {
  return {
    booking: hold().booking,
    expectedRevision: 1,
    expectedOwnerId: id(3),
    authority: { kind: "payment_service", verificationReference: id(8) },
    now: time(1),
    policy: fixture().policy,
    cancellationAllowed: false,
    action: {
      kind: "payment_captured",
      payment: {
        provider: "razorpay",
        eventId: "evt_synthetic",
        paymentId: "pay_synthetic",
        orderId: "order_synthetic",
        bookingId: id(5),
        amountPaise: 12345,
        currency: "INR",
        verificationReference: id(8),
        status: "captured",
      },
    },
  };
}

function transition(input = transitionFixture()): TransitionIntent {
  const result = decideBookingTransition(input);
  expect(result.kind).toBe("transition_intent");
  if (result.kind !== "transition_intent") throw new Error("Expected transition intent");
  return result;
}

describe("canonical UUID identity and opaque provider identifier casing", () => {
  it.each(["request", "occupied"])(
    "rejects cross-clinic overlap with uppercase %s doctor identity",
    (uppercaseSide) => {
      const input = fixture();
      const other = bookingRecordSchema.parse(hold().booking);
      other.slot.clinicId = id(12);
      other.fee.clinicId = id(12);
      if (uppercaseSide === "request") {
        input.request.doctorId = id(1).toUpperCase();
        input.availability.doctorId = id(1).toUpperCase();
        input.fee.doctorId = id(1).toUpperCase();
      } else {
        other.slot.doctorId = id(1).toUpperCase();
        other.fee.doctorId = id(1).toUpperCase();
      }
      input.occupied = [other];
      expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DOCTOR_UNAVAILABLE" });
    },
  );
  it.each(["request", "leave"])(
    "rejects global leave with uppercase %s doctor identity",
    (uppercaseSide) => {
      const input = fixture();
      const leaveDoctorId = uppercaseSide === "leave" ? id(1).toUpperCase() : id(1);
      input.leaves = [
        { id: id(15), revision: 1, doctorId: leaveDoctorId, interval: interval(30, 60) },
      ];
      if (uppercaseSide === "request") {
        input.request.doctorId = id(1).toUpperCase();
        input.availability.doctorId = id(1).toUpperCase();
        input.fee.doctorId = id(1).toUpperCase();
      }
      expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DOCTOR_UNAVAILABLE" });
    },
  );
  it("canonicalizes mixed-case request, actor, owner, clinic, availability, fee and policy UUIDs", () => {
    const input = fixture();
    input.request.ownerId = id(3).toUpperCase();
    input.request.clinicId = id(2).toUpperCase();
    input.request.availabilityId = id(4).toUpperCase();
    input.authority = { kind: "customer", customerId: id(3).toUpperCase() };
    input.bookingId = id(5).toUpperCase();
    input.fee.feeId = id(6).toUpperCase();
    input.fee.approvedPolicyId = id(7).toUpperCase();
    const result = hold(input);
    expect(result.booking).toMatchObject({
      id: id(5),
      ownerId: id(3),
      policyId: id(7),
      provenance: { source: "online", customerId: id(3) },
      slot: { clinicId: id(2), availabilityId: id(4) },
      fee: { feeId: id(6), approvedPolicyId: id(7) },
    });
    expect(result.guard).toMatchObject({
      mustNotExist: id(5),
      availabilityId: id(4),
      policyId: id(7),
    });
    input.authority = { kind: "customer", customerId: id(99).toUpperCase() };
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DENIED" });
  });
  it("canonicalizes front-desk staff/clinic scope without authorizing a different clinic", () => {
    const input = fixture();
    input.request.modality = "in_clinic";
    input.fee.modality = "in_clinic";
    input.authority = {
      kind: "front_desk",
      staffId: id(9).toUpperCase(),
      clinicIds: [id(2).toUpperCase()],
      organizationVerified: true,
      mfaVerified: true,
    };
    expect(hold(input).booking.provenance).toEqual({ source: "front_desk", staffId: id(9) });
    input.authority.clinicIds = [id(99).toUpperCase()];
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DENIED" });
  });
  it("canonicalizes transition owner/customer UUIDs before authorization and CAS", () => {
    const input: TransitionDecisionInput = {
      ...transitionFixture(),
      expectedOwnerId: id(3).toUpperCase(),
      authority: { kind: "customer", customerId: id(3).toUpperCase() },
      action: { kind: "cancel" },
      cancellationAllowed: true,
    };
    const result = transition(input);
    expect(result.compareAndSwap.expectedOwnerId).toBe(id(3));
    expect(result.next.ownerId).toBe(id(3));
    input.authority = { kind: "customer", customerId: id(99).toUpperCase() };
    expect(decideBookingTransition(input)).toEqual({ kind: "rejected", reason: "DENIED" });
    input.expectedOwnerId = id(99).toUpperCase();
    expect(decideBookingTransition(input)).toEqual({ kind: "rejected", reason: "OWNER_MISMATCH" });
  });
  it("canonicalizes front-desk transition clinic scope before cancellation", () => {
    const input: TransitionDecisionInput = {
      ...transitionFixture(),
      action: { kind: "cancel" },
      cancellationAllowed: true,
      authority: {
        kind: "front_desk",
        staffId: id(9).toUpperCase(),
        clinicIds: [id(2).toUpperCase()],
        organizationVerified: true,
        mfaVerified: true,
      },
    };
    expect(transition(input).next.state).toBe("cancelled");
  });
  it("canonicalizes payment booking/verification UUIDs and nested stored-record identities", () => {
    const input = transitionFixture();
    if (input.action.kind !== "payment_captured") throw new Error("fixture");
    input.action.payment.bookingId = id(5).toUpperCase();
    input.action.payment.verificationReference = id(8).toUpperCase();
    const result = transition(input);
    expect(result.next.payments[0]?.payment).toMatchObject({
      bookingId: id(5),
      verificationReference: id(8),
    });
    const stored = bookingRecordSchema.parse(result.next);
    stored.id = id(5).toUpperCase();
    stored.ownerId = id(3).toUpperCase();
    stored.slot.doctorId = id(1).toUpperCase();
    stored.fee.clinicId = id(2).toUpperCase();
    stored.policyId = id(7).toUpperCase();
    if (stored.provenance.source !== "online") throw new Error("fixture");
    stored.provenance.customerId = id(3).toUpperCase();
    const parsed = bookingRecordSchema.parse(stored);
    expect(parsed).toEqual(result.next);
    expect(
      decideBookingTransition({
        ...input,
        booking: stored,
        authority: { kind: "payment_service", verificationReference: id(8).toUpperCase() },
      }),
    ).toEqual({ kind: "idempotent", persisted: false, revision: 2 });
  });
  it("does not treat a different payment booking UUID as the same identity", () => {
    const input = transitionFixture();
    if (input.action.kind !== "payment_captured") throw new Error("fixture");
    input.action.payment.bookingId = id(99).toUpperCase();
    expect(decideBookingTransition(input)).toEqual({ kind: "rejected", reason: "DENIED" });
  });
  it("preserves opaque provider order casing rather than accepting a different order", () => {
    const input = transitionFixture();
    if (input.action.kind !== "payment_captured") throw new Error("fixture");
    input.action.payment.orderId = input.action.payment.orderId.toUpperCase();
    const result = transition(input);
    expect(result.next.state).toBe("held");
    expect(result.obligations[0]?.reason).toBe("payment_mismatch");
    expect(result.next.payments[0]?.payment.orderId).toBe("ORDER_SYNTHETIC");
  });
  it("preserves opaque payment identity casing and reconciles a distinct additional capture", () => {
    const input = transitionFixture();
    input.booking = transition().next;
    input.expectedRevision = 2;
    if (input.action.kind !== "payment_captured") throw new Error("fixture");
    input.action.payment.paymentId = input.action.payment.paymentId.toUpperCase();
    input.action.payment.eventId = "evt_second";
    const result = transition(input);
    expect(result.next.payments).toHaveLength(2);
    expect(result.obligations[0]).toMatchObject({
      reason: "additional_payment",
      paymentId: "PAY_SYNTHETIC",
    });
  });
  it("preserves opaque event casing while deduplicating the same payment business identity", () => {
    const input = transitionFixture();
    input.booking = transition().next;
    if (input.action.kind !== "payment_captured") throw new Error("fixture");
    input.action.payment.eventId = input.action.payment.eventId.toUpperCase();
    expect(bookingActionSchema.parse(input.action)).toEqual(input.action);
    expect(decideBookingTransition(input)).toEqual({
      kind: "idempotent",
      persisted: false,
      revision: 2,
    });
  });
});

describe("strict booking contracts", () => {
  it.each([
    "2026-02-29T09:00:00.000Z",
    "2026-02-30T09:00:00.000Z",
    "2026-10-23",
    "2026-10-23T09:00:00Z",
    "2026-10-23T09:00:00.000+00:00",
    "2026-10-23T24:00:00.000Z",
  ])("rejects malformed/noncanonical UTC %s", (value) => {
    expect(utcInstantSchema.safeParse(value).success).toBe(false);
  });
  it("accepts leap-day UTC and explicit IANA zones including DST zones", () => {
    expect(utcInstantSchema.parse("2028-02-29T09:00:00.000Z")).toBe("2028-02-29T09:00:00.000Z");
    for (const zone of ["Asia/Kolkata", "America/New_York", "UTC"]) {
      expect(clinicTimezoneSchema.parse(zone)).toBe(zone);
    }
  });
  it.each(["IST", "+05:30", "Asia/Not_Real", "", "GMT+5"])("rejects ambiguous zone %s", (zone) => {
    expect(clinicTimezoneSchema.safeParse(zone).success).toBe(false);
  });
  it("rejects price/actor/hold policy injection and float/negative paise", () => {
    expect(holdBookingRequestSchema.safeParse({ ...fixture().request, fee: 1 }).success).toBe(
      false,
    );
    expect(
      holdBookingRequestSchema.safeParse({ ...fixture().request, actor: "administrator" }).success,
    ).toBe(false);
    expect(
      holdBookingRequestSchema.safeParse({ ...fixture().request, holdDurationMs: 1 }).success,
    ).toBe(false);
    const booking = hold().booking;
    for (const amountPaise of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        bookingRecordSchema.safeParse({ ...booking, fee: { ...booking.fee, amountPaise } }).success,
      ).toBe(false);
    }
  });
  it("has no clinical/admin bypass or unreviewed note/recommendation payload", () => {
    expect(bookingAuthoritySchema.safeParse({ kind: "administrator" }).success).toBe(false);
    expect(
      bookingClinicalFoundationSchema.safeParse({
        status: "unavailable",
        reason: "REVIEWED_CLINICAL_POLICY_REQUIRED",
        dosage: "synthetic",
      }).success,
    ).toBe(false);
  });
  it("requires versioned approved directory metadata and staff org/MFA", () => {
    expect(
      doctorDirectoryEntrySchema.safeParse({ doctorId: id(1), displayName: "Synthetic" }).success,
    ).toBe(false);
    const entry = {
      doctorId: id(1),
      revision: 1,
      departmentId: id(20),
      clinicIds: [id(2), id(12)],
      displayName: "Synthetic Physician",
      qualifications: ["Synthetic reviewed qualification"],
      languages: ["en", "ml"],
      approvedPhotoObjectId: id(21),
      publicationApprovalId: id(22),
    };
    expect(doctorDirectoryEntrySchema.parse(entry)).toEqual(entry);
    expect(
      bookingAuthoritySchema.safeParse({
        kind: "front_desk",
        staffId: id(9),
        clinicIds: [id(2)],
        organizationVerified: true,
        mfaVerified: false,
      }).success,
    ).toBe(false);
  });
  it("requires availability revision, nonempty intervals, nonnegative buffers and unique modalities", () => {
    for (const patch of [
      { revision: 0 },
      { window: interval(30, 30) },
      { slotLengthMs: 0 },
      { buffers: { beforeMs: -1, afterMs: 0 } },
      { modalities: ["online", "online"] },
    ])
      expect(
        doctorAvailabilitySchema.safeParse({ ...fixture().availability, ...patch }).success,
      ).toBe(false);
  });
  it("rejects noncaptured payment claims and extra action authority fields", () => {
    const action = transitionFixture().action;
    if (action.kind !== "payment_captured") throw new Error("fixture");
    expect(
      bookingActionSchema.safeParse({
        ...action,
        payment: { ...action.payment, status: "authorized" },
      }).success,
    ).toBe(false);
    expect(bookingActionSchema.safeParse({ kind: "cancel", bypass: true }).success).toBe(false);
  });
  it("rejects internally inconsistent payment/state/fee/provenance records", () => {
    const booking = hold().booking;
    for (const patch of [
      { state: "confirmed" },
      { holdExpiresAt: booking.createdAt },
      { fee: { ...booking.fee, clinicId: id(12) } },
      { provenance: { source: "online", customerId: id(99) } },
      { provenance: { source: "front_desk", staffId: id(9) } },
    ])
      expect(bookingRecordSchema.safeParse({ ...booking, ...patch }).success).toBe(false);
  });
});

describe("doctor-global half-open slot and hold decisions", () => {
  it("returns only a frozen, nonpersisted hold intent with server fee/CAS prerequisites", () => {
    const input = fixture();
    const result = hold(input);
    expect(result.persisted).toBe(false);
    expect(result.booking).toMatchObject({
      state: "held",
      revision: 1,
      fee: input.fee,
      holdExpiresAt: time(5),
    });
    expect(result.guard).toMatchObject({
      doctorId: id(1),
      occupiedInterval: interval(30, 60),
      availabilityRevision: 2,
    });
    expect(Object.isFrozen(result.booking.fee)).toBe(true);
    expect(Object.isFrozen(result.booking.slot.buffers)).toBe(true);
    input.fee.amountPaise = 1;
    expect(result.booking.fee.amountPaise).toBe(12345);
  });
  it("uses explicit front desk clinic authority in the same paid lifecycle with provenance", () => {
    const input = fixture();
    input.authority = {
      kind: "front_desk",
      staffId: id(9),
      clinicIds: [id(2)],
      organizationVerified: true,
      mfaVerified: true,
    };
    input.request.modality = "in_clinic";
    input.fee.modality = "in_clinic";
    const result = hold(input);
    expect(result.booking.provenance).toEqual({ source: "front_desk", staffId: id(9) });
    expect(result.booking.state).toBe("held");
    expect(result.booking.payments).toEqual([]);
    const paid = transition({ ...transitionFixture(), booking: result.booking });
    expect(paid.next.state).toBe("confirmed");
    expect(paid.next.provenance).toEqual(result.booking.provenance);
  });
  it.each(["foreign_customer", "foreign_clinic", "front_desk_online", "service"])(
    "denies %s",
    (scenario) => {
      const input = fixture();
      if (scenario === "foreign_customer")
        input.authority = { kind: "customer", customerId: id(99) };
      else if (scenario === "service") input.authority = { kind: "expiry_service" };
      else
        input.authority = {
          kind: "front_desk",
          staffId: id(9),
          clinicIds: [id(scenario === "foreign_clinic" ? 99 : 2)],
          organizationVerified: true,
          mfaVerified: true,
        };
      expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DENIED" });
    },
  );
  it("detects stale availability, location/doctor mismatch, modality and fee mismatch", () => {
    const changed = (modify: (input: HoldDecisionInput) => void, reason: string) => {
      const input = fixture();
      modify(input);
      expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason });
    };
    changed((i) => {
      i.request.expectedAvailabilityRevision = 1;
    }, "STALE_AVAILABILITY");
    changed((i) => {
      i.request.availabilityId = id(99);
    }, "STALE_AVAILABILITY");
    changed((i) => {
      i.availability.clinicId = id(99);
    }, "INVALID_SLOT");
    changed((i) => {
      i.availability.doctorId = id(99);
    }, "INVALID_SLOT");
    changed((i) => {
      i.availability.modalities = ["in_clinic"];
    }, "MODALITY_UNAVAILABLE");
    changed((i) => {
      i.fee.modality = "in_clinic";
    }, "FEE_MISMATCH");
    changed((i) => {
      i.fee.approvedPolicyId = id(99);
    }, "FEE_MISMATCH");
  });
  it.each([0, 31, 180, -30])(
    "rejects past, misaligned or out-of-window slot minute %s",
    (start) => {
      const input = fixture();
      input.request.start = time(start);
      expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "INVALID_SLOT" });
    },
  );
  it("rejects hold expiry past start and time/buffer overflow", () => {
    const input = fixture();
    input.policy.holdDurationMs = 31 * 60_000;
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "INVALID_SLOT" });
    input.policy.holdDurationMs = Number.MAX_SAFE_INTEGER;
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "INVALID_SLOT" });
    input.policy = fixture().policy;
    input.availability.buffers.beforeMs = Number.MAX_SAFE_INTEGER;
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "INVALID_SLOT" });
  });
  it("allows adjacency and rejects overlapping intervals in either direction", () => {
    expect(intervalsOverlap(interval(0, 30), interval(30, 60))).toBe(false);
    expect(intervalsOverlap(interval(30, 60), interval(0, 30))).toBe(false);
    expect(intervalsOverlap(interval(0, 31), interval(30, 60))).toBe(true);
    expect(intervalsOverlap(interval(30, 60), interval(0, 31))).toBe(true);
    expect(bufferedInterval(interval(30, 60), { beforeMs: 60_000, afterMs: 120_000 })).toEqual(
      interval(29, 62),
    );
  });
  it("detects held/confirmed cross-clinic conflicts; other doctors and terminal rows do not conflict", () => {
    const other = bookingRecordSchema.parse(hold().booking);
    other.slot.clinicId = id(12);
    other.fee.clinicId = id(12);
    const input = fixture();
    input.occupied = [other];
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DOCTOR_UNAVAILABLE" });
    input.occupied = [bookingRecordSchema.parse(transition().next)];
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DOCTOR_UNAVAILABLE" });
    other.slot.doctorId = id(13);
    other.fee.doctorId = id(13);
    input.occupied = [other];
    expect(hold(input).booking.state).toBe("held");
    other.slot.doctorId = id(1);
    other.fee.doctorId = id(1);
    for (const state of ["expired", "cancelled"] as const) {
      other.state = state;
      expect(hold(input).booking.state).toBe("held");
    }
  });
  it("requires explicit committed expiry rather than treating elapsed holds as released", () => {
    const input = fixture();
    input.occupied = [bookingRecordSchema.parse(hold().booking)];
    input.now = time(6);
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DOCTOR_UNAVAILABLE" });
    const expired = transition({
      ...transitionFixture(),
      now: time(6),
      authority: { kind: "expiry_service" },
      action: { kind: "expire" },
    });
    input.occupied = [bookingRecordSchema.parse(expired.next)];
    expect(hold(input).booking.state).toBe("held");
  });
  it("includes BOTH bookings' buffers globally, permitting only buffered adjacency", () => {
    const input = fixture();
    input.request.start = time(60);
    const other = bookingRecordSchema.parse(hold().booking);
    other.slot.clinicId = id(12);
    other.fee.clinicId = id(12);
    input.occupied = [other];
    expect(hold(input).booking.slot.interval).toEqual(interval(60, 90));
    other.slot.buffers.afterMs = 1;
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DOCTOR_UNAVAILABLE" });
    other.slot.buffers.afterMs = 0;
    input.availability.buffers.beforeMs = 1;
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DOCTOR_UNAVAILABLE" });
    input.request.start = time(90);
    other.slot.buffers.afterMs = 15 * 60_000;
    input.availability.buffers.beforeMs = 15 * 60_000;
    expect(hold(input).booking.slot.interval).toEqual(interval(90, 120));
    input.availability.buffers.beforeMs += 1;
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DOCTOR_UNAVAILABLE" });
  });
  it("applies global leave to expanded intervals, but permits leave adjacency and other doctors", () => {
    const input = fixture();
    input.leaves = [{ id: id(15), revision: 1, doctorId: id(1), interval: interval(60, 90) }];
    expect(hold(input).booking.slot.interval).toEqual(interval(30, 60));
    input.availability.buffers.afterMs = 1;
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DOCTOR_UNAVAILABLE" });
    input.leaves = [{ id: id(15), revision: 1, doctorId: id(99), interval: interval(30, 90) }];
    expect(hold(input).booking.state).toBe("held");
  });
  it("never converts local/DST wall times implicitly", () => {
    const input = fixture();
    input.availability.clinicTimezone = "America/New_York";
    expect(hold(input).booking.slot.interval).toEqual(interval(30, 60));
    input.request.start = "2026-11-01T01:30:00.000";
    expect(() => decideBookingHold(input)).toThrow();
  });
  it("keeps the repeated DST wall-clock hour as distinct UTC slots", () => {
    const input = fixture();
    input.now = "2026-11-01T04:00:00.000Z";
    input.availability.clinicTimezone = "America/New_York";
    input.availability.window = {
      start: "2026-11-01T05:00:00.000Z",
      end: "2026-11-01T07:00:00.000Z",
    };
    input.request.start = "2026-11-01T05:30:00.000Z";
    const first = hold(input);
    input.request.start = "2026-11-01T06:30:00.000Z";
    input.occupied = [bookingRecordSchema.parse(first.booking)];
    expect(hold(input).booking.slot.interval.start).toBe("2026-11-01T06:30:00.000Z");
  });
  it("does not give front desk a cross-clinic or cross-modality overlap bypass", () => {
    const input = fixture();
    input.authority = {
      kind: "front_desk",
      staffId: id(9),
      clinicIds: [id(2)],
      organizationVerified: true,
      mfaVerified: true,
    };
    input.request.modality = "in_clinic";
    input.fee.modality = "in_clinic";
    const other = bookingRecordSchema.parse(hold().booking);
    other.slot.clinicId = id(12);
    other.fee.clinicId = id(12);
    input.occupied = [other];
    expect(decideBookingHold(input)).toEqual({ kind: "rejected", reason: "DOCTOR_UNAVAILABLE" });
  });
});

describe("authoritative revision/owner/payment transitions", () => {
  it("confirms exact captured payment before expiry without mutating the fee or caller", () => {
    const input = transitionFixture();
    const before = JSON.stringify(input.booking);
    const result = transition(input);
    expect(result.next.state).toBe("confirmed");
    expect(result.next.revision).toBe(2);
    expect(result.next.fee).toEqual(input.booking.fee);
    expect(result.next.payments).toHaveLength(1);
    expect(result.obligations).toEqual([]);
    expect(result.compareAndSwap).toEqual({
      bookingId: id(5),
      expectedRevision: 1,
      expectedOwnerId: id(3),
    });
    expect(result.persisted).toBe(false);
    expect(JSON.stringify(input.booking)).toBe(before);
  });
  it.each(["owner", "revision", "actor", "verification", "booking", "clock"])(
    "rejects bad %s authority",
    (scenario) => {
      const input = transitionFixture();
      if (scenario === "owner") input.expectedOwnerId = id(99);
      if (scenario === "revision") input.expectedRevision = 2;
      if (scenario === "actor") input.authority = { kind: "customer", customerId: id(3) };
      if (scenario === "verification")
        input.authority = { kind: "payment_service", verificationReference: id(99) };
      if (scenario === "booking" && input.action.kind === "payment_captured")
        input.action.payment.bookingId = id(99);
      if (scenario === "clock") input.now = time(-1);
      expect(decideBookingTransition(input)).toEqual({
        kind: "rejected",
        reason:
          scenario === "owner"
            ? "OWNER_MISMATCH"
            : scenario === "revision"
              ? "STALE_REVISION"
              : scenario === "clock"
                ? "INVALID_STATE"
                : "DENIED",
      });
    },
  );
  it("requires explicit expected owner/revision, current server clock and reviewed policy", () => {
    for (const key of [
      "expectedOwnerId",
      "expectedRevision",
      "now",
      "authority",
      "policy",
    ] as const) {
      const input: Partial<TransitionDecisionInput> = transitionFixture();
      delete input[key];
      expect(() => decideBookingTransition(input as TransitionDecisionInput)).toThrow();
    }
  });
  it.each([5, 6, 40])(
    "expires late captured payments at server minute %s with a durable obligation intent",
    (minute) => {
      const result = transition({ ...transitionFixture(), now: time(minute) });
      expect(result.next.state).toBe("expired");
      expect(result.next.payments[0]?.disposition).toBe("rebook_or_refund_required");
      expect(result.obligations).toEqual([
        expect.objectContaining({
          kind: "rebook_or_refund_required",
          reason: "late_payment",
          status: "pending_review_and_reconciliation",
          paymentId: "pay_synthetic",
          operationId: `booking:${id(5)}:payment:pay_synthetic:rebook-or-refund`,
        }),
      ]);
    },
  );
  it("uses semantic payment identity across duplicate deliveries and stale revisions", () => {
    const paid = transition();
    const input = transitionFixture();
    input.booking = paid.next;
    expect(decideBookingTransition(input)).toEqual({
      kind: "idempotent",
      persisted: false,
      revision: 2,
    });
    if (input.action.kind !== "payment_captured") throw new Error("fixture");
    input.action.payment.eventId = "evt_redelivery";
    input.action.payment.verificationReference = id(18);
    input.authority = { kind: "payment_service", verificationReference: id(18) };
    expect(decideBookingTransition(input)).toEqual({
      kind: "idempotent",
      persisted: false,
      revision: 2,
    });
    input.expectedOwnerId = id(99);
    expect(decideBookingTransition(input)).toEqual({ kind: "rejected", reason: "OWNER_MISMATCH" });
  });
  it("does not generate a second late-payment obligation on replay", () => {
    const late = transition({ ...transitionFixture(), now: time(5) });
    expect(
      decideBookingTransition({ ...transitionFixture(), booking: late.next, now: time(7) }),
    ).toEqual({ kind: "idempotent", persisted: false, revision: 2 });
  });
  it("does not expose idempotent payment acknowledgement to a customer actor", () => {
    expect(
      decideBookingTransition({
        ...transitionFixture(),
        booking: transition().next,
        authority: { kind: "customer", customerId: id(3) },
      }),
    ).toEqual({ kind: "rejected", reason: "DENIED" });
  });
  it.each(["changed_payment", "event_collision"])("rejects conflicting replay %s", (scenario) => {
    const input = transitionFixture();
    input.booking = transition().next;
    input.expectedRevision = 2;
    if (input.action.kind !== "payment_captured") throw new Error("fixture");
    if (scenario === "changed_payment") input.action.payment.amountPaise += 1;
    else input.action.payment.paymentId = "pay_other";
    expect(decideBookingTransition(input)).toEqual({
      kind: "rejected",
      reason: "PAYMENT_CONFLICT",
    });
  });
  it("creates reconciliation instead of second confirmation for an additional captured payment", () => {
    const input = transitionFixture();
    input.booking = transition().next;
    input.expectedRevision = 2;
    if (input.action.kind !== "payment_captured") throw new Error("fixture");
    input.action.payment.paymentId = "pay_second";
    input.action.payment.eventId = "evt_second";
    const result = transition(input);
    expect(result.next.state).toBe("confirmed");
    expect(result.next.payments.filter((p) => p.disposition === "applied")).toHaveLength(1);
    expect(result.obligations[0]?.reason).toBe("additional_payment");
  });
  it.each(["amount", "order", "policy_revision", "policy_id"])(
    "does not confirm stale/mismatched %s",
    (scenario) => {
      const input = transitionFixture();
      if (input.action.kind !== "payment_captured") throw new Error("fixture");
      if (scenario === "amount") input.action.payment.amountPaise = 1;
      if (scenario === "order") input.action.payment.orderId = "order_other";
      if (scenario === "policy_revision") input.policy.revision = 2;
      if (scenario === "policy_id") input.policy.id = id(99);
      const result = transition(input);
      expect(result.next.state).toBe("held");
      expect(result.obligations[0]?.reason).toBe(
        scenario.startsWith("policy") ? "policy_changed" : "payment_mismatch",
      );
      expect(result.next.fee.amountPaise).toBe(12345);
    },
  );
  it("enforces expiry authority/deadline/state and exact boundary", () => {
    const input: TransitionDecisionInput = {
      ...transitionFixture(),
      authority: { kind: "expiry_service" },
      action: { kind: "expire" },
    };
    expect(decideBookingTransition(input)).toEqual({ kind: "rejected", reason: "NOT_EXPIRED" });
    input.now = time(5);
    const expired = transition(input);
    expect(expired.next.state).toBe("expired");
    expect(expired.obligations).toEqual([]);
    input.booking = expired.next;
    input.expectedRevision = 2;
    expect(decideBookingTransition(input)).toEqual({ kind: "rejected", reason: "INVALID_STATE" });
    input.authority = { kind: "customer", customerId: id(3) };
    expect(decideBookingTransition(input)).toEqual({ kind: "rejected", reason: "DENIED" });
  });
  it("can expire a hold after a policy revision change without extending its deadline", () => {
    const input: TransitionDecisionInput = {
      ...transitionFixture(),
      now: time(5),
      authority: { kind: "expiry_service" },
      action: { kind: "expire" },
    };
    input.policy.revision = 2;
    const expired = transition(input);
    expect(expired.next.state).toBe("expired");
    expect(expired.next.holdExpiresAt).toBe(time(5));
    const late = transition({
      ...transitionFixture(),
      booking: expired.next,
      expectedRevision: 2,
      now: time(6),
    });
    expect(late.next.state).toBe("expired");
    expect(late.obligations[0]?.reason).toBe("late_payment");
  });
  it("rejects stale cancellation policy and malformed truthy cancellation permission", () => {
    const input: TransitionDecisionInput = {
      ...transitionFixture(),
      authority: { kind: "customer", customerId: id(3) },
      action: { kind: "cancel" },
      cancellationAllowed: true,
    };
    input.policy.revision = 2;
    expect(decideBookingTransition(input)).toEqual({ kind: "rejected", reason: "POLICY_MISMATCH" });
    input.policy = fixture().policy;
    expect(
      decideBookingTransition({
        ...input,
        cancellationAllowed: "yes",
      } as unknown as TransitionDecisionInput),
    ).toEqual({ kind: "rejected", reason: "DENIED" });
  });
  it("requires explicit reviewed cancellation and correct owner/clinic", () => {
    const input: TransitionDecisionInput = {
      ...transitionFixture(),
      authority: { kind: "customer", customerId: id(3) },
      action: { kind: "cancel" },
    };
    expect(decideBookingTransition(input)).toEqual({ kind: "rejected", reason: "DENIED" });
    input.cancellationAllowed = true;
    expect(transition(input).next.state).toBe("cancelled");
    input.authority = { kind: "customer", customerId: id(99) };
    expect(decideBookingTransition(input)).toEqual({ kind: "rejected", reason: "DENIED" });
    input.authority = {
      kind: "front_desk",
      staffId: id(9),
      clinicIds: [id(99)],
      organizationVerified: true,
      mfaVerified: true,
    };
    expect(decideBookingTransition(input)).toEqual({ kind: "rejected", reason: "DENIED" });
    input.authority.clinicIds = [id(2)];
    expect(transition(input).next.state).toBe("cancelled");
  });
  it("retains applied payment and creates only a pending cancellation reconciliation obligation", () => {
    const input: TransitionDecisionInput = {
      ...transitionFixture(),
      booking: transition().next,
      expectedRevision: 2,
      authority: { kind: "customer", customerId: id(3) },
      cancellationAllowed: true,
      action: { kind: "cancel" },
    };
    const cancelled = transition(input);
    expect(cancelled.next.state).toBe("cancelled");
    expect(cancelled.next.payments[0]?.disposition).toBe("applied");
    expect(cancelled.obligations[0]).toMatchObject({
      reason: "cancelled",
      status: "pending_review_and_reconciliation",
    });
    expect(
      decideBookingTransition({ ...input, booking: cancelled.next, expectedRevision: 3 }),
    ).toEqual({ kind: "rejected", reason: "INVALID_STATE" });
  });
  it("never revives cancelled bookings on payment", () => {
    const cancelled = transition({
      ...transitionFixture(),
      authority: { kind: "customer", customerId: id(3) },
      cancellationAllowed: true,
      action: { kind: "cancel" },
    });
    const late = transition({
      ...transitionFixture(),
      booking: cancelled.next,
      expectedRevision: 2,
    });
    expect(late.next.state).toBe("cancelled");
    expect(late.obligations[0]?.reason).toBe("cancelled");
  });
});
