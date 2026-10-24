import {
  type BookingFeeSnapshot,
  type BookingRecord,
  type BookingSlot,
  bookingFeeSnapshotSchema,
  bookingRecordSchema,
  bookingSlotSchema,
  doctorDirectoryEntrySchema,
  type HoldBookingRequest,
  holdBookingRequestSchema,
  utcInstantSchema,
} from "@kandamkulathi/contracts/booking";
import { type ClientSession, sessionSchema } from "@kandamkulathi/contracts/client";
import { bookingOfferScopeSchema } from "../../../../../packages/contracts/src/booking-offers";

export type { BookingRecord, BookingSlot, ClientSession, HoldBookingRequest };
export type Doctor = ReturnType<typeof doctorDirectoryEntrySchema.parse>;
export type Selection = { doctorId: string; clinicId: string; serviceId: string };
export function parseSelection(value: unknown): Selection {
  const data = object(value, ["doctorId", "clinicId", "serviceId"]);
  return {
    doctorId: holdBookingRequestSchema.shape.doctorId.parse(data.doctorId),
    clinicId: holdBookingRequestSchema.shape.clinicId.parse(data.clinicId),
    serviceId: holdBookingRequestSchema.shape.clinicId.parse(data.serviceId),
  };
}
export type Directory = {
  doctors: Doctor[];
  clinics: { id: string; name: string }[];
  services: { id: string; name: string }[];
  scopes?: ReturnType<typeof bookingOfferScopeSchema.parse>[];
};
/** Display choices use published scopes; this never grants hold authorization. */
export function directoryChoices(directory: Directory, clinicId = "", doctorId = "") {
  return {
    clinics: directory.clinics.filter(
      (clinic) =>
        !directory.scopes || directory.scopes.some((scope) => scope.clinicId === clinic.id),
    ),
    doctors: directory.doctors.filter(
      (doctor) =>
        doctor.clinicIds.includes(clinicId) &&
        (!directory.scopes ||
          directory.scopes.some(
            (scope) => scope.clinicId === clinicId && scope.doctorId === doctor.doctorId,
          )),
    ),
    services: directory.services.filter(
      (service) =>
        !directory.scopes ||
        directory.scopes.some(
          (scope) =>
            scope.clinicId === clinicId &&
            scope.doctorId === doctorId &&
            scope.serviceId === service.id,
        ),
    ),
  };
}
export type Offer = { serviceId: string; slot: BookingSlot; fee: BookingFeeSnapshot };
export type SlotPage = { serverNow: string; offers: Offer[]; truncated?: boolean };
export type AppointmentPage = { serverNow: string; bookings: BookingRecord[] };
export type HoldPage = { serverNow: string; booking: BookingRecord };
export type Failure = "anonymous" | "denied" | "unavailable" | "error" | "conflict";
export type Reply<T> = { status: "ready"; data: T } | { status: Failure };
/** Integration ports, not invented HTTP routes. Implement with reviewed senior adapters.
 * All results are untrusted until parsed. Adapters must authorize on the server,
 * use no-store, honor AbortSignal and reconcile unknown mutation outcomes.
 */
export interface BookingCustomerApi {
  directory(signal: AbortSignal): Promise<unknown>;
  slots(input: Selection, signal: AbortSignal): Promise<unknown>;
  appointments(signal: AbortSignal): Promise<unknown>;
  hold(input: HoldBookingRequest, signal: AbortSignal): Promise<unknown>;
  read(input: { bookingId: string }, signal: AbortSignal): Promise<unknown>;
}
/** Senior adapter owns current assignment, identity, consent, join window and transport. */
export interface BookingConsultationAdapter {
  join(input: { bookingId: string }, signal: AbortSignal): Promise<unknown>;
}
export function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid response");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join() !== [...keys].sort().join()) throw Error("Invalid keys");
  return record;
}
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > 1000) throw Error("Invalid list");
  return value.map(parse);
}
function named(value: unknown) {
  const item = object(value, ["id", "name"]);
  const id = holdBookingRequestSchema.shape.clinicId.parse(item.id);
  if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 200)
    throw Error("Invalid label");
  return { id, name: item.name };
}
export function parseDirectory(value: unknown): Directory {
  const hasScopes = !!value && typeof value === "object" && "scopes" in value;
  const data = object(value, ["doctors", "clinics", "services", ...(hasScopes ? ["scopes"] : [])]);
  const result = {
    doctors: list(data.doctors, (v) => doctorDirectoryEntrySchema.parse(v)),
    clinics: list(data.clinics, named),
    services: list(data.services, named),
    ...(hasScopes ? { scopes: list(data.scopes, (v) => bookingOfferScopeSchema.parse(v)) } : {}),
  };
  for (const ids of [
    result.doctors.map((d) => d.doctorId),
    result.clinics.map((c) => c.id),
    result.services.map((s) => s.id),
  ])
    if (new Set(ids).size !== ids.length) throw Error("Duplicate identity");
  return result;
}
export function parseSlots(value: unknown): SlotPage {
  const hasTruncation = !!value && typeof value === "object" && "truncated" in value;
  const data = object(value, ["serverNow", "offers", ...(hasTruncation ? ["truncated"] : [])]);
  if (hasTruncation && typeof data.truncated !== "boolean") throw Error("Invalid truncation");
  return {
    serverNow: utcInstantSchema.parse(data.serverNow),
    ...(hasTruncation ? { truncated: data.truncated as boolean } : {}),
    offers: list(data.offers, (v) => {
      const offer = object(v, ["serviceId", "slot", "fee"]);
      const slot = bookingSlotSchema.parse(offer.slot);
      const fee = bookingFeeSnapshotSchema.parse(offer.fee);
      if (
        slot.doctorId !== fee.doctorId ||
        slot.clinicId !== fee.clinicId ||
        slot.modality !== fee.modality
      )
        throw Error("Mismatched fee");
      return {
        serviceId: holdBookingRequestSchema.shape.clinicId.parse(offer.serviceId),
        slot,
        fee,
      };
    }),
  };
}
export function parseAppointments(value: unknown): AppointmentPage {
  const data = object(value, ["serverNow", "bookings"]);
  return {
    serverNow: utcInstantSchema.parse(data.serverNow),
    bookings: list(data.bookings, (v) => bookingRecordSchema.parse(v)),
  };
}
export function parseHold(value: unknown): HoldPage {
  const data = object(value, ["serverNow", "booking"]);
  return {
    serverNow: utcInstantSchema.parse(data.serverNow),
    booking: bookingRecordSchema.parse(data.booking),
  };
}
export function parseReply<T>(value: unknown, parse: (data: unknown) => T): Reply<T> {
  if (!value || typeof value !== "object") throw Error("Invalid response");
  if ("status" in value && value.status === "ready") {
    const result = object(value, ["status", "data"]);
    return { status: "ready", data: parse(result.data) };
  }
  const result = object(value, ["status"]);
  if (!["anonymous", "denied", "unavailable", "error", "conflict"].includes(String(result.status)))
    throw Error("Invalid status");
  return { status: result.status as Failure };
}
export function customerSession(value: unknown, now: number): ClientSession | null {
  const parsed = sessionSchema.safeParse(value);
  return parsed.success &&
    parsed.data.workspaces.includes("customer") &&
    Date.parse(parsed.data.expiresAt) > now
    ? parsed.data
    : null;
}
export { holdBookingRequestSchema };
