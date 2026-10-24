import { loadSession, type Resource } from "@kandamkulathi/client";
import { nativeApiTransport } from "@kandamkulathi/client/knowledge";
import {
  bookingExpired,
  mayJoin,
  paymentFlow,
  type SensitiveResult,
  sensitiveClient,
} from "@kandamkulathi/client/sensitive";
import type { ClientSession } from "@kandamkulathi/contracts/client";
import type { Appointment, Consent, Payment } from "@kandamkulathi/contracts/sensitive";
import { referenceSchema } from "@kandamkulathi/contracts/sensitive";
import { formatDate, formatMoney, type Locale } from "@kandamkulathi/i18n";
import { sensitiveText } from "@kandamkulathi/i18n/sensitive";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AppState,
  Button,
  Text as NativeText,
  Switch,
  TextInput,
  type TextProps,
  View,
} from "react-native";
import { nativeCheckout } from "./checkout";
import {
  CustomerNativeViews,
  createNativeCustomerRuntime,
  NativeCommerceRuntimeViews,
  nativeCustomerApiTransport,
} from "./customer";
import { nativeCommerceRecoveryBroker, nativeCredentialLifetime } from "./customer/recovery";
import { NativeAuthControls } from "./NativeAuthViews";
import { NativeCompanion } from "./NativeCompanion";
import { createNativeAuthRuntime } from "./nativeAuthRuntime";
import { nativeSessionLifecycle } from "./sessionLifecycle";

const Font = createContext<string | undefined>(undefined);
function Text(props: TextProps) {
  const fontFamily = useContext(Font);
  return <NativeText {...props} style={[{ fontFamily }, props.style]} />;
}
export function NativeSensitiveFlows({
  locale,
  fontFamily,
}: {
  locale: Locale;
  fontFamily?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [lifecycle] = useState(nativeSessionLifecycle);
  const [recovery] = useState(nativeCommerceRecoveryBroker);
  const [auth, setAuth] = useState<ReturnType<typeof createNativeAuthRuntime>>();
  const [authority, setAuthority] = useState<Resource<ClientSession>["status"]>("loading");
  const [authError, setAuthError] = useState(false);
  const onAuthority = useCallback(
    (status: Resource<ClientSession>["status"]) => setAuthority(status),
    [],
  );
  useEffect(() => () => recovery.clear(), [recovery]);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  const retry = useCallback(() => {
    if (!lifecycle.isBlocked()) recovery.capture();
    lifecycle.retry();
    refresh();
  }, [lifecycle, refresh, recovery]);
  useEffect(() => {
    const runtime = createNativeAuthRuntime(retry);
    setAuth(runtime);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void runtime.background().catch(() => setAuthError(true));
    });
    return () => {
      subscription.remove();
      void runtime.dispose().catch(() => setAuthError(true));
    };
  }, [retry]);
  return (
    <Font.Provider value={fontFamily}>
      {authError && <Text accessibilityLiveRegion="polite">{sensitiveText[locale].error}</Text>}
      {auth && (
        <NativeAuthControls
          key="native-auth-controls"
          controller={auth.controller}
          available={authority !== "ready" && authority !== "loading"}
          locale={locale}
          fontFamily={fontFamily}
        />
      )}
      {auth && (
        <NativeSessionControls
          key={`native-private-session-${attempt}`}
          auth={auth}
          onAuthority={onAuthority}
          locale={locale}
          refresh={refresh}
          retry={retry}
          lifecycle={lifecycle}
          recovery={recovery}
        />
      )}
    </Font.Provider>
  );
}
function NativeSessionControls({
  auth,
  onAuthority,
  locale,
  refresh,
  retry,
  lifecycle,
  recovery,
}: {
  auth: ReturnType<typeof createNativeAuthRuntime>;
  onAuthority(status: Resource<ClientSession>["status"]): void;
  locale: Locale;
  refresh(): void;
  retry(): void;
  lifecycle: ReturnType<typeof nativeSessionLifecycle>;
  recovery: ReturnType<typeof nativeCommerceRecoveryBroker>;
}) {
  const text = sensitiveText[locale];
  useSyncExternalStore(
    auth.controller.subscribe,
    auth.controller.getSnapshot,
    auth.controller.getSnapshot,
  );
  const fontFamily = useContext(Font);
  const [session, setSession] = useState<Resource<ClientSession>>({ status: "loading" });
  useEffect(() => {
    onAuthority(session.status);
  }, [session.status, onAuthority]);
  const [notice, setNotice] = useState<keyof typeof text>("pending");
  const [consent, setConsent] = useState<Consent>();
  const [payment, setPayment] = useState<Payment>();
  const [appointment, setAppointment] = useState<Appointment>();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [declined, setDeclined] = useState<Record<string, boolean>>({});
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const generation = useRef(0);
  const [runtime, setRuntime] = useState<{
    client: ReturnType<typeof sensitiveClient>;
    flow: ReturnType<typeof paymentFlow>;
    companion: ReturnType<typeof sensitiveClient>;
    customer: ReturnType<typeof createNativeCustomerRuntime>;
    credentialHash: string;
    signOut(): Promise<void>;
  }>();
  useEffect(() => {
    let active = true;
    let epoch = 0;
    const isCurrent = lifecycle.begin();
    const controller = new AbortController();
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let client: ReturnType<typeof sensitiveClient> | undefined;
    let companion: ReturnType<typeof sensitiveClient> | undefined;
    let customer: ReturnType<typeof createNativeCustomerRuntime> | undefined;
    let flow: ReturnType<typeof paymentFlow> | undefined;
    const rawEnvironment: string = Constants.expoConfig?.extra?.environment ?? "local";
    const environment =
      rawEnvironment === "dev" || rawEnvironment === "staging" || rawEnvironment === "production"
        ? rawEnvironment
        : "local";
    const origin: string = Constants.expoConfig?.extra?.coreApiOrigin ?? "http://127.0.0.1:8787";
    const vault = auth.vault;
    const credentialLifetime = nativeCredentialLifetime(vault.read, () => invalidate());
    const readCredential = credentialLifetime.read;
    const checkout = nativeCheckout(environment !== "production");
    // Only the approved API gets the secure-store bearer. No token is added to provider requests.
    const live = () => active && !controller.signal.aborted;
    const transport = nativeApiTransport(origin, environment === "local", readCredential, live);
    const clear = () => {
      setConsent(undefined);
      setPayment(undefined);
      setAppointment(undefined);
      setAnswers({});
      setDeclined({});
      setReference("");
      setRuntime(undefined);
      setBusy(false);
    };
    const invalidate = () => {
      if (!active) return;
      lifecycle.block();
      recovery.clear();
      credentialLifetime.clear();
      generation.current++;
      epoch++;
      controller.abort();
      clearTimeout(expiry);
      clearTimeout(timeout);
      client?.dispose();
      companion?.dispose();
      customer?.dispose();
      flow?.dispose();
      checkout.dispose();
      clear();
      setSession({ status: "anonymous" });
      setNotice("anonymous");
      // Revocation/logout also clears the OS credential store. Ordinary backgrounding does not log out.
      void vault.clear().catch(() => {
        if (active) setNotice("error");
      });
    };
    const timeout = setTimeout(() => {
      controller.abort();
      if (active && isCurrent()) setSession({ status: "error" });
    }, 5000);
    setSession({ status: lifecycle.isBlocked() ? "anonymous" : "loading" });
    clear();
    if (auth.pending()) {
      clearTimeout(timeout);
      setSession({ status: "anonymous" });
    }
    if (!auth.pending() && !lifecycle.isBlocked() && AppState.currentState === "active")
      void loadSession(origin, environment === "local", controller.signal, transport).then(
        async (result) => {
          if (!active || !isCurrent() || controller.signal.aborted || epoch !== 0) return;
          clearTimeout(timeout);
          setSession(result);
          if (result.status !== "ready") {
            if (result.status === "anonymous") invalidate();
            return;
          }
          let credentialHash: string;
          try {
            credentialHash = await credentialLifetime.hash((credential) =>
              Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, credential),
            );
          } catch {
            invalidate();
            return;
          }
          if (!active || !isCurrent() || controller.signal.aborted || epoch !== 0) return;
          if (Date.parse(result.data.expiresAt) <= Date.now()) {
            invalidate();
            return;
          }
          client = sensitiveClient({
            origin,
            local: environment === "local",
            session: result.data,
            transport,
            uuid: Crypto.randomUUID,
            onRevoked: invalidate,
          });
          flow = paymentFlow(client, checkout.open);
          const companionOrigin: string =
            Constants.expoConfig?.extra?.companionApiOrigin ?? "http://127.0.0.1:8788";
          companion = sensitiveClient({
            origin: companionOrigin,
            local: environment === "local",
            session: result.data,
            transport: nativeApiTransport(
              companionOrigin,
              environment === "local",
              readCredential,
              live,
            ),
            uuid: Crypto.randomUUID,
            onRevoked: invalidate,
          });
          const currentFlow = flow;
          customer = createNativeCustomerRuntime({
            origin,
            local: environment === "local",
            locale,
            session: result.data,
            transport: nativeCustomerApiTransport(
              origin,
              environment === "local",
              readCredential,
              live,
            ),
            active: () => live() && !lifecycle.isBlocked(),
            onRevoked: invalidate,
            uuid: Crypto.randomUUID,
            openCheckout: checkout.open,
          });
          setRuntime({
            client,
            flow,
            companion,
            customer,
            credentialHash,
            async signOut() {
              if (!active || lifecycle.isBlocked()) return;
              // Capture the actual native bearer before any sign-in disposal can clear the vault.
              const revocation = auth.controller.logout();
              lifecycle.block();
              recovery.clear();
              credentialLifetime.clear();
              generation.current++;
              epoch++;
              controller.abort();
              clearTimeout(expiry);
              client?.dispose();
              currentFlow.dispose();
              companion?.dispose();
              customer?.dispose();
              checkout.dispose();
              clear();
              setLoggingOut(true);
              setSession({ status: "anonymous" });
              setNotice("anonymous");
              try {
                await revocation;
              } catch {
                if (active) setNotice("error");
              } finally {
                if (active) setLoggingOut(false);
              }
            },
          });
          expiry = setTimeout(
            invalidate,
            Math.min(2147483647, Date.parse(result.data.expiresAt) - Date.now()),
          );
        },
      );
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") recovery.capture();
      lifecycle.suspend();
      generation.current++;
      epoch++;
      controller.abort();
      client?.dispose();
      companion?.dispose();
      customer?.dispose();
      flow?.dispose();
      checkout.dispose();
      clear();
      clearTimeout(expiry);
      clearTimeout(timeout);
      setSession({ status: lifecycle.isBlocked() || auth.pending() ? "anonymous" : "loading" });
      if (state === "active" && !auth.pending()) lifecycle.resume(refresh);
    });
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      // A locale/revalidation remount may carry only an already-confirmed exact command.
      // Explicit logout/revocation clears the broker first, so this cannot resurrect it.
      recovery.capture();
      credentialLifetime.clear();
      generation.current++;
      active = false;
      controller.abort();
      client?.dispose();
      companion?.dispose();
      customer?.dispose();
      flow?.dispose();
      checkout.dispose();
      clearTimeout(expiry);
      clearTimeout(timeout);
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh, lifecycle, locale, recovery, auth]);
  async function run<T>(action: () => Promise<SensitiveResult<T>>, accept: (value: T) => void) {
    if (busy || !runtime || lifecycle.isBlocked() || AppState.currentState !== "active") return;
    const current = generation.current;
    setBusy(true);
    setNotice("loading");
    const result = await action();
    if (current !== generation.current || AppState.currentState !== "active") return;
    // The shared client fences stale results; no background response may repopulate a private view.
    setBusy(false);
    if (result.status === "ready") {
      setNotice("current");
      accept(result.data);
    } else {
      setConsent(undefined);
      setPayment(undefined);
      setAppointment(undefined);
      setAnswers({});
      setDeclined({});
      setNotice(result.status);
    }
  }
  const setRecord = <T extends { id: string }>(value: T, apply: (value: T) => void) => {
    if (value.id === reference) apply(value);
    else {
      setPayment(undefined);
      setAppointment(undefined);
      setNotice("error");
    }
  };
  const validReference = referenceSchema.safeParse(reference).success;
  const refreshAppointment = useEffectEvent(() => {
    if (appointment && runtime)
      void run(
        () => runtime.client.appointment(appointment.id),
        (data) => setRecord(data, setAppointment),
      );
  });
  useEffect(() => {
    if (!appointment || !runtime || busy) return;
    const timer = setTimeout(refreshAppointment, 15000);
    return () => clearTimeout(timer);
  }, [appointment, busy, runtime]);
  return (
    <View style={{ gap: 16 }}>
      <Text accessibilityRole="header">{text.title}</Text>
      <Text accessibilityLiveRegion="polite">{text[notice]}</Text>
      <Button title={text.refresh} disabled={loggingOut || auth.pending()} onPress={retry} />
      {session.status !== "ready" && <Text>{text[session.status]}</Text>}
      {session.status === "ready" && runtime && (
        <>
          <Button title={text.signOut} disabled={busy} onPress={() => void runtime.signOut()} />
          {session.data.workspaces.includes("customer") && (
            <>
              <CustomerNativeViews
                locale={locale}
                fontFamily={fontFamily}
                session={session.data}
                api={runtime.customer.api}
                commerce={runtime.customer.commerce}
                showCommerce={false}
              />
              <NativeCommerceRuntimeViews
                api={runtime.customer.commerceApi}
                hardware={runtime.customer.hardware}
                loadLocations={runtime.customer.loadLocations}
                session={session.data}
                credentialHash={runtime.credentialHash}
                recovery={recovery}
                active={runtime.customer.active}
                uuid={Crypto.randomUUID}
                locale={locale}
                fontFamily={fontFamily}
                onRefreshSession={retry}
              />
              <Button
                title={text.loadConsent}
                disabled={busy}
                onPress={() => void run(runtime.client.consents, setConsent)}
              />
              {consent && (
                <View style={{ gap: 16 }}>
                  <Text>
                    {text.versions}: {consent.signupVersion} / {consent.privacyVersion} /{" "}
                    {consent.consultationVersion}
                  </Text>
                  <Text>{consent.signupText}</Text>
                  <Text>{consent.privacyText}</Text>
                  <Text>{consent.consultationText}</Text>
                  {(
                    [
                      "signupAccepted",
                      "privacyAccepted",
                      "consultationAccepted",
                      "marketingAccepted",
                    ] as const
                  ).map((key) => (
                    <View key={key}>
                      <Text>{text[key]}</Text>
                      <Switch
                        accessibilityLabel={text[key]}
                        value={consent[key]}
                        onValueChange={(value) => setConsent({ ...consent, [key]: value })}
                      />
                    </View>
                  ))}
                  <Button
                    title={text.saveConsent}
                    disabled={busy || !consent.signupAccepted || !consent.privacyAccepted}
                    onPress={() => {
                      const {
                        signupText: _signup,
                        privacyText: _privacy,
                        consultationText: _consultation,
                        ...choices
                      } = consent;
                      void run(() => runtime.client.saveConsents(choices), setConsent);
                    }}
                  />
                </View>
              )}
            </>
          )}
          <Text>{text.reference}</Text>
          <TextInput
            accessibilityLabel={text.reference}
            editable={!busy}
            style={{ borderWidth: 1, minHeight: 48, padding: 12, fontFamily }}
            value={reference}
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={36}
            onChangeText={(value) => {
              setReference(value);
              setPayment(undefined);
              setAppointment(undefined);
              setAnswers({});
              setDeclined({});
            }}
          />
          {session.data.workspaces.includes("customer") && (
            <Button
              title={text.loadPayment}
              disabled={busy || !validReference}
              onPress={() =>
                void run(
                  () => runtime.client.payment(reference),
                  (data) => setRecord(data, setPayment),
                )
              }
            />
          )}
          <Button
            title={text.loadAppointment}
            disabled={busy || !validReference}
            onPress={() =>
              void run(
                () => runtime.client.appointment(reference),
                (data) => setRecord(data, setAppointment),
              )
            }
          />
          {payment && (
            <View style={{ gap: 16 }}>
              <Text>
                {text.amount}: {formatMoney(payment.amountPaise, locale)}
              </Text>
              <Text>{text[payment.status === "pending" ? "pendingPayment" : payment.status]}</Text>
              <Button
                title={text.pay}
                disabled={
                  busy ||
                  payment.status !== "requires_payment" ||
                  !payment.checkout ||
                  Date.parse(payment.expiresAt) <= clock
                }
                onPress={() =>
                  void run(
                    () => runtime.flow.pay(reference, payment),
                    (data) => setRecord(data, setPayment),
                  )
                }
              />
              <Button
                title={text.reconcile}
                disabled={busy}
                onPress={() =>
                  void run(
                    () => runtime.client.reconcile(reference),
                    (data) => setRecord(data, setPayment),
                  )
                }
              />
              <Text>{text.receiptHint}</Text>
            </View>
          )}
          {appointment && (
            <View style={{ gap: 16 }}>
              <Text>
                {appointment.doctor} · {appointment.clinic} · {appointment.service}
              </Text>
              <Text>
                {formatDate(new Date(appointment.startsAt), locale)} ·{" "}
                {new Date(appointment.startsAt).toLocaleTimeString(locale, {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                (IST)
              </Text>
              <Text>
                {text[bookingExpired(appointment, clock) ? "expired" : appointment.status]}
              </Text>
              <Text>
                {appointment.identityVerified && appointment.consentCurrent
                  ? text.identityReady
                  : text.identityPending}
              </Text>
              <Text>
                {appointment.intake.status === "handoff" ? text.handoff : text.intakeHelp}
              </Text>
              {appointment.role === "customer" &&
                appointment.identityVerified &&
                appointment.consentCurrent &&
                appointment.intake.physicianApproved &&
                appointment.intake.status === "required" && (
                  <View style={{ gap: 16 }}>
                    {appointment.intake.questions.map((question) => (
                      <View key={question.id}>
                        <Text>{question.label}</Text>
                        <TextInput
                          style={{ minHeight: 48, padding: 12, borderWidth: 1, fontFamily }}
                          accessibilityLabel={question.label}
                          autoComplete="off"
                          autoCorrect={false}
                          maxLength={500}
                          editable={!busy && !declined[question.id]}
                          value={answers[question.id] ?? ""}
                          onChangeText={(value) => setAnswers({ ...answers, [question.id]: value })}
                        />
                        <Text>{text.decline}</Text>
                        <Switch
                          accessibilityLabel={`${text.decline}: ${question.label}`}
                          disabled={busy}
                          value={declined[question.id] ?? false}
                          onValueChange={(value) => {
                            setDeclined({ ...declined, [question.id]: value });
                            setAnswers({ ...answers, [question.id]: "" });
                          }}
                        />
                      </View>
                    ))}
                    <Button
                      title={text.submitIntake}
                      disabled={busy}
                      onPress={() => {
                        const input = {
                          revision: appointment.revision,
                          policyVersion: appointment.intake.policyVersion,
                          answers: appointment.intake.questions.map((q) => ({
                            id: q.id,
                            value: declined[q.id] ? "declined" : answers[q.id]?.trim() || "unknown",
                            disposition: declined[q.id]
                              ? ("declined" as const)
                              : answers[q.id]?.trim()
                                ? ("answered" as const)
                                : ("unknown" as const),
                          })),
                        };
                        setAnswers({});
                        setDeclined({});
                        void run(
                          () => runtime.client.submitIntake(reference, input),
                          (data) => setRecord(data, setAppointment),
                        );
                      }}
                    />
                  </View>
                )}
              <Button
                title={text.checkMembership}
                disabled={busy || !mayJoin(appointment, clock)}
                onPress={() =>
                  void run(
                    () => runtime.client.videoGrant(reference, appointment.revision),
                    () => setNotice("transportPending"),
                  )
                }
              />
              <Text>{text.transportPending}</Text>
            </View>
          )}
        </>
      )}
      <NativeCompanion
        key={`${session.status === "ready" ? session.data.userId + session.data.expiresAt : session.status}:${locale}`}
        client={runtime?.companion}
        locale={locale}
        fontFamily={fontFamily}
      />
    </View>
  );
}
