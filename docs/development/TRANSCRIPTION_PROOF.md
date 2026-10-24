# Bounded Phase 1 transcription proof — integration handoff

P1-MAT-004 / P1-E5-003 requires transcription into reviewable text, not just a microphone permission probe. The completion working tree mounts this technical path in Core and native Companion. **Final integrated verification/review, approved company processing policy, real OpenAI interaction and Android/iOS supported-device verification remain Pending.** This is not Phase 2 live voice, clinical intake, medical advice or an automatic Companion action.

## Integrated mounting contract

In `apps/core-api/src/runtime.ts`, import `registerTranscriptionRoutes` from `./transcription` and `createTranscriptionProvider` from `../../../packages/providers/src/transcription`. Inside the existing `createConfiguredCoreApi` route registration callback:

```ts
registerTranscriptionRoutes(app, configuredIdentity, createTranscriptionProvider(bindings));
```

Do not instantiate a second identity runtime, substitute a detached authority loader, or move provider work into the database transaction. This route uses the same event-bound native verification, mutation check and `withSessionInTransaction` guard as the parent. Both before upload and before returning text it runs canonical `validateCurrentIdentity`, including current privacy consent. It accepts only native `n1_` bearer sessions, not cookies or browser Origin requests. The existing global 64 KiB body cap must remain unchanged.

All imports are direct owned source imports; no new dependency, manifest, export or lockfile change is needed. The subsequent [admission delta](TRANSCRIPTION_ADMISSION_PROOF.md) adds migration `0030_transcription_admission.sql`, an owner-approved per-actor capability and metadata-only admission ledger. The coordinator owns its journal entry. Missing admission configuration denies provider dispatch. If the coordinator wants package exports, add them separately; the patch does not require them.

### Native delta to apply in `NativeCompanion.tsx` / native credential owner

Preserve the existing manual draft and Send controls, existing `capture.ts`, and `LocalAudioCheck`. The new adapter is separate:

1. Behind a default-off native feature/rollback flag, create `useAudioRecorder(transcriptionRecordingOptions)` and wrap it with `expoTranscriptionCapture(recorder)`. Both exports are in `apps/mobile/src/transcriptionCapture.ts`; SDK APIs/types are already installed.
2. Create one `nativeTranscription` controller (`apps/mobile/src/transcription.ts`) per verified session. The credential owner supplies a **current native bearer closure**, never OpenAI credentials. Supply the existing approved Core origin and `local` origin validation. `current()` must require a mounted component, the same current verified, unexpired session and foreground `AppState`.
3. Mount separate Record, Stop, and **Upload clip for transcription** controls. `start()` records locally, `stop()` prepares the clip; neither uploads. Permission denial/encoding failure stays visible. Only an actual Upload press, after showing company-approved processing notice text and version, calls `transcribe(acceptedPolicyVersion)`. Do not fabricate approval text or silently acknowledge the notice. Unsupported/absent approved configuration must leave manual typing available and transcription unavailable.
4. Map `changed()` states explicitly: idle, requesting permission/preparation, recording, clip ready, loading, denied, invalid/oversize, not-configured, rate-limited, empty, unknown and review. Unknown means completion is uncertain: no automatic retry. A new attempt requires a newly captured clip and another explicit upload action. A failed cleanup remains a cleanup obligation and is retried before recording again.
5. `review(text)` only replaces the existing editable draft via `setDraft(text)` and clears stale entries/reply. Display that transcription may be incorrect and requires review. **Never call `operations.send`, save clinical intake, or invoke an action from this callback.** Send remains a separate deliberate existing action after editing.
6. On draft edit, background, logout, session replacement and unmount, call `invalidate()` and use the existing private-data fence to clear the draft and answers as appropriate. Invalidation aborts in-flight transport and rejects late text; it does not itself own the root draft. Disable conflicting controls while recording/loading. No transcript/audio persistence or analytics.
7. Reuse existing locale resources/patterns for the labels; add reviewed EN/ML/TA operational strings in the coordinator-owned locale integration. There is no new visual language or medical copy. Rollback hides these controls and invalidates the controller; it must not break manual input.

## Operator setup — fail closed, no policy invented

Native controls default off. For a nonproduction build only, set
`MOBILE_TRANSCRIPTION_PROOF_APPROVED=true` and
`MOBILE_TRANSCRIPTION_PROCESSING_POLICY` to the approved JSON
`{version, notices: {en, ml, ta}}`. These public notices are intentionally bundled;
provider secrets are not. All three notices and the exact server policy version
are required. A build flag does not constitute company approval. Server admission
also requires the controlled, unseeded capability described in
[transcription admission](TRANSCRIPTION_ADMISSION_PROOF.md).

Only an authorized operator may set trusted server bindings:

- `OPENAI_API_KEY`: approved server secret; never `EXPO_PUBLIC_*`, Git, logs, browser/native bundles or a client-supplied endpoint.
- `TRANSCRIPTION_CONFIGURATION_APPROVED=true`: after approving the exact endpoint/model, isolated usage budget/quota, environment and provider access.
- `TRANSCRIPTION_PROCESSING_APPROVED=true`: only after named privacy/processor approval covers the actual audio processing, region, provider retention and permitted test data. This code does not invent those terms or claim provider zero retention.
- `TRANSCRIPTION_PROCESSING_POLICY_VERSION`: exact approved version displayed in the native notice and acknowledged in the actual upload action. Stale/mismatched versions are denied. The operator/coordinator must supply the approved notice and approval evidence; no sample legal or medical policy is supplied here.

Missing configuration gives 503; missing consent/current native session denies access. Provision the exact owner-approved capability/quota/validity values described in the [admission delta](TRANSCRIPTION_ADMISSION_PROOF.md); none are seeded or inferred from server ceilings. This implementation stores neither audio nor text in R2/database/outbox and logs no payload. The admission delta retains only bounded operation/actor/policy/timing metadata and never refunds unknown usage. Provider-side processing/retention remains subject to actual company approval, not a technical assertion.

The exact provider URL is `https://api.openai.com/v1/audio/transcriptions`; model is `gpt-transcribe`, with no translation, prompts, medical enrichment or chained LLM. Source: [OpenAI file transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text), checked 2026-10-24. The guide currently recommends `gpt-transcribe` and marks older Whisper/GPT-4o transcription models deprecated. Redirects are errors. There are no automatic provider retries. 429 is explicit; timeout, network/invalid/oversize response and other provider failures remain unknown.

## Bounds and evidence

- Native target: mono AAC in `.m4a`, 16 kHz / 16 kbps, automatic stop at 14.5 seconds; server maximum 15 seconds and 48,000 encoded bytes. Device encoders may ignore bitrate settings: oversize/nonconforming files fail closed, not a larger global limit.
- Native File API rejects oversize before reading; both native/server validate a narrow audio-only ISO-BMFF container, one audio track, AAC sample entry, media duration and sample timing agreement. This is container validation, **not a full AAC decoder or a guarantee of truthful malicious bitstreams**. Provider invalid-audio errors do not establish success. Codec/device compatibility remains a manual gate.
- Base64 is at most 64,000 characters; bounded envelope fits the existing 65,536-byte Core cap. Encoded duration comes from source metadata/sample timing, not a client duration field.
- Provider timeout 20 seconds; streaming response read capped at 24,000 bytes; final text at most 4,000 characters. Native total transport timeout is 25 seconds. React Native fetch lacks consistently available streams, so the native adapter validates the bounded server DTO after `text()` plus any supplied Content-Length; the trusted server enforces the streaming cap.
- Local FFmpeg synthetic tone feasibility check: 14.5-second mono AAC at 16 kbps produced **31,209 bytes**, parsed source duration **14,564 ms**. This proves only local container/size feasibility, not speech accuracy, native SDK output, provider access or clinical safety. The generated binary is outside Git.

Focused verification (Node executable entry points used because `pnpm` was not on this worker PATH):

```sh
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p apps/core-api/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p apps/mobile/tsconfig.json
node node_modules/vitest/vitest.mjs run tests/unit/transcription.test.ts tests/integration/transcription-http.test.ts
node node_modules/@playwright/test/cli.js test --config tests/e2e/transcription.config.ts
```

Synthetic tests cover source/config bounds, exact HTTP provider request, review/empty/429/unknown/response cap/abort timeout, explicit action, late-result fencing, cookie/Origin/invalid/stale-policy denial, current consent and revocation recheck, unchanged global 413, and actual loopback HTTP capture-to-editable-draft with no Companion send. They are not PostgreSQL/RLS, actual provider, visual UI, installed-device or acceptance evidence. Full `pnpm verify`, `pnpm test:e2e`, security and native build gates are coordinator-owned/unrun by this focused worker; do not infer they passed.

## User-owned manual proof (Pending)

After coordinator mounting and independent security review, configure an approved isolated server credential/policy. On supported Android and iOS, use only approved synthetic speech in EN/ML/TA; confirm permissions denied/granted, short and 14.5-second recording, actual bytes/format within bounds, explicit upload notice/action, real provider transcript, editable corrections and separate Send. Exercise background/logout while recording/processing, deletion, stale policy/consent, provider unavailable/429 and rollback to manual typing. Record only redacted outcome/size/duration and provider request identifiers in approved evidence storage, not raw audio or transcript in logs/Git. No G1/provider/device acceptance is claimed by this patch.
