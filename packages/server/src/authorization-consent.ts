import {
  type ConsentRecord,
  type ConsentRequirement,
  consentRecordSchema,
  consentRequirementSchema,
} from "@kandamkulathi/contracts/consent";

function sameScope(record: ConsentRecord, requirement: ConsentRequirement): boolean {
  if (record.purpose !== requirement.purpose || record.actorId !== requirement.actorId)
    return false;
  if (record.purpose === "consultation" && requirement.purpose === "consultation") {
    return (
      record.patientId === requirement.patientId &&
      record.clinicId === requirement.clinicId &&
      record.consultationId === requirement.consultationId
    );
  }
  return true;
}

/** No delegated/guardian consent policy is implied. Ambiguous latest decisions fail closed. */
export function hasCurrentConsent(records: unknown, requirement: unknown, now: number): boolean {
  if (!Number.isFinite(now)) return false;
  const parsedRecords = consentRecordSchema.array().max(1000).safeParse(records);
  const parsedRequirement = consentRequirementSchema.safeParse(requirement);
  if (!parsedRecords.success || !parsedRequirement.success) return false;
  const matching = parsedRecords.data
    .filter((record) => sameScope(record, parsedRequirement.data))
    .sort((left, right) => Date.parse(right.decidedAt) - Date.parse(left.decidedAt));
  const latest = matching[0];
  if (
    !latest ||
    (matching[1] && Date.parse(matching[1].decidedAt) === Date.parse(latest.decidedAt))
  )
    return false;
  return (
    latest.version === parsedRequirement.data.version &&
    latest.recordedByActorId === latest.actorId &&
    latest.decision === "granted" &&
    latest.revokedAt === null &&
    Date.parse(latest.decidedAt) <= now &&
    (latest.expiresAt === null || Date.parse(latest.expiresAt) > now)
  );
}
