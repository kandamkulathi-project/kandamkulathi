import { expect, it, vi } from "vitest";
import type { DatabaseClient } from "../../packages/database/src/client";
import { transaction } from "../../packages/database/src/client";
import { transcriptionAdmission } from "../../packages/database/src/transcription-admission";
import { ids } from "./identity-fixtures";

const ticket = {
  actorId: ids.actor,
  operationId: ids.other,
  fence: ids.session,
  policyVersion: "synthetic-policy-only",
};
it("requires a transaction, validates admission tickets/status, and never retries", async () => {
  const query = vi.fn(async (sql: string) => ({
    rows: [{ status: "admitted" }],
    command: sql === "COMMIT" ? "COMMIT" : "",
  }));
  const client = { query } as unknown as DatabaseClient;
  await expect(transcriptionAdmission(client, "reserve", ticket)).rejects.toThrow("transaction");
  expect(query).not.toHaveBeenCalled();
  expect(await transaction(client, () => transcriptionAdmission(client, "reserve", ticket))).toBe(
    "admitted",
  );
  expect(query).toHaveBeenCalledWith(
    "SELECT core.transcription_admission($1,$2,$3,$4,$5) AS status",
    ["reserve", ticket.actorId, ticket.operationId, ticket.fence, ticket.policyVersion],
  );
  const count = query.mock.calls.length;
  await expect(
    transaction(client, () =>
      transcriptionAdmission(client, "reserve", { ...ticket, actorId: "foreign" }),
    ),
  ).rejects.toThrow();
  expect(query.mock.calls.slice(count).map(([sql]) => sql)).toEqual([
    "BEGIN",
    "SET LOCAL statement_timeout = '5s'",
    "SET LOCAL lock_timeout = '2s'",
    "SET LOCAL idle_in_transaction_session_timeout = '5s'",
    "ROLLBACK",
  ]);
  query.mockImplementation(async (sql: string) => ({
    rows: [{ status: "invented-success" }],
    command: sql === "COMMIT" ? "COMMIT" : "",
  }));
  await expect(
    transaction(client, () => transcriptionAdmission(client, "reserve", ticket)),
  ).rejects.toThrow();
  expect(query.mock.calls.slice(-1)[0]?.[0]).toBe("ROLLBACK");
  query.mockImplementation(async () => {
    throw new Error("synthetic database unavailable");
  });
  await expect(
    transaction(client, () => transcriptionAdmission(client, "reserve", ticket)),
  ).rejects.toThrow();
  expect(query.mock.calls.slice(-1)[0]?.[0]).toBe("BEGIN");
});
