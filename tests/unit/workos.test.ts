import { describe, expect, it } from "vitest";
import { createWorkosVerifier } from "../../packages/providers/src/workos/index.ts";
import { instant, options, workosFixture } from "./workos-fixtures";

const request = (token: string) =>
  new Request("https://core.example/v1/session", {
    headers: { authorization: `Bearer ${token}`, "x-actor-id": "forged", "x-mfa": "true" },
  });
describe("WorkOS cryptographic bearer verification", () => {
  it("verifies signature and live session; next-request revocation cannot use cached JWT authority", async () => {
    const fixture = await workosFixture();
    const verify = createWorkosVerifier(options, fixture.transport, () => instant);
    const credential = await fixture.token();
    expect(await verify(request(credential))).toMatchObject({
      status: "verified",
      session: { userId: "user_test", sessionId: "session_test", organizationId: null },
    });
    fixture.revoke();
    expect(await verify(request(credential))).toEqual({ status: "unauthenticated" });
    expect(fixture.transport).toHaveBeenCalledTimes(4);
  });
  it.each([
    { iss: "https://evil.example" },
    { client_id: "client_other" },
    { exp: instant / 1000 },
    { iat: instant / 1000 + 1 },
    { nbf: instant / 1000 + 1 },
    { act: { sub: "admin" } },
  ])("rejects invalid claim binding %j before provider lookup", async (claims) => {
    const fixture = await workosFixture();
    expect(
      await createWorkosVerifier(
        options,
        fixture.transport,
        () => instant,
      )(request(await fixture.token(claims))),
    ).toEqual({ status: "unauthenticated" });
    expect(fixture.transport).not.toHaveBeenCalled();
  });
  it("rejects tampered signatures and requires configured aud when supplied", async () => {
    const fixture = await workosFixture();
    const credential = await fixture.token();
    const parts = credential.split(".");
    parts[2] = `${parts[2]?.[0] === "A" ? "B" : "A"}${parts[2]?.slice(1)}`;
    expect(
      await createWorkosVerifier(
        options,
        fixture.transport,
        () => instant,
      )(request(parts.join("."))),
    ).toEqual({ status: "unauthenticated" });
    expect(
      await createWorkosVerifier(
        { ...options, audience: "core" },
        fixture.transport,
        () => instant,
      )(request(credential)),
    ).toEqual({ status: "unauthenticated" });
  });
  it("fails unavailable for missing approval or provider outage; cookies do not authenticate", async () => {
    const fixture = await workosFixture();
    const credential = await fixture.token();
    expect(
      await createWorkosVerifier(
        { ...options, approved: false },
        fixture.transport,
      )(request(credential)),
    ).toEqual({ status: "unavailable" });
    fixture.transport.mockRejectedValue(new Error("private failure"));
    expect(
      await createWorkosVerifier(options, fixture.transport, () => instant)(request(credential)),
    ).toEqual({ status: "unavailable" });
    expect(
      await createWorkosVerifier(options)(
        new Request("https://core.example", { headers: { cookie: "session=forged" } }),
      ),
    ).toEqual({ status: "unauthenticated" });
  });
  it("rejects a live session belonging to another user or organization", async () => {
    const fixture = await workosFixture();
    const credential = await fixture.token();
    const original = fixture.transport.getMockImplementation();
    if (!original) throw new Error("Fixture transport missing");
    for (const session of [
      { user_id: "user_other", organization_id: null },
      { user_id: "user_test", organization_id: "org_other" },
    ]) {
      fixture.transport.mockClear();
      fixture.transport.mockImplementation(async (url) => {
        if (String(url).includes("/jwks/")) {
          return original(url);
        }
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "session_test",
                ...session,
                status: "active",
                expires_at: "2026-10-25T10:00:00.000Z",
                ended_at: null,
              },
            ],
            list_metadata: { after: null },
          }),
        );
      });
      expect(
        await createWorkosVerifier(options, fixture.transport, () => instant)(request(credential)),
      ).toEqual({ status: "unauthenticated" });
      expect(fixture.transport).toHaveBeenCalledTimes(2);
    }
  });
});
