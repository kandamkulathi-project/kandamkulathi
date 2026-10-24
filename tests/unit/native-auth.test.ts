import { describe, expect, it, vi } from "vitest";
import { createNativeAuthRuntime } from "../../apps/core-api/src/native-auth";
import {
  nativeCredentialSchema,
  nativeExchangeSchema,
  nativeStartSchema,
} from "../../packages/contracts/src/native-auth";
import type { DatabaseClient } from "../../packages/database/src/client";
import { guardNativeSession } from "../../packages/database/src/native-auth";
import {
  createNativeWorkosOAuth,
  nativeProviderJson,
} from "../../packages/providers/src/workos/native-oauth";
import type { TestFetch } from "../fixtures/fetch";
import { nativeOptions, proof, verifier } from "./native-auth-fixtures";
import { options } from "./workos-fixtures";

describe("native protocol contracts and fixed WorkOS adapter", () => {
  it("accepts the real ports, rejects extra fields/plain PKCE and never accepts a large JWT as a handle", async () => {
    expect(nativeStartSchema.safeParse(await proof()).success).toBe(true);
    expect(
      nativeStartSchema.safeParse({ ...(await proof()), codeChallengeMethod: "plain" }).success,
    ).toBe(false);
    expect(nativeStartSchema.safeParse({ ...(await proof()), actorId: "invented" }).success).toBe(
      false,
    );
    expect(
      nativeExchangeSchema.safeParse({
        state: "s".repeat(43),
        redirectUri: nativeOptions.allowedRedirects[0]?.redirectUri,
        code: "code",
        codeVerifier: verifier,
      }).success,
    ).toBe(true);
    expect(nativeCredentialSchema.parse(`n1_${"x".repeat(43)}`).length).toBe(46);
    expect(nativeCredentialSchema.safeParse("eyJ".repeat(1000)).success).toBe(false);
  });
  it("constructs exact state/S256/custom callback and exchanges without sending raw IP/user agent", async () => {
    const transport = vi.fn<TestFetch>(
      async () =>
        new Response(
          JSON.stringify({
            access_token: "jwt".repeat(1000),
            refresh_token: "do-not-retain",
            user: { id: "user_test" },
          }),
        ),
    );
    const oauth = createNativeWorkosOAuth(options, transport);
    const input = await proof();
    const url = new URL(oauth.authorizationUrl(input));
    expect(url.origin).toBe("https://api.workos.com");
    expect(url.pathname).toBe("/user_management/authorize");
    expect(url.searchParams.get("state")).toBe(input.state);
    expect(url.searchParams.get("redirect_uri")).toBe(input.redirectUri);
    expect(url.searchParams.get("code_challenge")).toBe(input.codeChallenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const result = await oauth.exchange("code", verifier, input.redirectUri);
    expect(result).toEqual({ accessToken: "jwt".repeat(1000), userId: "user_test" });
    expect(JSON.parse(String(transport.mock.calls[0]?.[1]?.body))).toEqual({
      client_id: options.clientId,
      client_secret: options.apiKey,
      grant_type: "authorization_code",
      code: "code",
      code_verifier: verifier,
      redirect_uri: input.redirectUri,
    });
    expect(transport.mock.calls[0]?.[1]?.redirect).toBe("error");
  });
  it("bounds provider input and rejects impersonation and oversized tokens rather than truncating", async () => {
    await expect(nativeProviderJson(new Response("x".repeat(65537)))).rejects.toThrow();
    for (const response of [
      { access_token: "x".repeat(16378), user: { id: "user_test" } },
      { access_token: "jwt", user: { id: "user_test" }, impersonator: {} },
    ]) {
      const oauth = createNativeWorkosOAuth(
        options,
        async () => new Response(JSON.stringify(response)),
      );
      await expect(oauth.exchange("code", verifier, "ignored")).rejects.toThrow();
    }
  });
  it("requires complete pagination before declaring absence and rejects cycles/malformed linkage", async () => {
    let page = 0;
    const oauth = createNativeWorkosOAuth(
      options,
      async () =>
        new Response(
          JSON.stringify({ data: [], list_metadata: { after: ++page === 1 ? "next" : null } }),
        ),
    );
    expect(await oauth.active("user_test", "session_test")).toBe(false);
    expect(page).toBe(2);
    const cyclic = createNativeWorkosOAuth(
      options,
      async () => new Response(JSON.stringify({ data: [], list_metadata: { after: "same" } })),
    );
    await expect(cyclic.active("user_test", "session_test")).rejects.toThrow();
    const foreign = createNativeWorkosOAuth(
      options,
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: "session_test",
                user_id: "user_other",
                status: "active",
                expires_at: "2100-01-01T00:00:00Z",
              },
            ],
            list_metadata: { after: null },
          }),
        ),
    );
    await expect(foreign.active("user_test", "session_test")).rejects.toThrow();
  });
  it("reconciles expired provider sessions without a revoke and rejects undocumented/contradictory active-list states", async () => {
    const stamp = Date.parse("2026-10-24T10:00:00Z");
    const listed = (status: string, expires: string, ended: string | null = null) =>
      createNativeWorkosOAuth(
        options,
        async () =>
          new Response(
            JSON.stringify({
              data: [
                {
                  id: "session_test",
                  user_id: "user_test",
                  status,
                  expires_at: expires,
                  ended_at: ended,
                },
              ],
              list_metadata: { after: null },
            }),
          ),
        () => stamp,
      );
    expect(await listed("active", "2026-10-24T09:59:00Z").active("user_test", "session_test")).toBe(
      false,
    );
    await expect(
      listed("unknown", "2100-01-01T00:00:00Z").active("user_test", "session_test"),
    ).rejects.toThrow("Unknown");
    await expect(
      listed("active", "2100-01-01T00:00:00Z", "2100-01-01T00:00:00Z").active(
        "user_test",
        "session_test",
      ),
    ).rejects.toThrow("Unknown");
  });
  it("fails unavailable with no approved environment callback; denies cookie+bearer and environment crossing", async () => {
    const db = vi.fn(async () => {
      throw new Error("No database call expected");
    });
    for (const changed of [
      { approved: false },
      { allowedRedirects: [] },
      { environment: "production" as const },
      { encryptionKey: "bad" },
      { sessionTtlSeconds: 901 },
    ]) {
      const runtime = createNativeAuthRuntime({ ...nativeOptions, ...changed }, db);
      expect(
        await runtime.dependencies.verifySession(new Request(nativeOptions.apiOrigin)),
      ).toEqual({ status: "unavailable" });
    }
    const runtime = createNativeAuthRuntime(nativeOptions, db);
    expect(
      await runtime.dependencies.verifySession(
        new Request(nativeOptions.apiOrigin, {
          headers: { Cookie: "session=x", Authorization: `Bearer n1_${"x".repeat(43)}` },
        }),
      ),
    ).toEqual({ status: "unauthenticated" });
    await expect(
      runtime.start(new Request(nativeOptions.apiOrigin), {
        ...(await proof()),
        redirectUri: "kandamkulathi-production://auth/return",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(db).not.toHaveBeenCalled();
  });
  it("refuses the native guard without an actual platform transaction", async () => {
    const client = { query: vi.fn() } as unknown as DatabaseClient;
    await expect(
      guardNativeSession(
        client,
        "x".repeat(43),
        {
          actorId: "10000000-0000-4000-8000-000000000001",
          sessionId: "20000000-0000-4000-8000-000000000001",
          organizationId: null,
          authenticatedAt: "2026-01-01T00:00:00Z",
          expiresAt: "2100-01-01T00:00:00Z",
          mfa: null,
        },
        Date.now(),
      ),
    ).rejects.toThrow("requires transaction");
    expect(client.query).not.toHaveBeenCalled();
  });
});
