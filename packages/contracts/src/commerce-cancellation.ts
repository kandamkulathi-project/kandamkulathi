import { z } from "zod";
import { canonicalUuidSchema } from "./identifiers.ts";

export const commerceCancellationRequestSchema = z
  .object({
    operationId: canonicalUuidSchema,
    expectedVersion: z.number().int().positive(),
    confirmed: z.literal(true),
  })
  .strict();
export type CommerceCancellationRequest = z.infer<typeof commerceCancellationRequestSchema>;
export const commerceCancellationResultSchema = z
  .object({
    orderId: canonicalUuidSchema,
    operationId: canonicalUuidSchema,
    status: z.literal("cancelled"),
    version: z.number().int().positive(),
    refund: z.literal("not_applicable"),
  })
  .strict();
export type CommerceCancellationResult = z.infer<typeof commerceCancellationResultSchema>;
