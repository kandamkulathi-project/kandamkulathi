import type { ClientSession } from "@kandamkulathi/contracts/client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { BookingConsultationAdapter, BookingCustomerApi } from "./contracts";
import { BookingController } from "./controller";

export type BookingAdapterProps = {
  session: ClientSession | null;
  sessionStatus?: "loading" | "anonymous" | "denied" | "unavailable" | "error";
  api?: BookingCustomerApi;
  consultation?: BookingConsultationAdapter;
};
export function useBooking({ session, api, consultation }: BookingAdapterProps) {
  const controller = useMemo(
    () => new BookingController(api, session, consultation),
    [api, session, consultation],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    controller.start();
    const timer = setInterval(controller.tick, 1000);
    return () => {
      clearInterval(timer);
      controller.invalidate();
    };
  }, [controller]);
  return { controller, state };
}
