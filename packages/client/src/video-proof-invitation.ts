import { type VideoGrant, videoGrantSchema } from "@kandamkulathi/contracts/sensitive";
import { type AuthorizedVideoSignaling, videoMembership } from "./private-video.ts";
import { technicalVideoSignaling } from "./private-video-http.ts";

export interface SyntheticVideoInvitation {
  readonly purpose: "p1-synthetic-video";
  readonly endpoint: string;
  readonly grant: Readonly<VideoGrant>;
  readonly member: Readonly<{
    participantId: string;
    peerId: string;
    connectionId: string;
    notBefore: number;
    expiresAt: number;
    role: "offerer" | "answerer";
  }>;
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]) =>
  Object.keys(value).length === expected.length &&
  expected.every((key) => Object.hasOwn(value, key));
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

export function videoProofEndpoint(value: unknown): string {
  if (typeof value !== "string" || value.length > 512)
    throw new Error("Proof endpoint unavailable");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/p1-private-video-proof"
  )
    throw new Error("Proof endpoint unavailable");
  return url.href;
}

/** Strict in-memory invitation; no TURN credentials, patient names or arbitrary additional fields. */
export function readVideoProofInvitation(
  raw: string,
  endpoint: string,
  now = Date.now(),
): SyntheticVideoInvitation {
  if (!raw || raw.length > 4096) throw new Error("Invalid synthetic invitation");
  const value: unknown = JSON.parse(raw);
  if (
    !object(value) ||
    !keys(value, ["purpose", "endpoint", "grant", "member"]) ||
    value.purpose !== "p1-synthetic-video" ||
    value.endpoint !== videoProofEndpoint(endpoint) ||
    !object(value.member) ||
    !keys(value.member, [
      "participantId",
      "peerId",
      "connectionId",
      "notBefore",
      "expiresAt",
      "role",
    ])
  )
    throw new Error("Invalid synthetic invitation");
  const grant = videoGrantSchema.parse(value.grant);
  const member = value.member;
  if (
    !uuid(member.participantId) ||
    !uuid(member.peerId) ||
    member.participantId === member.peerId ||
    typeof member.connectionId !== "string" ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(member.connectionId) ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(grant.ticket) ||
    !Number.isSafeInteger(member.notBefore) ||
    !Number.isSafeInteger(member.expiresAt) ||
    Number(member.notBefore) > now ||
    Number(member.expiresAt) <= now ||
    Number(member.expiresAt) - now > 300000 ||
    Number(member.expiresAt) - Number(member.notBefore) > 300000 ||
    Number(member.expiresAt) !== Date.parse(grant.expiresAt) ||
    (member.role !== "offerer" && member.role !== "answerer")
  )
    throw new Error("Synthetic invitation unavailable");
  return Object.freeze({
    purpose: "p1-synthetic-video",
    endpoint: videoProofEndpoint(endpoint),
    grant: Object.freeze(grant),
    member: Object.freeze({
      participantId: member.participantId,
      peerId: member.peerId,
      connectionId: member.connectionId,
      notBefore: Number(member.notBefore),
      expiresAt: Number(member.expiresAt),
      role: member.role,
    }),
  });
}

/** Metadata is pinned, never trusted as server authority: server must recognize the opaque ticket. */
export function invitedVideoSignaling(
  invitation: SyntheticVideoInvitation,
  now = Date.now,
  transport: AuthorizedVideoSignaling = technicalVideoSignaling(invitation.endpoint),
): AuthorizedVideoSignaling {
  return {
    async open(grant, signal) {
      if (
        grant.ticket !== invitation.grant.ticket ||
        grant.appointmentId !== invitation.grant.appointmentId ||
        grant.revision !== invitation.grant.revision ||
        grant.expiresAt !== invitation.grant.expiresAt ||
        invitation.member.notBefore > now() ||
        invitation.member.expiresAt <= now()
      )
        throw new Error("Synthetic invitation unavailable");
      const session = await transport.open(grant, signal);
      try {
        const member = videoMembership(
          session.membership,
          grant,
          invitation.member.participantId,
          now(),
        );
        for (const key of [
          "participantId",
          "peerId",
          "connectionId",
          "notBefore",
          "expiresAt",
          "role",
        ] as const)
          if (member[key] !== invitation.member[key])
            throw new Error("Synthetic membership mismatch");
        return session;
      } catch (error) {
        session.close();
        throw error;
      }
    },
  };
}
