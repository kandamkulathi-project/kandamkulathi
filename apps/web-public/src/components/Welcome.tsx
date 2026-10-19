import { type Locale, messages } from "@kandamkulathi/i18n";
import { LanguageSelect } from "@kandamkulathi/ui";
import { useEffect, useState } from "react";
export default function Welcome() {
  const [locale, setLocale] = useState<Locale>("en");
  const text = messages[locale];
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <main>
      <header>
        <span className="brand">K · 1847</span>
        <LanguageSelect locale={locale} onChange={setLocale} />
      </header>
      <section className="hero">
        <p className="eyebrow">TEAM PREVIEW · BASELINE 0</p>
        <h1>{text.title}</h1>
        <p className="lead">{text.welcome}</p>
        <p className="notice" role="status">
          {text.notice}
        </p>
      </section>
      <section className="cards" aria-label="Planned application areas">
        <article>
          <span>01</span>
          <h2>Commerce</h2>
          <p>Catalogue, orders and fulfilment.</p>
          <small>{text.status}</small>
        </article>
        <article>
          <span>02</span>
          <h2>Consultations</h2>
          <p>Appointments and care workspaces.</p>
          <small>{text.status}</small>
        </article>
        <article>
          <span>03</span>
          <h2>Companion</h2>
          <p>Approved knowledge and guided assistance.</p>
          <small>{text.status}</small>
        </article>
      </section>
      <footer>
        Internal development preview · Company content and integrations pending approval.
      </footer>
    </main>
  );
}
