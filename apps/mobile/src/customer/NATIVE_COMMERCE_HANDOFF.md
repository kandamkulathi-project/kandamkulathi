# Native commerce forms handoff

These new files implement native cart quantities/removal, Indian delivery fields, current server quote, separate explicit total confirmation, reservation and payment intent initiation/read/reconcile. They do not mount themselves, authorize requests, calculate tax/prices, capture money or replace provider/device acceptance. Labels are explicitly draft English; incumbent palette, system/bundled fonts and locale money formatting are retained.

## Parent-owned composition

Use `createAuthoritativeCommerceApi` with `commercePresentationSchemas`, not a proposed aggregate API. Parent supplies its approved native bearer fetch with cookies omitted, active-lifetime mutation guard and current server authorization. The current copied prerequisite defaults to `credentials: "include"`; the native transport must override it to `omit` until Paul's explicit transport option is integrated. Do not add cookie/CSRF credentials. Runtime must fence every method, including payment GET/reconcile, on current identity/session/logout and abort.

Load and validate the actual approved commerce directory before constructing the controller. Map `reference = item.locationId`, `title = item.name` from `/v1/commerce/clinics`; **never substitute `clinicId`** or create customer-typed IDs. Missing directory stays unavailable, not a synthetic clinic. Directory loading and root composition remain parent software integration.

```tsx
import { NativeCommerceController } from "./customer/commerceController";
import { NativeCommerceCustomerViews } from "./customer/NativeCommerceCustomerViews";
import type { NativeCommerceRecovery } from "./customer/commerceController";

// In a parent-owned stable authority scope, AFTER fresh session + directory load:
const locations = approvedDirectory.items.map(item => ({
  reference: item.locationId, title: item.name,
}));
const controller = new NativeCommerceController({
  api: runtime.commerceApi,
  locations,
  session: () => currentValidatedSession,
  active: () => lifetimeIsCurrent(),
  uuid: randomUUID, // existing Expo Crypto binding
  onRevoked: revokeCurrentLifetime,
  recovery: sameSessionVolatileCarry, // same issued object, or null
});
// Keep controller + directory stable; do not recreate them on ordinary React renders.
<NativeCommerceCustomerViews controller={controller} locations={locations}
  locale={locale} fontFamily={loadedFontFamily} onRefreshSession={refreshSession} />;
```

The view subscribes to controller state, loads catalogue pages, observes AppState, polls expiry every second and disposes on unmount. Logout/session replacement must also synchronously dispose from the parent; view visibility is not an authorization boundary. If StrictMode deliberately replays mount cleanup, the parent must provide a fresh lifetime/controller rather than reuse a disposed one.

## Volatile background recovery broker

`snapshotRecovery(): NativeCommerceRecovery | null` returns a deep-frozen canonical command/server-view copy **only after explicit checkout confirmation**. No ordinary draft or address-only form is carried. Call it before the incumbent root disposes its runtime/unmounts children on ordinary background. It also works after child AppState redaction but before disposal. The parent must register/synchronously capture before disposal, not rely on React child cleanup order.

```ts
let carry: NativeCommerceRecovery | null = null; // memory only, outside unmounted subtree
function ordinaryBackground() {
  carry = controller.snapshotRecovery(); // BEFORE runtime/controller disposal
  controller.dispose();
  disposeRuntimeAndUnmountPrivateChildren();
}
// On foreground: fresh GET /v1/session; compare SAME credential digest if available,
// SAME userId + IDENTICAL expiresAt + customer scope, and original expiry not elapsed.
// Only then pass carry directly as options.recovery to the NEW controller; clear slot.
// Any logout, denial/revocation, changed owner/credential/expiry or expiry timer: carry=null.
```

The controller independently rejects owner/expiry/scope mismatch, expired carry and any object not issued by this module's in-memory provenance registry. Never serialize, spread/reconstruct, persist, log, send to analytics or put this object in SecureStore: it contains the confirmed delivery address. Only the outer broker can know explicit logout/credential changes and establish fresh server revalidation; these parent responsibilities cannot be inferred from `ClientSession` (which has no session ID).

Restored views are explicitly last-known, not current payment success. An unknown checkout retries the exact immutable confirmed command/UUID. Unknown payment creation retries its exact operation ID for server recovery; once any intent is known, only GET/read/reconcile of that same intent is available—never a new charge. Errors/conflicts after a dispatched command retain its identity and lock edits rather than guessing the operation failed. A request timeout aborts/fences late results but cannot establish server rollback. After process death there is no claimed durable native recovery: obtain authorized order/payment state from server history; do not blindly start another charge.

## Focused verification and remaining acceptance

- 30 unit cases: canonical invalid fields, approved-location/SKU selection, quantity edits, quote invalidation, explicit confirmation, duplicate presses, unknown retries, authorization denial, expiry/logout/inactive authority, ignored abort/timeout, background redaction, actual controller disposal/remount recovery, immutable provenance, same-session matching and no second intent after unknown.
- One Playwright synthetic real HTTP/controller journey: bearer-only headers; quote -> explicit checkout with lost reply -> disposal -> fresh session GET -> exact command replay; lost payment reply -> remount -> same operation recovery -> same intent GET/reconcile. This is not a browser/RN render, real database, provider or device proof.
- Root and mobile TypeScript no-emit checks; scoped Biome; Impeccable detector (no findings).
- No RN rendering test harness (`react-test-renderer`/React Native Testing Library) is installed in this snapshot. Native rendering, keyboard/accessibility/screen-reader inspection and supported physical-device checks remain unrun; no dependencies were added to conceal that gap.
- No full verify/build/platform/security/precommit campaigns or commits were run by this lane. Coordinator owns combined mandatory gates and independent financial/security review before commit.
- Software integration still required: parent runtime/mount, approved directory adapter, volatile lifecycle broker and exact bearer transport option. External acceptance remains provider configuration/eligibility, actual native payment SDK flow, signing, supported-device and company/independent approval. Missing native forms themselves are addressed by these source files, not classified as an external blocker.
