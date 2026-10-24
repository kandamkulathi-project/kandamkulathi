import { type KnowledgeRecord, knowledgeRecordSchema } from "@kandamkulathi/contracts/knowledge";
import { AuthoringRejection } from "./authoring-port";
import { type ContentReader, parseContent } from "./model";

/** UI states, not an HTTP response or company permission schema. */
export type AuthoringAttemptState =
  | {
      status:
        | "checking"
        | "submitting"
        | "reloading"
        | "denied"
        | "conflict"
        | "invalid"
        | "error"
        | "unknown"
        | "pending"
        | "oversized";
    }
  | { status: "ready"; record: KnowledgeRecord };

/**
 * Trusted integration seam only. The backend owner must supply exact source-grant/receipt
 * codecs and current actor/record/scope/expiry checks. Workspace membership is not authority.
 * No transport schema, endpoint, permission matrix, CSRF or idempotency semantics are invented here.
 */
export interface PreparedAuthoringAttempt {
  checkCurrentAuthority(signal: AbortSignal): Promise<boolean>;
  /** Already bound to one operation identity when required by the backend contract. Never retried. */
  submit(signal: AbortSignal): Promise<unknown>;
  /** Exact backend response validation must precede returning a persisted record. */
  persistedRecord(response: unknown): KnowledgeRecord | null;
  readCurrent: ContentReader;
}

/**
 * One scoped lane; invalidate synchronously on session/record/port changes or lifecycle cleanup.
 * The eventual authoring adapter supplies prepared operations only after validating source grants.
 * No success is published from a candidate or receipt alone: a fresh matching read is mandatory.
 */
export function createAuthoringLane(
  publish: (state: AuthoringAttemptState) => void,
  timeoutMs = 5000,
) {
  let live = true;
  let busy = false;
  let generation = 0;
  let cancelCurrent: (() => void) | undefined;
  return {
    invalidate() {
      live = false;
      generation++;
      cancelCurrent?.();
    },
    async run(operation: PreparedAuthoringAttempt): Promise<boolean> {
      if (!live || busy) return false;
      busy = true;
      const ticket = ++generation;
      const controller = new AbortController();
      let dispatched = false;
      let current = true;
      const valid = () => live && current && ticket === generation;
      const timer = setTimeout(() => {
        if (!valid()) return;
        current = false;
        controller.abort();
        // A timeout after dispatch cannot establish whether the server committed.
        publish({ status: dispatched ? "unknown" : "error" });
      }, timeoutMs);
      cancelCurrent = () => {
        current = false;
        controller.abort();
        clearTimeout(timer);
      };
      publish({ status: "checking" });
      try {
        const authorized = await operation.checkCurrentAuthority(controller.signal);
        if (!valid()) return true;
        if (!authorized) {
          publish({ status: "denied" });
          return true;
        }
        dispatched = true;
        publish({ status: "submitting" });
        const response = await operation.submit(controller.signal);
        if (!valid()) return true;
        const record = knowledgeRecordSchema.safeParse(operation.persistedRecord(response));
        if (!record.success) {
          publish({ status: "unknown" });
          return true;
        }
        publish({ status: "reloading" });
        const reloaded = parseContent(await operation.readCurrent(controller.signal));
        if (!valid()) return true;
        if (reloaded.status !== "ready") {
          publish({
            status:
              reloaded.status === "denied" || reloaded.status === "anonymous"
                ? "denied"
                : "unknown",
          });
          return true;
        }
        if (JSON.stringify(record.data) !== JSON.stringify(reloaded.record)) {
          publish({ status: "conflict" });
          return true;
        }
        publish({ status: "ready", record: reloaded.record });
        return true;
      } catch (error) {
        if (valid())
          publish({
            status:
              error instanceof AuthoringRejection
                ? error.outcome
                : dispatched
                  ? "unknown"
                  : "error",
          });
        return true;
      } finally {
        current = false;
        clearTimeout(timer);
        // A failed/uncertain mutation cannot be retried in this lane. Reconciliation requires
        // a new explicitly refreshed context/authority, never an automatic mutation retry.
        if (ticket === generation) cancelCurrent = undefined;
      }
    },
  };
}
