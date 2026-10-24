import { foundation, type Locale } from "@kandamkulathi/i18n";
import { Button } from "@kandamkulathi/ui";
import { BookingCustomerViews } from "./booking";
import type { BookingConsultationAdapter, BookingCustomerApi } from "./booking/contracts";
import { type CommerceCustomerProps, CommerceCustomerViews } from "./commerce";
import "./customer.css";

export type CustomerSection = "commerce" | "booking";
export type CustomerJourneyViewsProps = Omit<CommerceCustomerProps, "api"> & {
  section: CustomerSection;
  onSectionChange(section: CustomerSection): void;
  commerce?: CommerceCustomerProps["api"];
  booking?: BookingCustomerApi;
  consultation?: BookingConsultationAdapter;
};

/** Coordinator-owned routes provide the current section and reviewed adapters.
 * Only the active view mounts; navigation never preserves a hidden private view.
 */
export function CustomerJourneyViews(props: CustomerJourneyViewsProps) {
  const text = foundation[props.locale];
  return (
    <div>
      <fieldset className="actions customer-navigation">
        <legend>{text.customer}</legend>
        <Button
          aria-pressed={props.section === "commerce"}
          onClick={() => props.onSectionChange("commerce")}
        >
          {text.commerce}
        </Button>
        <Button
          aria-pressed={props.section === "booking"}
          onClick={() => props.onSectionChange("booking")}
        >
          {text.consultations}
        </Button>
      </fieldset>
      {props.section === "commerce" ? (
        <CommerceCustomerViews {...props} {...(props.commerce ? { api: props.commerce } : {})} />
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
          {...(props.booking ? { api: props.booking } : {})}
          {...(props.consultation ? { consultation: props.consultation } : {})}
        />
      )}
    </div>
  );
}

export type { Locale };
