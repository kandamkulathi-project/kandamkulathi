import { foundation, type Locale, messages } from "@kandamkulathi/i18n";
import { LanguageSelect } from "@kandamkulathi/ui";
import { useEffect, useState } from "react";
export default function Welcome() {
  const [locale, setLocale] = useState<Locale>("en");
  const text = messages[locale];
  const ui = foundation[locale];
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = text.title;
  }, [locale, text.title]);
  return (
    <main>
      <header>
        <span className="brand">K · 1847</span>
        <LanguageSelect locale={locale} onChange={setLocale} />
      </header>
      <section className="hero">
        <p className="eyebrow">{ui.preview}</p>
        <h1>{text.title}</h1>
        <p className="lead">{text.welcome}</p>
        <p className="notice" role="status">
          {text.notice}
        </p>
      </section>
      <section className="cards" aria-label={ui.workspace}>
        <article>
          <span>01</span>
          <h2>{ui.commerce}</h2>
          <p>{ui.commerceDescription}</p>
          <small>{text.status}</small>
        </article>
        <article>
          <span>02</span>
          <h2>{ui.consultations}</h2>
          <p>{ui.consultationDescription}</p>
          <small>{text.status}</small>
        </article>
        <article>
          <span>03</span>
          <h2>{ui.companion}</h2>
          <p>{ui.companionDescription}</p>
          <small>{text.status}</small>
        </article>
      </section>
      <footer>{ui.footer}</footer>
    </main>
  );
}
