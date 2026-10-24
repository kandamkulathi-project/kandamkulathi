# P1 video technical proof — mounted controls

This completes the mounting work left open in [the adapter handoff](P1_VIDEO_SDK_PROOF.md).
The completion working tree integrates the original SDK patch, security corrections and
replacement streaming mount. It adds actual workspace/native diagnostic controls and
a server-side synthetic invitation provisioner. No clinical consultation grant, appointment
policy, identity or consent is invented. Existing clinical `transportPending` stays unchanged.

## Actual mounts and development gates

- `WorkspaceApp.tsx` mounts `WebVideoProof` only when Vite `DEV` is true **and**
  `VITE_P1_VIDEO_PROOF_ENABLED=1`. Set
  `VITE_P1_VIDEO_PROOF_ENDPOINT=https://APPROVED-SIGNAL-HOST/p1-private-video-proof`.
  The endpoint must be HTTPS without credentials, query or fragment. Production builds do
  not mount these controls. The diagnostic is keyed by the existing session epoch; other
  root/session/customer/checkout/locale keys are unchanged.
- `App.tsx` mounts the independent `SyntheticDiagnostics` host, not clinical
  `SensitiveFlows`. Native video requires `__DEV__`, `extra.environment` local/dev, and
  `extra.p1VideoProof.enabled === true`. The integrated configuration below supplies it.
  **No ticket, invitation or TURN credential may enter public environment/config.**
  The native SDK/RTCView loads only after explicit Join; Expo Go/web are unavailable.
  Real local/remote streams render with actual SDK `RTCView`. Signaling explicitly uses the
  existing `nativeStreamingSignaling` helper (`expo/fetch`), not RN global fetch: the security
  delta requires a readable response stream and a 70KB byte cap, with no unsafe text fallback.
- The operator-only copy is explicitly English, synthetic and not clinical authority. Native
  retains the current font. Existing customer locales, auth controls/vault, commerce,
  checkout and identity keys are not rewritten. Unmount, background, expiry, denied/stalled
  authority and manual Stop clear private media. No passive resume or
  duplicate Join imports/captures. Pending renderer import is deadline/abort fenced too.

Commit `c396c41` includes the installation/integration plumbing: exact pins
`react-native-webrtc@155.0.1` and `@config-plugins/react-native-webrtc@15.0.2`,
official plugin wrapper registration, client exports, lockfile and the config wiring below.
The actual workspace/native mounts and controls are implemented, not deferred. Shared helpers
use existing repository source-relative imports and need no additional package export/dependency.

### Integrated config/policy parser

`apps/mobile/config.mjs` already registers `./plugins/withPrivateVideoProof.cjs`, imports
`parseVideoProofConfig` and merges its result alongside the transcription notices/approval
settings. The existing wiring is shown below; do not apply it a second time:

```js
import { parseVideoProofConfig } from "./videoProofConfig.mjs";
// Inside existing extra, alongside—not instead of—transcription settings:
...parseVideoProofConfig(env, environment),
```

Enable with `MOBILE_VIDEO_PROOF_APPROVED=true` and
`MOBILE_VIDEO_PROOF_ENDPOINT=https://APPROVED-SIGNAL-HOST/p1-private-video-proof`.
These are build inputs, **not new `EXPO_PUBLIC_*` variables**, so the strict public-variable
allowlist need not change. The helper returns only `p1VideoProof` with a validated nonsecret
HTTPS endpoint. It refuses staging/production and malformed flags. It does not parse or touch
transcription notices. The included `apps/mobile/src/privateVideoSignaling.ts` helper supplies
the native streaming signaling adapter. The independent native proof uses its synthetic server ticket,
not customer WorkOS authority; business logout does not revoke that separate ticket. Select
Stop to terminate the synthetic room; background/expiry/room revocation also terminate it.

## Server-issued private synthetic invitations (no hardcoded sessions)

Use a private approved HTTPS browser development origin/tunnel and the separately reviewed,
isolated proof Worker/DO endpoint from `wrangler.video-proof.jsonc`. Do not mount that Worker
in Core's clinical router or deploy it to an unrestricted production route. Provider resource
changes below are **manual operator actions**, not performed by this patch.

1. Obtain real short-lived TURN credentials from the approved provider. Place a JSON array
   in a private file **outside Git**, with exactly the relay values needed by the original
   adapter: `[{"urls":["turns:APPROVED-HOST:443?transport=tcp"],"username":"EPHEMERAL",
   "credential":"EPHEMERAL"}]`. These placeholders are not working credentials.
2. Run this server-side provisioner with Node 24 in a private POSIX/Linux operator environment
   (Windows ACL provisioning is not implemented). The output directory must not already exist
   and must be outside the repository, including after resolving parent symlinks:

   ```sh
   node scripts/video-proof/issue.mjs /tmp/opencode/private-p1-video-run \
     https://APPROVED-SIGNAL-HOST/p1-private-video-proof \
     https://APPROVED-WEB-DEV-ORIGIN /tmp/opencode/private-approved-turn.json
   ```

   It generates independent 256-bit opaque member keys and connection nonce, UUIDs,
   role/peer bindings and a five-minute window. Output directory mode is 0700; files are
   exclusively created 0600. It prints the directory path only, never credentials.
   Files: `server-config.json`, `invitation-a.json`, `invitation-b.json`.
3. With authorization for the isolated company proof Worker, install `server-config.json`
   as the **secret** `P1_VIDEO_PROOF_CONFIG` using the proof Wrangler config. Do not print,
   commit or copy it into Expo/Vite configuration. Example manual invocation:

   ```sh
   pnpm --filter @kandamkulathi/core-api exec wrangler secret put P1_VIDEO_PROOF_CONFIG \
     --config wrangler.video-proof.jsonc < /tmp/opencode/private-p1-video-run/server-config.json
   ```

   Provisioning/installing must finish within the five-minute window. If it does not, issue
   a completely fresh pair/config/connection ID. Do not edit/extend an issued invitation.
4. Privately deliver only invitation A to one synthetic participant/device and B to the
   other. Open the app diagnostic, paste its one-line JSON in the masked private input and
   select **Load private invitation**. It clears immediately from the input, displays bound
   synthetic peer/expiry metadata, and does not acquire camera/microphone yet.
5. Select **Join synthetic video proof** on each device. The real server checks its opaque
   member key; client pins must match the server's exact response before media capture.
   Browser video elements and native RTCView display actual supplied streams. `connected`
   is emitted only by actual peer connection state, never local preview/SDP success.
6. Verify camera/audio in both directions, relay candidate selection, denial, expiry,
   background, revoke/leave, permission interruptions and explicit fresh-invitation retry on
   signed Android/iPhone builds. Destroy private files/config after use under the operator's
   approved secret procedure. Real devices/TURN/provider proof remains user-owned Pending.

Invitation schema, generated by the server-side tool (no TURN credentials):

```ts
{
  purpose: "p1-synthetic-video",
  endpoint: "https://APPROVED-SIGNAL-HOST/p1-private-video-proof",
  grant: { appointmentId: syntheticUuid, revision: "p1-synthetic-v1",
    expiresAt: ISODate, ticket: serverGenerated256BitOpaqueKey },
  member: { participantId: syntheticUuidA, peerId: syntheticUuidB,
    connectionId: serverGenerated256BitNonce,
    notBefore: epochMilliseconds, expiresAt: epochMilliseconds,
    role: "offerer" /* B is answerer, swapped peer IDs */ }
}
```

## Authority / threat boundaries

- This is stateful bearer authorization, **not a self-signed client JSON grant**. The DO
  chooses membership from the secret operator-installed server config by opaque ticket.
  Request actor/peer/room claims do not authorize anyone. Client invitation fields are only
  immutable expectations; editing them cannot change server membership and causes denial.
  Independent random keys/nonces come from Node's cryptographic generator, not app fixtures.
- Exact appointment/revision/member/peer/connection/role/window pins are checked before
  capture. Wrong endpoint invitations are rejected before sending any ticket. Unknown fields
  and patient names are not part of the strict schema. No persistent app storage, URL token,
  health data, analytics or credential logging is introduced.
- The original server consumes one join per key, scopes SDP to the two configured members,
  caps request/SDP size and total requests, enforces current window on every action, and
  stops on leave. Client status polling plus request deadlines and hard expiry fail closed.
  DO's persisted one-start marker denies reuse following eviction/restart; rotating a whole
  proof pair is the only recovery. No automatic reconnect or clinical-policy decisions.
- A stolen invitation is a stolen short-lived synthetic member credential. Deliver privately,
  keep tester access/private routes restricted, never record the masked field/clipboard, and
  revoke by ending the room or expiring/removing its config. This harness is not clinical
  authentication/consent, a production video service or G1 approval.

## Focused verification

```sh
pnpm exec vitest run --config tests/video-proof-mount/vitest.config.ts
pnpm exec tsc --noEmit -p tests/video-proof-mount/tsconfig.json
pnpm exec tsc --noEmit -p tests/video-proof-mount/native.tsconfig.json
node --test tests/video-proof-mount/config.test.mjs
pnpm exec playwright test --config tests/video-proof-mount/playwright.config.ts
```

The browser cases render the **actual WorkspaceApp mount** with deterministic signaling/peer
doubles and Chromium synthetic capture, assert authorization-before-capture, input clearing,
no false connected state and real track shutdown. Native/common control cases exercise lazy
renderer abort/timeout and duplicate attempts, immutable pins and expired/wrong invitations;
configuration/provisioner checks prove development gates and private file modes. Actual SDK
types are checked; mocked controls and JSX/browser verification are not signed-device proof.

Observed after applying the supplied security delta locally: 10 control/invitation unit cases,
2 actual-root Chromium cases and 3 configuration/issuer cases passed. Both scoped TypeScript
checks passed, including the actual mobile `expo/fetch` helper; Biome and repository/document
checks passed. Earlier desktop/mobile-width screenshots were inspected; the visual controls
are unchanged. These are historical scoped results; commit `c396c41` includes the shared
helpers, security corrections, configuration and actual-root controls. No separate patch
delivery or mounting step remains. Its mandatory combined gate and subsequent clean committed
`verify:p1-local` passed. PR #12 review findings are being corrected separately; those earlier
passes do not establish that the corrections have passed or been pushed. Signed binaries,
actual provider/cloud DO and device/TURN media verification remain Pending. No deployment,
clinical grant or G1 acceptance is established by these software checks.
