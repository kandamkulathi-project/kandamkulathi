# Kandamkulathi Digital Commerce & Companion

> **SUPERSEDED — historical architecture only** (integrated review, 19 October 2026). Use the numbered [current master](../implementation/Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md), phase/member plans 02–10 and [canonical tests](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). Do not execute this document’s old database/auth stack, E-role schedule or cost assumptions as a current baseline. Its scope history is retained for comparison; current architecture is Workers Paid + Neon PostgreSQL from development, with paid production-equivalent verification by Day 7. Pricing here is historical planning, not a newly verified current quote.

## Two-Week Production Implementation Plan

**Prepared for:** Kandamkulathi Ayurveda Vaidyasala\
**Planning date:** 17 October 2026\
**Delivery team:** Six full-time engineers\
**Target:** Full scope from both supplied proposals, including web, WhatsApp, Android and iOS\
**Capacity baseline:** 1,000 daily active users; validation envelope of 3,000 daily active users\
**Proposed delivery window:** 19 October-1 November 2026, subject to Day 0 readiness\
**Target public release:** 30 October 2026; monitored operation through 1 November\
**Document status:** Execution plan with explicit assumptions and release gates; not a completed architecture assessment or performance certification

---

## 1. Executive recommendation

Build one company-owned platform around **Medusa v2, Next.js, React Native with Expo, PostgreSQL and Redis**, deployed on managed AWS infrastructure in Mumbai. Use managed services for payments, recurring mandates, messaging, video and AI. Extend an established commerce foundation rather than implementing an order engine from scratch.

The release covers ecommerce, batch and expiry inventory, subscriptions, consultations, the physician panel, the multilingual Companion, voice input, WhatsApp, marketing tools, loyalty, distributor ordering, multiple clinics, and native Android and iOS apps. All are required for completion; none is assigned to a later release in this plan.

**Feasibility assessment:** Six people have approximately **60 person-days** in ten working days. A full production implementation of both proposals from an empty repository is not a defensible two-week commitment. This schedule is an aggressive integration and configuration plan that depends on existing, tested commerce and mobile foundations, an experienced team, approved business content and active provider accounts before development starts. Those foundations have not been supplied or verified. The Day 0 review must establish whether they actually exist.

App-store decisions and provider approvals remain outside the team's control. The target is publicly usable production software on every required channel. A TestFlight build, an internal Android build, a submitted app or a disabled required feature does **not** satisfy that target. If a prerequisite or release gate fails, report a missed full-scope deadline; do not relabel partial delivery as production completion.

## 2. Basis of scope and interpretation

This plan uses the proposals as business requirements, not as instructions to purchase services, contact people, accept commercial terms or execute a project.

| Source | Requirements used |
|---|---|
| **Kandamkulathi Ecommerce Proposal.pdf**, pages 3-8 | Checkout, accounts, invoicing, bilingual commerce, inventory, subscriptions, consultation-to-cart, courier operations, growth tools, reporting, multiple clinics, distributors and native apps. The highest package and the detailed capabilities are included together. |
| **Kandamkulathi Companion Proposal.pdf**, pages 3-9 | Approved knowledge base, assistant actions, clinical escalation, doctor scheduling, video consultations, medicine reminders, English/Malayalam/Tamil interfaces, additional conversational languages, WhatsApp, voice, governance, onboarding and training. |
| **User clarification** | Every company requirement in both documents must be included in the two-week delivery target. |

The Companion's English, Malayalam and Tamil launch requirement supersedes the ecommerce proposal's two-language baseline. Further conversational languages are supported through translation, with the medical-content safeguards in Section 8. Additional fully translated application interfaces beyond those three are outside the supplied launch scope. Historical patient/order migration is explicitly excluded by the Companion proposal; opening catalogue, stock, physician and approved-content imports are included.

The proposals' descriptions of the existing website and their commercial prices are source statements, not independently verified technical findings or implementation estimates. Their ongoing support terms do not establish a 24-hour incident-response service. Confirm the actual support arrangement before release.

## 3. Day 0 readiness: prerequisites for the two-week clock

Day 0 is a readiness checkpoint, not hidden implementation time. If material prerequisites are unfinished, include that work in the elapsed schedule and revise confidence in the deadline accordingly. For the example dates above, the checkpoint must pass before 19 October.

| Prerequisite | Accountable owner | Required evidence |
|---|---|---|
| Proven implementation foundation | Technical lead | An audited Medusa v2 starter with a working checkout; licensed reusable web/mobile screens; native payment, video and notification integration examples; an existing AWS deployment template. Tutorials alone do not qualify as production-tested assets. |
| Six appropriately experienced engineers | Delivery manager | Named people for the six roles in Section 4; prior delivery experience with this stack. This schedule has no allowance for learning a new commerce framework. |
| Catalogue and medical material | Clinic product owner and physician owner | Complete current product list, images, variants, prices, HSN/tax mapping, indications, dosage, contraindications, consult-only rules and approved claim wording. Record catalogue size on the backlog. |
| Clinical governance and languages | Physician owner and reviewers | Named approving physicians; English, Malayalam and Tamil dosage/safety translations; escalation wording; reviewers available daily with a four-business-hour response target. |
| Payments and recurring billing | Clinic finance owner | Live Razorpay merchant account, approved product category, enabled required payment methods, subscription/mandate access and refund permissions. Verify EMI eligibility where offered. |
| WhatsApp and SMS | Clinic operations owner | Clinic-owned WhatsApp Business account/number, active API access, approved transactional and marketing templates in the three launch languages, and an SMS provider with applicable sender/template approvals. |
| Distribution | Mobile engineer and clinic account owner | Verified company Apple/Google accounts, signing access, production eligibility, app identifiers, privacy/support URLs and review credentials. |
| Shipping and finance configuration | Operations and finance owners | Courier account/API access, pickup addresses, serviceability/COD rules, GST details, invoice numbering, cancellation/return/refund rules, and distributor pricing/credit policy. |
| Cloud and external processors | Platform engineer and clinic owner | Company-owned AWS, AI, video and monitoring accounts; domain/DNS access; Google Merchant Center/Business Profile access and product eligibility review; spending authority; approved data-processing and retention arrangements. |
| Acceptance availability | Clinic product owner | A daily review slot, physician testing time, front-desk and warehouse testers, and final release decision-makers. These are company participants, not extra engineering headcount. |

**Mobile release dependency:** Google documents a closed-test prerequisite for certain new personal developer accounts: at least 12 testers opted in continuously for 14 days before applying for production access. Check the actual company account's status; do not assume eligibility or borrow an unrelated account to bypass it. See [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB). Apple review also remains an external dependency. Expo upload/submission tooling does not itself publish an app; see [Expo's submission workflow](https://docs.expo.dev/deploy/submit-to-app-stores/).

## 4. Team structure and capacity

| ID | Role | Primary ownership | Required collaboration |
|---|---|---|---|
| **E1** | Technical lead / backend engineer | Architecture, permissions, clinical data, availability/booking, consultation records, multi-clinic access, integration contracts | Reviews transactional and security-sensitive changes; coordinates release with E6. |
| **E2** | Commerce backend engineer | Medusa configuration, Razorpay, subscriptions, GST, batches/expiry, courier, wholesale pricing, loyalty ledger | E1 reviews concurrency and access; E5 connects messaging events. |
| **E3** | Web / back-office engineer | Next.js storefront, staff console extensions, physician panel, content editor, campaign/report interfaces, localization | Reuses Medusa Admin components; E1/E2 provide stable APIs. |
| **E4** | Mobile engineer | Shared React Native Android/iOS app, native payment/video, voice capture, notifications, deep links, builds/store release | Shares API client and translations with E3; E5 supplies chat and transcription endpoints. |
| **E5** | AI / integration engineer | Approved-content retrieval, action tools, WhatsApp, SMS/email/push adapters, voice transcription, handoff and analytics events | Physicians validate content; E1 authorizes tools; E2 owns payment/order state. |
| **E6** | Platform / quality engineer | Infrastructure, CI/CD, automated critical journeys, load/security checks, monitoring, backup/restore and release runbooks | All engineers write domain tests and perform paired device/UAT checks. E6 does not individually test every feature. |

**Capacity allocation:** 42 person-days for configuration, implementation and integration; 12 for focused verification and UAT; six for release work and defect contingency. Total: 60 person-days. These are a capacity envelope, not measured feature estimates. E1 must validate the backlog against the audited reusable assets on Day 1. If remaining work exceeds this envelope, raise the schedule exception immediately while retaining the requested scope.

The baseline uses ten normal working days. Weekend work is not assumed to solve missing development capacity. The final weekend uses a planned support rotation with compensatory time. Each engineer reserves daily time for reviews and critical-path tests within their allocation.

**Operating rhythm:** 15-minute morning coordination; one shared integration build by midday; end-of-day demonstration with evidence against requirement IDs. Keep implementation changes small enough to review and integrate the same day. The clinic owner resolves business decisions that day.

## 5. Recommended production stack

There is no universally perfect stack. This selection fits the combination of a short deadline, transactional commerce, clinical access rules, four customer channels and a modest initial traffic level.

| Layer | Selected technology | Implementation decision |
|---|---|---|
| Runtime and repository | TypeScript, Node.js 24 LTS, pnpm workspace | One repository for backend, web, native app, shared contracts and infrastructure. Pin supported package patches and container digests on Day 1. Node 24 is listed as LTS in the [official release table](https://nodejs.org/en/about/previous-releases). |
| Commerce and application API | Medusa v2, extended with custom modules/workflows | Reuse catalogue, carts, orders, promotions, price lists and stock locations. Implement the clinic-specific modules explicitly. No second competing order backend. |
| Customer web | Next.js supported stable release, React, Tailwind CSS, next-intl | Start from the audited Medusa-compatible storefront; server-render product pages and share typed API contracts. Freeze a compatible stable version rather than following an unpinned `latest` tag. |
| Back office and physician panel | Medusa Admin extensions plus Next.js clinical workspace | Reuse commerce screens; add knowledge, batches, scheduling, conversation and report screens. Provide a common navigation experience with role-specific access. |
| Android and iOS | React Native, Expo development builds/EAS, Expo Router, TanStack Query | One native app codebase. Reuse types, business rules and translation resources; native/web layouts still require separate testing. Native SDKs require builds, not Expo Go. |
| Database | Amazon RDS PostgreSQL 17, Multi-AZ; pgvector for approved-content retrieval | Relational records and transactions are authoritative. Use Medusa's supported data/migration mechanism for extensions; avoid adding a competing ORM over commerce tables. Validate extension/version compatibility on Day 1. |
| Background execution | Medusa worker mode; production Redis event/workflow/locking providers | Dedicated Redis for workflow/event/lock infrastructure. Durable application job/outbox records in PostgreSQL for billing, reminders and integration replay. |
| Customer identity | Medusa Auth with verified email/password and recovery | Web uses secure HttpOnly session handling; mobile stores credentials/tokens in OS-backed secure storage. Add reauthentication for sensitive changes. |
| Staff identity | Amazon Cognito OIDC, MFA, custom Medusa auth integration | Mandatory MFA for staff and physicians. E1 must prove the OIDC-to-actor mapping and route permissions on Day 1. Do not assume the stock admin provides the required clinical roles or MFA. |
| Payments | Razorpay Standard Checkout plus Razorpay Subscriptions | UPI, cards, net banking and eligible EMI; COD is a separate business workflow. Razorpay manages recurring authorization; the application manages stock, cycle orders, cancellation and reconciliation. |
| Messaging | Meta WhatsApp Cloud API; MSG91 for SMS; Amazon SES for email; Expo Push | One notification service with consent, localization, templates, delivery state, retry limits and deduplication. Validate current provider approvals and quotas. |
| Shipping | Shiprocket API with clinic-approved courier rules | Serviceability, shipping rates, labels, pickup and tracking. Test medicine-category acceptance and COD at the selected pickup location. |
| Video | Daily web and React Native SDKs | Embedded consultations with private rooms and short-lived server-issued participant tokens. Managed media infrastructure; no custom video server. Daily publishes [web/native SDK examples](https://docs.daily.co/guides/additional-resources/demos). |
| Assistant | OpenAI Responses API, `gpt-5.4-mini-2026-03-17` | Pinned candidate for structured intent/tool handling and grounded nonmedical wording. Must pass clinical/language evaluations; model selection does not establish medical reliability. |
| Retrieval and voice | PostgreSQL/pgvector, `text-embedding-3-small`; OpenAI `gpt-transcribe` | Embed approved public knowledge only. Voice is push-to-talk transcription with editable text before submission. Validate Malayalam, Tamil and Romanized inputs using real speakers. |
| Hosting and files | AWS ECS Fargate, ALB, CloudFront, WAF, S3, Secrets Manager, KMS | Mumbai application/database region. Multi-AZ web/API tasks, private data services, managed certificates, separate public product and private clinical file storage. |
| Delivery and observability | GitHub Actions with AWS OIDC; Terraform; CloudWatch; Sentry; OpenTelemetry | Automated staging, reviewed production promotion, scrubbed diagnostics, alert routing and reproducible infrastructure. |
| Verification | Vitest, Medusa integration tests, Playwright, Maestro, k6, dependency/container scanning and OWASP ZAP | Focus on money, inventory, permissions, clinical safety, native devices and recovery. |

Medusa's [deployment guidance](https://docs.medusajs.com/learn/deployment) describes separate server and worker operation with PostgreSQL/Redis. This plan uses that foundation. **Batch expiry allocation, clinic permissions, GST rules, Razorpay adapters, clinical records, referrals and subscription orchestration still require implementation and verification.** Medusa's [subscription recipe](https://docs.medusajs.com/resources/recipes/subscriptions?trk=public_post_comment-text) describes extension work rather than a turnkey recurring-billing feature.

The chosen AI model supports function calling and structured outputs according to its [official model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini). The [file-transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text) documents the selected voice API. Validate actual account access, quotas, model availability and SDK compatibility on Day 1.

### 5.1 Architecture and responsibility boundaries

```text
Web storefront / Android app / iOS app / WhatsApp
                         |
               CDN/WAF and application entry points
                         |
               Stateless Medusa API + custom modules
                         |
      +------------------+------------------+
      |                  |                  |
 Commerce workflows   Clinical services   Companion orchestration
      |                  |                  |
      +--------- PostgreSQL / private S3 ---+
                         |
               Durable jobs + Redis + workers
                         |
      Payments / courier / messaging / video / AI providers

Staff and physicians use authenticated role-limited workspaces.
Provider webhooks enter verified backend endpoints, never client apps.
Video media travels through the video provider, not the application API.
```

Use a **modular monolith** with separately scalable web, API and worker processes. This workload does not justify Kubernetes, independently deployed domain microservices, Kafka or a separate search cluster. PostgreSQL search and vector retrieval are sufficient starting points; measure before adding infrastructure.

Next.js presents data and handles its session boundary. The backend owns pricing, taxes, payment state, reservations, medical-access checks and all writes. Mobile and WhatsApp invoke the same authorized application operations.

## 6. Full requirements and acceptance matrix

**Notation:** E = ecommerce proposal; C = Companion proposal; page references point to the supplied PDFs. All rows are launch requirements. The build day is the target for an integrated implementation; final acceptance also requires Sections 11-12. Supporting engineers are identified where necessary, but each row has one accountable owner.

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

## 7. Backend requirements and transaction design

### 7.1 Core records and constraints

| Domain | Authoritative records / essential protections |
|---|---|
| Identity and access | Customer/staff identity, role, clinic membership, patient assignment, account verification, consent version and timestamps. Deny access by default. |
| Commerce | Product/variant, price list, tax mapping, cart, order, payment attempt, refund, fulfillment, invoice and credit note. Store INR amounts in integer paise with explicit currency; never use floating-point totals. |
| Inventory | Location, stock receipt/transfer, batch, expiry, reservation and movement ledger linked to Medusa inventory. Unique external references and nonnegative available-stock invariants. |
| Clinical | Physician, department, location, availability/leave, slot/hold, appointment, fee payment, consent, note, signed recommendation, authorized cart and medicine schedule. Store instants in UTC and render clinic/patient timezones explicitly. |
| Companion | Conversation, message, identity link, tool attempt, handoff, callback, knowledge entry/version/approval, approved translations and citation references. Patient notes are excluded from the public knowledge corpus. |
| Growth | Mandate/subscription, billing cycle, reminder, consented audience, campaign, review, referral and credit ledger. Unique subscription-cycle and earning/reversal references. |
| Reliability | Verified webhook receipt, idempotency record, durable job/outbox, attempt history, audit event and reconciliation exception. Encrypted payload storage has explicit expiry. |

Use database uniqueness and transaction boundaries for invariants, not only application checks. Index customer/order ownership, physician/time, batch/expiry/location, webhook event ID, subscription/cycle, and notification due time. Paginate all lists; cap upload sizes, page sizes, query windows and chat context.

### 7.2 Mandatory workflows

**Checkout and payment**

1. Calculate product eligibility, price, discount, tax, delivery and COD policy on the server. Reserve eligible stock with an expiring hold.
2. Create a local payment attempt and provider order with an idempotent operation key. Never trust a client-supplied amount or success callback as final proof.
3. Verify checkout signatures and payment status server-side. Verify webhook signatures against the original request bytes; persist a unique provider/event ID before acknowledging receipt.
4. Process captured payment or confirmed COD through the authorized order workflow. Handle duplicate events and out-of-order transitions without duplicate fulfillment or invoices.
5. Release failed/expired reservations. A late captured payment after release triggers controlled reallocation or a finance-visible refund exception, never an unfulfillable silent order.
6. Reconcile unsettled payments/refunds regularly and settlements daily; alert on mismatches. Record refunds as pending until confirmed, with repeat requests protected against double refund.

These controls follow the failure conditions described in [Razorpay's webhook validation and idempotency guidance](https://razorpay.com/docs/webhooks/validate-test/).

**Inventory and medicine suitability**

- Use first-expiry-first-out allocation only among saleable batches. Exclude expired, recalled, quarantined or damaged stock and batches that violate a clinic-defined minimum remaining shelf-life rule at delivery.
- Lock the relevant product/location allocation while creating or releasing reservations. Keep the custom batch ledger and Medusa reservations linked by stable identifiers.
- Medusa workflows spanning modules are not assumed to be one database transaction. Define compensation and reconciliation for partially completed allocations; block dispatch if batch allocation and reservation totals disagree.
- Returns go to quarantine until staff confirm whether restocking is permitted. Maintain an auditable correction flow rather than editing historical stock movements.

**Appointments and video**

- Use short-lived slot holds and database-enforced collision protection across a physician's clinics and online/in-clinic schedules. A Redis lock alone is insufficient.
- Confirm a paid booking only after server verification; handle payment after hold expiry using an explicit rebook/refund path.
- Allow reschedule/cancellation only under published policy. Retain original fee/consent/recommendation history and process refund differences explicitly.
- Issue private video room tokens only to the assigned doctor and authenticated patient during an allowed time window. Do not publish permanent room URLs. Record participation metadata; video recording is off by default.
- A signed physician recommendation identifies patient, products, quantities, dosage, validity, author and revision. Consult-only products require server validation at cart creation, payment and each recurring cycle.

**Subscriptions, refills and reminders**

- Razorpay is authoritative for mandate/payment state; local records are authoritative for clinical eligibility, fulfillment and the per-cycle order link. Use a unique `(subscription, cycle)` constraint.
- A paid cycle creates one order after inventory and current recommendation checks. Precheck approaching renewals; if a later charge arrives without saleable stock, raise a refund/resolution task and notify the customer.
- Enforce cancellation before the next applicable cutoff, payment-failure handling, pause/resume and change-of-price/mandate rules supported by the provider. Never simulate auto-renewal with a reminder link.
- Derive daily schedules from the physician's recorded instructions. Do not infer a universal 30-day course or calculate a refill from AI-generated dosage.
- Create versioned, deduplicated due jobs. A schedule edit, opt-out, order cancellation or staff correction invalidates stale jobs. Respect quiet hours, timezone and the patient's channel choice.

**Notification reliability and external side effects**

- Commit the business state and its application outbox record together where they share a transaction. Publish after commit; use idempotent consumers. For commerce-module events, verify and document the framework's actual delivery behavior and reconciliation path.
- Maintain durable due-job state in PostgreSQL so a Redis failover does not silently lose future reminders. Rebuild pending work from those records.
- Use bounded retries with backoff, provider timeouts and a failed-job queue visible to staff. Provider delivery is not guaranteed; show failed messages and the approved fallback route.
- Acknowledge webhooks after verified durable receipt, then process asynchronously. Target acknowledgement within two seconds under normal load. Protect endpoints with size limits, rate controls and provider-specific verification.

## 8. Companion safety, languages and health-data handling

### 8.1 Approved-content pipeline

1. A staff editor creates an English source entry with its product/concern scope and provenance.
2. A named physician approves a version and the relevant Malayalam/Tamil dosage and safety text. Publication and approval are separate permissions.
3. Only current approved public content is indexed. Revoke stale versions immediately from retrieval and clear related answer caches; publish refreshed indexes within five minutes.
4. Retrieval filters by approval, scope, language availability and version. Patient-specific notes are fetched separately only for an authorized patient/doctor workflow.
5. Medical statements and dosage/safety blocks are rendered from approved source text with a version reference and named physician. Do not rely on a prompt asking a language model to avoid improvisation.
6. The model handles intent, navigation, nonclinical summaries and permitted translation around those blocks. Unsupported medical questions route to a physician or human queue using approved wording.

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

Use TLS, KMS-backed storage encryption, private clinical objects, short-lived signed downloads, least-privilege credentials and mandatory staff MFA. Record separate consent for consultation, health-data processing and marketing. Do not bundle optional marketing into the purchase requirement.

Application/database hosting in Mumbai does **not** imply every processor keeps data in India. Approve the AI, video, messaging and monitoring data flows, international transfers, retention and contractual terms before sending patient information. Minimize identifiers; keep address/payment details out of model prompts and health details out of product analytics, error reports and marketing notifications. WhatsApp order lookup requires an authenticated account-link flow; a phone-number match alone is insufficient.

Set `store: false` for Responses requests and maintain authorized conversation history in company storage. This is not equivalent to zero provider retention. OpenAI documents default abuse-monitoring retention and approval requirements for additional controls in its [data-controls documentation](https://developers.openai.com/api/docs/guides/your-data). Verify the selected endpoints and actual account configuration, including audio, rather than assuming one retention policy applies to all features.

On Day 1, the clinic's designated privacy/legal reviewer and finance owner must sign off the applicable notices, retention schedule, access/deletion/export handling, minors/guardian workflow, teleconsultation records, product claims, medicine-sale restrictions, taxes and invoicing. Build the resulting controls into acceptance tests. The proposals' references to DPDP and AYUSH are not a legal assessment. The [official DPDP Rules publication and commencement materials](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025) should inform the review; verify what applies on the actual launch date.

Audit records capture actor, clinic, action, target record, timestamp and reason for access-sensitive changes. Restrict audit deletion; export protected audit records according to the approved retention schedule. Account deletion must revoke access and remove eligible data while preserving any records the approved retention policy requires.

## 9. Capacity and infrastructure for 1,000+ daily users

### 9.1 Workload assumptions

Daily users do not equal simultaneous users. The following are explicit sizing assumptions to validate with the company; they are not measured demand.

| Metric | Initial planning assumption | Validation target |
|---|---|---|
| Daily active users | 1,000 | 3,000-user planning envelope |
| Dynamic application requests | 80 per user/day, excluding static assets, video media and individual chat stream chunks | 80,000/day initially; 240,000/day at the validation envelope |
| Average dynamic request rate | 80,000 / 86,400 = approximately 0.93 requests/second | Averages are not used as the peak capacity claim. |
| Busy-hour concentration | 20% of daily requests in one hour | Approximately 4.4 requests/second at 1,000 users; 13.3 at 3,000. |
| Burst allowance | Approximately 4x the 3,000-user busy-hour rate | Test 60 dynamic requests/second sustained; 120 requests/second for five minutes. |
| Active sessions | Up to 100 during initial busy periods | Exercise 200 realistic concurrent user sessions with think time; measure achieved request rate separately. |
| AI usage | 10% of daily users x six assistant responses | 600 responses/day initially; 1,800 at the validation envelope; test ten simultaneous generations and the necessary provider quota. |
| Orders | 5% of daily users | 50/day initially; 150/day at the validation envelope. This is not a revenue forecast. |
| Consultations | 3% of daily users | 30/day initially; test ten concurrent two-party video calls separately. |
| Reminder activity | 500 opted-in active medicine schedules x two doses/day | 1,000 dose jobs/day plus order, refill, booking and marketing messages; smooth clustered due times. |

### 9.2 Starting production configuration

| Component | Initial allocation | Scale / protection |
|---|---|---|
| Next.js web | Two Fargate tasks, each 0.5 vCPU / 1 GB, in separate availability zones | Autoscale 2-4; offload assets to CloudFront and builds to CI. Increase memory if observed SSR usage requires it. |
| API | Two Fargate tasks, each 1 vCPU / 2 GB, across availability zones | Autoscale 2-6; stateless requests, health/readiness checks and graceful connection draining. |
| Workers | One task at 1 vCPU / 2 GB; scale to three | Durable replay protects queued work during restart. Monitor oldest job age; configure distributed scheduler ownership and duplicate-safe execution. |
| Database | PostgreSQL 17 Multi-AZ instance deployment, 2 vCPU / 8 GB class, 100 GB gp3 initially | Private subnets, encryption, storage autoscaling to 300 GB, deletion protection and 14-day point-in-time recovery. Validate the chosen instance class in Mumbai. |
| Workflow Redis | Managed primary plus replica, approximately 1.5-3 GB per node initially | Multi-AZ automatic failover, TLS, authentication and no-eviction policy for job/lock infrastructure; alert on memory before saturation. |
| Objects and delivery | Separate S3 buckets/prefixes for public products and private records; CloudFront public-media delivery | Versioning/lifecycle rules, blocked public access for private files, upload type/size validation and malware checks for documents. |
| Networking | ALB, WAF, two-AZ network template, controlled outbound access | API entry protected; RDS/Redis have no public endpoint; external integrations use approved egress. Include per-AZ egress cost in the estimate. |
| Staging | Separate application services, database, storage and provider credentials with the same configuration model | Smaller normal capacity; temporarily match production for performance/recovery tests. Use synthetic or approved de-identified data. |

AWS documents ALB support for Fargate and HTTP routing in its [ECS load-balancing guidance](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-load-balancing.html). The resources above are proposed starting sizes, not a vendor guarantee of application throughput.

**Database connections:** Cap API pools at ten connections per task and worker pools at five. At maximum configured API/worker scale, that is 75 connections before migrations/operations. Establish the actual database connection limit on Day 1 and preserve at least 25 connections of operating headroom; reduce pools or add a compatible pooler if required. Monitor pool wait time and long transactions.

**Caching:** Cache public catalogue responses for approximately 60-300 seconds with invalidation after publication. Revalidate price, stock and eligibility at checkout. Do not publicly cache patient records, personalized orders, clinical responses or authenticated HTML. Configure CDN rules so they do not cache authenticated traffic or buffer chat streams incorrectly.

**AI isolation:** Set per-user message limits, a ten-generation initial global concurrency budget, bounded context/output, provider timeouts and a spend cap. Validate requests-per-minute and tokens-per-minute against the ten-stream test. Return an honest retry/handoff response on saturation. AI failure must not block normal store, booking or staff workflows; it still counts against the assistant's availability metric.

**Scale triggers:** Investigate sustained API CPU above 60%, p95 latency above target, pool waits, Redis memory above 70%, database CPU above 60% or oldest job age above 60 seconds. Scale API/workers when the bottleneck supports it; query fixes or a larger database may be necessary before more API tasks help. Runaway scaling is capped and alerted.

## 10. Two-week execution schedule

### Week 1: establish the back office, then complete customer journeys

| Day | E1: lead / clinical backend | E2: commerce backend | E3: web / back office | E4: Android / iOS | E5: AI / integrations | E6: platform / quality | Integrated exit evidence |
|---|---|---|---|---|---|---|---|
| **D1 - Mon 19 Oct** | Freeze contracts/schema; prove staff MFA and permission middleware; record scope estimates. | Validate starter; prove Razorpay charge/webhook/refund and subscription access. | Adapt design system; approve core layouts; initialize three locales and staff navigation. | Build/install native starter on both OSs; prove payment/video SDK compatibility. | Approve knowledge schema/tool contracts; verify real WhatsApp, transcription and AI access. | Deploy staging via existing IaC; CI, secrets, alerts, tests and artifact registry. | All six workstreams run in staging; reuse and account gates have evidence. Unresolved blockers are escalated the same day. |
| **D2 - Tue 20 Oct** | Roles/clinic memberships; physician/location/availability records; consent flow. | Import catalogue/opening batches; stock/price/tax setup; order desk baseline. | Operational admin screens, knowledge drafts, catalogue/product screens. | Shared API client, login, catalogue/cart screens and translations. | Approved-content indexing; notification adapter and webhook inbox; baseline evaluation set. | Backup policies, restore automation, critical test fixtures, permission test suite. | Staff can enter opening stock, phone orders and doctor schedules; physician can review content. |
| **D3 - Wed 21 Oct** | Slot holds, fee rules, booking concurrency and patient assignment. | One-time checkout/COD, payment verification, reservations and basic invoices. | Live web cart/checkout/account history; scheduling screens; physician panel skeleton. | Native checkout, order history, booking screens and secure deep links. | Grounded chat with citations; authorized read tools; real order notifications. | End-to-end purchase tests, last-stock/last-slot tests, device smoke checks. | A staging purchase and paid appointment complete from web/native; stock/payment/ownership checks pass. |
| **D4 - Thu 22 Oct** | Notes/recommendation signing; consult-to-cart API; cancellation/refund policies. | FEFO/expiry controls, bundles, location stock; subscription cycle implementation. | Knowledge approval/version UI; order/clinic operations; physician notes; account controls. | Embedded consultation video, chat, subscription UI, microphone capture. | WhatsApp identity link, booking/cart tools, handoff/callback console and review queue. | Automated refund/webhook replay, call-access tests, native network/permission tests. | Staff demonstrate consultation -> approved basket -> payment; doctor content appears with correct citations. |
| **D5 - Fri 23 Oct** | Medicine schedules/refill rules; multi-clinic access; late-payment recovery. | Renewal/failure/cancel flows, shipping/labels/tracking, GST exports and return/credit-note path. | Campaign pages, verified reviews, remaining locale/invoice templates, distributor UI. | Full customer flows, push notifications, voice correction, reminders/referrals screens. | Escalation rules, reminders/recovery, live staff chat and voice processing. | Integrated regression, provider-outage drills and preliminary load/security checks. | Full customer alpha across web, WhatsApp and both native apps; real integration evidence and all remaining defects listed. |

### Week 2: finish full scope, prove readiness and release

| Day | E1: lead / clinical backend | E2: commerce backend | E3: web / back office | E4: Android / iOS | E5: AI / integrations | E6: platform / quality | Integrated exit evidence |
|---|---|---|---|---|---|---|---|
| **D6 - Mon 26 Oct** | Complete clinical/access exceptions; coordinate physician UAT. | Finish wholesale, loyalty/referral reversals, stock reconciliation and subscriptions. | Finish reporting, SEO/feeds, campaign/loyalty management and three-language review. | Complete native parity, store metadata/privacy declarations and full release candidates. | Finish campaign segments, advanced language tests, funnel events and medical evaluations. | Full-scope regression on staging; verify all R01-R38 evidence. | **Feature-complete gate:** all requirements integrated, no mocks or placeholder screens in required journeys. |
| **D7 - Tue 27 Oct** | Repair UAT defects; review data minimization and audit coverage. | Finance UAT; real mandate/charge/refund smoke tests; reconciliation sign-off. | Clinic operations UAT; translation/accessibility corrections. | Device regression; submit complete, tested native releases to both stores. | Physician/linguistic sign-off; abuse/prompt-injection and human takeover tests. | Release-candidate security gate; deployment artifact freeze; assemble submission evidence. | A tested full-scope candidate submitted; high-risk clinical, payment and access defects closed. Store status tracked as external dependency. |
| **D8 - Wed 28 Oct** | Resolve concurrency/access findings; review production migrations. | Fix billing/inventory edge cases under load; financial recovery drill. | Repair browser/performance issues and report reconciliation. | Fix native faults; store-review responses and resubmission if required. | AI concurrency/latency checks; message retries; provider failure and quota handling. | Run 60 RPS/120 RPS tests, two-hour soak, task/Redis/DB failover and backup restore. | Capacity and recovery gates pass with recorded results on the intended configuration. |
| **D9 - Thu 29 Oct** | Lead clinic dress rehearsal; approve clinical records/access. | Reconcile opening inventory, invoice numbering, settlements and recurring state. | Train front desk/warehouse/finance; hand over guides and recordings. | Confirm store approval/release controls; deep-link and notification production checks. | Train physician/content reviewers and handoff staff; verify templates and opt-outs. | Production rehearsal, rollback exercise, runbooks, on-call rota and final test report. | Business and engineering go/no-go package complete; all launch requirements accepted and distribution approvals available. |
| **D10 - Fri 30 Oct** | Coordinate release decision; validate doctor/patient journeys. | Monitor real orders, fulfillment, invoices, payments and subscription setup. | Validate public web/SEO/locales and staff operations. | Release approved Android/iOS builds; verify public installation and real-device journeys. | Monitor assistant citations, escalation, delivery, callbacks and provider health. | Deploy approved artifacts, run live smoke tests, monitor rollout and execute rollback if needed. | **Full-scope production release:** public web, WhatsApp and both stores available; evidence, ownership and support handover complete. |

**31 October-1 November:** Planned support rotation monitors real transactions, failed jobs, consultations and conversations; reviews daily reconciliation; addresses release incidents. This is stabilization of delivered scope, not a scheduled period for finishing omitted features.

### 10.1 Critical dependencies and stop points

- **Platform chain:** verified starter/accounts -> staging and authentication -> transactional APIs -> complete web/native flows -> release-candidate tests -> store submission/approval -> public release.
- **Clinical chain:** physician-approved source material -> translated safety blocks -> published knowledge -> assistant tests -> physician sign-off -> public medical answers.
- **Recurring chain:** merchant eligibility/mandates -> subscription adapter -> cycle/stock/clinical checks -> renewal and cancellation evidence -> launch.
- **Operations chain:** opening batches and tax rules -> stock/invoice/dispatch correctness -> finance/warehouse rehearsal -> launch.

At D1, D3 and D6, compare remaining work with actual capacity. Escalate gaps immediately. Required features may be disabled temporarily to contain an incident, but a disabled requirement remains an unresolved delivery failure. Feature flags support deployment safety; they do not change full-scope acceptance.

## 11. Verification and measurable release gates

### 11.1 Functional and safety verification

| Area | Required test evidence |
|---|---|
| Payments and billing | Success/failure/cancel, duplicate/out-of-order/missing webhook, mismatched amount/currency, payment after hold expiry, partial/full refund, repeated refund request, real charge/refund, mandate/cancel and accelerated recurring cycle. |
| Inventory | Two checkouts compete for the final unit; expired/recalled/insufficient-shelf-life batches cannot ship; renewal stock shortage, return quarantine, location transfer and batch recall traceability. |
| Appointments | Two customers compete for one slot; physician booked across clinics; leave update, reschedule, late payment, cancellation/refund and video token authorization. |
| Access/privacy | Patient A cannot access Patient B; unassigned doctor cannot read records; front desk cannot read unrestricted notes; warehouse sees shipping data only; finance cannot access chat health details; content editor cannot self-approve. Test built-in and custom admin routes. |
| Assistant | At least 120 physician-reviewed scenarios across the three launch languages, plus 40 additional-language/Romanized cases; include unsupported claims, contraindications, consult-only items, urgent symptoms, stale knowledge, injection, unauthorized lookup and human takeover. |
| Assistant gate | Every critical clinical/access case must pass; zero fabricated dosage, unauthorized record access or prohibited action in the release set; 100% of displayed clinical blocks trace to approved versions. At least 95% approved task completion on noncritical supported cases. Sample results do not prove universal safety. |
| Native apps | Real Android and iOS devices, representative older supported OS/device, microphone/camera denial, dropped network, app resume, notification routing, payment return, accessible text sizes and Malayalam/Tamil rendering. |
| Growth/reporting | Marketing opt-out and quiet hours; campaign attribution; no recovery after purchase; verified review restriction; referral self-abuse and refund reversal; reports reconcile to known fixture totals. |
| Recovery | Kill an API task, interrupt a worker, test Redis failover and database reconnect, replay jobs/webhooks, restore backups and verify stock/payment/booking consistency after recovery. |

Every engineer owns unit/integration tests for their critical invariants. E6 maintains the shared automated journeys and test report. Test data must include consult-only products, multiple batches, two clinics, at least two fee rules, distributor accounts and all three interface languages.

### 11.2 Capacity and user-experience gates

Run a realistic mixture: approximately 65% catalogue/product reads, 15% account/order/tracking reads, 10% cart/availability operations, 5% checkout-related writes and 5% booking writes. Test chat generation and video concurrently but report their separate workloads. Do not load-test live financial captures or blast production messaging providers.

| Measure | Release criterion |
|---|---|
| Dynamic API latency | p95 <= 500 ms for normal reads and <= 1,000 ms for application writes, measured at the load generator and excluding provider checkout/video/AI completion. Report provider-dependent end-to-end latency separately. |
| Application error rate | < 0.5% unexpected errors at 60 RPS for 30 minutes and during the two-hour realistic soak; expected validation/stock-conflict responses reported separately. |
| Burst behavior | 120 RPS for five minutes without data corruption or uncontrolled failure; documented bounded throttling acceptable if user recovery works. |
| AI responsiveness | p95 first visible response within five seconds and completed supported short response within 20 seconds at ten concurrent generations; show progress/handoff when the provider fails. |
| Public product pages | Lab LCP <= 2.5 seconds, CLS <= 0.1 on representative mobile/network conditions; collect real-user data after launch rather than claim field performance before it exists. |
| Reminders | In the test workload, 99% of due jobs attempted within two minutes of the scheduled time; provider acceptance/delivery failures tracked independently. |
| Reliability | No duplicate charge, renewal order, invoice, stock decrement, loyalty credit or confirmed slot under replay/concurrency tests. |
| Headroom | No sustained pool exhaustion, unbounded queue growth, Redis eviction or memory leak; retain measured compute/database headroom at the accepted load. |

### 11.3 Final go/no-go checklist

- [ ] R01-R38 have linked evidence and named company acceptance; no required feature is deferred, mocked or hidden behind a disabled flag.
- [ ] No unresolved critical/high security issue or Sev-1/Sev-2 defect. A moderate defect may remain only if it does not invalidate a requirement, clinical safety or a core journey, and has a named fix owner/date.
- [ ] Physicians approve clinical content, escalation, translations and evaluation results; privacy/legal and finance reviews are complete.
- [ ] Capacity, data consistency, native-device and recovery gates pass on the release candidate.
- [ ] Live merchant, subscription, WhatsApp, SMS, courier, AI and video access are verified; approved required methods/templates are active; required shopping-feed/listing approvals are recorded.
- [ ] Android and iOS are approved and publicly installable. A store review pending at the deadline means the complete cross-channel launch is pending.
- [ ] Production TLS/DNS, staff MFA, secrets, alerts, backups, audit protection and permissions are verified.
- [ ] Restore, previous-version deployment and payment/booking reconciliation runbooks have been exercised.
- [ ] Company-owned repositories, service accounts, credentials recovery, operational guides and recorded training are handed over.
- [ ] Clinic product owner, physician owner, finance/operations owner, E1 and E6 record the release decision.

## 12. Release, recovery and ongoing operation

### 12.1 Release sequence

1. Freeze reviewed artifacts and supported package versions; take a pre-release snapshot and confirm latest recoverable backup time.
2. Apply backward-compatible database migrations once as a controlled task. Verify opening balances, invoice sequence, approved content and provider credentials.
3. Deploy API/workers/web through health-checked rolling updates while preserving the previous healthy artifact. Keep native API contracts backward-compatible with review and rollout delays.
4. Run staff-only production smoke tests, including a low-value authorized purchase/refund, appointment and private call, real message and mandate enrollment. Avoid presenting a sandbox-only flow as a live integration.
5. Enable public web/WhatsApp and release approved native builds in a coordinated window. Start with observed traffic and increase rollout where supported; completion requires general customer availability on all channels.
6. Monitor payments, availability, error rate, clinical escalations, notification backlog and stock/appointment invariants continuously during the first operating period.

### 12.2 Incident and rollback rules

Immediate containment triggers include duplicate financial actions, stock corruption, double bookings, exposed patient records, unsafe clinical output or a critical journey outage. An unexpected error rate above 2% for five minutes or sustained p95 latency above two seconds also triggers investigation and a rollback decision.

E6 leads platform response, E1 coordinates application/clinical containment, E2 handles money/stock, E5 handles assistant/messaging, and the clinic owner coordinates customer/clinical operations. Publish an actual reachable primary and backup rota before release. Set an internal target of acknowledgement within 15 minutes for critical production alerts during staffed support coverage; document overnight coverage explicitly.

Redeploy the previous compatible application artifact first. Keep additive database changes in place; use a tested forward correction for incompatible data changes. Mobile binaries cannot be instantly rolled back on devices, so use compatible APIs and remotely controlled containment while a corrected binary is reviewed. Redis or application rollback must not discard durable billing/reminder records.

Do not restore an old database casually to undo a software release: that can erase paid orders and appointments. A restore follows the disaster-recovery runbook, followed by provider/event reconciliation and explicit handling of transactions after the recovery point.

### 12.3 Service objectives and backups

| Objective | Launch operating target |
|---|---|
| Core platform availability | 99.9% monthly internal target, approximately 43 minutes of monthly downtime; not a contractual guarantee. Measure customer purchase/booking probes and each external-dependent journey separately. |
| Recovery point | <= 15 minutes for database recovery, contingent on observed RDS recoverable lag; alert if the objective is not met. Multi-AZ availability is not a substitute for backups. |
| Recovery time | <= two hours for a full database/application restore at the initial dataset size, demonstrated in staging and recorded. |
| Database backups | 14-day automated point-in-time recovery; daily snapshot policy and longer retention only as approved for clinical/financial records; pre-migration snapshots. |
| Files and audit | S3 versioning, lifecycle/retention controls, protected audit export and recovery instructions; scheduled backup verification. |
| Disaster scope | Launch baseline addresses task/AZ failures and same-region data recovery. A Mumbai-wide outage has no committed two-hour recovery without a separately tested cross-region system. |

RDS describes automated snapshots and point-in-time recovery in its [backup documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html). Actual recovery objectives must come from the team's drill, not from enabling a backup checkbox.

**Daily operations:** reconcile payment/refund exceptions, failed notifications, courier exceptions, stock differences, missed callbacks and consultation issues. **Weekly:** review access changes, failed jobs, capacity, restore health and security updates. **Monthly:** physicians review flagged conversations and knowledge changes; operations review funnel/refill performance. **Quarterly:** issue the operational/performance report described in the Companion maintenance scope. Establish the proposed allowance of up to eight hours of knowledge-base maintenance per month, along with named staff, a support response agreement and an overflow procedure. The proposals describe ongoing maintenance but do not supply an implementation of it.

## 13. Running-cost planning

The figures below are **engineering budget allowances in INR per month**, not retrieved provider quotations or a price guarantee. They assume the availability configuration in Section 9, Mumbai infrastructure and modest initial usage. E6 must replace them on Day 1 with a saved region-specific calculator estimate and vendor quotes, including currency conversion and taxes.

| Cost group | Monthly planning allowance | Notes |
|---|---:|---|
| Web/API/worker compute and registry | INR 15,000-25,000 | Always-on baseline, CI artifacts and limited scale-out. |
| PostgreSQL Multi-AZ, storage and backups | INR 25,000-45,000 | Instance choice, storage, retained backups and I/O change the total. |
| Redis primary/replica | INR 6,000-12,000 | Managed availability and actual memory tier. |
| Load balancer, egress/NAT, CDN, WAF, S3 and logs | INR 12,000-25,000 | Two-AZ networking and outbound processing can be material at low traffic. |
| Staging, monitoring and build services | INR 7,000-15,000 | Smaller staging plus temporary production-sized tests and native build plan. |
| **Infrastructure/tooling subtotal** | **INR 65,000-122,000** | Before tax, labor, support and transaction/usage charges below. |
| AI, transcription, messaging and video | **INR 10,000-40,000 initial reserve** | Usage-sensitive allowance; measure real prompts, minutes, language mix and message categories. Not included in the infrastructure subtotal. |
| **Indicative combined operating reserve** | **INR 75,000-162,000** | Before tax, gateway fees, shipping, SMS/other overruns and staff/support costs. |

For a full company production configuration, do not reuse the Companion proposal's INR 20,000-40,000 monthly estimate without rechecking the availability, usage and support assumptions. This plan deliberately budgets for redundant application/database infrastructure; reducing cost requires a recorded availability tradeoff, not simply using free tiers.

Build the usage estimate from explicit quantities: daily model responses x average input/output tokens x model rates; voice minutes x transcription rate; two-party consultation minutes x participant-minute rate; delivered WhatsApp messages by category/recipient market; SMS and push/email usage. Gateway charges depend on processed value/payment method; shipping depends on orders, weight, zone and COD. Store account charges, reusable-template licenses, taxes and engineering labor are separate.

Reference the current [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/) and [RDS PostgreSQL pricing](https://aws.amazon.com/rds/postgresql/pricing/) when producing the formal estimate. Apply budget alerts and investigate daily spend during launch; never disable critical clinical reminders silently to stay under a budget.

## 14. Principal risks and accountable responses

| Risk | Likelihood / impact | Prevention and response | Owner |
|---|---|---|---|
| No reusable foundations; full fresh build | High / deadline-critical | Audit before the clock starts; validate remaining work on D1. If the base does not qualify, retain full scope and explicitly state that the two-week delivery forecast is unsubstantiated. | E1 / delivery manager |
| Store, payment or messaging approvals arrive late | High / blocks public delivery | Verify company accounts and eligibility Day 0; submit complete tested apps D7; track daily. External approval is a dependency, not something extra developers can guarantee. | E4 / clinic account owner |
| Clinical content/translation approval arrives late | High / blocks safe assistant release | Prepare complete source material before D1; daily named physician review; no unapproved clinical text published. | Physician owner / E5 |
| Six roles exceed 60 person-days | High / delivery and quality | Reuse mature components, integrate daily, avoid bespoke visual design, examine D1/D3/D6 actual progress. Escalate schedule failure rather than delete requirements or skip gates. | E1 |
| Incorrect recurring billing or FEFO behavior | Medium / financial and clinical harm | Unique cycle IDs, reservation invariants, webhook replay tests, stock reconciliation, clinical eligibility checks and finance UAT. | E2 |
| Staff access bypass through existing commerce routes | Medium / severe privacy exposure | Cover all built-in and custom endpoints with tested authorization; limit privileged admin access; verify actor/clinic/patient scope server-side. | E1 |
| Native SDK, deep-link or video problems | Medium / blocks app acceptance | Prove both native OS integrations D1; use development builds and real devices throughout, with a tested licensed starter. | E4 |
| Provider outage/quota or uncontrolled AI cost | Medium / customer disruption | Timeouts, quotas, spend alerts, durable retry, honest status/handoff and isolated core commerce/booking operations. | E5 / E6 |
| Catalogue/stock/tax data incorrect at cutover | Medium / money and fulfillment errors | Validate imports, reconcile opening batches/prices, finance approval and warehouse dress rehearsal. | E2 / clinic operations |
| Unstaffed after-hours handoff/incidents | Medium / service failure | Publish working hours, callback expectations and engineering support rota. Provide urgent-care escalation independent of clinic callback hours. | Clinic operations / E6 |

## 15. Required handover package

The two-week delivery is complete only when the company receives:

1. Publicly available web storefront, functioning clinic WhatsApp channel, and approved Android/iOS releases with the complete accepted customer scope.
2. Working staff/physician workspaces, opening catalogue and batch inventory, schedules, approved knowledge versions and three-language application resources.
3. Company-owned source repository, dependency/license register, pinned builds, infrastructure definitions, API contracts, schema/migration documentation and service-account inventory.
4. Evidence for all R01-R38 requirements; clinical/language, security, concurrency, load, restore and native-device test reports; recorded release decision and unresolved minor-defect register.
5. Finance, fulfillment, subscriptions, reminders and handoff operating procedures; dashboards/alerts; backup, incident, reconciliation and rollback runbooks.
6. Recorded role-specific training, administrator recovery instructions, named primary/backup support contacts and ongoing security/content-maintenance responsibilities.

**Completion standard:** Every requested launch capability is implemented, verified, accessible on its required channel and operable by the company. Passing this standard is the condition for calling the system production ready; the calendar deadline alone is not.
