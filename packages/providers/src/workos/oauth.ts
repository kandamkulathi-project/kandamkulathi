import { z } from "zod";
import type { WorkosOptions } from "./index.ts";

export const randomSecret = () => encode64(crypto.getRandomValues(new Uint8Array(32)));
export function encode64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function decode64(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid encoding");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) =>
    char.charCodeAt(0),
  );
}
export async function digest(value: string): Promise<string> {
  return encode64(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
  );
}

/** Versioned AES-GCM envelopes; origin and purpose prevent cross-context substitution. */
export function createWebSecrets(keyMaterial: string, origin: string) {
  const bytes = decode64(keyMaterial);
  if (bytes.byteLength !== 32) throw new Error("Web authentication key must be 256 bits");
  const key = crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  const hmac = crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
  return {
    async seal(value: string, purpose: string) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: new TextEncoder().encode(`v1|${origin}|${purpose}`),
        },
        await key,
        new TextEncoder().encode(value),
      );
      return `v1.${encode64(iv)}.${encode64(new Uint8Array(encrypted))}`;
    },
    async open(envelope: string, purpose: string) {
      if (envelope.length > 32768) throw new Error("Invalid envelope");
      const [version, iv, ciphertext, extra] = envelope.split(".");
      if (
        version !== "v1" ||
        !iv ||
        !ciphertext ||
        extra !== undefined ||
        decode64(iv).byteLength !== 12
      )
        throw new Error("Invalid envelope");
      const plain = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: decode64(iv),
          additionalData: new TextEncoder().encode(`v1|${origin}|${purpose}`),
        },
        await key,
        decode64(ciphertext),
      );
      return new TextDecoder().decode(plain);
    },
    async csrf(binding: string) {
      return encode64(
        new Uint8Array(
          await crypto.subtle.sign(
            "HMAC",
            await hmac,
            new TextEncoder().encode(`csrf|${origin}|${binding}`),
          ),
        ),
      );
    },
    async verifyCsrf(binding: string, token: string) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
      return crypto.subtle.verify(
        "HMAC",
        await hmac,
        decode64(token),
        new TextEncoder().encode(`csrf|${origin}|${binding}`),
      );
    },
  };
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok || !response.body) throw new Error("WorkOS unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 65536) throw new Error("WorkOS response too large");
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Official WorkOS AuthKit authorization_code + S256 flow. No client-selected URLs. */
export function createWorkosOAuth(
  options: WorkosOptions,
  callbackUrl: string,
  transport: typeof fetch = fetch,
) {
  return {
    async authorizationUrl(state: string, verifier: string) {
      const url = new URL("https://api.workos.com/user_management/authorize");
      for (const [name, value] of Object.entries({
        provider: "authkit",
        response_type: "code",
        client_id: options.clientId,
        redirect_uri: callbackUrl,
        state,
        code_challenge_method: "S256",
        code_challenge: await digest(verifier),
      }))
        url.searchParams.set(name, value);
      return url.href;
    },
    async exchange(code: string, verifier: string) {
      const response = await transport("https://api.workos.com/user_management/authenticate", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: options.clientId,
          client_secret: options.apiKey,
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: callbackUrl,
        }),
      });
      const result = z
        .object({
          access_token: z.string().min(1).max(16384),
          user: z.object({ id: z.string().regex(/^user_[A-Za-z0-9]+$/) }),
          impersonator: z.unknown().optional(),
        })
        .parse(await boundedJson(response));
      if (result.impersonator != null) throw new Error("Impersonation denied");
      // Refresh and third-party OAuth tokens are deliberately neither persisted nor exposed.
      return { accessToken: result.access_token, userId: result.user.id };
    },
    async revoke(sessionId: string) {
      if (!/^session_[A-Za-z0-9]+$/.test(sessionId)) throw new Error("Invalid provider session");
      const response = await transport("https://api.workos.com/user_management/sessions/revoke", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.apiKey}` },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!response.ok) throw new Error("Provider revocation pending");
      await response.body?.cancel();
    },
  };
}
