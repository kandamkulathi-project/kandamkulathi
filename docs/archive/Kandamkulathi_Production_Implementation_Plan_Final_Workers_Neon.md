# Kandamkulathi Digital Commerce & Companion

> **SUPERSEDED — historical architecture only** (integrated review, 19 October 2026). Use the numbered [current master](../implementation/Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md), phase/member plans 02–10 and [canonical tests](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). Do not execute this document’s old database/auth stack, E-role schedule or cost assumptions as a current baseline. Its scope history is retained for comparison; current architecture is Workers Paid + Neon PostgreSQL from development, with paid production-equivalent verification by Day 7. Pricing here is historical planning, not a newly verified current quote.

## Final Production Implementation Plan — Cloudflare Workers Paid + Neon PostgreSQL

**Prepared for:** Kandamkulathi Ayurveda Vaidyasala\
**Revision:** 19 October 2026; supersedes the previous Cloudflare D1 architecture baseline\
**Scope:** All 38 company requirements; web, WhatsApp, Android, iOS and staff/physician workspaces\
**Team:** Six full-time engineers; 60 person-days across ten working days\
**Production stack:** Cloudflare Workers Paid, Neon Launch PostgreSQL 17, R2, Vectorize, Queues/Cron, Durable Objects, WorkOS AuthKit and OpenAI API\
**Initial audience:** Approximately 1,000 daily active users; validate a 3,000-user capacity envelope\
**Delivery target:** 19–30 October 2026; monitored launch support through 1 November 2026\
**Monthly modeled cost:** Approximately ₹4,022 core platform/text AI with minimum production compute; approximately ₹10,233 including the stated voice/store/messaging scenario\
**Operating provision:** ₹4,500–₹6,500/month core, or ₹11,000–₹13,000/month for the stated full-service scenario; before taxes, transaction/fulfillment fees and labor\
**Currency assumption:** ₹95/USD for budgeting; actual invoice exchange rates, local prices and taxes vary.

Every R01–R38 requirement remains mandatory. This document defines implementation and acceptance; it is not evidence of an already deployed or verified application. Full delivery in two weeks depends on tested reusable foundations, ready company content/accounts and external approvals. Submission, a mock or a disabled feature does not satisfy release.

## 1. Architecture decision and delivery feasibility

Use **Cloudflare Workers Paid + Hono + TypeScript** for application APIs, **Neon Launch PostgreSQL 17** for authoritative business/clinical data, Astro/React for web, and Expo/React Native for Android/iOS. Retain R2 files, Vectorize approved public retrieval, Queues/Cron durable jobs, WorkOS AuthKit identity and OpenAI controlled conversation. No separate always-on application server is required.

The implementation is one modular repository with commerce, inventory, scheduling, clinical, knowledge, engagement and audit modules. Core API and Companion have separate Worker entry points and budgets. PostgreSQL transactions own stock, money, appointment and consent invariants; the model proposes bounded actions through authenticated services. Shopping, booking and staff workflows continue when AI is unavailable.

Use one production Neon database with separate core, clinical and engagement schemas and least-privilege roles. Schema separation improves ownership and access control; it does not create independent compute or eliminate contention. Keep reports summarized, public content cached and background work bounded. A second production database/compute is not part of the low-cost launch baseline. Staging is isolated and uses synthetic data. Vectorize keeps semantic search outside the small transactional database; pgvector is not a launch dependency.

Neon is reached through its supported serverless driver over HTTPS/WebSockets with certificate verification. This design does not require a self-managed private database network, connector hosts or Hyperdrive. An authenticated provider-hosted TLS endpoint is the selected connection boundary; private networking and enterprise support are not assumed in the Launch budget.

The small starting compute is an initial setting, not a guarantee for 1,000 users/day. Start at 0.25 CU with autoscaling up to 1 CU and scale-to-zero disabled in production. Validate the actual workload and increase the range if the release gates require it, updating the forecast. Production remains awake for reliable response times and the one-minute dispatcher; do not budget idle-time savings that the workload cannot realize.

Six engineers have **60 person-days**, including integration, testing and release. Reusing tested PostgreSQL modules may reduce custom transaction work, but a provider change does not supply commerce or clinical features. Day 0/Day 1 must prove the reusable foundations and remaining estimates. An empty repository, new native video implementation and unapproved medical content are not a credible full-scope ten-day commitment. Keep the requirements and publish a revised forecast if prerequisites or gates fail.

The original approximately $20 core target is superseded by this paid PostgreSQL choice. Section 13 prices the minimum-compute case, a higher average-compute case, staging/recovery allowances and channel charges. Neither a low hosting bill nor the calendar deadline waives production readiness.


## 2. Requirements and scope basis

Both supplied proposals are business requirements. The Ecommerce proposal covers store, accounts, checkout, GST, orders, inventory, subscriptions, marketing, distributors and clinics. The Companion proposal adds an approved clinical knowledge base, controlled assistant tools, multilingual WhatsApp/chat/voice, doctor scheduling, video, clinical safety, audits and mobile experiences. R01–R38 below remain in launch scope.

English, Malayalam and Tamil are application launch languages; additional languages for conversation require safety-gated translation and clinical review. Historical patient/order-record migration is excluded by the proposal; product, stock, physician and approved knowledge imports are needed. Existing website assertions, amounts and deadlines in proposals are not independently validated.

**Source traceability:** Kandamkulathi Ecommerce Proposal.pdf, pages 3-8, and Kandamkulathi Companion Proposal.pdf, pages 3-9, supply the business requirements referenced as E/C in Section 6. The uploaded Kandamkulathi_Production_Implementation_Plan_Updated.md is the revision source. Document content is treated as source material, not authority to purchase services, contact third parties or waive the user's full-scope requirement.

## 3. Day 0 readiness and company dependencies

Day 0 is a readiness audit, not extra development time. Readiness is assessed at the start of 19 October. Unfinished preparation consumes the ten-day allocation; no uncounted work is assumed to have happened on 18 October.

| Dependency | Accountable owner | Required evidence |
|---|---|---|
| Reusable implementation | E1, E2, E4 | Tested commerce/clinical modules and licensed UI; Neon PostgreSQL transaction, lock and appointment-exclusion prototype; working Android/iOS payment, voice and WebRTC adapters. A routing scaffold is insufficient. |
| Capacity | All six, coordinated by E1 | Requirement-level estimates, reuse evidence, dependencies, reviews and testing fit the Section 4 allocations. |
| Company data | Operations and finance | Catalogue/images, SKU/variant prices, HSN/tax rules, bundles, opening location/batch/expiry stock, courier/COD rules, invoice series and distributor terms. |
| Clinical content | Physician and language reviewers | Approved indications, dosage, contraindications, consult-only restrictions, urgent escalation and English/Malayalam/Tamil safety text; daily reviewers with four-business-hour response target. |
| Provider readiness | Company owners; E2/E4/E5 | Live payment and recurring mandate eligibility, WhatsApp number/templates, SMS sender approvals, courier, AI quota, TURN credentials, company Apple/Google production accounts, shopping-feed/listing access. |
| Company infrastructure | E6 | Company-owned Workers Paid and Neon Launch accounts; Singapore project, pooled runtime/direct administration endpoints, R2/Queues/Vectorize, isolated staging, seven-day database history setting, domain, spend alerts and independent encrypted backup destination. |
| Identity and privacy | E1 and company reviewers | WorkOS staff organization with required MFA; customer/native sign-in proof; role/clinic/patient assignment; processor, residency, consent, retention and guardian review. |
| Database readiness | E1/E2/E6 | PostgreSQL 17, btree_gist extension, pooled driver transactions, TLS, role privileges, effective connection limit, restore path and latency from Indian test locations verified; no production Free-tier quota dependency. |
| Video feasibility | E4 and E1 | Reusable authenticated web/native private calling component tested on real devices, mobile networks, camera/mic denial and reconnect; bitrate and TURN metering measured. |
| Acceptance and support | Company product owner | Daily physician/front-desk/warehouse/finance availability, release approvers and named support rotation. Company reviewers are not additional engineers. |

**External deadlines:** Check the actual Google Play account's production eligibility; some new personal accounts require a closed-testing period that development cannot compress. See [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB). Begin listings and privacy declarations on Day 1; submit the tested complete candidate on Day 7. Pending review is not public availability. Do not substitute test distribution for either required public app.

## 4. Six-person delivery team and capacity control

| ID | Engineer | Accountable workstream | Required supporting work |
|---|---|---|---|
| E1 | Technical lead / clinical backend | Module/API contracts, WorkOS/session authorization and PostgreSQL transaction review, clinic/patient access, doctor scheduling, consultations, consent, recommendations and medicine schedules | Reviews E2 transactions, leads clinical UAT and scope/effort reviews. |
| E2 | Commerce backend | Catalogue, prices, cart, payments/refunds, GST, FEFO batch inventory, subscriptions, courier, bundles, wholesale and loyalty ledger | E1 reviews data consistency; E3 builds management screens; E5 connects notification events. |
| E3 | Web / back office | Astro storefront, React account/staff/physician workspaces, approved-content editor, three-language UI, campaigns, reports and SEO/feeds | Reuses audited UI modules; pairs with E1/E2 for integrated workflows. |
| E4 | Mobile | Shared Android/iOS customer app, native payments/video/voice, secure auth, deep links, push, build and public store release | Shares contracts/locales with E3, connects E5 chat endpoints, owns real-device regression. |
| E5 | AI / integrations | Hybrid retrieval, controlled responses/tool calls, WhatsApp, voice processing, messaging, handoff/callbacks and funnel events | E1 authorizes clinical/action tools; E6 owns infrastructure; E5 implements message/ingestion job handlers. |
| E6 | Platform / quality | Workers/Neon/R2 infrastructure, CI/CD, migrations, Queues/Cron dispatcher, monitoring, capacity and recovery evidence | All engineers write tests for their domains and support UAT. E6 does not individually test every feature. |

### 4.1 Capacity envelope

| Engineer | Build and integration | Verification and UAT | Release/handover | Defect contingency | Total person-days |
|---|---:|---:|---:|---:|---:|
| E1 | 6.5 | 2.0 | 1.0 | 0.5 | 10 |
| E2 | 7.0 | 1.5 | 0.5 | 1.0 | 10 |
| E3 | 7.0 | 1.5 | 0.5 | 1.0 | 10 |
| E4 | 6.5 | 2.0 | 1.0 | 0.5 | 10 |
| E5 | 6.5 | 2.0 | 0.5 | 1.0 | 10 |
| E6 | 5.0 | 3.0 | 1.0 | 1.0 | 10 |
| **Total** | **38.5** | **12.0** | **4.5** | **5.0** | **60** |

These allocations are an engineering capacity limit, not proof that all feature estimates fit. Before Day 1 implementation, break each R01-R38 requirement into tasks with owner, dependency, reusable asset, remaining effort and test evidence. Each engineer signs off their workstream estimate. If a workstream exceeds its allocation, E1 must revise the forecast immediately; assigning additional responsibilities to the same person does not create capacity.

Reviews and integration happen daily inside these allocations. Recheck remaining effort on Days 1, 3 and 6. Use a short morning coordination meeting, midday integrated build and end-of-day company demonstration. Keep one backlog keyed to R01-R38. Weekend development is not assumed; 31 October-1 November is a planned support rotation for the delivered system.

## 5. Final selected stack and architecture boundaries

| Layer | Selected implementation | Production boundary |
|---|---|---|
| Repository | TypeScript, pnpm workspaces, shared Zod/API/event contracts | One repository and pinned compatible dependencies; supported Node LTS for build/migration tools. |
| Public web | Astro + React islands, Tailwind; Cloudflare static assets/CDN | Cache approved public catalogue/concern pages; publish/invalidate by version. Reprice and revalidate stock at checkout. |
| Workspaces | React/Vite, TanStack Query/Router | Customer, front-desk, finance, warehouse and physician access; English/Malayalam/Tamil UI and accessibility. |
| Mobile | Expo/React Native, Expo Router | Real native payment/WebRTC adapters, voice, push and deep links; publicly released Android/iOS. |
| Application APIs | Workers Paid, Hono, Zod; separate Core/Companion entry points | Central access checks and domain logic; internal calls through service bindings. |
| Database | Neon Launch, PostgreSQL 17, Singapore; Drizzle PostgreSQL migrations | One authoritative production database; core/clinical/engagement schemas and restricted roles; separate synthetic staging environment. |
| Database connection | @neondatabase/serverless; HTTPS for suitable single/batched operations; WebSocket Pool/Client for interactive transactions | Provider pooled endpoint for runtime; direct endpoint for controlled migrations/pg_dump. Verified transport, bounded per-request connections and cleanup. |
| Compute | Production 0.25–1 CU initial autoscaling range; no scale-to-zero | Release-test the minimum and scale-up path; increase resources on measured evidence. Staging may suspend. |
| Identity | WorkOS AuthKit, standard hosted domain | Customer sessions and organization-scoped mandatory staff MFA; application roles/clinic/patient assignment in PostgreSQL. |
| Files | R2 Standard public/private/quarantine buckets or prefixes | Immutable versioned keys, scoped downloads, safe uploads, consent/retention metadata in PostgreSQL. |
| Retrieval | Vectorize + PostgreSQL exact SKU/alias/indexed keyword search | Derived approved public content only; recheck approval/version and mandatory safety records against primary data. |
| Model | OpenAI Responses API; GPT-4o-mini costed candidate, freeze a tested supported version | Clinical/action evaluation determines suitability. Approved medical blocks remain separately enforced. |
| Embeddings/voice | text-embedding-3-small at 1,536 dimensions; gpt-transcribe | Bounded audio and editable transcript; explicit confirmation before actions. |
| Background jobs | PostgreSQL outbox/due jobs, Workers Cron and separate Cloudflare Queues | Financial/fulfillment, clinical/scheduled and engagement workers have separate concurrency; lease/retry/DLQ/reconciliation. |
| Video | Reused WebRTC web/native component, Durable Object signaling and Cloudflare TURN | Booking-scoped expiring credentials; media bypasses APIs; test network recovery and privacy. |
| Payments | Razorpay Checkout and Subscriptions; separate COD workflow | Enabled UPI/card/net banking/eligible EMI; real recurring mandate lifecycle. |
| Shipping | Shiprocket | Serviceability, rates, labels/pickup, tracking, returns and COD settlement reconciliation. |
| Messaging | Meta WhatsApp Cloud API, MSG91 SMS, low-volume transactional email, Expo Push | Required channel flows, consent/templates, identity linking, deduplication and delivery status. |
| Delivery/monitoring | Wrangler, infrastructure configuration, GitHub Actions, Cloudflare/Neon metrics and independent uptime checks | Company-owned accounts; restricted deploy secrets; scrubbed logs; tested release/rollback and spend alerts. |
| Recovery | Neon point-in-time recovery, nightly encrypted pg_dump, R2 object manifests/copies | Seven-day configured database history plus independent exports; prove restore and external-provider reconciliation. |

### 5.1 Runtime flow

```text
Browser / Android / iOS / WhatsApp / signed provider webhooks
                         |
                 Core API Worker (Paid) ----- WorkOS
                   |              |
          Neon pooled endpoint    R2 public/private files
                   |
           PostgreSQL primary (Singapore)
            core / clinical / engagement
                   |
              outbox + due jobs <----- Cron every minute
                   |
        Cloudflare Queues: finance / clinical / engagement
                   |
         bounded consumers + retries + DLQs
          payment / courier / messaging providers

Companion Worker -> authorized Core domain actions
       |-> current PostgreSQL KB/safety records
       |-> Vectorize approved public corpus -> OpenAI

Consultation clients -> authenticated Durable Object signaling
                     -> peer media / Cloudflare TURN relay
```

### 5.2 Database driver, pooling and authorization

Use HTTPS queries for independent parameterized operations or known non-interactive batches. Use the driver's WebSocket Pool/Client within one Worker request for BEGIN, validated conditional logic, COMMIT/ROLLBACK. Acquire once, use the same client throughout, rollback on error and release/close in finally. Start with a maximum of two driver connections per invocation; this is not a global two-connection cap. Avoid unbounded parallel queries and persistent module-global live WebSocket clients. [Neon driver guidance](https://neon.com/docs/serverless/serverless-driver).

All runtime endpoints use the provider's pooled connection string. Record actual backend max_connections, active sessions, lock waits and pool wait under the chosen compute; a large advertised client-pool limit is not database execution capacity. Keep connection/statement/lock timeouts bounded by endpoint needs. Long exports and migrations use an administrative direct endpoint with distinct credentials. No database credential, Neon management key or raw SQL endpoint is exposed to the browser, app or model. No Hyperdrive cache sits between clinical/transactional operations and PostgreSQL.

Preserve Secure/HttpOnly/SameSite web sessions, CSRF protection, revocation and bounded lifetimes. Native sign-in uses the system browser and a proven authorization-code/PKCE integration. Validate issuer, audience, expiry, session and organization claims at the API. Staff routes require the dedicated staff organization with MFA required; customer sign-in cannot bypass staff policy. Use TOTP, and map identity to explicit role, clinic and patient assignment. [WorkOS organization policies](https://workos.com/docs/authkit/organization-policies).

Application authorization remains mandatory on every route, query and assistant tool. Use a non-owner, non-BYPASSRLS runtime role; apply tested row-level-security policies to patient/customer-owned tables as defense in depth. Any actor/clinic context uses transaction-local settings on the same connection, never a session-global setting that can leak through pooling. Job policies grant only their documented service scope. Test patient/clinic crossover and pooled connection reuse. Migration/backup owners are separate and unavailable to normal API paths.

AuthKit's standard hosted domain and included MFA are the selected baseline; enterprise SSO, paid custom domains and the paid WorkOS audit product are not required. Keep company application audits in PostgreSQL and protected exports. Verify current free-tier terms and processor approval. [WorkOS pricing](https://workos.com/pricing).

### 5.3 Storage, ingestion and region

Keep files out of relational rows. Store optimized product images publicly in R2, and clinical/source documents privately with immutable keys, hashes, record ownership, consent and version references. Reauthorize downloads, use short-lived scoped links and safe content disposition; never log bearer URLs. Retain object versions needed for the recovery window.

The knowledge base uses structured reviewed text and translations. Bound file size, parsing, queue concurrency and processing time; arbitrary OCR/large binary processing is not assumed to fit a normal Worker request. Quarantine uploads and verify type/content; serve untrusted attachments only through a verified scanning/sanitization path. Existing company scanning may be reused; a required paid scanning service needs a separate cost quote. Structured clinical records and approved attachments remain supported.

Select **Neon AWS Singapore, aws-ap-southeast-1**, and measure India-to-Worker-to-database latency. The published region list currently includes Singapore and does not list Mumbai. The project region is fixed at creation. This design therefore **does not provide India-only health-data storage**. Approve overseas processing and every R2/identity/AI/messaging/video data flow before patient use. If India-only residency is mandatory, change provider/region and forecast before launch. [Neon regions](https://neon.com/docs/introduction/regions).


## 6. Complete R01-R38 company requirements and acceptance matrix

**Notation:** E = ecommerce proposal; C = Companion proposal; page references point to the supplied PDFs. All 38 rows are required for full launch. Build targets D1-D6 follow the single schedule in Section 10; native submission is D7 and public release is D10, conditional on approval and all Sections 11-12 gates. A build target is not final acceptance. Supporting engineers are identified where necessary, but each row has one accountable owner.

| ID | Requirement / source | Launch acceptance evidence | Owner / build target |
|---|---|---|---|
| R01 | Catalogue and shop by health concern; E4-5, C4 | All current-site products imported with variants, approved descriptions, images, prices, concern filters and stock visibility. Brand/certification claims approved by the clinic. | E3 / D3 |
| R02 | Cart and Indian checkout; E3-4, C4 | Web and native purchase through enabled UPI/card/net-banking/eligible EMI methods; COD rules enforced server-side; totals cannot be altered by clients. | E2 / D3 |
| R03 | Accounts, addresses, history, reorder, tracking; E3, C4 | Verified user sees only their orders/invoices; repeat order uses current price, eligibility and available stock; tracking updates visible. | E3 / D4 |
| R04 | Unified order desk including phone/walk-in/WhatsApp; E6, C6 | Staff create and fulfill an order with a recorded source; WhatsApp checkout produces the same order record; packing lists and cancellation/return/refund states are usable. | E2 / D4 |
| R05 | Batch/expiry, low stock and near-expiry operations; E6, C6 | Batch ledger, expiry/shelf-life exclusion, FEFO allocation, low-stock alerts, adjustments and a recall lookup from batch to customers. Concurrent last-unit test passes. | E2 / D4 |
| R06 | Courier and pan-India fulfillment; E6-7 | Pincode serviceability, rates, courier label, pickup, tracking and COD reconciliation tested with the selected courier. Unserviceable addresses cannot check out. | E2 / D5 |
| R07 | GST invoices, reconciliation and accounts export; E3, E6, C6 | Finance-approved CGST/SGST/IGST cases, numbering, PDF/translated display labels, refund credit-note process and monthly CSV export; a live charge/refund is reconciled. | E2 / D5 |
| R08 | Automated WhatsApp/SMS order updates; E3-4 | Confirmation, dispatch, out-for-delivery and delivery messages use real events/tracking links, approved templates and deduplication. | E5 / D4 |
| R09 | Recurring subscriptions; E4, E7, C4 | Authorize a real eligible mandate; cycle billing, exactly one renewal order, payment failure, pause/resume/cancel and stock-shortage handling verified. An accelerated sandbox renewal exercises the full cycle. | E2 / D5 |
| R10 | Refill and daily medicine schedules; E4, C4 | Physician-authored dose, morning/evening and before/after-food instructions drive timezone-aware reminders; refill quantity/due date uses the approved schedule or confirmed customer interval; edits/cancellation stop stale reminders. | E1 / D5 |
| R11 | Physician directory, locations, slots, leave and fees; C4, C6 | Staff configure departments, credentials, languages, per-location hours, online/in-clinic slots, leave and default/per-doctor fees. Cross-location double booking is prevented. | E1 / D3 |
| R12 | Booking, fee payment, reschedule/cancel/refund; E4, C4 | One slot cannot be sold twice; holds expire; late payment is reconciled; notifications and policy-based refunds work. | E1 / D4 |
| R13 | Embedded video consultations; C4 | Patient and assigned doctor join a private call inside web/native apps; permissions, poor network, reconnect and unauthorized joining are tested. | E4 / D5 |
| R14 | Physician panel and linked patient record; E6, E8, C6 | Doctor sees assigned consultations, permitted history and consented chat summary; records identity/consent, notes and recommendations with an audit trail. | E1 / D4 |
| R15 | Consult-to-cart; E4, C3-4 | Signed physician recommendation becomes an editable patient basket; consult-only products require a valid matching recommendation; dosage remains unchanged by the assistant. | E1 / D5 |
| R16 | Approved knowledge-base editor; C4, C6 | Product monographs, departments/treatments, FAQs, policies and selected Ayurveda references support draft, named approval, version history, withdrawal and reviewed dosage/safety translations. | E3 / D4 |
| R17 | Grounded, cited Companion; C3-4, C7 | Responses trace to currently approved entries and approving physician; missing/stale/unsupported medical knowledge produces an approved handoff response. | E5 / D4 |
| R18 | Conversational product/order/refill/slot actions; C3-4 | Authenticated tools retrieve authorized records; add-to-cart, booking and payment steps require an explicit customer confirmation and display real current state. | E5 / D5 |
| R19 | Red flags, consult-only rules and disclaimers; C5, C7 | Physician test pack passes emergency/high-risk escalation; no diagnosis/cure promise; required disclaimer and named approval appear. No automated sale is initiated from a flagged conversation. | E5 / D5 |
| R20 | Human handoff, callback and conversation review; C3, C6-7 | Staff take over an active chat with summary; assistant pauses; after-hours callback queues, WhatsApp acknowledgement, unanswered-question queue and resolution reporting work. | E5 / D5 |
| R21 | Same assistant on WhatsApp; C3-5, C8 | Real clinic number supports text/voice input, safe product actions, identity-linked order lookup, booking and a secure Razorpay checkout flow from the conversation. Staff can reply through the console. | E5 / D5 |
| R22 | English, Malayalam and Tamil application; C4 | Store, native app, menus, checkout, invoice labels and notifications have reviewed translations, usable fonts and no missing keys; medical wording is physician-reviewed. | E3 / D5 |
| R23 | Other Indian-language and Romanized conversations; C4 | Evaluate Hindi/Kannada/Telugu plus launch languages and representative Romanized inputs; preserve approved clinical text and fall back safely when a translation cannot be verified. | E5 / D6 |
| R24 | Voice input; C4, C8 | Web/mobile microphone and WhatsApp voice messages transcribe into editable/reviewable text; permission denial and ambiguous numbers/units are handled. No action is triggered directly from an unchecked transcript. | E4 / D5 |
| R25 | Complete Android and iOS customer apps; E8, C8 | Both production apps include store, checkout, assistant, booking/video, reminders, subscriptions, history, loyalty and referrals; signed, reviewed, publicly obtainable releases. | E4 / D6 build; D10 release |
| R26 | Bundles and discounted courses; E7 | Approved product kits/course prices calculate consistently across channels and cannot bypass consult-only or stock restrictions. | E2 / D4 |
| R27 | Opt-in WhatsApp campaigns and segments; E3, E7 | Staff send/schedule an approved template to a consented segment; opt-outs, quotas, delivery results and purchase attribution are visible. Health-interest segmentation requires explicit business/privacy approval. | E5 / D6 |
| R28 | Seasonal offers and landing pages; E7 | Staff publish/schedule a branded campaign page and valid promotion; start/end times and redemption limits are enforced; the first clinic-approved campaign is configured for launch. | E3 / D5 |
| R29 | Abandoned-cart recovery; E7 | Eligible consented cart receives one scheduled reminder after the approved delay; completed/cancelled carts and unsubscribed users are suppressed; recovery link is scoped and expiring. | E5 / D5 |
| R30 | Verified-buyer reviews and physician content; E7 | Review eligibility checks completed purchase; moderation and publication controls work; approved physician notes are visible beside products. | E3 / D5 |
| R31 | Referrals and loyalty; E7, C8 | Share link, eligible first-order credit, points/credit ledger, redemption caps, refund reversal and basic self-referral/fraud prevention pass. | E2 / D6 |
| R32 | Multiple clinics; E8 | Location-specific stock, physician availability, staff access and sales reports work for two configured clinics; inter-location stock moves retain batch traceability. | E1 / D5 |
| R33 | Wholesale/distributor ordering; E8 | Approved business account sees assigned price list, MOQ/pack size and permitted payment terms; account approval, fulfillment and GST records are auditable. | E2 / D6 |
| R34 | SEO and shopping/business listings; E3, E7 | Product schema, canonical URLs, language alternates, sitemap, redirects and merchant product feed validate; company listing linkage is configured. Required merchant/feed approvals are recorded; approval pending is distinguished from a working feed and remains an open launch requirement. | E3 / D6 |
| R35 | Sales, retention and clinical conversion reports; E6-7, C6, C8 | Product/concern/city/clinic sales, repeat rate, refill due/lapsed, subscription state, conversation-to-cart/order/booking/handoff, and consultation-to-order metrics reconcile to operational records. | E3 / D6 |
| R36 | Roles, privacy, audit and ownership; C6-7 | Per-role and per-record tests pass; sensitive actions are logged; accounts, source, data and deployment access belong to the company; consent/retention workflows operate. | E1 / D6 |
| R37 | Onboarding and recorded training; C8 | Front desk, warehouse, finance and physicians each complete role-specific scenarios; recordings, guides, access recovery and incident contacts are handed over. | E6 / D9 |
| R38 | Production operations and maintenance readiness; E6, C8 | Monitoring, backups, tested restore, release/rollback, payment reconciliation, escalation ownership and scheduled content-review procedures are operating. | E6 / D9 |

**Channel interpretation:** The native apps provide the full customer experience. Staff/physician operations are delivered through web workspaces unless the proposals expressly require a customer action inside the app. WhatsApp uses secure provider checkout and in-app/web video deep links where those functions cannot run inside a WhatsApp chat. Do not describe an external payment page as an embedded WhatsApp payment capability.

## 7. Transactional workflows and data invariants

### 7.1 PostgreSQL transaction design

Use one authoritative production PostgreSQL database for stock, orders, payment/refund ledgers, subscriptions, appointment holds, clinical records, permissions and outbox/due jobs. Separate schemas and roles, not independent databases that would require distributed commits. Drizzle owns reviewed PostgreSQL migrations; use parameterized SQL, foreign keys, unique business-operation IDs, CHECK constraints, immutable financial events and integer paise. Store UTC timestamps plus explicit clinic timezones.

Interactive transactions use one acquired driver client. Lock only the relevant rows, in a consistent order, and commit quickly; never call a payment, model, courier or messaging API while holding a database transaction. Use guarded updates/RETURNING, check expected row counts before subsequent changes and roll back when a prerequisite fails. A zero-row UPDATE is not an SQL error. Retry deadlock/serialization failures with bounded backoff and the same business idempotency key. [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html).

Authoritative stock, amount, consent, role and doctor availability checks use the primary; initial release has no required read replica. Public pages may be cached, but confirmations and permissions are revalidated. PostgreSQL improves the available tools; it does not itself make an incorrect business workflow safe.

### 7.2 Orders, stock, payments and finance

1. Reprice the cart server-side using current customer/distributor eligibility, bundle/discount rules, taxes, shipping and consult-only authorization. Snapshot the accepted amount and tax/address basis.
2. Lock the relevant inventory availability/batch rows in deterministic order; allocate eligible stock using FEFO, shelf-life and recall rules. Reserve every allocation with the order, expiry and outbox event in one transaction. Revalidate quantity and nonnegative balances; shortage rolls back the whole reservation. Bound retries and cart/batch size.
3. After commit, create the provider payment using a stable operation reference. Persist the provider reference; an ambiguous timeout becomes a reconciliation task, not a fresh charge. COD has its own acceptance and collection states.
4. Verify signed webhooks, provider account, amount/currency and reference. Deduplicate provider events and business transitions; lock the payment/order/reservations before confirming paid state, invoice issuance and outbox effects. Browser callbacks never establish payment success.
5. Handle payment after reservation expiry through an atomic new allocation or a recorded refund/review obligation. Never manufacture stock or confirm an unavailable item after a late webhook.
6. Shipment consumes specific reserved batches. Returns enter quarantine. Transfers separately record dispatch and destination receipt with batch traceability. Recall queries identify affected clinic stock and customer orders.
7. Refunds, credit notes, referral credit and loyalty reversals use append-only ledgers, unique source references and reconciliation. Allocate invoice numbers atomically in the approved series/period; voided numbers are not reused.

Recurring subscriptions require provider-confirmed mandates, renewal events, stock allocation, price/tax treatment, failure recovery, pause/resume/cancel and notices. A reminder alone does not implement recurring billing. No card data is stored by the application.

### 7.3 Doctor overlap protection and clinical records

Use PostgreSQL btree_gist and a GiST exclusion constraint on doctor_id and the occupied tstzrange interval for active held/confirmed/in-progress appointments. Include buffers in the stored interval and use half-open boundaries so permitted adjacent slots do not conflict. Clinic ID must not weaken the exclusion: one doctor cannot overlap across two clinics. Verify extension and migration compatibility on the selected PostgreSQL version. [PostgreSQL exclusion constraints](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION).

Expire stale holds by explicitly changing their state; do not put a moving now() predicate inside the constraint. Booking transactions release eligible expired holds, validate leave/hours/fee and insert the new hold atomically. Payment confirmation rechecks hold ownership/version and expiry. Reschedule/cancel updates occupancy and financial obligations atomically; late payment uses the approved rebook-or-refund workflow. Test exact-boundary, buffer, duration and cross-clinic conflicts.

Version consent, clinical notes and signed physician recommendations. Cart conversion enforces the recommendation's products, validity and consult-only rules. Dosage/refill jobs follow physician-authored instructions and timezone. Access requires role, clinic and patient assignment on every request; pooled RLS context must be set and cleared transaction-locally. Keep finance/warehouse/marketing access separate from clinical notes.

Issue short-lived room access only to the booked patient and assigned doctor during the permitted window. Signaling validates membership; a room ID grants no access. Test expired/revoked credentials, reconnect, device permissions and poor networks. Review peer IP exposure and enforce TURN-only relay if required. Use hibernating WebSockets for idle signaling where supported; media never traverses API Workers. Consultation recording is disabled by default; recorded staff training remains required.

### 7.4 Durable jobs, priorities and reconciliation

Commit business changes with their outbox/due-job record in the same PostgreSQL transaction. Cron runs every minute. Dispatchers claim indexed due records in a short transaction using FOR UPDATE SKIP LOCKED, write lease owner/expiry and commit before publishing. Publish stable event IDs, then mark dispatched. A crash around publication may duplicate work; a lease must never be held as an open transaction during external I/O.

Use separate finance/fulfillment, clinical/scheduled and engagement queues with bounded consumer concurrency. Start with one database transaction at a time per job invocation and consumer concurrency around two per queue; load-test and adjust. Preserve capacity for financial and clinical work while throttling campaigns, indexing and reporting. Queues do not create this priority automatically; the consumer configuration and database query limits do.

Consumers claim by operation/version, use provider idempotency where available, persist outcomes and safely acknowledge/retry. Reconcile unknown provider outcomes before repeating charges, shipments or messages. At-least-once delivery requires deduplication and business-state checks. Use per-message acknowledgment, backoff, bounded attempts, execution deadlines and DLQs; rehearse inspection/redrive. [Cloudflare delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/).

Long-term reminders/subscription schedules stay in PostgreSQL, not delayed for months in a queue. Recheck consent, cancellations, completed purchases, human takeover and current KB approval when executing. Expired clinical reminders follow an approved suppress/escalate policy. Campaigns retain opt-out/quiet-hour/segmentation controls. Queue payloads carry minimum identifiers, not unnecessary health content.

Track oldest due job, outbox lag, failed deadlines, retries/DLQs and unresolved provider outcomes. Reconcile payment/refund/mandate/shipment states periodically. Acknowledge webhooks only after durable receipt. Build engagement/report summaries idempotently from events; show freshness and reconcile totals. Reports do not run unbounded history scans against the purchase path.


## 8. Clinical AI safety, languages, and sensitive data

### 8.1 Approved-content pipeline

1. A staff editor creates an English source entry with its product/concern scope and provenance.
2. A named physician approves a version and the relevant Malayalam/Tamil dosage and safety text. Publication and approval are separate permissions.
3. Only current approved public content is indexed. Revoke stale versions immediately from retrieval and clear related answer caches; publish refreshed indexes within five minutes.
4. Retrieval filters by approval, scope, language availability and version. Patient-specific notes are fetched separately only for an authorized patient/doctor workflow.
5. Explicitly load the complete current safety/dosage/restriction records for the resolved product or topic, independently of semantic top-k ranking. Render medical statements from approved text with named physician and version references; no generated medical token is streamed before the required checks. A prompt alone is not an enforcement boundary.
6. The pinned model handles typed intent, navigation, nonclinical summaries and permitted translation around approved blocks. Hybrid keyword/vector/alias retrieval is evaluated across the launch languages. Missing safety context, unsupported language or unsupported medical questions use approved physician/human escalation wording.

For additional conversational languages, enable language detection and nonmedical conversation. Clinical instructions use a pre-reviewed translation where available; otherwise offer the approved source language and a human consultation. Marketing wording such as "every language" cannot establish validated clinical accuracy. If the company requires verified medical responses in another language at launch, its physician-reviewed content and test set become a Day 0 prerequisite.

### 8.2 Action and escalation controls

- Run deterministic red-flag checks and physician-approved escalation rules before recommendation or purchase actions. Include native script, Romanized inputs and common misspellings in tests. These checks are safety layers, not a claim to detect every emergency.
- Treat user messages, retrieved documents and provider payloads as untrusted content. Retrieved text cannot alter system permissions or authorize tools.
- The model proposes a typed tool request; backend code validates identity, role, ownership, clinical restrictions, amount and current state. The assistant receives no direct SQL, arbitrary URL-fetch or unrestricted staff capability.
- Require explicit confirmation for cart changes, booking, subscription enrollment and payment initiation. Recheck state when the customer confirms.
- Stop automated conversation responses when a human takes over. Record handoff ownership, after-hours callback state and escalation timing.
- Emergency wording directs the person to appropriate immediate care; an urgent symptom must not be converted into an ordinary sales or callback workflow. Physicians own the wording and escalation policy.
- Log the knowledge versions, tool outcomes, model/prompt version and review decision required to investigate an answer. Restrict access and retention of the conversation itself.

### 8.3 Privacy and governance

Use TLS, provider-managed storage encryption plus company-controlled encryption for independent backups, private clinical objects, short-lived signed downloads, least-privilege credentials and mandatory staff MFA. Record separate consent for consultation, health-data processing and marketing. Do not bundle optional marketing into the purchase requirement.

The selected Neon database is in Singapore, outside India; this revision supersedes earlier database-location assumptions. No processor is assumed to keep all data in India without contractual and technical verification. Approve the AI, video, messaging and monitoring data flows, international transfers, retention and contractual terms before sending patient information. Minimize identifiers; keep address/payment details out of model prompts and health details out of product analytics, error reports and marketing notifications. WhatsApp order lookup requires an authenticated account-link flow; a phone-number match alone is insufficient.

Set `store: false` for Responses requests and maintain authorized conversation history in company storage. This is not equivalent to zero provider retention. OpenAI documents default abuse-monitoring retention and approval requirements for additional controls in its [data-controls documentation](https://developers.openai.com/api/docs/guides/your-data). Verify the selected endpoints and actual account configuration, including audio, rather than assuming one retention policy applies to all features.

On Day 1, the clinic's designated privacy/legal reviewer and finance owner must sign off the applicable notices, retention schedule, access/deletion/export handling, minors/guardian workflow, teleconsultation records, product claims, medicine-sale restrictions, taxes and invoicing. Build the resulting controls into acceptance tests. The proposals' references to DPDP and AYUSH are not a legal assessment. The [official DPDP Rules publication and commencement materials](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025) should inform the review; verify what applies on the actual launch date.

Audit records capture actor, clinic, action, target record, timestamp and reason for access-sensitive changes. Restrict audit deletion; export protected audit records according to the approved retention schedule. Account deletion must revoke access and remove eligible data while preserving any records the approved retention policy requires.

## 9. Production sizing, capacity assumptions and performance gates

### 9.1 Workload and compute assumptions

| Measure | Planning assumption | Required validation |
|---|---|---|
| Audience | Approximately 1,000 daily active users initially; test a 3,000-user envelope | Daily users are not simultaneous users or a throughput guarantee. |
| Dynamic API volume | 80/user/day × 1,000 × 30 = 2.4 million/month | Include Core, Companion, webhook and job invocation overhead in metering. |
| Production database | 5 GB data/indexes for cost modeling; one primary | Actual opening data may be smaller; no assumption of free paid-plan storage. Files remain in R2. |
| Production compute | 0.25 CU minimum, 1 CU initial maximum; scale-to-zero disabled | Minimum starts around 1 GB RAM, maximum around 4 GB; measure cache, CPU, memory and lock/pool waits. |
| Staging | Isolated synthetic database/project; 0.25 CU when active, suspend when idle | Model roughly 40 active hours/month with small data; include CI and team usage. |
| Text AI | 600 model responses/day = 18,000/month; average 2,000 input and 300 billed output tokens | Count all generation/tool rounds, not just the final answer. |
| Retrieval | 2,000 approved vectors at 1,536 dimensions, about 18,000 queries/month | Include refresh/staging operations and current-version rechecks. |
| Jobs | Fewer than 150,000 small deliveries/month initially, including reminders/integrations/retries | Verify actual dose schedules, campaign volume and backlog recovery. |
| Voice/video | 1,000 transcribed minutes; 30 two-person calls/day × 15 minutes | Measure real bitrate, relay share, device support and provider charges. |

The compute range is an initial engineering setting, not a production certification. Inspect the database working set and effective connection limit on Day 1. Do not run six engineers' unbounded queries against production. Keep runtime transactions short, public content cached, engagement writes bounded and report summaries precomputed. Use independent statement/lock timeouts and monitor pool waits; database storage size is not the same as hot memory demand. [Neon compute sizing](https://neon.com/docs/manage/computes).

Cap active model generations at ten initially using expiring PostgreSQL leases; release after completion and recover expired leases without holding transactions over model calls. Add per-account/phone/IP abuse controls, bounded context/tool turns and circuit breakers. At saturation expose safe retry/human routing; direct purchase/booking remains available. The forecast of 600 responses/day is not a hard feature quota.

### 9.2 Growth, latency and safeguards

Neon PostgreSQL replaces the earlier serial-database/10 GB design constraint, but compute, cache, connections, locks and query efficiency remain finite. Changing database does not increase Workers memory/CPU or improve a user's network. Benchmark the complete Indian-client/Worker/Singapore-database path; avoid unnecessary query round trips and unbounded response payloads. Consider request placement or driver changes only after measurement and with pinned compatibility.

Keep the production database always active. Staging can suspend. The one-minute outbox dispatcher would keep a production database awake anyway; low forecasts based on many sleeping hours are inappropriate for this workload. [Neon compute lifecycle](https://neon.com/docs/introduction/compute-lifecycle).

Tune indexed owner/clinic/date/provider lookups, due jobs and FEFO selection. Page history tables, batch retention work and generate large exports asynchronously to R2. Maintain financial/report control totals. Retain required clinical/financial data under the approved policy; file/log archiving cannot remove required access or audit evidence.

Alert on sustained CPU/memory pressure, low cache hit rate, pool/lock waits, slow transactions, queue lag and 50/75/90% of spending targets. Review growth at least monthly. If capacity gates fail, optimize or increase compute and update cost; do not preserve a budget by accepting lost bookings or delayed critical work. A paid read replica adds compute and consistency considerations and is a later measured option, not included in the baseline.

### 9.3 Measured acceptance targets

| Gate | Release-candidate target |
|---|---|
| Sustained load | 60 dynamic requests/second for 30 minutes; 120 requests/second for five minutes, realistic query/data mix. |
| Soak | Four hours at 20 dynamic requests/second with jobs and bounded AI/video concurrency; no connection, memory or lease leak. |
| Core latency | India locations: read p95 below 500 ms, write p95 below one second; report provider latency separately. |
| Correctness/errors | Below 1% unexpected server errors under declared load; zero double charges, oversold units, double-booked doctors or unauthorized records. |
| Database | Initial tuning target: p95 core transaction below 100 ms measured in-database, excluding transport; no sustained pool/lock backlog. Report complete transaction round trips separately. |
| Jobs | Healthy-state pickup p95 below two minutes; alert on critical deadline failures; prove deadline-aware backlog recovery. |
| Assistant | Representative nonclinical first useful output p95 below five seconds; no medical block appears before approval/safety checks. Report total tool/answer latency. |
| Web/mobile | Key public-page mobile LCP target below 2.5 seconds on representative Indian networks; no launch-language/accessibility blockers. |
| Recovery | Exercise Section 12 targets with control totals and provider reconciliation. |

Run the cold-cache/minimum-compute case and autoscaling ramp, not only an already enlarged warm database. If 0.25–1 CU cannot meet these targets, change sizing/forecast before release. The numeric gates are objectives requiring evidence, not claimed results or vendor SLAs. Passing them does not certify every possible traffic spike; higher DAU also changes AI/messaging costs.


## 10. Single two-week execution schedule

All engineers integrate daily and test their own domains. The company demonstrates and accepts the integrated build each afternoon. The schedule assumes Day 0 evidence; no extra team members, hidden weekend implementation or reduced requirements are included.

| Day/date | E1 — lead/clinical | E2 — commerce | E3 — web/admin | E4 — mobile | E5 — AI/integrations | E6 — platform/quality | Integrated exit evidence |
|---|---|---|---|---|---|---|---|
| Day 1 · Mon 19 Oct | Contracts, PostgreSQL locks/exclusion prototype, WorkOS staff/customer authorization | Neon stock/payment/ledger transaction proof; live merchant checks | Store/admin skeleton, locales and catalogue import | Real-device auth/payment/WebRTC proof; store listings | Approved KB schema; model/embedding/voice benchmark; WhatsApp proof | Workers Paid/Neon provisioning, driver/pool/TLS, staging, CI and backup proof | Audited reuse and estimates fit 60 days; atomic rollback and identity/video paths demonstrated; stop/reforecast if foundations fail. |
| Day 2 · Tue 20 Oct | Clinic/doctor schedules, consent and role access | Opening batches, pricing, cart and payment outbox | Working catalogue/admin/doctor screens | Shared customer flows, deep links and native adapters | Approval/version pipeline, hybrid retrieval, Queues handlers | SKIP LOCKED leases, queue priorities/DLQs, PostgreSQL migrations and restore skeleton | Imported opening data; isolated roles; one complete job/retry/restore path. |
| Day 3 · Wed 21 Oct | Paid booking, occupancy conflicts, cancellation | Live checkout/COD, reservation expiry and refund | Full store checkout and booking/account views | Checkout/booking parity and returns | Grounded cited chat, human routing and account-linked tools | Critical journey automation, concurrent last-unit/slot tests | R01/R02/R11 build targets; real purchase/refund and cross-clinic conflict proof. |
| Day 4 · Thu 22 Oct | Notes, recommendations and assigned-patient panel | Unified order desk, FEFO/recall, bundles | Accounts, order desk, reviews and KB approval UI | Orders/tracking, consult/chat screens and accessibility | Controlled actions, WhatsApp order flow, notices and takeover | Permission/injection/webhook replay tests; scrubbed telemetry | Day-4 R01–R38 matrix targets demonstrated with traces, not mocks. |
| Day 5 · Fri 23 Oct | Multiclinic, signed cart conversion, dose/refill schedules | Recurring mandates, GST/credit notes, shipping/COD and courses | Three-language flows, campaigns/landing pages and SEO | Private web/native video, editable voice and push | Multilingual/red-flag gate, WhatsApp full flow and reminders | Outage/retry/lease tests; compute/pool metering and backup drill | All Day-5 feature targets integrated; provider sandbox plus minimal live verification. |
| Day 6 · Mon 26 Oct | Clinical regression and role/retention closure | Wholesale, loyalty/referrals and finance reconciliation | Growth/reporting/feeds, content and UI closure | Complete Android/iOS release candidate | Extra-language/Romanized safety, campaigns and funnel closure | Full requirement coverage report and candidate freeze | Every required feature implemented end-to-end; R01–R38 evidence gaps assigned, remaining effort reforecast. |
| Day 7 · Tue 27 Oct | Physician/privacy UAT and defect repair | Finance/warehouse UAT and defect repair | Front-desk/company UAT and language fixes | Real-device regression; submit complete tested apps | Clinical evaluation, human handoff and template acceptance | Security/critical-flow gates, signed release candidate | No critical safety/access/financial defects; tested native candidates submitted. Submission does not satisfy public release. |
| Day 8 · Wed 28 Oct | Concurrency and clinical recovery | Payment/stock/subscription recovery | Report correctness and performance fixes | Mobile-network/video recovery and review response | AI saturation, stale-index and provider outage tests | Section 9 load/soak; Neon PITR/pg_restore and R2 recovery; queue replay; rollback | Capacity/correctness/recovery gates pass on the revised candidate. |
| Day 9 · Thu 29 Oct | Doctor/admin training and access review | Operations/finance training; opening balances checked | Content/locales/feed approvals and user guides | Approved store builds verified; company handover | Support/marketing training and consent audit | Dress rehearsal, independent backup, cost dashboard and runbooks | Recorded training; all R01–R38 acceptances and actual store approvals ready. |
| Day 10 · Fri 30 Oct | Joint go/no-go; clinical oversight | Supervise live orders/refunds/renewals | Web and back-office public release | Verify publicly installable Android and iOS | Verify live WhatsApp/chat/handoff and reminders | Staged rollout, alerts, rollback readiness and incident lead | Full release only after all Section 11 gates; report any external approval delay as an unmet deadline. |

31 October–1 November is a named support rotation for delivered operations. It is not extra build capacity or permission to call unfinished requirements complete. Keep the same requirement IDs, owner and acceptance evidence throughout; defect fixes do not erase the original scope.

## 11. Verification and release gates

### 11.1 Functional and safety verification

| Area | Required test evidence |
|---|---|
| Payments and billing | Success/failure/cancel, duplicate/out-of-order/missing webhook, mismatched amount/currency, payment after hold expiry, partial/full refund, repeated refund request, real charge/refund, mandate/cancel and accelerated recurring cycle. |
| Inventory | Two checkouts compete for the final unit; expired/recalled/insufficient-shelf-life batches cannot ship; renewal stock shortage, return quarantine, location transfer and batch recall traceability. |
| Appointments | Two customers compete for one slot; physician booked across clinics; leave update, reschedule, late payment, cancellation/refund and video token authorization. |
| Access/privacy | Patient A cannot access Patient B; unassigned doctor cannot read records; front desk cannot read unrestricted notes; warehouse sees shipping data only; finance cannot access chat health details; content editor cannot self-approve. Test every staff/customer/physician route, customer versus MFA-protected staff-organization sessions, internal tools, session revocation and missing clinic/patient scopes. |
| Assistant | At least 120 physician-reviewed scenarios across the three launch languages, plus 40 additional-language/Romanized cases; include unsupported claims, contraindications, consult-only items, urgent symptoms, stale knowledge, injection, unauthorized lookup and human takeover. |
| Assistant gate | Mandatory safety/contraindication retrieval passes independently of top-k ranking; no unchecked generated clinical text is streamed; every critical clinical/access case must pass; zero fabricated dosage, unauthorized record access or prohibited action in the release set; 100% of displayed clinical blocks trace to approved versions. At least 95% approved task completion on noncritical supported cases. Sample results do not prove universal safety. |
| Native apps | Real Android and iOS devices, representative older supported OS/device, microphone/camera denial, dropped network, app resume, notification routing, payment return, accessible text sizes and Malayalam/Tamil rendering. |
| Growth/reporting | Marketing opt-out and quiet hours; campaign attribution; no recovery after purchase; verified review restriction; referral self-abuse and refund reversal; reports reconcile to known fixture totals. |
| Recovery | Exercise Worker version rollback, Neon interruption, transaction rollback/zero-row guards, deadlocks and pool exhaustion, dispatch/consumer crashes, expired leases, duplicate Queue messages, webhook replay and stale Vectorize entries; restore PostgreSQL and R2 references and reconcile stock/payment/booking consistency. |

Every engineer owns unit/integration tests for their critical invariants. E6 maintains the shared automated journeys and test report. Test data must include consult-only products, multiple batches, two clinics, at least two fee rules, distributor accounts and all three interface languages.

### 11.2 Capacity and user-experience verification

Section 9.3 is the single source of numeric performance thresholds; this section does not define a competing set. Use a realistic dynamic mix: 65% catalogue/product reads, 15% account/order/tracking reads, 10% cart/availability, 5% checkout writes and 5% booking writes. Report cache-hit rate separately. Run concurrent chat/video tests without sending bulk load to live payment or messaging providers.

Record software/model versions, database/corpus size, Neon compute/cache/pool/lock metrics, concurrency limits, device/network locations, latency/error distributions and provider assumptions. Tests must cover the actual production architecture, including remote PostgreSQL transactions, overlap constraints, pooled authorization and autoscaling, Queue/Cron processing, WorkOS policies and real web/native video transport. Passing a laptop benchmark or free development deployment is insufficient.

### 11.3 Final go/no-go checklist

- [ ] R01-R38 have linked evidence and named company acceptance; no required feature is deferred, mocked or hidden behind a disabled flag.
- [ ] No unresolved critical/high security issue or Sev-1/Sev-2 defect. A moderate defect may remain only if it does not invalidate a requirement, clinical safety or a core journey, and has a named fix owner/date.
- [ ] Physicians approve clinical content, escalation, translations and evaluation results; privacy/legal and finance reviews are complete.
- [ ] Capacity, data consistency, native-device and recovery gates pass on the release candidate.
- [ ] Live merchant, subscription, WhatsApp, SMS, courier, AI and video access are verified; approved required methods/templates are active; required shopping-feed/listing approvals are recorded.
- [ ] Android and iOS are approved and publicly installable. A store review pending at the deadline means the complete cross-channel launch is pending.
- [ ] Workers Paid, Neon Launch PostgreSQL constraints/transactions, R2 authorization, Vectorize approval rechecks, staff-organization MFA and native sessions are deployed and verified.
- [ ] PostgreSQL transaction tests prove no partial order/stock/appointment/outbox commits, including zero-row guard failures; database outage and restore behavior are verified.
- [ ] PostgreSQL outbox/due jobs, Cron leases, Queues retries/DLQ/redrive and provider reconciliation pass; AI saturation does not block direct purchase/booking operations.
- [ ] Booking-scoped signaling/TURN credentials and real web/native media pass access, network, privacy and metering checks; no consultation recording is enabled by default.
- [ ] Neon production scale-to-zero is disabled, compute/pool limits and seven-day history are verified; RLS context cannot leak through pooled connections; independent pg_dump restores successfully.
- [ ] Production TLS/DNS, staff MFA, secrets, alerts, backups, audit protection and permissions are verified.
- [ ] Restore, previous-version deployment and payment/booking reconciliation runbooks have been exercised.
- [ ] Company-owned repositories, service accounts, credentials recovery, operational guides and recorded training are handed over.
- [ ] Clinic product owner, physician owner, finance/operations owner, E1 and E6 record the release decision.

## 12. Launch, rollback, recovery and ongoing operation

### 12.1 Environments and deployment

Keep company-owned production/staging accounts or explicitly isolated resources, database credentials, queues, buckets and identity settings. Staging uses synthetic/sanitized data and cannot charge live customers or send production campaigns. Do not automatically branch live patient data into developer/preview environments. Production has one Neon primary; staging is a separate synthetic environment with suspend enabled. Pin PostgreSQL major version, compatible driver/ORM versions, Worker compatibility date, API contracts, model/prompt and approved KB versions.

CI verifies types, critical tests, real PostgreSQL migration compatibility and integrated journeys. Use a restricted direct-endpoint migration role with a deployment lock, short lock timeout and pre-change recovery checkpoint. Apply additive expand/contract changes compatible with the previous Worker. No destructive launch-day schema changes. Test application rollback against the current schema; code rollback cannot undo real payments or committed transactions. Keep native APIs compatible across store review and gradual rollout.

E6 deploys, E1 reviews controls and company clinical/finance/product owners approve. Start with internal live transactions, then a bounded public rollout while monitoring money, stock, booking, latency and job lag. Verify public web, both publicly installable apps, live WhatsApp tools, approved payment methods, consultations and reminder delivery. Every required feature remains part of final acceptance.

### 12.2 Database and object recovery

Explicitly configure a **seven-day Neon history window** on Launch and verify it in the actual project. Do not inherit the previous database's 30-day assumption or silently keep a shorter default. Record recovery checkpoints and prove point-in-time restoration on an isolated recovery target. History usage is metered and included as an allowance in Section 13. [Neon backup strategies](https://neon.com/docs/postgres/backup-restore/backups).

Run nightly encrypted pg_dump using the direct endpoint and a restricted backup workflow, not the 128 MB API runtime. A company-controlled CI runner or existing backup runner can stream encrypted exports to independent storage; verify available CI minutes, credentials and failure alerts. Retain seven daily and four weekly exports initially, subject to the approved policy. Test pg_restore, required roles/extensions, row counts, hashes and application smoke tests. Standard nightly backups are not an independent continuous WAL replica.

Back up the manifest and required immutable R2 source/private object versions as well. Keep independent copies outside production account control and recoverable encryption keys under company ownership. A database snapshot/branch inside the same provider account does not protect against losing that account. Restore cannot recreate overwritten or deleted attachment bytes; preserve references and object retention together.

| Incident | Objective and required response |
|---|---|
| Broken Worker | Target compatible code rollback within 15 minutes; verify stock/payment/booking state. |
| Corruption inside history window | Target recovery point within 15 minutes before incident, subject to verified available history; stop writes and restore an isolated target, validate then cut over. |
| Full application-data restoration | Initial target to restore/validate/resume within two hours; prove this on the actual dataset before claiming it. |
| Provider/account loss or history exceeded | Independent nightly dumps have a worst-case 24-hour recovery point; weekly dumps provide older but coarser recovery. Cross-provider recovery time must be measured separately. |
| Payment/courier/mandate divergence | Reconcile provider events and ledgers after restore; database rollback never reverses a real charge, shipment or notification. |
| Queue/index loss | Rebuild from PostgreSQL outbox/due state and approved KB versions; deduplicate effects and suppress obsolete reminders. |

Use UTC checkpoints, financial/batch/booking totals and approved audit records to prove recovery. Test connection-string/secret cutover and close/recreate stale driver connections. Restore minimum role grants and RLS policies before reopening traffic. The recovery objectives are internal targets, not a purchased vendor recovery SLA.

### 12.3 Operations and continuity

Set an internal 99.9% monthly core-availability objective and independent checks. Launch pricing does not purchase a dedicated availability SLA or 24-hour premium vendor support. E6 owns alerts with E1 as backup; E2 financial reconciliation, E5 messaging/AI, E4 native/video and E3 web/content. Named company clinical/operations contacts participate in escalation. Human on-call/maintenance is separate from hosting cost.

Monitor Worker errors, Neon CPU/cache/connections/locks, slow transactions, money/stock invariants, job deadlines/DLQs, missed reminders, AI review flags and spend. Redact health text/tokens/SQL parameters from logs. Reconcile finances daily, review launch costs weekly, rotate credentials and maintain content/dependencies. Archive diagnostics only under approved access/retention; short vendor UI log retention is not the company's audit retention.

For transient database/network failures, retry only safe/idempotent operations with bounded backoff. An uncertain COMMIT requires operation-ID lookup/reconciliation, not blind duplicate creation. During a database outage, expose pending/retry status and block authoritative confirmations; never confirm stock or doctor availability from cache. AI failures leave direct workflows and human escalation available. Messaging failures remain tracked, durable and escalated according to approved clinical deadlines.


## 13. Revised monthly cost in INR and cost controls

### 13.1 Pricing basis and forecast boundaries

Official prices were checked on **19 October 2026**. Budget at **₹95/USD**, not a promised invoice exchange rate. Use 730 compute hours for an average full month and a 30-day activity forecast. Taxes, foreign-exchange/card charges, payment gateway fees, shipping/COD charges and engineering/support labor are excluded.

Neon Launch is usage-based: $0.106/CU-hour, $0.35/GB-month database storage and $0.20/GB-month retained history. Paid database usage starts metering without the Free-tier allowances. [Neon pricing](https://neon.com/pricing). A CU is the database compute unit, not a Worker CPU allocation. [Neon compute sizing](https://neon.com/docs/manage/computes).

The selected production configuration stays active. A one-minute dispatcher would prevent five-minute idle suspension in any case. Small always-on compute is therefore costed for the full month; staging may suspend. Average consumed compute determines the actual bill, including autoscaling peaks. [Neon lifecycle](https://neon.com/docs/introduction/compute-lifecycle).

### 13.2 Core platform and text assistant breakdown

| Component | Monthly USD | Monthly INR | Assumption |
|---|---:|---:|---|
| Cloudflare Workers Paid | $5.00 | ₹475.00 | Base plan; 2.4 million dynamic calls plus jobs/staging remain within included usage or reserve. |
| Neon production compute | $19.35 | ₹1,837.78 | 0.25 average CU × 730 hours × $0.106; minimum-compute modeled month, not a maximum bill. |
| Neon database storage | $1.75 | ₹166.25 | 5 GB data/indexes × $0.35. |
| Neon recovery-history allowance | $1.00 | ₹95.00 | Illustrative 5 GB-month retained history; measure WAL/change volume with seven-day window. |
| Neon staging/recovery-test allowance | $2.00 | ₹190.00 | Shared synthetic staging: roughly 40 active hours at 0.25 CU plus about 1 GB data; limited restore-test use. |
| R2 Standard | $0 incremental forecast | ₹0 | Within included storage/operation allowances; no unbounded file retention assumed. |
| Vectorize | $0 incremental forecast | ₹0 | Approved 2,000-vector corpus and 18,000 monthly searches within included dimensions. |
| Queues/Cron and modest signaling | $0 incremental forecast | ₹0 | Included operation/DO allowances at measured use; any excess consumes reserve or increases bill. |
| WorkOS AuthKit | $0 | ₹0 | Standard hosted domain, included MFA, below one million MAU; no enterprise SSO/custom-domain/paid audit add-on. |
| GPT-4o-mini text generation | $8.64 | ₹820.80 | 18,000 responses × average 2,000 input and 300 billed output tokens. |
| Embeddings allowance | $0.10 | ₹9.50 | Modest public-KB/query embedding usage. |
| Domain, email and independent encrypted backups | $3.00 allowance | ₹285.00 | Modest domain/transactional mail and retained encrypted dumps/object copies; planning allowance, not a vendor bundle. |
| Usage/overage reserve | $1.50 | ₹142.50 | Small additional Worker/DO/log/storage/CI use; not a hard spending ceiling. |
| **Core total** | **$42.34** | **₹4,021.83** | **Approximately ₹4,022/month at minimum modeled production compute.** |

Totals use the unrounded compute value of $19.345. Displayed line items are rounded; a one-cent difference can result when adding rounded USD rows. The cost is an estimate for the declared workload, not a capacity guarantee.

Text calculation: 36 million input tokens × $0.15/million = $5.40; 5.4 million output tokens × $0.60/million = $3.24. text-embedding-3-small and gpt-transcribe retain the previous bounded-use design. Count all model/tool rounds and actual billed tokens. A different model required by clinical evaluation changes cost; the cheap model is conditional on passing the same safety gate. [OpenAI API pricing](https://developers.openai.com/api/docs/pricing).

History and staging figures are allowances. More change retention, large indexes/exports, longer-running staging or multiple preview computes increase usage. Reprice independent backup retention as data grows. Neither staging database capacity nor backup runner minutes are unlimited; use synthetic data, expiry and company-controlled credentials. An additional Neon feature such as its Functions, Object Storage or AI Gateway is not required or assumed included here.

### 13.3 Compute sensitivity: minimum versus realistic operating provision

The table changes only average production compute; all other Section 13.2 assumptions stay fixed. Actual autoscaling, history and channel usage can change independently.

| Average production CU for the month | Compute-only INR | Core platform/text AI INR | Full-service scenario INR |
|---|---:|---:|---:|
| 0.25 CU | ₹1,837.78 | ₹4,021.83 | ₹10,233.08 |
| 0.50 CU | ₹3,675.55 | ₹5,859.60 | ₹12,070.85 |
| 1.00 CU | ₹7,351.10 | ₹9,535.15 | ₹15,746.40 |

**Initial operating provision:** ₹4,500–₹6,500/month core, or **₹11,000–₹13,000/month for the full-service scenario below**. This provision assumes average production compute remains near 0.25–0.5 CU; a month near 1 CU needs the higher budget shown. Set autoscaling bounds from load evidence and alert on forecast cost. Never silently reduce required operations to enforce the forecast.

### 13.4 Voice, video, messaging and app-store costs

| Addition | Usage assumption | Monthly INR |
|---|---|---:|
| Core platform/text AI | Section 13.2 minimum-compute model | ₹4,021.83 |
| Voice transcription | 1,000 minutes × $0.0045 = $4.50 | ₹427.50 |
| TURN video relay | 30 calls/day × 30 days × 15 minutes × two participants = 27,000 participant-minutes; illustrative 2 Mbps each gives about 405 GB before overhead if all relayed | ₹0 incremental forecast within allowance |
| Apple Developer membership allocation | $99/year ÷ 12; paid annually; local invoice may differ | ₹783.75 |
| WhatsApp/SMS allowance | Illustrative ₹5,000, to be replaced by channel/category/destination volumes and actual provider quotes | ₹5,000.00 |
| **Full-service modeled total** | **Before taxes, payment/fulfillment fees and labor** | **₹10,233.08** |

The ₹5,000 messaging figure is an explicit planning allowance, not a verified quote or a cap on every possible campaign. Calculate billable WhatsApp messages by category/destination plus SMS units and provider fees. Preserve required order updates, reminders, campaigns, consent and delivery tracking; push/email can save money only where the approved flow permits substitution. [WhatsApp pricing](https://business.whatsapp.com/products/platform-pricing/).

Cloudflare TURN/SFU share 1,000 GB monthly free outbound traffic; extra traffic is $0.05/GB, about ₹4.75/GB at this exchange assumption. Measure bitrate, overhead, relay share and other use of the shared allowance. This is transport, not a purchased consultation UI. [Realtime transport pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/).

The baseline requires a tested reused WebRTC web/native component. If a managed RealtimeKit implementation is necessary, its $0.002/participant-minute rate adds $54 ≈ **₹5,130/month** at 27,000 minutes. This is additional to the table, with integration effort still required. [RealtimeKit pricing](https://developers.cloudflare.com/realtime/realtimekit/pricing/). Consultation recording is not enabled by default; recorded staff training remains in scope.

Apple membership is an annual account charge allocated here for comparison. [Apple Developer Program](https://developer.apple.com/programs/whats-included/). Google Play registration is a separate one-time expense. Paid EAS build tiers, extra CI minutes, paid scanners, monitoring/support, enterprise auth or developer seats require quotes if selected; existing hardware/free allowances are conditional, not unlimited.

### 13.5 Cloudflare allowances and cost controls

Workers Paid includes 10 million requests and 30 million CPU-ms. At 2.4 million requests and an illustrative 10 ms CPU each, API work consumes 24 million CPU-ms before jobs/staging; measure total use and overages. Static asset delivery and public caching reduce database traffic. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

R2 Standard includes 10 GB-month, one million Class A and ten million Class B operations; bandwidth egress is free. [R2 pricing](https://developers.cloudflare.com/r2/pricing/). Vectorize's included 50 million queried/ten million stored dimensions cover approximately 30.72 million queried and 3.072 million stored dimensions for the stated example, before extra staging/refresh work. [Vectorize pricing](https://developers.cloudflare.com/vectorize/platform/pricing/).

Queues includes one million operations/month; a small successful delivery normally uses three operations. Under 150,000 deliveries is about 450,000 before retry/DLQ overhead; payload sizes and actual metering matter. Separate workload queues share allowances. [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/). Hibernating, bounded consultation signaling is forecast within Durable Object allowances; verify requests, storage and compute separately. [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Alert at 50/75/90% of monthly targets. Review average CU-hours, history/staging, object retention, model tokens, audio minutes and delivered message volumes weekly during launch. Reduce unnecessary database round trips, unbounded reports, context length, duplicate jobs and abusive traffic. Keep consent/safety checks and required clinical/financial retention. Do not stop required medical jobs or hide a channel to maintain a low-cost claim.

### 13.6 Comparison with the earlier estimate

| Earlier assumption | Revised interpretation |
|---|---|
| $5 Workers | Retained as the base plan, approximately ₹475, with metered excess. |
| $5–$10 AI | Text/embedding forecast remains $8.74, approximately ₹830.30; voice is separate. |
| $5–$10 AWS | No AWS application server required; Neon database compute/storage are separate metered charges. Independent backup storage may use a small AWS bucket or another provider. |
| $15–$20 total | $20 is approximately ₹1,900. It does not cover this always-on paid PostgreSQL architecture plus the stated AI use. |
| Previous D1 core forecast | About ₹1,600 under its allowances; superseded by approximately ₹4,022 here, including explicit Neon/staging/recovery allowances and larger backup/reserve amounts. |
| Full company operating spend | Modeled about ₹10,233 at minimum compute; provision ₹11,000–₹13,000 for the stated channel use and average compute up to roughly 0.5 CU. Higher usage can exceed it. |

Payment processing, courier/COD, taxes, labor and optional vendor add-ons remain excluded from both comparisons. A 3,000-DAU capacity test does not imply 3,000-DAU operation costs the same: model/messages/compute must be reforecast from measurements.


## 14. Principal risks and accountable responses

| Risk | Owner | Response |
|---|---|---|
| Full scope exceeds 60 person-days | E1/all six | Verify reusable PostgreSQL/native assets and estimates on Day 1; reforecast on Days 1/3/6 without dropping requirements. |
| Incorrect stock/payment transaction | E1/E2 | Lock relevant rows, check guards before commit, enforce constraints and operation uniqueness; test last-unit races and uncertain commits. |
| Doctor overlap/expiry race | E1 | Cross-clinic interval exclusion, explicit expired-hold transitions and late-payment rebook/refund; test buffers and rescheduling. |
| Small compute/pool overload | E6/E1 | Cache public reads, bound work, observe CPU/cache/pool waits, load-test autoscaling and revise capacity/cost before launch. |
| Pooled connection leaks authorization context | E1 | Restricted roles, transaction-local context/RLS and cross-patient/clinic reuse tests; no owner credentials in runtime. |
| Database region unsuitable | Company privacy reviewer | Singapore is outside India; approve actual processor flows or select a compliant alternative before patient use. |
| Store/provider approvals late | Company owners/E4 | Verify readiness immediately; record delayed public release as an unmet gate, not completed delivery. |
| Cheap video requires new development | E4 | Prove reusable web/native kit early; test relay/reconnect and price managed fallback if required. |
| Unsafe medical response or stale KB | Physician/E5 | Approved blocks, primary version checks, independent mandatory safety retrieval, multilingual evaluation and human escalation. |
| Duplicate job/unknown external result | E2/E5/E6 | Outbox, leased claims, idempotency, deadlines, DLQs and provider reconciliation. |
| Recovery history or object copies incomplete | E6/E2 | Verify seven-day setting, independent encrypted dumps/manifests, restore/cutover and financial reconciliation. |
| Compute/channel bill exceeds forecast | E6/E5/finance | Meter average CU-hours, history/staging, model tokens, voice and messages; alerts and revised budget preserve required workflows. |
| Support capacity stretched | E6/company owner | Primary/backup rota, recorded role training and incident ownership; labor is separately funded. |


## 15. Required handover package

Full delivery requires all of the following:

1. Public storefront, working clinic WhatsApp channel and publicly installable Android/iOS apps with every accepted requirement.
2. Customer/staff/physician workspaces, opening catalogue/batch stock, doctor schedules, approved KB, three launch languages and safe additional-language conversational routing.
3. Company-owned source, license/dependency register, pinned web/Worker/native builds, infrastructure configuration, service/secret recovery inventory, PostgreSQL schema/migrations/constraints/RLS, driver/pool configuration and API/event contracts.
4. R01–R38 acceptance evidence, clinical/language/security/financial/concurrency tests, Neon load/autoscaling/pool results, real-device/video tests, restore/cutover drill and recorded release decision.
5. Operating guides for commerce, finance, subscriptions, clinics, inventory, campaigns, reminders and human handoff; WorkOS/MFA recovery, Neon PITR/pg_dump/pg_restore, R2 recovery, Queue/DLQ replay, provider reconciliation and Worker/native compatibility runbooks.
6. Recorded role-specific training, named support owners/backups, retention/security/content-review responsibilities, company account ownership, actual provider quotes and a cost dashboard linked to Section 13 assumptions.

**Completion standard:** All company requirements are implemented, verified, available on their required channels and operable by company staff. Neither the low-cost objective nor the calendar target waives a gate. This is the final implementation planning artifact; deployment, provider approvals and production verification must still be demonstrated.
