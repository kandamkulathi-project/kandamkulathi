# Kandamkulathi Digital Commerce & Companion

> **SUPERSEDED — historical architecture only** (integrated review, 19 October 2026). Use the numbered [current master](../implementation/Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md), phase/member plans 02–10 and [canonical tests](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). Do not execute this document’s old database/auth stack, E-role schedule or cost assumptions as a current baseline. Its scope history is retained for comparison; current architecture is Workers Paid + Neon PostgreSQL from development, with paid production-equivalent verification by Day 7. Pricing here is historical planning, not a newly verified current quote.

## Final Production Architecture and Two-Week Implementation Plan

**Prepared for:** Kandamkulathi Ayurveda Vaidyasala\
**Final revision:** 18 October 2026\
**Team:** Six full-time engineers, with company clinical/finance/operations reviewers\
**Scope:** All requirements R01-R38 from both company proposals; web, WhatsApp, Android and iOS\
**Production baseline:** Cloudflare Workers Paid; private Amazon RDS PostgreSQL with pgvector, Multi-AZ, Mumbai; AWS background processing; Cognito identity\
**Capacity:** 1,000 daily active users initially; validate the workload assumptions for a 3,000-user planning envelope\
**Delivery target:** Ten working days, 19-30 October 2026; monitored operation through 1 November 2026\
**Status:** Final planning baseline for implementation. Architecture, capacity, reusable assets and release readiness still require the evidence specified below.

---

**Scope commitment:** Every company requirement remains required for full release. Native store approval, unfinished features, disabled required features and partial channel availability cannot be counted as completion. The two-week date is an aggressive target with explicit prerequisites, not a guarantee that an unstarted custom system or third-party approvals can meet it.

## 1. Architecture decision and delivery feasibility

Use **Cloudflare Workers Paid + Hono + TypeScript** for application APIs; **Astro with selectively hydrated React** for public commerce pages; **React** for customer/staff/physician workspaces; **Expo/React Native** for Android and iOS; and **Amazon RDS PostgreSQL 17 + pgvector** as the authoritative relational database and approved-knowledge index. Keep files in **AWS S3**, identity in **Amazon Cognito**, and durable background execution in **Amazon SQS + Lambda + EventBridge**.

The application is one modular codebase with commerce, inventory, clinical, knowledge, messaging and audit boundaries. API and Companion Workers are separate runtime entry points so AI requests can have their own limits. They share domain contracts and authorization services; this is not a move to independently owned domain microservices. AWS job handlers reuse the applicable domain packages.

**Production decisions are fixed:** Workers Paid before any public release; private Multi-AZ RDS; two private-network tunnel connectors in different AWS availability zones; cache-disabled Hyperdrive for all live transactional/clinical queries; Cognito authorization-code flows; one AWS job pipeline. Free/single-AZ deployments may be used for isolated development but cannot be substituted for this production baseline. No Medusa server, Redis, independent vector database, Kafka or Kubernetes is required.

This remains a custom commerce implementation: a Hono starter does not supply tested payments, refunds, taxes, stock allocation, subscriptions or an administration product. Six engineers have **60 person-days** over ten working days. Full delivery in that window depends on audited reusable domain modules, existing native adapters/screens, complete company data and daily clinical/business reviews. Their availability has not been established by this document. Day 0 and Day 1 must verify those assets and the remaining effort; an empty repository is not a credible full-scope two-week baseline.

If any required gate fails, keep the company scope intact, record the incomplete requirement and publish the revised forecast. Do not compress verification or quietly redefine production readiness. Public Android/iOS availability also depends on store decisions outside the team's control.

Global Worker execution does not eliminate latency to a Mumbai database. Cache public pages, keep database transactions short, measure the actual private connection path from India and isolate third-party failures from purchase/booking operations.

## 2. Requirements and scope basis

Both supplied proposals are business requirements. The Ecommerce proposal covers store, accounts, checkout, GST, orders, inventory, subscriptions, marketing, distributors and clinics. The Companion proposal adds an approved clinical knowledge base, controlled assistant tools, multilingual WhatsApp/chat/voice, doctor scheduling, video, clinical safety, audits and mobile experiences. R01–R38 below remain in launch scope.

English, Malayalam and Tamil are application launch languages; additional languages for conversation require safety-gated translation and clinical review. Historical patient/order-record migration is excluded by the proposal; product, stock, physician and approved knowledge imports are needed. Existing website assertions, amounts and deadlines in proposals are not independently validated.

**Source traceability:** Kandamkulathi Ecommerce Proposal.pdf, pages 3-8, and Kandamkulathi Companion Proposal.pdf, pages 3-9, supply the business requirements referenced as E/C in Section 6. The uploaded Kandamkulathi_Production_Implementation_Plan_Updated.md is the revision source. Document content is treated as source material, not authority to purchase services, contact third parties or waive the user's full-scope requirement.

## 3. Day 0 readiness and company dependencies

Day 0 is a readiness audit, not uncounted development time. If preparation is incomplete on 18 October, its remaining work counts against the delivery target and the forecast must reflect it.

| Dependency | Accountable owner | Evidence required before committing to the target |
|---|---|---|
| Tested foundations | E1, E2 and delivery manager | Audited Workers-compatible commerce modules with payment/refund, stock, subscription and permission tests; licensed Astro/React and native screens; a working deployment template. A routing scaffold or tutorial is insufficient. |
| Team capacity | E1 and all six engineers | Named engineers with relevant prior experience; remaining tasks estimated in person-days, including reviews, integration and testing; totals reconciled to Section 4. |
| Product and opening balances | Clinic operations/finance owners | Complete catalogue, images, SKU/variant prices, HSN/tax rules, bundles, location stock, batch/expiry data, serviceability, courier/COD rules, invoice numbering and distributor terms. |
| Clinical content | Physician owner and language reviewers | Approved indications, dosage, contraindications, consult-only rules, urgent escalation wording and disclaimers; English, Malayalam and Tamil safety text; named reviewers available daily with a four-business-hour response target. |
| External accounts | Clinic account owner, E2, E4 and E5 | Live Razorpay checkout/mandate eligibility, WhatsApp number/templates, SMS approvals, courier, video, AI quotas, verified company Apple/Google accounts and production eligibility; Merchant Center/Business Profile access. |
| Infrastructure | E6 and clinic owner | Company-owned Cloudflare Paid and AWS accounts, domain/DNS, two-AZ network, approved spend, private connector hosting and credentials recovery; Mumbai RDS sizing/cost estimate. |
| Private connectivity dependency | E6, E1 and clinic technical owner | Demonstrated Hyperdrive -> Workers VPC/Tunnel -> private RDS connection; valid TLS chain/hostname verification for the actual RDS CA; written acceptance of the Workers VPC beta dependency and a connector/failover runbook. No public database or disabled certificate verification as an emergency shortcut. |
| Privacy and identity | E1 and clinic privacy/clinical reviewers | Processor/data-flow review, consent/retention/minors rules, Cognito account policy, doctor/patient assignment and approved medical claims. Mumbai storage does not establish residency for every processor. |
| Acceptance and support | Clinic product owner | Daily review access to physicians/front desk/warehouse/finance, named release approvers and a reachable launch support rota. These participants are not extra engineering staff. |

**Store prerequisite:** Verify the actual company account's production eligibility. Some new personal Google Play accounts require a continuous closed-testing period before applying for production access; that cannot be compressed into development days. See [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB). Prepare listing, privacy declarations, review accounts and screenshots from D1; submit the complete tested candidate on D7. Submission is not approval.

## 4. Six-person delivery team and capacity control

| ID | Engineer | Accountable workstream | Required supporting work |
|---|---|---|---|
| E1 | Technical lead / clinical backend | Module/API contracts, Cognito/session authorization, clinic/patient access, doctor scheduling, consultations, consent, recommendations and medicine schedules | Reviews E2 transactions, leads clinical UAT and scope/effort reviews. |
| E2 | Commerce backend | Catalogue, prices, cart, payments/refunds, GST, FEFO batch inventory, subscriptions, courier, bundles, wholesale and loyalty ledger | E1 reviews data consistency; E3 builds management screens; E5 connects notification events. |
| E3 | Web / back office | Astro storefront, React account/staff/physician workspaces, approved-content editor, three-language UI, campaigns, reports and SEO/feeds | Reuses audited UI modules; pairs with E1/E2 for integrated workflows. |
| E4 | Mobile | Shared Android/iOS customer app, native payments/video/voice, secure auth, deep links, push, build and public store release | Shares contracts/locales with E3, connects E5 chat endpoints, owns real-device regression. |
| E5 | AI / integrations | Hybrid retrieval, controlled responses/tool calls, WhatsApp, voice processing, messaging, handoff/callbacks and funnel events | E1 authorizes clinical/action tools; E6 owns infrastructure; E5 implements message/ingestion job handlers. |
| E6 | Platform / quality | Workers/AWS infrastructure, two connectors, CI/CD, migration execution, queue/dispatcher platform, monitoring, capacity and recovery evidence | All engineers write tests for their domains and support UAT. E6 does not individually test every feature. |

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

| Layer | Selected implementation | Production decision |
|---|---|---|
| Repository/runtime | TypeScript, pnpm workspaces, Turborepo; pinned stable compatible packages | One repository for API, Companion, web, mobile, Lambda handlers, contracts and Terraform. Use a supported Node LTS for build/Lambda tooling; test Workers runtime separately. |
| Public web | Astro + selective React hydration, Tailwind | Static product/concern pages on Cloudflare; dynamic signed-in experiences call the API. Versioned rebuild/invalidation after publication. |
| Web workspaces | React + Vite, TanStack Query and Router, shared design system | Customer, clinic administration and physician areas share contracts/locales and session policy. |
| Mobile | Expo/React Native, Expo Router, TanStack Query, EAS development/release builds | One native customer codebase; real Android/iOS SDK tests. No secrets in client bundles. |
| Application API | Cloudflare Workers Paid, Hono, Zod | Authoritative access checks and commerce/clinical writes; normal operations do not depend on an AI model. |
| Companion entry point | Separate Worker entry point using shared Hono/domain packages | Own request limits, model budgets and failure controls; bounded service calls to authorized domain operations. Public clients cannot bypass authentication via internal tool endpoints. |
| Data access | Drizzle + parameterized SQL; Hyperdrive with caching disabled | Drizzle owns migrations. PostgreSQL is authoritative; no second commerce database or ORM ownership. |
| Database | RDS PostgreSQL 17, `db.m7g.large` starting class, Multi-AZ, Mumbai; 100 GiB gp3 | Proposed starting size: 2 vCPU/8 GiB per instance. Validate current class/engine/pgvector availability and final performance on D1; increase size on measured evidence. |
| Retrieval | pgvector plus PostgreSQL keyword search and exact product/SKU/alias matching | One database; approved versions/mandatory safety records checked at request time. |
| Private connection | Hyperdrive -> Workers VPC/Tunnel -> two `cloudflared` connector hosts -> RDS DNS endpoint | Two small EC2 connector hosts in different AZs; no public RDS endpoint. Actual CA/hostname verification and failure testing are release prerequisites. |
| Identity | Amazon Cognito user pools, authorization-code flow with PKCE | Separate customer/staff pools and app clients; mandatory staff MFA. Backend enforces clinic/role/record access. |
| Files | S3 private clinical/knowledge-source buckets; public product assets delivered through CDN | Presigned uploads/downloads issued through a least-privilege Lambda signing function with Cognito-protected API Gateway entry; scan and quarantine uploaded documents before use. |
| Durable jobs | SQS Standard queues, Lambda consumers, EventBridge scheduled dispatcher, PostgreSQL outbox/due-job tables | One primary job architecture; idempotent processing, partial-batch failure handling, leases, retries and DLQ. |
| AI | OpenAI Responses API; pinned `gpt-5.4-mini-2026-03-17` candidate | Typed intent/tool proposals and nonclinical wording; evaluated before release. Approved clinical text is rendered separately. |
| Embeddings/voice | `text-embedding-3-small`, explicit 1,536 dimensions; `gpt-transcribe` for bounded audio | Embed approved public knowledge only. Record embedding model/config with index versions; benchmark supported languages and voice accuracy. |
| Payments | Razorpay Standard Checkout and Razorpay Subscriptions | Supported enabled UPI/cards/net banking/eligible EMI, plus separate COD workflow; provider-confirmed recurring mandates. |
| Messaging | Meta WhatsApp Cloud API, MSG91 SMS, SES email and Expo Push | Consent, templates, identity linking, deduplication and delivery tracking through AWS jobs. |
| Video | Daily web/React Native SDKs | Private participant tokens minted by backend; media bypasses API Workers. |
| Shipping | Shiprocket API with approved clinic/courier rules | Serviceability, rates, labels, pickup, tracking and COD reconciliation. |
| Delivery/monitoring | Terraform, GitHub Actions OIDC, CloudWatch, Cloudflare analytics, scrubbed Sentry and trace IDs | Reproducible environments, controlled migrations, staged rollout and rollback evidence. |

### 5.1 Runtime and data flow

```text
Public browser -> Cloudflare static/CDN -> Astro product pages
Web workspaces / Android / iOS / provider webhooks
                         |
                  Core API Worker (Paid)
                         |
                 Hyperdrive: no SQL cache
                         |
               Workers VPC / Cloudflare Tunnel
                         |
           Connector A (AZ-A) / Connector B (AZ-B)
                         |
           Private RDS PostgreSQL Multi-AZ, Mumbai
           business records + clinical records + pgvector
                         |
             outbox / due jobs / audit records
                         |
         EventBridge -> Lambda dispatcher -> SQS -> Lambda
                         |
              messaging / reconciliation / ingestion

Chat -> Companion Worker -> approved hybrid retrieval -> OpenAI
                         -> authorized domain tools -> Core API
Private files -> S3; video media -> Daily; identity -> Cognito
```

### 5.2 Private database connectivity and failover

E6 provisions two `t4g.small` connector hosts (2 vCPU/2 GiB proposed each), one in each AZ, with instance roles, managed patching, no public management ports and monitored `cloudflared` replicas. A fixed, least-privilege security-group path permits connectors and authorized Lambda functions to reach PostgreSQL. Hosts may use outbound-only networking through per-AZ egress; include the chosen egress/endpoints design in Terraform and costs.

Configure the private service against the **RDS endpoint hostname**, not a copied IP. Preserve TLS encryption and verify the actual certificate chain and hostname; test the selected Cloudflare path against the real AWS RDS CA. Do not lower verification to make a failed connection appear successful. Rotate tunnel tokens and DB credentials using a staged procedure that tests both connector paths without interrupting all clients.

Workers VPC is a beta dependency. The company technical owner records acceptance of its support/change risk before implementation. The selected route must pass connectivity, certificate, connector-loss, credential-rotation and RDS-failover tests. If the required trusted-CA behavior is unsupported on the account/path, the readiness gate fails and E1/E6 must record a reviewed transport redesign and forecast impact before proceeding. No unreviewed public-database fallback is included.

Cloudflare documents the connector requirement in its [private-database guide](https://developers.cloudflare.com/hyperdrive/configuration/connect-to-private-database-vpc/) and current status in [Workers VPC](https://developers.cloudflare.com/workers-vpc/). AWS describes DNS changes and required reconnection in its [Multi-AZ failover guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.Failover.html). These features do not establish end-to-end availability without the tests above.

### 5.3 Authentication, sessions and authorization

- Use separate Cognito customer and staff pools/app clients to enforce mandatory staff MFA without imposing the same enrollment policy on every customer. Link authenticated identities to internal actor IDs; role/clinic/patient assignment remains in PostgreSQL.
- Native login uses the system browser and authorization-code flow with PKCE, exact allowed redirect URIs and OS-backed secure token storage. No embedded client secret and no implicit grant.
- Web login uses authorization-code flow with PKCE and state/nonce validation. Keep provider tokens server-side in encrypted session storage; the browser receives only a Secure, HttpOnly, appropriately SameSite session cookie. Rotate sessions, apply CSRF protection to cookie-authenticated writes, validate origins and revoke sessions on logout/account disable. Cache public signing keys with bounded refresh, not mutable patient permissions.
- Every backend operation validates token issuer/audience/expiry and checks actor, role, clinic and target-record access. A service binding or signed internal request is not authorization to access every patient. Staff session expiry and reauthentication requirements apply to refunds, role changes and sensitive exports.
- Migration credentials are separate from least-privilege runtime credentials. If database row policies are added as defense in depth, use transaction-local context and test pooled-connection reuse; never assume session variables persist safely through Hyperdrive.
- Prove customer/staff mobile/web flows, disabled-account access, permission changes and cross-patient/clinic isolation on D1-D3. See [Cognito authorization-code/PKCE guidance](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html).

### 5.4 Cache, transaction and API rules

Use one cache-disabled Hyperdrive configuration per environment initially. It provides connection pooling without stale SQL results. Cache only public catalogue/page responses at the CDN, with locale/content version in keys and explicit invalidation. Recheck price, stock, recommendation eligibility and booking state at the write boundary. Authenticated HTML, patient records, carts, permissions and clinical responses are not public-cacheable. See [Hyperdrive caching controls](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/).

Keep commerce, inventory, clinical, knowledge, messaging and audit packages logically separate. Use indexed ownership/clinic filters, bounded queries, keyset pagination and server-generated operation IDs. Set query/lock/transaction timeouts and cap pools/concurrency; do not hold a transaction or pool connection while waiting for OpenAI, payment, video or messaging calls. Persist pending state, perform the external operation, then transition/reconcile under a short transaction.

All provider callbacks verify the raw signature and persist a unique event receipt before acknowledgement. Client success callbacks do not authorize fulfillment. Do not execute arbitrary SQL or URLs supplied by a model. Shared domain operations enforce the same permissions whether invoked by web, mobile, WhatsApp, a job or the Companion.

### 5.5 Retrieval, indexing and ingestion implementation

Drizzle migrations create canonical knowledge entries, immutable versions, named approvals, reviewed translations, product safety records and derived `knowledge_chunks`. Each chunk references a current approved version, scope, source, physician, locale and indexing status. Embeddings use an explicit model/configuration version and `vector(1536)` for the selected embedding configuration. Foreign keys and uniqueness on version/chunk prevent orphaned or duplicate index rows.

Combine exact SKU/product/approved alias matching, PostgreSQL keyword search and pgvector similarity, then rank a small supporting context set. Benchmark exact vector scans for the initial corpus; add HNSW only if measured latency/recall warrants it. For Malayalam/Tamil/Romanized questions, evaluate cross-language retrieval and medically reviewed aliases; translating a question does not establish medical correctness.

**Mandatory clinical context is separate from top-k retrieval.** After resolving a product/topic, explicitly fetch its current approved contraindications, dosage restrictions, consult-only rules, required disclaimer and reviewed locale blocks. Missing mandatory context produces the approved human/physician route. Similarity scores cannot waive these checks.

S3 upload -> quarantine/validation -> SQS ingestion -> Lambda extraction/chunking/embedding -> derived index publication. Bound file size/pages and embedding batches; split jobs to respect Lambda execution limits. Approved canonical text and withdrawal state remain authoritative even if indexing is delayed. Publish the new index atomically at the version-pointer boundary; revoke old content synchronously and invalidate derived caches. Never index patient notes in the public corpus.

### 5.6 AI control and failure isolation

Use the pinned model candidate after language/tool/safety evaluation; its [official model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini) lists structured output and function-calling support. Model access, quota and privacy configuration must be checked on the company account. Choose safe fallbacks and record any model/config change as a tested release.

The Companion Worker receives a separate global limit of ten in-flight generations initially, per-user limits, token/output caps, timeout and spend alarms. A short durable lease/counter operation enforces the budget; no shared in-memory counter is assumed. Use a single atomic database function for admission, promptly release the connection, and expire abandoned leases. Isolate API and AI database-connection budgets. OpenAI failure or saturation must not consume capacity indefinitely or stop direct purchase/booking access.

The model returns typed intent/tool proposals and nonclinical wording. Backend code validates every tool and customer confirmation; retrieval cannot authorize payment or clinical access. Support a bounded tool loop rather than assuming one model call can complete every action. No database transaction remains open during inference.

Use SSE for progress and permitted conversational output. **Do not stream unchecked generated medical instructions.** Render approved clinical blocks and validated source references separately; hold any generated content requiring validation until it passes. Client disconnection cancels abandoned generation where supported, releases leases and leaves confirmed business operations available for reconciliation.

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

### 7.1 Core records and constraints

| Domain | Authoritative records / essential protections |
|---|---|
| Identity and access | Customer/staff identity, role, clinic membership, patient assignment, account verification, consent version and timestamps. Deny access by default. |
| Commerce | Product/variant, price list, tax mapping, cart, order, payment attempt, refund, fulfillment, invoice and credit note. Store INR amounts in integer paise with explicit currency; never use floating-point totals. |
| Inventory | Location, stock receipt/transfer, batch, expiry, reservation and movement ledger linked to transactional inventory ledger. Unique external references and nonnegative available-stock invariants. |
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
- Lock the relevant product/location allocation while creating or releasing reservations. Keep the custom batch ledger and reservations linked by stable identifiers.
- External/provider workflows spanning domains are not assumed to be one database transaction. Define compensation and reconciliation for partially completed allocations; block dispatch if batch allocation and reservation totals disagree.
- Returns go to quarantine until staff confirm whether restocking is permitted. Maintain an auditable correction flow rather than editing historical stock movements.

**Appointments and video**

- Use short-lived slot holds and database-enforced collision protection across a physician's clinics and online/in-clinic schedules. A distributed application lock alone is insufficient; enforce the collision invariant in PostgreSQL.
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

- Commit the business state and its application outbox record together where they share a transaction. Publish after commit; use idempotent consumers. For domain events, verify and document the outbox publisher's actual delivery behavior and reconciliation path.
- Maintain durable due-job and delivery state in PostgreSQL so Lambda restart, SQS redelivery or dispatcher failure does not silently lose future reminders. Rebuild pending work from those records.
- Use bounded retries with backoff, provider timeouts and a failed-job queue visible to staff. Provider delivery is not guaranteed; show failed messages and the approved fallback route.
- Acknowledge webhooks after verified durable receipt, then process asynchronously. Target acknowledgement within two seconds under normal load. Protect endpoints with size limits, rate controls and provider-specific verification.

### 7.3 Short transactions and explicit pending states

Commerce, inventory and clinical records use the same authoritative database, allowing local state changes and outbox inserts to commit together. Define allowed payment/order/refund/subscription/booking transitions and reject illegal regressions from late or repeated events. Store a request payload hash with each actor-scoped idempotency key so a key cannot be reused with different amounts/items.

Inventory allocation uses a short transaction to lock eligible product/location batches, check saleable quantity and create/release reservations. The ledger is append-only with compensating adjustments. Appointment collision protection uses either immutable discrete slot identities with uniqueness or a PostgreSQL time-range exclusion constraint, according to the approved scheduling model. Test cross-location and overlapping-duration cases.

Create a durable pending payment/refund/booking attempt before calling a provider. Release all database locks/connections, call the provider with the supported deduplication mechanism, then finalize via verified result/webhook. A timeout means unknown outcome until reconciliation, not permission to retry blindly. Persist stable provider references and unique subscription-cycle/order links.

### 7.4 Single AWS background processing pipeline

| Stage | Selected mechanism | Reliability behavior |
|---|---|---|
| Commit | Domain transaction inserts the business mutation and `outbox_event` | Event cannot precede the committed business change. Store job type, opaque IDs, dedupe key, due time and schema version; avoid clinical text in queue bodies. |
| Dispatch | EventBridge invokes a bounded Lambda every minute | Claim pending/due rows in small batches with row locking, lease owner/expiry and attempt count. Commit the claim before a network call. Overlapping invocations cannot independently own the same unexpired lease. |
| Publish | Dispatcher sends to SQS Standard, then records publication | A crash after send and before status update can publish again. Expired leases are reclaimed; consumers must tolerate duplicate delivery. |
| Consume | Separate notification, integration/reconciliation and ingestion Lambda handlers/queues | Check job version and permissions/current business state, claim a short execution lease, release DB connection, perform the provider action, then persist the result. No transaction spans provider waiting. |
| Retry/fail | Bounded attempts, backoff, queue visibility and per-queue DLQ | Enable partial-batch responses so successful messages are not all retried because one fails. Unknown provider outcomes are reconciled before replay; inspect/redrive DLQ items through a staff-controlled runbook. |
| Scheduled care | PostgreSQL medicine/refill schedule and due-job rows | Only near-due jobs are enqueued; SQS is not the long-term calendar. Verify schedule version/consent immediately before send, and cancel stale work after edits/opt-out. |
| Receipt/reconcile | Provider delivery callbacks and scheduled reconciliation | Record provider message/action IDs, delivery state and exceptions. Replay delivery does not duplicate a charge, invoice, renewal order or loyalty credit. |

Start consumer timeout at 30 seconds for bounded notification/integration work and set SQS visibility to at least six times the function timeout plus batching window; adjust longer ingestion jobs and queue settings separately. Start with four-day source-queue retention and 14-day DLQ retention, verify the allowed settings and retain the PostgreSQL recovery history under the approved policy. Alert before messages approach expiry; the queue is not the sole record of a business obligation. Lambda handlers use least-privilege execution roles and direct private RDS connections; they do not traverse the Cloudflare tunnel.

E6 owns dispatch/queue configuration and recovery; E2 owns payment/inventory/subscription job behavior; E1 owns clinical schedule eligibility; E5 owns messaging/ingestion handlers and provider callbacks. Track oldest due job, dispatcher heartbeat, lease expiry, redeliveries, DLQ count and provider failure rate. See [AWS transactional outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) and [Lambda SQS error handling](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html).

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

Use TLS, KMS-backed storage encryption, private clinical objects, short-lived signed downloads, least-privilege credentials and mandatory staff MFA. Record separate consent for consultation, health-data processing and marketing. Do not bundle optional marketing into the purchase requirement.

Application/database hosting in Mumbai does **not** imply every processor keeps data in India. Approve the AI, video, messaging and monitoring data flows, international transfers, retention and contractual terms before sending patient information. Minimize identifiers; keep address/payment details out of model prompts and health details out of product analytics, error reports and marketing notifications. WhatsApp order lookup requires an authenticated account-link flow; a phone-number match alone is insufficient.

Set `store: false` for Responses requests and maintain authorized conversation history in company storage. This is not equivalent to zero provider retention. OpenAI documents default abuse-monitoring retention and approval requirements for additional controls in its [data-controls documentation](https://developers.openai.com/api/docs/guides/your-data). Verify the selected endpoints and actual account configuration, including audio, rather than assuming one retention policy applies to all features.

On Day 1, the clinic's designated privacy/legal reviewer and finance owner must sign off the applicable notices, retention schedule, access/deletion/export handling, minors/guardian workflow, teleconsultation records, product claims, medicine-sale restrictions, taxes and invoicing. Build the resulting controls into acceptance tests. The proposals' references to DPDP and AYUSH are not a legal assessment. The [official DPDP Rules publication and commencement materials](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025) should inform the review; verify what applies on the actual launch date.

Audit records capture actor, clinic, action, target record, timestamp and reason for access-sensitive changes. Restrict audit deletion; export protected audit records according to the approved retention schedule. Account deletion must revoke access and remove eligible data while preserving any records the approved retention policy requires.

## 9. Production sizing, capacity assumptions and performance gates

### 9.1 Demand model

These are sizing assumptions to validate with the company, not observed demand or a throughput certification.

| Measure | Initial assumption | Validation envelope |
|---|---|---|
| Daily active users | 1,000 | 3,000 |
| Dynamic API calls per user/day | 80, excluding static assets, video media and individual stream chunks | 80,000/day initially; 240,000/day at the envelope |
| Daily average rate | Approximately 0.93 requests/second initially | Approximately 2.78 requests/second at 3,000 users |
| Busy hour | 20% of requests in one hour | Approximately 4.4 RPS initially and 13.3 RPS at the envelope |
| Sustained/burst test | 60 dynamic RPS for 30 minutes | 120 dynamic RPS for five minutes, plus two-hour realistic soak |
| Concurrent sessions | Up to 100 initially | Exercise 200 realistic sessions with think time; report achieved RPS separately. |
| AI usage | 10% of users x six responses/day | 600 responses/day initially; 1,800 at the envelope; ten concurrent generations. |
| Orders/consultations | 5% order conversion; 3% consultation booking | 50 orders/30 bookings daily initially; 150/90 at the envelope. These are capacity assumptions, not sales forecasts. |
| Reminder load | 500 opted-in schedules x two dose times/day | 1,000 dose jobs/day plus order, booking, refill and marketing messages; test clustered due times. |
| Video | Two-party consultations | Ten simultaneous calls tested separately through the video provider; media does not transit Workers. |

Workers Paid is mandatory for production and production-equivalent staging. Free may be used only for isolated development with synthetic data. Its request/CPU/Hyperdrive restrictions are not production acceptance targets. Hyperdrive is included in Workers Paid; current [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/) must be saved with the Day 1 cost estimate.

### 9.2 Starting deployment specification

| Component | Production baseline | Bounds and acceptance |
|---|---|---|
| Core API Worker | Paid, Hono/TypeScript; pinned compatibility date and dependency versions | Explicit CPU limit and payload/rate limits; start with a 1,000 ms CPU budget per normal invocation and measure actual CPU separately from network waiting. The paid runtime's other resource limits still apply. |
| Companion Worker | Paid, separate entry point | Ten in-flight model generations globally initially; bounded token/context/tool loop and request duration. Independent per-user/model spend limits. |
| RDS | PostgreSQL 17 with verified pgvector, `db.m7g.large`, Multi-AZ instance deployment, Mumbai | Proposed 2 vCPU/8 GiB per primary/standby instance; 100 GiB gp3, storage autoscaling to 300 GiB, encryption, deletion protection and 14-day PITR. Final instance/extension support and capacity verified D1/D8. |
| Private connectors | Two `t4g.small` EC2 hosts, separate AZs | Proposed 2 vCPU/2 GiB each; one logical tunnel with independent replicas, managed restart/patching, no public management ports, connector health and failover alarms. |
| Hyperdrive | One cache-disabled production configuration | Cap origin connections at 40 initially using supported configuration; measure behavior and account for distributed-pool overshoot. No separate cached SQL pool at launch. |
| Lambda jobs | Start at 512 MiB for dispatcher/notifications/integrations; 1,024 MiB for ingestion | Configure bounded concurrency: dispatcher 1; notification 4; integration 2; ingestion 1; file signer 2. Size on measurements. Each execution uses at most one DB connection and releases it before external waiting. |
| SQS/EventBridge | Separate bounded-work queues with DLQ; one-minute dispatcher schedule | Visibility/retry/retention settings in Section 7.4; oldest job and failed-job alerts. No background Redis or Cloudflare queue branch. |
| S3 | Separate public product, private clinical and private source/quarantine areas | Encryption, versioning/lifecycle, direct bounded presigned upload/download, document scanning and authenticated signing. |
| Cognito | Separate customer and staff pools/app clients | Staff MFA; secure session flow and role/clinic/record tests. |
| Staging | Separate Workers, database/storage, identity clients and provider credentials | Smaller development profile permitted; production-equivalent sizing and two-connector path required for capacity/recovery evidence. Use approved synthetic/de-identified data. |

**Connection budget:** 40 Hyperdrive origin connections plus up to ten direct Lambda connections under the configured concurrency limits gives approximately 50 planned active connections. Reserve at least 25 more for migrations, recovery, monitoring and observed Hyperdrive overshoot. Check the actual RDS connection ceiling on D1; alarm before 70% sustained utilization and on pool waiting. A connection pool is not a hard global concurrency guarantee; see [Hyperdrive limits](https://developers.cloudflare.com/hyperdrive/platform/limits/). Do not increase Worker/Lambda concurrency without rechecking this budget.

**Network:** RDS has no public endpoint. Connectors and private Lambda functions use approved security groups. Define per-AZ outbound egress and AWS endpoints for SQS/S3/Secrets Manager where appropriate. Provider-bound Lambda calls need working outbound access; price NAT/endpoints/transfer rather than omitting them from a serverless estimate. The file-signing Lambda is exposed through a narrowly scoped API Gateway HTTP API using the correct Cognito JWT authorizer. It independently rechecks record permissions and issues only a short-lived URL for an allowed object/action. Core API forwards the authenticated actor credential; no browser receives AWS access keys.

**Database protections:** Separate runtime/migration roles and module responsibilities; query/lock/statement timeouts; required ownership/doctor-time/due-job/version indexes; no unbounded reports in the transactional path. Start vector ingestion at one bounded consumer, offload extraction/embedding outside transactions, and measure its impact on checkout/booking.

### 9.3 One authoritative performance and capacity gate

| Measure | Release threshold | Measurement |
|---|---|---|
| Public product LCP / CLS | LCP <= 2.5 seconds; CLS <= 0.1 | Representative mobile/network lab run; collect field measurements after launch. |
| Cached public HTML | p95 TTFB <= 250 ms at tested Indian locations | Multi-location synthetic probes. |
| Live application reads | p95 <= 500 ms | End-to-end load-generator timing; 300 ms is an optimization goal only. |
| Local application writes | p95 <= 1,000 ms, excluding provider operation completion | Full application request timing; 800 ms is an optimization goal only. |
| AI first response / completion | p95 first permitted visible content <= five seconds; supported short answer <= 20 seconds at ten generations | Includes embedding, retrieval, validation and model delay. Progress indicators alone do not satisfy the answer-content threshold. |
| Vector SQL | p95 <= 50 ms for the approved test corpus | Trace/query execution evidence; maintain required approval filters and retrieval recall. |
| Unexpected application errors | < 0.5% at sustained/soak workload | Separate expected validation/conflict/throttling responses. No corruption during the burst; documented bounded throttling must recover cleanly. |
| Reminders | 99% of due jobs attempted within two minutes | Measure scheduling/dispatch/consumer delay; provider delivery reported separately. |
| Consistency | Zero duplicate charge, invoice, renewal order, stock decrement, credit or confirmed physician slot | Replay, concurrent last-unit/last-slot and provider-timeout tests. |
| Headroom | No pool exhaustion, growing backlog, runaway CPU/memory or ingestion-induced transactional failure | Measure DB CPU/memory/connections, private path, Lambda concurrency and oldest job. |

Run the sustained/burst/soak tests on the production-equivalent Paid configuration with provider stubs for bulk traffic. Run a small authorized live integration proof separately. Exercise chat and video concurrently and report their separate load/cost. Test worker version rollback, loss of either connector, RDS failover, SQS redelivery and full restore. Investigate sustained database CPU >60%, pool wait p95 >30 ms, connection utilization >70%, missed dispatcher heartbeat or oldest eligible job >60 seconds. Correct queries/admission or resize the actual bottleneck before adding concurrency.

## 10. Single two-week execution schedule

All feature build targets in R01-R38 refer to this schedule. D1-D6 build targets depend on audited reusable modules and completed Day 0 inputs; D7 is full-candidate validation/submission, D8-D9 prove capacity/operations, and D10 is the conditional public release. A native submission delayed beyond D7 materially reduces the remaining approval window. No review duration is guaranteed.

| Day | E1: lead / clinical | E2: commerce | E3: web / back office | E4: native apps | E5: AI / integrations | E6: platform / quality | Required integrated evidence |
|---|---|---|---|---|---|---|---|
| **D1 - Mon 19 Oct** | Freeze contracts/domain model; Cognito actors, role matrix and effort review. | Audit commerce assets; prove charge/webhook/refund and subscription access. | Approve layouts/design tokens; Astro/React setup and three locales. | Install both native starter builds; prove auth/payment/video SDK compatibility; prepare store records. | Prove model/embedding/voice/WhatsApp access; freeze corpus and tool contracts. | Paid staging, RDS/private connectors/TLS, CI, migration path, queue skeleton and alarms. | Readiness/capacity audit passes; real private DB/identity/provider path demonstrated. |
| **D2 - Tue 20 Oct** | Clinic/doctor/availability/consent records and ownership guards. | Catalogue/opening batch import; price/tax rules; staff order baseline. | Staff navigation, opening-data screens, product/concern pages and knowledge drafts. | Shared API client, login/catalogue/cart and locales. | Approved-version ingestion, hybrid-retrieval prototype and notification handler. | Outbox/dispatcher/queue platform, signing path, backup policy and test fixtures. | Front desk/warehouse can enter opening records; approved knowledge is queryable. |
| **D3 - Wed 21 Oct** | Fee rules, slot holds/collision constraints and paid-booking foundation. | Server-priced checkout/COD, reservations, verified captured payment and order creation. | Web checkout/account flows; scheduling/doctor directory screens. | Native checkout/booking integration and secure deep links. | Cited Companion read tools and order notifications; initial clinical tests. | End-to-end charge/stock/slot/ownership tests and device smoke checks. | Purchase and paid booking work end-to-end in staging; no duplicate last-unit/slot success. |
| **D4 - Thu 22 Oct** | Physician notes, consented history, recommendation signing and cancel/refund policy. | FEFO/expiry restrictions, unified order desk, bundles and cycle-order implementation. | Knowledge approvals/version UI, physician panel, accounts and order tracking. | Embedded video, chat and subscription screens. | Governed actions, WhatsApp identity link, handoff/callback and source validation. | Replay/timeout/refund tests; connector-loss and session tests. | Approved consultation record and basket flow integrated; R04/R05/R14/R16/R17 demonstrated. |
| **D5 - Fri 23 Oct** | Consult-to-cart, medicine/refill schedules and multi-clinic access. | Real mandate/renewal/failure/cancel logic; GST/credit notes, courier and reconciliation. | Full three-language checkout/invoice labels, campaigns, reviews, stock/clinic management. | Native video/voice/push/deep links, customer history and reminder flows. | Clinical escalation, WhatsApp actions, dose/refill jobs, recovery reminders and staff replies. | Full customer alpha regression; finance/warehouse and native journey checks. | R01-R22/R24/R26/R28-R30/R32 build targets complete; defects and evidence are recorded. |
| **D6 - Mon 26 Oct** | Finish clinical/permission exceptions; review cross-domain invariants. | Finish referral/loyalty reversals, distributor rules and recurring/inventory reconciliation. | Finish reports, feeds/SEO, audience/campaign and loyalty management screens. | Complete all customer feature paths and both native release-candidate builds. | Finish additional-language/Romanized tests, campaigns, funnel metrics and unresolved-question review. | Check all R01-R38 evidence; integrated feature-complete regression. | **Feature-complete gate:** all required functionality integrated; no mocks/disabled required paths. |
| **D7 - Tue 27 Oct** | Physician/privacy UAT, actor/access and recommendation sign-off. | Finance UAT; authorized live charge/refund/mandate and courier proof. | Company UAT, language/accessibility review and critical fixes. | Full device regression; submit complete tested Android/iOS candidates. | Clinical/language evaluation, prompt/tool abuse tests and handoff sign-off. | Submission-candidate security gate, artifact freeze and release evidence. | Tested native candidates submitted; critical clinical/financial/access tests pass. Later binary changes require revalidation/resubmission. |
| **D8 - Wed 28 Oct** | Resolve race/access findings; review migrations and recovery invariants. | Validate money/stock consistency under load and unknown provider outcomes. | Browser/performance and report reconciliation fixes. | Review responses, device fixes and native regression for any changes. | Ten-generation load, provider outage/quota, retrieval and messaging retry tests. | Sustained/burst/soak, connector/RDS failover, dispatcher/SQS replay and restore drills. | Section 9.3 capacity and recovery thresholds pass with recorded configuration/results. |
| **D9 - Thu 29 Oct** | Lead clinic dress rehearsal and approve patient/doctor operation. | Reconcile opening stock, tax/invoice sequence, financial/recurring exceptions. | Train front desk, warehouse and finance; record guides and demonstrations. | Confirm actual store approval/release controls; installation and production links. | Train physicians/content/handoff staff; verify templates, opt-outs and callbacks. | Production rehearsal, rollback, runbooks, credentials recovery and rota. | R37/R38 accepted; all company approvals and external distribution dependencies ready. |
| **D10 - Fri 30 Oct** | Record release decision; validate real clinical/customer paths. | Observe orders, stock, invoices, payments/refunds and subscriptions. | Verify public storefront, web accounts, staff screens, reports and locales. | Release approved builds; verify public Android/iOS installation and journeys. | Observe cited answers, escalations, handoffs, delivery and provider health. | Promote reviewed artifacts, live smoke checks, staged rollout and incident response. | **Full production release only if all requirements and gates pass.** Pending store approval or missing scope means full release remains incomplete. |

**31 October-1 November:** Support rotation monitors delivered operations and daily reconciliation. This is stabilization, not an unreported extension for unfinished scope. If any gate fails, the responsible owner records the requirement/blocker, remaining work and revised forecast that day. Company scope and the six-engineer headcount remain unchanged.

### 10.1 Critical paths and decision checkpoints

- **Connectivity/identity:** Paid accounts and two-AZ private path -> valid TLS/DB/session access -> authorized API -> complete web/native journeys -> tested release.
- **Commerce:** reusable transaction foundation -> price/reservation/payment -> expiry/refund/recurring -> finance/warehouse evidence -> production.
- **Clinical AI:** approved content/translation -> current hybrid retrieval + mandatory safety -> safe actions/handoff -> physician evaluation -> publication.
- **Mobile:** working native adapters -> complete customer flows D6 -> security/device acceptance D7 -> submission -> external approval -> public installation D10.
- **Operations:** durable outbox/jobs -> notification/reconciliation proof -> load/failover/restore -> trained staff and support rota -> launch.

D1, D3 and D6 are forecast checkpoints. Re-estimate remaining person-days and external dependencies against the capacity table. Required functions may be contained temporarily during an incident, but remain unfulfilled until restored and verified; feature flags do not waive scope. Do not treat a pending approval as completed delivery.

## 11. Verification and release gates

### 11.1 Functional and safety verification

| Area | Required test evidence |
|---|---|
| Payments and billing | Success/failure/cancel, duplicate/out-of-order/missing webhook, mismatched amount/currency, payment after hold expiry, partial/full refund, repeated refund request, real charge/refund, mandate/cancel and accelerated recurring cycle. |
| Inventory | Two checkouts compete for the final unit; expired/recalled/insufficient-shelf-life batches cannot ship; renewal stock shortage, return quarantine, location transfer and batch recall traceability. |
| Appointments | Two customers compete for one slot; physician booked across clinics; leave update, reschedule, late payment, cancellation/refund and video token authorization. |
| Access/privacy | Patient A cannot access Patient B; unassigned doctor cannot read records; front desk cannot read unrestricted notes; warehouse sees shipping data only; finance cannot access chat health details; content editor cannot self-approve. Test every staff/customer/physician route, both Cognito pools, internal tool calls, session revocation and pooled-connection reuse. |
| Assistant | At least 120 physician-reviewed scenarios across the three launch languages, plus 40 additional-language/Romanized cases; include unsupported claims, contraindications, consult-only items, urgent symptoms, stale knowledge, injection, unauthorized lookup and human takeover. |
| Assistant gate | Mandatory safety/contraindication retrieval passes independently of top-k ranking; no unchecked generated clinical text is streamed; every critical clinical/access case must pass; zero fabricated dosage, unauthorized record access or prohibited action in the release set; 100% of displayed clinical blocks trace to approved versions. At least 95% approved task completion on noncritical supported cases. Sample results do not prove universal safety. |
| Native apps | Real Android and iOS devices, representative older supported OS/device, microphone/camera denial, dropped network, app resume, notification routing, payment return, accessible text sizes and Malayalam/Tamil rendering. |
| Growth/reporting | Marketing opt-out and quiet hours; campaign attribution; no recovery after purchase; verified review restriction; referral self-abuse and refund reversal; reports reconcile to known fixture totals. |
| Recovery | Exercise Worker version failure/rollback, stop each private connector, trigger RDS failover, interrupt dispatch/consumer processing, expire leases, redeliver SQS messages and replay webhooks; restore backups and verify stock/payment/booking consistency. |

Every engineer owns unit/integration tests for their critical invariants. E6 maintains the shared automated journeys and test report. Test data must include consult-only products, multiple batches, two clinics, at least two fee rules, distributor accounts and all three interface languages.

### 11.2 Capacity and user-experience verification

Section 9.3 is the single source of numeric performance thresholds; this section does not define a competing set. Use a realistic dynamic mix: 65% catalogue/product reads, 15% account/order/tracking reads, 10% cart/availability, 5% checkout writes and 5% booking writes. Report cache-hit rate separately. Run concurrent chat/video tests without sending bulk load to live payment or messaging providers.

Record software/model versions, database/corpus size, connection/concurrency settings, private path, device/network locations, latency/error distributions and provider assumptions. Tests must cover the actual production architecture, including both connectors and the AWS job pipeline. Passing a laptop benchmark or free development deployment is insufficient.

### 11.3 Final go/no-go checklist

- [ ] R01-R38 have linked evidence and named company acceptance; no required feature is deferred, mocked or hidden behind a disabled flag.
- [ ] No unresolved critical/high security issue or Sev-1/Sev-2 defect. A moderate defect may remain only if it does not invalidate a requirement, clinical safety or a core journey, and has a named fix owner/date.
- [ ] Physicians approve clinical content, escalation, translations and evaluation results; privacy/legal and finance reviews are complete.
- [ ] Capacity, data consistency, native-device and recovery gates pass on the release candidate.
- [ ] Live merchant, subscription, WhatsApp, SMS, courier, AI and video access are verified; approved required methods/templates are active; required shopping-feed/listing approvals are recorded.
- [ ] Android and iOS are approved and publicly installable. A store review pending at the deadline means the complete cross-channel launch is pending.
- [ ] Workers Paid, specified private Multi-AZ RDS, both connector hosts, valid TLS/hostname verification, Cognito pools/sessions, connection budgets and regional egress are deployed and verified.
- [ ] Workers VPC beta dependency is explicitly accepted; loss of either connector, database failover and credential rotation pass without an insecure transport fallback.
- [ ] AWS outbox/due-job pipeline, leases, SQS/Lambda retries, DLQ inspection/redrive and provider reconciliation pass; AI saturation does not block direct purchase/booking operations.
- [ ] Production TLS/DNS, staff MFA, secrets, alerts, backups, audit protection and permissions are verified.
- [ ] Restore, previous-version deployment and payment/booking reconciliation runbooks have been exercised.
- [ ] Company-owned repositories, service accounts, credentials recovery, operational guides and recorded training are handed over.
- [ ] Clinic product owner, physician owner, finance/operations owner, E1 and E6 record the release decision.

## 12. Launch, rollback, recovery and ongoing operation

### 12.1 Release sequence

1. Freeze reviewed artifacts and supported package versions; take a pre-release snapshot and confirm latest recoverable backup time.
2. Apply backward-compatible database migrations once as a controlled task. Verify opening balances, invoice sequence, approved content and provider credentials.
3. Deploy the reviewed Core API/Companion Workers, web and version-compatible Lambda handlers through staged rollout; verify both connectors and pending outbox/SQS work. Preserve previous artifacts and compatible event schemas. Keep native API contracts backward-compatible with store review/rollout delays.
4. Run staff-only production smoke tests, including a low-value authorized purchase/refund, appointment and private call, real message and mandate enrollment. Avoid presenting a sandbox-only flow as a live integration.
5. Enable public web/WhatsApp and release approved native builds in a coordinated window. Start with observed traffic and increase rollout where supported; completion requires general customer availability on all channels.
6. Monitor payments, availability, error rate, clinical escalations, notification backlog and stock/appointment invariants continuously during the first operating period.

### 12.2 Incident and rollback rules

Immediate containment triggers include duplicate financial actions, stock corruption, double bookings, exposed patient records, unsafe clinical output or a critical journey outage. An unexpected error rate above 2% for five minutes or sustained p95 latency above two seconds also triggers investigation and a rollback decision.

E6 leads platform response, E1 coordinates application/clinical containment, E2 handles money/stock, E5 handles assistant/messaging, and the clinic owner coordinates customer/clinical operations. Publish an actual reachable primary and backup rota before release. Set an internal target of acknowledgement within 15 minutes for critical production alerts during staffed support coverage; document overnight coverage explicitly.

Redeploy the previous compatible application artifact first. Keep additive database changes in place; use a tested forward correction for incompatible data changes. Mobile binaries cannot be instantly rolled back on devices, so use compatible APIs and remotely controlled containment while a corrected binary is reviewed. Application rollback must not discard durable billing/reminder records, pending outbox events or DLQ items. Lambda handlers must remain compatible with in-flight message schema versions. Disable a faulty consumer selectively and reconcile unknown provider outcomes before redrive.

Do not restore an old database casually to undo a software release: that can erase paid orders and appointments. A restore follows the disaster-recovery runbook, followed by provider/event reconciliation and explicit handling of transactions after the recovery point.

### 12.3 Service objectives and backups

| Objective | Launch operating target |
|---|---|
| Core platform availability | 99.9% monthly internal target, approximately 43 minutes of monthly downtime; not a contractual guarantee. Measure customer purchase/booking probes and each external-dependent journey separately. |
| Recovery point | <= 15 minutes for database recovery, contingent on observed RDS point-in-time restore position; alert if the objective is not met. Multi-AZ failover does not replace backups or guarantee zero recovery-point loss after logical corruption. |
| Recovery time | <= two hours for a full database/application restore at the initial dataset size, demonstrated in staging and recorded. |
| Database backups | 14-day automated point-in-time recovery; daily snapshot policy and longer retention only as approved for clinical/financial records; pre-migration snapshots. |
| Files and audit | S3 versioning, lifecycle/retention controls, protected audit export and recovery instructions; scheduled backup verification. |
| Disaster scope | Production baseline covers loss of one connector/AZ and same-region data recovery subject to measured failover; queue and provider reconciliation are part of recovery. A Mumbai-wide outage has no committed two-hour recovery without a separately tested cross-region system. |

RDS describes automated snapshots and point-in-time recovery in its [backup documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html). Actual recovery objectives must come from the team's drill, not from enabling a backup checkbox.

**Daily operations:** reconcile payment/refund exceptions, failed notifications, courier exceptions, stock differences, missed callbacks and consultation issues. **Weekly:** review access changes, failed jobs, capacity, restore health and security updates. **Monthly:** physicians review flagged conversations and knowledge changes; operations review funnel/refill performance. **Quarterly:** issue the operational/performance report described in the Companion maintenance scope. Establish the proposed allowance of up to eight hours of knowledge-base maintenance per month, along with named staff, a support response agreement and an overflow procedure. The proposals describe ongoing maintenance but do not supply an implementation of it.

## 13. Production budget and cost controls

Price the exact production baseline, not a free pilot. The table below gives **engineering planning allowances in INR/month**, not retrieved vendor quotations or a minimum bill. E6 must save a Mumbai-region AWS calculator estimate and actual account/vendor rates on D1 before provisioning. Company procurement approval remains outside this document's technical authoring task.

| Cost group | Monthly planning allowance | Included assumptions |
|---|---:|---|
| Workers Paid / edge execution | INR 1,000-3,000 | Base plan and modest API/Companion usage; Hyperdrive included under the paid entitlement. |
| RDS primary/standby and base storage | INR 30,000-50,000 | Proposed `db.m7g.large` Multi-AZ instance deployment, 100 GiB gp3; verify class/region rates. |
| Two private connector hosts | INR 3,000-7,000 | Two `t4g.small` hosts, disks and basic management overhead. |
| Networking/egress/endpoints | INR 8,000-18,000 | Selected two-AZ NAT/egress/endpoints design, transfer and private connectivity needs. |
| S3, retained backups and logs | INR 4,000-10,000 | Source/clinical/product storage, backup retention and bounded diagnostic retention. |
| Cognito, SQS, Lambda, EventBridge and signing HTTP API | INR 2,000-8,000 | Initial user/job load with bounded concurrency; actual identity tiers/features may change costs. |
| Separate staging/build services | INR 5,000-12,000 | Smaller normal staging, temporary production-equivalent tests and native build plan. |
| Monitoring/security tooling | INR 3,000-8,000 | Selected monitoring plans, alarms, scanning and retention. |
| **Infrastructure/tooling allowance** | **INR 56,000-126,000** | Before tax, engineering labor, support and usage groups below. |
| AI, embeddings, transcription, messaging and video | **INR 10,000-40,000 initial reserve** | Usage-sensitive reserve, not a ceiling; quote from actual model/locale/message/minute volumes. |
| **Combined operating reserve** | **INR 66,000-166,000** | Excludes tax, payment transaction fees, shipping, license purchases and staff/support labor. |

This availability-focused configuration is not the cheapest viable hosting arrangement. Avoid promising a low total based only on Workers pricing; the database, two-AZ connectivity, staging and external services must be costed. A cost reduction that changes Multi-AZ, connector redundancy or recovery coverage requires a revised architecture/acceptance baseline, not an undocumented substitution.

The current Workers Paid plan has a USD 5 minimum with usage pricing; Hyperdrive pooling/caching is included. Those vendor facts do not establish the INR totals above. See [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/). Use current [AWS RDS pricing](https://aws.amazon.com/rds/postgresql/pricing/) and region-specific EC2/network/service prices for the saved estimate. Exchange rate, tax, plan features and retention must be explicit.

Calculate AI spend from responses x input/output tokens plus embeddings and audio minutes. Calculate WhatsApp by actual billable category/recipient market, SMS/email by usage, and video by participant-minutes. Price gateway charges against processed value/payment method and shipping against weight/zone/COD. Keep tokens, private health text and financial records out of public analytics.

Set monthly budget alerts at 50/75/90%; review daily during launch. Track Worker CPU/requests, DB and connector utilization, connections, oldest due jobs, queue redelivery/DLQ, AI tokens/latency, message delivery and video minutes. Apply per-user AI abuse controls and bounded campaign throughput; do not silently suppress paid-order reconciliation or clinical escalation to remain under a budget.

## 14. Principal risks and accountable responses

| Risk | Priority | Prevention / required response | Accountable owner |
|---|---|---|---|
| Custom scope exceeds audited assets/60 person-days | Critical | Estimate remaining tasks D1; recheck D3/D6; keep all scope and revise forecast if the evidence fails. | E1 / delivery manager |
| Unsafe clinical output or missing mandatory safety context | Critical | Current approved records, full mandatory safety fetch independent of similarity, validated rendering, physician/language tests and human escalation. | E5 / physician owner |
| Double payment, renewal, stock allocation or physician slot | Critical | PostgreSQL constraints/short transactions, pending states, replay-safe provider integration and reconciliation. | E2 / E1 |
| Private path, certificate or beta-service failure | Critical | D0/D1 real-CA test, explicit beta acceptance, two independent connectors, credential rotation and failover evidence; no insecure fallback. | E6 / E1 |
| RDS failure, pool saturation or DNS reconnection fault | High | Multi-AZ endpoint hostname, bounded pools/concurrency, connector health, restore/failover and backoff tests. | E6 |
| Outbox/consumer failure or ambiguous provider outcome | High | Leases, expiry/reclaim, idempotency, partial-batch handling, DLQ/runbooks and provider reconciliation before replay. | E6 / domain owner |
| Patient/clinic access leakage or session misuse | Critical | Cognito MFA/session controls, backend role/assignment checks, pool-context tests and scrubbed diagnostics. | E1 |
| AI provider outage or resource/cost surge | High | Separate Companion budget, finite leases/tool loop/timeouts, direct non-AI purchase/booking, spend/rate alarms and approved handoff responses. | E5 / E6 |
| Index/extraction work degrades commerce | Medium | One bounded ingestion consumer, explicit DB timeouts, versioned publication, measured pgvector load and throttling. | E5 / E6 |
| Store/provider approvals or clinical translations arrive late | High | Day 0 eligibility/content, daily named reviews, complete tested D7 native submission; report pending approval as incomplete release. | E4 / clinic owners |
| Incorrect opening stock/tax/campaign data | High | Finance/warehouse validation, approved first campaign and full dress rehearsal before go-live. | E2 / E3 / clinic owners |
| Production support not staffed | High | Publish working hours, primary/backup rota, callback expectations and urgent-care escalation independent of routine callback hours. | Clinic operations / E6 |

## 15. Required handover package

Full-scope delivery is complete only when the company receives all of the following; the calendar target does not waive any item:

1. Publicly available web storefront, functioning clinic WhatsApp channel, and approved Android/iOS releases with the complete accepted customer scope.
2. Working staff/physician workspaces, opening catalogue and batch inventory, schedules, approved knowledge versions and three-language application resources.
3. Company-owned source repository, dependency/license register, pinned Worker/Lambda/native builds, Terraform, API/event contracts, schema/migrations and service-account inventory; production architecture and connection/concurrency budgets.
4. Evidence for all R01-R38 requirements; clinical/language, security, concurrency, load, restore and native-device test reports; recorded release decision and unresolved minor-defect register.
5. Finance, fulfillment, subscriptions, reminders and handoff procedures; dashboards/alerts; Cognito recovery, connector/TLS/credential rotation, RDS failover/restore, outbox/SQS/DLQ reconciliation and Worker/Lambda rollback runbooks; saved production cost estimate.
6. Recorded role-specific training, administrator recovery instructions, named primary/backup support contacts and ongoing security/content-maintenance responsibilities.

**Completion standard:** Every requested launch capability is implemented, verified, accessible on its required channel and operable by the company. Passing this standard is the condition for calling the system production ready; the calendar deadline alone is not.
