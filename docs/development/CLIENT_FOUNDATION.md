# P1-DEV-002 — Shared client and native foundation

Owner: Devadathan. Independent sensitive-change reviewer: Mathew. Assigned branch: `feature/p1-devadathan-web-native-sdk-proof`, created from fetched `origin/dev` (`a6fb539`) on 20 October 2026. PR #3/P1-DEV-001 remained open; this branch does not merge or copy its unreviewed changes. Integrate both packages through reviewed PRs to `dev`. Company requirements, team allocations and canonical phase tests are unchanged.

**Status: local client foundation implemented; cloud, provider, native-device and phase acceptance Pending.** Nothing authenticates a person, completes a payment, joins a private call, sends a message or registers a push token here. Existing unavailable backend responses remain unavailable.

## Baseline and additions

The baseline already had Astro/React, React/Vite and Expo applications, three basic language labels, a language selector and JavaScript export checks. This package adds shared session/navigation/return/notification contracts, reusable controls and request states, isolated native configuration, secure-storage and browser-return adapters, local media diagnostics, editable chat/voice draft shells and offline language fonts.

## Contracts and ownership

| Surface | Integration contract and boundary |
|---|---|
| Session | Proposed `GET /v1/session` returns only strict `userId`, UTC `expiresAt` and `workspaces` metadata. Mathew must review/implement the verified server session and grants. No endpoint implementation or WorkOS session is claimed. |
| HTTP states | 401 is anonymous, 403 denied, 503 unavailable; invalid payloads/HTML/network failures are errors. Requests use credentials, `no-store`, fixed paths, no redirects, aborts and a five-second UI timeout. No automatic mutation/retry exists. |
| Workspace navigation | `/customer`, `/staff`, `/physician`, `/support`. Server-issued grants filter navigation and direct-route presentation. API ownership/clinic/clinical authorization remains mandatory; hiding a view never authorizes data. |
| Session lifecycle | Refresh, expiry, backgrounding and page restoration invalidate private UI and drafts. Late responses are fenced and aborted. Nothing stores sessions/private API data in browser storage or a service worker. Remote hosting must also preserve private cache/security headers. |
| Browser return | One CSPRNG state per native attempt; exact URI/environment, bounded expiry, strict parameters and single-use validation. Results always require backend verification. Mathew must bind PKCE/state/code exchange; Josin must verify and reconcile payment state. A returned operation reference never means paid. |
| Notification link | Strict version/kind/UUID reference, no arbitrary URL. Native cold/warm links always require a session in this starter; authenticated integrations must then authorize the referenced record. No notification payload, token or record content is logged. |
| Storage | Expo SecureStore with device-only unlocked keychain accessibility, environment-specific auth keys and separate diagnostic keys. Serialized operations prevent a late queued credential write after clear. Native failures propagate; there is no plaintext fallback. Stored material never proves a valid current server session. |
| Companion and voice | Editable, bounded text draft; sending/transcription disabled. Citation envelope requires versioned entry references, but only the backend may establish current approval/physician provenance. No clinical copy, diagnosis or generated answer is invented. |

`packages/contracts/client` contains the proposed integration schemas. `packages/client` is framework-independent. `packages/ui` exposes `Button`, `Field`, `Notice`, `LanguageSelect`, `DeviceCheck`, `useSession`. Paul/Denzil should consume these rather than add session bypasses or duplicate permission logic.

The shared HTTP boundary permits credentialed browser reads only when `APP_ENV=local` and `Origin` exactly matches `http://localhost:4321`, `http://127.0.0.1:4321`, `http://localhost:5173` or `http://127.0.0.1:5173`. Both normal and preflight responses use the exact approved origin and `Access-Control-Allow-Credentials: true`, with `Vary: Origin` and `Cache-Control: no-store`. Other origins, missing configuration and nonlocal environments receive neither CORS grant; no wildcard or new method is enabled. This permits the client to read a real 503 as unavailable; it does not implement or authorize a session. Company web origins, verified sessions and production cookie/CSRF policy remain Mathew's reviewed integration work.

## Language and presentation

EN/ML/TA development labels have matching keys. INR formatting accepts integer paise only; dates explicitly use `Asia/Kolkata`. Noto Sans Malayalam/Tamil are bundled for browser and native use with retained licenses and hashes in [font provenance](../../packages/i18n/fonts/README.md). No font CDN request is needed. Medical content and final translations still require company/physician approval.

Browser checks cover language changes, loaded fonts, skip-link keyboard focus, field labels/help, 360-pixel layouts and safe text drafts. Native OS permission messages are draft English strings in build configuration; approved localized OS descriptions and device typography/accessibility review remain in the native acceptance register.

## Native configuration and local diagnostics

The installed native modules use exact versions matched to the pinned Expo 58 bundled-module map. These include SecureStore, WebBrowser, Linking/Crypto, Camera, Audio/FileSystem, Notifications, Font and Dev Client. Locked dependency verification is mandatory; native binary compatibility is separate evidence.

The 22 October review correction also refreshes the six patch pins required by Expo's current SDK 58 compatibility check: Expo 58.0.17, Audio 58.0.10, Camera 58.0.12, Constants 58.0.13, Linking 58.0.14 and Notifications 58.1.6. The previous pins failed `pnpm mobile:check`; the SDK major, React/React Native stack and other direct pins are retained. The updated config-plugin dependency uses upstream Xcode 4 without uuid; its obsolete uuid override is removed and security regressions now verify native cryptographic ID generation, collisions, entropy failure and project read/write. Validate the refreshed lockfile through plugin introspection, exports, dependency and compatibility gates; this does not establish device acceptance.

`app.config.ts` loads validated public configuration. Local builds use clearly synthetic `com.example.kandamkulathi.local` identifiers and the `kandamkulathi-local` scheme. Nonlocal profiles require explicit company bundle/application IDs, Expo owner/project ID and an HTTPS API origin. Public secret-like variables are rejected; backend secrets are never copied into `extra`. EAS profiles are prepared, not executed, signed or submitted. No EAS account/project or charge was created.

| Input | Where it belongs |
|---|---|
| `EXPO_PUBLIC_APP_ENV` | `local`, `dev`, `staging` or `production`; build configuration |
| `EXPO_PUBLIC_CORE_API_ORIGIN` | Approved origin only; loopback HTTP is allowed only in local mode |
| `MOBILE_IOS_BUNDLE_ID`, `MOBILE_ANDROID_APPLICATION_ID` | Company-approved distinct application identifiers per environment |
| `MOBILE_EXPO_OWNER`, `MOBILE_EAS_PROJECT_ID` | Company Expo ownership identifiers; not signing keys |
| Signing credentials, provider keys, database URLs | Approved restricted tooling/backend secret storage; never public mobile variables |

The final native config plugin restricts iOS ATS to explicit local loopback exceptions and disables broad arbitrary loads. Android cleartext is local-only; nonlocal profiles deny it. Android application backup is disabled, SecureStore exclusion rules remain installed, and background audio playback/recording is disabled. Actual Expo plugin introspection tests enforce these properties for local and company-development fixtures.

The local device screen asks permissions only after a button press. Camera preview and native microphone capture stop after 15 seconds and on backgrounding; recording bytes are discarded after stopping. Cancellation while permission/preparation is outstanding cannot start a recording later. Browser capture stops after 30 seconds, visibility change, navigation and unmount. No media upload method exists. A secure-storage diagnostic writes/removes only a synthetic marker in its separate key; it does not overwrite an auth credential. Notification testing requests permission only, without registering a device or sending a notification.

Loopback on a physical phone means that phone. Android local API access can use an explicitly configured ADB reverse mapping once a native development binary exists; iOS needs a reviewed reachable development endpoint/native build setup. Do not expose an unrestricted local API or use production records to bypass missing infrastructure.

## Actual local verification and limits

Run the existing gates: `pnpm verify`, `pnpm test:e2e`, `pnpm mobile:check`, `pnpm test:security`, `pnpm security:sast`, `pnpm security:check` and Python repository checks. The security pack now invokes the actual Expo config-plugin pipeline for both platforms; it does not compile native code. All existing CI contexts are retained.

Unit/browser cases cover HTTP state mapping, strict grants, expiry, invalid origin, callback forgery/replay/expiry, notification authorization handoff, storage ordering/failure/isolation, recording cancellation/cleanup, draft clearing, typography/layout and device-stream cleanup. A permanent unmocked Chromium test loads `/customer` from the workspace, calls the actual local Core Worker and checks that its 503 reaches `data-session-state=unavailable`, with the expected credentialed CORS headers and no CORS console error. The separate session/grant scenarios and media permission outcomes use synthetic fixtures; they do not establish completed WorkOS/clinical integration.

PR #4 review regression — 22 October 2026: [Mathew's review of ecc4375](https://github.com/kandamkulathi-project/kandamkulathi/pull/4#issuecomment-6321218666) was reproduced before fixing: the real browser test showed `error` instead of `unavailable`, and eight HTTP origin cases lacked the credentials header. [HTTP policy coverage](../../tests/integration/http.test.ts) now exercises every approved origin on both shared services, GET and preflight, plus wrong ports/hosts/schemes, opaque/null/wildcard origins, missing environment and nonlocal denial. [Browser coverage](../../tests/e2e/client-foundation.spec.ts) retains the mocked grant/status scenarios alongside the unmocked Worker regression. Both suites already run in application CI and the local commit gate. Mathew's independent review and Tinu's canonical phase campaign remain Pending on the fixed candidate; cloud/native/provider acceptance is unchanged.

An attempted Chromium fake-hardware acquisition on this machine returned `NotSupportedError`. The automated camera UI case injects a genuine browser `MediaStream` from canvas capture and verifies track termination. Permission denial is deterministic. These are UI/lifecycle tests, not physical capture proof. Android SDK was absent at the conventional local path and Java was unavailable; this Windows host cannot compile iOS. Native installation, actual OS permissions, video, checkout and account-return proofs remain Pending, with procedures in the [readiness register](../operations/NATIVE_READINESS.md).

## Bounded team handoff

| Owner/package | Existing assignment supported by this foundation |
|---|---|
| Paul / P1-PAU-001–004 | Catalogue/product, cart/address/order/account and directory/booking presentation; native view assembly. Use shared labels/states and only approved fixtures until real APIs are available. |
| Denzil / P1-DEN-001–004 | Catalogue validation, locale/content editor presentation, read-only staff views, store inputs/guides. No privilege or clinical policy decisions move to junior UI code. |
| Mathew / P1-MAT-001 and related packages | Review proposed session/callback/notification contracts; implement WorkOS verification and actual scoped APIs. Independently review this sensitive client foundation. |
| Josin / P1-JOS-003 and related packages | Review payment-return reference and definitive server reconciliation; provide checkout/provider adapter contract. |
| Tinu | Run canonical P1 campaign after integration. Synthetic automated coverage does not close any canonical case requiring real devices/providers. |

P1-DEV-003 sensitive journeys and P1-DEV-004 cross-client quality remain separate assigned packages. P1-DEV-002 acceptance remains open until real Android/iOS authentication/payment return, authenticated private web/native video, voice/push/deep links and company/store prerequisites have their required evidence.
