import { z } from "zod";

const providerId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]+$`));
const claimsSchema = z.object({
  iss: z.string(),
  client_id: providerId("client"),
  sub: providerId("user"),
  sid: providerId("session"),
  org_id: providerId("org").optional(),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  nbf: z.number().int().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  act: z.unknown().optional(),
});
export type WorkosSession = {
  userId: string;
  sessionId: string;
  organizationId: string | null;
  issuedAt: string;
  expiresAt: string;
};
export type WorkosVerification =
  | { status: "verified"; session: WorkosSession }
  | { status: "unauthenticated" | "unavailable" };
export interface WorkosOptions {
  apiKey: string;
  clientId: string;
  issuer: string;
  /** Optional additional aud claim requirement; client_id is always checked. */
  audience?: string;
  approved: boolean;
}
const decode = (value: string): Uint8Array<ArrayBuffer> => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid token encoding");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
};
const object = (part: string): unknown =>
  JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(decode(part)));

/** No cookies, client scope headers, token-provided URLs, redirects or cached revocation state. */
export function createWorkosVerifier(
  options: WorkosOptions,
  transport: typeof fetch = fetch,
  now = Date.now,
) {
  const get = async (url: string, authenticated = false): Promise<unknown> => {
    const response = await transport(url, {
      redirect: "error",
      signal: AbortSignal.timeout(4000),
      headers: authenticated ? { Authorization: `Bearer ${options.apiKey}` } : {},
    });
    if (!response.ok) throw new Error("Identity provider unavailable");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing provider response");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        length += next.value.byteLength;
        if (length > 262144) throw new Error("Provider response too large");
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  return async (request: Request): Promise<WorkosVerification> => {
    if (
      !options.approved ||
      !options.apiKey ||
      !/^client_[A-Za-z0-9]+$/.test(options.clientId) ||
      !/^https:\/\/[^/?#@]+\/?$/.test(options.issuer)
    )
      return { status: "unavailable" };
    const authorization = request.headers.get("authorization");
    if (
      !authorization ||
      !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) ||
      authorization.length > 16384
    )
      return { status: "unauthenticated" };
    let parts: string[];
    let claims: z.infer<typeof claimsSchema>;
    let header: { alg: "RS256"; kid: string; typ?: string | undefined };
    try {
      parts = authorization.slice(7).split(".");
      if (parts.length !== 3) return { status: "unauthenticated" };
      header = z
        .strictObject({
          alg: z.literal("RS256"),
          kid: z.string().min(1).max(256),
          typ: z.literal("JWT").optional(),
        })
        .parse(object(parts[0] ?? ""));
      claims = claimsSchema.parse(object(parts[1] ?? ""));
      const seconds = now() / 1000;
      if (
        !Number.isFinite(seconds) ||
        claims.iss !== options.issuer ||
        claims.client_id !== options.clientId ||
        claims.iat > seconds ||
        claims.exp <= seconds ||
        claims.exp <= claims.iat ||
        (claims.nbf !== undefined && claims.nbf > seconds) ||
        claims.act !== undefined ||
        (options.audience !== undefined &&
          !(Array.isArray(claims.aud)
            ? claims.aud.includes(options.audience)
            : claims.aud === options.audience))
      )
        return { status: "unauthenticated" };
    } catch {
      return { status: "unauthenticated" };
    }
    try {
      const jwks = z
        .object({
          keys: z
            .array(
              z.object({
                kty: z.literal("RSA"),
                kid: z.string(),
                n: z.string(),
                e: z.string(),
                alg: z.literal("RS256").optional(),
                use: z.literal("sig").optional(),
              }),
            )
            .max(20),
        })
        .parse(await get(`https://api.workos.com/sso/jwks/${options.clientId}`));
      const keys = jwks.keys.filter((key) => key.kid === header.kid);
      if (keys.length !== 1) return { status: "unauthenticated" };
      const selectedKey = keys[0];
      if (!selectedKey) return { status: "unauthenticated" };
      const key = await crypto.subtle.importKey(
        "jwk",
        { kty: selectedKey.kty, n: selectedKey.n, e: selectedKey.e },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      if (
        !(await crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          key,
          decode(parts[2] ?? ""),
          new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
        ))
      )
        return { status: "unauthenticated" };
      // List only active sessions. Bound pagination; excessive/malformed results fail closed.
      let cursor: string | undefined;
      for (let page = 0; page < 10; page++) {
        const url = new URL(`https://api.workos.com/user_management/users/${claims.sub}/sessions`);
        url.searchParams.set("limit", "100");
        if (cursor) url.searchParams.set("after", cursor);
        const result = z
          .object({
            data: z
              .array(
                z.object({
                  id: providerId("session"),
                  user_id: providerId("user"),
                  organization_id: providerId("org").nullish(),
                  status: z.string(),
                  expires_at: z.iso.datetime(),
                  ended_at: z.iso.datetime().nullish(),
                  impersonator: z.unknown().optional(),
                }),
              )
              .max(100),
            list_metadata: z.object({ after: z.string().nullable() }),
          })
          .parse(await get(url.href, true));
        const session = result.data.find((entry) => entry.id === claims.sid);
        if (session) {
          if (
            session.user_id !== claims.sub ||
            session.status !== "active" ||
            session.ended_at != null ||
            session.impersonator != null ||
            (session.organization_id ?? null) !== (claims.org_id ?? null) ||
            Date.parse(session.expires_at) <= now()
          )
            return { status: "unauthenticated" };
          return {
            status: "verified",
            session: {
              userId: claims.sub,
              sessionId: claims.sid,
              organizationId: claims.org_id ?? null,
              issuedAt: new Date(claims.iat * 1000).toISOString(),
              expiresAt: new Date(
                Math.min(claims.exp * 1000, Date.parse(session.expires_at)),
              ).toISOString(),
            },
          };
        }
        if (!result.list_metadata.after) return { status: "unauthenticated" };
        if (cursor === result.list_metadata.after) throw new Error("Invalid pagination");
        cursor = result.list_metadata.after;
      }
      return { status: "unavailable" };
    } catch {
      return { status: "unavailable" };
    }
  };
}
