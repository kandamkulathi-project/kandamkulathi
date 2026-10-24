import { bookingClinicMetadataSchema } from "../../contracts/src/booking-offers.ts";
import { CommerceError } from "../../contracts/src/commerce-catalogue.ts";
import { commerceClinicsSchema } from "../../contracts/src/commerce-clinics.ts";
import { type DatabaseContext, inTransaction, transaction } from "./client.ts";

/** Sole naming authority is canonical approved booking metadata; inventory names are never labels. */
export async function loadCommerceClinicsInTransaction(context: DatabaseContext) {
  if (!inTransaction(context.client)) throw new CommerceError("denied");
  const available = (
    await context.client.query<{ registry: string | null; mapping: string | null }>(
      "SELECT to_regclass('clinical.mathew_booking_clinic_metadata')::text AS registry,to_regclass('core.commerce_clinic_locations')::text AS mapping",
    )
  ).rows[0];
  if (!available?.registry || !available.mapping) throw new CommerceError("unavailable");
  const rows = (
    await context.client.query<{
      clinic_id: string;
      document: unknown;
      location_id: string | null;
      now: Date;
    }>(`SELECT c.clinic_id,c.document,m.location_id,statement_timestamp() AS now
    FROM clinical.mathew_booking_clinic_metadata c
    LEFT JOIN core.commerce_clinic_locations m ON m.clinic_id=c.clinic_id AND m.active
    WHERE c.published ORDER BY c.clinic_id LIMIT 201`)
  ).rows;
  if (!rows.length || rows.length > 200) throw new CommerceError("unavailable");
  const items = [];
  for (const row of rows) {
    const metadata = bookingClinicMetadataSchema.safeParse(row.document);
    if (
      !metadata.success ||
      metadata.data.clinicId !== row.clinic_id ||
      Date.parse(metadata.data.approvedAt) > row.now.getTime()
    )
      throw new CommerceError("unavailable");
    if (row.location_id)
      items.push({
        clinicId: row.clinic_id,
        locationId: row.location_id,
        name: metadata.data.displayName,
      });
  }
  if (!items.length) throw new CommerceError("unavailable");
  return commerceClinicsSchema.parse({ items }).items;
}

export async function readCommerceClinics(context: DatabaseContext) {
  return transaction(context.client, async () => ({
    items: await loadCommerceClinicsInTransaction(context),
  }));
}

/** Used inside the authoritative staff transaction; no inferred UUID equality. */
export async function commerceLocationForClinic(
  context: DatabaseContext,
  clinicId: string,
): Promise<string> {
  const clinic = (await loadCommerceClinicsInTransaction(context)).find(
    (item) => item.clinicId === clinicId,
  );
  if (!clinic) throw new CommerceError("denied");
  return clinic.locationId;
}
