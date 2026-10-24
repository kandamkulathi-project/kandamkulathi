# Native commerce operational labels — draft integration

`packages/i18n/src/native-commerce.ts` exports `nativeCommerceLabels`, `formatNativeCommerceLabel`, `NativeCommerceLabelKey`, and `nativeCommerceTranslationReview`. All EN/ML/TA labels are **draft, unreviewed, nonclinical interface copy**. This does not establish company language approval or native rendering/device acceptance. No clinical advice, product description or medical translation is supplied.

The module was prepared against `NativeCommerceCustomerViews.tsx` in Devadathan's types worktree. Parent owns replacing its literals and any shared barrel registration; no App, native component, palette, font, dependency or existing locale resources were changed here.

## Parent registration and usage

Add to the coordinator-owned `packages/i18n/src/index.ts`:

```ts
export {
  nativeCommerceLabels,
  formatNativeCommerceLabel,
  nativeCommerceTranslationReview,
  type NativeCommerceLabelKey,
} from "./native-commerce";
```

Then in the native view:

```tsx
import { nativeCommerceLabels, formatNativeCommerceLabel } from "@kandamkulathi/i18n";
const labels = nativeCommerceLabels[locale];
const label = (key: NativeCommerceLabelKey, values: Record<string, string | number>) =>
  formatNativeCommerceLabel(locale, key, values);

// Use the same translated text for visible labels and accessibilityLabel.
copy(labels.translationNotice);
copy(label("productStock", {
  amount: formatMoney(product.unitPaise, locale), status: product.stockStatus,
}));
button(label(state.locationId === location.reference ? "selected" : "choose", {
  name: location.title,
}), () => controller.selectLocation(location.reference), locked);
```

Import `type NativeCommerceLabelKey` alongside the runtime exports. Keep `foundation[locale]` for existing shared commerce/loading/empty/anonymous/denied/unavailable messages. Keep the supplied `fontFamily`, fonts, palette, money formatter and server data. Templates preserve dynamic values literally; they never translate IDs, raw status codes, product names, variants, descriptions or timestamps. Do not translate or reinterpret authoritative business state by substring replacement.

## Exact view literal → key map

| View text / purpose | Resource key / substitution |
| --- | --- |
| Draft English notice | `translationNotice` (updated to describe all three draft locales) |
| Address field titles | `recipientName`, `line1`, `line2`, `city`, `region`, `postalCode`, `contactPhone` |
| Invalid quote/address/quantity notice | `invalid` |
| Uncertain outcome / SAME operation | `uncertain` |
| Changed price/stock/operation | `conflict` |
| Unverified response | `error` |
| Restored last-known operation notice | `restored` |
| Hidden shopping data / restore session | `sessionHidden` |
| Refresh session | `refreshSession` |
| Fulfilment clinic | `clinic` |
| No approved clinic directory | `noDirectory` |
| Selected / Choose location | `selected` / `choose`, `{name: location.title}` |
| Products | `products` |
| Price · Stock | `productStock`, `{amount: formatMoney(...), status: product.stockStatus}` |
| Consultation requirement (no medical advice) | `consultationRequired` |
| Add product | `addProduct`, `{name: product.name + " · " + product.variant}` |
| Refresh products / Next product page | `refreshProducts` / `nextProducts` |
| Cart heading / empty | `cart` / `cartEmpty` |
| SKU fallback | `sku`, `{id: line.skuId}` |
| Quantity field and accessibility label | `quantity`, `{name}` |
| Remove product | `removeProduct`, `{name}` |
| Delivery address | `deliveryAddress` |
| India / courier eligibility disclaimer | `countryNotice` |
| Check address field | `checkField`, `{field: translatedTitle}`; do **not** call `toLowerCase()` |
| Get current server quote | `requestQuote` |
| Review server quote | `reviewQuote` |
| Quote line | `quoteLine`, `{id, quantity, amount: formatMoney(...), tax: formatMoney(...)}` |
| Server total | `serverTotal`, `{amount: formatMoney(...)}` |
| Reservation is not payment confirmation | `confirmNotice` |
| Retry same checkout | `retryCheckout` |
| Confirm amount and reserve | `confirmReserve`, `{amount: formatMoney(...)}` |
| Order reservation | `reservation` |
| Server reservation expiry | `reservationExpiry`, `{time: state.reservation.expiresAt}` |
| Recover same payment initiation | `recoverPayment` |
| Initiate payment | `initiatePayment` |
| Last-known / Current payment state | `paymentLastKnown` / `paymentCurrent` |
| Server captured, fulfilment separate | `paymentCaptured` |
| No completion / SDK/device acceptance pending | `paymentPending` |
| Read / Reconcile existing payment | `readPayment` / `reconcilePayment` |

Change `addressFields` from English `title` literals to `titleKey` references, then resolve `const title = labels[titleKey]` inside the render. Preserve field keys, input keyboard types, schema validation and controller calls. Do not localize protocol keys or stored address values.

Auth-bootstrap labels are not in the inspected view; they remain a separately scoped follow-up once their actual source is supplied. The resource alone is not a wired native UI or a locale end-to-end pass. Parent must assert language switching, translated accessibility labels and device-appropriate layout without changing business behavior; final combined gates remain required.
