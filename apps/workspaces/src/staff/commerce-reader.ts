import { commercePageSchema } from "../../../../packages/contracts/src/commerce-access.ts";
import {
  commerceBatchPageSchema,
  commerceOrderPageSchema,
} from "../../../../packages/contracts/src/commerce-orders.ts";
import { canonicalUuidSchema } from "../../../../packages/contracts/src/identifiers.ts";
import { createStaffReader, parseStaffQuery, type StaffReader } from "./read-model";

/** Real DTO adapter; canonical contract files/exports remain commerce-owner prerequisites.
 * The clinic UUID is a routing hint, never a grant. Server current org/MFA/action/clinic
 * authorization remains mandatory. No stock arithmetic or schedule endpoint is invented.
 */
export function createCommerceStaffReader(
  config: {
    origin: string;
    local: boolean;
    clinicId: string;
    /** Explicit approved directory association; never infer locationId from clinicId. */
    locationId?: string;
    /** Presentation only, never authorization evidence. */
    clinicName?: string;
  },
  transport: typeof fetch = fetch,
): StaffReader {
  return async (kind, input, signal) => {
    try {
      if (config.locationId === undefined) return { status: "unavailable" };
      const clinicId = canonicalUuidSchema.parse(config.clinicId);
      const locationId = canonicalUuidSchema.parse(config.locationId);
      const clinicName = config.clinicName;
      if (
        clinicName !== undefined &&
        (typeof clinicName !== "string" ||
          !clinicName.trim() ||
          clinicName.length > 160 ||
          Array.from(clinicName).some(
            (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
          ))
      )
        return { status: "error" };
      const clinicLabel = clinicName ?? locationId;
      const query = parseStaffQuery(input, []);
      const pagination = commercePageSchema.parse({
        limit: query.limit,
        ...(query.cursor === null ? {} : { after: canonicalUuidSchema.parse(query.cursor) }),
      });
      const reader = createStaffReader(
        {
          origin: config.origin,
          local: config.local,
          endpoints: {
            orders: `/v1/staff/clinics/${clinicId}/orders`,
            batches: `/v1/staff/clinics/${clinicId}/batches`,
          },
          decoders: {
            orders: (input) => {
              const page = commerceOrderPageSchema.parse(input);
              return {
                version: 1,
                nextCursor: page.nextCursor,
                rows: page.items.map((order) => {
                  if (order.locationId !== locationId)
                    throw new Error("Unexpected location projection");
                  return {
                    id: order.orderId,
                    reference: order.orderId,
                    clinicLabel,
                    status: order.status,
                    totalPaise: order.amountPaise,
                    metadata: {
                      locationId: order.locationId,
                      currency: order.currency,
                      version: order.version,
                      source: order.source,
                      createdAt: order.createdAt,
                      expiresAt: order.expiresAt,
                    },
                  };
                }),
              };
            },
            batches: (input) => {
              const page = commerceBatchPageSchema.parse(input);
              return {
                version: 1,
                nextCursor: page.nextCursor,
                rows: page.items.map((batch) => {
                  if (batch.locationId !== locationId)
                    throw new Error("Unexpected location projection");
                  return {
                    id: batch.batchId,
                    clinicLabel,
                    locationId: batch.locationId,
                    productLabel: batch.skuId,
                    skuId: batch.skuId,
                    batchCode: batch.batchCode,
                    expiresOn: batch.expiresOn,
                    onHand: batch.onHand,
                    reserved: batch.reserved,
                    recalled: batch.recalled,
                  };
                }),
              };
            },
          },
        },
        transport,
      );
      return await reader(
        kind,
        { cursor: pagination.after ?? null, limit: pagination.limit, status: "" },
        signal,
      );
    } catch {
      return { status: "error" };
    }
  };
}
