import { z } from "zod";
import { canonicalUuidSchema } from "./identifiers";

export const knowledgeLanguages = ["en", "ml", "ta"] as const;
export const knowledgeLanguageSchema = z.enum(knowledgeLanguages);
export const knowledgeKinds = [
  "monograph",
  "dosage",
  "contraindication",
  "safety",
  "physician-profile",
  "department",
  "treatment",
  "faq",
  "policy",
  "reference",
] as const;
export const mandatorySafetyKinds = ["dosage", "contraindication", "safety"] as const;
export const productKnowledgeKinds = ["monograph", ...mandatorySafetyKinds] as const;
export const knowledgeHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
/** Normalize UUID identity before hashing, authorization comparisons and repository/fence calls. */
export const knowledgeIdSchema = canonicalUuidSchema;
const id = knowledgeIdSchema;
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
/** Verified authority output is still validated before identity comparison or persistence. */
export const knowledgeAuthorityActorSchema = z.strictObject({
  actorId: id,
  displayName: z.string().min(1).max(200),
  authorityVersion: revision,
  evidenceId: id,
});
export type KnowledgeAuthorityActor = z.infer<typeof knowledgeAuthorityActorSchema>;
const publicUrl = z.url().refine((value) => {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // Publication allowlist syntax only, NOT DNS validation or permission to fetch.
  // Exclude all IP literals and non-public/single-label names, including numeric
  // forms normalized to IPv4 by URL. Fetchers additionally need DNS/redirect guards.
  const publicHost =
    host.includes(".") &&
    !host.includes(":") &&
    !/^\d+(\.\d+)*$/.test(host) &&
    !/(^|\.)(localhost|local|internal|onion|home|lan|arpa)$/.test(host);
  return (
    url.protocol === "https:" &&
    publicHost &&
    !url.port &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  );
}, "Expected a public HTTPS source URL without credentials, query or fragment");

export const knowledgeReferenceSchema = z.strictObject({
  entryId: id,
  revision,
  contentHash: knowledgeHashSchema,
});
export type KnowledgeReference = z.infer<typeof knowledgeReferenceSchema>;
export const knowledgeCandidateSchema = knowledgeReferenceSchema
  .extend({
    origin: z.enum(["exact", "alias", "keyword", "vector"]),
  })
  .strict();
export const knowledgeSourceSchema = z.strictObject({
  sourceId: id,
  revision,
  sha256: knowledgeHashSchema,
  visibility: z.literal("public"),
  publicUrl,
});
const citationSchema = z.strictObject({
  sourceId: id,
  title: z.string().min(1).max(200),
  publicUrl,
});
export const knowledgeContentSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    entryId: id,
    revision,
    previousContentHash: knowledgeHashSchema.nullable(),
    visibility: z.literal("public"),
    scope: z.enum(["catalogue", "institution"]),
    productId: id.nullable(),
    language: knowledgeLanguageSchema,
    kind: z.enum(knowledgeKinds),
    title: z.string().min(1).max(200),
    text: z.string().min(1).max(16000),
    editorId: id,
    sources: z.array(knowledgeSourceSchema).min(1).max(20),
    citations: z.array(citationSchema).min(1).max(20),
  })
  .superRefine((value, context) => {
    const productKind = (productKnowledgeKinds as readonly string[]).includes(value.kind);
    if (productKind !== (value.productId !== null) || productKind !== (value.scope === "catalogue"))
      context.addIssue({ code: "custom", message: "Knowledge kind, scope and product must agree" });
    if ((value.revision === 1) !== (value.previousContentHash === null))
      context.addIssue({ code: "custom", message: "Revision history must be explicit" });
    if (new Set(value.sources.map((source) => source.sourceId)).size !== value.sources.length)
      context.addIssue({ code: "custom", message: "Duplicate sources" });
    for (const citation of value.citations) {
      if (
        !value.sources.some(
          (source) =>
            source.sourceId === citation.sourceId && source.publicUrl === citation.publicUrl,
        )
      )
        context.addIssue({
          code: "custom",
          message: "Citation must identify an exact public source",
        });
    }
  });
export type KnowledgeContent = z.infer<typeof knowledgeContentSchema>;
export const knowledgeApprovalSchema = z.strictObject({
  approverId: id,
  approverDisplayName: z.string().min(1).max(200),
  authorityVersion: revision,
  evidenceId: id,
  approvedAt: z.iso.datetime(),
  contentHash: knowledgeHashSchema,
});
export type KnowledgeApproval = z.infer<typeof knowledgeApprovalSchema>;
const sealedContent = z.strictObject({
  content: knowledgeContentSchema,
  contentHash: knowledgeHashSchema,
});
export const knowledgeRecordSchema = z
  .discriminatedUnion("state", [
    sealedContent.extend({ state: z.literal("draft") }),
    sealedContent.extend({ state: z.literal("approved"), approval: knowledgeApprovalSchema }),
    sealedContent.extend({
      state: z.literal("withdrawn"),
      approval: knowledgeApprovalSchema,
      withdrawal: z.strictObject({ actorId: id, withdrawnAt: z.iso.datetime(), evidenceId: id }),
    }),
  ])
  .superRefine((record, context) => {
    if (
      record.state !== "draft" &&
      (record.approval.contentHash !== record.contentHash ||
        record.approval.approverId === record.content.editorId)
    )
      context.addIssue({
        code: "custom",
        message: "Approval must bind the content and a separate approver",
      });
    if (
      record.state === "withdrawn" &&
      Date.parse(record.withdrawal.withdrawnAt) < Date.parse(record.approval.approvedAt)
    )
      context.addIssue({ code: "custom", message: "Withdrawal cannot precede approval" });
  });
export type KnowledgeRecord = z.infer<typeof knowledgeRecordSchema>;
export type ApprovedKnowledge = Extract<KnowledgeRecord, { state: "approved" }>;

const coverageSlots = z.strictObject({
  monograph: knowledgeReferenceSchema.optional(),
  dosage: knowledgeReferenceSchema.optional(),
  contraindication: knowledgeReferenceSchema.optional(),
  safety: knowledgeReferenceSchema.optional(),
});
export const knowledgeProductSchema = z.strictObject({
  schemaVersion: z.literal(1),
  productId: id,
  revision,
  published: z.boolean(),
  knowledge: z.strictObject({ en: coverageSlots, ml: coverageSlots, ta: coverageSlots }),
});
export type KnowledgeProduct = z.infer<typeof knowledgeProductSchema>;
export const publicKnowledgeRequestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  mode: z.literal("public-product"),
  productId: id,
  language: knowledgeLanguageSchema,
  candidates: z.array(knowledgeCandidateSchema).min(1).max(20),
});
export type PublicKnowledgeRequest = z.infer<typeof publicKnowledgeRequestSchema>;
export type KnowledgeLanguage = z.infer<typeof knowledgeLanguageSchema>;

export const knowledgeBlockedReasons = [
  "INVALID_REQUEST",
  "PERSONALIZED_POLICY_UNAVAILABLE",
  "PRODUCT_UNAVAILABLE",
  "MISSING_PRIMARY",
  "NOT_APPROVED",
  "STALE_REFERENCE",
  "SCOPE_MISMATCH",
  "INVALID_PROVENANCE",
  "APPROVER_UNAUTHORIZED",
  "SAFETY_BLOCKS_UNAVAILABLE",
  "CURRENT_STATE_CHANGED",
] as const;
export type KnowledgeBlockedReason = (typeof knowledgeBlockedReasons)[number];
export type KnowledgeFailure =
  | { readonly status: "blocked"; readonly reason: KnowledgeBlockedReason }
  | {
      readonly status: "not-ready";
      readonly reason: "PRIMARY_UNAVAILABLE" | "AUTHORITY_UNAVAILABLE" | "NOT_CONFIGURED";
    };

export type ApprovedKnowledgeBlock = Readonly<{
  reference: Readonly<KnowledgeReference>;
  kind: KnowledgeContent["kind"];
  language: KnowledgeLanguage;
  title: string;
  text: string;
  citations: readonly Readonly<KnowledgeContent["citations"][number]>[];
  approval: Readonly<
    Pick<KnowledgeApproval, "approverId" | "approverDisplayName" | "approvedAt" | "contentHash">
  >;
}>;
export type PublicKnowledgeResult =
  | KnowledgeFailure
  | Readonly<{
      status: "ready";
      schemaVersion: 1;
      productId: string;
      productRevision: number;
      language: KnowledgeLanguage;
      blocks: readonly ApprovedKnowledgeBlock[];
    }>;

/** Display DTO validation does not replace primary-record approval/authority checks. */
export const approvedKnowledgeBlockSchema = z
  .strictObject({
    reference: knowledgeReferenceSchema,
    kind: z.enum(knowledgeKinds),
    language: knowledgeLanguageSchema,
    title: z.string().min(1).max(200),
    text: z.string().min(1).max(16000),
    citations: z.array(citationSchema).min(1).max(20),
    approval: knowledgeApprovalSchema.pick({
      approverId: true,
      approverDisplayName: true,
      approvedAt: true,
      contentHash: true,
    }),
  })
  .superRefine((block, context) => {
    if (block.reference.contentHash !== block.approval.contentHash)
      context.addIssue({
        code: "custom",
        message: "Approval must bind the exact cited content reference",
      });
  });

export const publicKnowledgeResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("blocked"), reason: z.enum(knowledgeBlockedReasons) }),
  z.strictObject({
    status: z.literal("not-ready"),
    reason: z.enum(["PRIMARY_UNAVAILABLE", "AUTHORITY_UNAVAILABLE", "NOT_CONFIGURED"]),
  }),
  z
    .strictObject({
      status: z.literal("ready"),
      schemaVersion: z.literal(1),
      productId: knowledgeIdSchema,
      productRevision: revision,
      language: knowledgeLanguageSchema,
      blocks: z.array(approvedKnowledgeBlockSchema).length(productKnowledgeKinds.length),
    })
    .superRefine((result, context) => {
      if (
        result.blocks.some((block) => block.language !== result.language) ||
        new Set(result.blocks.map((block) => block.reference.entryId)).size !==
          result.blocks.length ||
        productKnowledgeKinds.some(
          (kind) => result.blocks.filter((block) => block.kind === kind).length !== 1,
        )
      )
        context.addIssue({
          code: "custom",
          message:
            "Public product result must preserve one distinct current-language monograph and each mandatory safety kind",
        });
    }),
]);
