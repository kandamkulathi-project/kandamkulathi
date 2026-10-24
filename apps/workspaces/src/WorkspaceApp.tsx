import { workspaceAccess } from "@kandamkulathi/client";
import { sensitiveClient } from "@kandamkulathi/client/sensitive";
import { type Workspace, workspaceNames } from "@kandamkulathi/contracts/client";
import { foundation, type Locale, messages } from "@kandamkulathi/i18n";
import {
  Button,
  CompanionShell,
  DeviceCheck,
  LanguageSelect,
  Notice,
  useSession,
} from "@kandamkulathi/ui";
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import { staffContent } from "../../../packages/i18n/src/staff-content";
import { staffReadLabels } from "../../../packages/i18n/src/staff-read";
import { createWorkspaceBrowserTransport } from "./browserTransport";
import { StaffCommerceWorkspace, useCommerceClinics } from "./CommerceDirectory";
import { ConsentBootstrap } from "./ConsentBootstrap";
import { ContentWorkspace } from "./content/ContentWorkspace";
import { createBookingRuntimeOptions } from "./customer/booking";
import { CustomerRuntimeViews } from "./customer/CustomerRuntimeViews";
import { workspaceRoute } from "./routing";
import { SensitiveFlows } from "./SensitiveFlows";

const origin = import.meta.env.VITE_CORE_API_ORIGIN ?? "http://127.0.0.1:8787";
const local = import.meta.env.DEV || location.hostname === "127.0.0.1";

/** Keyed by the verified session epoch so hidden-directory fences cannot survive revalidation. */
function IntegratedCustomerRuntime({
  browserTransport,
  ...props
}: ComponentProps<typeof CustomerRuntimeViews> & { browserTransport?: typeof fetch }) {
  const directory = useCommerceClinics({
    origin,
    local,
    staff: false,
    enabled: props.section === "commerce" && props.session.status === "ready",
    ...(browserTransport ? { transport: browserTransport } : {}),
  });
  return (
    <>
      {props.section === "commerce" && directory.result.status !== "ready" && (
        <section data-commerce-directory-state={directory.result.status}>
          <Notice
            error={directory.result.status === "error" || directory.result.status === "denied"}
          >
            {foundation[props.locale][directory.result.status]}
          </Notice>
          <Button onClick={directory.reload} disabled={directory.result.status === "loading"}>
            {foundation[props.locale].retry}
          </Button>
        </section>
      )}
      <CustomerRuntimeViews {...props} locations={directory.locations} />
    </>
  );
}

export default function App() {
  const [locale, setLocale] = useState<Locale>("en");
  const [draft, setDraft] = useState("");
  const text = foundation[locale];
  const route = workspaceRoute(location.pathname);
  const workspace = "workspace" in route ? route.workspace : undefined;
  const { result, reload, invalidate } = useSession(origin, local);
  const [browserSnapshot, setBrowserSnapshot] = useState<{
    owner: typeof result;
    browser: ReturnType<typeof createWorkspaceBrowserTransport>;
  }>();
  const browser = browserSnapshot?.owner === result ? browserSnapshot.browser : undefined;
  useEffect(() => {
    if (result.status !== "ready") return;
    let current: ReturnType<typeof createWorkspaceBrowserTransport>;
    try {
      current = createWorkspaceBrowserTransport({
        origin,
        local,
        session: result.data,
        active: () => !document.hidden,
        onRevoked: invalidate,
      });
    } catch {
      return;
    }
    setBrowserSnapshot({ owner: result, browser: current });
    const suspend = () => current.dispose();
    const visibility = () => {
      if (document.hidden) suspend();
    };
    window.addEventListener("pagehide", suspend);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      suspend();
      window.removeEventListener("pagehide", suspend);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [result, invalidate]);
  const reloadCurrent = useCallback(() => {
    browser?.dispose();
    reload();
  }, [browser, reload]);
  const invalidateCurrent = useCallback(() => {
    browser?.dispose();
    invalidate();
  }, [browser, invalidate]);
  const commerceTransport = useMemo(
    () => ({
      origin,
      ...(browser
        ? {
            fetch: browser.transport,
            authorizeMutation: browser.authorizeMutation,
          }
        : {}),
    }),
    [browser],
  );
  const bookingRuntime = useMemo(
    () =>
      browser
        ? createBookingRuntimeOptions({ origin, local, transport: browser.transport })
        : undefined,
    [browser],
  );
  const status =
    route.kind === "not-found"
      ? "unavailable"
      : result.status === "ready" && workspace && !workspaceAccess(result.data, workspace)
        ? "denied"
        : result.status;
  const sessionEpoch = useMemo(
    () => (result.status === "ready" ? crypto.randomUUID() : result.status),
    [result],
  );
  const [companionSnapshot, setCompanionSnapshot] = useState<{
    owner: typeof result;
    revoke: typeof invalidateCurrent;
    client: ReturnType<typeof sensitiveClient>;
  }>();
  const companion =
    companionSnapshot?.owner === result && companionSnapshot.revoke === invalidateCurrent
      ? companionSnapshot.client
      : undefined;
  useEffect(() => {
    if (result.status !== "ready") return;
    const client = sensitiveClient({
      origin: import.meta.env.VITE_COMPANION_API_ORIGIN ?? "http://127.0.0.1:8788",
      local,
      session: result.data,
      onRevoked: invalidateCurrent,
    });
    setCompanionSnapshot({ owner: result, revoke: invalidateCurrent, client });
    return () => client.dispose();
  }, [result, invalidateCurrent]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = text.workspace;
  }, [locale, text.workspace]);
  useEffect(() => {
    if (result.status !== "ready") setDraft("");
  }, [result]);
  const visible: readonly Workspace[] =
    result.status === "ready" ? result.data.workspaces : workspaceNames;
  return (
    <>
      <a className="skip" href="#content">
        {text.skip}
      </a>
      <header>
        <strong>{messages[locale].title}</strong>
        <LanguageSelect locale={locale} onChange={setLocale} />
      </header>
      <nav aria-label={text.workspace}>
        <a href="/">{text.home}</a>
        {visible.map((value) => (
          <a key={value} href={`/${value}`} aria-current={workspace === value ? "page" : undefined}>
            {text[value]}
          </a>
        ))}
      </nav>
      <main id="content" tabIndex={-1}>
        <p className="eyebrow">{text.preview}</p>
        <h1>{workspace ? text[workspace] : text.workspace}</h1>
        <Notice>{messages[locale].notice}</Notice>
        <div aria-busy={status === "loading"} data-session-state={status}>
          <Notice error={status === "error" || status === "denied"}>{text[status]}</Notice>
          <Button onClick={reloadCurrent} disabled={status === "loading"}>
            {text.retry}
          </Button>
        </div>
        {result.status === "denied" && route.kind !== "not-found" && (
          <ConsentBootstrap
            locale={locale}
            origin={origin}
            local={local}
            onVerified={reloadCurrent}
          />
        )}
        {route.kind === "home" && (
          <section className="cards" aria-label={text.workspace}>
            {workspaceNames.map((value) => (
              <article key={value}>
                <h2>{text[value]}</h2>
                <p>{text.pending}</p>
              </article>
            ))}
          </section>
        )}
        {route.kind === "customer" && status === "ready" && result.status === "ready" && (
          <>
            <nav aria-label={text.customer}>
              <a
                href="/customer/shop"
                aria-current={route.section === "commerce" ? "page" : undefined}
              >
                {text.commerce}
              </a>
              <a
                href="/customer/appointments"
                aria-current={route.section === "booking" ? "page" : undefined}
              >
                {text.consultations}
              </a>
            </nav>
            <IntegratedCustomerRuntime
              key={sessionEpoch}
              locale={locale}
              section={route.section}
              session={{ status: "ready", session: result.data, epoch: sessionEpoch }}
              commerceTransport={commerceTransport}
              {...(browser ? { browserTransport: browser.transport } : {})}
              {...(bookingRuntime ? { bookingRuntime } : {})}
              onRefreshSession={reloadCurrent}
            />
          </>
        )}
        {route.kind === "staff" && status === "ready" && (
          <>
            <nav aria-label={text.staff}>
              <a href="/staff" aria-current={route.section === "reads" ? "page" : undefined}>
                {staffReadLabels[locale].records}
              </a>
              <a
                href="/staff/knowledge"
                aria-current={route.section === "knowledge" ? "page" : undefined}
              >
                {staffContent[locale].heading}
              </a>
            </nav>
            {route.section === "knowledge" && result.status === "ready" ? (
              <ContentWorkspace
                key={sessionEpoch}
                locale={locale}
                session={result.data}
                coreOrigin={origin}
                companionOrigin={
                  import.meta.env.VITE_COMPANION_API_ORIGIN ?? "http://127.0.0.1:8788"
                }
                local={local}
                {...(browser ? { transport: browser.transport } : {})}
              />
            ) : (
              <StaffCommerceWorkspace
                key={sessionEpoch}
                origin={origin}
                local={local}
                {...(browser ? { transport: browser.transport } : {})}
                locale={locale}
                session={result}
              />
            )}
          </>
        )}
        {route.kind === "workspace" && status === "ready" && (
          <section>
            <h2>{text.empty}</h2>
            <p>{text.pending}</p>
            {route.workspace === "physician" && (
              <a href="/physician/knowledge">{staffContent[locale].heading}</a>
            )}
          </section>
        )}
        {route.kind === "knowledge" && status === "ready" && result.status === "ready" && (
          <ContentWorkspace
            key={`knowledge:${sessionEpoch}`}
            locale={locale}
            session={result.data}
            coreOrigin={origin}
            companionOrigin={import.meta.env.VITE_COMPANION_API_ORIGIN ?? "http://127.0.0.1:8788"}
            local={local}
            {...(browser ? { transport: browser.transport } : {})}
          />
        )}
        {(status === "ready" || status === "anonymous") && route.kind !== "not-found" && (
          <SensitiveFlows
            key={`sensitive:${sessionEpoch}`}
            session={result.status === "ready" ? result.data : null}
            route={workspace}
            locale={locale}
            onRevoked={invalidateCurrent}
          />
        )}
        {route.kind === "home" && (
          <>
            <DeviceCheck locale={locale} />
            <CompanionShell
              key={`${sessionEpoch}:${locale}`}
              client={companion}
              locale={locale}
              draft={draft}
              onDraft={setDraft}
            />
          </>
        )}
        <footer>{text.footer}</footer>
      </main>
    </>
  );
}
