import { describe, expect, it } from "vitest";
import { hasCurrentConsent } from "../../packages/server/src/authorization-consent";
import {
  after,
  before,
  consultationConsent,
  ids,
  instant,
  now,
  privacyConsent,
} from "./identity-fixtures";

const privacy = { purpose: "privacy", actorId: ids.actor, version: "privacy-v1" };
describe("independent versioned consent decisions", () => {
  it("does not bundle optional marketing with required privacy consent", () => {
    const record = privacyConsent();
    expect(hasCurrentConsent([record], privacy, now)).toBe(true);
    expect(hasCurrentConsent([record], { ...privacy, purpose: "marketing" }, now)).toBe(false);
    const marketing = { ...record, purpose: "marketing", decision: "declined" };
    expect(hasCurrentConsent([record, marketing], privacy, now)).toBe(true);
    expect(hasCurrentConsent([marketing], privacy, now)).toBe(false);
    expect(
      hasCurrentConsent(
        [{ ...marketing, decision: "granted" }],
        { ...privacy, purpose: "marketing" },
        now,
      ),
    ).toBe(true);
  });
  it.each([
    { decision: "declined" },
    { version: "old" },
    { revokedAt: before },
    { revokedAt: after },
    { expiresAt: instant },
    { decidedAt: after },
    { actorId: ids.other },
    { recordedByActorId: ids.other },
    { decidedAt: "invalid" },
    { arbitraryPolicy: true },
  ])(
    "denies missing, stale, revoked, expired, future, delegated or malformed consent %j",
    (override) => {
      expect(hasCurrentConsent([{ ...privacyConsent(), ...override }], privacy, now)).toBe(false);
    },
  );
  it("does not resurrect an earlier grant after a newer decline or changed version", () => {
    const earlier = privacyConsent();
    for (const latest of [
      { ...earlier, id: ids.assignment, decidedAt: instant, decision: "declined" },
      { ...earlier, id: ids.assignment, decidedAt: instant, version: "privacy-v2" },
      { ...earlier, id: ids.assignment, decidedAt: instant, revokedAt: instant },
    ]) {
      expect(hasCurrentConsent([latest, earlier], privacy, now)).toBe(false);
      expect(hasCurrentConsent([earlier, latest], privacy, now)).toBe(false);
    }
  });
  it.each(["declined", "revoked"] as const)(
    "does not resurrect privacy consent when the later %s decision spells the same actor in uppercase",
    (decision) => {
      const earlier = privacyConsent();
      const latest = {
        ...earlier,
        id: ids.assignment.toUpperCase(),
        actorId: earlier.actorId.toUpperCase(),
        recordedByActorId: earlier.actorId.toUpperCase(),
        decidedAt: instant,
        ...(decision === "declined" ? { decision: "declined" } : { revokedAt: instant }),
      };
      for (const records of [
        [earlier, latest],
        [latest, earlier],
      ]) {
        expect(hasCurrentConsent(records, privacy, now)).toBe(false);
        expect(
          hasCurrentConsent(records, { ...privacy, actorId: ids.actor.toUpperCase() }, now),
        ).toBe(false);
      }
    },
  );
  it.each(["actorId", "patientId", "clinicId", "consultationId"] as const)(
    "does not exclude a later clinical decline/revocation on mixed-case %s",
    (field) => {
      const earlier = consultationConsent();
      const requirement = {
        purpose: "consultation",
        version: earlier.version,
        actorId: earlier.actorId,
        patientId: earlier.patientId,
        clinicId: earlier.clinicId,
        consultationId: earlier.consultationId,
      };
      for (const change of [{ decision: "declined" }, { revokedAt: instant }]) {
        const latest = {
          ...earlier,
          id: ids.assignment,
          decidedAt: instant,
          [field]: earlier[field].toUpperCase(),
          ...change,
        };
        for (const records of [
          [earlier, latest],
          [latest, earlier],
        ]) {
          expect(hasCurrentConsent(records, requirement, now)).toBe(false);
          expect(
            hasCurrentConsent(
              records,
              { ...requirement, [field]: earlier[field].toUpperCase() },
              now,
            ),
          ).toBe(false);
        }
      }
    },
  );
  it("matches mixed-case privacy subject and recorder without authorizing a different actor", () => {
    const record = privacyConsent();
    expect(hasCurrentConsent([{ ...record, actorId: ids.actor.toUpperCase() }], privacy, now)).toBe(
      true,
    );
    expect(
      hasCurrentConsent([{ ...record, recordedByActorId: ids.actor.toUpperCase() }], privacy, now),
    ).toBe(true);
    expect(hasCurrentConsent([record], { ...privacy, actorId: ids.actor.toUpperCase() }, now)).toBe(
      true,
    );
    expect(hasCurrentConsent([record], { ...privacy, actorId: ids.other.toUpperCase() }, now)).toBe(
      false,
    );
    expect(
      hasCurrentConsent([{ ...record, recordedByActorId: ids.other.toUpperCase() }], privacy, now),
    ).toBe(false);
  });
  it.each(["actorId", "patientId", "clinicId", "consultationId"] as const)(
    "matches independent mixed-case consultation %s but rejects a genuinely different scope",
    (field) => {
      const record = consultationConsent();
      const requirement = {
        purpose: "consultation",
        version: record.version,
        actorId: record.actorId,
        patientId: record.patientId,
        clinicId: record.clinicId,
        consultationId: record.consultationId,
      };
      expect(
        hasCurrentConsent([{ ...record, [field]: record[field].toUpperCase() }], requirement, now),
      ).toBe(true);
      expect(
        hasCurrentConsent([record], { ...requirement, [field]: record[field].toUpperCase() }, now),
      ).toBe(true);
      expect(
        hasCurrentConsent([record], { ...requirement, [field]: ids.other.toUpperCase() }, now),
      ).toBe(false);
    },
  );
  it("denies conflicting simultaneous decisions even with different UTC formatting", () => {
    const record = privacyConsent();
    const conflict = { ...record, id: ids.assignment, decidedAt: "2026-10-23T09:00:00Z" };
    expect(hasCurrentConsent([record, conflict], privacy, now)).toBe(false);
  });
  it("requires exact patient, clinic, consultation and subject for clinical consent", () => {
    const record = consultationConsent();
    const requirement = {
      purpose: "consultation",
      version: record.version,
      actorId: ids.patientActor,
      patientId: ids.patient,
      clinicId: ids.clinic,
      consultationId: ids.consultation,
    };
    expect(hasCurrentConsent([record], requirement, now)).toBe(true);
    for (const key of ["actorId", "patientId", "clinicId", "consultationId"] as const) {
      expect(hasCurrentConsent([record], { ...requirement, [key]: ids.other }, now)).toBe(false);
    }
    expect(hasCurrentConsent([privacyConsent()], requirement, now)).toBe(false);
  });
  it("denies missing input or invalid current time", () => {
    expect(hasCurrentConsent([], privacy, now)).toBe(false);
    expect(hasCurrentConsent(null, privacy, now)).toBe(false);
    expect(hasCurrentConsent([privacyConsent()], {}, now)).toBe(false);
    expect(hasCurrentConsent([privacyConsent()], privacy, Number.NaN)).toBe(false);
  });
});
