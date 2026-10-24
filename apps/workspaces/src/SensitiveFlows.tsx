import {
  bookingExpired,
  mayJoin,
  paymentFlow,
  type SensitiveResult,
  sensitiveClient,
} from "@kandamkulathi/client/sensitive";
import type { ClientSession, Workspace } from "@kandamkulathi/contracts/client";
import {
  type Appointment,
  type Consent,
  type IntakeSubmission,
  type Payment,
  referenceSchema,
} from "@kandamkulathi/contracts/sensitive";
import { formatDate, formatMoney, type Locale } from "@kandamkulathi/i18n";
import { sensitiveText } from "@kandamkulathi/i18n/sensitive";
import { Button, Notice } from "@kandamkulathi/ui";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { browserCheckout } from "./checkout";

type Runtime = {
  resume: number;
  client: ReturnType<typeof sensitiveClient>;
  checkout: ReturnType<typeof browserCheckout>;
  flow: ReturnType<typeof paymentFlow>;
};

export function SensitiveFlows({
  session,
  route,
  locale,
  onRevoked,
}: {
  session: ClientSession | null;
  route: Workspace | undefined;
  locale: Locale;
  onRevoked(): void;
}) {
  const text = sensitiveText[locale];
  const [runtime, setRuntime] = useState<Runtime>();
  const [resume, setResume] = useState(0);
  const lifetime = useRef<Runtime | undefined>(undefined);
  const running = useRef(false);
  const [notice, setNotice] = useState<keyof typeof text>("pending");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState<Consent>();
  const [payment, setPayment] = useState<Payment>();
  const [appointment, setAppointment] = useState<Appointment>();
  const [reference, setReference] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [declined, setDeclined] = useState<Record<string, boolean>>({});
  const [clock, setClock] = useState(Date.now());
  const epoch = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const clear = useCallback(() => {
    setConsent(undefined);
    setPayment(undefined);
    setAppointment(undefined);
    setAnswers({});
    setDeclined({});
  }, []);
  useEffect(() => {
    // Every effect setup owns fresh disposable resources, including StrictMode replay.
    const client = sensitiveClient({
      origin: import.meta.env.VITE_CORE_API_ORIGIN ?? "http://127.0.0.1:8787",
      local: import.meta.env.DEV || location.hostname === "127.0.0.1",
      session,
      onRevoked: () => {
        suspend();
        setNotice("anonymous");
        onRevoked();
      },
    });
    const checkout = browserCheckout(import.meta.env.DEV || location.hostname === "127.0.0.1");
    const flow = paymentFlow(client, checkout.open);
    const owned = { client, checkout, flow, resume };
    lifetime.current = owned;
    running.current = false;
    setBusy(false);
    clear();
    setNotice("pending");
    setRuntime(owned);
    const dispose = () => {
      if (lifetime.current !== owned) return;
      lifetime.current = undefined;
      epoch.current++;
      flow.dispose();
      client.dispose();
      checkout.dispose();
    };
    const suspend = () => {
      dispose();
      clear();
      running.current = false;
      setBusy(false);
    };
    const resumeAnonymous = () => {
      // Restart only explicit anonymous actions, never session reads or the logout fence.
      if (session === null && !document.hidden) setResume((value) => value + 1);
    };
    const visibility = () => {
      suspend();
      resumeAnonymous();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", resumeAnonymous);
    return () => {
      dispose();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", resumeAnonymous);
    };
  }, [session, onRevoked, clear, resume]);
  async function run<T>(action: () => Promise<SensitiveResult<T>>, accept: (data: T) => void) {
    if (running.current || !runtime || lifetime.current !== runtime) return;
    running.current = true;
    setBusy(true);
    setNotice("loading");
    const attempt = epoch.current;
    try {
      const result = await action();
      if (attempt !== epoch.current) return;
      if (result.status === "ready") {
        setNotice("current");
        accept(result.data);
      } else {
        clear();
        setNotice(result.status);
      }
    } finally {
      if (attempt === epoch.current) {
        running.current = false;
        setBusy(false);
      }
    }
  }
  const validReference = referenceSchema.safeParse(reference).success;
  const sameRecord = <T extends { id: string }>(data: T, apply: (value: T) => void) => {
    if (data.id !== reference) {
      clear();
      setNotice("error");
      return;
    }
    apply(data);
  };
  const expired = appointment ? bookingExpired(appointment, clock) : false;
  const refreshAppointment = useEffectEvent(() => {
    if (appointment && runtime)
      void run(
        () => runtime.client.appointment(appointment.id),
        (data) => sameRecord(data, setAppointment),
      );
  });
  useEffect(() => {
    if (!appointment || busy) return;
    const timer = setTimeout(refreshAppointment, 15000);
    return () => clearTimeout(timer);
  }, [appointment, busy]);
  if (!runtime) return null;
  const { client, flow } = runtime;
  return (
    <section aria-label={text.title} data-sensitive-state={notice} aria-busy={busy}>
      <h2>{text.title}</h2>
      <Notice error={["error", "denied", "conflict"].includes(notice)}>{text[notice]}</Notice>
      {!session && <Notice>{text.anonymous}</Notice>}
      {!session ? (
        <Button
          disabled={busy}
          onClick={() =>
            void run(
              () => client.signIn(),
              (url) => location.assign(url),
            )
          }
        >
          {text.signIn}
        </Button>
      ) : (
        <>
          <Button
            disabled={busy}
            onClick={() =>
              void run(
                () => client.signOut(),
                () => setNotice("signedOut"),
              )
            }
          >
            {text.signOut}
          </Button>
          {route === "customer" && (
            <section aria-label={text.consent}>
              <h3>{text.consent}</h3>
              <Button
                disabled={busy}
                onClick={() => {
                  clear();
                  void run(client.consents, setConsent);
                }}
              >
                {text.loadConsent}
              </Button>
              {consent && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const {
                      signupText: _signup,
                      privacyText: _privacy,
                      consultationText: _consultation,
                      ...choices
                    } = consent;
                    void run(() => client.saveConsents(choices), setConsent);
                  }}
                >
                  <p>
                    {text.versions}: {consent.signupVersion} / {consent.privacyVersion} /{" "}
                    {consent.consultationVersion}
                  </p>
                  <details>
                    <summary>{text.signupAccepted}</summary>
                    <p>{consent.signupText}</p>
                  </details>
                  <details>
                    <summary>{text.privacyAccepted}</summary>
                    <p>{consent.privacyText}</p>
                  </details>
                  <details>
                    <summary>{text.consultationAccepted}</summary>
                    <p>{consent.consultationText}</p>
                  </details>
                  {(
                    [
                      "signupAccepted",
                      "privacyAccepted",
                      "consultationAccepted",
                      "marketingAccepted",
                    ] as const
                  ).map((key) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        required={key === "signupAccepted" || key === "privacyAccepted"}
                        checked={consent[key]}
                        onChange={(event) =>
                          setConsent({ ...consent, [key]: event.target.checked })
                        }
                      />
                      {text[key]}
                    </label>
                  ))}
                  <Button
                    type="submit"
                    disabled={busy || !consent.signupAccepted || !consent.privacyAccepted}
                  >
                    {text.saveConsent}
                  </Button>
                </form>
              )}
            </section>
          )}
          {route && ["customer", "physician", "staff"].includes(route) && (
            <section>
              <label htmlFor="private-reference">{text.reference}</label>
              <input
                id="private-reference"
                disabled={busy}
                autoComplete="off"
                value={reference}
                maxLength={36}
                onChange={(event) => {
                  setReference(event.target.value);
                  clear();
                }}
              />
              <div className="actions">
                {route === "customer" && (
                  <Button
                    disabled={busy || !validReference}
                    onClick={() => {
                      clear();
                      void run(
                        () => client.payment(reference),
                        (data) => sameRecord(data, setPayment),
                      );
                    }}
                  >
                    {text.loadPayment}
                  </Button>
                )}
                <Button
                  disabled={busy || !validReference}
                  onClick={() => {
                    clear();
                    void run(
                      () => client.appointment(reference),
                      (data) => sameRecord(data, setAppointment),
                    );
                  }}
                >
                  {text.loadAppointment}
                </Button>
              </div>
            </section>
          )}
          {payment && (
            <article aria-label={text.payment}>
              <h3>{text.payment}</h3>
              <p>
                {text.amount}: {formatMoney(payment.amountPaise, locale)}
              </p>
              <p data-payment-state={payment.status}>
                {text[payment.status === "pending" ? "pendingPayment" : payment.status]}
              </p>
              <Button
                disabled={
                  busy ||
                  payment.status !== "requires_payment" ||
                  !payment.checkout ||
                  Date.parse(payment.expiresAt) <= clock
                }
                onClick={() =>
                  void run(
                    () => flow.pay(reference, payment),
                    (data) => sameRecord(data, setPayment),
                  )
                }
              >
                {text.pay}
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(
                    () => client.reconcile(reference),
                    (data) => sameRecord(data, setPayment),
                  )
                }
              >
                {text.reconcile}
              </Button>
              <p>{text.receiptHint}</p>
            </article>
          )}
          {appointment && (
            <article aria-label={text.appointment}>
              <h3>{text.appointment}</h3>
              <p>
                {appointment.doctor} · {appointment.clinic} · {appointment.service}
              </p>
              <p>
                {formatDate(new Date(appointment.startsAt), locale)} ·{" "}
                {new Date(appointment.startsAt).toLocaleTimeString(locale, {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                —{" "}
                {new Date(appointment.endsAt).toLocaleTimeString(locale, {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                (IST)
              </p>
              <p data-booking-state={expired ? "expired" : appointment.status}>
                {text[expired ? "expired" : appointment.status]}
              </p>
              <p>
                {appointment.identityVerified && appointment.consentCurrent
                  ? text.identityReady
                  : text.identityPending}
              </p>
              {appointment.role === "customer" &&
                appointment.identityVerified &&
                appointment.consentCurrent &&
                appointment.intake.physicianApproved &&
                appointment.intake.status === "required" && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const input: IntakeSubmission = {
                        revision: appointment.revision,
                        policyVersion: appointment.intake.policyVersion,
                        answers: appointment.intake.questions.map((q) => ({
                          id: q.id,
                          value: declined[q.id] ? "declined" : answers[q.id]?.trim() || "unknown",
                          disposition: declined[q.id]
                            ? "declined"
                            : answers[q.id]?.trim()
                              ? "answered"
                              : "unknown",
                        })),
                      };
                      void run(
                        () => client.submitIntake(reference, input),
                        (data) => sameRecord(data, setAppointment),
                      );
                      setAnswers({});
                      setDeclined({});
                    }}
                  >
                    <p>{text.intakeHelp}</p>
                    {appointment.intake.questions.map((question) => (
                      <div key={question.id}>
                        <label htmlFor={`intake-${question.id}`}>{question.label}</label>
                        <input
                          id={`intake-${question.id}`}
                          disabled={busy || declined[question.id]}
                          autoComplete="off"
                          maxLength={500}
                          value={answers[question.id] ?? ""}
                          onChange={(event) =>
                            setAnswers({ ...answers, [question.id]: event.target.value })
                          }
                        />
                        <label>
                          <input
                            type="checkbox"
                            checked={declined[question.id] ?? false}
                            disabled={busy}
                            onChange={(event) => {
                              setDeclined({ ...declined, [question.id]: event.target.checked });
                              setAnswers({ ...answers, [question.id]: "" });
                            }}
                          />
                          {text.decline}: {question.label}
                        </label>
                      </div>
                    ))}
                    <Button type="submit" disabled={busy}>
                      {text.submitIntake}
                    </Button>
                  </form>
                )}
              {appointment.intake.status === "handoff" && <Notice>{text.handoff}</Notice>}
              <Button
                disabled={busy}
                onClick={() =>
                  void run(
                    () => client.appointment(reference),
                    (data) => sameRecord(data, setAppointment),
                  )
                }
              >
                {text.refresh}
              </Button>
              <Button
                disabled={!mayJoin(appointment, clock) || busy}
                onClick={() =>
                  void run(
                    () => client.videoGrant(reference, appointment.revision),
                    () => setNotice("transportPending"),
                  )
                }
              >
                {text.checkMembership}
              </Button>
              <p>{text.transportPending}</p>
            </article>
          )}
        </>
      )}
    </section>
  );
}
