import { describe, expect, it } from "vitest";
import { sessionSchema } from "../../packages/contracts/src/client";
import {
  authorizationRequestSchema,
  type CurrentAuthority,
  currentAuthoritySchema,
  type VerifiedIdentity,
  verifiedIdentitySchema,
} from "../../packages/contracts/src/identity";
import {
  authorizeAccess,
  projectSession,
  validateCurrentIdentity,
} from "../../packages/server/src/authorization";
import {
  after,
  before,
  clinicalRequest,
  customerFixture,
  ids,
  instant,
  now,
  physicianAuthority,
  physicianIdentity,
} from "./identity-fixtures";

const forbidden = { allowed: false, status: 403, code: "FORBIDDEN" };
describe("identity/access contracts — synthetic current authority, not WorkOS/RLS proof", () => {
  it.each(["clinical:write", "admin:*", "", "workspace:enter "])(
    "rejects unsupported action %s",
    (action) => {
      expect(authorizationRequestSchema.safeParse({ ...clinicalRequest(), action }).success).toBe(
        false,
      );
    },
  );
  it("rejects unknown authority fields and missing staff organization/clinic", () => {
    const authority = physicianAuthority();
    expect(currentAuthoritySchema.safeParse({ ...authority, role: "admin" }).success).toBe(false);
    for (const key of ["organizationId", "clinicId"] as const) {
      authority.memberships = physicianAuthority().memberships.map((entry) => ({
        ...entry,
        [key]: null,
      }));
      expect(currentAuthoritySchema.safeParse(authority).success).toBe(false);
    }
  });
  it.each(["clinical:read", "consultation:join"] as const)(
    "permits explicitly granted %s with current organization, MFA, assignment and patient consent",
    (action) => {
      expect(
        authorizeAccess(
          physicianIdentity(),
          physicianAuthority(),
          { ...clinicalRequest(), action },
          now,
        ),
      ).toEqual({ allowed: true });
    },
  );
  it.each(["actorId", "sessionId"] as const)(
    "matches independently mixed-case verified/current %s and projects the canonical actor",
    (field) => {
      const identity = physicianIdentity();
      const authority = physicianAuthority();
      const upper = identity[field].toUpperCase();
      expect(upper).not.toBe(identity[field]);
      for (const [verified, current] of [
        [{ ...identity, [field]: upper }, authority],
        [identity, { ...authority, [field]: upper }],
      ]) {
        const result = projectSession(verified, current, now);
        expect(result).toMatchObject({ allowed: true, session: { userId: ids.actor } });
        expect(authorizeAccess(verified, current, clinicalRequest(), now)).toEqual({
          allowed: true,
        });
      }
      expect(
        validateCurrentIdentity(identity, { ...authority, [field]: ids.other.toUpperCase() }, now),
      ).toMatchObject({ allowed: false, status: 503 });
    },
  );
  it("matches organization UUID spelling independently on either side without allowing another organization", () => {
    const identity = physicianIdentity();
    const authority = physicianAuthority();
    expect(
      authorizeAccess(
        { ...identity, organizationId: ids.organization.toUpperCase() },
        authority,
        clinicalRequest(),
        now,
      ),
    ).toEqual({ allowed: true });
    authority.memberships.forEach((membership) => {
      membership.organizationId = ids.organization.toUpperCase();
    });
    expect(authorizeAccess(identity, authority, clinicalRequest(), now)).toEqual({ allowed: true });
    expect(
      authorizeAccess(
        { ...identity, organizationId: ids.other.toUpperCase() },
        authority,
        clinicalRequest(),
        now,
      ),
    ).toEqual(forbidden);
  });
  it("normalizes every identity, authority relationship and private request UUID at schema boundaries", () => {
    const identity = physicianIdentity();
    const authority = physicianAuthority();
    const target = clinicalRequest();
    const uppercaseUuids = (value: unknown): unknown => {
      if (typeof value === "string")
        return /^[a-f0-9-]{36}$/.test(value) ? value.toUpperCase() : value;
      if (Array.isArray(value)) return value.map(uppercaseUuids);
      if (value !== null && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, uppercaseUuids(item)]),
        );
      }
      return value;
    };
    expect(verifiedIdentitySchema.parse(uppercaseUuids(identity))).toEqual(identity);
    expect(currentAuthoritySchema.parse(uppercaseUuids(authority))).toEqual(authority);
    expect(authorizationRequestSchema.parse(uppercaseUuids(target))).toEqual(target);
    expect(
      authorizeAccess(
        uppercaseUuids(identity),
        uppercaseUuids(authority),
        uppercaseUuids(target),
        now,
      ),
    ).toEqual({ allowed: true });
    const customer = customerFixture();
    expect(currentAuthoritySchema.parse(uppercaseUuids(customer.authority))).toEqual(
      customer.authority,
    );
    expect(
      authorizeAccess(
        customer.identity,
        uppercaseUuids(customer.authority),
        { ...clinicalRequest(), workspace: "customer" },
        now,
      ),
    ).toEqual({ allowed: true });
  });
  it.each(["privacy", "consultation"] as const)(
    "enforces the later mixed-case %s decline/revocation through current authority parsing",
    (purpose) => {
      for (const change of [{ decision: "declined" }, { revokedAt: instant }]) {
        const authority = physicianAuthority();
        const earlier = authority.consents.find((record) => record.purpose === purpose);
        if (!earlier) throw new Error("Missing synthetic consent fixture");
        const latest = {
          ...earlier,
          id: ids.assignment.toUpperCase(),
          actorId: earlier.actorId.toUpperCase(),
          recordedByActorId: earlier.recordedByActorId.toUpperCase(),
          decidedAt: instant,
          ...change,
        };
        const current = { ...authority, consents: [...authority.consents, latest] };
        expect(authorizeAccess(physicianIdentity(), current, clinicalRequest(), now)).toEqual(
          forbidden,
        );
        if (purpose === "privacy")
          expect(projectSession(physicianIdentity(), current, now)).toEqual(forbidden);
      }
    },
  );
  it.each(["patientId", "clinicId", "consultationId"] as const)(
    "permits only the same clinical target independently spelled with mixed-case %s",
    (field) => {
      const scope = {
        patientId: ids.patient,
        clinicId: ids.clinic,
        consultationId: ids.consultation,
      };
      const target = { ...clinicalRequest(), [field]: scope[field].toUpperCase() };
      expect(authorizeAccess(physicianIdentity(), physicianAuthority(), target, now)).toEqual({
        allowed: true,
      });
      expect(
        authorizeAccess(
          physicianIdentity(),
          physicianAuthority(),
          { ...target, [field]: ids.other.toUpperCase() },
          now,
        ),
      ).toEqual(forbidden);
    },
  );
  const sessionCases: [
    string,
    (identity: VerifiedIdentity, authority: CurrentAuthority) => void,
    number,
  ][] = [
    [
      "expired credential",
      (identity) => {
        identity.expiresAt = instant;
      },
      401,
    ],
    [
      "future authentication",
      (identity) => {
        identity.authenticatedAt = after;
      },
      401,
    ],
    [
      "current session expired",
      (_identity, authority) => {
        authority.sessionExpiresAt = instant;
      },
      401,
    ],
    [
      "revoked current session",
      (_identity, authority) => {
        authority.sessionRevokedAt = before;
      },
      401,
    ],
    [
      "disabled account",
      (_identity, authority) => {
        authority.accountStatus = "disabled";
      },
      403,
    ],
    [
      "different authority actor",
      (_identity, authority) => {
        authority.actorId = ids.other;
      },
      503,
    ],
    [
      "different authority session",
      (_identity, authority) => {
        authority.sessionId = ids.other;
      },
      503,
    ],
  ];
  it.each(sessionCases)("fails closed for %s", (_name, mutate, status) => {
    const identity = physicianIdentity();
    const authority = physicianAuthority();
    mutate(identity, authority);
    expect(validateCurrentIdentity(identity, authority, now)).toMatchObject({
      allowed: false,
      status,
    });
  });
  it.each([undefined, null, {}, { actorId: "not-a-uuid" }])(
    "rejects malformed authority %j",
    (authority) => {
      expect(validateCurrentIdentity(physicianIdentity(), authority, now)).toMatchObject({
        status: 503,
      });
    },
  );
  it("rejects invalid clocks, action scope and client-injected roles", () => {
    expect(projectSession(physicianIdentity(), physicianAuthority(), Number.NaN)).toMatchObject({
      status: 503,
    });
    for (const target of [
      { ...clinicalRequest(), patientId: "invalid" },
      { ...clinicalRequest(), role: "admin" },
      { action: "workspace:enter", workspace: "administrator" },
    ]) {
      expect(authorizeAccess(physicianIdentity(), physicianAuthority(), target, now)).toEqual(
        forbidden,
      );
    }
  });
  const accessCases: [string, (identity: VerifiedIdentity, authority: CurrentAuthority) => void][] =
    [
      [
        "missing grant",
        (_identity, authority) => {
          authority.memberships = [];
        },
      ],
      [
        "wrong organization",
        (identity) => {
          identity.organizationId = ids.other;
        },
      ],
      [
        "missing staff MFA",
        (identity) => {
          identity.mfa = null;
        },
      ],
      [
        "expired staff MFA",
        (identity) => {
          identity.mfa = { verifiedAt: before, expiresAt: instant };
        },
      ],
      [
        "future staff MFA",
        (identity) => {
          identity.mfa = { verifiedAt: after, expiresAt: after };
        },
      ],
      [
        "revoked membership",
        (_identity, authority) => {
          authority.memberships.forEach((entry) => {
            entry.revokedAt = before;
          });
        },
      ],
      [
        "expired membership",
        (_identity, authority) => {
          authority.memberships.forEach((entry) => {
            entry.expiresAt = instant;
          });
        },
      ],
      [
        "future membership",
        (_identity, authority) => {
          authority.memberships.forEach((entry) => {
            entry.validFrom = after;
          });
        },
      ],
      [
        "no workspace entry grant",
        (_identity, authority) => {
          authority.memberships.forEach((entry) => {
            entry.actions = ["clinical:read"];
          });
        },
      ],
      [
        "no clinical grant",
        (_identity, authority) => {
          authority.memberships.forEach((entry) => {
            entry.actions = ["workspace:enter"];
          });
        },
      ],
      [
        "cross-clinic membership",
        (_identity, authority) => {
          authority.memberships.forEach((entry) => {
            entry.clinicId = ids.other;
          });
        },
      ],
      [
        "unassigned patient",
        (_identity, authority) => {
          authority.assignments = [];
        },
      ],
      [
        "assignment to another membership",
        (_identity, authority) => {
          authority.assignments.forEach((entry) => {
            entry.membershipId = ids.other;
          });
        },
      ],
      [
        "cross-patient assignment",
        (_identity, authority) => {
          authority.assignments.forEach((entry) => {
            entry.patientId = ids.other;
          });
        },
      ],
      [
        "cross-clinic assignment",
        (_identity, authority) => {
          authority.assignments.forEach((entry) => {
            entry.clinicId = ids.other;
          });
        },
      ],
      [
        "cross-consultation assignment",
        (_identity, authority) => {
          authority.assignments.forEach((entry) => {
            entry.consultationId = ids.other;
          });
        },
      ],
      [
        "revoked assignment",
        (_identity, authority) => {
          authority.assignments.forEach((entry) => {
            entry.revokedAt = before;
          });
        },
      ],
      [
        "expired assignment",
        (_identity, authority) => {
          authority.assignments.forEach((entry) => {
            entry.expiresAt = instant;
          });
        },
      ],
      [
        "future assignment",
        (_identity, authority) => {
          authority.assignments.forEach((entry) => {
            entry.validFrom = after;
          });
        },
      ],
      [
        "no assignment action grant",
        (_identity, authority) => {
          authority.assignments.forEach((entry) => {
            entry.actions = [];
          });
        },
      ],
      [
        "missing privacy consent",
        (_identity, authority) => {
          authority.consents = authority.consents.filter((entry) => entry.purpose !== "privacy");
        },
      ],
      [
        "obsolete privacy version",
        (_identity, authority) => {
          authority.privacyVersion = "privacy-v2";
        },
      ],
      [
        "obsolete consultation version",
        (_identity, authority) => {
          authority.consultationConsentVersion = "consultation-v2";
        },
      ],
      [
        "wrong patient consent subject",
        (_identity, authority) => {
          authority.assignments.forEach((entry) => {
            entry.patientActorId = ids.other;
          });
        },
      ],
      [
        "revoked patient consent",
        (_identity, authority) => {
          authority.consents.forEach((entry) => {
            if (entry.purpose === "consultation") entry.revokedAt = before;
          });
        },
      ],
    ];
  it.each(accessCases)("denies %s without a clinical administrator bypass", (_name, mutate) => {
    const identity = physicianIdentity();
    const authority = physicianAuthority();
    mutate(identity, authority);
    expect(authorizeAccess(identity, authority, clinicalRequest(), now)).toEqual(forbidden);
  });
  it("allows exactly the linked customer patient, never staff scope or another patient", () => {
    const { identity, authority } = customerFixture();
    const target = { ...clinicalRequest(), workspace: "customer" };
    expect(authorizeAccess(identity, authority, target, now)).toEqual({ allowed: true });
    expect(authorizeAccess(identity, authority, clinicalRequest(), now)).toEqual(forbidden);
    expect(authorizeAccess(identity, authority, { ...target, patientId: ids.other }, now)).toEqual(
      forbidden,
    );
    authority.selfPatientLinks.forEach((link) => {
      link.revokedAt = before;
    });
    expect(authorizeAccess(identity, authority, target, now)).toEqual(forbidden);
  });
  it("does not let a staff self-link replace assignment", () => {
    const authority = physicianAuthority();
    authority.assignments = [];
    authority.selfPatientLinks = customerFixture().authority.selfPatientLinks;
    expect(authorizeAccess(physicianIdentity(), authority, clinicalRequest(), now)).toEqual(
      forbidden,
    );
  });
  it("projects only the shared client contract and shortest authoritative session expiry", () => {
    const authority = physicianAuthority();
    authority.sessionExpiresAt = "2026-10-23T10:30:00.000Z";
    const result = projectSession(physicianIdentity(), authority, now);
    expect(result).toEqual({
      allowed: true,
      session: {
        userId: ids.actor,
        expiresAt: authority.sessionExpiresAt,
        workspaces: ["physician"],
      },
    });
    if (result.allowed) expect(sessionSchema.safeParse(result.session).success).toBe(true);
  });
  it("re-evaluates revocation for the next invocation without a cached grant", () => {
    const authority = physicianAuthority();
    expect(projectSession(physicianIdentity(), authority, now).allowed).toBe(true);
    authority.memberships.forEach((entry) => {
      entry.revokedAt = instant;
    });
    expect(projectSession(physicianIdentity(), authority, now)).toEqual(forbidden);
  });
});
