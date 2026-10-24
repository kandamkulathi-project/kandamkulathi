import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { videoMembership } from "../../packages/client/src/private-video.ts";
import {
  readVideoProofInvitation,
  videoProofEndpoint,
} from "../../packages/client/src/video-proof-invitation.ts";

/** Server-side synthetic provisioning, never a clinical grant issuer. No client-chosen actor/room. */
export function issueVideoProof({ endpoint, origin, relays, now = Date.now() }) {
  const approvedEndpoint = videoProofEndpoint(endpoint);
  const approvedOrigin = new URL(origin);
  if (approvedOrigin.protocol !== "https:" || approvedOrigin.origin !== origin)
    throw new Error("Explicit HTTPS browser proof origin required");
  const appointmentId = randomUUID();
  const participants = [randomUUID(), randomUUID()];
  const connectionId = randomBytes(32).toString("base64url");
  const expiresAt = now + 300000;
  const members = participants.map((participantId, index) => {
    const ticket = randomBytes(32).toString("base64url");
    const grant = {
      appointmentId,
      revision: "p1-synthetic-v1",
      expiresAt: new Date(expiresAt).toISOString(),
      ticket,
    };
    const membership = videoMembership(
      {
        appointmentId,
        revision: grant.revision,
        participantId,
        peerId: participants[1 - index],
        connectionId,
        notBefore: now,
        expiresAt,
        role: index === 0 ? "offerer" : "answerer",
        relays,
      },
      grant,
      participantId,
      now,
    );
    const { relays: _privateTurn, appointmentId: _id, revision: _revision, ...member } = membership;
    const invitation = readVideoProofInvitation(
      JSON.stringify({ purpose: "p1-synthetic-video", endpoint: approvedEndpoint, grant, member }),
      approvedEndpoint,
      now,
    );
    return { ticket, membership, invitation };
  });
  return {
    config: {
      syntheticOnly: true,
      allowedOrigin: origin,
      members: members.map(({ ticket, membership }) => ({ ticket, membership })),
    },
    invitations: members.map(({ invitation }) => invitation),
  };
}

async function main() {
  if (process.platform === "win32")
    throw new Error("Use a private POSIX server provisioning environment");
  const [directory, endpoint, origin, turnFile, ...extra] = process.argv.slice(2);
  if (!directory || !endpoint || !origin || !turnFile || extra.length)
    throw new Error(
      "Expected private output directory, HTTPS endpoint, HTTPS browser origin, private TURN JSON file",
    );
  const output = resolve(await realpath(dirname(resolve(directory))), basename(resolve(directory)));
  const repo = await realpath(fileURLToPath(new URL("../..", import.meta.url)));
  const location = relative(repo, output);
  if (!isAbsolute(location) && location !== ".." && !location.startsWith(`..${sep}`))
    throw new Error("Private output must be outside repository");
  const input = await readFile(turnFile, "utf8");
  if (input.length > 8192) throw new Error("TURN input too large");
  const issued = issueVideoProof({ endpoint, origin, relays: JSON.parse(input) });
  await mkdir(output, { mode: 0o700 });
  await writeFile(resolve(output, "server-config.json"), JSON.stringify(issued.config), {
    mode: 0o600,
    flag: "wx",
  });
  for (let index = 0; index < issued.invitations.length; index++)
    await writeFile(
      resolve(output, `invitation-${index === 0 ? "a" : "b"}.json`),
      JSON.stringify(issued.invitations[index]),
      { mode: 0o600, flag: "wx" },
    );
  console.log(`Issued private synthetic proof files in ${output}. No credentials were printed.`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => {
    console.error(
      "Synthetic invitation issuance failed. Check private inputs/output permissions; credentials were not printed.",
    );
    process.exitCode = 1;
  });
}
