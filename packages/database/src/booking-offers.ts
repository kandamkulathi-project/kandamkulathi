import { z } from "zod";
import {
  bookingFeeSnapshotSchema,
  bookingPolicySchema,
  bookingSlotSchema,
  doctorAvailabilitySchema,
  doctorDirectoryEntrySchema,
} from "../../contracts/src/booking.ts";
import {
  type BookingMetadataResponse,
  type BookingOffer,
  type BookingOffersResponse,
  bookingClinicMetadataSchema,
  bookingMetadataResponseSchema,
  bookingOfferSlotId,
  bookingOffersQuerySchema,
  bookingOffersResponseSchema,
  bookingServiceMetadataSchema,
} from "../../contracts/src/booking-offers.ts";
import { BookingRuntimeError } from "./booking.ts";
import { type DatabaseContext, transaction } from "./client.ts";

const unavailable = (): never => {
  throw new BookingRuntimeError("UNAVAILABLE");
};
const feesSchema = z.array(bookingFeeSnapshotSchema);
async function snapshot<T>(
  context: DatabaseContext,
  callback: (serverNow: string) => Promise<T>,
): Promise<T> {
  return transaction(context.client, async () => {
    await context.client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const clock = await context.client.query<{ now: Date }>(
      "SELECT transaction_timestamp() AS now",
    );
    const serverNow = clock.rows[0]?.now.toISOString();
    if (!serverNow) return unavailable();
    return callback(serverNow);
  });
}

async function metadata(
  context: DatabaseContext,
  serverNow: string,
): Promise<BookingMetadataResponse> {
  const clinics = await context.client.query<{ document: unknown }>(
    "SELECT document FROM clinical.mathew_booking_clinic_metadata WHERE published ORDER BY clinic_id LIMIT 201",
  );
  const services = await context.client.query<{ document: unknown }>(
    "SELECT document FROM clinical.mathew_booking_service_metadata WHERE published ORDER BY service_id LIMIT 201",
  );
  if (
    !clinics.rows.length ||
    !services.rows.length ||
    clinics.rows.length > 200 ||
    services.rows.length > 200
  )
    return unavailable();
  const parsedClinics = clinics.rows.map((row) => bookingClinicMetadataSchema.parse(row.document));
  const parsedServices = services.rows.map((row) =>
    bookingServiceMetadataSchema.parse(row.document),
  );
  if ([...parsedClinics, ...parsedServices].some((value) => value.approvedAt > serverNow))
    return unavailable();
  const rows = await context.client.query<{
    availability: unknown;
    directory: unknown;
    modality: string;
    service_id: string | null;
  }>(
    `SELECT c.availability, d.document AS directory, mode.modality, s.service_id FROM clinical.mathew_booking_configuration c
      JOIN clinical.mathew_booking_directory d ON d.doctor_id=c.doctor_id AND d.published
      CROSS JOIN LATERAL jsonb_array_elements_text(c.availability->'modalities') mode(modality)
      LEFT JOIN clinical.mathew_booking_offer_service m ON m.availability_id=c.availability_id AND m.modality=mode.modality
      LEFT JOIN clinical.mathew_booking_service_metadata s ON s.service_id=m.service_id AND s.published
      WHERE c.enabled ORDER BY c.availability_id, mode.modality LIMIT 201`,
  );
  if (rows.rows.length > 200) return unavailable();
  const scopes = rows.rows.map((row) => {
    const availability = doctorAvailabilitySchema.parse(row.availability);
    const directory = doctorDirectoryEntrySchema.parse(row.directory);
    const clinic = parsedClinics.find((value) => value.clinicId === availability.clinicId);
    if (
      directory.doctorId !== availability.doctorId ||
      !directory.clinicIds.includes(availability.clinicId) ||
      !clinic ||
      clinic.clinicTimezone !== availability.clinicTimezone ||
      !row.service_id ||
      !parsedServices.some((value) => value.serviceId === row.service_id)
    )
      return unavailable();
    return {
      doctorId: availability.doctorId,
      clinicId: availability.clinicId,
      serviceId: row.service_id,
      availabilityId: availability.id,
      availabilityRevision: availability.revision,
      modality: row.modality,
    };
  });
  return bookingMetadataResponseSchema.parse({
    serverNow,
    clinics: parsedClinics,
    services: parsedServices,
    scopes,
  });
}

/** Public approved names and exact schedule/service associations; not staff-write authority. */
export async function readBookingMetadata(
  context: DatabaseContext,
): Promise<BookingMetadataResponse> {
  return snapshot(context, (serverNow) => metadata(context, serverNow));
}

/** Snapshot offers are NOT reservations. Existing hold transaction remains authoritative. */
export async function readBookingOffers(
  context: DatabaseContext,
  input: unknown,
): Promise<BookingOffersResponse> {
  const query = bookingOffersQuerySchema.parse(input);
  return snapshot(context, async (serverNow) => {
    const named = await metadata(context, serverNow);
    if (
      !named.clinics.some((value) => value.clinicId === query.clinicId) ||
      !named.services.some((value) => value.serviceId === query.serviceId)
    )
      return unavailable();
    const scopes = named.scopes.filter(
      (value) =>
        value.doctorId === query.doctorId &&
        value.clinicId === query.clinicId &&
        value.serviceId === query.serviceId &&
        value.modality === query.modality,
    );
    if (scopes.length > 20) return unavailable();
    const offers: BookingOffer[] = [];
    let truncated = false;
    for (const scope of scopes) {
      const rows = await context.client.query<{
        availability: unknown;
        policy: unknown;
        fees: unknown;
      }>(
        "SELECT availability,policy,fees FROM clinical.mathew_booking_configuration WHERE availability_id=$1 AND enabled",
        [scope.availabilityId],
      );
      const row = rows.rows[0];
      if (!row) return unavailable();
      const availability = doctorAvailabilitySchema.parse(row.availability);
      const policy = bookingPolicySchema.parse(row.policy);
      const fees = feesSchema.parse(row.fees).filter((fee) => fee.modality === query.modality);
      const fee = fees[0];
      if (
        fees.length !== 1 ||
        !fee ||
        fee.doctorId !== scope.doctorId ||
        fee.clinicId !== scope.clinicId ||
        fee.approvedPolicyId !== policy.id
      )
        return unavailable();
      const free = await context.client.query<{ slot_starts: Date[]; scan_truncated: boolean }>(
        "SELECT * FROM clinical.mathew_booking_available_offer_starts($1,$2,$3,$4,$5,$6)",
        [
          scope.availabilityId,
          scope.availabilityRevision,
          scope.modality,
          query.from,
          query.until,
          query.limit + 1,
        ],
      );
      const result = free.rows[0];
      if (!result) return unavailable();
      truncated ||= result.scan_truncated;
      for (const start of result.slot_starts) {
        const end = new Date(start.getTime() + availability.slotLengthMs);
        const slot = bookingSlotSchema.parse({
          doctorId: scope.doctorId,
          clinicId: scope.clinicId,
          clinicTimezone: availability.clinicTimezone,
          availabilityId: scope.availabilityId,
          availabilityRevision: scope.availabilityRevision,
          interval: { start: start.toISOString(), end: end.toISOString() },
          buffers: availability.buffers,
          modality: scope.modality,
        });
        offers.push({ slotId: bookingOfferSlotId(slot), serviceId: scope.serviceId, slot, fee });
      }
    }
    offers.sort(
      (a, b) =>
        a.slot.interval.start.localeCompare(b.slot.interval.start) ||
        a.slotId.localeCompare(b.slotId),
    );
    truncated ||= offers.length > query.limit;
    return bookingOffersResponseSchema.parse({
      serverNow,
      offers: offers.slice(0, query.limit),
      truncated,
    });
  });
}
