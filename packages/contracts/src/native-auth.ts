import { z } from "zod";

const state = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);
const redirectUri = z.string().min(1).max(256);
export const nativeStartSchema = z.strictObject({
  state,
  redirectUri,
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  codeChallengeMethod: z.literal("S256"),
});
export const nativeExchangeSchema = z.strictObject({
  state,
  redirectUri,
  code: z.string().regex(/^[A-Za-z0-9_-]{1,2048}$/),
  codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
});
/** Native vault contract: 46 characters, not a WorkOS JWT or refresh token. */
export const nativeCredentialSchema = z.string().regex(/^n1_[A-Za-z0-9_-]{43}$/);
export const nativeStartResponseSchema = z.strictObject({ authorizationUrl: z.url() });
export const nativeExchangeResponseSchema = z.strictObject({ credential: nativeCredentialSchema });
export const nativeLogoutKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);
export type NativeStart = z.infer<typeof nativeStartSchema>;
export type NativeExchange = z.infer<typeof nativeExchangeSchema>;
