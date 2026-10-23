CREATE SCHEMA "clinical";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "engagement";
--> statement-breakpoint
CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE TABLE "platform"."outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"operation_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"kind" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"publish_attempts" integer DEFAULT 0 NOT NULL,
	"execution_attempts" integer DEFAULT 0 NOT NULL,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform"."probe_effects" (
	"operation_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."receipts" (
	"operation_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"job_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform"."receipts" ADD CONSTRAINT "receipts_job_id_outbox_id_fk" FOREIGN KEY ("job_id") REFERENCES "platform"."outbox"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_operation_kind" ON "platform"."outbox" USING btree ("operation_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_operation_kind" ON "platform"."receipts" USING btree ("operation_id","kind");