import type { ClientSession } from "@kandamkulathi/contracts/client";
import { foundation, type Locale } from "@kandamkulathi/i18n";
import { useEffect, useState } from "react";
import { Button, Text, View } from "react-native";
import type { Reply } from "../../../workspaces/src/customer/commerce/contracts";
import {
  type CommerceLocation,
  type NativeCommerceCommands,
  NativeCommerceController,
} from "./commerceController";
import type { NativeCommerceHardware } from "./commerceHardware";
import { NativeCommerceCustomerViews } from "./NativeCommerceCustomerViews";
import type { nativeCommerceRecoveryBroker } from "./recovery";

type Props = {
  api: NativeCommerceCommands;
  hardware?: NativeCommerceHardware;
  loadLocations(signal: AbortSignal): Promise<Reply<CommerceLocation[]>>;
  session: ClientSession;
  credentialHash: string;
  recovery: ReturnType<typeof nativeCommerceRecoveryBroker>;
  active(): boolean;
  uuid(): string;
  locale: Locale;
  fontFamily?: string;
  onRefreshSession(): void;
};
type State = {
  api: NativeCommerceCommands;
  hardware?: NativeCommerceHardware;
  session: ClientSession;
  credentialHash: string;
  attempt: number;
} & (
  | { status: "loading" | "anonymous" | "denied" | "unavailable" | "error" | "empty" }
  | {
      status: "ready";
      controller: NativeCommerceController;
      locations: CommerceLocation[];
    }
);

/** Directory and controller lifetime composition only; all commerce rules remain canonical/server-owned. */
export function NativeCommerceRuntimeViews(props: Props) {
  const {
    api,
    hardware,
    loadLocations,
    session,
    credentialHash,
    recovery,
    active,
    uuid,
    locale,
    fontFamily,
    onRefreshSession,
  } = props;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({
    api,
    hardware,
    session,
    credentialHash,
    attempt,
    status: "loading",
  });
  useEffect(() => {
    let mounted = true;
    let controller: NativeCommerceController | undefined;
    const abort = new AbortController();
    const scope = { api, hardware, session, credentialHash, attempt };
    const timeout = setTimeout(() => {
      abort.abort();
      if (mounted) setState({ ...scope, status: "error" });
    }, 5000);
    setState({ ...scope, status: "loading" });
    void loadLocations(abort.signal)
      .then((result) => {
        if (!mounted || abort.signal.aborted || !active()) return;
        clearTimeout(timeout);
        if (result.status !== "ready") {
          setState({ ...scope, status: result.status === "conflict" ? "error" : result.status });
          return;
        }
        if (!result.data.length) {
          setState({ ...scope, status: "empty" });
          return;
        }
        controller = new NativeCommerceController({
          api,
          hardware,
          locations: result.data,
          session: () => session,
          active,
          uuid,
          recovery: recovery.take(session, credentialHash),
        });
        recovery.attach(controller, session, credentialHash);
        setState({ ...scope, status: "ready", controller, locations: result.data });
      })
      .catch(() => {
        if (mounted && !abort.signal.aborted) setState({ ...scope, status: "error" });
      });
    return () => {
      mounted = false;
      abort.abort();
      clearTimeout(timeout);
      if (controller) {
        recovery.detach(controller);
        controller.dispose();
      }
    };
  }, [api, hardware, loadLocations, session, credentialHash, recovery, active, uuid, attempt]);
  const current =
    state.api === api &&
    state.hardware === hardware &&
    state.attempt === attempt &&
    state.session === session &&
    state.credentialHash === credentialHash &&
    active();
  const status = current ? state.status : "loading";
  const text = foundation[locale];
  if (current && state.status === "ready")
    return (
      <NativeCommerceCustomerViews
        controller={state.controller}
        locations={state.locations}
        locale={locale}
        fontFamily={fontFamily}
        onRefreshSession={() => {
          recovery.capture();
          onRefreshSession();
        }}
      />
    );
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityLiveRegion="polite" style={{ fontFamily }}>
        {text[status]}
      </Text>
      <Button
        title={text.retry}
        disabled={status === "loading"}
        onPress={() => setAttempt((value) => value + 1)}
      />
    </View>
  );
}
