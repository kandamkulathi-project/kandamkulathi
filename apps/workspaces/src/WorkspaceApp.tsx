import { workspaceAccess } from "@kandamkulathi/client";
import { type Workspace, workspaceNames } from "@kandamkulathi/contracts/client";
import { foundation, type Locale, messages } from "@kandamkulathi/i18n";
import { Button, DeviceCheck, Field, LanguageSelect, Notice, useSession } from "@kandamkulathi/ui";
import { useEffect, useState } from "react";

export default function App() {
  const [locale, setLocale] = useState<Locale>("en");
  const [draft, setDraft] = useState("");
  const text = foundation[locale];
  const route = workspaceNames.find((value) => location.pathname === `/${value}`);
  const { result, reload } = useSession(
    import.meta.env.VITE_CORE_API_ORIGIN ?? "http://127.0.0.1:8787",
    import.meta.env.DEV || location.hostname === "127.0.0.1",
  );
  const status =
    result.status === "ready" && route && !workspaceAccess(result.data, route)
      ? "denied"
      : result.status;
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
          <a key={value} href={`/${value}`} aria-current={route === value ? "page" : undefined}>
            {text[value]}
          </a>
        ))}
      </nav>
      <main id="content" tabIndex={-1}>
        <p className="eyebrow">{text.preview}</p>
        <h1>{route ? text[route] : text.workspace}</h1>
        <Notice>{messages[locale].notice}</Notice>
        <div aria-busy={status === "loading"} data-session-state={status}>
          <Notice error={status === "error" || status === "denied"}>{text[status]}</Notice>
          <Button onClick={reload} disabled={status === "loading"}>
            {text.retry}
          </Button>
        </div>
        {!route && (
          <section className="cards" aria-label={text.workspace}>
            {workspaceNames.map((value) => (
              <article key={value}>
                <h2>{text[value]}</h2>
                <p>{text.pending}</p>
              </article>
            ))}
          </section>
        )}
        {route && status === "ready" && (
          <section>
            <h2>{text.empty}</h2>
            <p>{text.pending}</p>
          </section>
        )}
        {!route && (
          <>
            <DeviceCheck locale={locale} />
            <section aria-label={text.companion}>
              <h2>{text.companion}</h2>
              <Notice>{text.citationPending}</Notice>
              <Field
                id="message-draft"
                label={text.draft}
                help={text.draftHelp}
                value={draft}
                onChange={setDraft}
              />
              <Button disabled>{text.sendPending}</Button>
            </section>
          </>
        )}
        <footer>{text.footer}</footer>
      </main>
    </>
  );
}
