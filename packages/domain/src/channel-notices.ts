import type { NoticeCapability } from "../../contracts/src/channel-notices.ts";
import type { WhatsAppInboxEvent } from "../../contracts/src/channels.ts";

/** Signed sender identity authorizes only this approved test notice, never an application account. */
export function maySubmitNotice(
  capability: NoticeCapability,
  event: WhatsAppInboxEvent,
  nowMs: number,
): boolean {
  const eventMs = Number(event.occurredAtSeconds) * 1000;
  return (
    capability.enabled &&
    capability.used < capability.maxNotices &&
    nowMs < Date.parse(capability.expiresAt) &&
    eventMs >= Date.parse(capability.notBefore) &&
    eventMs <= nowMs &&
    nowMs - eventMs <= capability.maxEventAgeSeconds * 1000 &&
    event.kind === "text" &&
    event.businessAccountId === capability.businessAccountId &&
    event.receivingPhoneNumberId === capability.phoneNumberId &&
    event.senderId === capability.recipientId
  );
}
