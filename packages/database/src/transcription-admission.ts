import { z } from "zod";
import { type DatabaseClient, inTransaction } from "./client";

const ticketSchema = z.strictObject({
  actorId: z.uuid(),
  operationId: z.uuid(),
  fence: z.uuid(),
  policyVersion: z.string().min(1).max(128),
});
export type TranscriptionTicket = z.infer<typeof ticketSchema>;
const statusSchema = z.enum([
  "admitted",
  "allowed",
  "released",
  "denied",
  "not-configured",
  "rate-limited",
  "unknown",
]);

/** Only inside the caller's canonical identity transaction (or token-only cleanup).
 * Never retries reservations, resets quota, provisions capability or reclaims expired leases.
 */
export async function transcriptionAdmission(
  client: DatabaseClient,
  action: "reserve" | "check" | "complete" | "uncertain",
  input: TranscriptionTicket,
) {
  if (!inTransaction(client)) throw new Error("Transcription admission requires transaction");
  const ticket = ticketSchema.parse(input);
  const result = await client.query(
    "SELECT core.transcription_admission($1,$2,$3,$4,$5) AS status",
    [action, ticket.actorId, ticket.operationId, ticket.fence, ticket.policyVersion],
  );
  return statusSchema.parse(result.rows[0]?.status);
}
