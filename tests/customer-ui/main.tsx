import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { BookingCustomerApi } from "../../apps/workspaces/src/customer/booking/contracts";
import { createBookingRuntimeOptions } from "../../apps/workspaces/src/customer/booking/runtimeOptions";
import {
  CustomerJourneyViews,
  type CustomerSection,
} from "../../apps/workspaces/src/customer/CustomerJourneyViews";
import { CustomerRuntimeViews } from "../../apps/workspaces/src/customer/CustomerRuntimeViews";
import type { CommerceApi, CommerceSession } from "../../apps/workspaces/src/customer/commerce";
import {
  parseCatalogue,
  parsePrivate,
  parseReply,
} from "../../apps/workspaces/src/customer/commerce/contracts";
import { type ClientSession, sessionSchema } from "../../packages/contracts/src/client";
import "../../apps/workspaces/src/styles.css";
import "../../packages/i18n/fonts/fonts.css";

// Only this test-owned application exposes synthetic fixture ports. Production
// entrypoints must supply senior-reviewed adapters instead of importing this file.
async function read(path: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
  const response = await fetch(`/__test/${path}`, {
    signal,
    cache: "no-store",
    redirect: "error",
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status === 401) return { status: "anonymous" };
  if (response.status === 403) return { status: "denied" };
  if (response.status === 409) return { status: "conflict" };
  if (response.status === 503) return { status: "unavailable" };
  if (!response.ok) return { status: "error" };
  return response.json();
}

function Harness() {
  const [section, setSection] = useState<CustomerSection>(
    location.pathname === "/booking" ? "booking" : "commerce",
  );
  useEffect(() => {
    const navigate = () => setSection(location.pathname === "/booking" ? "booking" : "commerce");
    window.addEventListener("popstate", navigate);
    return () => window.removeEventListener("popstate", navigate);
  }, []);
  const [session, setSession] = useState<CommerceSession>({ status: "loading" });
  const [generation, setGeneration] = useState(0);
  const verified: ClientSession | null = session.status === "ready" ? session.session : null;
  useEffect(() => {
    const controller = new AbortController();
    setSession({ status: "loading" });
    void read("session", controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        const result = sessionSchema.safeParse(value);
        if (result.success)
          setSession({ status: "ready", session: result.data, epoch: String(generation) });
        else {
          const status =
            value && typeof value === "object" && "status" in value
              ? ["anonymous", "denied", "unavailable", "error", "conflict"].find(
                  (candidate) => candidate === value.status,
                )
              : undefined;
          if (
            status === "anonymous" ||
            status === "denied" ||
            status === "unavailable" ||
            status === "conflict"
          )
            setSession({ status });
          else setSession({ status: "error" });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setSession({ status: "error" });
      });
    return () => controller.abort();
  }, [generation]);
  const api = useMemo<CommerceApi>(() => {
    const parse = (value: unknown) => parsePrivate(value, verified?.userId ?? "");
    return {
      catalogue: async ({ signal }) =>
        parseReply(await read("commerce/catalogue", signal), parseCatalogue),
      readPrivate: async ({ signal }) => parseReply(await read("commerce/private", signal), parse),
      addItem: async (input, context) =>
        parseReply(
          await read("commerce/add", context.signal, {
            input,
            revision: context.revision,
            operationId: context.operationId,
          }),
          parse,
        ),
      setQuantity: async (input, context) =>
        parseReply(
          await read("commerce/quantity", context.signal, {
            input,
            revision: context.revision,
            operationId: context.operationId,
          }),
          parse,
        ),
      saveAddress: async (input, context) =>
        parseReply(
          await read("commerce/address", context.signal, {
            input,
            revision: context.revision,
            operationId: context.operationId,
          }),
          parse,
        ),
      requestCheckout: async (input, context) =>
        parseReply(
          await read("commerce/checkout", context.signal, {
            input,
            revision: context.revision,
            operationId: context.operationId,
          }),
          parse,
        ),
      reorder: async (input, context) =>
        parseReply(
          await read("commerce/reorder", context.signal, {
            input,
            revision: context.revision,
            operationId: context.operationId,
          }),
          parse,
        ),
    };
  }, [verified]);
  const booking = useMemo<BookingCustomerApi>(
    () => ({
      directory: (signal) => read("booking/directory", signal),
      slots: (input, signal) => read("booking/slots", signal, input),
      appointments: (signal) => read("booking/appointments", signal),
      hold: (input, signal) => read("booking/hold", signal, input),
      read: (input, signal) => read("booking/read", signal, input),
    }),
    [],
  );
  const runtimeTransport = useMemo(
    () => ({
      origin: location.origin,
      authorizeMutation: async () => ({ "X-Test-CSRF": "synthetic-test-only" }),
    }),
    [],
  );
  const bookingRuntime = useMemo(
    () =>
      createBookingRuntimeOptions({
        origin: location.origin,
        local: true,
        transport: (url, init) => fetch(url, init),
      }),
    [],
  );
  return (
    <main>
      <h1>Customer presentation test harness</h1>
      {location.pathname.startsWith("/runtime-") ? (
        <CustomerRuntimeViews
          locale="en"
          section={location.pathname === "/runtime-booking" ? "booking" : "commerce"}
          session={session}
          commerceTransport={runtimeTransport}
          bookingRuntime={bookingRuntime}
          locations={[
            { reference: "00000000-0000-4000-8000-000000000010", title: "Synthetic Clinic" },
          ]}
          onRefreshSession={() => setGeneration((value) => value + 1)}
        />
      ) : (
        <CustomerJourneyViews
          locale="en"
          session={session}
          commerce={api}
          booking={booking}
          section={section}
          onSectionChange={(value) => {
            history.pushState(null, "", `/${value}`);
            setSection(value);
          }}
          onRefreshSession={() => setGeneration((value) => value + 1)}
        />
      )}
    </main>
  );
}

const element = document.getElementById("root");
if (!element) throw Error("Missing test root");
createRoot(element).render(<Harness />);
