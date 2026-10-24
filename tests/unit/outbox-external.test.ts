import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type DatabaseContext,
  inTransaction,
  transaction,
} from "../../packages/database/src/client.ts";
import { type ClaimedJob, claimDue, executeClaim } from "../../packages/database/src/outbox.ts";
import { executeExternalClaim } from "../../packages/database/src/outbox-external.ts";

const job: ClaimedJob = {
  id: "00000000-0000-4000-8000-000000000001",
  operationId: "00000000-0000-4000-8000-000000000002",
  subjectId: "00000000-0000-4000-8000-000000000003",
  leaseToken: "00000000-0000-4000-8000-000000000004",
  channel: "financial",
  kind: "commerce.reconcile",
  revision: 1,
  dueAt: new Date("2026-01-01"),
  deadlineAt: new Date("2026-01-02"),
  pickupMs: 0,
};

function fixture() {
  const policy = { valid: true, expired: false, receipt: "", finish: true };
  const query = vi.fn(async (sql: string, _values?: unknown[]) => {
    if (sql.includes("AS valid")) return { rows: [{ ...policy }], command: "SELECT" };
    if (sql.startsWith("SELECT job_id"))
      return { rows: policy.receipt ? [{ job_id: policy.receipt }] : [], command: "SELECT" };
    if (sql.startsWith("INSERT INTO platform.receipts"))
      return { rows: [{ job_id: job.id }], command: "INSERT" };
    if (sql.includes("status = 'succeeded'"))
      return { rows: policy.finish ? [{ id: job.id }] : [], command: "SELECT" };
    if (sql.includes("status = $3"))
      return { rows: policy.finish ? [{ id: job.id }] : [], command: "UPDATE" };
    return { rows: [], command: sql === "COMMIT" ? "COMMIT" : "OK" };
  });
  const context = { client: { query } } as unknown as DatabaseContext;
  return { context, query, policy };
}
afterEach(() => vi.restoreAllMocks());

describe("external outbox orchestration policy (SQL fixture, not PostgreSQL proof)", () => {
  it("commits preflight before effect, passes a ten-second signal, then atomically fences completion", async () => {
    const { context, query } = fixture();
    const timeout = vi.spyOn(AbortSignal, "timeout");
    await expect(
      executeExternalClaim(context, job, async (received, claimed, signal) => {
        expect(received).toBe(context);
        expect(claimed).toBe(job);
        expect(inTransaction(context.client)).toBe(false);
        expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
        expect(signal.aborted).toBe(false);
      }),
    ).resolves.toBe("succeeded");
    expect(timeout).toHaveBeenCalledWith(10_000);
    const [sql, values] = query.mock.calls.find(([sql]) => sql.includes("AS valid")) ?? [];
    expect(values).toEqual([
      job.id,
      job.leaseToken,
      job.operationId,
      job.channel,
      job.kind,
      job.subjectId,
      job.revision,
      job.dueAt,
      job.deadlineAt,
    ]);
    for (const field of [
      "lease_token",
      "lease_until",
      "status",
      "operation_id",
      "channel",
      "kind",
      "subject_id",
      "revision",
      "due_at",
      "deadline_at",
    ])
      expect(sql).toContain(field);
    const completion = query.mock.calls.find(([sql]) => sql.includes("status = 'succeeded'"))?.[0];
    expect(completion).toContain(
      "lease_until > clock_timestamp() AND deadline_at > clock_timestamp()",
    );
    const receiptIndex = query.mock.calls.findIndex(([sql]) =>
      sql.startsWith("INSERT INTO platform.receipts"),
    );
    expect(receiptIndex).toBeGreaterThan(-1);
    expect(receiptIndex).toBeLessThan(
      query.mock.calls.findIndex(([sql]) => sql.includes("status = 'succeeded'")),
    );
  });

  it("rejects an active transaction before issuing any additional SQL", async () => {
    const { context, query } = fixture();
    const handler = vi.fn();
    await transaction(context.client, async () => {
      const count = query.mock.calls.length;
      await expect(executeExternalClaim(context, job, handler)).rejects.toThrow(
        "inside a platform transaction",
      );
      expect(query).toHaveBeenCalledTimes(count);
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(["stale", "expired", "receipted"] as const)(
    "does not invoke effects for %s jobs",
    async (mode) => {
      const { context, policy } = fixture();
      policy.valid = mode !== "stale";
      policy.expired = mode === "expired";
      policy.receipt = mode === "receipted" ? job.id : "";
      const handler = vi.fn();
      await expect(executeExternalClaim(context, job, handler)).resolves.toBe(
        mode === "stale" ? "stale" : mode === "expired" ? "dead" : "succeeded",
      );
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it("rejects a receipt belonging to a different job", async () => {
    const { context, policy } = fixture();
    policy.receipt = job.subjectId;
    await expect(executeExternalClaim(context, job, vi.fn())).rejects.toThrow(
      "receipt does not match",
    );
  });

  it("does not suppress a lease that expires during the short preflight", async () => {
    const { context, policy } = fixture();
    policy.expired = true;
    policy.finish = false;
    const handler = vi.fn();
    await expect(executeExternalClaim(context, job, handler)).resolves.toBe("stale");
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(["exception", "abort", "overrun"] as const)(
    "does not checkpoint %s results",
    async (mode) => {
      const { context, query } = fixture();
      const controller = new AbortController();
      vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
      const now = vi.spyOn(performance, "now").mockReturnValue(0);
      await expect(
        executeExternalClaim(context, job, async () => {
          if (mode === "exception") throw new Error("uncertain provider");
          if (mode === "abort") controller.abort();
          if (mode === "overrun") now.mockReturnValue(10_001);
        }),
      ).rejects.toThrow();
      expect(query.mock.calls.filter(([sql]) => sql.includes("AS valid"))).toHaveLength(1);
      expect(
        query.mock.calls.some(([sql]) => sql.startsWith("INSERT INTO platform.receipts")),
      ).toBe(false);
    },
  );

  it.each(["lease", "deadline", "final-clock"] as const)(
    "does not acknowledge after %s changes",
    async (mode) => {
      const { context, query, policy } = fixture();
      await expect(
        executeExternalClaim(context, { ...job, kind: "platform.probe" }, async () => {
          if (mode === "lease") policy.valid = false;
          if (mode === "deadline") policy.expired = true;
          if (mode === "final-clock") policy.finish = false;
        }),
      ).resolves.toBe("stale");
      expect(query.mock.calls.some(([sql]) => sql.includes("status = 'suppressed'"))).toBe(false);
      if (mode === "final-clock") expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    },
  );

  it("dead-letters an expired financial obligation after effect without a success receipt", async () => {
    const { context, policy, query } = fixture();
    await expect(
      executeExternalClaim(context, job, async () => {
        policy.expired = true;
      }),
    ).resolves.toBe("dead");
    expect(query.mock.calls.some(([sql]) => sql.startsWith("INSERT INTO platform.receipts"))).toBe(
      false,
    );
    expect(query.mock.calls.find(([sql]) => sql.includes("status = $3"))?.[1]).toEqual([
      job.id,
      job.leaseToken,
      "dead",
      "financial_review_required",
    ]);
  });

  it("preserves ordinary pre-effect deadline suppression", async () => {
    const { context, policy } = fixture();
    policy.expired = true;
    await expect(
      executeExternalClaim(context, { ...job, kind: "platform.probe" }, vi.fn()),
    ).resolves.toBe("suppressed");
  });

  it("transactional expiry marks financial work dead without domain execution", async () => {
    const { context, policy, query } = fixture();
    policy.expired = true;
    const decide = vi.fn();
    const apply = vi.fn();
    await expect(
      executeClaim(context, job, { "commerce.reconcile": { decide, apply } }),
    ).resolves.toBe("dead");
    expect(decide).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    expect(query.mock.calls.find(([sql]) => sql.includes("status = $3"))?.[1]).toEqual([
      job.id,
      "financial_review_required",
      "dead",
    ]);
  });

  it("deadline sweep SQL distinguishes financial review from ordinary suppression", async () => {
    const { context, query } = fixture();
    await expect(claimDue(context.client)).resolves.toEqual([]);
    const sweep = query.mock.calls.find(([sql]) => sql.includes("WITH expired"))?.[0];
    expect(sweep).toContain(
      "CASE WHEN o.kind = 'commerce.reconcile' THEN 'dead' ELSE 'suppressed' END",
    );
    expect(sweep).toContain("'financial_review_required' ELSE 'deadline_elapsed'");
  });
});
