import { z } from "zod";
export const apiVersion = "v1" as const;
export const serviceSchema = z.enum(["core-api", "companion"]);
export type Service = z.infer<typeof serviceSchema>;
export const healthSchema = z.object({
  service: serviceSchema,
  status: z.literal("alive"),
  stage: z.literal("scaffold"),
});
export const errorSchema = z.object({
  error: z.object({
    code: z.enum([
      "NOT_FOUND",
      "FEATURE_UNAVAILABLE",
      "APPLICATION_NOT_READY",
      "INTERNAL_ERROR",
      "PAYLOAD_TOO_LARGE",
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "IDENTITY_UNAVAILABLE",
      "CONFIGURATION_INVALID",
    ]),
    message: z.string(),
    requestId: z.string().uuid(),
  }),
});
export type ApiError = z.infer<typeof errorSchema>;
export const moneyPaiseSchema = z.number().int().safe().nonnegative();
export const quantitySchema = z.number().int().safe().positive();
export const capabilityNames = ["identity", "commerce", "consultations", "companion"] as const;
export const systemStatusSchema = z.object({
  apiVersion: z.literal(apiVersion),
  service: serviceSchema,
  stage: z.literal("scaffold"),
  ready: z.literal(false),
  capabilities: z.record(z.enum(capabilityNames), z.literal("pending")),
});
