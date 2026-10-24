import { vi } from "vitest";
export const instant = Date.parse("2026-10-24T10:00:00Z");
export const options = {
  apiKey: "synthetic-provider-credential",
  clientId: "client_test",
  issuer: "https://api.workos.com",
  approved: true,
};
export async function workosFixture() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = {
    ...(await crypto.subtle.exportKey("jwk", pair.publicKey)),
    kid: "test-key",
    alg: "RS256",
    use: "sig",
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = async (overrides: Record<string, unknown> = {}) => {
    const data = `${encode({ alg: "RS256", kid: jwk.kid, typ: "JWT" })}.${encode({ iss: options.issuer, client_id: options.clientId, sub: "user_test", sid: "session_test", iat: instant / 1000 - 60, exp: instant / 1000 + 300, ...overrides })}`;
    return `${data}.${Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(data))).toString("base64url")}`;
  };
  let active = true;
  const transport = vi.fn<TestFetch>(
    async (url) =>
      new Response(
        JSON.stringify(
          String(url).includes("/jwks/")
            ? { keys: [jwk] }
            : {
                data: active
                  ? [
                      {
                        id: "session_test",
                        user_id: "user_test",
                        status: "active",
                        organization_id: null,
                        ended_at: null,
                        expires_at: "2026-10-25T10:00:00Z",
                      },
                    ]
                  : [],
                list_metadata: { after: null },
              },
        ),
        { headers: { "content-type": "application/json" } },
      ),
  );
  return {
    token,
    transport,
    revoke: () => {
      active = false;
    },
  };
}

import type { TestFetch } from "../fixtures/fetch";
