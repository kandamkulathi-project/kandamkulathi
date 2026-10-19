import { type Locale, messages } from "@kandamkulathi/i18n";
import { LanguageSelect } from "@kandamkulathi/ui";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <main>
      <header>
        <strong>Kandamkulathi workspaces</strong>
        <LanguageSelect locale={locale} onChange={setLocale} />
      </header>
      <h1>{messages[locale].welcome}</h1>
      <p role="status">{messages[locale].notice}</p>
      <section aria-label="Workspace implementation areas">
        {["Customer", "Staff", "Physician", "Support"].map((area) => (
          <article key={area}>
            <h2>{area}</h2>
            <p>
              Access is unavailable until verified identity and API permissions are implemented.
            </p>
          </article>
        ))}
      </section>
      <p>This starter contains no sign-in bypass, private records or live actions.</p>
    </main>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
