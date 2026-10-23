import type { SensitiveResult } from "@kandamkulathi/client/sensitive";
import { saveDraftSchema } from "@kandamkulathi/contracts/knowledge";
import { referenceSchema } from "@kandamkulathi/contracts/sensitive";

type SaveInput = ReturnType<typeof saveDraftSchema.parse>;
type SaveOperation = Readonly<{ input: SaveInput; operationId: string }>;
export type SaveAttempt = Readonly<{ operation: SaveOperation; sequence: number }>;

/** Session-local only: an uncertain save must not become a different operation or payload. */
export function createKnowledgeRecovery() {
  let pending: SaveOperation | undefined;
  let sequence = 0;
  let inFlight = false;
  return {
    get pending() {
      return pending;
    },
    reserve(input: unknown, operationId: string): SaveAttempt | undefined {
      if (inFlight) return;
      if (!pending) {
        const parsed = saveDraftSchema.safeParse(input);
        if (!parsed.success || !referenceSchema.safeParse(operationId).success) return;
        // Parsing copies the document; freezing also protects the snapshot from accidental mutation.
        Object.freeze(parsed.data.document.productIds);
        Object.freeze(parsed.data.document.concernIds);
        Object.freeze(parsed.data.document.safety);
        Object.freeze(parsed.data.document);
        pending = Object.freeze({ input: Object.freeze(parsed.data), operationId });
      }
      inFlight = true;
      return Object.freeze({ operation: pending, sequence: ++sequence });
    },
    finish(attempt: SaveAttempt, status: SensitiveResult<unknown>["status"]) {
      if (!inFlight || attempt.sequence !== sequence || attempt.operation !== pending) return false;
      inFlight = false;
      // Unknown, unavailable and unverifiable responses cannot establish that no write occurred.
      if (["ready", "anonymous", "denied", "conflict", "expired"].includes(status))
        pending = undefined;
      return true;
    },
    clear() {
      sequence++;
      inFlight = false;
      pending = undefined;
    },
  };
}
