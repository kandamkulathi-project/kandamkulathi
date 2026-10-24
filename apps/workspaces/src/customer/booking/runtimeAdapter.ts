import { apiOrigin } from "@kandamkulathi/client";
import {
  bookingFeeSnapshotSchema,
  bookingIdSchema,
  bookingRecordSchema,
  doctorAvailabilitySchema,
  utcInstantSchema,
} from "@kandamkulathi/contracts/booking";
import {
  type BookingCustomerApi,
  type Directory,
  holdBookingRequestSchema,
  object,
  parseDirectory,
  parseReply,
  parseSelection,
  parseSlots,
  type Reply,
  type Selection,
} from "./contracts";

export type ConfiguredAvailability = {
  windows: {
    availability: ReturnType<typeof doctorAvailabilitySchema.parse>;
    fees: ReturnType<typeof bookingFeeSnapshotSchema.parse>[];
  }[];
};
export interface BookingRuntimeApi extends BookingCustomerApi {
  configuredAvailability(
    doctorId: string,
    signal: AbortSignal,
  ): Promise<Reply<ConfiguredAvailability>>;
}

export type BookingRuntimeOptions = {
  origin: string;
  local: boolean;
  /** Senior auth adapter supplies reviewed bearer/session behavior; not raw fetch by default. */
  transport: (url: string, init: RequestInit) => Promise<Response>;
  directory?: (signal: AbortSignal) => Promise<unknown>;
  /** Reviewed metadata APIs, not inline fixtures or guessed clinic/service labels. */
  metadata?: (signal: AbortSignal) => Promise<Pick<Directory, "clinics" | "services">>;
  /** Availability windows alone are NOT free slots. Senior adapter owns concrete offers. */
  slots?: (selection: Selection, signal: AbortSignal) => Promise<unknown>;
  /** Canonical trusted server clock. Missing clock makes a timed hold unavailable. */
  serverNow?: (response: Response, signal: AbortSignal) => unknown | Promise<unknown>;
  createOperationIds?: () => { operationId: string; bookingId: string };
};
/** Adapts only published routes. No history/join/cancel/payment endpoint is fabricated. */
export function createBookingRuntimeApi(options: BookingRuntimeOptions): BookingRuntimeApi {
  const origin = apiOrigin(options.origin, options.local);
  const operations = new Map<string, { operationId: string; bookingId: string }>();
  const send = (path: string, signal: AbortSignal, body?: unknown) =>
    options.transport(`${origin}${path}`, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      redirect: "error",
      signal,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  async function decode(
    response: Response,
  ): Promise<
    | { status: "ready"; data: unknown }
    | { status: "anonymous" | "denied" | "conflict" | "unavailable" | "error" }
  > {
    if (!response.headers.get("content-type")?.includes("application/json"))
      return { status: "error" };
    const raw: unknown = await response.json();
    if (response.ok) return { status: "ready", data: raw };
    const payload = object(raw, ["error"]);
    const error = object(payload.error, ["code"]);
    if (response.status === 401 && error.code === "UNAUTHENTICATED") return { status: "anonymous" };
    if (response.status === 403 && error.code === "FORBIDDEN") return { status: "denied" };
    if (response.status === 409 && error.code === "BOOKING_CONFLICT") return { status: "conflict" };
    if (
      response.status === 503 &&
      ["IDENTITY_UNAVAILABLE", "BOOKING_UNAVAILABLE", "FEATURE_UNAVAILABLE"].includes(
        String(error.code),
      )
    )
      return { status: "unavailable" };
    return { status: "error" };
  }
  function stored(value: unknown) {
    const payload = object(value, ["booking", "persisted"]);
    if (payload.persisted !== true) throw Error("Unpersisted booking");
    return bookingRecordSchema.parse(payload.booking);
  }
  return {
    async configuredAvailability(doctorId, signal) {
      const id = bookingIdSchema.parse(doctorId);
      const result = await decode(await send(`/v1/doctors/${id}/availability`, signal));
      if (result.status !== "ready") return result;
      const payload = object(result.data, ["windows"]);
      if (!Array.isArray(payload.windows) || payload.windows.length > 1000)
        throw Error("Invalid availability");
      const windows = payload.windows.map((raw: unknown) => {
        const window = object(raw, ["availability", "fees"]);
        const availability = doctorAvailabilitySchema.parse(window.availability);
        if (
          availability.doctorId !== id ||
          !Array.isArray(window.fees) ||
          window.fees.length > 1000
        )
          throw Error("Invalid availability binding");
        const fees = window.fees.map((fee: unknown) => bookingFeeSnapshotSchema.parse(fee));
        if (
          fees.some(
            (fee) =>
              fee.doctorId !== id ||
              fee.clinicId !== availability.clinicId ||
              !availability.modalities.includes(fee.modality),
          )
        )
          throw Error("Invalid fee binding");
        return { availability, fees };
      });
      return { status: "ready", data: { windows } };
    },
    async directory(signal) {
      if (options.directory) return parseReply(await options.directory(signal), parseDirectory);
      if (!options.metadata) return { status: "unavailable" };
      const result = await decode(await send("/v1/doctors", signal));
      if (result.status !== "ready") return result;
      const payload = object(result.data, ["doctors"]);
      return {
        status: "ready",
        data: parseDirectory({ ...(await options.metadata(signal)), doctors: payload.doctors }),
      };
    },
    async slots(selection, signal) {
      const input = parseSelection(selection);
      return options.slots
        ? parseReply(await options.slots(input, signal), parseSlots)
        : { status: "unavailable" };
    },
    appointments: async () => ({ status: "unavailable" }),
    async hold(input, signal) {
      if (!options.serverNow || !options.createOperationIds) return { status: "unavailable" };
      const request = holdBookingRequestSchema.parse(input);
      const key = JSON.stringify(request);
      let ids = operations.get(key);
      if (!ids) {
        const generated = options.createOperationIds();
        ids = {
          operationId: bookingIdSchema.parse(generated.operationId),
          bookingId: bookingIdSchema.parse(generated.bookingId),
        };
        operations.set(key, ids);
      }
      const response = await send("/v1/bookings", signal, { ...ids, request });
      const result = await decode(response);
      if (result.status !== "ready") return result;
      const booking = stored(result.data);
      if (booking.id !== ids.bookingId) throw Error("Mismatched operation");
      return {
        status: "ready",
        data: {
          booking,
          serverNow: utcInstantSchema.parse(await options.serverNow(response, signal)),
        },
      };
    },
    async read(input, signal) {
      if (!options.serverNow) return { status: "unavailable" };
      const id = bookingIdSchema.parse(object(input, ["bookingId"]).bookingId);
      const response = await send(`/v1/bookings/${id}`, signal);
      const result = await decode(response);
      if (result.status !== "ready") return result;
      const booking = stored(result.data);
      if (booking.id !== id) throw Error("Mismatched booking");
      return {
        status: "ready",
        data: {
          booking,
          serverNow: utcInstantSchema.parse(await options.serverNow(response, signal)),
        },
      };
    },
  };
}
