import { videoGrantSchema } from "@kandamkulathi/contracts/sensitive";
import { videoDescription, videoMembership } from "../../../packages/client/src/private-video";

/** Dedicated, synthetic-only DO proof entry; NEVER mount in the clinical Core router.
 * No booking/consent/identity decisions. Operator-provisioned secret keys authorize exactly two
 * synthetic participants, one connection and <=5 minutes. SDP is memory-only; nothing is logged.
 * Persisted one-start marker in the DO wrapper prevents reuse after process eviction. */
export interface TechnicalVideoConfig {
  syntheticOnly: true;
  allowedOrigin: string;
  members: [{ ticket: string; membership: unknown }, { ticket: string; membership: unknown }];
}

function validatedMembers(config: TechnicalVideoConfig, now: () => number) {
  if (
    config.syntheticOnly !== true ||
    config.members.length !== 2 ||
    config.members[0].ticket === config.members[1].ticket ||
    !config.members.every((member) => /^[A-Za-z0-9_-]{43,128}$/.test(member.ticket))
  )
    throw new Error("Isolated synthetic video configuration required");
  const origin = new URL(config.allowedOrigin);
  if (origin.protocol !== "https:" || origin.origin !== config.allowedOrigin)
    throw new Error("Explicit HTTPS proof origin required");
  const members = config.members.map((member) => {
    const input = member.membership as Record<string, unknown>;
    const grant = videoGrantSchema.parse({
      appointmentId: input.appointmentId,
      revision: input.revision,
      expiresAt: new Date(Number(input.expiresAt)).toISOString(),
      ticket: member.ticket,
    });
    if (Date.parse(grant.expiresAt) - now() > 300000) throw new Error("Proof window too long");
    return {
      ticket: member.ticket,
      grant,
      membership: videoMembership(input, grant, String(input.participantId), now()),
    };
  });
  const a = members[0],
    b = members[1];
  if (!a || !b) throw new Error("Two proof members required");
  if (
    a.membership.peerId !== b.membership.participantId ||
    b.membership.peerId !== a.membership.participantId ||
    a.membership.connectionId !== b.membership.connectionId ||
    a.membership.role === b.membership.role ||
    a.grant.appointmentId !== b.grant.appointmentId ||
    a.grant.revision !== b.grant.revision ||
    a.membership.expiresAt !== b.membership.expiresAt
  )
    throw new Error("Mismatched proof pair");
  return members;
}

function proofReply(config: TechnicalVideoConfig, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": config.allowedOrigin,
      Vary: "Origin",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

/** Run at the public boundary BEFORE resolving/instantiating a DO. No body or state consumed. */
export function technicalVideoPreflight(
  config: TechnicalVideoConfig,
  request: Request,
  now = Date.now,
): Response | undefined {
  let members: ReturnType<typeof validatedMembers>;
  try {
    members = validatedMembers(config, now);
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const url = new URL(request.url);
  if (
    url.pathname !== "/p1-private-video-proof" ||
    url.search ||
    (request.headers.has("origin") && request.headers.get("origin") !== config.allowedOrigin)
  )
    return proofReply(config, null, 403);
  if (request.method === "OPTIONS") return proofReply(config, null);
  if (
    request.method !== "POST" ||
    !members.some((member) => request.headers.get("authorization") === `Bearer ${member.ticket}`)
  )
    return proofReply(config, null, 403);
  return undefined;
}

export function technicalVideoRoom(
  config: TechnicalVideoConfig,
  now = Date.now,
  acceptFirstJoin: () => Promise<void> = async () => {},
) {
  const members = validatedMembers(config, now);
  const joined = new Set<number>();
  const sent = new Set<number>();
  const inbox = new Map<number, unknown>();
  let closed = false;
  let requests = 0;
  return async (request: Request): Promise<Response> => {
    const reply = (body: unknown, status = 200) => proofReply(config, body, status);
    const url = new URL(request.url);
    if (
      url.pathname !== "/p1-private-video-proof" ||
      url.search ||
      (request.headers.has("origin") && request.headers.get("origin") !== config.allowedOrigin)
    )
      return reply(null, 403);
    if (request.method === "OPTIONS") return reply(null);
    const index = members.findIndex(
      (member) => request.headers.get("authorization") === `Bearer ${member.ticket}`,
    );
    if (request.method !== "POST" || index < 0) return reply(null, 403);
    const member = members[index];
    if (!member) return reply(null, 403);
    if (closed || now() >= member.membership.expiresAt || now() < member.membership.notBefore)
      return reply(null, 403);
    // Fixed total ceiling bounds polling/abuse for this deliberately short-lived two-person proof.
    if (++requests > 4000) {
      closed = true;
      inbox.clear();
      return reply(null, 429);
    }
    const reader = request.body?.getReader();
    if (!reader) return reply(null, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 70000) {
        await reader.cancel();
        return reply(null, 413);
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder().decode(bytes);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return reply(null, 400);
    }
    if (typeof body !== "object" || body === null) return reply(null, 400);
    const input = body as Record<string, unknown>;
    // Recheck after streamed input too: a slow request must not act past the hard deadline.
    if (closed || now() >= member.membership.expiresAt || now() < member.membership.notBefore)
      return reply(null, 403);
    if (
      input.appointmentId !== member.grant.appointmentId ||
      input.revision !== member.grant.revision
    )
      return reply(null, 403);
    if (input.action === "join") {
      if (joined.has(index)) return reply(null, 409);
      // Reserve synchronously before awaiting persistence: concurrent copies cannot both join.
      joined.add(index);
      try {
        await acceptFirstJoin();
      } catch {
        closed = true;
        inbox.clear();
        return reply(null, 503);
      }
      if (closed || now() >= member.membership.expiresAt) return reply(null, 403);
      return reply(member.membership);
    }
    if (!joined.has(index)) return reply(null, 403);
    if (input.action === "leave") {
      closed = true;
      inbox.clear();
      return reply(null);
    }
    if (input.action === "status") return reply(null);
    if (input.action === "receive") {
      const value = inbox.get(index) ?? null;
      inbox.delete(index);
      return reply(value);
    }
    if (input.action === "send") {
      if (sent.has(index)) return reply(null, 409);
      try {
        const description = videoDescription(
          input.description,
          member.membership.role === "offerer" ? "offer" : "answer",
        );
        sent.add(index);
        inbox.set(1 - index, description);
        return reply(null);
      } catch {
        return reply(null, 400);
      }
    }
    return reply(null, 400);
  };
}
