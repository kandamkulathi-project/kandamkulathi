import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CommercePrincipal } from "../../apps/core-api/src/commerce-authorization";
import { readCommerceStaffClinics } from "../../apps/core-api/src/commerce-identity";
import { createWebAuthRuntime } from "../../apps/core-api/src/web-auth";
import type { DatabaseContext } from "../../packages/database/src/client";
import { transaction } from "../../packages/database/src/client";
import {
  commerceLocationForClinic,
  readCommerceClinics,
} from "../../packages/database/src/commerce-clinics";
import { createWebSecrets, digest } from "../../packages/providers/src/workos/oauth";
import { ids } from "../unit/identity-fixtures";

interface Fixture {
  source: { query: DatabaseContext["client"]["query"] };
  runtime<T>(role: "core", work: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
let fixture: Fixture;
let principal: CommercePrincipal;
const locationId = ids.patient;
const secondLocation = ids.consultation;
const secondClinic = ids.other;
const approvedAt = new Date(Date.now() - 3600000).toISOString();
const expiresAt = new Date(Date.now() + 3600000).toISOString();
const metadata = (clinicId: string, displayName: string) => ({
  clinicId,
  revision: 1,
  displayName,
  clinicTimezone: "Asia/Kolkata",
  publicationApprovalId: ids.assignment,
  approvedByActorId: ids.actor,
  approvedAt,
});

describe("approved commerce clinic directory — canonical metadata, explicit mappings and real current authority", () => {
  beforeAll(async () => {
    const path = "../platform/support.mjs";
    fixture = await (await import(path)).testDatabase();
    for (const [table, file] of [
      ["core.identity_actors", "0002_mathew_identity.sql"],
      ["clinical.mathew_booking_clinic_metadata", "0003_mathew_booking.sql"],
      ["core.commerce_skus", "0020_commerce_catalogue.sql"],
      ["core.commerce_payment_intents", "0021_commerce_payments.sql"],
      ["core.commerce_staff_grants", "0022_commerce_orders_access.sql"],
      ["core.commerce_clinic_locations", "0023_commerce_clinic_directory.sql"],
    ]) {
      if (
        !(await fixture.source.query("SELECT to_regclass($1) AS relation", [table])).rows[0]
          ?.relation
      )
        await fixture.source.query(
          await readFile(
            new URL(`../../packages/database/migrations/${file}`, import.meta.url),
            "utf8",
          ),
        );
    }
    await fixture.source.query(
      "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES($1,'synthetic_staff','active')",
      [ids.actor],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_policy(privacy_version,consultation_version,marketing_version,approval_reference) VALUES('synthetic-v1','synthetic-v1','synthetic-v1','synthetic-approval')",
    );
    await fixture.source.query(
      `INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,provider_organization_id,organization_id,authenticated_at,expires_at,mfa_verified_at,mfa_expires_at,mfa_evidence_reference)
      VALUES($1,$2,'synthetic_staff','synthetic_session','synthetic_org',$3,$4,$5,$4,$5,'synthetic-evidence')`,
      [ids.session, ids.actor, ids.organization, approvedAt, expiresAt],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_memberships(id,actor_id,record) VALUES($1,$2,$3::jsonb)",
      [
        ids.membership,
        ids.actor,
        JSON.stringify({
          id: ids.membership,
          workspace: "staff",
          organizationId: ids.organization,
          clinicId: ids.clinic,
          actions: ["workspace:enter"],
          validFrom: approvedAt,
          expiresAt,
          revokedAt: null,
        }),
      ],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_consents(id,actor_id,record) VALUES($1,$2,$3::jsonb)",
      [
        ids.other,
        ids.actor,
        JSON.stringify({
          id: ids.other,
          purpose: "privacy",
          actorId: ids.actor,
          recordedByActorId: ids.actor,
          version: "synthetic-v1",
          decision: "granted",
          decidedAt: approvedAt,
          expiresAt: null,
          revokedAt: null,
        }),
      ],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_locations(id,name) VALUES($1,'UNAPPROVED inventory name'),($2,'UNAPPROVED other inventory name')",
      [locationId, secondLocation],
    );
    for (const [clinicId, location, name] of [
      [ids.clinic, locationId, "Synthetic approved clinic"],
      [secondClinic, secondLocation, "Synthetic other approved clinic"],
    ]) {
      await fixture.source.query(
        "INSERT INTO clinical.mathew_booking_clinic_metadata(clinic_id,document,published) VALUES($1,$2::jsonb,true)",
        [clinicId, JSON.stringify(metadata(clinicId ?? "", name ?? ""))],
      );
      await fixture.source.query(
        "INSERT INTO core.commerce_clinic_locations(clinic_id,location_id,approved_by,approval_reference,active) VALUES($1,$2,$3,'synthetic-mapping-approval',true)",
        [clinicId, location, ids.actor],
      );
    }
    await fixture.source.query(
      `INSERT INTO core.commerce_staff_grants(id,actor_id,membership_id,clinic_id,action,valid_from,expires_at)
      VALUES($1,$2,$3,$4,'orders:read',$5,$6)`,
      [ids.assignment, ids.actor, ids.membership, ids.clinic, approvedAt, expiresAt],
    );
    principal = {
      allowed: true,
      actorId: ids.actor,
      sessionId: ids.session,
      clinicId: null,
      action: null,
      directory: true,
      identity: {
        actorId: ids.actor,
        sessionId: ids.session,
        organizationId: ids.organization,
        authenticatedAt: approvedAt,
        expiresAt,
        mfa: { verifiedAt: approvedAt, expiresAt },
      },
    };
  }, 60000);
  afterAll(async () => {
    await fixture?.close();
  });

  it("public names come only from approved canonical registry and explicit inventory mapping, without fabricated actor", async () => {
    const result = await fixture.runtime("core", readCommerceClinics);
    expect(result.items).toEqual(
      expect.arrayContaining([
        { clinicId: ids.clinic, locationId, name: "Synthetic approved clinic" },
        {
          clinicId: secondClinic,
          locationId: secondLocation,
          name: "Synthetic other approved clinic",
        },
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("UNAPPROVED");
    expect(
      await fixture.runtime("core", (context) =>
        transaction(context.client, () => commerceLocationForClinic(context, ids.clinic)),
      ),
    ).toBe(locationId);
    await expect(
      fixture.runtime("core", (context) =>
        transaction(context.client, () => commerceLocationForClinic(context, locationId)),
      ),
    ).rejects.toThrow();
  });
  it("unpublished or inactive mappings disappear; absent approved directory is unavailable, not an empty success", async () => {
    await fixture.source.query("UPDATE core.commerce_clinic_locations SET active=false");
    try {
      await expect(fixture.runtime("core", readCommerceClinics)).rejects.toThrow("unavailable");
    } finally {
      await fixture.source.query("UPDATE core.commerce_clinic_locations SET active=true");
    }
    await fixture.source.query(
      "UPDATE clinical.mathew_booking_clinic_metadata SET published=false WHERE clinic_id=$1",
      [secondClinic],
    );
    try {
      expect(
        (await fixture.runtime("core", readCommerceClinics)).items.map((item) => item.clinicId),
      ).toEqual([ids.clinic]);
    } finally {
      await fixture.source.query(
        "UPDATE clinical.mathew_booking_clinic_metadata SET published=true WHERE clinic_id=$1",
        [secondClinic],
      );
    }
  });
  it("malformed or future approval metadata cannot be used as a clinic label", async () => {
    for (const document of [
      { ...metadata(ids.clinic, ""), displayName: "" },
      { ...metadata(ids.clinic, "Synthetic"), approvedAt: expiresAt },
    ]) {
      await fixture.source.query(
        "UPDATE clinical.mathew_booking_clinic_metadata SET document=$2::jsonb WHERE clinic_id=$1",
        [ids.clinic, JSON.stringify(document)],
      );
      try {
        await expect(fixture.runtime("core", readCommerceClinics)).rejects.toThrow("unavailable");
      } finally {
        await fixture.source.query(
          "UPDATE clinical.mathew_booking_clinic_metadata SET document=$2::jsonb WHERE clinic_id=$1",
          [ids.clinic, JSON.stringify(metadata(ids.clinic, "Synthetic approved clinic"))],
        );
      }
    }
  });
  it("staff directory includes only matching current membership/grant actions, and revocation takes immediate effect", async () => {
    const read = () =>
      fixture.runtime("core", (context) => readCommerceStaffClinics(context, principal));
    expect(await read()).toEqual({
      items: [
        {
          clinicId: ids.clinic,
          locationId,
          name: "Synthetic approved clinic",
          actions: ["orders:read"],
        },
      ],
    });
    await fixture.source.query(
      "UPDATE core.commerce_staff_grants SET revoked_at=clock_timestamp() WHERE id=$1",
      [ids.assignment],
    );
    try {
      expect(await read()).toEqual({ items: [] });
    } finally {
      await fixture.source.query(
        "UPDATE core.commerce_staff_grants SET revoked_at=NULL WHERE id=$1",
        [ids.assignment],
      );
    }
    await fixture.source.query(
      "UPDATE core.identity_sessions SET revoked_at=clock_timestamp() WHERE id=$1",
      [ids.session],
    );
    try {
      await expect(read()).rejects.toThrow();
    } finally {
      await fixture.source.query("UPDATE core.identity_sessions SET revoked_at=NULL WHERE id=$1", [
        ids.session,
      ]);
    }
    await expect(
      fixture.runtime("core", (context) =>
        readCommerceStaffClinics(context, {
          ...principal,
          directory: undefined,
        } as unknown as CommercePrincipal),
      ),
    ).rejects.toThrow();
  });
  it("CORE cannot provision mappings, publish clinic names, or grant itself clinic authority", async () => {
    await expect(
      fixture.runtime("core", (context) =>
        context.client.query("UPDATE core.commerce_clinic_locations SET active=false"),
      ),
    ).rejects.toThrow();
    await expect(
      fixture.runtime("core", (context) =>
        context.client.query("UPDATE clinical.mathew_booking_clinic_metadata SET published=true"),
      ),
    ).rejects.toThrow();
    await expect(
      fixture.runtime("core", (context) =>
        context.client.query("UPDATE core.commerce_staff_grants SET revoked_at=NULL"),
      ),
    ).rejects.toThrow();
  });
  it("the actual cookie guard fences logout through the commerce commit and rejects revoked cookies without domain effects", async () => {
    const cookieKey = Buffer.from(new Uint8Array(32).fill(71)).toString("base64url");
    const handle = "s".repeat(43);
    const hash = await digest(handle);
    const secrets = createWebSecrets(cookieKey, "https://core.example");
    const cookie = await secrets.seal(handle, "session-cookie");
    await fixture.source.query(
      `INSERT INTO core.identity_web_sessions(handle_hash,actor_id,session_id,access_token_ciphertext,expires_at)
      VALUES($1,$2,$3,'synthetic-unused-ciphertext',$4)`,
      [hash, ids.actor, ids.session, expiresAt],
    );
    const runtime = createWebAuthRuntime(
      {
        apiKey: "synthetic-provider-credential",
        clientId: "client_test",
        issuer: "https://api.workos.com",
        approved: true,
        apiOrigin: "https://core.example",
        callbackUrl: "https://core.example/v1/auth/callback",
        returnUrl: "https://app.example/session/return",
        allowedReturnUrls: ["https://app.example/session/return"],
        cookieKey,
        attemptTtlSeconds: 120,
        sessionTtlSeconds: 3600,
      },
      async (callback) => fixture.runtime("core", (context) => callback(context.client)),
      { approvedBrowserOrigin: (origin) => origin === "https://app.example" },
      async () => {
        throw new Error("No provider network inside transaction");
      },
    );
    const request = new Request("https://core.example/v1/staff/commerce/clinics", {
      headers: { cookie: `__Host-k_session=${cookie}` },
    });
    const guard = async (context: DatabaseContext) =>
      runtime.withWebSessionInTransaction(context.client, request, principal.identity, async () => {
        await fixture.source.query("BEGIN");
        try {
          await fixture.source.query("SET LOCAL lock_timeout='100ms'");
          await expect(
            fixture.source.query(
              "UPDATE core.identity_web_sessions SET revoked_at=clock_timestamp() WHERE handle_hash=$1",
              [hash],
            ),
          ).rejects.toThrow();
        } finally {
          await fixture.source.query("ROLLBACK");
        }
      });
    expect(
      (
        await fixture.runtime("core", (context) =>
          readCommerceStaffClinics(context, principal, guard),
        )
      ).items,
    ).toHaveLength(1);
    await fixture.source.query(
      "UPDATE core.identity_web_sessions SET revoked_at=clock_timestamp() WHERE handle_hash=$1",
      [hash],
    );
    await fixture.runtime("core", async (context) => {
      await expect(
        readCommerceStaffClinics(context, principal, (context) =>
          runtime.withWebSessionInTransaction(
            context.client,
            request,
            principal.identity,
            async () => {},
          ),
        ),
      ).rejects.toThrow("UNAUTHENTICATED");
      expect(
        (await context.client.query("SELECT handle_hash FROM core.identity_web_sessions")).rows,
      ).toEqual([]);
      expect((await context.client.query("SELECT id FROM core.identity_sessions")).rows).toEqual(
        [],
      );
    });
    expect(
      (
        await fixture.source.query(
          "SELECT revoked_at FROM core.commerce_staff_grants WHERE id=$1",
          [ids.assignment],
        )
      ).rows[0]?.revoked_at,
    ).toBeNull();
  });
});
