import { describe, expect, it } from "vitest";
import {
  createWebSecrets,
  createWorkosOAuth,
  digest,
  encode64,
  randomSecret,
} from "../../packages/providers/src/workos/oauth";
import { options } from "./workos-fixtures";

describe("web AuthKit cryptography", () => {
  it("uses S256 PKCE and only the fixed official HTTPS authorization endpoint", async () => {
    expect(await digest("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
    const oauth = createWorkosOAuth(options, "https://core.example/v1/auth/callback");
    const url = new URL(await oauth.authorizationUrl(randomSecret(), randomSecret()));
    expect(url.origin + url.pathname).toBe("https://api.workos.com/user_management/authorize");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("provider")).toBe("authkit");
    expect(url.searchParams.has("client_secret")).toBe(false);
  });
  it("authenticates ciphertext, origin and purpose; CSRF binds exact actor/session/handle", async () => {
    const key = encode64(new Uint8Array(32).fill(71));
    const secrets = createWebSecrets(key, "https://core.example");
    const one = await secrets.seal("private-value", "session-cookie");
    const two = await secrets.seal("private-value", "session-cookie");
    expect(one).not.toBe(two);
    expect(one).not.toContain("private-value");
    expect(await secrets.open(one, "session-cookie")).toBe("private-value");
    await expect(secrets.open(one, "attempt-cookie")).rejects.toThrow();
    await expect(
      createWebSecrets(key, "https://other.example").open(one, "session-cookie"),
    ).rejects.toThrow();
    const pieces = one.split(".");
    pieces[2] = `${pieces[2]?.[0] === "A" ? "B" : "A"}${pieces[2]?.slice(1)}`;
    await expect(secrets.open(pieces.join("."), "session-cookie")).rejects.toThrow();
    const token = await secrets.csrf("handle|actor|session");
    expect(await secrets.verifyCsrf("handle|actor|session", token)).toBe(true);
    expect(await secrets.verifyCsrf("other|actor|session", token)).toBe(false);
    expect(await secrets.verifyCsrf("handle|actor|other", token)).toBe(false);
    expect(() => createWebSecrets("short", "https://core.example")).toThrow();
  });
});
