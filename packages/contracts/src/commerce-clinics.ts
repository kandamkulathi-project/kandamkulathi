import { z } from "zod";
import { commerceActionSchema } from "./commerce-access";
import { canonicalUuidSchema } from "./identifiers";

export const commerceClinicSchema = z.strictObject({
  clinicId: canonicalUuidSchema,
  locationId: canonicalUuidSchema,
  name: z.string().trim().min(1).max(200),
});
export const commerceClinicsSchema = z.strictObject({
  items: z.array(commerceClinicSchema).max(100),
});
export const commerceStaffClinicsSchema = z.strictObject({
  items: z
    .array(commerceClinicSchema.extend({ actions: z.array(commerceActionSchema).min(1).max(4) }))
    .max(100),
});
