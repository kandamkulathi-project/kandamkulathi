import { afterEach, describe, expect, it, vi } from "vitest";
import { executeCommerceReconcile } from "../../apps/core-api/src/commerce-jobs";
import { type DatabaseContext, transaction } from "../../packages/database/src/client";
import type { ClaimedJob } from "../../packages/database/src/outbox";

const configured = vi.hoisted(() => vi.fn());
vi.mock("../../apps/core-api/src/commerce-provider", () => ({
  configuredCommercePaymentProvider: configured,
}));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const job: ClaimedJob = {
  id,
  operationId: id,
  subjectId: id,
  channel: "financial",
  kind: "commerce.reconcile",
  revision: 1,
  dueAt: new Date(0),
  deadlineAt: new Date(1),
  leaseToken: id,
  pickupMs: 0,
};
function context(jobs = true, valid = true, review = false) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("pg_has_role")) return { rows: [{ jobs }] };
    if (sql.includes("AS valid")) return { rows: [{ valid }] };
    if (sql.includes("UNION ALL")) return { rows: review ? [{ id }] : [] };
    return { rows: [], command: sql === "COMMIT" ? "COMMIT" : "", rowCount: 0 };
  });
  return { context: { client: { query }, db: {} } as unknown as DatabaseContext, query };
}
afterEach(() => vi.clearAllMocks());
describe("commerce external-work boundary", () => {
  it("denies a non-financial/wrong-kind job before any SQL or provider call", async () => {
    const fixture = context();
    await expect(
      executeCommerceReconcile(fixture.context, { ...job, kind: "platform.probe" }, {}),
    ).rejects.toMatchObject({ code: "denied" });
    expect(fixture.query).not.toHaveBeenCalled();
    expect(configured).not.toHaveBeenCalled();
  });
  it("requires trusted JOBS membership, not a browser actor or supplied verified flag", async () => {
    const fixture = context(false);
    await expect(executeCommerceReconcile(fixture.context, job, {})).rejects.toMatchObject({
      code: "denied",
    });
    expect(configured).not.toHaveBeenCalled();
  });
  it("rejects provider work inside an existing platform transaction", async () => {
    const fixture = context();
    await transaction(fixture.context.client, async () => {
      await expect(executeCommerceReconcile(fixture.context, job, {})).rejects.toMatchObject({
        code: "conflict",
      });
    });
    expect(configured).not.toHaveBeenCalled();
  });
  it("returns stale without contacting a provider or writing effects", async () => {
    const fixture = context(true, false);
    expect(await executeCommerceReconcile(fixture.context, job, {})).toBe("stale");
    expect(configured).not.toHaveBeenCalled();
    expect(fixture.query.mock.calls.some(([sql]) => sql.includes("INSERT"))).toBe(false);
  });
  it("keeps policy-review and unrecognized UUIDs unavailable, never probe-success", async () => {
    for (const review of [true, false]) {
      const fixture = context(true, true, review);
      await expect(executeCommerceReconcile(fixture.context, job, {})).rejects.toMatchObject({
        reason: review ? "policy_review" : "unrecognized",
      });
      expect(fixture.query.mock.calls.some(([sql]) => sql.includes("INSERT"))).toBe(false);
    }
    expect(configured).not.toHaveBeenCalled();
  });
});
