import { z } from "zod";
import type { NoticeProvider } from "../../contracts/src/channel-notices.ts";

const receiptSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  contacts: z.array(z.object({ input: z.string(), wa_id: z.string() })).length(1),
  messages: z.array(z.object({ id: z.string().regex(/^[A-Za-z0-9_.=+-]{1,256}$/) })).length(1),
});

/** Actual Graph HTTP adapter; the template has no parameters, links or generated/free text. */
export function whatsappNoticeProvider(options: {
  accessToken: string;
  graphVersion: string;
  /** Injection is for synthetic loopback HTTP tests only; runtime always uses graph.facebook.com. */
  fetch?: typeof fetch;
}): NoticeProvider {
  if (!options.accessToken || !/^v\d{2}\.0$/.test(options.graphVersion))
    throw new Error("Notice provider unavailable.");
  const request = options.fetch ?? fetch;
  return {
    async send(input, signal) {
      try {
        signal.throwIfAborted();
        const response = await request(
          `https://graph.facebook.com/${options.graphVersion}/${input.phoneNumberId}/messages`,
          {
            method: "POST",
            redirect: "error",
            signal,
            headers: {
              Authorization: `Bearer ${options.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: input.recipientId,
              type: "template",
              template: { name: input.templateName, language: { code: input.language } },
              biz_opaque_callback_data: input.operationId,
            }),
          },
        );
        // Bound the response stream, not just Content-Length. Never log a provider body.
        const reader = response.body?.getReader();
        if (!reader) return { state: "unknown" };
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
          for (;;) {
            signal.throwIfAborted();
            const part = await reader.read();
            if (part.done) break;
            length += part.value.length;
            if (length > 16384) {
              await reader.cancel();
              return { state: "unknown" };
            }
            chunks.push(part.value);
          }
        } finally {
          reader.releaseLock();
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        signal.throwIfAborted();
        // Only a structured explicit client rejection is known not to have been accepted.
        const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
        if (!response.ok) {
          const rejected = z
            .object({ error: z.object({ code: z.number().int() }) })
            .safeParse(body);
          return response.status >= 400 && response.status < 500 && rejected.success
            ? { state: "rejected" }
            : { state: "unknown" };
        }
        const parsed = receiptSchema.safeParse(body);
        if (
          !parsed.success ||
          parsed.data.contacts[0]?.input !== input.recipientId ||
          parsed.data.contacts[0]?.wa_id !== input.recipientId
        )
          return { state: "unknown" };
        const message = parsed.data.messages[0];
        return message
          ? { state: "accepted", providerMessageId: message.id }
          : { state: "unknown" };
      } catch {
        return { state: "unknown" };
      }
    },
  };
}
