import type { Resource } from "@kandamkulathi/client";
import type { Locale } from "@kandamkulathi/i18n";
import { LanguageSelect } from "@kandamkulathi/ui";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "@kandamkulathi/i18n/fonts.css";
import "../../styles.css";
import { ContentEditor } from "../ContentEditor";
import type { ContentReader } from "../model";
import { approverId, editorId, syntheticRecord } from "./records";

function Fixture() {
  const [locale, setLocale] = useState<Locale>("en");
  const [scenario, setScenario] = useState("draft");
  const [actor, setActor] = useState("editor");
  const [sessionStatus, setSessionStatus] = useState("ready");
  const reader = useMemo<ContentReader>(
    () => async () => {
      if (scenario === "slow") await new Promise((resolve) => setTimeout(resolve, 600));
      if (scenario === "loading") await new Promise((resolve) => setTimeout(resolve, 10000));
      if (scenario === "error") throw new Error("Synthetic private error must not render");
      if (scenario === "denied") return { status: "denied" };
      if (scenario === "pending") return { status: "unavailable" };
      if (scenario === "empty") return { status: "ready", data: null };
      if (scenario === "invalid")
        return { status: "ready", data: { ...syntheticRecord(), unexpected: "private" } };
      return {
        status: "ready",
        data: syntheticRecord(
          scenario === "approved" || scenario === "withdrawn" ? scenario : "draft",
        ),
      };
    },
    [scenario],
  );
  const session: Resource<unknown> =
    sessionStatus === "ready" || sessionStatus === "expired"
      ? {
          status: "ready",
          data: {
            userId: actor.startsWith("editor") ? editorId.toUpperCase() : approverId,
            expiresAt:
              sessionStatus === "expired" ? "2000-10-20T10:00:00Z" : "2099-10-20T10:00:00Z",
            workspaces:
              actor === "editor-no-grants"
                ? []
                : actor === "customer"
                  ? ["customer"]
                  : actor === "physician" || actor === "editor-physician"
                    ? ["physician"]
                    : ["staff"],
          },
        }
      : sessionStatus === "invalid"
        ? { status: "ready", data: { userId: "malformed" } }
        : { status: "anonymous" };
  return (
    <main>
      <h1>Synthetic content presentation fixture</h1>
      <p>No company data, clinical approval or authoring endpoint.</p>
      <LanguageSelect
        locale={locale}
        onChange={(value) => {
          setLocale(value);
          document.documentElement.lang = value;
        }}
      />
      <label>
        Fixture scenario
        <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
          {[
            "draft",
            "approved",
            "withdrawn",
            "empty",
            "invalid",
            "denied",
            "pending",
            "error",
            "slow",
            "loading",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Fixture actor
        <select value={actor} onChange={(event) => setActor(event.target.value)}>
          {["editor", "editor-physician", "editor-no-grants", "physician", "customer"].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </select>
      </label>
      <label>
        Fixture session
        <select value={sessionStatus} onChange={(event) => setSessionStatus(event.target.value)}>
          {["ready", "anonymous", "invalid", "expired"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <ContentEditor locale={locale} session={session} readRecord={reader} />
    </main>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<Fixture />);
