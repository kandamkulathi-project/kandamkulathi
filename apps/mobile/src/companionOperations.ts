import { companionIntent } from "@kandamkulathi/client/knowledge";
import type { SensitiveClient, SensitiveResult } from "@kandamkulathi/client/sensitive";
import type { Locale } from "@kandamkulathi/i18n";

/** Session-scoped caller identities, not server authorization or durable reconciliation. */
export function nativeCompanionOperations(
  client: Pick<SensitiveClient, "chat" | "requestHandoff">,
  uuid: () => string,
) {
  const chat = companionIntent(uuid);
  const handoff = companionIntent(uuid);
  let busy = false;
  async function run<T>(
    intent: ReturnType<typeof companionIntent>,
    key: string,
    action: (id: string) => Promise<SensitiveResult<T>>,
  ): Promise<SensitiveResult<T>> {
    if (busy) return { status: "busy" };
    const id = intent.reserve(key);
    busy = true;
    try {
      const result = await action(id);
      intent.finish(id, result.status);
      return result;
    } catch {
      // A thrown transport/adapter failure cannot prove that no effect occurred.
      return { status: "unknown" };
    } finally {
      busy = false;
    }
  }
  return {
    send(message: string, locale: Locale) {
      return run(chat, JSON.stringify([locale, message]), (operationId) =>
        client.chat({ operationId, message, locale }),
      );
    },
    requestHandoff(locale: Locale) {
      return run(handoff, locale, (operationId) => client.requestHandoff(operationId, locale));
    },
  };
}
