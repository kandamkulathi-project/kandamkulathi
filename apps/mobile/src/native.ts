import { credentialVault, parseNotificationLink, returnGuard } from "@kandamkulathi/client";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

export function nativeVault(
  environment: "local" | "dev" | "staging" | "production",
  purpose: "auth" | "diagnostic" = "auth",
) {
  return credentialVault(
    {
      get: (key) => SecureStore.getItemAsync(key),
      set: (key, value) =>
        SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      remove: (key) => SecureStore.deleteItemAsync(key),
    },
    environment,
    purpose,
  );
}

/** Single attempt; backend must bind the state/PKCE transaction and verify returned code. */
export function browserAttempt(redirectUri: string, purpose: "auth" | "payment") {
  const state = Array.from(Crypto.getRandomBytes(32), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  const attempt = { redirectUri, purpose, state, expiresAt: Date.now() + 5 * 60 * 1000 };
  const accept = returnGuard(attempt);
  let started = false;
  return {
    state,
    async open(authorizeUrl: string, approvedOrigin: string) {
      const url = new URL(authorizeUrl);
      if (
        started ||
        url.origin !== approvedOrigin ||
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.hash ||
        url.searchParams.get("state") !== state
      )
        throw new Error("Invalid authorization handoff");
      started = true;
      const result = await WebBrowser.openAuthSessionAsync(url.href, redirectUri);
      return result.type === "success" ? accept(result.url) : ({ status: "cancelled" } as const);
    },
  };
}

export function receivedLink(url: string, environment: string) {
  // This starter has no verified mobile session; links cannot unlock a record.
  return parseNotificationLink(url, `kandamkulathi-${environment}`, false);
}
