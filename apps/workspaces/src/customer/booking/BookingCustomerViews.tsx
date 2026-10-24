import { formatMoney, foundation, type Locale } from "@kandamkulathi/i18n";
import { Button, Notice } from "@kandamkulathi/ui";
import { useEffect, useId, useState } from "react";
import type { BookingRecord, BookingSlot } from "./contracts";
import { directoryChoices } from "./contracts";
import type { ViewResource } from "./controller";
import { bookingDraftLabels as draft } from "./labels";
import { type BookingAdapterProps, useBooking } from "./useBooking";
import "./booking.css";

export type BookingCustomerViewsProps = BookingAdapterProps & { locale: Locale };
export function slotTime(slot: BookingSlot, locale: Locale) {
  return `${new Intl.DateTimeFormat({ en: "en-IN", ml: "ml-IN", ta: "ta-IN" }[locale], { dateStyle: "medium", timeStyle: "short", timeZone: slot.clinicTimezone }).format(new Date(slot.interval.start))} – ${new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: slot.clinicTimezone }).format(new Date(slot.interval.end))} (${slot.clinicTimezone})`;
}
function ResourceNotice({ resource, locale }: { resource: ViewResource<unknown>; locale: Locale }) {
  if (resource.status === "ready" || resource.status === "idle") return null;
  return (
    <Notice error={["error", "conflict", "denied"].includes(resource.status)}>
      {resource.status === "conflict" ? (
        <span lang="en">{draft.conflict}</span>
      ) : (
        foundation[locale][resource.status]
      )}
    </Notice>
  );
}
function BookingSummary({ booking, locale }: { booking: BookingRecord; locale: Locale }) {
  return (
    <>
      <p lang="en">
        <strong>{draft[booking.state === "held" ? "held" : booking.state]}</strong>
      </p>
      <p>
        {slotTime(booking.slot, locale)} · <span lang="en">{draft[booking.slot.modality]}</span> ·{" "}
        {formatMoney(booking.fee.amountPaise, locale)}
      </p>
      {booking.payments.some((p) => p.disposition === "rebook_or_refund_required") && (
        <Notice>
          <span lang="en">{draft.refund}</span>
        </Notice>
      )}
    </>
  );
}
export function BookingCustomerViews(props: BookingCustomerViewsProps) {
  if (!props.session)
    return (
      <div
        className="customer-booking"
        lang={props.locale}
        data-booking-state={props.sessionStatus ?? "anonymous"}
      >
        <h2>{foundation[props.locale].consultations}</h2>
        <Notice error={props.sessionStatus === "error" || props.sessionStatus === "denied"}>
          {foundation[props.locale][props.sessionStatus ?? "anonymous"]}
        </Notice>
      </div>
    );
  return <BookingReadyViews {...props} />;
}
function BookingReadyViews(props: BookingCustomerViewsProps) {
  const { locale } = props;
  const { controller, state } = useBooking(props);
  const [clinicId, setClinic] = useState("");
  const [doctorId, setDoctor] = useState("");
  const [serviceId, setService] = useState("");
  const id = useId();
  const text = foundation[locale];
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") controller.invalidate();
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) controller.invalidate();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", controller.invalidate);
    window.addEventListener("pageshow", restore);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", controller.invalidate);
      window.removeEventListener("pageshow", restore);
    };
  }, [controller]);
  const directory = state.directory.status === "ready" ? state.directory.data : null;
  const select = (clinic: string, doctor: string, service: string) => {
    setClinic(clinic);
    setDoctor(doctor);
    setService(service);
    if (clinic && doctor && service)
      void controller.select({ clinicId: clinic, doctorId: doctor, serviceId: service });
    else controller.clearSelection();
  };
  return (
    <div className="customer-booking" lang={locale} data-booking-state={state.directory.status}>
      <h2>{text.consultations}</h2>
      <p lang="en">{draft.draft}</p>
      <section aria-labelledby={`${id}-directory`}>
        <h3 id={`${id}-directory`} lang="en">
          {draft.directory}
        </h3>
        <ResourceNotice resource={state.directory} locale={locale} />
        {directory && (
          <fieldset disabled={state.hold.status === "loading" || state.uncertain}>
            <legend lang="en">{draft.directory}</legend>
            <div className="booking-fields">
              <label lang="en">
                {draft.clinic}
                <select
                  value={clinicId}
                  onChange={(e) => select(e.target.value, "", directory.scopes ? "" : serviceId)}
                >
                  <option value="">{draft.choose}</option>
                  {directoryChoices(directory, clinicId, doctorId).clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label lang="en">
                {draft.doctor}
                <select
                  value={doctorId}
                  disabled={!clinicId}
                  onChange={(e) =>
                    select(clinicId, e.target.value, directory.scopes ? "" : serviceId)
                  }
                >
                  <option value="">{draft.choose}</option>
                  {directoryChoices(directory, clinicId, doctorId).doctors.map((d) => (
                    <option key={d.doctorId} value={d.doctorId}>
                      {d.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label lang="en">
                {draft.service}
                <select
                  value={serviceId}
                  onChange={(e) => select(clinicId, doctorId, e.target.value)}
                >
                  <option value="">{draft.choose}</option>
                  {directoryChoices(directory, clinicId, doctorId).services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {directory.doctors
              .filter((d) => d.doctorId === doctorId)
              .map((d) => (
                <p key={d.doctorId}>
                  {d.displayName} · {d.qualifications.join(", ")} · {d.languages.join(", ")}
                </p>
              ))}
            {!directory.doctors.length && <Notice>{text.empty}</Notice>}
          </fieldset>
        )}
        {["error", "unavailable"].includes(state.directory.status) && (
          <Button onClick={() => void controller.load()}>{text.retry}</Button>
        )}
      </section>
      <section aria-labelledby={`${id}-slots`}>
        <h3 id={`${id}-slots`} lang="en">
          {draft.slots}
        </h3>
        <ResourceNotice resource={state.slots} locale={locale} />
        {state.slots.status === "ready" && state.slots.data.truncated && (
          <Notice>
            Only part of the current offer inventory is shown. Refresh to check current
            availability; these offers are not reservations.
          </Notice>
        )}
        {state.selection && !state.uncertain && (
          <Button
            onClick={() => state.selection && void controller.select(state.selection)}
            disabled={state.slots.status === "loading" || state.hold.status === "loading"}
          >
            <span lang="en">{draft.refresh}</span>
          </Button>
        )}
        {state.slots.status === "ready" && (
          <ul className="booking-list">
            {state.slots.data.offers.map((offer) => (
              <li
                key={`${offer.slot.availabilityId}-${offer.slot.interval.start}-${offer.slot.modality}`}
              >
                <p>
                  {slotTime(offer.slot, locale)} ·{" "}
                  <span lang="en">{draft[offer.slot.modality]}</span> ·{" "}
                  {formatMoney(offer.fee.amountPaise, locale)}
                </p>
                <Button
                  onClick={() => void controller.hold(offer)}
                  disabled={state.hold.status === "loading" || state.uncertain}
                >
                  <span lang="en">{draft.hold}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
        {state.slots.status === "ready" && !state.slots.data.offers.length && (
          <Notice>{text.empty}</Notice>
        )}
      </section>
      <ResourceNotice resource={state.hold} locale={locale} />
      {state.uncertain && (
        <Notice error>
          <span lang="en">{draft.uncertain}</span>
        </Notice>
      )}
      {state.canRefreshHold && state.hold.status !== "ready" && (
        <Button
          disabled={state.hold.status === "loading"}
          onClick={() => void controller.refreshHold()}
        >
          <span lang="en">{draft.refresh}</span>
        </Button>
      )}
      {state.hold.status === "ready" && (
        <section aria-label={draft.held}>
          <BookingSummary booking={state.hold.data.booking} locale={locale} />
          {state.hold.data.booking.state === "held" && (
            <p lang="en">
              {state.remainingSeconds ? (
                <>
                  {draft.countdown}:{" "}
                  <span className="booking-countdown">{state.remainingSeconds}s</span>
                </>
              ) : (
                draft.elapsed
              )}
            </p>
          )}
          <Button onClick={() => void controller.refreshHold()}>
            <span lang="en">{draft.refresh}</span>
          </Button>
          <Notice>{text.pending}</Notice>
        </section>
      )}
      <section aria-labelledby={`${id}-appointments`}>
        <h3 id={`${id}-appointments`} lang="en">
          {draft.appointments}
        </h3>
        <ResourceNotice resource={state.appointments} locale={locale} />
        <Button
          onClick={() => void controller.refreshAppointments()}
          disabled={state.appointments.status === "loading"}
        >
          <span lang="en">{draft.refresh}</span>
        </Button>
        {state.appointments.status === "ready" && (
          <ul className="booking-list">
            {state.appointments.data.bookings.map((booking) => (
              <li key={booking.id}>
                <BookingSummary booking={booking} locale={locale} />
                {booking.state === "confirmed" && booking.slot.modality === "online" && (
                  <Button
                    disabled={state.join === "loading"}
                    onClick={() => void controller.join(booking)}
                  >
                    <span lang="en">{draft.join}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {state.appointments.status === "ready" && !state.appointments.data.bookings.length && (
          <Notice>{text.empty}</Notice>
        )}
        {state.join !== "idle" && (
          <Notice>
            {state.join === "pending" ? (
              <span lang="en">{draft.pending}</span>
            ) : state.join === "conflict" ? (
              <span lang="en">{draft.conflict}</span>
            ) : (
              text[state.join]
            )}
          </Notice>
        )}
      </section>
    </div>
  );
}
