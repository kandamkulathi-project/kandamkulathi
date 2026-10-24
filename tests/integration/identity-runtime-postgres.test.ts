import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCoreApi } from "../../apps/core-api/src/identity";
import {
  createIdentityRuntime,
  registerIdentityRuntimeRoutes,
} from "../../apps/core-api/src/identity-runtime";
import type { DatabaseClient, DatabaseContext } from "../../packages/database/src/client";
import { transaction } from "../../packages/database/src/client";
import {
  linkWorkosSession,
  loadCurrentAuthorityInTransaction,
  recordSelfConsent,
  withIdentityTransaction,
} from "../../packages/database/src/identity";
import { authorizeAccess, projectSession } from "../../packages/server/src/authorization";
import { registerIdentityRoutes } from "../../packages/server/src/identity";
import { createService } from "../../packages/server/src/index";
import { instant, options, workosFixture } from "../unit/workos-fixtures";

interface Harness {
  source: DatabaseClient;
  runtime<T>(role: "core", callback: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
const actor = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const sessionId = "20000000-0000-4000-8000-000000000001";
const membershipId = "30000000-0000-4000-8000-000000000001";
const session = {
  userId: "user_test",
  sessionId: "session_test",
  organizationId: null,
  issuedAt: "2026-10-24T09:59:00.000Z",
  expiresAt: "2026-10-24T10:05:00.000Z",
};
describe("identity runtime real PostgreSQL 17", () => {
  let db: Harness;
  beforeAll(async () => {
    const supportPath = "../platform/support.mjs";
    const { testDatabase } = (await import(supportPath)) as { testDatabase(): Promise<Harness> };
    db = await testDatabase();
    await db.source.query(
      "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES ($1,'user_test','active'),($2,'user_other','active')",
      [actor, other],
    );
    await db.source.query(
      `INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,authenticated_at,expires_at)
      VALUES ($1,$2,'user_test','session_test','2026-10-24T09:00:00Z','2026-10-25T10:00:00Z')`,
      [sessionId, actor],
    );
    await db.source.query(
      "INSERT INTO core.identity_policy(singleton,privacy_version,consultation_version,marketing_version,approval_reference) VALUES (true,'privacy-test','consult-test','marketing-test','synthetic-policy-only')",
    );
    await db.source.query(
      "INSERT INTO core.identity_memberships(id,actor_id,record) VALUES ($1,$2,$3)",
      [
        membershipId,
        actor,
        JSON.stringify({
          id: membershipId,
          workspace: "customer",
          organizationId: null,
          clinicId: null,
          actions: ["workspace:enter"],
          validFrom: "2026-10-24T09:00:00.000Z",
          expiresAt: "2026-10-25T10:00:00.000Z",
          revokedAt: null,
        }),
      ],
    );
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });
  const identity = async () => {
    const result = await db.runtime("core", ({ client }) => linkWorkosSession(client, session));
    if (!result) throw new Error("Synthetic enrollment missing");
    return result;
  };
  it("requires current consent, persists separate self decisions and projects minimal HTTP session", async () => {
    const verified = await identity();
    const before = await db.runtime("core", ({ client }) =>
      withIdentityTransaction(client, verified, async (authority) =>
        projectSession(verified, authority, instant),
      ),
    );
    expect(before).toMatchObject({ allowed: false, status: 403 });
    await db.runtime("core", ({ client }) =>
      recordSelfConsent(
        client,
        verified,
        {
          requirement: { purpose: "privacy", version: "privacy-test", actorId: actor },
          decision: "granted",
        },
        instant,
      ),
    );
    await db.runtime("core", ({ client }) =>
      recordSelfConsent(
        client,
        verified,
        {
          requirement: { purpose: "marketing", version: "marketing-test", actorId: actor },
          decision: "declined",
        },
        instant + 1,
      ),
    );
    const fixture = await workosFixture();
    const runtime = createIdentityRuntime(
      options,
      (callback) => db.runtime("core", ({ client }) => callback(client)),
      fixture.transport,
      () => instant + 2,
    );
    const response = await createCoreApi(runtime.dependencies).request(
      "/v1/session",
      { headers: { authorization: `Bearer ${await fixture.token()}` } },
      { APP_ENV: "local" },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      userId: actor,
      expiresAt: "2026-10-24T10:05:00.000Z",
      workspaces: ["customer"],
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const records = await db.source.query("SELECT record FROM core.identity_consents");
    expect(records.rows).toHaveLength(2);
  });
  it("denies foreign subjects, stale policy, manufactured consultation and ambient reads", async () => {
    const verified = await identity();
    await expect(
      db.runtime("core", ({ client }) =>
        recordSelfConsent(
          client,
          verified,
          {
            requirement: { purpose: "privacy", version: "privacy-test", actorId: other },
            decision: "granted",
          },
          instant + 3,
        ),
      ),
    ).rejects.toThrow("Forbidden");
    await expect(
      db.runtime("core", ({ client }) =>
        recordSelfConsent(
          client,
          verified,
          {
            requirement: { purpose: "privacy", version: "old", actorId: actor },
            decision: "granted",
          },
          instant + 3,
        ),
      ),
    ).rejects.toThrow("version");
    await expect(
      db.runtime("core", ({ client }) =>
        recordSelfConsent(
          client,
          verified,
          {
            requirement: {
              purpose: "consultation",
              version: "consult-test",
              actorId: actor,
              patientId: actor,
              clinicId: actor,
              consultationId: actor,
            },
            decision: "granted",
          },
          instant + 3,
        ),
      ),
    ).rejects.toThrow("scope");
    await db.runtime("core", async ({ client }) => {
      expect((await client.query("SELECT id FROM core.identity_actors")).rows).toEqual([]);
      await expect(loadCurrentAuthorityInTransaction(client, verified)).rejects.toThrow(
        "transaction",
      );
    });
  });
  it("cleans transaction context after rollback and reuse; runtime cannot edit grant data", async () => {
    const verified = await identity();
    await db.runtime("core", async ({ client }) => {
      await expect(
        withIdentityTransaction(client, verified, async () => {
          throw new Error("rollback probe");
        }),
      ).rejects.toThrow("rollback probe");
      expect((await client.query("SELECT id FROM core.identity_consents")).rows).toEqual([]);
      await expect(
        transaction(client, async () => {
          await loadCurrentAuthorityInTransaction(client, verified);
          await client.query("UPDATE core.identity_actors SET lock_guard=true WHERE id=$1", [
            actor,
          ]);
        }),
      ).rejects.toThrow();
      expect((await client.query("SELECT id FROM core.identity_sessions")).rows).toEqual([]);
      const authority = await withIdentityTransaction(client, verified, async (current) => current);
      expect(authority.actorId).toBe(actor);
    });
  });
  it("records self consent through the real runtime HTTP composition and denies foreign writes", async () => {
    const fixture = await workosFixture();
    const runtime = createIdentityRuntime(
      options,
      (callback) => db.runtime("core", ({ client }) => callback(client)),
      fixture.transport,
      () => instant + 4,
    );
    const app = createService("core-api", undefined, {
      registerRoutes: (app) => {
        registerIdentityRoutes(app, runtime.dependencies);
        registerIdentityRuntimeRoutes(app, runtime);
      },
    });
    const headers = {
      authorization: `Bearer ${await fixture.token()}`,
      "content-type": "application/json",
    };
    const body = (actorId: string) =>
      JSON.stringify({
        requirement: { purpose: "marketing", version: "marketing-test", actorId },
        decision: "declined",
      });
    const response = await app.request(
      "/v1/consents",
      { method: "POST", headers, body: body(actor) },
      { APP_ENV: "local" },
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toHaveProperty("id");
    const conflict = await app.request(
      "/v1/consents",
      { method: "POST", headers, body: body(actor) },
      { APP_ENV: "local" },
    );
    expect(conflict.status).toBe(409);
    const denied = await app.request(
      "/v1/consents",
      { method: "POST", headers, body: body(other) },
      { APP_ENV: "local" },
    );
    expect(denied.status).toBe(403);
    expect(
      (await db.source.query("SELECT id FROM core.identity_consents WHERE actor_id=$1", [other]))
        .rowCount,
    ).toBe(0);
  });
  it("loads assigned patient consent, denies clinic crossing and sees assignment revocation without token refresh", async () => {
    const staffSession = "20000000-0000-4000-8000-000000000002";
    const membership = "30000000-0000-4000-8000-000000000002";
    const assignment = "50000000-0000-4000-8000-000000000001";
    const consentId = "60000000-0000-4000-8000-000000000001";
    const clinic = "70000000-0000-4000-8000-000000000001";
    const patient = "80000000-0000-4000-8000-000000000001";
    const consultation = "90000000-0000-4000-8000-000000000001";
    const window = {
      validFrom: "2020-01-01T00:00:00.000Z",
      expiresAt: "2100-01-01T00:00:00.000Z",
      revokedAt: null,
    };
    await db.source.query(
      `INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,
      provider_organization_id,organization_id,authenticated_at,expires_at,mfa_verified_at,mfa_expires_at,mfa_evidence_reference)
      VALUES ($1,$2,'user_other','session_other','org_test',$2,'2026-10-24T09:00:00Z','2026-10-25T10:00:00Z','2026-10-24T09:00:00Z','2026-10-24T11:00:00Z','synthetic-step-up')`,
      [staffSession, other],
    );
    await db.source.query(
      "INSERT INTO core.identity_memberships(id,actor_id,record) VALUES ($1,$2,$3)",
      [
        membership,
        other,
        JSON.stringify({
          id: membership,
          workspace: "physician",
          organizationId: other,
          clinicId: clinic,
          actions: ["workspace:enter", "clinical:read"],
          ...window,
        }),
      ],
    );
    await db.source.query(
      "INSERT INTO core.identity_assignments(id,actor_id,patient_actor_id,record) VALUES ($1,$2,$3,$4)",
      [
        assignment,
        other,
        actor,
        JSON.stringify({
          id: assignment,
          membershipId: membership,
          patientActorId: actor,
          patientId: patient,
          clinicId: clinic,
          consultationId: consultation,
          actions: ["clinical:read"],
          ...window,
        }),
      ],
    );
    await db.source.query(
      "INSERT INTO core.identity_consents(id,actor_id,record) VALUES ($1,$2,$3)",
      [
        consentId,
        actor,
        JSON.stringify({
          id: consentId,
          purpose: "consultation",
          version: "consult-test",
          actorId: actor,
          recordedByActorId: actor,
          patientId: patient,
          clinicId: clinic,
          consultationId: consultation,
          decision: "granted",
          decidedAt: "2026-10-24T09:59:00.000Z",
          expiresAt: null,
          revokedAt: null,
        }),
      ],
    );
    const verified = await db.runtime("core", ({ client }) =>
      linkWorkosSession(client, {
        ...session,
        userId: "user_other",
        sessionId: "session_other",
        organizationId: "org_test",
      }),
    );
    if (!verified) throw new Error("Expected staff test enrollment");
    await db.runtime("core", ({ client }) =>
      recordSelfConsent(
        client,
        verified,
        {
          requirement: { purpose: "privacy", version: "privacy-test", actorId: other },
          decision: "granted",
        },
        instant + 5,
      ),
    );
    const request = {
      action: "clinical:read",
      workspace: "physician",
      patientId: patient,
      clinicId: clinic,
      consultationId: consultation,
    };
    await db.runtime("core", ({ client }) =>
      withIdentityTransaction(client, verified, async (authority) => {
        expect(authorizeAccess(verified, authority, request, instant + 6)).toEqual({
          allowed: true,
        });
        expect(
          authorizeAccess(verified, authority, { ...request, clinicId: other }, instant + 6),
        ).toMatchObject({ allowed: false, status: 403 });
        await db.source.query("BEGIN");
        try {
          await db.source.query("SET LOCAL lock_timeout='100ms'");
          await expect(
            db.source.query("UPDATE core.identity_actors SET status='disabled' WHERE id=$1", [
              actor,
            ]),
          ).rejects.toThrow();
        } finally {
          await db.source.query("ROLLBACK");
        }
      }),
    );
    await db.source.query(
      "UPDATE core.identity_assignments SET record=jsonb_set(record,'{revokedAt}',to_jsonb('2026-10-24T10:00:00.007Z'::text)) WHERE id=$1",
      [assignment],
    );
    await db.runtime("core", ({ client }) =>
      withIdentityTransaction(client, verified, async (authority) => {
        expect(authorizeAccess(verified, authority, request, instant + 8)).toMatchObject({
          allowed: false,
          status: 403,
        });
        expect(authority.consents.some((record) => record.actorId === actor)).toBe(false);
      }),
    );
  });
  it("holds granting rows and insertion fence through domain commit; revocation becomes immediate on next request", async () => {
    const verified = await identity();
    await db.runtime("core", async ({ client }) => {
      await transaction(client, async () => {
        await loadCurrentAuthorityInTransaction(client, verified);
        // Real concurrent PostgreSQL connection must fail to revoke the session while
        // the authorized domain transaction is still active (no timers/barriers guessed).
        await db.source.query("BEGIN");
        try {
          await db.source.query("SET LOCAL lock_timeout='100ms'");
          await expect(
            db.source.query("UPDATE core.identity_sessions SET revoked_at=now() WHERE id=$1", [
              sessionId,
            ]),
          ).rejects.toThrow();
        } finally {
          await db.source.query("ROLLBACK");
        }
        await db.source.query("BEGIN");
        try {
          await db.source.query("SET LOCAL lock_timeout='100ms'");
          const id = "40000000-0000-4000-8000-000000000001";
          await expect(
            db.source.query(
              "INSERT INTO core.identity_consents(id,actor_id,record) VALUES ($1,$2,$3)",
              [
                id,
                actor,
                JSON.stringify({
                  id,
                  actorId: actor,
                  recordedByActorId: actor,
                  purpose: "privacy",
                  version: "privacy-test",
                  decision: "declined",
                  decidedAt: "2026-10-24T10:00:00.009Z",
                  expiresAt: null,
                  revokedAt: null,
                }),
              ],
            ),
          ).rejects.toThrow();
        } finally {
          await db.source.query("ROLLBACK");
        }
      });
    });
    await db.source.query("UPDATE core.identity_sessions SET revoked_at=now() WHERE id=$1", [
      sessionId,
    ]);
    expect(await db.runtime("core", ({ client }) => linkWorkosSession(client, session))).toBeNull();
    const result = await db.runtime("core", ({ client }) =>
      withIdentityTransaction(client, verified, async (authority) =>
        projectSession(verified, authority, instant + 10),
      ),
    );
    expect(result).toMatchObject({ allowed: false, status: 401 });
  });
  it("requires exact current organization and rechecks database MFA evidence", async () => {
    await db.source.query(
      "UPDATE core.identity_sessions SET revoked_at=NULL,provider_organization_id='org_test',organization_id=$1,mfa_verified_at='2026-10-24T09:00:00Z',mfa_expires_at='2026-10-24T11:00:00Z',mfa_evidence_reference='synthetic-step-up-proof' WHERE id=$2",
      [other, sessionId],
    );
    expect(await db.runtime("core", ({ client }) => linkWorkosSession(client, session))).toBeNull();
    const verified = await db.runtime("core", ({ client }) =>
      linkWorkosSession(client, { ...session, organizationId: "org_test" }),
    );
    expect(verified?.organizationId).toBe(other);
    expect(verified?.mfa?.verifiedAt).toBe("2026-10-24T09:00:00.000Z");
    if (!verified) throw new Error("Expected synthetic enrollment");
    await db.source.query(
      "UPDATE core.identity_sessions SET mfa_verified_at=NULL,mfa_expires_at=NULL WHERE id=$1",
      [sessionId],
    );
    await expect(
      db.runtime("core", ({ client }) =>
        withIdentityTransaction(client, verified, async (authority) => authority),
      ),
    ).rejects.toThrow("Identity changed");
  });
});
