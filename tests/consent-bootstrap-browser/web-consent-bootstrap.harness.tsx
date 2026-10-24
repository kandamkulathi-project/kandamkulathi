import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConsentBootstrap } from "../../apps/workspaces/src/ConsentBootstrap";
import type { Locale } from "../../packages/i18n/src/index";
import { LanguageSelect } from "../../packages/ui/src/index";
import "../../apps/workspaces/src/styles.css";

function Fixture() {
  const [locale, setLocale] = useState<Locale>("en");
  const [mounted, setMounted] = useState(true);
  const [verified, setVerified] = useState(0);
  return (
    <main>
      <h1>Synthetic consent bootstrap fixture — not a production route</h1>
      <LanguageSelect locale={locale} onChange={setLocale} />
      <button type="button" onClick={() => setMounted(!mounted)}>
        Toggle test mount
      </button>
      <output aria-label="Verified callbacks">{verified}</output>
      {mounted && (
        <ConsentBootstrap
          locale={locale}
          origin={window.location.origin}
          local
          onVerified={() => setVerified((value) => value + 1)}
        />
      )}
    </main>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing test root");
createRoot(root).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
