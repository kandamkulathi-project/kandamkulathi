import * as Crypto from "expo-crypto";
import { browserAttempt, nativeVault } from "./native";
import { type NativeSignInBackend, nativeSignInController } from "./signIn";

let browserBusy = false;

/** Composable SDK adapter only. Backend ports are deliberately not bound to invented endpoints. */
export function nativeSignIn(options: {
  environment: "local" | "dev" | "staging" | "production";
  redirectUri: string;
  authorizationOrigin: string;
  backend: NativeSignInBackend;
  active(): boolean;
  vault?: ReturnType<typeof nativeVault>;
  onBrowserHandoff?(active: boolean): void;
  /** Runtime waits for actual foreground before exchanging a returned code or saving a session. */
  awaitForeground?(): Promise<boolean>;
}) {
  const redirect = new URL(options.redirectUri);
  const origin = new URL(options.authorizationOrigin);
  if (
    redirect.protocol !== `kandamkulathi-${options.environment}:` ||
    origin.protocol !== "https:" ||
    origin.origin !== options.authorizationOrigin
  )
    throw new Error("Approved environment-specific native auth configuration required");
  return nativeSignInController({
    backend: options.backend,
    active: options.active,
    vault: options.vault ?? nativeVault(options.environment),
    async attempt() {
      const browser = browserAttempt(options.redirectUri, "auth");
      const expiresAt = Date.now() + 5 * 60 * 1000;
      const codeVerifier = Array.from(Crypto.getRandomBytes(32), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        codeVerifier,
        {
          encoding: Crypto.CryptoEncoding.BASE64,
        },
      );
      const codeChallenge = digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      return {
        proof: {
          state: browser.state,
          redirectUri: options.redirectUri,
          codeChallenge,
          codeChallengeMethod: "S256",
        },
        codeVerifier,
        open: async (url) => {
          if (browserBusy) return { status: "busy" };
          if (Date.now() >= expiresAt) return { status: "rejected" };
          const target = new URL(url);
          if (
            target.origin !== options.authorizationOrigin ||
            target.username ||
            target.password ||
            target.hash
          )
            return { status: "rejected" };
          for (const [key, value] of Object.entries({
            state: browser.state,
            redirect_uri: options.redirectUri,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
          })) {
            if (
              target.searchParams.getAll(key).length !== 1 ||
              target.searchParams.get(key) !== value
            )
              return { status: "rejected" };
          }
          browserBusy = true;
          try {
            options.onBrowserHandoff?.(true);
            const returned = await browser.open(url, options.authorizationOrigin);
            if (
              returned.status === "server-verification-required" &&
              options.awaitForeground &&
              !(await options.awaitForeground())
            )
              return { status: "rejected" };
            return returned;
          } finally {
            // Disposal fences callbacks but cannot pretend the actual native browser has closed.
            browserBusy = false;
            options.onBrowserHandoff?.(false);
          }
        },
      };
    },
  });
}
