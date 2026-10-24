# Denzil Phase 1 bounded lane — integration handoff

Supports KAN-63–68 and P1-DEN-001–004/080/090. **Candidate only; independent UI/domain review, real API integration, approved company inputs and G1 remain Pending.** Base: Mathew backlog foundation `3825c00`, whose reviewed contracts are a prerequisite, not an approval granted by this lane.

## Ownership and integration

- Denzil: scoped staff/content components, synthetic dry-run support, draft nonclinical resources, readiness records and guides.
- Devadathan/coordinator: root workspace route registration, shared session/transport/native boundaries, package export integration and incumbent shared design.
- Josin: authoritative catalogue/import validation and writes, opening balances, staff order/batch APIs and commerce permissions.
- Mathew: current identity/clinic/physician authority, doctor schedules and knowledge persistence/approval/source verification.
- Company reviewers: exact medical content/translations, financial rules, role matrix, message wording, listing assets and approval evidence.

No root application/router/index, lockfile, original user configuration or raw-data file is modified by this lane. No live provider call, push, PR, shared merge, deployment or actual opening import is authorized by these modules.

## Consumer contract

Embed bounded modules inside the current authenticated shell; do not create a parallel login or local role selector. A workspace navigation grant is not a grant to approve content or read an arbitrary clinic. Server adapters must derive and revalidate current organization/MFA, clinic and record scope. Omit any missing adapter so the component shows pending/unavailable, never synthetic business data.

The commerce owner's handoff specifies scoped `GET /v1/staff/clinics/:clinicId/orders` and `/batches`, `limit`/`after` pagination and `{items,nextCursor}` projections. Do not wire a presentation-fixture envelope directly to those routes. Use the owner's reviewed contract decoder and explicit field-minimized mapping. No staff doctor-schedule endpoint or knowledge-authoring persistence endpoint is assumed. A published public directory is not a private staff schedule API.

Commerce read routes (including `/orders/:id`) are implemented in the owner's `apps/core-api/src/commerce.ts` registration module, but remain unavailable until actual database wiring and composition enable them. Parse `commerceOrderPageSchema` / `commerceBatchPageSchema` from the integrated shared `commerce-orders.ts`; do not reproduce those schemas locally. Responses supply IDs, not clinic/product names or a human order reference. Display the actual `locationId`, `skuId` and `orderId`, or use an independently approved directory mapping; never manufacture labels. Batch `onHand`, `reserved` and `recalled` must remain distinct: no invented availability/status or financial interpretation. The initial generic batch presentation is not yet a lossless production batch integration.

The subsequent staff commerce delta supplies `createCommerceStaffReader({origin, local, clinicId}, transport?)`, exported from `staff/index.ts`. It parses the canonical shared DTOs before projection, preserves separate on-hand/reserved/recalled columns and every order summary field, displays actual IDs, and does not infer availability. Mount it through the unchanged `StaffReadViews` props, memoized by origin/environment/clinic, with no `statuses` override. It uses the inspected clinic-scoped routes above; no `/v1/staff/orders` alias is assumed. Its canonical contract dependencies must be integrated through Josin's lane, not duplicated from Denzil's local prerequisite copies. This supersedes the generic presentation limitation for the supplied real reader, not the pending real database/authorization/end-to-end production acceptance obligations.

The owner's opening import is strict `{operationId, rows, controls}`, where rows use shared `openingRowSchema` and controls are `{rows, units, baseValuePaise}`. Its route is `POST /v1/staff/clinics/:clinicId/catalogue/import`; row errors must be shown, not silently corrected. Denzil's `syn-*` local dry-run/control fixture is deliberately separate, is not this request DTO, and cannot establish import acceptance. Approved company controls remain absent pending finance/warehouse review. No write adapter is enabled here.

- `apps/workspaces/src/staff/index.ts` exports `StaffReadViews` and `createStaffReader`. Component props: shared `session: Resource<ClientSession>`, optional `reader`, optional per-kind `statuses`, and `locale` (defaults to `en`). The reader accepts `(kind, {cursor, limit, status}, AbortSignal)` and returns `Resource<StaffPage>`. Transport requires an explicit owner decoder for each enabled kind; its default query cursor is `after`. Omit `statuses` for commerce routes that do not support status filtering. No schedule URL is supplied by default.
- `apps/workspaces/src/content/ContentEditor.tsx` exports `ContentEditor`; props are `locale`, `session: Resource<unknown>`, optional `readRecord(AbortSignal): Promise<Resource<unknown>>`, and optional `authoring: ContentAuthoringPort`. A ready read contains one shared-schema `KnowledgeRecord` or `null` for empty. The authoring delta adds explicit `readSource`/mandatory backend-owner `decodeSource`, `submit(command, signal)` returning `{httpStatus, body}`, and optional reviewed immutable `sourceUploads`. The codec must establish current actor/record/scope/permission/expiry from the actual authoritative integration, never workspace roles or a fabricated capability endpoint. The UI independently validates those bindings, rechecks before dispatch, validates the exact persisted transition and requires a matching current reload before showing success. The frozen mutation API is bearer-only and rejects cookies; no default browser transport or fake CSRF token is supplied. Omit the port until the actual reviewed codec/transport exists. See [content integration](DENZIL_CONTENT.md) for uncertainty, cancellation and concurrency behavior.

All test fixtures are synthetic protocol data. Local draft editing, a parsed supplied approval record and successful read-only fixture rendering are not saved, approved or published business operations. Approval/withdrawal must remain disabled until the actual reviewed, persisted and audited server lifecycle is integrated; editor and physician approver remain distinct canonical identities.

## Resources and operating inputs

- New resource scope: `packages/i18n/src/staff-content.ts` (`staffContent`) and `packages/i18n/src/staff-read.ts` (`staffReadLabels`), with exact matching EN/ML/TA keys. Draft/unreviewed nonclinical KB/staff interface labels only; existing foundation/customer strings remain untouched. Server-supplied business labels and exact source content are not translated by these modules.
- [Template/store readiness](../operations/DENZIL_P1_READINESS.md): all missing copy, provider receipts, store identifiers and clinical/company approvals explicitly Pending.
- [Role guides](DENZIL_ROLE_GUIDES.md): match the actual shell and bounded module behavior; no recorded training or company acceptance claimed.

## Verification and release boundary

Run the repository's full `pnpm verify`, browser/Worker `pnpm test:e2e`, applicable security/mobile/real-PostgreSQL gate and Python checks against the integrated exact candidate. Serialize builds/verify/browser/platform/precommit with the coordinator lock. Do not bypass failed checks, suppress advisories or commit until required checks pass. Screenshot evidence of fixture pages must be labeled as such and exclude private information.

Company/public-store/device/provider proof, real opening-import acceptance, complete approved content coverage, measured edit/withdrawal freshness, independent clinical/financial/security reviews and the canonical G1 campaign remain separate outstanding acceptance obligations. Preserve every company requirement and record the owner of each blocker rather than relabeling it completed.
