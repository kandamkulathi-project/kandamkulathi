import { z } from "zod";

// Proposed integration contract: only the verified server can issue these grants.
export const workspaceNames = ["customer", "staff", "physician", "support"] as const;
export const workspaceSchema = z.enum(workspaceNames);
export type Workspace = z.infer<typeof workspaceSchema>;
export const sessionSchema = z
  .object({
    userId: z.string().uuid(),
    expiresAt: z.iso.datetime(),
    workspaces: z.array(workspaceSchema).max(4),
  })
  .strict();
export type ClientSession = z.infer<typeof sessionSchema>;
export const notificationTargetSchema = z
  .object({
    version: z.literal(1),
    kind: z.enum(["order", "appointment", "companion"]),
    reference: z.string().uuid(),
  })
  .strict();
export type NotificationTarget = z.infer<typeof notificationTargetSchema>;
export const citedReplySchema = z
  .object({
    text: z.string().min(1).max(16000),
    citations: z
      .array(
        z
          .object({
            entryId: z.string().uuid(),
            revision: z.number().int().positive(),
            title: z.string().min(1).max(200),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
