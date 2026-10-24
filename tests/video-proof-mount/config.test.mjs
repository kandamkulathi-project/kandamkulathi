import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rmdir, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { parseVideoProofConfig } from "../../apps/mobile/videoProofConfig.mjs";
import { issueVideoProof } from "../../scripts/video-proof/issue.mjs";

test("diagnostic config is explicit, HTTPS-only and refused outside local/dev", () => {
  const endpoint = "https://signal.example.test/p1-private-video-proof";
  assert.equal(parseVideoProofConfig({}, "local").p1VideoProof.enabled, false);
  const env = {
    MOBILE_VIDEO_PROOF_APPROVED: "true",
    MOBILE_VIDEO_PROOF_ENDPOINT: endpoint,
  };
  assert.deepEqual(parseVideoProofConfig(env, "local").p1VideoProof, { enabled: true, endpoint });
  assert.throws(() => parseVideoProofConfig(env, "production"));
  assert.throws(() => parseVideoProofConfig(env, "staging"));
  assert.throws(() =>
    parseVideoProofConfig(
      { ...env, MOBILE_VIDEO_PROOF_ENDPOINT: `${endpoint}?ticket=not-allowed` },
      "local",
    ),
  );
  assert.throws(() =>
    parseVideoProofConfig(
      { ...env, MOBILE_VIDEO_PROOF_ENDPOINT: endpoint.replace("https:", "http:") },
      "local",
    ),
  );
  const existing = {
    transcriptionProofApproved: true,
    transcriptionProcessingPolicy: {
      version: "synthetic-reviewed",
      notices: { en: "synthetic", ml: "synthetic", ta: "synthetic" },
    },
  };
  assert.deepEqual(
    { ...existing, ...parseVideoProofConfig(env, "local") }.transcriptionProcessingPolicy,
    existing.transcriptionProcessingPolicy,
  );
  assert.deepEqual(Object.keys(parseVideoProofConfig(env, "local")), ["p1VideoProof"]);
});
test("server provisioner generates private pair keys/pins and never puts TURN in invitations", () => {
  const endpoint = "https://signal.example.test/p1-private-video-proof";
  const relays = [
    {
      urls: ["turns:relay.example.test:443"],
      username: "synthetic-expiring",
      credential: "synthetic-not-real",
    },
  ];
  const now = 1800000000000;
  const result = issueVideoProof({ endpoint, origin: "https://proof.example.test", relays, now });
  assert.equal(result.config.syntheticOnly, true);
  assert.equal(result.invitations.length, 2);
  const [a, b] = result.invitations;
  assert.match(a.grant.ticket, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.grant.ticket, b.grant.ticket);
  assert.equal(a.member.connectionId, b.member.connectionId);
  assert.equal(a.member.participantId, b.member.peerId);
  assert.equal(a.member.expiresAt, now + 300000);
  assert(!JSON.stringify(result.invitations).includes(relays[0].credential));
});

test("issuer CLI writes exclusively private files outside Git and prints no invitation credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "p1-video-issuer-"));
  const turn = resolve(directory, "turn.json"),
    output = resolve(directory, "issued");
  const files = ["server-config.json", "invitation-a.json", "invitation-b.json"];
  try {
    await writeFile(
      turn,
      JSON.stringify([
        {
          urls: ["turns:relay.example.test:443"],
          username: "synthetic",
          credential: "synthetic-not-real",
        },
      ]),
      { mode: 0o600 },
    );
    const stdout = execFileSync(
      process.execPath,
      [
        "scripts/video-proof/issue.mjs",
        output,
        "https://signal.example.test/p1-private-video-proof",
        "https://proof.example.test",
        turn,
      ],
      { encoding: "utf8" },
    );
    assert.equal((await stat(output)).mode & 0o777, 0o700);
    for (const name of files) assert.equal((await stat(resolve(output, name))).mode & 0o777, 0o600);
    const a = JSON.parse(await readFile(resolve(output, "invitation-a.json"), "utf8"));
    assert(!stdout.includes(a.grant.ticket));
    assert(!stdout.includes("synthetic-not-real"));
  } finally {
    for (const name of files) await unlink(resolve(output, name)).catch(() => {});
    await rmdir(output).catch(() => {});
    await unlink(turn);
    await rmdir(directory);
  }
});
