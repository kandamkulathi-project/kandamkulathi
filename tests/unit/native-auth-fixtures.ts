import type { NativeAuthOptions } from "../../apps/core-api/src/native-auth";
import { digest, encode64 } from "../../packages/providers/src/workos/oauth";
import { options } from "./workos-fixtures";

export const nativeOptions: NativeAuthOptions = {
  ...options,
  apiOrigin: "https://core.example",
  environment: "local",
  allowedRedirects: [{ environment: "local", redirectUri: "kandamkulathi-local://auth/return" }],
  encryptionKey: encode64(new Uint8Array(32).fill(91)),
  attemptTtlSeconds: 120,
  sessionTtlSeconds: 300,
};
export const verifier = "native-verifier-".padEnd(43, "x");
export const proof = async (state = "s".repeat(43)) => ({
  state,
  redirectUri: "kandamkulathi-local://auth/return",
  codeChallenge: await digest(verifier),
  codeChallengeMethod: "S256" as const,
});
