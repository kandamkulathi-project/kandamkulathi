import { foundation, type Locale } from "@kandamkulathi/i18n";
import { Button } from "@kandamkulathi/ui";
import { useMemo } from "react";
import { BookingCustomerViews, createBookingRuntimeApi } from "./booking";
import type { BookingConsultationAdapter } from "./booking/contracts";
import type { BookingRuntimeOptions } from "./booking/runtimeAdapter";
import type { CustomerSection } from "./CustomerJourneyViews";
import { AuthoritativeCommerceCustomerViews } from "./commerce/AuthoritativeCommerceCustomerViews";
import type { AuthoritativeTransport } from "./commerce/authoritative-api";
import type { CommerceSession } from "./commerce/CommerceCustomerViews";
import { commercePresentationSchemas } from "./commerce/domainSchemas";

export type CustomerRuntimeViewsProps = {
  locale: Locale;
  section: CustomerSection;
  session: CommerceSession;
  commerceTransport: AuthoritativeTransport;
  locations?: { reference: string; title: string }[];
  bookingRuntime?: BookingRuntimeOptions;
  consultation?: BookingConsultationAdapter;
  onRefreshSession(): void;
  onSignIn?(): void;
  onSignOut?(): void;
};

/** Actual runtime composition, not the synthetic test projection application.
 * The root owns verified session lifecycle, routing and sensitive transports.
 */
export function CustomerRuntimeViews(props: CustomerRuntimeViewsProps) {
  const booking = useMemo(
    () => (props.bookingRuntime ? createBookingRuntimeApi(props.bookingRuntime) : undefined),
    [props.bookingRuntime],
  );
  return (
    <>
      {props.session.status === "anonymous" && props.onSignIn && (
        <Button onClick={props.onSignIn}>Sign in</Button>
      )}
      {props.session.status === "ready" && props.onSignOut && (
        <Button onClick={props.onSignOut}>Sign out</Button>
      )}
      {props.section === "commerce" ? (
        <AuthoritativeCommerceCustomerViews
          locale={props.locale}
          session={props.session}
          transport={props.commerceTransport}
          schemas={commercePresentationSchemas}
          {...(props.locations ? { locations: props.locations } : {})}
          onRefreshSession={props.onRefreshSession}
        />
      ) : (
        <BookingCustomerViews
          key={props.session.status === "ready" ? props.session.epoch : props.session.status}
          locale={props.locale}
          session={props.session.status === "ready" ? props.session.session : null}
          {...(props.session.status !== "ready"
            ? {
                sessionStatus:
                  props.session.status === "conflict" ? ("error" as const) : props.session.status,
              }
            : {})}
          {...(booking ? { api: booking } : {})}
          {...(props.consultation ? { consultation: props.consultation } : {})}
        />
      )}
      {props.session.status !== "ready" && <p>{foundation[props.locale].pending}</p>}
    </>
  );
}
