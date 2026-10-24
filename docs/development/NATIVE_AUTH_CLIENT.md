# Native authentication and privacy bootstrap

This client uses the actual native PKCE/start/exchange, consent bootstrap and logout
routes. `NativeSensitiveFlows` mounts auth controls outside its uniquely keyed
private-session subtree. Ordinary private revalidation cannot destroy an expected
system-browser return or a pending logout identity. No `App.tsx` replacement is
required: it already mounts `NativeSensitiveFlows`.

The controller retains a newly exchanged `n1_` credential only in volatile memory
while privacy is required. It displays exact server-approved policy text, revision,
version and approval reference; the text is neither translated nor invented. Only
an explicit checkbox and confirmation submit consent. Cancel submits no decision
and attempts native revocation. A successful POST is followed by a real full-session
read; only a current verified session permits the shared serialized OS vault write.
An uncertain POST is reconciled by an explicit session/policy read, not repeated
automatically. Bootstrap denial never manufactures a workspace or session.

The runtime shares ONE vault instance between sign-in and private-session controls.
Logout queues its bearer read before sign-in disposal or vault clearing, fences
private actions immediately, and uses `/v1/native-auth/logout` with the same handle
and idempotency key on retry. A 503 or unverified response remains visibly uncertain;
it is not `{revoked:true}`. Browser cookie logout is not used. Pending remote logout
identity is memory-only; process death does not prove provider reconciliation.
Backgrounding outside an expected browser handoff cancels pending policy/auth and
fences late results. Browser return waits for actual foreground before exchange.
There is no refresh contract: an expired session requires sign-in again.
Expired policy-session cleanup uses a narrowly bound expired-handle logout route
and additive migration `0027_native_expired_logout`; it cannot extend expiry or
authorize business access. Provider uncertainty still requires same-key reconciliation.

## Configuration prerequisites

- A supported Expo native development/standalone build with the configured app
  scheme and secure storage/system-browser modules. Expo Go is not device proof.
- The app's existing `EXPO_PUBLIC_APP_ENV` and `EXPO_PUBLIC_CORE_API_ORIGIN` must
  match the server environment. Physical phones need an approved reachable HTTPS
  origin; their `127.0.0.1` is not the developer computer.
- The server owner provisions actual WorkOS resources and approval gates,
  `NATIVE_AUTH_ALLOWED_REDIRECTS`, `NATIVE_AUTH_API_ORIGIN`,
  `NATIVE_AUTH_ENCRYPTION_KEY` and the required WorkOS settings. Never put private
  keys in `EXPO_PUBLIC_*` variables. The canonical native provider constructs
  `https://api.workos.com/user_management/authorize`; the client pins that origin.
- Company/provider allowlists must approve the exact environment callback, e.g.
  `kandamkulathi-local://auth/return`. The repository scheme is not allowlist proof.
- Apply the integrated database migrations and provision the exact currently
  approved privacy text/version/hash/approval through the controlled policy owner.
  Missing or mismatched policy legitimately returns 503; do not seed legal text.

## Manual verification

Use deterministic synthetic accounts/data, never production patients or charges.

1. With no saved credential, open the app and choose **Sign in securely**. Complete
   the real approved system-browser login. Cancelling must leave private views
   hidden; a stale/wrong callback must not unlock them.
2. For an eligible account missing current privacy consent, inspect the exact
   server policy and its revision/version/approval reference. **Give consent and
   continue** stays disabled until the explicit checkbox is selected. Cancel must
   not record consent, save a credential or show private content.
3. Grant consent. Confirm the network sequence is native exchange, denied full
   session, bootstrap, explicit consent POST, successful full-session GET, then
   private views. No credential belongs in logs, analytics or UI. Relaunching may
   restore only the verified OS credential and must reread current authority.
4. Simulate a committed consent POST whose response is lost. No automatic second
   POST or fake success should appear. Use **Reload session and policy** to recover
   through actual current session authority.
5. Background during policy review, wait for expiry, or revoke/disable the account.
   Return to the app: private/policy state must not be restored from stale results.
   An expected browser handoff may return normally, but persistence waits for the
   foreground. Missing policy/storage/provider configuration must remain an error
   or unavailable state, not a successful session.
6. Sign out from a verified session. Private content disappears immediately and
   the OS credential is removed. Verify native logout, not browser logout. With a
   server 503, the uncertainty notice remains; retry must use the same native
   handle/key and must not authenticate business operations with that handle.
7. Repeat with EN/ML/TA. Operational controls use existing shared resources; exact
   approved policy text remains unchanged. Verify screen-reader labels, the consent
   switch, announcements, font scaling and keyboard/scroll behavior on Android/iOS.

No device, provider, signing, company language/policy or phase acceptance is implied
by source checks or the synthetic development smoke run. Coordinator-owned full
verification, independent sensitive review and any authorized merge remain required.
