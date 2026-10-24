import { z } from "zod";
import { whatsappNumericIdSchema } from "./channels.ts";
import { canonicalUuidSchema } from "./identifiers.ts";

/** Administrative, server-only capability. No default template or inferred chat consent. */
export const noticeCapabilitySchema = z
  .object({
    id: canonicalUuidSchema,
    revision: z.number().int().positive(),
    purpose: z.literal("test_notice"),
    businessAccountId: whatsappNumericIdSchema,
    phoneNumberId: whatsappNumericIdSchema,
    recipientId: whatsappNumericIdSchema,
    templateName: z.string().regex(/^[a-z0-9_]{1,128}$/),
    language: z.string().regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/),
    approvalRef: z.string().min(1).max(256),
    consentRef: z.string().min(1).max(256),
    policyVersion: z.string().min(1).max(128),
    expiresAt: z.string().datetime(),
    notBefore: z.string().datetime(),
    maxEventAgeSeconds: z.number().int().positive().max(86400),
    maxNotices: z.number().int().positive(),
    used: z.number().int().nonnegative(),
    enabled: z.boolean(),
  })
  .strict();
export type NoticeCapability = z.infer<typeof noticeCapabilitySchema>;

export type NoticeSubmission = Readonly<{
  operationId: string;
  recipientId: string;
  phoneNumberId: string;
  templateName: string;
  language: string;
}>;
export type NoticeResult =
  | Readonly<{ state: "accepted"; providerMessageId: string }>
  | Readonly<{ state: "rejected" }>
  | Readonly<{ state: "unknown" }>;
export interface NoticeProvider {
  /** WhatsApp does not guarantee send idempotency. Never retry an uncertain submission. */
  send(input: NoticeSubmission, signal: AbortSignal): Promise<NoticeResult>;
}
