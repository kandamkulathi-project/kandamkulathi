import { z } from "zod";

// Proposed P1-DEV-004 contracts; approval/identity/tool enforcement belongs to the backend.
export const localeSchema = z.enum(["en", "ml", "ta"]);
const id = z.string().uuid();
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export function publicSourceUrl(value: string): string | null {
  try {
    if (
      /[\s\\]/u.test(value) ||
      Array.from(value).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    )
      return null;
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.port ||
      !url.hostname.includes(".") ||
      /(^|\.)(localhost|local|internal|invalid|test|example)$/.test(url.hostname) ||
      /^[\d.]+$/.test(url.hostname) ||
      url.hostname.includes(":")
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export const documentSchema = z
  .object({
    locale: localeSchema,
    kind: z.enum(["medical", "nonclinical"]),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(6000),
    sourceUrl: z
      .string()
      .max(1000)
      .refine((value) => publicSourceUrl(value) !== null),
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    productIds: z.array(id).max(30),
    concernIds: z.array(id).max(30),
    safety: z
      .object({
        warnings: z.string().max(1500),
        redFlags: z.string().max(1500),
        consultOnly: z.string().max(1500),
        disclaimer: z.string().max(1500),
      })
      .strict(),
  })
  .strict();
export type KnowledgeDocument = z.infer<typeof documentSchema>;
export const draftSchema = z
  .object({
    id,
    revision: version,
    authorId: id,
    state: z.enum(["draft", "in_review", "approved", "withdrawn"]),
    document: documentSchema,
    permissions: z
      .object({ edit: z.boolean(), approve: z.boolean(), withdraw: z.boolean() })
      .strict(),
  })
  .strict();
export type KnowledgeDraft = z.infer<typeof draftSchema>;
export const saveDraftSchema = z
  .object({
    id: id.nullable(),
    expectedRevision: version.nullable(),
    document: documentSchema,
  })
  .strict()
  .refine(
    (value) => (value.id === null) === (value.expectedRevision === null),
    "Revision required for an existing draft",
  );
export const approvedEntrySchema = z
  .object({
    id,
    revision: version,
    state: z.enum(["approved", "withdrawn", "draft"]),
    document: documentSchema,
    approvedBy: z
      .object({ id, displayName: z.string().trim().min(1).max(160) })
      .strict()
      .nullable(),
    reviewUntil: z.iso.datetime(),
  })
  .strict();
export type ApprovedEntry = z.infer<typeof approvedEntrySchema>;
export const replySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("answer"),
      id,
      locale: localeSchema,
      references: z
        .array(z.object({ id, revision: version }).strict())
        .min(1)
        .max(5),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["handoff_required", "intake_required", "action_required", "unavailable"]),
      id,
      locale: localeSchema,
    })
    .strict(),
]);
export type KnowledgeReply = z.infer<typeof replySchema>;
export const chatInputSchema = z
  .object({ operationId: id, message: z.string().trim().min(1).max(4000), locale: localeSchema })
  .strict();
export const handoffSchema = z.object({ id, status: z.literal("queued") }).strict();
export type Handoff = z.infer<typeof handoffSchema>;
export const transcriptSchema = z
  .object({
    id,
    locale: localeSchema,
    text: z.string().min(1).max(4000),
    needsReview: z.literal(true),
  })
  .strict();

export function reviewReady(document: KnowledgeDocument) {
  return (
    document.kind !== "medical" ||
    Object.values(document.safety).every((value) => value.trim().length > 0)
  );
}
