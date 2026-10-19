import assert from "node:assert/strict";
import { constants, createHash, generateKeyPairSync, privateEncrypt, sign } from "node:crypto";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

// Resolve the actual Expo toolchain copies, rather than a separate test-only dependency.
const mobileRequire = createRequire(new URL("../../apps/mobile/package.json", import.meta.url));
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const cliRequire = createRequire(expoRequire.resolve("@expo/cli/package.json"));
const metroRequire = createRequire(expoRequire.resolve("@expo/metro/package.json"));
const mapRequire = createRequire(metroRequire.resolve("metro-file-map/package.json"));
const micromatchRequire = createRequire(mapRequire.resolve("micromatch/package.json"));
const forge = cliRequire("node-forge");
const braces = micromatchRequire("braces");

describe("CVE-2026-85393: nested DigestAlgorithm cardinality", () => {
  const keys = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 3,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });
  const publicKey = forge.pki.publicKeyFromPem(keys.publicKey);
  const message = "Synthetic toolchain security regression";
  const digest = createHash("sha256").update(message).digest("latin1");
  const { asn1 } = forge;
  const sequence = (children) =>
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, children);
  const oid = () =>
    asn1.create(
      asn1.Class.UNIVERSAL,
      asn1.Type.OID,
      false,
      asn1.oidToDer(forge.oids.sha256).getBytes(),
    );
  const nil = () => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "");
  const garbage = () =>
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, "unconsumed");
  function signedDigestInfo(children) {
    const der = Buffer.from(
      asn1
        .toDer(
          sequence([
            sequence(children),
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, digest),
          ]),
        )
        .getBytes(),
      "latin1",
    );
    const padding = Buffer.alloc(256 - der.length - 3, 0xff);
    return privateEncrypt(
      { key: keys.privateKey, padding: constants.RSA_NO_PADDING },
      Buffer.concat([Buffer.from([0, 1]), padding, Buffer.from([0]), der]),
    ).toString("latin1");
  }
  for (const algorithm of ["sha1", "sha256", "sha384", "sha512"]) {
    it(`preserves valid ${algorithm} signatures`, () => {
      const signature = sign(algorithm, Buffer.from(message), keys.privateKey).toString("latin1");
      const expected = createHash(algorithm).update(message).digest("latin1");
      assert.equal(publicKey.verify(expected, signature), true);
      const changed = Buffer.from(expected, "latin1");
      changed[0] ^= 1;
      assert.equal(publicKey.verify(changed.toString("latin1"), signature), false);
    });
  }
  it("accepts the permitted omitted SHA256 NULL parameter", () => {
    assert.equal(publicKey.verify(digest, signedDigestInfo([oid()])), true);
  });
  for (const [name, children] of [
    ["garbage following OID/NULL", () => [oid(), nil(), garbage()]],
    ["garbage following OID without NULL", () => [oid(), garbage()]],
    ["duplicate NULL parameters", () => [oid(), nil(), nil()]],
  ]) {
    it(`rejects ${name} despite an otherwise valid RSA signature`, () => {
      assert.throws(
        () => publicKey.verify(digest, signedDigestInfo(children())),
        /valid RSASSA-PKCS1-v1_5/,
      );
    });
  }
});

describe("CVE-2026-93687: bounded parser nesting", () => {
  const hostile = `${"{".repeat(4000)}a${"}".repeat(4000)}`;
  for (const method of ["parse", "compile", "expand", "stringify"]) {
    it(`rejects excessive nesting through ${method} with a deliberate depth error`, () => {
      assert.throws(() => braces[method](hostile), {
        name: "SyntaxError",
        code: "ERR_BRACES_MAX_DEPTH",
      });
    });
  }
  it("also rejects parentheses and mixed-container nesting", () => {
    for (const input of [
      `${"(".repeat(200)}a${")".repeat(200)}`,
      `${"({".repeat(101)}a${"})".repeat(101)}`,
    ]) {
      assert.throws(() => braces.parse(input), { code: "ERR_BRACES_MAX_DEPTH" });
    }
  });
  it("preserves normal lists, ranges and bounded nesting", () => {
    assert.deepEqual(braces.expand("src/{web,mobile}/{a,b}.ts"), [
      "src/web/a.ts",
      "src/web/b.ts",
      "src/mobile/a.ts",
      "src/mobile/b.ts",
    ]);
    assert.deepEqual(braces.expand("{01..03}"), ["01", "02", "03"]);
    assert.deepEqual(braces("a/{b,c}/d"), ["a/(b|c)/d"]);
    assert.doesNotThrow(() => braces.compile(`${"{".repeat(100)}a${"}".repeat(100)}`));
    assert.throws(() => braces.compile(`${"{".repeat(101)}a${"}".repeat(101)}`), {
      code: "ERR_BRACES_MAX_DEPTH",
    });
  });
  it("does not mistake quoted or escaped braces for parsed nesting", () => {
    assert.doesNotThrow(() => braces.parse(`"${"{".repeat(200)}"`));
    assert.doesNotThrow(() => braces.parse("\\{".repeat(200)));
    assert.doesNotThrow(() => braces.parse(`[${"{".repeat(200)}]`));
  });
});
