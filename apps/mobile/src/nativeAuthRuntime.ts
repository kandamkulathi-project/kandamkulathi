import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { AppState } from "react-native";
import { nativeVault } from "./native";
import { nativeAuthController } from "./nativeAuthController";
import { nativeAuthHttp } from "./nativeAuthHttp";
import { nativeSignIn } from "./nativeSignIn";

/** Composition of the actual HTTP protocol, OS vault and incumbent browser/PKCE adapter. */
export function createNativeAuthRuntime(onAuthenticated: () => void) {
  const value: unknown = Constants.expoConfig?.extra?.environment;
  const environment =
    value === "dev" || value === "staging" || value === "production" ? value : "local";
  const origin: string = Constants.expoConfig?.extra?.coreApiOrigin ?? "http://127.0.0.1:8787";
  let disposed = false;
  let browserHandoff = false;
  const vault = nativeVault(environment);
  const awaitForeground = () => {
    if (disposed) return Promise.resolve(false);
    if (AppState.currentState === "active") return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      const finish = (value: boolean) => {
        clearTimeout(timer);
        subscription.remove();
        resolve(value);
      };
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") finish(!disposed);
      });
      const timer = setTimeout(() => finish(false), 5000);
      if (AppState.currentState === "active") finish(!disposed);
    });
  };
  const controller = nativeAuthController({
    api: nativeAuthHttp({
      origin,
      local: environment === "local",
      sha256: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
    }),
    vault,
    active: () => !disposed && (browserHandoff || AppState.currentState === "active"),
    uuid: Crypto.randomUUID,
    onAuthenticated,
    onBrowserHandoff: (active) => {
      browserHandoff = active;
    },
    createSignIn: (backend, handoff) =>
      nativeSignIn({
        vault,
        environment,
        redirectUri: `kandamkulathi-${environment}://auth/return`,
        // The canonical provider native-oauth.ts constructs this exact WorkOS origin.
        authorizationOrigin: "https://api.workos.com",
        backend,
        active: () => !disposed && (browserHandoff || AppState.currentState === "active"),
        onBrowserHandoff: handoff,
        awaitForeground,
      }),
  });
  return {
    controller,
    vault,
    pending: () => {
      const state = controller.getSnapshot();
      return (
        state.browserHandoff ||
        state.status === "loading" ||
        state.status === "consent_required" ||
        !!state.policy
      );
    },
    async background() {
      const state = controller.getSnapshot();
      // Ordinary private-session backgrounding must not cancel a completed login or erase its vault.
      if (state.status !== "idle" && state.status !== "ready" && state.status !== "logout_pending")
        await controller.background();
    },
    async dispose() {
      disposed = true;
      const state = controller.getSnapshot();
      if (state.status !== "ready" && state.status !== "idle" && state.status !== "logout_pending")
        await controller.cancel();
    },
  };
}
