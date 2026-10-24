import { formatMoney, foundation, type Locale } from "@kandamkulathi/i18n";
import { useEffect, useState } from "react";
import { AppState, Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { directoryChoices, parseReply } from "../../../workspaces/src/customer/booking/contracts";
import type { ViewResource } from "../../../workspaces/src/customer/booking/controller";
import { bookingDraftLabels as draft } from "../../../workspaces/src/customer/booking/labels";
import {
  type BookingAdapterProps,
  useBooking,
} from "../../../workspaces/src/customer/booking/useBooking";
import {
  type NativeCommerceAdapter,
  type NativeCommercePage,
  nativeCommerceAllowed,
  nativeCommerceEnabled,
  parseNativeCommerce,
} from "./commerce";

export type CustomerNativeViewsProps = BookingAdapterProps & {
  locale: Locale;
  commerce?: NativeCommerceAdapter;
  /** Disable the legacy read-only projection when the parent mounts commerce forms. */
  showCommerce?: boolean;
  /** Font names already loaded by the senior native shell. */
  fontFamily?: string;
};
/** Independently mountable assembly; no root registration, auth or SDK setup. */
export function CustomerNativeViews(props: CustomerNativeViewsProps) {
  const { locale, fontFamily } = props;
  const text = foundation[locale];
  const { controller, state } = useBooking(props);
  const [section, setSection] = useState<NativeCommercePage["section"]>("catalogue");
  const [commerce, setCommerce] = useState<ViewResource<NativeCommercePage>>({ status: "idle" });
  const [revision, setRevision] = useState(0);
  const [commerceSession, setCommerceSession] = useState(props.session);
  const [foreground, setForeground] = useState(true);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (value) => {
      if (value !== "active") {
        controller.invalidate();
        setForeground(false);
        setCommerce({ status: "anonymous" });
      }
    });
    return () => subscription.remove();
  }, [controller]);
  useEffect(() => {
    if (!Number.isSafeInteger(revision)) return;
    if (!nativeCommerceEnabled(props.showCommerce)) {
      setCommerce({ status: "idle" });
      return;
    }
    setCommerceSession(props.session);
    const abort = new AbortController();
    let active = true;
    if (!foreground || !nativeCommerceAllowed(section, props.session)) {
      setCommerce({ status: "anonymous" });
      return;
    }
    if (!props.commerce) {
      setCommerce({ status: "unavailable" });
      return;
    }
    setCommerce({ status: "loading" });
    const timeout = setTimeout(() => {
      abort.abort();
      if (active) setCommerce({ status: "error" });
    }, 5000);
    void props.commerce
      .load({ section }, abort.signal)
      .then((raw) => {
        if (active && !abort.signal.aborted && nativeCommerceAllowed(section, props.session))
          setCommerce(parseReply(raw, (value) => parseNativeCommerce(value, section)));
      })
      .catch(() => {
        if (active && !abort.signal.aborted) setCommerce({ status: "error" });
      });
    const expiry = setInterval(() => {
      if (!nativeCommerceAllowed(section, props.session)) {
        abort.abort();
        setCommerce({ status: "anonymous" });
      }
    }, 1000);
    return () => {
      active = false;
      abort.abort();
      clearTimeout(timeout);
      clearInterval(expiry);
    };
  }, [props.commerce, props.session, props.showCommerce, foreground, section, revision]);
  const copy = (value: string, heading = false) => (
    <Text
      style={[heading ? styles.heading : styles.copy, { fontFamily }]}
      accessibilityRole={heading ? "header" : "text"}
    >
      {value}
    </Text>
  );
  const notice = (resource: ViewResource<unknown>) =>
    resource.status !== "ready" &&
    resource.status !== "idle" && (
      <Text style={[styles.copy, { fontFamily }]} accessibilityLiveRegion="polite">
        {resource.status === "conflict" ? draft.conflict : text[resource.status]}
      </Text>
    );
  const directory = state.directory.status === "ready" ? state.directory.data : null;
  const displayCommerce =
    foreground && commerceSession === props.session && nativeCommerceAllowed(section, props.session)
      ? commerce
      : { status: "anonymous" as const };
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {copy(text.customer, true)}
      {nativeCommerceEnabled(props.showCommerce) && (
        <>
          {copy(
            "Native catalogue, cart and order labels are draft English; translations await review.",
          )}
          <View style={styles.actions}>
            {(["catalogue", "cart", "orders"] as const).map((value) => (
              <Button
                key={value}
                title={value}
                accessibilityLabel={value}
                onPress={() => setSection(value)}
                color="#163d36"
              />
            ))}
          </View>
          {notice(displayCommerce)}
          {displayCommerce.status === "ready" &&
            displayCommerce.data.section === section &&
            displayCommerce.data.rows.map((row) => (
              <View key={row.id}>
                {copy(row.title, true)}
                {copy(row.detail)}
              </View>
            ))}
          {displayCommerce.status === "ready" &&
            !displayCommerce.data.rows.length &&
            copy(text.empty)}
          <Button
            title={text.retry}
            disabled={!foreground || displayCommerce.status === "loading"}
            onPress={() => setRevision((n) => n + 1)}
            color="#163d36"
          />
        </>
      )}
      {copy(text.consultations, true)}
      {copy(draft.draft)}
      {notice(props.session ? state.directory : { status: props.sessionStatus ?? "anonymous" })}
      {directory &&
        directoryChoices(directory).clinics.map((clinic) => (
          <View key={clinic.id}>
            {copy(clinic.name, true)}
            {directoryChoices(directory, clinic.id).doctors.map((doctor) => (
              <View key={doctor.doctorId}>
                {copy(
                  `${doctor.displayName} · ${doctor.qualifications.join(", ")} · ${doctor.languages.join(", ")}`,
                )}
                {directoryChoices(directory, clinic.id, doctor.doctorId).services.map((service) => (
                  <View key={service.id} style={styles.action}>
                    <Button
                      title={`${doctor.displayName} · ${service.name}`}
                      disabled={state.hold.status === "loading" || state.uncertain}
                      onPress={() =>
                        void controller.select({
                          clinicId: clinic.id,
                          doctorId: doctor.doctorId,
                          serviceId: service.id,
                        })
                      }
                      color="#163d36"
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      {directory && !directory.doctors.length && copy(text.empty)}
      {notice(state.slots)}
      {state.slots.status === "ready" &&
        state.slots.data.truncated &&
        copy(
          "Only part of the current offer inventory is shown. Refresh to check current availability; these offers are not reservations.",
        )}
      {state.slots.status === "ready" &&
        state.slots.data.offers.map((offer) => (
          <View
            key={`${offer.slot.availabilityId}-${offer.slot.interval.start}-${offer.slot.modality}`}
          >
            {copy(
              `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: offer.slot.clinicTimezone }).format(new Date(offer.slot.interval.start))} (${offer.slot.clinicTimezone}) · ${draft[offer.slot.modality]} · ${formatMoney(offer.fee.amountPaise, locale)}`,
            )}
            <Button
              title={draft.hold}
              disabled={state.uncertain || state.hold.status === "loading"}
              onPress={() => void controller.hold(offer)}
              color="#163d36"
            />
          </View>
        ))}
      {state.slots.status === "ready" && !state.slots.data.offers.length && copy(text.empty)}
      {notice(state.hold)}
      {state.uncertain && copy(draft.uncertain)}
      {state.canRefreshHold && state.hold.status !== "ready" && (
        <Button
          title={draft.refresh}
          disabled={state.hold.status === "loading"}
          onPress={() => void controller.refreshHold()}
          color="#163d36"
        />
      )}
      {state.hold.status === "ready" && (
        <View>
          {copy(
            `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: state.hold.data.booking.slot.clinicTimezone }).format(new Date(state.hold.data.booking.slot.interval.start))} (${state.hold.data.booking.slot.clinicTimezone}) · ${formatMoney(state.hold.data.booking.fee.amountPaise, locale)}`,
          )}
          {copy(
            draft[
              state.hold.data.booking.state === "held" ? "held" : state.hold.data.booking.state
            ],
          )}
          {state.hold.data.booking.state === "held" &&
            copy(
              state.remainingSeconds
                ? `${draft.countdown}: ${state.remainingSeconds}s`
                : draft.elapsed,
            )}
          {copy(text.pending)}
          <Button
            title={draft.refresh}
            onPress={() => void controller.refreshHold()}
            color="#163d36"
          />
        </View>
      )}
      {copy(draft.appointments, true)}
      {notice(state.appointments)}
      {state.appointments.status === "ready" &&
        !state.appointments.data.bookings.length &&
        copy(text.empty)}
      {state.appointments.status === "ready" &&
        state.appointments.data.bookings.map((booking) => (
          <View key={booking.id}>
            {copy(
              `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: booking.slot.clinicTimezone }).format(new Date(booking.slot.interval.start))} · ${draft[booking.state === "held" ? "held" : booking.state]} · ${formatMoney(booking.fee.amountPaise, locale)}`,
            )}
            {booking.payments.some((p) => p.disposition === "rebook_or_refund_required") &&
              copy(draft.refund)}
            {booking.state === "confirmed" && booking.slot.modality === "online" && (
              <Button
                title={draft.join}
                disabled={state.join === "loading"}
                onPress={() => void controller.join(booking)}
                color="#163d36"
              />
            )}
          </View>
        ))}
      {state.join !== "idle" &&
        copy(
          state.join === "pending"
            ? draft.pending
            : state.join === "conflict"
              ? draft.conflict
              : text[state.join],
        )}
      <Button
        title={draft.refresh}
        disabled={state.appointments.status === "loading"}
        onPress={() => void controller.refreshAppointments()}
        color="#163d36"
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f4ec" },
  content: { padding: 28, paddingTop: 72, paddingBottom: 48, gap: 12 },
  heading: { fontSize: 23, fontWeight: "600", color: "#163d36", marginTop: 24 },
  copy: { fontSize: 16, lineHeight: 28, color: "#415d55", marginVertical: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  action: { minHeight: 44, marginVertical: 6 },
});
