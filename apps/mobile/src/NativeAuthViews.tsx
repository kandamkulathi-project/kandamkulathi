import type { Locale } from "@kandamkulathi/i18n";
import { sensitiveText } from "@kandamkulathi/i18n/sensitive";
import { useState, useSyncExternalStore } from "react";
import { Button, Switch, Text, View } from "react-native";
import { consentBootstrapLabels } from "../../../packages/i18n/src/consent-bootstrap";
import type { NativeAuthState, nativeAuthController } from "./nativeAuthController";

export type NativeAuthControlsProps = {
  controller: ReturnType<typeof nativeAuthController>;
  /** Root has completed its saved-session check and has no current private workspace. */
  available: boolean;
  locale: Locale;
  fontFamily?: string;
};

/** Exact approved policy is plain server text, never translated, seeded or inferred from a session denial. */
export function NativeAuthControls({
  controller,
  available,
  locale,
  fontFamily,
}: NativeAuthControlsProps) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const labels = consentBootstrapLabels[locale];
  const common = sensitiveText[locale];
  const [acknowledged, setAcknowledged] = useState<NativeAuthState["policy"]>();
  const [failed, setFailed] = useState(false);
  const run = (action: () => Promise<unknown>) => {
    setFailed(false);
    void action().catch(() => setFailed(true));
  };
  const policy = state.policy;
  const agreed = !!policy && acknowledged === policy;
  const setAgreed = (value: boolean) => setAcknowledged(value ? policy : undefined);
  const status = (value: NativeAuthState["status"]): string => {
    switch (value) {
      case "ready":
        return labels.verified;
      case "consent_required":
        return labels.intro;
      case "rejected":
        return labels.error;
      case "logout_pending":
        return common.unknown;
      case "conflict":
      case "busy":
        return common[value];
      default:
        return labels[value];
    }
  };
  if (!available && state.status !== "logout_pending") return null;
  const busy = state.status === "loading" || state.browserHandoff;
  const pendingPolicy = !!policy || state.status === "consent_required";
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontFamily }}>
        {common.signIn}
      </Text>
      <Text accessibilityLiveRegion="polite" style={{ fontFamily }}>
        {failed ? labels.error : status(state.status)}
      </Text>
      {policy && (
        <>
          <Text accessibilityRole="header" style={{ fontFamily }}>
            {labels.title}
          </Text>
          <Text selectable style={{ fontFamily }}>
            {policy.policy.text}
          </Text>
          <Text style={{ fontFamily }}>
            {labels.revision}: {policy.policy.revision}
          </Text>
          <Text style={{ fontFamily }}>
            {labels.version}: {policy.requirement.version}
          </Text>
          <Text style={{ fontFamily }}>
            {labels.approval}: {policy.policy.approvalReference}
          </Text>
          <Text style={{ fontFamily }}>{labels.agree}</Text>
          <Switch
            accessibilityLabel={labels.agree}
            value={agreed}
            disabled={busy || state.status !== "consent_required"}
            onValueChange={setAgreed}
          />
          <Button
            title={labels.grant}
            accessibilityLabel={labels.grant}
            disabled={!agreed || busy || state.status !== "consent_required"}
            onPress={() => {
              setAgreed(false);
              run(() => controller.decide("granted"));
            }}
          />
        </>
      )}
      {state.status === "logout_pending" ? (
        <Button
          title={common.refresh}
          accessibilityLabel={common.refresh}
          onPress={() => {
            run(controller.retryLogout);
          }}
        />
      ) : pendingPolicy ? (
        <Button
          title={labels.reload}
          accessibilityLabel={labels.reload}
          disabled={busy}
          onPress={() => {
            run(controller.checkConsent);
          }}
        />
      ) : (
        <Button
          title={common.signIn}
          accessibilityLabel={common.signIn}
          disabled={!available || busy}
          onPress={() => {
            run(controller.start);
          }}
        />
      )}
      {(pendingPolicy || busy) && (
        <Button
          title={labels.cancel}
          accessibilityLabel={labels.cancel}
          onPress={() => {
            setAgreed(false);
            run(controller.cancel);
          }}
        />
      )}
    </View>
  );
}
