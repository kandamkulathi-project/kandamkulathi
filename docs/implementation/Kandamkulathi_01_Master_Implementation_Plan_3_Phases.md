# Kandamkulathi Digital Commerce & Companion

> **Named team allocation update — 19 October 2026:** The six individual plans numbered 05–10 now govern named ownership, branches and person-hour allocation. Mathew owns backend/AI and critical domain review; Devadathan owns frontend/mobile/platform/release; Josin owns commerce with Mathew’s review; Paul and Denzil own bounded support/UI/content work; Tinu leads QA with no critical product feature assignment. Original E1–E6 IDs below remain technical scope references, not a direct mapping to these people. The previous per-E-role ownership/hour/day grids are superseded by the named plans. All R01–R38 acceptance criteria, phase outputs, 10-day window, protected test gates and overall phase hour/category totals remain unchanged. See [the named team plans](Kandamkulathi_05_Mathew_All_Phases.md) and [Tinu’s standalone detailed test cases](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md).

## Document 01 — Master Implementation Plan: Three Phases, Ten Working Days

| Document control | Baseline |
|---|---|
| Document ID / version | KND-IMP-001 / 1.1 — integrated consistency review |
| Prepared on | 19 October 2026 |
| Audience | Company product/clinical/operations owners and the six-person engineering team |
| Delivery window | Ten working days: 19–30 October 2026 |
| Phases | Phase 1: Days 1–3; Phase 2: Days 4–6; Phase 3: Days 7–10 |
| Company scope | All requirements R01–R38; no reduced-scope launch |
| Architecture | Cloudflare Workers Paid + Neon PostgreSQL; full stack and environment policy in Section 3 |
| Development database | PostgreSQL from the beginning; Neon Free while suitable, with a paid production-equivalent environment before final verification |
| Team | Six full-time engineers; 60 person-days total, including testing, fixes and release |
| Initial operating audience | Approximately 1,000 daily active users; test the stated peak-load and 3,000-user planning envelope |
| Quality policy | Broad cumulative testing after every phase; no unresolved release blockers at a passing gate |
| Status | Implementation baseline. All phase results and approvals are initially pending; no completed app or passed tests are claimed. |

This master document replaces the earlier daily execution structure with three controlled phases. It retains the agreed architecture, company requirements and six-person team, and incorporates the low-cost development approach agreed afterward. The current numbered phase/member/test documents contain the exact work packages, named assignments and test execution; the registry in section 18 defines their authority.

## 1. Delivery mandate and definition of success

Deliver a company-operated commerce and clinical Companion system covering public web, Android, iOS, WhatsApp, customer accounts, staff/physician workspaces and production operations. Every R01–R38 requirement remains required for full release, including subscriptions, multiclinic inventory, video consultations, wholesale, loyalty/referrals, multilingual clinical safety, reporting and training.

The ten-day window means **ten working days**, consistent with the previous two-week target. Weekends on 24–25 October provide no assumed development capacity. Any launch support after 30 October is operational support, not an extension for unfinished scope. Readiness work takes place inside Day 1; there is no hidden preparation week or extra engineering team.

Success requires all of the following:

1. The complete required customer experience works across web and both publicly available native apps; the clinic WhatsApp channel and staff/physician workspaces operate correctly.
2. Financial, inventory, appointment, consent and access invariants survive concurrent requests, retries and external-provider failures.
3. English, Malayalam and Tamil interfaces/content are reviewed; additional conversational languages follow the approved safety/fallback policy.
4. Gate G1, Gate G2 and Gate G3 have evidence against identified builds, with cumulative regression and all release-blocking issues resolved.
5. Company clinical, finance, operations and product reviewers accept their workflows; recorded training, ownership, recovery and support are handed over.
6. Real operating costs, provider eligibility and external approvals match the release configuration. A pending store review is an unfinished public-release requirement.

**Quality statement:** Testing can discover defects and provide evidence of readiness; it cannot prove that every possible bug or vulnerability is absent. The release standard is zero unresolved critical/high security findings, zero unresolved safety/privacy/financial/core-workflow blockers, documented coverage and reviewed residual low-impact issues. No report may label the app “bug-free” solely because a scanner or test suite passed.

**Feasibility condition:** This is an aggressive full-scope target, conditional on audited reusable commerce modules, native payment/video foundations, ready company data and daily reviewers. Their availability is not established by this plan. Six engineers cannot credibly guarantee this complete system from an empty repository in ten days while preserving the testing below. Validate the remaining effort on Day 1; if it does not fit, preserve the scope and publish the revised forecast. Failed gates consume the schedule; they do not authorize weaker testing.

## 2. Scope authority and requirement traceability

The scope comes from Kandamkulathi Ecommerce Proposal.pdf, pages 3–8, and Kandamkulathi Companion Proposal.pdf, pages 3–9, carried through the accepted Workers + Neon implementation plan. E/C page references in the matrix retain that provenance. Company reviewers validate operational policies, claims, opening data and provider eligibility before acceptance.

Historical patient/order migration remains excluded by the proposals. Opening catalogue, stock/batch balances, doctors, clinics, schedules, prices and approved knowledge imports are included. Brand/clinical/legal/tax assertions require company review. Staff and physician functions are web workspaces; the native apps contain the full customer scope. WhatsApp uses secure checkout/video links where those actions cannot execute inside the chat itself.

The matrix below preserves the prior company requirement descriptions and acceptance evidence. Workstream accountability is shown to support coordination; exact individual task splitting belongs in the later phase/member documents. “P2” means working, integrated and tested capability by the end of Phase 2. Final company acceptance, external approvals, public availability and operating proof occur in Phase 3. R37 and the final operating proof for R38 are delivered in Phase 3.

| ID | Company requirement / source | Required acceptance evidence | Accountable workstream | Readiness milestone |
|---|---|---|---|---|
| R01 | Catalogue and shop by health concern; E4-5, C4 | All current-site products imported with variants, approved descriptions, images, prices, concern filters and stock visibility. Brand/certification claims approved by the clinic. | Josin | P2 functional; P3 company acceptance |
| R02 | Cart and Indian checkout; E3-4, C4 | Web and native purchase through enabled UPI/card/net-banking/eligible EMI methods; COD rules enforced server-side; totals cannot be altered by clients. | Josin | P2 functional; P3 company acceptance |
| R03 | Accounts, addresses, history, reorder, tracking; E3, C4 | Verified user sees only their orders/invoices; repeat order uses current price, eligibility and available stock; tracking updates visible. | Mathew + Josin | P2 functional; P3 company acceptance |
| R04 | Unified order desk including phone/walk-in/WhatsApp; E6, C6 | Staff create and fulfill an order with a recorded source; WhatsApp checkout produces the same order record; packing lists and cancellation/return/refund states are usable. | Josin | P2 functional; P3 company acceptance |
| R05 | Batch/expiry, low stock and near-expiry operations; E6, C6 | Batch ledger, expiry/shelf-life exclusion, FEFO allocation, low-stock alerts, adjustments and a recall lookup from batch to customers. Concurrent last-unit test passes. | Josin | P2 functional; P3 company acceptance |
| R06 | Courier and pan-India fulfillment; E6-7 | Pincode serviceability, rates, courier label, pickup, tracking and COD reconciliation tested with the selected courier. Unserviceable addresses cannot check out. | Josin | P2 functional; P3 company acceptance |
| R07 | GST invoices, reconciliation and accounts export; E3, E6, C6 | Finance-approved CGST/SGST/IGST cases, numbering, PDF/translated display labels, refund credit-note process and monthly CSV export; a live charge/refund is reconciled. Issued invoices are automatically delivered through an approved private transactional link/document and delivery is reconciled, not merely generated. | Josin | P2 functional; P3 company acceptance |
| R08 | Automated WhatsApp/SMS order updates; E3-4 | Confirmation, dispatch, out-for-delivery and delivery messages use real events/tracking links, approved templates and deduplication. Transactional invoice-ready delivery follows the finance-approved issuance milestone with receipt/retry/ownership evidence. | Mathew | P2 functional; P3 company acceptance |
| R09 | Recurring subscriptions; E4, E7, C4 | Authorize a real eligible mandate; cycle billing, exactly one renewal order, payment failure, pause/resume/cancel and stock-shortage handling verified. An accelerated sandbox renewal exercises the full cycle. | Josin | P2 functional; P3 company acceptance |
| R10 | Refill and daily medicine schedules; E4, C4 | Physician-authored dose, morning/evening and before/after-food instructions drive timezone-aware reminders; refill quantity/due date uses the approved schedule or confirmed customer interval; edits/cancellation stop stale reminders. | Mathew | P2 functional; P3 company acceptance |
| R11 | Physician directory, locations, slots, leave and fees; C4, C6 | Staff configure departments, credentials, languages, per-location hours, online/in-clinic slots, leave and default/per-doctor fees. Cross-location double booking is prevented. Authorized front desk can create source/actor-audited in-clinic outpatient bookings through the same doctor-global booking service; doctor qualifications/photo, slot length and online/in-clinic/both settings are included. | Mathew | P2 functional; P3 company acceptance |
| R12 | Booking, fee payment, reschedule/cancel/refund; E4, C4 | One slot cannot be sold twice; holds expire; late payment is reconciled; notifications and policy-based refunds work. Staff-created outpatient appointments obey the same interval, fee, hold/payment, cancellation and refund invariants as customer bookings. | Mathew + Josin | P2 functional; P3 company acceptance |
| R13 | Embedded video consultations; C4 | Patient and assigned doctor join a private call inside web/native apps; permissions, poor network, reconnect and unauthorized joining are tested. | Devadathan + Mathew | P2 functional; P3 company acceptance |
| R14 | Physician panel and linked patient record; E6, E8, C6 | Doctor sees assigned consultations, permitted history and consented chat summary; records identity/consent, notes and recommendations with an audit trail. Assigned physicians see policy-permitted patient past orders; recorded identity/required consultation consent is enforced before private consultation access. | Mathew | P2 functional; P3 company acceptance |
| R15 | Consult-to-cart; E4, C3-4 | Signed physician recommendation becomes an editable patient basket; consult-only products require a valid matching recommendation; dosage remains unchanged by the assistant. | Mathew + Josin | P2 functional; P3 company acceptance |
| R16 | Approved knowledge-base editor; C4, C6 | Product monographs, departments/treatments, FAQs, policies and selected Ayurveda references support draft, named approval, version history, withdrawal and reviewed dosage/safety translations. All published catalogue products have required approved monographs and launch-language safety blocks by G2, with approved public physician profiles among the knowledge types; content reviewers see reconciled most-used-entry/version analytics and measured edit/withdrawal freshness. | Mathew | P2 functional; P3 company acceptance |
| R17 | Grounded, cited Companion; C3-4, C7 | Responses trace to currently approved entries and approving physician; missing/stale/unsupported medical knowledge produces an approved handoff response. | Mathew | P2 functional; P3 company acceptance |
| R18 | Conversational product/order/refill/slot actions; C3-4 | Authenticated tools retrieve authorized records; add-to-cart, booking and payment steps require an explicit customer confirmation and display real current state. | Mathew | P2 functional; P3 company acceptance |
| R19 | Red flags, consult-only rules and disclaimers; C5, C7 | Physician test pack passes emergency/high-risk escalation; no diagnosis/cure promise; required disclaimer and named approval appear. No automated sale is initiated from a flagged conversation. Physician-approved minimal intake covers age/current medication and pregnancy/child/red-flag routing before personalized medical recommendation; unknown required data is clarified or handed off, never guessed. | Mathew | P2 functional; P3 company acceptance |
| R20 | Human handoff, callback and conversation review; C3, C6-7 | Staff take over an active chat with summary; assistant pauses; after-hours callback queues, WhatsApp acknowledgement, unanswered-question queue and resolution reporting work. | Mathew | P2 functional; P3 company acceptance |
| R21 | Same assistant on WhatsApp; C3-5, C8 | Real clinic number supports text/voice input, safe product actions, identity-linked order lookup, booking and a secure Razorpay checkout flow from the conversation. Staff can reply through the console. | Mathew | P2 functional; P3 company acceptance |
| R22 | English, Malayalam and Tamil application; C4 | Store, native app, menus, checkout, invoice labels and notifications have reviewed translations, usable fonts and no missing keys; medical wording is physician-reviewed. | Devadathan | P2 functional; P3 company acceptance |
| R23 | Other Indian-language and Romanized conversations; C4 | Evaluate Hindi/Kannada/Telugu plus launch languages and representative Romanized inputs; preserve approved clinical text and fall back safely when a translation cannot be verified. | Mathew | P2 functional; P3 company acceptance |
| R24 | Voice input; C4, C8 | Web/mobile microphone and WhatsApp voice messages transcribe into editable/reviewable text; permission denial and ambiguous numbers/units are handled. No action is triggered directly from an unchecked transcript. | Devadathan + Mathew | P2 functional; P3 company acceptance |
| R25 | Complete Android and iOS customer apps; E8, C8 | Both production apps include store, checkout, assistant, booking/video, reminders, subscriptions, history, loyalty and referrals; signed, reviewed, publicly obtainable releases. | Devadathan | P2 complete builds; P3 public store releases |
| R26 | Bundles and discounted courses; E7 | Approved product kits/course prices calculate consistently across channels and cannot bypass consult-only or stock restrictions. | Josin | P2 functional; P3 company acceptance |
| R27 | Opt-in WhatsApp campaigns and segments; E3, E7 | Staff send/schedule an approved template to a consented segment; opt-outs, quotas, delivery results and purchase attribution are visible. Health-interest segmentation requires explicit business/privacy approval. New-product, restock and seasonal campaigns work for consented prior-purchase segments, with current opt-out/quotas and no unauthorized clinical audience inference. | Mathew | P2 functional; P3 company acceptance |
| R28 | Seasonal offers and landing pages; E7 | Staff publish/schedule a branded campaign page and valid promotion; start/end times and redemption limits are enforced; the first clinic-approved campaign is configured for launch. | Josin + Mathew | P2 functional; P3 company acceptance |
| R29 | Abandoned-cart recovery; E7 | Eligible consented cart receives one scheduled reminder after the approved delay; completed/cancelled carts and unsubscribed users are suppressed; recovery link is scoped and expiring. | Mathew | P2 functional; P3 company acceptance |
| R30 | Verified-buyer reviews and physician content; E7 | Review eligibility checks completed purchase; moderation and publication controls work; approved physician notes are visible beside products. | Josin + Mathew | P2 functional; P3 company acceptance |
| R31 | Referrals and loyalty; E7, C8 | Share link, eligible first-order credit, points/credit ledger, redemption caps, refund reversal and basic self-referral/fraud prevention pass. | Josin | P2 functional; P3 company acceptance |
| R32 | Multiple clinics; E8 | Location-specific stock, physician availability, staff access and sales reports work for two configured clinics; inter-location stock moves retain batch traceability. | Mathew + Josin | P2 functional; P3 company acceptance |
| R33 | Wholesale/distributor ordering; E8 | Approved business account sees assigned price list, MOQ/pack size and permitted payment terms; account approval, fulfillment and GST records are auditable. | Josin | P2 functional; P3 company acceptance |
| R34 | SEO and shopping/business listings; E3, E7 | Product schema, canonical URLs, language alternates, sitemap, redirects and merchant product feed validate; company listing linkage is configured. Required merchant/feed approvals are recorded; approval pending is distinguished from a working feed and remains an open launch requirement. | Devadathan | P2 validated feeds/pages; P3 required listing approvals |
| R35 | Sales, retention and clinical conversion reports; E6-7, C6, C8 | Product/concern/city/clinic sales, repeat rate, refill due/lapsed, subscription state, conversation-to-cart/order/booking/handoff, and consultation-to-order metrics reconcile to operational records. Permissioned content reports also show defined, deduplicated knowledge-entry/version answer-usage counts without raw health prompts. | Josin + Mathew | P2 functional; P3 company acceptance |
| R36 | Roles, privacy, audit and ownership; C6-7 | Per-role and per-record tests pass; sensitive actions are logged; accounts, source, data and deployment access belong to the company; consent/retention workflows operate. Versioned required sign-up/privacy consent remains distinct from optional marketing consent; per-consultation identity/consent and private access are enforced. | Mathew + Devadathan | P2 functional; P3 company acceptance |
| R37 | Onboarding and recorded training; C8 | Front desk, warehouse, finance and physicians each complete role-specific scenarios; recordings, guides, access recovery and incident contacts are handed over. | Devadathan + domain owners | P2 guide drafts; P3 recorded training/acceptance |
| R38 | Production operations and maintenance readiness; E6, C8 | Monitoring, backups, tested restore, release/rollback, payment reconciliation, escalation ownership and scheduled content-review procedures are operating. Handover explicitly includes monthly physician flagged-conversation review, quarterly operating reports, security/app-release/priority-fix workflow, proposed eight-hour monthly knowledge-update allowance and agreed overflow; healthy due-job pickup p95 <2 minutes and a defined 99.9% rolling-month internal availability objective are measured/configured, not claimed as prelaunch achieved SLA. | Devadathan | P1 foundations; P2 integrated controls; P3 recovery/operations proof |

## 3. Fixed architecture and low-cost development policy

### 3.1 Selected components

| Component | Selected implementation | Master implementation rule |
|---|---|---|
| Backend | Cloudflare Workers Paid, Hono, TypeScript, Zod | One modular repository; separate Core API and Companion entry points. Core transactions do not depend on a model response. |
| Web | Astro/React public pages; React/Vite staff/customer/physician workspaces | Cache approved public content; revalidate price, eligibility, stock and appointment state on authoritative actions. |
| Mobile | Expo/React Native with native development/release builds | Real payment/WebRTC adapters, voice, push and deep links; Expo Go alone is insufficient verification. |
| Database | Neon PostgreSQL 17, Drizzle PostgreSQL migrations | Same engine/schema contracts in development and production; one production database with core/clinical/engagement schemas. |
| Database access | Neon serverless driver, pooled runtime endpoint | Parameterized SQL; request-scoped connections and interactive transactions; direct administrative endpoint for migration/backup jobs. |
| Identity | WorkOS AuthKit | Verified customer sessions; dedicated staff organization with mandatory MFA; own role, clinic and assigned-patient authorization. |
| Files | Cloudflare R2 | Separate public/private/quarantine storage; immutable object versions and authorized short-lived private access. |
| RAG | Vectorize plus PostgreSQL exact/keyword/alias lookup | Only approved public knowledge is indexed; primary database approval/version and mandatory safety blocks are rechecked. |
| AI and voice | OpenAI Responses API; GPT-4o-mini costed candidate, text-embedding-3-small, gpt-transcribe | Freeze tested supported versions/configurations; physician evaluation governs use; no unchecked clinical instructions or transcript actions. |
| Jobs | PostgreSQL outbox/due jobs, Cron and Cloudflare Queues | Separate financial/fulfillment, clinical/scheduled and engagement workloads; bounded concurrency, idempotency, deadlines and DLQs. |
| Video | Proven reusable WebRTC web/native component, Durable Object signaling and Cloudflare TURN | Booking-scoped permissions; media bypasses API Workers; poor-network and reconnect acceptance required. |
| Business integrations | Razorpay, Shiprocket, Meta WhatsApp, MSG91, transactional email and Expo Push | Provider sandboxes for development; actual live eligibility, templates and minimal real transaction evidence before full release. |
| Delivery and operations | Company-owned repository/CI, Wrangler/configuration, metrics, independent checks and encrypted backups | Versioned deploys, restricted secrets, additive migrations, tested rollback and named incident owners. |

### 3.2 Environment progression

| Environment | Intended period | Database/runtime policy | Data and integration policy |
|---|---|---|---|
| Local development | All phases | Local Workers and PostgreSQL-compatible test setup; remote Neon Free available for integration | Synthetic fixtures, deterministic provider stubs and sandbox credentials. Local success alone cannot pass an integration gate. |
| Shared development | Phases 1–2 | Cloudflare previews and Neon Free while within quotas; upgrade earlier if required | Separate bindings/credentials from production. Run real dispatcher schedules in controlled test windows. |
| Production-equivalent verification | No later than start of Day 7 | Workers Paid, Neon Launch, selected production driver/pool, compute range, history and storage/queue settings | Synthetic representative retained dataset; real supported provider test flows; safe load and authorized security testing. |
| Production | Phase 3 conditional release | Dedicated production database/resources, always-active compute, verified recovery and alert settings | Approved opening data, live integrations, restricted staff accounts and company-owned access. |

Use PostgreSQL from Day 1. Building critical workflows against SQLite/D1 and rewriting them later is outside this fixed plan. Low-cost development comes from quotas, synthetic data, idle suspension and bounded test usage, not a second database implementation. Neon Free currently includes 1 GB storage and 100 CU-hours per project/month; monitor consumption and upgrade when needed. [Neon pricing](https://neon.com/pricing).

Avoid leaving the one-minute dispatcher and keepalive checks running continuously in development; use scheduled test windows/manual triggers and prove the real schedule during verification. Do not switch off required production reminders or reconciliation to force idle savings. Upgrade before final load/recovery verification; production readiness cannot be inferred from a Free-tier test.

Production begins with a measured 0.25–1 CU autoscaling range and scale-to-zero disabled. The minimum is a starting configuration, not a guarantee. The database is in Neon Singapore; confirm company acceptance of overseas health-data processing. India-only residency, if required, changes the provider/region decision before patient use. A cloud provider choice is not a legal/compliance determination.

### 3.3 Non-negotiable technical safeguards

1. **Stock/money:** Atomically reserve eligible FEFO batches with the order/outbox; use row locks, deterministic lock order, nonnegative guards, integer paise and unique operation references. Validate guarded-update row counts before commit. No external network call while holding a transaction.
2. **Bookings:** Enforce cross-clinic doctor interval exclusion with PostgreSQL btree_gist/GiST and explicit hold expiry states. Validate buffers, leave and late payment. Database protection covers the complete occupied interval.
3. **Payments:** Signed webhook receipt, amount/currency/reference verification, durable deduplication, ambiguous-result reconciliation and immutable financial ledgers. A browser return never marks an order paid.
4. **Access:** Non-owner runtime roles, scoped application queries and tested patient/customer row-level-security policies. Actor/clinic context is transaction-local; pool reuse cannot retain another user's permissions. Staff MFA cannot be bypassed through customer login.
5. **Jobs:** Commit outbox/due records with domain changes. Claim with short transactions/leases, publish after commit, tolerate duplicate delivery and use provider idempotency/reconciliation. Do not treat a queue as exactly-once delivery.
6. **Clinical AI:** Retrieve only current approved public content; fetch mandatory dosage/contraindication/restriction blocks independently of semantic ranking. Authorize every tool and require explicit confirmation for user actions. Red flags stop automated sales and follow physician-approved escalation. Initially cap active model generations at ten using expiring PostgreSQL leases; bound context/tool turns, apply per-account abuse controls and timeouts, and provide safe retry/human routing when saturated. Core shopping and booking remain independent.
7. **Files/health data:** Private records are excluded from public search/indexes and shared caches. Authorize object access, sanitize/scan untrusted files through a verified path, retain immutable version references and redact health details from analytics/logs.
8. **Video/native:** Validate booked participants and room expiry; test credential misuse, permissions, app resume and poor networks. Use relay-only media if the privacy review requires it. Consultation recording stays disabled by default.
9. **Change/recovery:** Additive schema migrations, separate administrative credentials, protected exports and tested restore/cutover. Code rollback does not reverse a real payment or shipment.

## 4. Team, company participation and capacity

### 4.1 Six accountable workstreams

| Person | Accountable work | Critical boundaries / review |
|---|---|---|
| [Mathew](Kandamkulathi_05_Mathew_All_Phases.md) | Backend and AI technical lead; clinical safety implementation; Own identity/authorization, clinical and booking APIs, safe AI/RAG and tools, privileged channel handlers and transaction reviews. Review every sensitive commerce change. Devadathan independently reviews your sensitive changes; the company physician approves medical behavior and content. | Do not invent medical rules, change physician dosage, approve your own critical changes, or silently take over every UI task. Use agreed contracts and small reviewed integrations. |
| [Josin](Kandamkulathi_06_Josin_All_Phases.md) | Commerce implementation owner; Own catalogue/stock/order/payment/fulfillment/subscription/billing/wholesale/loyalty implementation and finance reconciliation. Mathew must review transaction, money, stock, permission and webhook changes; finance/warehouse approve business fixtures. | Do not independently decide tax policy, credit terms or clinical eligibility. Never use the browser callback as payment proof. Mathew owns shared identity and authorization policy. |
| [Devadathan](Kandamkulathi_07_Devadathan_All_Phases.md) | Frontend/mobile and platform technical lead; release manager; Own the shared UI architecture, sensitive session/payment/clinical client flows, native SDKs, CI/secrets, environments, deployment and recovery. Give Paul and Denzil stable components and bounded tickets. Mathew reviews your sensitive platform/client security changes. | Delegate ordinary screens/content assembly. Do not delegate signing credentials, production migrations, permission design, payment SDK setup or recovery execution to less experienced members. |
| [Paul](Kandamkulathi_08_Paul_All_Phases.md) | Customer UI and device support; Assemble customer web/native screens from Devadathan’s shared components and reviewed APIs. Own loading/error/accessibility states, ordinary forms, device journey execution and store screenshot support. | No authentication architecture, payment/video/voice SDK wiring, direct database changes, financial calculations, clinical rules, provider secrets or production deployment. Request a contract/component fix instead of creating a shortcut. |
| [Denzil](Kandamkulathi_09_Denzil_All_Phases.md) | Content/admin presentation and operational documentation support; Prepare synthetic import files, approved translations/content, bounded staff/admin presentation, reports consuming authorized APIs, SEO/feed artifacts and operating guides. Devadathan reviews UI; Mathew reviews safety/permission boundaries; domain owners approve wording and figures. | Do not medically approve content, design permissions, write financial reporting SQL, change payment/stock state, access production secrets or execute migrations. Import work is validation/dry-run support; Josin executes approved writes. |
| [Tinu](Kandamkulathi_10_Tinu_QA_and_Test_Cases_All_Phases.md) | QA lead and test coordinator; minimal feature work; Own test cases, synthetic QA fixtures, basic regression automation, defect evidence, independent retesting and gate reports. You have no critical product feature assignment. Mathew and Devadathan operate advanced security/load/recovery tests; domain owners provide approved expected results. | Testing is a team duty. You are not expected to certify zero bugs or perform specialist penetration testing alone. Never use real patient data, execute destructive production tests, approve medical outcomes yourself or merge a failed candidate. |

Mathew and Devadathan review each other’s critical changes; Mathew reviews Josin’s money/stock/webhook/mandate/credit changes. Paul/Denzil implement bounded ordinary UI/content tasks using reviewed components/APIs. Tinu coordinates QA and has no critical product-feature ownership. All six test; advanced security/load/recovery is operated by the seniors. Company physician/finance/privacy/operations reviewers approve domain expectations and are not additional engineers. Name primary/backup company reviewers on Day 1; blocking questions have the agreed four-business-hour review target.

Legacy technical domains are E1 clinical, E2 commerce, E3 web/content, E4 native, E5 AI/channels and E6 platform. They are not named-person identifiers and have no separate current capacity. Named task prefixes MAT/JOS/DEV/PAU/DEN/TIN govern execution.

### 4.2 Total capacity and protected testing time

| Phase | Calendar days in scope | Build/integration/hardening person-days | Verification person-days | Environment/release/handover person-days | Defect contingency person-days | Total |
|---|---|---:|---:|---:|---:|---:|
| Phase 1 | Days 1–3 | 11.5 | 4.0 | 1.0 | 1.5 | 18 |
| Phase 2 | Days 4–6 | 12.0 | 4.0 | 0.5 | 1.5 | 18 |
| Phase 3 | Days 7–10 | 4.5 | 10.0 | 4.5 | 5.0 | 24 |
| **Total** | **10 working days × 6 engineers** | **28.0** | **18.0** | **6.0** | **8.0** | **60** |

Verification includes automated execution, manual review, device testing and company UAT. Phase 3 build/hardening time is for fixes, resilience and performance—not undisclosed required features deferred past Phase 2. Contingency is inside the ten days; unused contingency supports verification/handover, not new scope. These are planning envelopes, not validated task estimates.

This plan reserves more explicit testing capacity than the earlier daily plan. The result is less time for new implementation and a stronger dependence on verified reuse. The later work-package estimates must fit these envelopes before the team promises the date. No hidden overtime or seventh engineer is assumed.


### 4.3 Named capacity by phase

| Phase | Person | B h | V h | E h | C h | Total h |
|---|---|---:|---:|---:|---:|---:|
| 1 | Mathew | 18 | 4 | 0 | 2 | 24 |
| 1 | Josin | 17 | 4 | 1 | 2 | 24 |
| 1 | Devadathan | 17 | 4 | 1 | 2 | 24 |
| 1 | Paul | 16 | 4 | 2 | 2 | 24 |
| 1 | Denzil | 16 | 4 | 2 | 2 | 24 |
| 1 | Tinu | 8 | 12 | 2 | 2 | 24 |
| 2 | Mathew | 18 | 4 | 0 | 2 | 24 |
| 2 | Josin | 18 | 4 | 0 | 2 | 24 |
| 2 | Devadathan | 18 | 4 | 0 | 2 | 24 |
| 2 | Paul | 17 | 4 | 1 | 2 | 24 |
| 2 | Denzil | 17 | 4 | 1 | 2 | 24 |
| 2 | Tinu | 8 | 12 | 2 | 2 | 24 |
| 3 | Mathew | 7 | 12 | 6 | 7 | 32 |
| 3 | Josin | 7 | 12 | 6 | 7 | 32 |
| 3 | Devadathan | 8 | 10 | 7 | 7 | 32 |
| 3 | Paul | 6 | 13 | 7 | 6 | 32 |
| 3 | Denzil | 6 | 13 | 7 | 6 | 32 |
| 3 | Tinu | 2 | 20 | 3 | 7 | 32 |

Every member has 24/24/32 hours, totaling 80. Team categories remain P1 92/32/8/12 =144 h; P2 96/32/4/12 =144 h; P3 36/80/36/40 =192 h; overall 480 h. Tinu’s B is QA preparation/tool maintenance, not product feature coding. The named daily category grid is identical in phase/member plans.

## 5. Readiness check inside Day 1

| Dependency | Readiness evidence | If missing |
|---|---|---|
| Reusable code and team capability | Audited commerce/clinical modules, native payment/WebRTC proof, deployment starter and license review; real remaining estimates | Reforecast the full scope before treating the ten-day date as committed. A scaffold is not reusable completed business logic. |
| Company opening data | Catalogue/images/variants, prices/taxes/HSN, two-clinic opening batches/expiry, doctors/hours/fees/leave, distributors and approved policies | Import validated fixtures for development while recording the unresolved production input. Opening-data gaps block final acceptance. |
| Clinical/language material | Named physicians; indications, dosage, contraindications, consult-only rules, emergency wording and approved EN/ML/TA text | No clinical automation without approval; record the missing requirement instead of inventing text. |
| Accounts and integrations | Company Cloudflare/Neon/WorkOS, Razorpay/mandates, WhatsApp number/templates, SMS/courier, AI/voice/video access | Exercise an actual provider test flow early. Sandbox-only support is not live launch readiness. |
| Native release prerequisites | Company Apple/Google account eligibility, signing credentials, supported devices, macOS/cloud build route, privacy disclosures and listing access | Escalate external timelines immediately; test distribution is not public production availability. |
| Database and security | Driver/pooling/TLS, btree_gist, role/RLS prototype, secret isolation and recovery path | Fix before building dependent transaction flows. |
| Company reviews and support | Named product/clinical/finance/privacy approvers, approved core back-office/portal designs and brand assets, and support rota | Acceptance remains pending until responsible reviewers are available. |

Some new personal Google Play accounts require a closed-testing period before production eligibility. Check the actual account on Day 1; a ten-day engineering schedule cannot waive it. [Google Play requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en). Confirm live mandate/payment methods, WhatsApp templates and merchant/listing approvals with the actual company accounts, not generic provider capabilities.

## 6. Three-phase delivery calendar and dependency flow

| Day | Date | Phase | Integrated milestone and protected verification |
|---|---|---|---|
| 1 | Mon 19 Oct 2026 | Phase 1 | Readiness, contracts/schema/security, real provider/native proofs, CI/environments and test fixtures. |
| 2 | Tue 20 Oct 2026 | Phase 1 | Core shopping/stock/payment and doctor/booking slices; account/staff paths; durable jobs and approved KB foundation. |
| 3 | Wed 21 Oct 2026 | Phase 1 | Integrate the core journeys; freeze P1 candidate; protected broad cumulative testing and Gate G1. |
| 4 | Thu 22 Oct 2026 | Phase 2 | Complete clinical/commerce operations, full account/order/stock workflows, approved content and assistant actions. |
| 5 | Fri 23 Oct 2026 | Phase 2 | Subscriptions/GST/shipping, reminders, video/voice/WhatsApp, multiclinic and all three interface languages. |
| 6 | Mon 26 Oct 2026 | Phase 2 | Complete wholesale/loyalty/growth/reporting/feeds and full native builds; broad cumulative testing and Gate G2. |
| 7 | Tue 27 Oct 2026 | Phase 3 | Production-equivalent Paid verification; full device/clinical/security regression; submit the complete tested native candidate. |
| 8 | Wed 28 Oct 2026 | Phase 3 | Sustained/burst/soak load, contention, provider outages, backup restore/cutover and rollback exercises; repair/retest. |
| 9 | Thu 29 Oct 2026 | Phase 3 | Company UAT, training, opening balances, live integration checks, external approvals and final regression evidence. |
| 10 | Fri 30 Oct 2026 | Phase 3 | Gate G3 prelaunch decision; conditional deployment/public release; safe postdeployment verification and final phase closure. |

Critical dependency flow: identity/contracts/schema → stock/payment/booking invariants → integrated clinical/commerce/channels → full feature regression → production-equivalent verification → company/store/provider acceptance → public release.

G1 and G2 each reserve the final half-day for all six engineers' broad testing, with earlier continuous testing contributing the remaining verification allocation. Phase 3 spreads the larger test campaign across Days 7–9; G3 reviews that evidence before public rollout and closes only after postdeployment checks. A gate is not an hour-long demonstration.

If a gate fails, fixes and retesting take priority. Dependent work does not claim completion against a failed foundation. Independent work can continue on isolated branches without changing the tested candidate. Recompute the forecast immediately; do not quietly move testing outside the ten days.

## 7. Phase 1 — Foundations and verified core journeys

**Window:** Days 1–3. **Outcome:** A deployed, secured, integrated foundation with working core transaction slices and a passing cumulative Gate G1. This is an internal development milestone, not an approved customer launch.

### 7.1 Entry conditions and objectives

Use the Day 1 readiness check, accepted scope and six workstream owners. Establish the actual reusable-code baseline and record what is missing. Lock API/event contracts, shared types, schema/migration ownership, identity mapping, error semantics and environment boundaries before dependent modules diverge.

Prove the highest-risk platform combinations immediately: Workers-to-Neon transaction/rollback, pooled authorization, native sign-in/payment return, private web/native video adapter and a real provider test interaction. Do not discover unsupported native modules on Day 8.

### 7.2 Required phase outputs

| Output ID | Integrated deliverable | Required evidence at phase end |
|---|---|---|
| P1-O01 | Repository, reproducible environments and CI | Web/API/mobile builds run; isolated secrets/bindings; reviewed migrations; synthetic seed/reset; release/build identifiers and test artifacts retained. |
| P1-O02 | Identity, roles and sensitive-record boundaries | Customer/staff/doctor identity mapping; mandatory staff MFA; clinic/patient scopes; session revocation and pooled RLS-context tests. |
| P1-O03 | Core data model and opening imports | Product/variant/price/concern, clinic, doctor, batch, order/payment ledger, appointment/consent, approved KB and outbox contracts; validated opening-data import process. |
| P1-O04 | Shopping/payment transaction slice | Product → cart → authoritative price/stock reservation → provider sandbox payment → verified webhook → order visibility; cancellation/refund scaffold with proven idempotent state transitions. |
| P1-O05 | Appointment transaction slice | Directory/hours/fees → slot hold → fee payment → confirmation; cross-clinic overlap protection, hold expiry and late-payment behavior demonstrated. |
| P1-O06 | Working channels and administration skeleton | Customer web and native journeys; staff catalogue/order/doctor/stock foundations; launch-language resource structure; real-device auth/payment/video compatibility evidence. |
| P1-O07 | Approved KB/Companion foundation | Structured draft/approval/version records, initial exact/vector retrieval, source traceability, human fallback and backend tool authorization boundary. Medical output is limited to approved test content. |
| P1-O08 | Reliable work and observability foundation | Atomic outbox, scheduled/leased dispatch, queue acknowledgment/retry/DLQ, trace IDs, redacted logs, alert test and first encrypted backup/restore smoke. |
| P1-O09 | Gate G1 evidence package | Current-app regression/security results, concurrency and early performance evidence, issue triage, company review and recorded proceed/rework decision. |

R01–R05, R11–R12, R14, R16–R18, R36 and R38 provide the main vertical slices; remaining rows retain their Phase 2/3 obligations. A foundation or partially implemented row is not marked company-accepted. Full refunds, tracking, multilingual parity and provider edge cases still close in Phase 2 where not completed here.

### 7.3 Broad testing after Phase 1

Freeze an integrated P1 candidate before the protected Day 3 session. Test the entire currently implemented application, including all reachable routes, web/native flows and existing provider handlers—not only newly merged endpoints.

- Execute authentication/session/MFA, role/clinic/patient isolation and pooled-connection reuse tests, including denied access cases.
- Exercise core purchase and booking happy/error paths; compete for the last unit and same doctor interval; replay signed/invalid/duplicate webhooks and inspect ledgers/outbox.
- Test transaction rollback, expired holds, malformed inputs, client price tampering, missing permissions, queue redelivery and lost provider response handling for the implemented slice.
- Run code/dependency/secret/configuration scans and authenticated staged dynamic checks against the available app. Include exposed client bundles, secrets, CORS/cookies, signed links and injection/record-ID manipulation.
- Smoke-test real Android/iOS devices for auth, payment return, text rendering and native-module feasibility. Test the basic web/native consultation transport before relying on it for Phase 2.
- Review the initial approved-content path and tool permission boundary; unapproved/stale knowledge must not become a medical answer.
- Run a ten-minute 10-request/second mixed smoke load on the current journeys; capture latency/errors, pool/lock behavior and baseline cost. This is not final capacity certification.
- Restore the initial synthetic backup into an isolated target and verify access controls and control totals; demonstrate a failed queue message reaching inspection/redrive.

### 7.4 Gate G1 pass criteria

P1-O01–P1-O09 have evidence; all executed mandatory current-scope tests pass; no unresolved release-blocking security, access, financial or appointment defect exists in the implemented scope; every scanner finding is triaged. The candidate can be rebuilt, deployed, observed and restored at foundation level. The remaining requirements and estimated effort fit the updated plan or have an explicit revised forecast.

Mathew/Devadathan record technical acceptance, Tinu assembles QA evidence and Devadathan supplies environment evidence and company reviewers validate the core journeys/data assumptions. Gate G1 is **Pass** or **Rework**. It does not declare unbuilt Phase 2 features tested or waive final production/provider checks.

## 8. Phase 2 — Complete the company system and validate full functionality

**Window:** Days 4–6. **Entry:** Passing G1 and an integrated stable baseline. **Outcome:** All required application features implemented and working across the required channels; full cumulative Gate G2 passed; release candidates ready for final production verification. Training completion, public approvals and final operational drills remain Phase 3 deliverables.

### 8.1 Required feature completion groups

| Output ID | Completion group | Company requirements and expected result |
|---|---|---|
| P2-O01 | Commerce, accounts and operations | R01–R09 and R26: complete catalogue/concern browsing, native/web checkout and COD, accounts/history/reorder/tracking, unified staff/WhatsApp orders, FEFO/expiry/recall, shipping/COD settlement, GST/credit notes/export, order messages, true mandate renewals and bundles/courses. |
| P2-O02 | Clinical and multiclinic | R10–R15 and R32: dose/refill schedules, directory/location fees/hours/leave, paid/rescheduled/refunded bookings, private video, assigned-patient physician workspace/consent/notes, signed consult-to-cart and two-clinic operations. |
| P2-O03 | Companion and communication | R16–R24: KB approval/withdrawal/translations, cited current retrieval, authorized confirmed actions, red flags/consult-only/disclaimers, live handoff/callback/review, real WhatsApp text/voice flow, three-language UI and safe additional-language/Romanized handling. |
| P2-O04 | Native parity | R25: Android/iOS complete customer flows for store, checkout, AI, booking/video, reminders, subscriptions, history, loyalty and referrals; signed complete candidate builds and real-device regression. Public store releases occur in Phase 3. |
| P2-O05 | Growth, wholesale and reporting | R27–R31 and R33–R35: opted-in segmented campaigns, seasonal pages/promotions, abandoned-cart suppression, moderated verified reviews/physician content, referral/loyalty reversal, distributor terms/MOQ/prices, SEO/feeds/listing configuration and reconciled reports. |
| P2-O06 | Security, operations and handover preparation | R36–R38: complete role/record restrictions, protected audit, retention/consent/deletion/export handling, monitors/alerts/recovery configuration, draft runbooks, role training materials and production data-validation tools. |
| P2-O07 | Integrated release and evidence | All required features integrated in web/native/WhatsApp and staff workspaces; complete R01–R38 tracker with evidence level, external approvals and company acceptance status; Gate G2 report. |

Use the original requirement acceptance matrix in Section 2 to evaluate each group. These summaries do not replace its detailed acceptance clauses. Every required journey has a working UI, backend, access policy, data state, event processing and error path. An API stub, disconnected screen, disabled feature or fabricated provider result is not functional completion.

### 8.2 Completion rules

By Day 6, no required application feature should still be scheduled as new work in Phase 3. Known external approval dependencies remain explicitly tracked against the affected requirement; they cannot be silently counted complete. Sandbox-tested integration proves the implementation path, not live account eligibility. A pending provider/store approval can remain a tracked external condition at G2 only with an explicit owner/deadline; it blocks final G3/public completion if unresolved.

Complete the EN/ML/TA customer, staff-visible operational labels, invoice labels and notifications. Additional clinical-language responses require reviewed content or approved safe fallback. Finish campaign consent, quiet hours, unsubscribe/suppression and clinical-data exclusion from analytics. Test health-interest segments only after company/privacy approval.

Freeze the complete P2 release candidate before the protected Day 6 testing session. Prepare store assets/privacy declarations from Day 1 onward; do not wait for submission day to discover missing company accounts or signing.

### 8.3 Broad testing after Phase 2

Run every G1 suite again, then the full feature scope. Add all newly reachable routes and record types to the test inventory and security coverage. Compare public web, Android, iOS and WhatsApp outcomes against the same backend state.

- Full purchase/refund/return/credit-note, shipping/tracking/COD, subscription renewal/failure/cancellation and shortage recovery journeys.
- Cross-clinic stock transfers, recalled/expired batches, distributor eligibility/pricing, bundles/discounts, referral self-abuse, loyalty redemption and refund reversal.
- Booking/reschedule/leave/late-payment/refund, doctor assignment, signed recommendations, consent and timezone-aware dose/refill reminders.
- Full voice/video/push/deep-link/device-permission and network-recovery tests; no unchecked transcript triggers an action.
- At least 120 physician-reviewed clinical/action scenarios across EN/ML/TA plus 40 additional-language/Romanized cases, including urgent symptoms, restrictions, injection, stale KB, unauthorized lookup and human takeover.
- Full authenticated API/web dynamic checks and code/dependency/secret/config scans. Recheck all staff roles, object ownership, pooled RLS context, customer-to-staff MFA bypass and private file access.
- Marketing approval/consent, opt-out, cart-recovery suppression, reviewed translations, accessibility and report/control-total reconciliation.
- Inject duplicates, out-of-order events, process crashes and lease expiry; prove provider-unknown outcomes do not repeat money/stock effects.
- Run a 15-minute 20-request/second mixed test including bounded jobs/AI activity; review resource pressure and pool cleanup. Final sustained/burst/soak certification remains G3.
- Rehearse backup/object linkage and application rollback against the current schema; test queue/DLQ reconciliation after interruptions.

### 8.4 Gate G2 pass criteria

All Phase 2 functional outputs work and their mandatory cumulative tests pass. All R01–R38 rows have evidence for their due milestone or an explicitly tracked Phase 3 acceptance/public/operating dependency; none is silently deferred. No known release-blocking defect remains. The complete native candidates pass required current-scope device tests. Clinical review passes every critical case, no fabricated dosage/prohibited action/unauthorized record access appears in the release set, and displayed medical blocks trace to approved versions. Noncritical supported task completion reaches at least 95% on the approved set; this is an evaluation result, not universal safety proof.

Mathew/Devadathan and the relevant company reviewers record G2. A full required feature missing on Day 6 means G2 is **Rework** and the forecast must change; Phase 3 testing time cannot be relabelled as unplanned feature construction. On Day 7, after production-equivalent regression, submit the complete tested native build; do not submit an incomplete placeholder to claim schedule progress.

## 9. Phase 3 — Production verification, company acceptance and controlled launch

**Window:** Days 7–10. **Entry:** Passing G2, full integrated candidates and tracked external dependencies. **Outcome:** Broad final verification on production-equivalent settings, company acceptance, public release on all required channels and operational handover. G3 remains pending until both prelaunch approval and postdeployment checks pass.

### 9.1 Production verification outputs

| Output ID | Deliverable | Evidence required |
|---|---|---|
| P3-O01 | Production-equivalent environment | Workers Paid and Neon Launch activated, production driver/pool/roles, always-active compute, seven-day history, isolated R2/queues/identity and alerts verified. |
| P3-O02 | Final functional/security/clinical regression | All cumulative suites against the exact release candidate; reviewed scan findings; device/language/access/AI reports; every release blocker closed and retested. |
| P3-O03 | Capacity and resilience proof | Sustained/burst/soak workload, transaction contention, autoscaling/cold-cache path, job recovery and provider outages pass Section 11 thresholds. |
| P3-O04 | Recovery and rollback proof | PITR and independent pg_restore/object recovery, connection cutover, prior-version deployment and payment/booking reconciliation exercised. |
| P3-O05 | Business and channel acceptance | Opening balances/data, company UAT, live merchant/templates/courier/listing eligibility, clinically approved content and actual public store approvals. |
| P3-O06 | Company handover | Recorded role training, operating guides, service/repository ownership, credential recovery, support/incident rota and measured budget dashboard. |
| P3-O07 | Gate G3 and release record | Prelaunch decision attached to the tested candidate, safe production verification, publicly installed Android/iOS, required web/WhatsApp availability and final acceptance signatures. |

### 9.2 Broad final testing and defect repair

Days 7–9 form a cumulative campaign, not a sequence of separate unconnected spot checks. Repeat all critical business/security/clinical suites, exercise full provider/device/language coverage and execute the capacity/recovery tests in Sections 10–12. Use independent reviewer/pair testing to challenge assumptions from the feature author. Finance, warehouse/front desk and physicians execute their actual workflows with approved test data.

Freeze each candidate by commit, schema/config, prompts, KB versions and native build. A fix produces a new candidate: rerun the reproducing test, affected regression and the full critical journey/security suite. Rerun load/recovery/device tests when the changed component invalidates that evidence. Cosmetic-only changes do not justify blindly repeating every four-hour test, but the change-risk review must be recorded. No untested patch reaches production.

Submit the tested complete mobile candidate on Day 7. Store review response/fixes use the same candidate/evidence policy; an update can restart external review. Public Android/iOS availability and required merchant/feed approvals remain launch conditions, not promises within team control.

### 9.3 Gate G3 before and after deployment

**Prelaunch review, Day 10:** The exact release candidate passes the cumulative campaign and all release criteria in Section 13. Required store/provider approvals are active; all R01–R38 final company acceptances are ready except the safe postdeployment evidence. Mathew, Devadathan and company product/physician/finance/operations reviewers record Go or No-go. No-go prevents public rollout and triggers an explicit updated forecast.

**Controlled rollout:** Deploy schema-compatible backend/web assets, verify restricted internal live flows, then enable the company-approved public release and channel configuration. Use minimal controlled live transactions and consented test accounts. Avoid destructive testing, campaign spam or bulk load against customers/provider production APIs.

**Phase closure:** Verify publicly installable apps, live checkout/booking/private consultation, authorized records, WhatsApp tools, scheduled delivery, monitored jobs and financial reconciliation. Confirm alerts/support and company handover. Recheck the release health after the initial observation period. The final G3 report includes prelaunch campaign results and postdeployment verification. A rollback, failed channel or unresolved blocker means Phase 3 is not complete.

## 10. Cumulative test coverage required at each phase boundary

Testing after a phase covers everything currently built plus all earlier functionality. “Not built yet” is recorded as a future required milestone during Phase 1 only; it cannot be used to hide missing application scope at G2 or incomplete release requirements at G3.

| Test area | G1 — current core foundation | G2 — full integrated application | G3 — final production candidate |
|---|---|---|---|
| Build/configuration | Reproducible web/API/mobile builds, env isolation, migrations and seeds | Complete candidate builds; no missing routes/locales/bindings | Exact signed/versioned release artifacts and production parity |
| Identity and authorization | Customer/staff/doctor, MFA, session revocation, scope/RLS pool reuse | Every route/tool/record role matrix, clinic crossover and ownership failures | Repeat full matrix with production settings; recovery and credential rotation |
| Input and browser/API security | Price/ID tampering, injection, cookies/CSRF/CORS, secrets/headers | All exposed workflows, links/uploads, admin actions and native/API paths | Full authenticated risk-based dynamic review plus final configuration checks |
| Code/dependency/supply chain | Code, secret, dependency/license and config scans; manual critical review | Rescan whole candidate and all new dependencies | Final artifact scan/triage and signed review of residual issues |
| Money and stock | Purchase/payment/hold/idempotency, last-unit race | Refunds/returns/GST, subscriptions, batches/recalls/transfers/COD | Live minimal reconciliation, race/burst/outage and restore correctness |
| Scheduling/clinical | Hold overlap/expiry and assignment/consent foundations | All booking/refund/leave/video/notes/recommendation/reminder cases | Full clinical UAT, concurrent/late event and recovery scenarios |
| Assistant | Approved retrieval, tool authorization and safe fallback | 120 launch-language + 40 extra-language/Romanized scenarios | Repeat full evaluation; critical-case repeatability, saturation and stale-index tests |
| Channels and notifications | Existing events/handlers, native auth/payment adapter proofs | Real WhatsApp sandbox/test flow, voice, SMS/push/deep links and handoff | Live required template/method readiness; failures and escalation verified |
| Devices/languages/accessibility | Core real-device smoke and resource/font checks | Full Android/iOS/web parity, EN/ML/TA and permission/network cases | Release builds, supported representative devices/OS and store installation |
| Growth/wholesale/reports | Schema/security and data/event foundations | All promotions/segments/opt-outs, reviews, credits, wholesale and metric totals | Company UAT, live approvals and reconciliation against opening balances |
| Jobs/resilience | Duplicate receipt, crash/retry/lease/DLQ foundation | All job families, deadline/suppression and unknown-provider outcomes | Priority under campaign load, outages, replay and backlog recovery |
| Performance | 10 requests/sec for 10 minutes; current implemented mix | 20 requests/sec for 15 minutes; full flow mix and background work | Sustained 60, burst 120 and four-hour soak; Section 11 governs thresholds |
| Backup/rollback | Synthetic backup restore and initial deployment rollback | Current-schema/object linkage and queue reconciliation rehearsal | PITR, independent restore/cutover, provider reconciliation and timed rollback |
| Company evidence | Core journey/data assumption review | Full feature demonstrations and clinical/finance/content review | All R01–R38 acceptances, public approvals, recorded training and handover |

### 10.1 Test data and representative users

Use synthetic/approved sanitized data with at least two clinics, doctors working across locations, multiple batch/expiry/recall states, consult-only products, retail/distributor accounts, fees/tax rules, subscriptions, partial refunds, returns and loyalty reversals. Include EN/ML/TA plus representative other-language/Romanized/ambiguous voice inputs.

For performance/recovery, use a realistic retained dataset: actual-size catalogue/opening stock plus, initially, at least 3,000 synthetic customer accounts for the planning envelope, 10,000 historical synthetic orders and sufficient ledger/job/audit history to exercise indexes/pagination. Include concurrent active carts, overlapping doctor schedules and pending jobs. Align storage/row distribution with the planned retained-data model; a padded blob file does not prove realistic query performance. Retest sizing if production data differs materially.

Separate provider sandboxes from load stubs: contract tests prove actual provider payload/signature behavior, while high-volume tests use controlled adapters to avoid real charges/messages or third-party rate-limit interference. Report simulated versus real dependencies explicitly. A stubbed test alone cannot prove a live integration requirement.

### 10.2 Tooling and execution discipline

Use a pinned test stack appropriate to the repository: Vitest/Workers integration tests and real PostgreSQL tests for domain behavior; Playwright for web journeys; real-device native tests with a reproducible mobile test checklist/automation; k6 for staged load; code/dependency/secret scanners; and OWASP ZAP plus manual authenticated access/business-logic testing. Tools support evidence; they do not replace physician/company review. [k6 documentation](https://grafana.com/docs/k6/latest/), [ZAP documentation](https://www.zaproxy.org/docs/).

Use the applicable OWASP ASVS controls as a review reference for authentication, access, input, data and configuration. Record which controls were checked and how; do not infer full standard conformance from a generic scan. [OWASP ASVS](https://owasp.org/projects/asvs).

Scans and active tests run only against company-authorized isolated environments and consented accounts. Do not attack provider infrastructure, run destructive tests against customers or copy real patient data into test logs. Track all critical business/API routes and their negative tests. Code-coverage numbers are diagnostic; a high percentage cannot replace invariant, misuse and integration tests.

## 11. Numeric capacity and user-experience acceptance

The traffic model is approximately 1,000 DAU × 80 dynamic calls/day = 80,000 calls/day or 2.4 million/month. Peaks matter more than the daily average. The 3,000-user envelope is a test-planning target with proportionally higher operating usage; it is not a claim of measured capacity or unchanged cost.

| Measure | G3 acceptance objective |
|---|---|
| Sustained mixed load | 60 dynamic requests/second for 30 minutes with representative retained data |
| Burst | 120 dynamic requests/second for five minutes; bounded retries and no correctness violations |
| Soak | Four hours at 20 dynamic requests/second with jobs and bounded AI/video activity; no connection/memory/lease leak |
| Dynamic mix | 65% catalogue/product reads, 15% account/order/tracking, 10% cart/availability, 5% checkout writes, 5% booking writes; distinguish cached/static traffic |
| Core latency | India test locations: read p95 below 500 ms; write p95 below one second; provider latency reported separately |
| Unexpected server errors | Below 1% under the declared workload; report retries and failed business transactions separately |
| Invariants | Zero double charges, oversold allocations, overlapping active doctor appointments or unauthorized record access in tested cases |
| Database | Initial tuning objective: core transaction p95 below 100 ms in-database, excluding transport; no sustained pool/lock backlog; report end-to-end transaction latency |
| Job timeliness | Healthy-state due-job pickup p95 below two minutes; deadline-aware recovery with alerting for missed critical work |
| Assistant | Representative nonclinical first useful output p95 below five seconds; approved medical blocks rendered only after required checks |
| Public web | Key-page mobile LCP objective below 2.5 seconds on representative Indian mobile networks |
| Recovery | Section 12 recovery objectives demonstrated against the tested dataset |

Record workload scripts/mix, software/model/KB versions, dataset size/distribution, compute range, cache state, network/device locations and results. Test minimum-compute/cold-cache and autoscaling ramp as well as warm steady state. Add explicit contention tests for a popular SKU and one doctor, background campaign spikes and provider timeouts.

These targets must be achieved in the chosen production configuration. If sizing or network round trips prevent them, optimize or increase compute, update the budget and rerun affected tests. A cheap configuration that fails the gates is not acceptable. Passing a small local benchmark cannot satisfy G3.

### Protected measurement windows and fault-test isolation

Devadathan and Tinu publish a run-window/resource manifest before G3: target database/compute/Worker/queue/object IDs, candidate/config, dataset/reset ownership, operator/observer, provider mode and expected cost. Keep sustained/burst baseline and four-hour soak protected from unrelated deployments, seed resets, time travel, destructive fault injection, restore/cutover, scanner storms and ad hoc queries. Bounded jobs/AI/video are included only as declared workload; scheduled backup/report work is explicitly included or separately measured.

Run recovery/rollback/provider-fault/security mutation campaigns on separately verified isolated targets with independent resource contention boundaries, or serialize them after baseline/soak. A separate logical schema alone is not independent compute. Verify endpoints/queue/provider modes before each drill; never restore or fault the active measured candidate. Record cooldown/warmup and before/after correctness controls. No full load test is aimed at live payment/messaging/video providers.

The Day 8 plan is a dependency/window plan, not permission for one senior to operate several simultaneous destructive tests. Allocate actual operator/reviewer time inside the named hours; automation may run in the background with assigned observation. If target isolation, elapsed windows, staffed time or metered temporary resources do not fit, serialize/reforecast and update measured usage/cost rather than accepting confounded metrics or hidden overtime.

## 12. Recovery, resilience and operational readiness

### 12.1 Required production controls

Configure and verify Neon Launch's seven-day history window, production scale-to-zero disabled, the chosen autoscaling bounds and effective connection limits. Keep runtime/migration/backup roles distinct. Back up nightly with encrypted pg_dump to a company-controlled independent destination using a suitable CI/backup runner, not the API Worker. Retain seven daily and four weekly copies initially, subject to approved records policy and measured cost. Test recovery keys, pg_restore, roles/extensions/RLS and attachment references.

Private/source R2 objects have immutable keys, hashes and a manifest; retain/copy required versions so a restored database can retrieve the right bytes. Same-account snapshots/branches alone do not protect against account loss. Historical clinical/financial record retention is separate from the database recovery-history window.

| Exercise | Required objective/evidence |
|---|---|
| Application version failure | Roll back to a schema-compatible Worker/web version within a 15-minute operating target; verify invariant/control totals. |
| Database corruption within history | Demonstrate a recovery point at most 15 minutes before the incident using available history, isolated validation and safe cutover. |
| Full data restoration | Initial target: restore, validate and resume within two hours for the tested dataset; achieved value must be recorded. |
| Independent backup/account-loss scenario | Nightly exports have up to a 24-hour recovery point; weekly copies give older/coarser recovery. Record the separate cross-provider recovery time, not a guaranteed two-hour failover. |
| Provider divergence after restoration | Reconcile real payment/refund/mandate/shipment events against local ledgers; prevent replayed charges/messages/stock effects. |
| Queue crash/backlog | Reclaim expired leases, redrive idempotently and meet workflow deadlines; suppress/escalate obsolete clinical reminders. |
| Knowledge-index loss/withdrawal | Rebuild from approved versions; stale index hits cannot bypass primary approval/version checks. |
| Provider/AI/database outage | Exercise bounded retries/circuit breakers, pending states and human escalation. Core actions must not depend on AI; database outage must not produce false confirmations. |

Recovery objectives are internal targets requiring measured evidence, not vendor guarantees. If a drill fails, repair/retest or record No-go. A successful database import alone does not prove recovery of the complete app.

### 12.2 Operations before public release

Configure independent checks and alerts for API errors, database CPU/cache/connections/locks, unusual costs, payment mismatches, inventory anomalies, job lag/deadlines/DLQs and clinical escalation. Test alert receipt by the named company support contacts. Scrub logs of secrets, full health messages, addresses/payment details and private bearer links.

Set an internal 99.9% monthly core-availability objective; no dedicated availability SLA or premium 24-hour vendor support is assumed in the low-cost baseline. Devadathan and Mathew lead incident response, Josin financial reconciliation, Mathew AI/messages, Devadathan mobile/video, and Paul/Denzil bounded UI/content support. Tinu maintains defect/evidence status. The company provides clinical/operations escalation contacts. Maintenance and on-call labor are outside the hosting bill.

Define incident severity, pause/rollback authority, communication ownership, reconciliation procedure and recovery decision in the runbook. Recorded training covers front desk, warehouse, finance, physicians, content approvers and administrators. Verify company-owned repositories, billing/service accounts, encryption recovery and administrator access before handover.

## 13. Defect policy and final release criteria

### 13.1 Defect severity and gate treatment

| Level | Examples | Required disposition |
|---|---|---|
| P0 / Critical | Exposed patient data, unauthorized financial action, dangerous clinical output, destructive data loss, systemic outage or major compromise | Stop affected testing/release; contain, fix, independent review and reproduce/regression-test before any passing gate. |
| P1 / High | Double charge/booking, oversold stock, staff-MFA/role bypass, broken critical workflow, exploitable high security flaw or unrecoverable required operation | Blocks phase acceptance for implemented scope and blocks public release; fix and retest. |
| P2 / Medium | Incorrect supported edge case, degraded experience, report issue or lower-severity security weakness | Blocks whenever it violates a required acceptance, safety/privacy/financial control or capacity gate. Other genuinely limited-impact issues need documented company acceptance, owner and fix date. |
| P3 / Low | Cosmetic inconsistency or minor usability issue with no acceptance/control impact | Record and triage; only nonblocking items may remain with accountable follow-up. |

Security severity comes from exploitability, exposure and impact, not a scanner label alone. Every finding is triaged; a false positive needs evidence. No unresolved confirmed critical/high vulnerability is accepted merely to meet the date. No unresolved requirement, privacy/clinical/financial defect can be renamed “minor.” A gate cannot pass with failed or unexecuted mandatory tests for its due scope.

For each defect, record requirement/output ID, candidate/environment, reproduction, expected/actual behavior, impact, evidence, owner, severity, fix commit and retest result. Root-cause changes in identity, transactions, schema, queues or clinical logic require independent review and appropriate cross-feature regression. Restore/replay tests must verify persisted state, not just the HTTP response.

### 13.2 Gate G3 public-release conditions

- All R01–R38 final acceptance clauses have evidence; required features are integrated, enabled and usable on their required channel.
- G1 and G2 are passed and their critical regression remains valid on the final candidate. Full G3 test/capacity/recovery evidence identifies the deployed build/configuration.
- No unresolved P0/P1, confirmed critical/high vulnerability or acceptance-blocking P2 remains. Remaining permitted issues have company-approved impact, owner and follow-up date.
- Physician approval covers clinical content, translations, mandatory safety blocks, emergency/consult-only behavior and the full evaluation set. Privacy/consent/guardian/retention/deletion/export and finance/tax reviews are complete.
- Customer/staff/doctor authorization, pooled RLS context, mandatory staff MFA, private files, credentials and input/security controls pass final checks.
- Stock, price/tax, invoices/credit notes, recurring mandates, refunds, courier/COD, dose/refill jobs, loyalty/wholesale and cross-clinic booking/stock records reconcile.
- Live merchant/method/mandate eligibility, WhatsApp/SMS templates/sender readiness, courier, AI/voice/video quotas and required merchant/feed/listing approvals are verified.
- Android and iOS are approved and publicly installable with the complete customer scope. Submission, internal distribution and TestFlight are not public delivery.
- Workers Paid/Neon Launch production settings, database history, isolated bindings, TLS/DNS, secrets, alerts, backup/decryption/restore, rollback and support ownership are verified.
- Recorded role training, operating guides, company account ownership/recovery and the agreed handover are complete.
- Company product, physician, finance/operations owners and Mathew/Devadathan record the prelaunch decision; safe postdeployment verification closes G3 and Phase 3.

If required approval, capacity, data or safety evidence is missing on Day 10, record No-go and the unmet requirement/forecast. Do not launch a partial system and describe it as meeting the complete company scope.

## 14. Evidence package and phase approval protocol

### 14.1 Requirement status model

Use distinct states: **Planned → Implemented → Integrated → Tested → Company accepted → Public/operationally verified**. Track external provider/store status separately. A working sandbox result cannot automatically move a requirement to public verification; a screenshot cannot prove a backend invariant. Initial status for this master plan is Planned/Pending, not Passed.

Trace every item through `Rxx → phase output/work package → change/build → tests → defects/retest → company acceptance`. Preserve IDs in later phase/member plans. Test reports contain evidence links with access controls; exclude unnecessary patient content and credentials.

### 14.2 Mandatory gate report

| Report field | Required content |
|---|---|
| Identity | G1/G2/G3, date/time, candidate commit/builds, schema/config, model/prompt/KB versions |
| Scope | Due outputs and requirement milestones; all currently reachable routes/channels; external conditions still pending |
| Environment/data | Provider modes, database compute/pool/settings, dataset scale, devices/networks and real versus simulated integrations |
| Execution | Planned/executed/passed/failed/blocked tests by area; runtime and scan logs; manual reviewer findings |
| Invariants | Financial/stock/booking/access results, replay/crash behavior and control totals |
| Security/clinical | Findings with triage, role/ownership misuse evidence, physician evaluation and language approvals |
| Nonfunctional | Performance/resource/cost measurements and recovery/rollback achieved values, appropriate to the phase |
| Defects | Open/closed issues, severities, fix builds, independent reviews and retest evidence |
| Acceptance | Company reviews, allowed residual issues, missing dependencies and forecast impact |
| Decision | Pass/Rework; G3 prelaunch Go/No-go and postdeployment closure; named signatories |

Tinu assembles the report; domain owners provide evidence, with Devadathan operating specialist platform checks. Mathew and Devadathan verify the integrated technical decision and independently review sensitive changes. Company clinical/finance/operations/product reviewers accept their domains. Do not accept an author's unsupported “works on my machine” statement as a gate result.

Keep per-gate evidence packages G1, G2 and G3 in the company repository/artifact storage with exact build identifiers. No retrospective rewriting of a failed result; append the fix/retest record and new decision. If the tested candidate changes, record which evidence remains valid and what is rerun.

## 15. Daily integration, dependency and change control

Use one backlog keyed to R01–R38 and phase output IDs. Later phase work packages add effort, dependencies, responsible engineer/reviewer, contracts, files/components, tests and completion evidence. A task is complete only when code, migration, UI/integration, negative cases, observability and required documentation are integrated and tested.

Hold a short morning dependency/risk review, a midday integrated build and an end-of-day company demonstration. Record changed contracts, blockers, remaining effort and gate readiness. These meetings and reviews consume the existing capacity allocation. Prioritize stable shared contracts, one migration executor/review process and small reviewed changes; avoid long-lived isolated feature branches that integrate only on Day 6.

Freeze shared API/event/schema contracts early. Version any necessary change and update all web/native/WhatsApp/job consumers, tests and migration compatibility before merging. Keep secrets and real provider payloads out of repository examples. Every merge passes relevant automated checks; phase gates still run the broader cumulative campaign.

Architecture changes require a written reason, dependency/data impact, implementation/retest effort and operating-cost effect. Do not switch database engines, introduce another backend or add a new paid meeting/auth stack casually during the sprint. Preserve the agreed scope and update the forecast when evidence requires a change.

Track external approval/dependency status daily with owner, submission/reference, evidence, next action, required-by date and affected R IDs. Company account owners authorize live billing, production notifications and provider/store submissions; engineering records the resulting readiness evidence.


### 15.1 Branches and promotion authority

The proposed `main` / `dev` workflow is suitable. Each feature has its own branch **created from the latest `dev`**, then a reviewed pull request back into `dev`. Nobody develops directly on shared `dev` or `main`.

1. Protect both branches against direct pushes, force-pushes and unreviewed merges. Require relevant type/build, domain regression, secret/dependency/security and migration checks. A green build alone does not pass a phase.
2. Use the exact branch listed for each package below. One owner per branch. Tests/docs/chore branches also start from `dev` and target `dev`. Keep PRs bounded; do not mix unrelated fixes. Review-only work needs a review record, not an empty branch.
3. Mathew and Devadathan review each other’s critical changes. Mathew reviews Josin’s money/stock/subscription/credit/webhook changes. Devadathan reviews Paul/Denzil’s UI; Mathew or Josin also reviews relevant clinical/commerce boundaries. No author self-approves. Medical/tax expectations additionally require physician/finance approval.
4. Feature previews use isolated synthetic resources. Migrations are additive, ordered and independently reviewed. Devadathan is the controlled migration/deployment operator; Mathew is backup. A feature branch must never automatically migrate shared or production data.
5. Before each broad campaign, freeze `dev` at an exact SHA and create immutable candidate tags such as `rc-p1-g1-01`, `rc-p2-g2-01` and `rc-p3-g3-01`. Record API/web/native build IDs, schema/migration IDs, configuration, providers, model/prompt and KB versions. Tinu tests that exact deployed candidate. Freeze unrelated merges until the gate decision.
6. Fixes during the freeze use a short branch from the current frozen `dev`, PR back to `dev`, a **new** candidate tag and targeted plus critical cumulative retesting. Never overwrite a candidate tag. Other work may continue on isolated branches, but cannot change the tested candidate. Store execution evidence in CI artifacts/the test tracker; avoid changing the application merely to attach results.
7. After G1/G2 pass, Devadathan opens/merges the reviewed promotion PR `dev` → `main` using a regular merge that preserves ancestry. For Phase 3, the recorded **prelaunch Go** permits this promotion and controlled deployment; final G3 closure follows postdeployment checks. Do not squash/rebase the entire phase. Resolve conflicts before freezing/testing. Check that the promoted source tree matches the tested candidate, promote the tested artifacts and run post-merge critical smoke; a source/configuration difference requires retesting.
8. Tag accepted milestones on `main` as `phase-1-approved`, `phase-2-approved`, and, after final production checks, `v1.0.0`. Phase 1/2 merges represent accepted development milestones. They must **not** automatically publish an incomplete system to production. Gate production deployment separately until the Phase 3 prelaunch decision; close G3 only after postdeployment verification and required public channels pass.
9. Synchronize any promotion merge/hotfix history from `main` back into `dev` through a reviewed merge. Production hotfixes start from `main`, for example `hotfix/bug-001-payment-reconcile`, require review/impacted testing, then merge back into `dev`. Do not reset away integration history.

Example for a clean working tree and existing repository (substitute your assigned branch from the table):

```text
git fetch origin
git switch dev
git pull --ff-only origin dev
git switch -c YOUR_ASSIGNED_BRANCH
git push -u origin YOUR_ASSIGNED_BRANCH
```

Open a PR with **base `dev`**, the package/R IDs, behavior, test evidence, risk and reviewer. The example is an instruction for the future application repository; no repository changes are performed by this planning document.

## 16. Cost baseline and budget treatment

### 16.1 Development and testing

Use Neon Free for synthetic development while its storage/compute allowance fits. Keep preview/staging data isolated, stop idle test schedules and expire unnecessary environments. Local/preview success does not establish production performance. By Day 7, the verification environment uses the selected paid production configuration; upgrade earlier if quotas or representative tests require it.

Workers Paid is budgeted at the $5 account minimum, approximately ₹475/month at the ₹95/USD planning rate. Included usage is shared across environments, not a separate unlimited allowance per preview. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/). AI/voice test calls, messages, CI/native builds, objects and database history can generate charges. A free development database does not mean development is entirely free.

Record one-time build/account/approval expenses separately from recurring operation. The implementation-month test workload and CI usage may exceed a normal maintenance month's allowances. Pin vendor quotas and show measured usage at each gate; do not promise free resources indefinitely or disable required tests to preserve a free tier.

### 16.2 Production monthly planning figures

These figures carry forward the accepted Neon plan using ₹95/USD before taxes and invoice FX charges. The complete cost model is retained in the prior architecture document; the master baseline below is sufficient for delivery decisions and must be reforecast from observed usage.

| Scenario / component | Monthly planning amount | Assumptions |
|---|---:|---|
| Workers Paid | ₹475.00 | Base account plan, with overages monitored |
| Neon minimum production compute + 5 GB storage | ₹2,004.03 | Average 0.25 CU × 730 hours × $0.106 plus 5 × $0.35; not a capacity guarantee |
| Neon history + staging allowances | ₹285.00 | $1 history and $2 staging/recovery testing; actual retained changes and runtime metered |
| Text AI + embeddings | ₹830.30 | 18,000 model responses/month, average 2,000 input/300 output tokens; embedding allowance |
| Domain/email/independent backups + usage reserve | ₹427.50 | $3 allowance plus $1.50 reserve; modest retained data and usage |
| R2/Vectorize/Queues/WorkOS/modest signaling | ₹0 incremental forecast | Within stated vendor allowances; track all environments and usage |
| **Core platform/text AI modeled total** | **₹4,021.83** | Minimum average production compute; rounded line-item display |
| Voice transcription addition | ₹427.50 | 1,000 minutes/month |
| Apple annual-membership allocation | ₹783.75 | Annual payment spread monthly for comparison; local invoice can differ |
| WhatsApp/SMS allowance | ₹5,000.00 | Illustrative channel budget, not a verified volume/rate quote |
| **Full-service modeled total** | **₹10,233.08** | Same stated voice/store/messaging assumptions |
| **Recommended operating provision** | **₹11,000–₹13,000/month** | Typically average production compute near 0.25–0.5 CU under the declared scenario |

At average 0.5 CU, the core example becomes ₹5,859.60 and the full-service example ₹12,070.85. At average 1 CU, they become ₹9,535.15 and ₹15,746.40. Configure from load-test evidence and reforecast; the initial provision is not a ceiling. [Neon pricing](https://neon.com/pricing).

Payment gateway charges, courier/COD, taxes, staff/on-call/maintenance labor and optional paid vendor features are excluded. The video forecast assumes a proven reused WebRTC component and transport usage within allowance; a managed RealtimeKit alternative would add approximately ₹5,130/month at the previous 27,000 participant-minute scenario. Required scanning, premium builds/CI, extra storage or support need actual quotes if selected. A 3,000-user capacity test does not mean three times the operational usage costs the same.

Alert on spending trends and report them at each gate. Optimize caching, indexed queries, duplicated work, bounded AI context and consented communication. Keep required medical reminders, safety checks, all company features and approved clinical/financial retention even when cost exceeds forecast; escalate the measured budget change.

## 17. Risks, blockers and contingency decisions

| Risk / dependency | Accountable lead | Required response and decision point |
|---|---|---|
| Reuse/effort does not fit the protected build/test capacity | Mathew/all six | Validate on Day 1, reassess G1/G2; revise full-scope forecast rather than cutting tests or requirements. |
| G1 transaction/auth foundation fails | Mathew/Josin/Devadathan | Fix and rerun before dependent clinical/commerce completion is accepted. |
| Feature scope incomplete at Day 6 | Relevant domain owner/Mathew | Gate G2 Rework; expose exact R IDs, effort and release impact. Phase 3 is not hidden feature-build time. |
| Provider/mandate/templates/SMS/courier/listing approval delayed | Company owners with Josin/Devadathan/Mathew | Verify Day 1 and track daily; missing required live support blocks G3. |
| Android/iOS public approval delayed | Company owners/Devadathan | Prepare early, submit complete tested build Day 7, respond safely; pending review leaves R25 incomplete. |
| Video/native component requires new custom work | Devadathan/Mathew | Prove Day 1; revise effort or select/price a managed alternative before depending on it. |
| Medical content/translation unsafe or absent | Company physician/Mathew/Devadathan with Paul/Denzil | No invented approval; fix content/control and retest all affected languages/actions. |
| Residency/privacy policy conflicts with Singapore | Company privacy owner/Mathew | Resolve before patient use; change provider/region and update capacity/cost if required. |
| Production compute/pool or network path misses targets | Devadathan/Mathew | Optimize or resize and rerun; preserve UX/correctness over the initial smallest-compute estimate. |
| Duplicate events or uncertain external commit | Josin/Mathew/Devadathan | Reconcile using stable references; no repeated financial/stock effect; verify after crash/restore. |
| Vulnerability, leaked secret or unauthorized data access | Mathew/Devadathan/domain owner | Contain/rotate/fix, assess affected data, independent review and repeat applicable broad checks; no passing gate with blocker. |
| Backup/restore/alert/support evidence fails | Devadathan/company operations | Repair and rehearse; final operational readiness remains incomplete. |

No contingency assumes extra engineers, unapproved overtime or an automatic deadline extension. When evidence changes the plan, record the company requirement affected and the new forecast openly. Keep the accepted scope intact.

### Integrated review: explicit proposal acceptance details

These details clarify existing R IDs from the company proposals/accepted master; they do not add a later release or another architecture. They must be included in the existing named package estimates. Prove reuse/review capacity on Day 1 and reforecast if the clarified work does not fit; the unchanged 480-hour budget is not new evidence of feasibility.

| Clarification | Source / requirements | Named execution packages | Acceptance and testing |
|---|---|---|---|
| C01 — Complete approved product knowledge and bounded refresh | Companion pp. 4, 8–9: initial approved knowledge covers every website product; updated approved content reaches answers. R01, R16, R17 | P1-MAT-003, P1-DEN-002, P2-MAT-002, P2-DEN-003, P3-MAT-001 | Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone. Evidence: P1-T12, P2-T13, P3-T09, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C02 — Knowledge entry usage analytics | Companion p. 6: staff can see which knowledge entries the assistant uses most. R16, R35 | P2-MAT-002, P2-MAT-004, P2-DEN-003, P2-DEN-004, P3-DEN-002 | Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report. Evidence: P2-T13, P2-T31, P3-T15, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C03 — Explicit intake and consent checkpoints | Companion pp. 5, 7: age/current medication screening, pregnancy/children/red flags; sign-up consent and recorded video consultation identity/consent. R14, R19, R36 | P1-MAT-001, P1-MAT-003, P1-DEV-003, P2-MAT-001, P2-MAT-002, P2-DEV-001, P2-DEV-002, P3-MAT-001 | Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Evidence: P1-T02, P1-T13, P2-T10, P2-T15, P3-T08, P3-T10, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C04 — Front-desk outpatient booking and permitted patient order history | Companion pp. 6, 8: staff enter outpatient bookings; assigned doctors see permitted patient past orders. R03, R11, R12, R14 | P1-MAT-002, P2-MAT-001, P2-JOS-004, P2-DEV-001, P2-DEN-001, P3-MAT-001 | Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch. Evidence: P2-T04, P2-T09, P2-T10, P3-T07, P3-T08, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C05 — Automatic invoice delivery, not only PDF generation | Ecommerce pp. 3–4, 6: GST invoice generated and sent with every order. R07, R08 | P2-JOS-001, P2-JOS-004, P2-MAT-004, P3-JOS-002 | After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut. Evidence: P2-T06, P2-T33, P3-T06, P3-T17, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C06 — New-product, restock and seasonal past-buyer campaigns | Ecommerce pp. 3, 7: opted-in past buyers segmented by what they bought; new-product, restock and seasonal campaigns. R27, R28 | P2-MAT-004, P2-JOS-004, P2-DEN-002, P3-MAT-002, P3-DEN-001 | Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients. Evidence: P2-T23, P2-T24, P3-T16, P3-T17, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C07 — Explicit maintenance calendar and ownership | Ecommerce pp. 6, 8; Companion pp. 7–8: security updates/app releases/priority fixes, monthly flagged-conversation review, knowledge-update allowance and quarterly report. R37, R38 | P2-MAT-002, P2-DEV-003, P2-DEN-004, P3-MAT-080, P3-DEV-080, P3-DEN-080, P3-TIN-080 | Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders. Evidence: P2-T36, P3-T28, P3-T29, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C08 — Numeric job pickup and availability measurement | Accepted master §§11–12: healthy-state due-job pickup p95 <2 minutes and 99.9% monthly core availability objective. R10, R38 | P1-DEV-001, P2-MAT-004, P2-DEV-003, P3-DEV-001, P3-DEV-090 | Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing. Evidence: P1-T20, P2-T33, P3-T21, P3-T23, P3-T28, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |

## 18. Document sequence and completion checklist

### 18.1 Current document registry and precedence

| Document | Current authority / purpose |
|---|---|
| 01 | Governing scope/architecture/acceptance, named capacity and phase gates; existing R01–R38 remain required. |
| [02 — Phase 1](Kandamkulathi_02_Phase_1_Foundations_and_Core_Journeys.md) | Current integrated outputs, named package/branch/day register, retained unbudgeted technical references and gate criteria. |
| [03 — Phase 2](Kandamkulathi_03_Phase_2_Complete_Features_and_Integration.md) | Current integrated outputs, named package/branch/day register, retained unbudgeted technical references and gate criteria. |
| [04 — Phase 3](Kandamkulathi_04_Phase_3_Production_Verification_and_Launch.md) | Current integrated outputs, named package/branch/day register, retained unbudgeted technical references and gate criteria. |
| [05 — Mathew](Kandamkulathi_05_Mathew_All_Phases.md) | Current named tasks, boundaries, hours, handoffs, reviewer and exact branches for all three phases. |
| [06 — Josin](Kandamkulathi_06_Josin_All_Phases.md) | Current named tasks, boundaries, hours, handoffs, reviewer and exact branches for all three phases. |
| [07 — Devadathan](Kandamkulathi_07_Devadathan_All_Phases.md) | Current named tasks, boundaries, hours, handoffs, reviewer and exact branches for all three phases. |
| [08 — Paul](Kandamkulathi_08_Paul_All_Phases.md) | Current named tasks, boundaries, hours, handoffs, reviewer and exact branches for all three phases. |
| [09 — Denzil](Kandamkulathi_09_Denzil_All_Phases.md) | Current named tasks, boundaries, hours, handoffs, reviewer and exact branches for all three phases. |
| [10 — Tinu](Kandamkulathi_10_Tinu_QA_and_Test_Cases_All_Phases.md) | Current named tasks, boundaries, hours, handoffs, reviewer and exact branches for all three phases. |
| [11 — Tinu standalone tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Canonical test execution: all 38 requirements, 86 phase groups, 38 detailed walkthroughs; no separately maintained embedded test copy. |
| [12 — Integrated review](Kandamkulathi_12_Integrated_Review_and_Consistency_Report.md) | Review findings/corrections, source mapping, consistency evidence and unresolved real-world delivery conditions. |

Earlier unnumbered architecture/cost plans are explicitly superseded historical alternatives, including the earlier Neon revision; do not execute their old roles, dates, database/auth services or prices as a second baseline. R01–R38 acceptance and protected test gates remain authoritative. Named task IDs and branches supersede old E-role hour/day schedules while preserving all 103 source package references.

### 18.2 Master delivery checklist

- [ ] Day 1 readiness/reuse/effort and company dependencies recorded; six owners and reviewer backups named.
- [ ] All R01–R38 requirements remain tracked with the original acceptance evidence and required channels.
- [ ] PostgreSQL is used from development; shared test/prod isolation and the paid verification transition are verified.
- [ ] Phase 1 outputs and broad cumulative testing pass; G1 report identifies the actual candidate.
- [ ] Phase 2 complete features and broad cumulative testing pass; G2 report exposes all external/public dependencies.
- [ ] Phase 3 functional/security/clinical/device/capacity/recovery campaign passes on the final production candidate.
- [ ] No unresolved release blocker or unreviewed mandatory test/finding remains; fixes have independent review and retest evidence.
- [ ] Company approvals, opening balances, live providers, required listings and publicly installable Android/iOS are verified.
- [ ] Recorded training, service/source/data ownership, guides, backup recovery, support and measured budget are handed over.
- [ ] G3 prelaunch Go and postdeployment verification are recorded; all required channels are operating before full delivery is declared.

The project is complete only when these outcomes are evidenced. This document supplies the master plan; later task plans make execution precise without reducing company scope, substituting a different architecture or weakening any phase gate.
