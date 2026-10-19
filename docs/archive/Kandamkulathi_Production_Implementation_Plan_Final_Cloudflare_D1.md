# Kandamkulathi Digital Commerce & Companion

> **SUPERSEDED — historical architecture only** (integrated review, 19 October 2026). Use the numbered [current master](../implementation/Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md), phase/member plans 02–10 and [canonical tests](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). Do not execute this document’s old database/auth stack, E-role schedule or cost assumptions as a current baseline. Its scope history is retained for comparison; current architecture is Workers Paid + Neon PostgreSQL from development, with paid production-equivalent verification by Day 7. Pricing here is historical planning, not a newly verified current quote.

## Final Production Implementation Plan — Cloudflare Workers Paid and D1

**Prepared for:** Kandamkulathi Ayurveda Vaidyasala\
**Revision:** 18 October 2026; supersedes the previous RDS architecture plan\
**Scope:** All 38 company requirements; web, WhatsApp, Android, iOS and staff/physician workspaces\
**Team:** Six full-time engineers; 60 person-days across ten working days\
**Production stack:** Cloudflare Workers Paid, D1, R2, Vectorize, Queues, Cron and Durable Objects; WorkOS AuthKit; OpenAI API\
**Traffic baseline:** 1,000 daily active users; load-test a 3,000-user planning envelope\
**Delivery target:** 19–30 October 2026; monitored launch support through 1 November 2026\
**Monthly budget:** Approximately ₹1,600 core platform/AI; approximately ₹8,000–₹10,000 for the stated full-service usage scenario, before taxes and transaction/fulfillment fees\
**Currency assumption:** ₹95/USD for planning; actual billing exchange rates and taxes vary.

This is an implementation and acceptance baseline, not evidence of an already tested application. Every requirement remains mandatory. A two-week full release depends on reusable, tested foundations, ready company content/accounts and external approvals. A feature being submitted, mocked or disabled does not satisfy delivery.

## 1. Architecture decision and delivery feasibility

Build a modular TypeScript system on **Cloudflare Workers Paid + Hono**, with **D1 as the authoritative relational database**, R2 for files, Vectorize for the derived public knowledge index, and Queues/Cron for durable background work. Use Astro/React for web, Expo/React Native for Android/iOS, WorkOS AuthKit for identity and OpenAI for the controlled assistant. Keep commerce, clinical records, inventory, scheduling and financial invariants in deterministic application/database code.

Use one repository and shared domain modules, with separate Core API and Companion Worker entry points. AI has separate concurrency, request and spending limits so a model outage cannot stop direct shopping, consultation booking or staff operations. D1 is accessed through native bindings; no private-network database connection layer is required.

This revision removes the required RDS/PostgreSQL/pgvector, Hyperdrive, EC2 connector, Cognito and SQS/Lambda/EventBridge runtime components. An independent encrypted backup destination, potentially a small S3 bucket, is the only optional AWS use in the baseline. No separate always-on backend server is required.

The savings require engineering tradeoffs: D1-specific transaction safeguards, measured query performance, managed identity free-tier dependence and a reusable WebRTC consultation component instead of a paid meeting SDK. Cloudflare hosting does not provide all of the domain logic or an application availability guarantee. Sections 7–12 specify the controls and evidence required to call the system production ready.

Six engineers have **60 person-days**, including verification and release. Full custom commerce, clinical workflows and two native apps cannot be promised from an empty repository in that allocation. Before committing to the date, demonstrate audited reusable commerce modules, a D1-compatible transaction layer, native payment/WebRTC integrations and approved multilingual clinical content. Porting existing database logic is estimated work, not a free substitution. If prerequisites or release gates fail, keep all requirements, record the gap and revise the forecast; do not reduce scope or skip verification.

The approximately $20 target applies to the stated **core platform/AI scenario**, not an unlimited all-inclusive company operating bill. Required WhatsApp/SMS delivery, voice, store membership, payment fees and shipping remain separate metered costs. Section 13 includes these explicitly.


## 2. Requirements and scope basis

Both supplied proposals are business requirements. The Ecommerce proposal covers store, accounts, checkout, GST, orders, inventory, subscriptions, marketing, distributors and clinics. The Companion proposal adds an approved clinical knowledge base, controlled assistant tools, multilingual WhatsApp/chat/voice, doctor scheduling, video, clinical safety, audits and mobile experiences. R01–R38 below remain in launch scope.

English, Malayalam and Tamil are application launch languages; additional languages for conversation require safety-gated translation and clinical review. Historical patient/order-record migration is excluded by the proposal; product, stock, physician and approved knowledge imports are needed. Existing website assertions, amounts and deadlines in proposals are not independently validated.

**Source traceability:** Kandamkulathi Ecommerce Proposal.pdf, pages 3-8, and Kandamkulathi Companion Proposal.pdf, pages 3-9, supply the business requirements referenced as E/C in Section 6. The uploaded Kandamkulathi_Production_Implementation_Plan_Updated.md is the revision source. Document content is treated as source material, not authority to purchase services, contact third parties or waive the user's full-scope requirement.

## 3. Day 0 readiness and company dependencies

Day 0 is a readiness audit, not extra development time. Unfinished preparation on 18 October consumes the ten-day delivery allocation.

| Dependency | Accountable owner | Required evidence |
|---|---|---|
| Reusable implementation | E1, E2, E4 | Tested commerce/clinical modules and licensed UI; D1 transaction/trigger prototype; working Android/iOS payment, voice and WebRTC adapters. A routing scaffold is insufficient. |
| Capacity | All six, coordinated by E1 | Requirement-level estimates, reuse evidence, dependencies, reviews and testing fit the Section 4 allocations. |
| Company data | Operations and finance | Catalogue/images, SKU/variant prices, HSN/tax rules, bundles, opening location/batch/expiry stock, courier/COD rules, invoice series and distributor terms. |
| Clinical content | Physician and language reviewers | Approved indications, dosage, contraindications, consult-only restrictions, urgent escalation and English/Malayalam/Tamil safety text; daily reviewers with four-business-hour response target. |
| Provider readiness | Company owners; E2/E4/E5 | Live payment and recurring mandate eligibility, WhatsApp number/templates, SMS sender approvals, courier, AI quota, TURN credentials, company Apple/Google production accounts, shopping-feed/listing access. |
| Company infrastructure | E6 | Workers Paid account, D1/R2/Queues/Vectorize bindings, separate staging resources, domain, secrets recovery, spend visibility and independent backup destination. |
| Identity and privacy | E1 and company reviewers | WorkOS staff organization with required MFA; customer/native sign-in proof; role/clinic/patient assignment; processor, residency, consent, retention and guardian review. |
| Video feasibility | E4 and E1 | Reusable authenticated web/native private calling component tested on real devices, mobile networks, camera/mic denial and reconnect; bitrate and TURN metering measured. |
| Acceptance and support | Company product owner | Daily physician/front-desk/warehouse/finance availability, release approvers and named support rotation. Company reviewers are not additional engineers. |

**External deadlines:** Check the actual Google Play account's production eligibility; some new personal accounts require a closed-testing period that development cannot compress. See [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB). Begin listings and privacy declarations on Day 1; submit the tested complete candidate on Day 7. Pending review is not public availability. Do not substitute test distribution for either required public app.


## 4. Six-person delivery team and capacity control

| ID | Engineer | Accountable workstream | Required supporting work |
|---|---|---|---|
| E1 | Technical lead / clinical backend | Module/API contracts, WorkOS/session authorization and D1 transaction review, clinic/patient access, doctor scheduling, consultations, consent, recommendations and medicine schedules | Reviews E2 transactions, leads clinical UAT and scope/effort reviews. |
| E2 | Commerce backend | Catalogue, prices, cart, payments/refunds, GST, FEFO batch inventory, subscriptions, courier, bundles, wholesale and loyalty ledger | E1 reviews data consistency; E3 builds management screens; E5 connects notification events. |
| E3 | Web / back office | Astro storefront, React account/staff/physician workspaces, approved-content editor, three-language UI, campaigns, reports and SEO/feeds | Reuses audited UI modules; pairs with E1/E2 for integrated workflows. |
| E4 | Mobile | Shared Android/iOS customer app, native payments/video/voice, secure auth, deep links, push, build and public store release | Shares contracts/locales with E3, connects E5 chat endpoints, owns real-device regression. |
| E5 | AI / integrations | Hybrid retrieval, controlled responses/tool calls, WhatsApp, voice processing, messaging, handoff/callbacks and funnel events | E1 authorizes clinical/action tools; E6 owns infrastructure; E5 implements message/ingestion job handlers. |
| E6 | Platform / quality | Workers/D1/R2 infrastructure, CI/CD, migrations, Queues/Cron dispatcher, monitoring, capacity and recovery evidence | All engineers write tests for their domains and support UAT. E6 does not individually test every feature. |

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

These allocations are an engineering capacity limit, not proof that all feature estimates fit. Before D1 implementation, break each R01-R38 requirement into tasks with owner, dependency, reusable asset, remaining effort and test evidence. Each engineer signs off their workstream estimate. If a workstream exceeds its allocation, E1 must revise the forecast immediately; assigning additional responsibilities to the same person does not create capacity.

Reviews and integration happen daily inside these allocations. Recheck remaining effort at D1, D3 and D6. Use a short morning coordination meeting, midday integrated build and end-of-day company demonstration. Keep one backlog keyed to R01-R38. Weekend development is not assumed; 31 October-1 November is a planned support rotation for the delivered system.

## 5. Final selected stack and architecture boundaries

| Layer | Selected stack | Production decision |
|---|---|---|
| Repository | TypeScript, pnpm workspaces, shared contracts; pinned compatible packages | One repository; supported Node LTS for builds; Workers runtime integration tests. |
| Public web | Astro, React islands, Tailwind; Workers static assets/CDN | Cache public product/concern pages; regenerate on approved publication. Checkout reprices against authoritative data. |
| Workspaces | React/Vite, TanStack Query/Router | Customer, staff and physician interfaces; all three launch languages and role-specific accessibility. |
| Mobile | Expo/React Native, Expo Router | Shared native codebase; development builds for native payment/WebRTC modules; publicly released Android/iOS. |
| API | Workers Paid, Hono, Zod | Core business operations and authorization; service bindings for internal calls. |
| Assistant | Separate Companion Worker; OpenAI Responses API | Candidate GPT-4o-mini, freeze a tested supported version on Day 1. Safety gates in Section 8 govern use. |
| Database | D1 through native binding; Drizzle D1/SQLite migrations and parameterized SQL | One production business database initially; separate staging. D1-specific atomic batches, constraints and triggers. |
| Knowledge retrieval | Vectorize plus indexed D1 keyword/alias/SKU lookup | Derived public approved content only; check current approval/version in D1 before rendering. |
| Embeddings and voice | text-embedding-3-small at 1,536 dimensions; gpt-transcribe | Bounded audio, editable transcript, no action until confirmation; no private clinical-note indexing in public corpus. |
| Identity | WorkOS AuthKit, standard hosted domain | Customer sessions plus explicitly organization-scoped staff login with MFA required; own D1 roles and audit. |
| Files | R2 Standard, separate public/private/quarantine prefixes or buckets | Immutable versioned keys, authorization before private downloads, short-lived scoped URLs, size/type restrictions. |
| Background work | D1 outbox/due jobs, Workers Cron and Cloudflare Queues | One-minute scheduled dispatcher; at-least-once consumer design, deduplication, retries, DLQ and reconciliation. |
| Video | WebRTC; authenticated Durable Object signaling; Cloudflare TURN fallback | Booking-scoped short-lived room credentials; web/native kit reused and tested. Media flows peer-to-peer or through TURN, never through API Workers. |
| Payments | Razorpay Checkout and Subscriptions | Enabled UPI/cards/net banking/eligible EMI; COD workflow; real recurring mandate lifecycle. |
| Shipping | Shiprocket | Serviceability, labels/pickup, tracking, returns and COD settlement reconciliation. |
| Messaging | Meta WhatsApp Cloud API, MSG91 SMS, low-volume transactional email, Expo Push | Channel consent/templates, identity linking, event deduplication and delivery status. Required WhatsApp/SMS flows remain. |
| Delivery and monitoring | Wrangler, infrastructure configuration, GitHub Actions, Cloudflare metrics/logs and independent uptime checks | Least-privilege scoped deploy credentials, separate environments, scrubbed logs, alerts and tested rollbacks. |
| Recovery | D1 Time Travel plus daily encrypted independent exports and R2 object manifests/copies | Restore and external-provider reconciliation drills; encryption keys recoverable by company owners. |

### 5.1 Runtime flow

```text
Web / Android / iOS / WhatsApp / signed provider webhooks
                         |
                Core API Worker (Paid) ---- WorkOS identity
                   |          |
                   D1         R2 public/private objects
                   |
             outbox + due jobs <---- Cron dispatcher
                   |                       |
                   +---- Cloudflare Queues + DLQ
                              |
                       bounded job consumers
                    payments / messaging / shipping

Companion Worker -> authorized Core API actions
       |-> D1 approved versions + exact/keyword lookup
       |-> Vectorize public knowledge -> OpenAI

Consultation clients -> authenticated Durable Object signaling
                     -> peer media / Cloudflare TURN relay
```

### 5.2 Identity and private data

Use Secure/HttpOnly/SameSite web cookies, CSRF protection for cookie-authenticated mutations, session revocation and bounded session lifetimes. Native sign-in uses the system browser and the provider-supported authorization-code/PKCE flow; verify the exact integration before committing. Validate issuer, audience, expiry, session and organization claims at the API. Never store provider secrets in mobile apps.

Staff authenticate through the dedicated staff organization whose authentication policy requires MFA. Staff routes reject general customer sessions and unscoped organization sessions even if the email matches a staff record. Map verified identities to explicit D1 roles, clinic scope and assigned patients. Apply these checks in every query and tool path; authorization cannot depend on UI visibility. Use TOTP rather than a paid SMS second factor. [WorkOS organization policies](https://workos.com/docs/authkit/organization-policies) and [MFA setup](https://workos.com/docs/authkit/mfa) describe the provider controls.

The baseline uses AuthKit's standard hosted domain and included authentication features; enterprise SSO, custom authentication domains and the paid WorkOS Audit Logs product are not required. Store the company's own application audit records in D1. Confirm free-tier terms and processor suitability before launch. [WorkOS pricing](https://workos.com/pricing).

### 5.3 Storage, ingestion and location

Keep images out of D1; use optimized R2 objects with immutable keys. Clinical files and source documents are private; record their content hash, owner, consent and version in D1. Clinical downloads require current record authorization, use short expiry and safe content disposition. A signed URL is bearer access until expiry, so never log or include it in analytics. Persist object version references so DB restoration can recover the right attachment.

The core knowledge workflow is a structured editor with reviewed text and translations. Bound document size, parse work and queue concurrency; do not assume arbitrary PDF OCR, antivirus or large binary processing fits Workers' runtime. Quarantine uploads, restrict allowed types, and require a verified scanning/sanitization path before serving untrusted attachments. Existing company scanning can be integrated; if a paid scanning service is necessary, quote it separately before enabling uploads. Preserve the required clinical records/content workflow through the structured editor and approved attachments; no claim of a free general-purpose malware scanner is made.

Request an appropriate APAC D1 location hint and measure India latency. **This does not guarantee Indian data residency.** Cloudflare's [data-location documentation](https://developers.cloudflare.com/d1/configuration/data-location/) distinguishes hints from jurisdiction restrictions. If the company requires India-only health-data processing, this design and budget must be reconsidered before implementation. Approve the actual R2, identity, AI, messaging and video processor flows as well.


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

### 7.1 D1 transaction design

All authoritative commerce, stock, booking, clinical, loyalty and outbox records start in one production D1 database so their invariants can be committed together. Drizzle uses its **D1/SQLite adapter**; review generated migrations and SQL against the remote runtime. Use foreign keys, unique operation keys, CHECK constraints, immutable financial events and integer paise. Store UTC timestamps and explicit clinic time zones; never use floating-point money.

D1 prepared-statement `batch()` is the atomic unit for related statements; a statement failure rolls back the batch. Do not hold an interactive transaction across JavaScript awaits or a payment/network call. See the [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/). Optimistic versions, conditional updates and triggers replace PostgreSQL row-lock/exclusion-constraint assumptions.

**A conditional UPDATE affecting zero rows is not a transaction failure.** For critical workflows, enforce preconditions using a trigger/constraint that aborts the batch, or make every dependent write conditional on the same successful reservation/version. Explicitly test that a failed guard cannot still create an order, invoice, appointment or outbox event. Never rely on reading affected-row counts only after unconditional dependent inserts have committed.

Keep transactions small and indexed. Critical stock, payment, consent and appointment reads use the primary path; initial release does not require read replication. If added later, use the supported session consistency mechanism and prove freshness. Do not cache private records, authorization decisions, checkout totals or appointment occupancy in a public edge cache.

### 7.2 Orders, inventory, payments and finance

1. Reprice the cart server-side using current customer/distributor eligibility, bundle/discount rules, taxes, shipping and consult-only authorization. Snapshot the accepted amount, tax basis and addresses.
2. Select eligible location batches using FEFO, minimum shelf life and recall/expiry rules. Build a bounded allocation plan, then atomically revalidate and reserve every allocation with the order, hold expiry and outbox event. A stale plan aborts and recomputes with bounded retries. Constraints/triggers prevent negative available stock and partial allocations.
3. Create the provider payment using the stable operation ID after commit. Store the provider reference; ambiguous timeouts enter reconciliation, not a fresh charge. COD uses its own acceptance and collection state.
4. Verify signed webhooks, provider account, amount/currency and reference. Deduplicate by provider event and business transition; accept out-of-order events safely. Confirm paid stock/order/invoice transitions atomically and emit an outbox event. The browser callback alone never marks paid.
5. Handle payment after reservation expiry explicitly: attempt an atomic new allocation; otherwise record a refund/review obligation. Never recreate unavailable stock to satisfy a late webhook.
6. Shipment consumes the specific reserved batches. Returns enter quarantine before any release. Transfers record source dispatch and destination receipt with full batch traceability; recalls identify affected orders/clinics.
7. Refunds, credit notes, referral credit and loyalty reversals use append-only ledger entries, unique source references and finance reconciliation. Invoice numbering is unique per approved series/period and allocated with the issuance transaction; never reuse a voided number.

Recurring subscriptions require an actual provider-confirmed mandate, renewal events, stock allocation, failed-payment recovery, pause/cancel and customer notice. Scheduling a reminder is not a subscription implementation. Renewals follow the same price/stock/tax invariants. No card data is stored by the app.

### 7.3 Doctor occupancy and clinical records

Model appointment duration as configured whole-minute UTC occupancy units. Claim **every occupied unit** in the appointment transaction, with a unique key on `(doctor_id, utc_minute)` across all clinics. This prevents overlap and cross-clinic double booking without a database-specific range exclusion. Include buffers in occupancy, validate clinic schedules/leave/fees, and reject any conflict atomically. Expired holds release only their own occupancy; confirmation, reschedule and cancellation recheck ownership/version. Late payment follows the approved rebook-or-refund path.

Issue short-lived video access only to the authenticated booked patient and assigned doctor within the permitted appointment window. Signaling validates membership; knowing a room ID grants no access. Test credential expiry, unauthorized joins, reconnect, degraded networks and staff revocation. TURN provides relay transport, not the consultation UI, clinical permissions or meeting lifecycle. The privacy review must consider peer IP visibility; enforce relay-only media if required. Use WebSocket hibernation for signaling where supported and close expired rooms; no always-on room timers or media processing in Durable Objects.

Version clinical notes and physician recommendations, preserve signatures/approval history and record consent. Cart conversion uses the signed recommendation's permitted products and validity. Dosage/refill reminders follow the physician-authored schedule, consent and timezone. Every staff read/write checks role, clinic and patient assignment in application code; D1 does not supply a PostgreSQL row-level-security policy for this design.

### 7.4 Reliable jobs, reminders and reconciliation

Commit each business change and outbox/due-job record in the same D1 transaction. Cron runs every minute, finds indexed due records, atomically claims a bounded batch with lease owner/expiry, verifies ownership and publishes stable IDs to Queues. Expired leases are reclaimable. A crash between publish and marking dispatched can create a duplicate; consumers must handle it.

Cloudflare Queues is [at least once](https://developers.cloudflare.com/queues/reference/delivery-guarantees/). Consumers validate operation/version, claim work, perform a bounded external call and persist its result. Use provider idempotency keys where available; reconcile unknown outcomes before repeating a charge, shipment or message. Record deduplication and business-state transitions even when a provider lacks exactly-once support. Use per-message acknowledgement/retry, exponential backoff, bounded attempts and DLQ inspection/redrive. No claim of exactly-once delivery is made.

Long-term subscription/refill/appointment/campaign schedules live in D1, not as months-long queued messages. Recheck consent, cancellation, purchase completion, current KB approval and human handoff at execution time. Abandoned-cart jobs suppress after purchase; dose/appointment reminders use execution deadlines and escalation rules so a long outage cannot deliver misleading stale reminders. Marketing jobs have separate bounded concurrency from clinical and financial work.

Maintain a dashboard for oldest due job, outbox lag, retry/DLQ count and unresolved provider outcomes. Periodic reconciliation compares provider payment/refund/mandate/shipment states against local ledgers. Webhook acknowledgement occurs only after durable receipt. Logs and queue payloads contain identifiers, not unnecessary patient notes or full health conversations.


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

D1 APAC placement is a location hint, not an India-residency guarantee; this revision replaces the previous Mumbai-hosting assumption. No processor is assumed to keep all data in India without contractual and technical verification. Approve the AI, video, messaging and monitoring data flows, international transfers, retention and contractual terms before sending patient information. Minimize identifiers; keep address/payment details out of model prompts and health details out of product analytics, error reports and marketing notifications. WhatsApp order lookup requires an authenticated account-link flow; a phone-number match alone is insufficient.

Set `store: false` for Responses requests and maintain authorized conversation history in company storage. This is not equivalent to zero provider retention. OpenAI documents default abuse-monitoring retention and approval requirements for additional controls in its [data-controls documentation](https://developers.openai.com/api/docs/guides/your-data). Verify the selected endpoints and actual account configuration, including audio, rather than assuming one retention policy applies to all features.

On Day 1, the clinic's designated privacy/legal reviewer and finance owner must sign off the applicable notices, retention schedule, access/deletion/export handling, minors/guardian workflow, teleconsultation records, product claims, medicine-sale restrictions, taxes and invoicing. Build the resulting controls into acceptance tests. The proposals' references to DPDP and AYUSH are not a legal assessment. The [official DPDP Rules publication and commencement materials](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025) should inform the review; verify what applies on the actual launch date.

Audit records capture actor, clinic, action, target record, timestamp and reason for access-sensitive changes. Restrict audit deletion; export protected audit records according to the approved retention schedule. Account deletion must revoke access and remove eligible data while preserving any records the approved retention policy requires.

## 9. Production sizing, capacity assumptions and performance gates

### 9.1 Workload baseline

| Measure | Planning assumption | Validation |
|---|---|---|
| Daily active users | 1,000 initial; 3,000 capacity envelope | Users/day is not simultaneous users or a performance guarantee. |
| Dynamic API calls | 80/user/day; 2.4 million/month at baseline | Static/CDN traffic reported separately; all Worker entry points count in metering. |
| Database reads | Illustrative 20 scanned rows/API call, about 48 million/month | Measure actual rows scanned per query, including jobs, reporting and staging. |
| Database writes | Budget assumption up to 5 million billed rows/month | Include index, occupancy, outbox, audit, session and cleanup writes. |
| Data | Account-wide D1 total below 5 GB initially; bounded logs/chat retention | Forecast growth from actual row sizes and clinical retention; files live in R2. |
| AI generation | 600 model responses/day; 18,000/month | Average 2,000 input and 300 billed output tokens per response, including allocated prompt/tool overhead. |
| Approved knowledge | 2,000 vectors at 1,536 dimensions | Keep versions, queries, refreshes and staging in actual usage count. |
| Background jobs | Under 150,000 small message deliveries/month initially | Includes reminders, notices, webhooks, indexing and retries; test real dose schedules. |
| Voice | 1,000 transcribed minutes/month | Separate from text model cost. |
| Video | 30 calls/day, 15 minutes, two participants | 27,000 participant-minutes/month; measure network bitrate and relay share. |

Cap active model generations at ten initially using short-lived D1 concurrency leases, release on completion and reclaim expired leases. Add per-account/phone/IP rate controls, bounded context and tool turns, provider timeouts and a circuit breaker. The 600/day model figure is a forecast, not permission to discard required user actions or urgent escalation. At saturation, expose safe retry/human routing; direct commerce/booking remains available.

### 9.2 D1 capacity limits and growth

D1 executes work serially within each database, so indexed short queries and bounded writes matter more than a daily user count. The current per-database maximum is **10 GB**, not a size that can be increased by paying for storage. The initial 5 GB cost allowance is account-wide. See [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

Avoid unbounded reports or clinical history scans on the request path. Maintain tested summary tables via jobs and reconcile them to source ledgers; page staff tables and export asynchronously. Index lookup keys, clinic/customer/date filters, due-job time/state and provider references. Measure scanned rows and query duration against a realistic retained dataset. Avoid excessive indexes that amplify stock, session and audit writes.

Alert at 50%, 75% and 90% of storage/usage budgets. Begin a growth decision before 5 GB production size or sustained query contention; execute a migration strategy before 8 GB leaves little operational headroom. Archive only according to approved retention and access requirements. Do not shard cross-clinic stock/doctor occupancy casually: cross-database transactions would require a redesign. If measured write contention or residency requirements disqualify D1, propose a managed relational alternative with revised cost rather than claiming infinite scale.

### 9.3 Measured performance gates

| Gate | Acceptance target on the production candidate |
|---|---|
| Sustained application load | 60 dynamic requests/second for 30 minutes with the Section 11 mix and representative retained data; 120 requests/second for five minutes. |
| Soak | Four-hour mixed-flow soak at 20 requests/second plus jobs and bounded concurrent AI/video activity; no resource/lease leak or unexplained growth. |
| Core response time | India test locations: read p95 below 500 ms; write p95 below 1 second, excluding separately reported provider latency. |
| Error and correctness | Below 1% unexpected server errors during the declared load; zero double charges, oversold units, double-booked doctor occupancy or unauthorized record access. |
| Database | No sustained overload; p95 business SQL/batch duration below 100 ms as an initial tuning target; report scans and contention. |
| Jobs | Healthy-state due-job pickup p95 under two minutes; urgent failures alert immediately; backlog recovery meets the workflow's execution deadline. |
| Assistant | Nonclinical first useful output p95 under five seconds in representative tests; medical blocks appear only after required approval/safety checks. Report total response/tool latency. |
| User experience | Key public pages mobile LCP target below 2.5 seconds on representative Indian mobile networks; no language/layout/accessibility blockers. |
| Recovery | Exercise the Section 12 recovery targets and provider reconciliation; record achieved values. |

These are acceptance tests and internal operating objectives, not measured results or vendor guarantees. If D1 cannot pass them, optimize and retest inside the capacity allocation or revise the architecture/forecast. Passing at 1,000 users/day does not automatically certify every higher workload. The 3,000-user envelope is a load-test target; its monthly AI/messaging cost is higher.


## 10. Single two-week execution schedule

All engineers integrate daily and test their own domains. The company demonstrates and accepts the integrated build each afternoon. The schedule assumes Day 0 evidence; no extra team members, hidden weekend implementation or reduced requirements are included.

| Day/date | E1 — lead/clinical | E2 — commerce | E3 — web/admin | E4 — mobile | E5 — AI/integrations | E6 — platform/quality | Integrated exit evidence |
|---|---|---|---|---|---|---|---|
| Day 1 · Mon 19 Oct | Contracts, D1 invariant prototype, WorkOS staff/customer authorization | D1 stock/payment/ledger prototype; live merchant checks | Store/admin skeleton, locales and catalogue import | Real-device auth/payment/WebRTC proof; store listings | Approved KB schema; model/embedding/voice benchmark; WhatsApp proof | Paid bindings, staging/production separation, CI, secrets, backup proof | Audited reuse and estimates fit 60 days; atomic rollback and identity/video paths demonstrated; stop/reforecast if foundations fail. |
| Day 2 · Tue 20 Oct | Clinic/doctor schedules, consent and role access | Opening batches, pricing, cart and payment outbox | Working catalogue/admin/doctor screens | Shared customer flows, deep links and native adapters | Approval/version pipeline, hybrid retrieval, Queues handlers | Cron leases, dedup/DLQ, schema migration and restore skeleton | Imported opening data; isolated roles; one complete job/retry/restore path. |
| Day 3 · Wed 21 Oct | Paid booking, occupancy conflicts, cancellation | Live checkout/COD, reservation expiry and refund | Full store checkout and booking/account views | Checkout/booking parity and returns | Grounded cited chat, human routing and account-linked tools | Critical journey automation, concurrent last-unit/slot tests | R01/R02/R11 build targets; real purchase/refund and cross-clinic conflict proof. |
| Day 4 · Thu 22 Oct | Notes, recommendations and assigned-patient panel | Unified order desk, FEFO/recall, bundles | Accounts, order desk, reviews and KB approval UI | Orders/tracking, consult/chat screens and accessibility | Controlled actions, WhatsApp order flow, notices and takeover | Permission/injection/webhook replay tests; scrubbed telemetry | Day-4 R01–R38 matrix targets demonstrated with traces, not mocks. |
| Day 5 · Fri 23 Oct | Multiclinic, signed cart conversion, dose/refill schedules | Recurring mandates, GST/credit notes, shipping/COD and courses | Three-language flows, campaigns/landing pages and SEO | Private web/native video, editable voice and push | Multilingual/red-flag gate, WhatsApp full flow and reminders | Outage/retry/lease tests; baseline metering and backup drill | All Day-5 feature targets integrated; provider sandbox plus minimal live verification. |
| Day 6 · Mon 26 Oct | Clinical regression and role/retention closure | Wholesale, loyalty/referrals and finance reconciliation | Growth/reporting/feeds, content and UI closure | Complete Android/iOS release candidate | Extra-language/Romanized safety, campaigns and funnel closure | Full requirement coverage report and candidate freeze | Every required feature implemented end-to-end; R01–R38 evidence gaps assigned, remaining effort reforecast. |
| Day 7 · Tue 27 Oct | Physician/privacy UAT and defect repair | Finance/warehouse UAT and defect repair | Front-desk/company UAT and language fixes | Real-device regression; submit complete tested apps | Clinical evaluation, human handoff and template acceptance | Security/critical-flow gates, signed release candidate | No critical safety/access/financial defects; tested native candidates submitted. Submission does not satisfy public release. |
| Day 8 · Wed 28 Oct | Concurrency and clinical recovery | Payment/stock/subscription recovery | Report correctness and performance fixes | Mobile-network/video recovery and review response | AI saturation, stale-index and provider outage tests | Section 9 load/soak; D1/R2 restore; queue replay; rollback | Capacity/correctness/recovery gates pass on the revised candidate. |
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
| Recovery | Exercise Worker version rollback, D1 unavailability, failed/zero-row guarded batches, dispatch/consumer crashes, expired leases, duplicate Queue messages, webhook replay and stale Vectorize entries; restore D1/R2 references and reconcile stock/payment/booking consistency. |

Every engineer owns unit/integration tests for their critical invariants. E6 maintains the shared automated journeys and test report. Test data must include consult-only products, multiple batches, two clinics, at least two fee rules, distributor accounts and all three interface languages.

### 11.2 Capacity and user-experience verification

Section 9.3 is the single source of numeric performance thresholds; this section does not define a competing set. Use a realistic dynamic mix: 65% catalogue/product reads, 15% account/order/tracking reads, 10% cart/availability, 5% checkout writes and 5% booking writes. Report cache-hit rate separately. Run concurrent chat/video tests without sending bulk load to live payment or messaging providers.

Record software/model versions, database/corpus size, D1 query/row metrics, concurrency limits, device/network locations, latency/error distributions and provider assumptions. Tests must cover the actual production architecture, including remote D1 atomic batches/triggers, Queue/Cron processing, WorkOS policies and real web/native video transport. Passing a laptop benchmark or free development deployment is insufficient.

### 11.3 Final go/no-go checklist

- [ ] R01-R38 have linked evidence and named company acceptance; no required feature is deferred, mocked or hidden behind a disabled flag.
- [ ] No unresolved critical/high security issue or Sev-1/Sev-2 defect. A moderate defect may remain only if it does not invalidate a requirement, clinical safety or a core journey, and has a named fix owner/date.
- [ ] Physicians approve clinical content, escalation, translations and evaluation results; privacy/legal and finance reviews are complete.
- [ ] Capacity, data consistency, native-device and recovery gates pass on the release candidate.
- [ ] Live merchant, subscription, WhatsApp, SMS, courier, AI and video access are verified; approved required methods/templates are active; required shopping-feed/listing approvals are recorded.
- [ ] Android and iOS are approved and publicly installable. A store review pending at the deadline means the complete cross-channel launch is pending.
- [ ] Workers Paid, D1 constraints/triggers, R2 authorization, Vectorize approval rechecks, staff-organization MFA and native sessions are deployed and verified.
- [ ] D1 transaction tests prove no partial order/stock/occupancy/outbox commits, including zero-row guard failures; database outage and restore behavior are verified.
- [ ] D1 outbox/due jobs, Cron leases, Queues retries/DLQ/redrive and provider reconciliation pass; AI saturation does not block direct purchase/booking operations.
- [ ] Booking-scoped signaling/TURN credentials and real web/native media pass access, network, privacy and metering checks; no consultation recording is enabled by default.
- [ ] Production TLS/DNS, staff MFA, secrets, alerts, backups, audit protection and permissions are verified.
- [ ] Restore, previous-version deployment and payment/booking reconciliation runbooks have been exercised.
- [ ] Company-owned repositories, service accounts, credentials recovery, operational guides and recorded training are handed over.
- [ ] Clinic product owner, physician owner, finance/operations owner, E1 and E6 record the release decision.

## 12. Launch, rollback, recovery and ongoing operation

### 12.1 Deployment and launch

Use company-owned production/staging bindings, queues, buckets, identity configuration and secrets. Staging contains synthetic or explicitly authorized sanitized data; it never sends production marketing or charges live customers. Pin Worker compatibility dates, dependencies, schema, mobile versions, prompts and approved knowledge revisions. Company owners retain account recovery and billing access.

CI checks types, critical domain tests, remote D1 migration compatibility and core journeys. Use additive expand/contract migrations, a migration lock, a verified export and compatibility with the previous deployed Worker. Do not combine destructive schema changes with launch. A code rollback does not reverse payments or database writes; reconcile their state instead. Keep native API compatibility across store review and rollout delays.

E6 deploys the tested version, E1 reviews production controls, and company clinical/finance/product owners sign the release record. Start with internal live transactions and a bounded public rollout, then widen only while correctness, latency and job lag are healthy. Every required feature must remain available in the final accepted release. Verify public installation from both app stores, required payment methods, consultation joins, WhatsApp tools and reminder delivery.

### 12.2 Backups and recovery

D1 Paid currently offers a 30-day Time Travel window; configure and practice the actual restore procedure. [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/). In addition, export D1 daily to a company-controlled encrypted destination independent of the production Cloudflare account, with a manifest of immutable R2 object references. Copy the required private/source objects under the approved retention plan. Test decryption with recovered company credentials. A same-account R2 export alone does not protect against account loss.

| Incident | Operating objective and response |
|---|---|
| Broken Worker release | Target rollback within 15 minutes to a schema-compatible version; verify money/stock/booking invariants. |
| Accidental data corruption | Time Travel recovery-point target at most 15 minutes before the incident, subject to available bookmarks and proven recovery behavior; isolate writes and rehearse the procedure. |
| Full application-data recovery | Restore, validate and resume within two hours as an initial measured target; do not promise this before the drill passes. |
| Cloudflare account/provider loss | Independent daily exports have a worst-case 24-hour recovery point before provider/webhook replay. No equivalent two-hour cross-provider recovery is claimed; record the actual alternative-host recovery estimate. |
| External provider divergence | Reconcile payment, refund, subscription, courier and communication states after restoration; restored database time cannot roll back a real charge or message. |
| Job or KB index loss | Rebuild from D1 business state/outbox and approved KB versions; suppress stale reminders and recheck all approval/consent states. |

Use UTC recovery checkpoints, object hashes, payment/booking control totals and audit exports to prove restoration. Versioned R2 object keys must be retained for the recovery window; mutable overwrites invalidate historic references. Separate financial/clinical retention from short operational log retention. Do not delete legally required records to stay within a storage allowance.

### 12.3 Operational ownership

Set an internal 99.9% monthly core-availability objective and independent endpoint checks; the budget does not purchase a dedicated availability SLA or 24-hour vendor support contract. E6 owns infrastructure/alerts with E1 as backup; E2 owns financial reconciliation, E5 messaging/AI, E4 native/video and E3 content/UI. Company clinical/operations contacts participate in the incident escalation rota.

Alert on unexpected API errors, high D1 latency/overload, stock/ledger invariant failure, payment mismatch, job lag/DLQ, missed clinical reminders, AI safety flags and unusual spend. Scrub health content/tokens from logs and restrict exports. Review costs weekly during launch, renew secrets/dependencies, reconcile money daily and review clinical content regularly. Human on-call and maintenance effort is an operating responsibility outside the infrastructure bill.

If D1 is unavailable, reject or safely retry authoritative writes; never accept paid orders or confirm appointments from cached state. If AI fails, direct workflows and physician/human escalation continue. If a messaging provider fails, retain the required channel work durably, expose delivery state and use approved alternate contact procedures; do not silently mark undelivered medical reminders complete.


## 13. Revised monthly cost in INR and cost controls

### 13.1 Basis and included allowances

Prices were checked against official vendor documentation on **18 October 2026**. Use **₹95/USD** as a budgeting assumption, not a live exchange-rate quote. Figures exclude applicable taxes, card/foreign-exchange charges, payment processing, delivery/COD charges and engineering/support labor. Account-wide allowances include staging, tests and background work; they are not separate free quotas for each service instance.

Workers Paid has a **$5/month minimum**, with 10 million requests and 30 million CPU-ms included. The request assumption is 2.4 million/month; at an illustrative 10 ms average CPU it uses 24 million CPU-ms before background/staging overhead. Measure that overhead and pay overages if needed. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

D1 on Workers Paid includes 25 billion rows read/month, 50 million rows written/month and 5 GB total storage. Above these, rates are $0.001/million rows read, $1/million rows written and $0.75/GB-month. Indexed writes count too. **D1 has no separate fixed $5 database subscription in this design.** [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

R2 Standard includes 10 GB-month, one million Class A and ten million Class B operations; egress is free. Keep retained files/backup copies and operations in the measured budget. [R2 pricing](https://developers.cloudflare.com/r2/pricing/). Queues includes one million operations/month; a small successfully delivered message usually takes three operations. Under 150,000 deliveries is about 450,000 operations before retries, safely only if actual metering agrees. Paid retention defaults to four days and can be configured up to fourteen. [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/).

Vectorize Paid includes 50 million queried and ten million stored dimensions. With 18,000 queries and 2,000 stored vectors at 1,536 dimensions, the documented queried-dimension formula gives about 30.72 million; stored dimensions are 3.072 million. Include staging and refresh activity in totals. [Vectorize pricing](https://developers.cloudflare.com/vectorize/platform/pricing/).

For signaling, 900 rooms/month × 15 minutes gives 810,000 room-seconds. At 128 MB per object this is about 103,680 GB-seconds even before hibernation savings, below the Paid included 400,000 GB-seconds; requests and storage must also fit. This is a workload estimate, not a claim that all Durable Objects usage is free. [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

The ₹199.50 domain/email/backup allowance assumes a small initial structured database (for example 0.25 GB), seven daily plus four weekly independent encrypted exports, modest object backups and low-volume email. It does not price daily full copies of a 5 GB database with unlimited retention. Retained patient records and source files must be measured and repriced as they grow.

### 13.2 Core platform and text assistant

| Component | Monthly USD | Monthly INR | Assumption |
|---|---:|---:|---|
| Workers Paid | $5.00 | ₹475.00 | Base plan; usage within included requests/CPU. |
| D1 | $0 additional | ₹0 | Included paid-plan allowance; indexed reads/writes and total DB storage remain within budget. |
| R2 | $0 additional | ₹0 | Within Standard allowances; media optimization and approved retention. |
| Vectorize | $0 additional | ₹0 | Corpus/query envelope above. |
| Queues/Cron and light signaling | $0 incremental forecast | ₹0 | Included allowances at measured use; Durable Objects usage reviewed separately and reserve below covers modest excess. |
| WorkOS AuthKit | $0 | ₹0 | Standard hosted domain, included MFA, below one million MAU; no enterprise SSO/custom-domain/paid audit add-on. |
| GPT-4o-mini text generation | $8.64 | ₹820.80 | 18,000 responses × (2,000 input + 300 billed output tokens). |
| Embeddings | $0.10 allowance | ₹9.50 | Modest initial refresh/query embedding usage. |
| Domain, low-volume email and independent encrypted backup | $2.10 allowance | ₹199.50 | Planning allowance, not a fixed vendor bundle; small retained datasets/exports and email volume. |
| Metered overage reserve | $1.00 | ₹95.00 | Small Worker/DO/log/storage excess; not an unlimited capacity cap. |
| **Core total** | **$16.84** | **₹1,599.80** | **Approximately ₹1,600/month before taxes.** |

Text calculation: 36 million input tokens × $0.15/million = $5.40; 5.4 million output tokens × $0.60/million = $3.24. GPT-4o-mini is the costed candidate, not a waiver of clinical evaluation. Embeddings use text-embedding-3-small; voice uses gpt-transcribe at the rate below. [OpenAI API pricing](https://developers.openai.com/api/docs/pricing). Multiple generation/tool rounds or a larger prompt raise cost; count actual billed tokens across the complete turn. If evaluation requires another model, recalculate before release.

### 13.3 Full-service scenario: voice, video, messaging and stores

| Addition | Usage assumption | Monthly INR |
|---|---|---:|
| Core platform/text AI | Section 13.2 | ₹1,599.80 |
| Voice transcription | 1,000 minutes × $0.0045/minute = $4.50 | ₹427.50 |
| Private video TURN | 27,000 participant-minutes at an illustrative 2 Mbps outbound media per participant; even all-relayed traffic is about 405 GB before overhead, below the shared 1 TB allowance | ₹0 incremental forecast |
| Apple Developer membership allocation | $99/year ÷ 12 = $8.25; paid annually, actual India invoice may differ | ₹783.75 |
| WhatsApp and SMS | **Illustrative ₹5,000 allowance**, to be replaced by actual delivered message counts/categories/provider quote | ₹5,000.00 |
| **Example total** | **Before taxes and excluded transaction/fulfillment/labor costs** | **₹7,811.05** |

**Recommended initial operating provision: ₹8,000–₹10,000/month before taxes**, under this scenario. This is a planning range, not a ceiling: larger campaigns, audio use, file retention or model usage can exceed it. The ₹5,000 messaging amount is an explicit estimate, not a verified quote and not an allocation large enough for every possible campaign. Use `WhatsApp billable messages by category/destination × current rate + SMS units × provider rate + applicable provider fees` to replace it. Preserve required order updates, reminders and opted-in campaigns; push/email savings apply only where the company-approved flow permits them. [WhatsApp pricing](https://business.whatsapp.com/products/platform-pricing).

Cloudflare TURN and SFU share a 1 TB free monthly outbound allowance; additional egress is $0.05/GB, or ₹4.75/GB at the planning exchange rate. Measure negotiated bitrate, retransmission/overhead and other use of that allowance. The baseline uses custom/reused WebRTC plus signaling, not a paid meeting UI SDK. [Cloudflare Realtime transport pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/).

If a reusable web/native video component cannot meet acceptance within the schedule, a managed meeting SDK is an explicit architecture/cost decision. For comparison, RealtimeKit at $0.002 per participant-minute would add **$54 ≈ ₹5,130/month** at 27,000 minutes; it is not included in the cheap baseline. [RealtimeKit pricing](https://developers.cloudflare.com/realtime/realtimekit/pricing/). Standard consultation recording is disabled; recorded staff training remains required. [Apple membership](https://developer.apple.com/programs/whats-included/) is an annual charge, not a monthly subscription invoice.

Google Play registration is a separate one-time account expense. Optional paid EAS build plans, paid monitoring/support, binary scanning, extra auth features and developer seats require explicit quotes if selected; none is assumed to be free without limits. Modest local/free build and monitoring allowances rely on existing company hardware/accounts and available quotas.

### 13.4 Comparison with the earlier $15–$20 estimate

| Budget assumption | This revision | Practical interpretation |
|---|---|---|
| $5/month Workers | $5 base ≈ ₹475 | Correct base price; CPU/request excess remains metered. |
| $5–$10/month AI API | $8.64 text + $0.10 embeddings ≈ ₹830.30 | Fits at 600 model responses/day with the stated token lengths; voice adds ₹427.50 in this scenario. |
| $5–$10/month AWS | No AWS application backend required | D1/R2/Queues replace it; only modest independent backup storage may use AWS or another provider. |
| $15–$20/month overall | $16.84 ≈ ₹1,600 core; $20 ≈ ₹1,900 | Credible core forecast within assumptions, not the complete operating cost of all required channels. |
| Full requirement usage | Example ≈ ₹7,812; provision ₹8,000–₹10,000 | Includes the stated voice/store/messaging scenario; payment/shipping/tax/labor excluded. |

Illustrative D1 overages: 8 GB total stored uses 3 GB beyond allowance, adding $2.25 ≈ ₹213.75/month. Sixty million billed writes uses ten million beyond allowance, adding $10 ≈ ₹950/month. These are additional D1 fees, not combined system totals. The 10 GB per-database maximum still applies regardless of payment.

If all dynamic/model usage triples for 3,000 DAU, text generation alone becomes $25.92 ≈ ₹2,462.40/month, and 10 ms/call CPU would exceed the Workers included allowance. Reprice from measured resource use; daily-user growth is not free because storage initially fits.

### 13.5 Budget enforcement without losing requirements

Meter costs by channel and environment; alert at 50/75/90% of monthly budget and inspect abnormal usage immediately. Use indexed queries, public caching, optimized images, approved retention, bounded model context/tool turns, abuse prevention and campaign consent/segmentation. Do not log health details to save debugging effort. Never drop required medical jobs, remove company features, bypass safety checks or silently disable a channel to preserve a $20 claim. Escalate a real budget conflict with measured usage and a revised forecast.


## 14. Principal risks and accountable responses

| Risk | Owner | Required response |
|---|---|---|
| Full scope exceeds 60 person-days | E1 and all six | Validate reusable assets and D1/native port effort on Day 0/1; reforecast on Days 1/3/6 without deleting requirements. |
| D1 guard/transaction errors | E1/E2 | Abort failed invariants atomically; test zero-row guards, last-unit races, overlapping occupancy and duplicate/out-of-order events on remote D1. |
| Serial database contention or size ceiling | E6/E1 | Index and bound work, measure load/retained data, forecast growth and approve migration before capacity is exhausted. |
| Delayed provider/store/merchant approvals | Company owners/E4 | Establish readiness immediately, submit tested complete apps early; document the unmet release gate instead of counting submission as delivery. |
| Cheap video increases implementation effort | E4 | Prove the reused web/native calling kit before commitment; test TURN/access/reconnect; quote a managed alternative if necessary. |
| Unsafe or unsupported clinical output | Physician/E5 | Approved blocks, current-version rechecks, mandatory safety retrieval, multilingual evaluation and human escalation; cheaper model is conditional on passing gates. |
| Sensitive data or residency mismatch | Company privacy reviewer/E1 | Approve actual processor locations/terms and access/retention controls; APAC hints do not satisfy an India-only requirement. |
| Duplicate jobs or unknown provider outcome | E2/E5/E6 | Stable operation IDs, leases, deduplication, DLQ and reconciliation; no exactly-once assumption. |
| Authentication configuration weakens staff MFA | E1 | Require organization-scoped staff sessions and MFA policy; test customer sign-in bypass, revocation and all role/clinic/patient boundaries. |
| Recovery export omits objects or real provider state | E6/E2 | Independent encrypted exports, immutable object manifest, restore drills and payment/booking reconciliation. |
| Messaging/model bill exceeds forecast | E5/finance | Quote real volumes/rates, show channel costs and alerts; preserve consent, safety and all required workflows. |
| Launch support spread across six engineers | E6/company owner | Primary/backup rota, recorded training and escalation; staff effort is budgeted separately from hosting. |


## 15. Required handover package

Full delivery requires all of the following:

1. Public web storefront, functioning clinic WhatsApp channel and publicly installable Android/iOS releases with every accepted company capability.
2. Working staff/physician workspaces, opening catalogue/batch stock, schedules, approved knowledge and English/Malayalam/Tamil resources; safe additional-language conversational routing.
3. Company-owned source, licenses/dependency register, pinned web/Worker/native builds, infrastructure configuration, API/event contracts, D1 schema/migrations/triggers, binding inventory and documented authorization boundaries.
4. Evidence for all R01–R38 requirements, clinical/language/access/financial tests, remote D1 concurrency/load evidence, recovery drill, real-device/video tests and recorded company release decision.
5. Operational guides for orders, subscriptions, finance, inventory, clinics, campaigns, reminders and handoff; WorkOS recovery/MFA, D1 restore/migration, R2 object recovery, Queue/DLQ redrive, provider reconciliation, Worker rollback and native API compatibility.
6. Recorded role-specific training, company account/secrets recovery, primary/backup support contacts, retention/content/security maintenance ownership, cost dashboard and the Section 13 assumptions with actual provider quotes.

**Completion standard:** All company launch requirements remain implemented, verified, available on their required channels and operable by the company. The two-week date and low-cost target do not waive any acceptance gate. This document is the final planning artifact; it does not claim that implementation, vendor approvals or production verification have already occurred.
