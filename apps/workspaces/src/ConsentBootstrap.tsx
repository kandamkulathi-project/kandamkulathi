import type { Locale } from "@kandamkulathi/i18n";
import { Button, Notice } from "@kandamkulathi/ui";
import { useEffect, useId, useRef, useState } from "react";
import {
  type BootstrapState,
  createConsentBootstrapClient,
} from "../../../packages/client/src/consent-bootstrap";
import { consentBootstrapLabels } from "../../../packages/i18n/src/consent-bootstrap";
import "./consent-bootstrap.css";

/** Root mounts only for denied session state. Rendering alone performs NO request. */
export function ConsentBootstrap({
  locale,
  origin,
  local,
  onVerified,
}: {
  locale: Locale;
  origin: string;
  local: boolean;
  onVerified(): void;
}) {
  const labels = consentBootstrapLabels[locale];
  const [state, setState] = useState<BootstrapState>({ status: "idle" });
  const [accepted, setAccepted] = useState(false);
  const client = useRef<ReturnType<typeof createConsentBootstrapClient> | null>(null);
  const callback = useRef(onVerified);
  callback.current = onVerified;
  const id = useId();
  useEffect(() => {
    setAccepted(false);
    setState({ status: "idle" });
    // Each StrictMode setup owns fresh resources; cleanup never poisons the next setup.
    const current = createConsentBootstrapClient({
      origin,
      local,
      onChange: (next) => {
        setAccepted(false);
        setState(next);
      },
      onVerified: () => callback.current(),
    });
    client.current = current;
    return () => {
      current.dispose();
      if (client.current === current) client.current = null;
    };
  }, [origin, local]);
  const busy = ["loading", "submitting", "verifying"].includes(state.status);
  const ready = state.status === "ready";
  return (
    <section className="consent-bootstrap" aria-labelledby={`${id}-title`} lang={locale}>
      <h2 id={`${id}-title`}>{labels.title}</h2>
      {ready ? (
        <>
          <p>{labels.intro}</p>
          <dl>
            <dt>{labels.version}</dt>
            <dd>{state.bootstrap.requirement.version}</dd>
            <dt>{labels.revision}</dt>
            <dd>{state.bootstrap.policy.revision}</dd>
            <dt>{labels.approval}</dt>
            <dd>{state.bootstrap.policy.approvalReference}</dd>
          </dl>
          <div className="consent-bootstrap-policy">{state.bootstrap.policy.text}</div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (accepted) void client.current?.grant();
            }}
          >
            <label className="consent-bootstrap-choice" htmlFor={`${id}-accept`}>
              <input
                id={`${id}-accept`}
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>{labels.agree}</span>
            </label>
            <Button type="submit" disabled={!accepted}>
              {labels.grant}
            </Button>
            <Button onClick={() => client.current?.cancel()}>{labels.cancel}</Button>
          </form>
        </>
      ) : (
        <>
          <Notice
            error={[
              "unknown",
              "recorded",
              "expired",
              "anonymous",
              "denied",
              "unavailable",
              "error",
            ].includes(state.status)}
          >
            {labels[state.status]}
          </Notice>
          {state.status !== "verified" && (
            <Button
              disabled={busy}
              onClick={() => {
                void client.current?.load();
              }}
            >
              {state.status === "idle" ? labels.review : labels.reload}
            </Button>
          )}
          {state.status === "loading" && (
            <Button onClick={() => client.current?.cancel()}>{labels.cancel}</Button>
          )}
        </>
      )}
    </section>
  );
}
