import { grant as baseGrant, membership as baseMember, now } from "../video-proof/fixtures";

export { now };
export const endpoint = "https://signal.example.test/p1-private-video-proof";
export const membership = {
  ...baseMember,
  participantId: "22222222-2222-4222-8222-222222222222",
  peerId: "33333333-3333-4333-8333-333333333333",
};
export const grant = baseGrant;
export const invitation = {
  purpose: "p1-synthetic-video",
  endpoint,
  grant,
  member: {
    participantId: membership.participantId,
    peerId: membership.peerId,
    connectionId: membership.connectionId,
    notBefore: membership.notBefore,
    expiresAt: membership.expiresAt,
    role: membership.role,
  },
};
export const rawInvitation = JSON.stringify(invitation);
