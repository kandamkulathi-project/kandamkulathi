import { integer, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
// Domain tables and clinical access policies remain owned by Mathew/Josin.
export const core = pgSchema("core");
export const clinical = pgSchema("clinical");
export const engagement = pgSchema("engagement");
export const platform = pgSchema("platform");

/** Opaque references only: patient details, message text and payment credentials never enter transport. */
export const outbox = platform.table(
  "outbox",
  {
    id: uuid().primaryKey(),
    operationId: uuid("operation_id").notNull(),
    channel: text().notNull(),
    kind: text().notNull(),
    subjectId: uuid("subject_id").notNull(),
    revision: integer().notNull(),
    status: text().notNull().default("pending"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    leaseToken: uuid("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    publishAttempts: integer("publish_attempts").notNull().default(0),
    executionAttempts: integer("execution_attempts").notNull().default(0),
    failureCode: text("failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("outbox_operation_kind").on(table.operationId, table.kind)],
);

export const receipts = platform.table(
  "receipts",
  {
    operationId: uuid("operation_id").notNull(),
    kind: text().notNull(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => outbox.id),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("receipt_operation_kind").on(table.operationId, table.kind)],
);

/** Synthetic probe only. This is not a notification, clinical action or financial effect. */
export const probeEffects = platform.table("probe_effects", {
  operationId: uuid("operation_id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
