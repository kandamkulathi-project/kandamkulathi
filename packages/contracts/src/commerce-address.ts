import { z } from "zod";

/** Delivery collection only. A valid postal code is NOT proof of serviceability or tax eligibility. */
export const deliveryAddressSchema = z.strictObject({
  recipientName: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100),
  postalCode: z.string().regex(/^[1-9][0-9]{5}$/),
  country: z.literal("IN"),
  contactPhone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
});
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;
