import { describe, expect, it, vi } from "vitest";
import {
  parseDirectory,
  parseHold,
  parseSlots,
} from "../../apps/workspaces/src/customer/booking/contracts";
import { BookingController } from "../../apps/workspaces/src/customer/booking/controller";
import { createBookingRuntimeApi } from "../../apps/workspaces/src/customer/booking/runtimeAdapter";
import {
  booking,
  directory,
  fixtureApi,
  ids,
  now,
  offer,
  owner,
  ready,
  selection,
  session,
} from "./customer-booking-fixtures";

describe("customer booking presentation", () => {
  it("clears holdable offers when selection becomes incomplete or invalid", async () => {
    const c = new BookingController(fixtureApi(), session, undefined, () => Date.parse(now));
    await c.load();
    await c.select(selection);
    expect(c.getSnapshot().slots.status).toBe("ready");
    c.clearSelection();
    expect(c.getSnapshot().slots.status).toBe("idle");
    await c.hold(offer);
    expect(c.getSnapshot().hold.status).toBe("idle");
    await c.select(selection);
    await c.select({ ...selection, clinicId: "" });
    expect(c.getSnapshot().slots.status).toBe("error");
  });
  it("permits explicit read retry after failure and rejects stale server revisions", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValueOnce(
        ready({ serverNow: now, booking: { ...booking, revision: 2, state: "expired" } }),
      )
      .mockResolvedValueOnce(ready({ serverNow: now, booking }));
    const c = new BookingController(fixtureApi({ read }), session, undefined, () =>
      Date.parse(now),
    );
    await c.load();
    await c.select(selection);
    const slots = c.getSnapshot().slots;
    if (slots.status !== "ready") throw Error("Missing slots");
    await c.hold(slots.data.offers[0]!);
    await c.refreshHold();
    expect(c.getSnapshot().hold.status).toBe("error");
    expect(c.getSnapshot().canRefreshHold).toBe(true);
    await c.refreshHold();
    expect(c.getSnapshot().hold.status).toBe("ready");
    await c.refreshHold();
    expect(c.getSnapshot().hold.status).toBe("error");
  });
  it("joins only listed confirmed online appointments through the injected senior adapter", async () => {
    const confirmed = {
      ...booking,
      state: "confirmed" as const,
      payments: [
        {
          disposition: "applied" as const,
          payment: {
            provider: "razorpay" as const,
            eventId: "synthetic_event",
            paymentId: "synthetic_payment",
            orderId: booking.paymentOrderId,
            bookingId: booking.id,
            amountPaise: booking.fee.amountPaise,
            currency: "INR" as const,
            verificationReference: ids[11],
            status: "captured" as const,
          },
        },
      ],
    };
    const join = vi.fn(async () => ready({ state: "pending" }));
    const c = new BookingController(
      fixtureApi({ appointments: async () => ready({ serverNow: now, bookings: [confirmed] }) }),
      session,
      { join },
      () => Date.parse(now),
    );
    await c.load();
    await c.join(booking);
    expect(join).not.toHaveBeenCalled();
    const appointments = c.getSnapshot().appointments;
    if (appointments.status !== "ready") throw Error("Missing appointments");
    await c.join(appointments.data.bookings[0]!);
    expect(join).toHaveBeenCalledOnce();
    expect(c.getSnapshot().join).toBe("pending");
    const unavailable = new BookingController(
      fixtureApi({ appointments: async () => ready({ serverNow: now, bookings: [confirmed] }) }),
      session,
      undefined,
      () => Date.parse(now),
    );
    await unavailable.load();
    const list = unavailable.getSnapshot().appointments;
    if (list.status === "ready") await unavailable.join(list.data.bookings[0]!);
    expect(unavailable.getSnapshot().join).toBe("unavailable");
  });
  it("validates strict canonical payloads, matching fees and real calendar dates", () => {
    expect(parseDirectory(directory)).toEqual(directory);
    expect(() => parseDirectory({ ...directory, unsafe: true })).toThrow();
    expect(() =>
      parseSlots({
        serverNow: now,
        offers: [{ ...offer, fee: { ...offer.fee, clinicId: ids[0] } }],
      }),
    ).toThrow();
    expect(() => parseHold({ serverNow: "2026-02-30T00:00:00.000Z", booking })).toThrow();
    expect(() =>
      parseHold({ serverNow: now, booking: { ...booking, state: "confirmed" } }),
    ).toThrow();
  });
  it("holds once without a fee input; countdown never expires or confirms server state", async () => {
    let time = Date.parse(now);
    const hold = vi.fn(fixtureApi().hold);
    const c = new BookingController(fixtureApi({ hold }), session, undefined, () => time);
    await c.load();
    await c.select(selection);
    const slots = c.getSnapshot().slots;
    if (slots.status !== "ready") throw Error("Missing slots");
    await c.hold(slots.data.offers[0]!);
    expect(hold).toHaveBeenCalledOnce();
    expect(hold.mock.calls[0]![0]).toEqual({
      ...selection,
      serviceId: undefined,
      ownerId: owner,
      availabilityId: offer.slot.availabilityId,
      expectedAvailabilityRevision: 1,
      modality: "online",
      start: offer.slot.interval.start,
    });
    expect(c.getSnapshot().remainingSeconds).toBe(60);
    time += 61000;
    c.tick();
    expect(c.getSnapshot().remainingSeconds).toBe(0);
    expect(c.getSnapshot().hold).toEqual(ready({ serverNow: now, booking }));
    await c.hold(offer);
    expect(hold).toHaveBeenCalledOnce();
  });
  it.each(["anonymous", "denied", "unavailable", "error", "conflict"] as const)(
    "handles %s without private data",
    async (status) => {
      const c = new BookingController(
        fixtureApi({ directory: async () => ({ status }) }),
        session,
        undefined,
        () => Date.parse(now),
      );
      await c.load();
      expect(c.getSnapshot().directory).toEqual({ status });
    },
  );
  it("rejects invalid selection and cross-owner private history", async () => {
    const slots = vi.fn(fixtureApi().slots);
    const c = new BookingController(
      fixtureApi({
        slots,
        appointments: async () =>
          ready({
            serverNow: now,
            bookings: [
              {
                ...booking,
                ownerId: ids[11],
                provenance: { source: "online", customerId: ids[11] },
              },
            ],
          }),
      }),
      session,
      undefined,
      () => Date.parse(now),
    );
    await c.load();
    await c.select({ ...selection, doctorId: "invalid" });
    expect(slots).not.toHaveBeenCalled();
    expect(c.getSnapshot().appointments.status).toBe("error");
  });
  it("fences stale slot responses, logout and expiry", async () => {
    let finish!: (data: unknown) => void;
    let time = Date.parse(now);
    const c = new BookingController(
      fixtureApi({
        slots: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      }),
      session,
      undefined,
      () => time,
    );
    await c.load();
    const pending = c.select(selection);
    c.clearSelection();
    finish(ready({ serverNow: now, offers: [offer] }));
    await pending;
    expect(c.getSnapshot().slots.status).toBe("idle");
    time = Date.parse(session.expiresAt);
    c.tick();
    expect(c.getSnapshot().directory.status).toBe("anonymous");
    c.invalidate();
    expect(c.getSnapshot().selection).toBeNull();
  });
  it("does not repeat uncertain mutations; conflict recovers by explicit availability refresh", async () => {
    const hold = vi.fn(async () => {
      throw Error("Unknown commit");
    });
    const c = new BookingController(fixtureApi({ hold }), session, undefined, () =>
      Date.parse(now),
    );
    await c.load();
    await c.select(selection);
    const slots = c.getSnapshot().slots;
    if (slots.status !== "ready") throw Error("Missing slots");
    await c.hold(slots.data.offers[0]!);
    expect(c.getSnapshot().uncertain).toBe(true);
    await c.select(selection);
    await c.hold(offer);
    expect(hold).toHaveBeenCalledOnce();
    const conflict = new BookingController(
      fixtureApi({ hold: async () => ({ status: "conflict" }) }),
      session,
      undefined,
      () => Date.parse(now),
    );
    await conflict.load();
    await conflict.select(selection);
    const page = conflict.getSnapshot().slots;
    if (page.status === "ready") await conflict.hold(page.data.offers[0]!);
    expect(conflict.getSnapshot().hold.status).toBe("conflict");
    await conflict.select(selection);
    expect(conflict.getSnapshot().slots.status).toBe("ready");
  });
  it("suppresses duplicate submit and late private mutation results on revoke", async () => {
    let finish!: (data: unknown) => void;
    const hold = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const c = new BookingController(fixtureApi({ hold }), session, undefined, () =>
      Date.parse(now),
    );
    await c.load();
    await c.select(selection);
    const slots = c.getSnapshot().slots;
    if (slots.status !== "ready") throw Error("Missing slots");
    const pending = c.hold(slots.data.offers[0]!);
    await c.hold(slots.data.offers[0]!);
    c.invalidate();
    finish(ready({ serverNow: now, booking }));
    await pending;
    expect(hold).toHaveBeenCalledOnce();
    expect(c.getSnapshot().hold.status).toBe("idle");
  });
  it("leaves missing adapters unavailable and absent grants anonymous", async () => {
    const c = new BookingController(undefined, session, undefined, () => Date.parse(now));
    await c.load();
    expect(c.getSnapshot().directory.status).toBe("unavailable");
    const denied = new BookingController(
      fixtureApi(),
      { ...session, workspaces: [] },
      undefined,
      () => Date.parse(now),
    );
    await denied.load();
    expect(denied.getSnapshot().directory.status).toBe("anonymous");
  });
});
describe("published runtime adapter", () => {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  const request = {
    doctorId: selection.doctorId,
    clinicId: selection.clinicId,
    ownerId: owner,
    availabilityId: offer.slot.availabilityId,
    expectedAvailabilityRevision: 1,
    modality: "online" as const,
    start: offer.slot.interval.start,
  };
  it("maps published doctors and configured availability without claiming free inventory", async () => {
    const availability = {
      id: offer.slot.availabilityId,
      revision: 1,
      doctorId: selection.doctorId,
      clinicId: selection.clinicId,
      clinicTimezone: "Asia/Kolkata",
      window: offer.slot.interval,
      slotLengthMs: 900000,
      buffers: offer.slot.buffers,
      modalities: ["online"],
    };
    const transport = vi.fn(async (url: string) =>
      url.endsWith("/availability")
        ? json({ windows: [{ availability, fees: [offer.fee] }] })
        : json({ doctors: directory.doctors }),
    );
    const api = createBookingRuntimeApi({
      origin: "https://example.test",
      local: false,
      transport,
      metadata: async () => ({ clinics: directory.clinics, services: directory.services }),
    });
    const signal = new AbortController().signal;
    expect(await api.directory(signal)).toEqual(ready(directory));
    expect(await api.configuredAvailability(selection.doctorId, signal)).toEqual(
      ready({ windows: [{ availability, fees: [offer.fee] }] }),
    );
    expect(await api.slots(selection, signal)).toEqual({ status: "unavailable" });
    expect(transport.mock.calls[1]![0]).toBe(
      `https://example.test/v1/doctors/${selection.doctorId}/availability`,
    );
  });
  it("uses persisted wrapper, no-store and stable operation IDs after uncertain outcome", async () => {
    const calls: RequestInit[] = [];
    const transport = vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(init);
      if (calls.length === 1) throw Error("lost response");
      return json({ persisted: true, booking });
    });
    const createOperationIds = vi.fn(() => ({ operationId: ids[11]!, bookingId: booking.id }));
    const api = createBookingRuntimeApi({
      origin: "http://127.0.0.1:8787",
      local: true,
      transport,
      createOperationIds,
      serverNow: () => now,
    });
    const signal = new AbortController().signal;
    await expect(api.hold(request, signal)).rejects.toThrow();
    expect(await api.hold(request, signal)).toEqual(ready({ serverNow: now, booking }));
    expect(createOperationIds).toHaveBeenCalledOnce();
    expect(calls[0]!.body).toBe(calls[1]!.body);
    expect(calls[0]!.cache).toBe("no-store");
    expect(await api.appointments(signal)).toEqual({ status: "unavailable" });
  });
  it.each([
    [401, "UNAUTHENTICATED", "anonymous"],
    [403, "FORBIDDEN", "denied"],
    [409, "BOOKING_CONFLICT", "conflict"],
    [503, "BOOKING_UNAVAILABLE", "unavailable"],
    [400, "INVALID_REQUEST", "error"],
  ] as const)("maps actual %s/%s", async (status, code, expected) => {
    const api = createBookingRuntimeApi({
      origin: "https://example.test",
      local: false,
      transport: async () => json({ error: { code } }, status),
      serverNow: () => now,
    });
    expect(await api.read({ bookingId: booking.id }, new AbortController().signal)).toEqual({
      status: expected,
    });
  });
  it("never submits without trusted clock and operation integration", async () => {
    const transport = vi.fn();
    const api = createBookingRuntimeApi({
      origin: "https://example.test",
      local: false,
      transport,
    });
    expect(await api.hold(request, new AbortController().signal)).toEqual({
      status: "unavailable",
    });
    expect(transport).not.toHaveBeenCalled();
  });
});
