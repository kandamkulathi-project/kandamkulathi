import { describe, expect, it, vi } from "vitest";
import { createBookingRuntimeApi } from "../../apps/workspaces/src/customer/booking/runtimeAdapter";
import { createBookingRuntimeOptions } from "../../apps/workspaces/src/customer/booking/runtimeOptions";
import { bookingOffersQuerySchema } from "../../packages/contracts/src/booking-offers";
import {
  booking,
  runtimeOffers as canonicalOffers,
  directory,
  ids,
  runtimeMetadata as metadata,
  now,
  offer,
  owner,
  selection,
} from "./customer-booking-fixtures";

const signal = () => new AbortController().signal;
const json = (value: unknown, status = 200) => Response.json(value, { status });
describe("concrete booking runtime options", () => {
  it("maps canonical approved metadata/scopes and uses DB clock bounded exact offer GETs", async () => {
    const transport = vi.fn(async (url: string, init: RequestInit) => {
      expect(init).toMatchObject({ method: "GET", cache: "no-store", redirect: "error" });
      if (url.endsWith("booking-metadata")) return json(metadata);
      if (url.endsWith("doctors")) return json({ doctors: directory.doctors });
      const params = Object.fromEntries(new URL(url).searchParams);
      expect(bookingOffersQuerySchema.parse({ ...params, limit: Number(params.limit) })).toEqual({
        ...selection,
        modality: "online",
        from: now,
        until: "2026-10-25T09:00:00.000Z",
        limit: 50,
      });
      return json(canonicalOffers);
    });
    const options = createBookingRuntimeOptions({
      origin: "https://example.test",
      local: false,
      transport,
    });
    const api = createBookingRuntimeApi(options);
    expect(await api.directory(signal())).toEqual({
      status: "ready",
      data: { ...directory, scopes: metadata.scopes },
    });
    expect(await api.slots(selection, signal())).toEqual({
      status: "ready",
      data: { serverNow: now, offers: [offer], truncated: true },
    });
    expect(options.createOperationIds?.().operationId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it.each([401, 403, 503])(
    "preserves metadata failure %s rather than empty/success",
    async (status) => {
      const api = createBookingRuntimeApi(
        createBookingRuntimeOptions({
          origin: "https://example.test",
          local: false,
          transport: async () => json({}, status),
        }),
      );
      expect(await api.directory(signal())).toEqual({
        status: status === 401 ? "anonymous" : status === 403 ? "denied" : "unavailable",
      });
    },
  );
  it("rejects malformed/unknown metadata, unsupported selections and off-scope offers", async () => {
    let payload: unknown = { ...metadata, ownerId: owner };
    const transport = vi.fn(async (url: string) =>
      url.includes("booking-offers?")
        ? json({
            ...canonicalOffers,
            offers: [{ ...canonicalOffers.offers[0], serviceId: ids[11] }],
          })
        : json(payload),
    );
    const api = createBookingRuntimeApi(
      createBookingRuntimeOptions({ origin: "https://example.test", local: false, transport }),
    );
    expect(await api.slots(selection, signal())).toEqual({ status: "error" });
    payload = metadata;
    expect(await api.slots({ ...selection, serviceId: ids[11]! }, signal())).toEqual({
      status: "denied",
    });
    expect(await api.slots(selection, signal())).toEqual({ status: "error" });
  });
  it("fetches fresh trusted clock after persisted hold and preserves CSPRNG identities on uncertain retry", async () => {
    const bodies: string[] = [];
    const transport = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("booking-metadata"))
        return json({ ...metadata, serverNow: "2026-10-24T09:00:30.000Z" });
      bodies.push(String(init.body));
      if (bodies.length === 1) throw Error("Lost hold response");
      const body = JSON.parse(String(init.body));
      return json({ persisted: true, booking: { ...booking, id: body.bookingId } });
    });
    const api = createBookingRuntimeApi(
      createBookingRuntimeOptions({ origin: "https://example.test", local: false, transport }),
    );
    const request = {
      doctorId: selection.doctorId,
      clinicId: selection.clinicId,
      ownerId: owner,
      availabilityId: offer.slot.availabilityId,
      expectedAvailabilityRevision: 1,
      modality: "online",
      start: offer.slot.interval.start,
    };
    await expect(api.hold(request as Parameters<typeof api.hold>[0], signal())).rejects.toThrow();
    const result = await api.hold(request as Parameters<typeof api.hold>[0], signal());
    expect(result).toMatchObject({
      status: "ready",
      data: { serverNow: "2026-10-24T09:00:30.000Z" },
    });
    expect(bodies[0]).toBe(bodies[1]);
    expect(JSON.parse(bodies[0]!).request).not.toHaveProperty("fee");
  });
});
