import { apiOrigin } from "@kandamkulathi/client";
import {
  bookingMetadataResponseSchema,
  bookingOffersQuerySchema,
  bookingOffersResponseSchema,
} from "../../../../../packages/contracts/src/booking-offers";
import { object, parseDirectory, parseSelection, type Reply } from "./contracts";
import type { BookingRuntimeOptions } from "./runtimeAdapter";

export type BookingRuntimeConnection = Pick<
  BookingRuntimeOptions,
  "origin" | "local" | "transport"
>;
type Metadata = ReturnType<typeof bookingMetadataResponseSchema.parse>;
/** Concrete discovery wiring. The transport remains root-owned verified auth/CSRF.
 * Only DB clocks anchor searches; dates below bound discovery, not eligibility. */
export function createBookingRuntimeOptions(
  connection: BookingRuntimeConnection,
): BookingRuntimeOptions {
  const origin = apiOrigin(connection.origin, connection.local);
  async function get<T>(
    path: string,
    schema: { parse(value: unknown): T },
    signal: AbortSignal,
  ): Promise<Reply<T>> {
    try {
      const response = await connection.transport(`${origin}${path}`, {
        method: "GET",
        cache: "no-store",
        redirect: "error",
        signal,
        headers: { Accept: "application/json" },
      });
      if (response.status === 401) return { status: "anonymous" };
      if (response.status === 403) return { status: "denied" };
      if (response.status === 503) return { status: "unavailable" };
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
        return { status: "error" };
      return { status: "ready", data: schema.parse(await response.json()) };
    } catch {
      return { status: "error" };
    }
  }
  const metadata = (signal: AbortSignal) =>
    get("/v1/booking-metadata", bookingMetadataResponseSchema, signal);
  function scoped(
    meta: Metadata,
    selection: { doctorId: string; clinicId: string; serviceId: string },
  ) {
    return meta.scopes.filter(
      (scope) =>
        scope.doctorId === selection.doctorId &&
        scope.clinicId === selection.clinicId &&
        scope.serviceId === selection.serviceId,
    );
  }
  return {
    ...connection,
    async directory(signal) {
      const meta = await metadata(signal);
      if (meta.status !== "ready") return meta;
      const doctors = await get(
        "/v1/doctors",
        { parse: (value) => object(value, ["doctors"]).doctors },
        signal,
      );
      if (doctors.status !== "ready") return doctors;
      try {
        const data = parseDirectory({
          doctors: doctors.data,
          clinics: meta.data.clinics.map((c) => ({ id: c.clinicId, name: c.displayName })),
          services: meta.data.services.map((s) => ({ id: s.serviceId, name: s.displayName })),
          scopes: meta.data.scopes,
        });
        if (
          data.scopes?.some(
            (scope) =>
              !data.doctors.some(
                (d) => d.doctorId === scope.doctorId && d.clinicIds.includes(scope.clinicId),
              ) ||
              !data.clinics.some((c) => c.id === scope.clinicId) ||
              !data.services.some((s) => s.id === scope.serviceId),
          )
        )
          return { status: "error" };
        return { status: "ready", data };
      } catch {
        return { status: "error" };
      }
    },
    async slots(rawSelection, signal) {
      const selection = parseSelection(rawSelection);
      const meta = await metadata(signal);
      if (meta.status !== "ready") return meta;
      const scopes = scoped(meta.data, selection);
      if (!scopes.length) return { status: "denied" };
      const modalities = [...new Set(scopes.map((scope) => scope.modality))];
      const pages = await Promise.all(
        modalities.map(async (modality) => {
          const query = bookingOffersQuerySchema.parse({
            ...selection,
            modality,
            from: meta.data.serverNow,
            until: new Date(Date.parse(meta.data.serverNow) + 86_400_000).toISOString(),
            limit: 50,
          });
          const params = new URLSearchParams(
            Object.entries(query).map(([key, value]) => [key, String(value)]),
          );
          const result = await get(
            `/v1/booking-offers?${params}`,
            bookingOffersResponseSchema,
            signal,
          );
          if (
            result.status === "ready" &&
            result.data.offers.some(
              (offer) =>
                offer.serviceId !== selection.serviceId ||
                offer.slot.doctorId !== selection.doctorId ||
                offer.slot.clinicId !== selection.clinicId ||
                offer.slot.modality !== modality ||
                offer.slot.interval.start < query.from ||
                offer.slot.interval.end > query.until ||
                !scopes.some(
                  (scope) =>
                    scope.modality === modality &&
                    scope.availabilityId === offer.slot.availabilityId &&
                    scope.availabilityRevision === offer.slot.availabilityRevision,
                ),
            )
          )
            return { status: "error" as const };
          return result;
        }),
      );
      const failed = pages.find((page) => page.status !== "ready");
      if (failed) return failed;
      const ready = pages.filter((page) => page.status === "ready");
      return {
        status: "ready",
        data: {
          serverNow:
            ready
              .map((page) => page.data.serverNow)
              .sort()
              .at(-1) ?? meta.data.serverNow,
          offers: ready.flatMap((page) =>
            page.data.offers.map(({ serviceId, slot, fee }) => ({ serviceId, slot, fee })),
          ),
          truncated: ready.some((page) => page.data.truncated),
        },
      };
    },
    // Hold/read bodies have no server clock. Fetch fresh authoritative metadata
    // after persistence; a failed clock read fails closed and retains retry IDs.
    async serverNow(_response, signal) {
      const result = await metadata(signal);
      if (result.status !== "ready") throw Error("Trusted booking clock unavailable");
      return result.data.serverNow;
    },
    createOperationIds: () => ({
      operationId: crypto.randomUUID(),
      bookingId: crypto.randomUUID(),
    }),
  };
}
