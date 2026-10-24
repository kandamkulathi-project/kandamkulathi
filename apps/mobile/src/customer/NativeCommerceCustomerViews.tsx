import {
  formatMoney,
  formatNativeCommerceLabel,
  foundation,
  type Locale,
  type NativeCommerceLabelKey,
  nativeCommerceLabels,
} from "@kandamkulathi/i18n";
import { useEffect, useSyncExternalStore } from "react";
import { AppState, Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { deliveryAddressSchema } from "../../../../packages/contracts/src/commerce-address";
import type {
  CommerceDraftAddress,
  CommerceLocation,
  NativeCommerceController,
} from "./commerceController";

export type NativeCommerceCustomerViewsProps = {
  controller: NativeCommerceController;
  /** Exact same current approved directory passed to the controller. No typed UUID input. */
  locations: readonly CommerceLocation[];
  locale: Locale;
  fontFamily?: string;
  onRefreshSession?(): void;
};
const addressFields: {
  key: Exclude<keyof CommerceDraftAddress, "country">;
  keyboard?: "phone-pad" | "number-pad";
}[] = [
  { key: "recipientName" },
  { key: "line1" },
  { key: "line2" },
  { key: "city" },
  { key: "region" },
  { key: "postalCode", keyboard: "number-pad" },
  {
    key: "contactPhone",
    keyboard: "phone-pad",
  },
];

/** Native software checkout, independent of provider SDK/signing/root composition. */
export function NativeCommerceCustomerViews({
  controller,
  locations,
  locale,
  fontFamily,
  onRefreshSession,
}: NativeCommerceCustomerViewsProps) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const text = foundation[locale];
  const labels = nativeCommerceLabels[locale];
  const label = (key: NativeCommerceLabelKey, values: Readonly<Record<string, string | number>>) =>
    formatNativeCommerceLabel(locale, key, values);
  useEffect(() => {
    controller.setForeground(AppState.currentState === "active");
    controller.checkAuthority();
    void controller.loadCatalogue();
    const subscription = AppState.addEventListener("change", (value) =>
      controller.setForeground(value === "active"),
    );
    const expiry = setInterval(controller.checkAuthority, 1000);
    return () => {
      subscription.remove();
      clearInterval(expiry);
      controller.dispose();
    };
  }, [controller]);
  const copy = (value: string, heading = false) => (
    <Text
      accessibilityRole={heading ? "header" : "text"}
      style={[heading ? styles.heading : styles.copy, { fontFamily }]}
    >
      {value}
    </Text>
  );
  const button = (title: string, onPress: () => void, disabled = false) => (
    <View style={styles.action}>
      <Button
        color="#163d36"
        title={title}
        accessibilityLabel={title}
        onPress={onPress}
        disabled={disabled}
      />
    </View>
  );
  const busy = state.status === "loading";
  const locked = busy || !!state.recovery || !!state.reservation;
  const addressValidation = deliveryAddressSchema.safeParse(state.address);
  const invalidFields =
    !addressValidation.success && state.status === "invalid" ? addressValidation.error.issues : [];
  const status =
    state.status === "invalid"
      ? labels.invalid
      : state.recovery
        ? labels.uncertain
        : state.status === "conflict"
          ? labels.conflict
          : state.status === "error"
            ? labels.error
            : state.status !== "ready" && state.status !== "idle"
              ? text[state.status]
              : null;
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {copy(text.commerce, true)}
      {copy(labels.translationNotice)}
      {status && (
        <Text accessibilityLiveRegion="polite" style={[styles.copy, { fontFamily }]}>
          {status}
        </Text>
      )}
      {state.restored && copy(labels.restored)}
      {state.status === "anonymous" || state.status === "denied" ? (
        <>
          {copy(labels.sessionHidden)}
          {onRefreshSession && button(labels.refreshSession, onRefreshSession)}
        </>
      ) : (
        <>
          {copy(labels.clinic, true)}
          {!locations.length && copy(labels.noDirectory)}
          {locations.map((location) => (
            <View key={location.reference}>
              {button(
                label(state.locationId === location.reference ? "selected" : "choose", {
                  name: location.title,
                }),
                () => controller.selectLocation(location.reference),
                locked,
              )}
            </View>
          ))}
          {copy(labels.products, true)}
          {state.catalogue && !state.catalogue.items.length && copy(text.empty)}
          {state.catalogue?.items.map((product) => (
            <View key={product.skuId} style={styles.product}>
              {copy(`${product.name} · ${product.variant}`, true)}
              {copy(product.description)}
              {copy(
                label("productStock", {
                  amount: formatMoney(product.unitPaise, locale),
                  status: product.stockStatus,
                }),
              )}
              {product.consultOnly && copy(labels.consultationRequired)}
              {button(
                label("addProduct", { name: `${product.name} · ${product.variant}` }),
                () =>
                  controller.setQuantity(
                    product.skuId,
                    (state.lines.find((line) => line.skuId === product.skuId)?.quantity ?? 0) + 1,
                  ),
                locked || !state.locationId,
              )}
            </View>
          ))}
          {button(
            labels.refreshProducts,
            () => {
              void controller.loadCatalogue();
            },
            busy || !!state.recovery,
          )}
          {state.catalogue?.nextCursor &&
            button(
              labels.nextProducts,
              () => {
                void controller.loadCatalogue(state.catalogue?.nextCursor ?? undefined);
              },
              busy || !!state.recovery,
            )}
          {copy(labels.cart, true)}
          {!state.lines.length && copy(labels.cartEmpty)}
          {state.lines.map((line) => {
            const product = state.catalogue?.items.find((item) => item.skuId === line.skuId);
            const name = product
              ? `${product.name} · ${product.variant}`
              : label("sku", { id: line.skuId });
            return (
              <View key={line.skuId} style={styles.field}>
                {copy(name)}
                {copy(label("quantity", { name }))}
                <TextInput
                  accessibilityLabel={label("quantity", { name })}
                  style={[styles.input, { fontFamily }]}
                  value={String(line.quantity)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  editable={!locked}
                  onChangeText={(value) => {
                    if (/^[0-9]+$/.test(value)) controller.setQuantity(line.skuId, Number(value));
                  }}
                />
                {button(
                  label("removeProduct", { name }),
                  () => controller.setQuantity(line.skuId, 0),
                  locked,
                )}
              </View>
            );
          })}
          {copy(labels.deliveryAddress, true)}
          {copy(labels.countryNotice)}
          {addressFields.map(({ key, keyboard }) => (
            <View key={key} style={styles.field}>
              {copy(labels[key])}
              <TextInput
                accessibilityLabel={labels[key]}
                style={[styles.input, { fontFamily }]}
                value={state.address[key]}
                editable={!locked}
                keyboardType={keyboard ?? "default"}
                autoCapitalize={key === "contactPhone" ? "none" : "words"}
                autoCorrect={false}
                onChangeText={(value) => controller.setAddress(key, value)}
              />
              {invalidFields.some((issue) => issue.path[0] === key) && (
                <Text accessibilityLiveRegion="polite" style={[styles.copy, { fontFamily }]}>
                  {label("checkField", { field: labels[key] })}
                </Text>
              )}
            </View>
          ))}
          {!state.reservation &&
            !state.recovery &&
            button(
              labels.requestQuote,
              () => {
                void controller.requestQuote();
              },
              busy || !locations.length,
            )}
          {state.quote && !state.reservation && (
            <View style={styles.summary}>
              {copy(labels.reviewQuote, true)}
              {state.quote.lines.map((line) => (
                <View key={line.skuId}>
                  {copy(
                    label("quoteLine", {
                      id: line.skuId,
                      quantity: line.quantity,
                      amount: formatMoney(line.amountPaise, locale),
                      tax: formatMoney(line.taxPaise, locale),
                    }),
                  )}
                </View>
              ))}
              {copy(
                label("serverTotal", { amount: formatMoney(state.quote.amountPaise, locale) }),
                true,
              )}
              {copy(labels.confirmNotice)}
              {button(
                state.recovery === "checkout"
                  ? labels.retryCheckout
                  : label("confirmReserve", {
                      amount: formatMoney(state.quote.amountPaise, locale),
                    }),
                () => {
                  void controller.confirmCheckout();
                },
                busy,
              )}
            </View>
          )}
          {state.reservation && (
            <View style={styles.summary}>
              {copy(labels.reservation, true)}
              {copy(
                `${state.reservation.orderId} · ${state.reservation.status} · ${formatMoney(state.reservation.amountPaise, locale)}`,
              )}
              {copy(label("reservationExpiry", { time: state.reservation.expiresAt }))}
              {!state.payment &&
                button(
                  state.recovery === "payment" ? labels.recoverPayment : labels.initiatePayment,
                  () => {
                    void controller.createPayment();
                  },
                  busy,
                )}
            </View>
          )}
          {state.payment && (
            <View style={styles.summary}>
              {state.hardware !== "idle" && (
                <Text accessibilityLiveRegion="polite" style={[styles.copy, { fontFamily }]}>
                  {state.hardware === "opening"
                    ? labels.openingProvider
                    : state.hardware === "awaiting_server"
                      ? state.status === "ready"
                        ? labels.providerReconcile
                        : labels.providerUnavailable
                      : text.loading}
                </Text>
              )}
              {copy(state.restored ? labels.paymentLastKnown : labels.paymentCurrent, true)}
              {copy(
                `${state.payment.intentId} · ${state.payment.state} · ${formatMoney(state.payment.amountPaise, locale)}`,
              )}
              {copy(
                state.payment.state === "captured" && !state.restored
                  ? labels.paymentCaptured
                  : labels.paymentPending,
              )}
              {button(
                labels.readPayment,
                () => {
                  void controller.refreshPayment();
                },
                busy,
              )}
              {state.payment.state === "ready" &&
                !state.restored &&
                !busy &&
                button(labels.payWithProvider, () => {
                  void controller.openPayment();
                })}
              {button(
                labels.reconcilePayment,
                () => {
                  void controller.refreshPayment(true);
                },
                busy,
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f4ec" },
  content: { padding: 28, paddingTop: 32, paddingBottom: 48, gap: 12 },
  heading: { fontSize: 23, fontWeight: "600", color: "#163d36", marginTop: 24 },
  copy: { fontSize: 16, lineHeight: 28, color: "#415d55" },
  field: { gap: 8, marginVertical: 6 },
  input: {
    minHeight: 48,
    backgroundColor: "white",
    color: "#163d36",
    borderColor: "#647c70",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  action: { minHeight: 44, justifyContent: "center", marginVertical: 6 },
  product: { gap: 12, paddingBottom: 16 },
  summary: { gap: 12, borderColor: "#c7d2ca", borderWidth: 1, borderRadius: 10, padding: 16 },
});
