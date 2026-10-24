# P1-O06 private video SDK technical proof

This is an opt-in, synthetic two-person WebRTC/TURN compatibility harness, **not P2 clinical
video, clinical eligibility, a booked consultation or G1 acceptance**. Missing configuration is
unavailable. No production route, auth/vault/i18n flow or clinical grant is replaced.
The completion working tree mounts separate opt-in development diagnostic controls;
see the [actual root/configuration handoff](P1_VIDEO_PROOF_MOUNT.md).

## Dependency/config request to integration owner

Add exact mobile dependencies `react-native-webrtc: 155.0.1` and
`@config-plugins/react-native-webrtc: 15.0.2`, then regenerate the pnpm lockfile through the
normal security pipeline. Add `./plugins/withPrivateVideoProof.cjs` **last** in the mobile
plugin list. This wraps the official plugin but blocks its overlay/legacy Bluetooth additions;
no background audio, recording, notification or public environment flag is introduced.
Add client package exports `./private-video: ./src/private-video.ts` and
`./private-video-http: ./src/private-video-http.ts`. No other dependency/export changes.
Keep the focused Vitest command below as a separate verification invocation: its native
resolution doubles are intentionally scoped to this harness, not global test aliases.

Official sources checked 2026-10-24:

- [SDK package](https://registry.npmjs.org/react-native-webrtc/latest): 155.0.1,
  RN peer `>=0.60.0`; [official guide](https://github.com/react-native-webrtc/react-native-webrtc)
  explicitly supports Expo development builds, not Expo Go.
- [Published plugin](https://registry.npmjs.org/@config-plugins/react-native-webrtc/latest):
  15.0.2, Expo peer `>=56`. GitHub main is an unpublished 15.0.3, **not requested**.
- [Official compatibility table](https://github.com/expo/config-plugins/tree/main/packages/react-native-webrtc)
  still names Expo 56/SDK 124.0.7; it does **not** independently certify Expo 58/RN 0.88/SDK 155.
  Exact installed SDK declaration typecheck and official plugin introspection passed against
  repository Expo 58.0.19/RN 0.88.0. Signed compilation/runtime compatibility is Pending;
  do not describe broad peer ranges as actual-device certification.

## Mount contract (integration owner; no automatic joins)

- Technical native surface: create `nativePrivateVideo` once per mounted owner, supplying
  explicit synthetic `participantId`, `AuthorizedVideoSignaling`, state and local/remote stream
  callbacks. Only an explicit Join action calls `connect(opaqueGrant, abortSignal)`.
  Render streams using the actual SDK `RTCView` with `streamURL={stream.toURL()}`;
  local view must be muted. Lazy-load that renderer only for supported development builds.
  `connected` comes only from the real peer connection event, never permission/SDP success.
  Leave/logout/unmount calls `dispose`; background/inactive stops and cannot auto-rejoin.
- Browser surface: create `browserPrivateVideo` with existing local/remote video elements,
  the same explicit authority and participant ID; call `connect` only on Join and `dispose`
  on leave/unmount/logout. Hidden/pagehide stops. A fresh mounted owner plus fresh grant is
  necessary after background; no automatic reconnect or room reuse.
- Existing clinical `consultationAccess` can receive this `connect` callback **only when its
  real reviewed clinical grant/signaling authority exists**. Do not wire the synthetic server
  into `SensitiveFlows`, invent a clinical grant, or replace truthful transport-pending state.
- When configuration/grant/SDK is absent, expose unavailable. Keep configuring this proof
  separate from customer booking/payment/auth controls. Do not write tickets/SDP/TURN secrets
  into storage, URLs, source, analytics, console or crash reports.

## Standalone synthetic Durable Object signaling

`apps/core-api/wrangler.video-proof.jsonc` is a separate Worker entry. It is intentionally
unrouted with logs off. **Do not mount its handler in the clinical Core router.** No deployment
is authorized by this patch. Operator provisioning/review is required before actual use.

Provision a secret `P1_VIDEO_PROOF_CONFIG` with this shape (values below describe fields,
not valid credentials):

```ts
{
  syntheticOnly: true,
  allowedOrigin: "https://approved-synthetic-web-origin",
  members: [
    { ticket: randomBase64url32BytesA, membership: {
      appointmentId: syntheticUuid, revision: "synthetic-v1",
      participantId: "synthetic-a", peerId: "synthetic-b",
      connectionId: independentlyRandomBase64url32Bytes,
      notBefore: currentEpochMs, expiresAt: currentEpochMsPlusAtMostFiveMinutes,
      role: "offerer", relays: [{ urls: [approvedTurnUrl], username: ephemeralUser, credential: ephemeralSecret }]
    } },
    { ticket: independentRandomBase64url32BytesB, membership: {
      /* identical appointment/revision/connection/window/TURN; swapped peer IDs; role: answerer */
    } }
  ]
}
```

Use cryptographically random independent keys and connection ID, not fixture constants.
The operator explicitly authorizes these two synthetic participants; this is not clinical
identity/consent/assignment authority. Distribute each opaque grant privately out of band:
`{appointmentId, revision, expiresAt: ISODate, ticket}`. Keep TURN lifetime no longer than
the proof window. Each client uses
`technicalVideoSignaling("https://approved-signal-origin/p1-private-video-proof")`.
Native diagnostic mounting must explicitly supply Expo SDK 58's existing streaming fetch:
`import { fetch as expoFetch } from "expo/fetch";` then
`technicalVideoSignaling(endpoint, expoFetch)`. The [official SDK 58 Expo API](https://docs.expo.dev/versions/v58.0.0/sdk/expo/#expofetch-api)
documents Android/iOS streaming responses; installed Expo 58.0.19 provides this entry.
There is no new dependency and no `EXPO_PUBLIC_` transport flag. A fetch implementation without
`response.body.getReader()` is unavailable, even if Content-Length claims a small response;
the adapter never falls back to unbounded `text()`. Response limits count streamed UTF-8 bytes
(70,000), independent of Content-Length. Device/runtime verification remains Pending.
The proof accepts no actor/participant/room selector from requests. Authorization is a header,
body bounds are 70KB, SDP bounds 64KB, relay-only, exactly one role-correct SDP per member,
one join per ticket, no automatic retry. A total request ceiling bounds polling.
Leave terminates both peers; 1s status polling detects revocation/unavailability. A 5s
authority-request deadline also stops media on a stalled heartbeat. Expiry is enforced
server/client even if network is lost. DO eviction/restart deliberately yields 503;
rotate the whole pair/config/connection ID rather than replaying or silently restoring a call.
Public origin/method/ticket/full-config/window checks precede DO dispatch; OPTIONS is handled
without touching a DO. An unused DO may restart: the irreversible marker is written only after
a valid first join body, before publishing membership, under the DO input gate. Once a join
is accepted, any restart remains fail-closed. Invalid traffic must not consume an unused pair.

## Focused verification

```sh
pnpm exec vitest run --config tests/video-proof/vitest.config.ts
pnpm exec tsc --noEmit -p tests/video-proof/tsconfig.json
node --test tests/video-proof/native-config.test.mjs
pnpm exec playwright test --config tests/video-proof/playwright.config.ts
pnpm --filter @kandamkulathi/core-api exec wrangler deploy --dry-run --config wrangler.video-proof.jsonc
```

Tests explicitly distinguish mocked SDK/SDP from device proof. Chromium uses real browser
synthetic-capture tracks but a deterministic peer double; it cannot prove TURN/media delivery.
The SDK-port tests cover membership/window/expiry/relay rejection before capture, duplicate
setup, late permission completion, revocation, deadline, permission denial and cleanup;
native cases cover the actual SDK API mapping, Expo Go/web denial and background during lazy
setup. The DO test double proves fail-closed restart logic, not actual cloud persistence.

Observed focused results: 24 Vitest cases, 2 Chromium cases, 1 installed-plugin/native-config
case, strict focused TypeScript check, Biome, Worker dry-build and repository/document checks
passed. Isolated new-dependency npm audit reported zero findings (not a full application audit).
The environment had no `pnpm` executable; these checks used the installed equivalent binaries.
Full `pnpm verify`, full `pnpm test:e2e`, signed native builds, actual cloud DO behavior and
physical-device/TURN tests were not run in this bounded subagent task.

The bounded security-fix follow-up adds unused-room/restart, pre-dispatch denial, atomic first
join, failed persistence, streamed-byte overflow/cancellation and no-stream denial regressions.
Its focused run passed 34 tests (including actual loopback chunked HTTP), scoped TypeScript
against installed Expo fetch, changed-file Biome and Worker dry-build. These are synthetic
software checks, not cloud/device/TURN or clinical acceptance.

## User-owned manual device proof / remaining boundaries

1. Review/install exact dependencies and plugin delta; build signed Android and iPhone
   development clients. Record Expo/RN/SDK/plugin, OS/device and build identifiers. Expo Go,
   JS export and successful introspection are not native binary proof.
2. Provision the isolated approved HTTPS Worker/DO and short-lived real TURN credentials;
   mount the technical surfaces above. Explicitly join synthetic web ↔ Android, then web ↔
   iPhone (optionally Android ↔ iPhone). Show bidirectional camera/audio; inspect selected
   candidate pair in local developer diagnostics to confirm **relay** without retaining SDP/IPs.
3. Deny camera, microphone, wrong key/participant, expired/reused grant and wrong origin.
   Check no remote media/false connected state. Leave/revoke/expire/background/unmount during
   permission/setup and active media; check indicators, tracks and peers stop. Resume must
   not autojoin. Reconnect is deliberately an explicit fresh pair, not P2 seamless recovery.
4. Repeat Wi-Fi ↔ mobile data/TURN TCP and denied UDP; failures must terminate safely and
   report unavailable. Destroy synthetic config/keys after the session.

Exports, dependency/lock/plugin configuration and explicit diagnostic surfaces are
integrated in the completion working tree; final combined checks remain pending. Clinical identity,
consent/assignment policy, production grant issuer, clinical signaling authorization and
automatic recovery remain intentionally unimplemented P2 work. Independent security review,
approved provider setup, native compilation/device evidence and G1 remain Pending.
