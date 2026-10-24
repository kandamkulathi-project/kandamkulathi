import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, type MockInstance, vi } from "vitest";
import {
  type CommerceCheckoutDependencies,
  registerCommerceCheckoutRoutes,
} from "../../apps/core-api/src/commerce-checkout";
import { revalidateCommerceTransaction } from "../../apps/core-api/src/commerce-identity";
import type { DatabaseContext } from "../../packages/database/src/client";
import { readCommerceCheckout } from "../../packages/database/src/commerce-checkout";
import { linkWorkosSession, withIdentityTransaction } from "../../packages/database/src/identity";
import { createWorkosVerifier } from "../../packages/providers/src/workos/index";
import { createService } from "../../packages/server/src/index";
import type { TestFetch } from "../fixtures/fetch";
import { ids } from "../unit/identity-fixtures";

interface Fixture {
  source: { query: DatabaseContext["client"]["query"] };
  runtime<T>(role: "core", work: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// Real HTTP + signatures + canonical identity/checkout SQL + PostgreSQL non-owner RLS.
// Synthetic injected JWKS/session responses are NOT real WorkOS or Razorpay acceptance.
describe("signed checkout HTTP journey — actual loopback HTTP and PostgreSQL", () => {
  let fixture: Fixture;
  let server: Server | undefined;
  let origin: string;
  let token: string;
  let providerSessionActive = true;
  const intentId = randomUUID();
  const orderId = randomUUID();
  const operationId = randomUUID();
  const before = new Date(Date.now() - 60000).toISOString();
  const after = new Date(Date.now() + 3600000).toISOString();
  const providerOrderId = `order_${intentId.replaceAll("-", "")}`;
  const identityTransport = vi.fn<TestFetch>();
  const checkoutRead = vi.fn<CommerceCheckoutDependencies["checkout"]>();
  let network: MockInstance<typeof fetch> | undefined;

  beforeAll(async () => {
    const supportPath = "../platform/support.mjs";
    fixture = await (await import(supportPath)).testDatabase();
    for (const [table, file] of [
      ["core.identity_actors", "0002_mathew_identity.sql"],
      ["core.commerce_skus", "0020_commerce_catalogue.sql"],
      ["core.commerce_payment_intents", "0021_commerce_payments.sql"],
      ["core.commerce_staff_grants", "0022_commerce_orders_access.sql"],
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
      "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES($1,'user_syntheticcheckout','active')",
      [ids.actor],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_policy(privacy_version,consultation_version,marketing_version,approval_reference) VALUES('synthetic-v1','synthetic-v1','synthetic-v1','synthetic-approval')",
    );
    await fixture.source.query(
      `INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,authenticated_at,expires_at) VALUES($1,$2,'user_syntheticcheckout','session_syntheticcheckout',$3,$4)`,
      [ids.session, ids.actor, before, after],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_memberships(id,actor_id,record) VALUES($1,$2,$3::jsonb)",
      [
        ids.membership,
        ids.actor,
        JSON.stringify({
          id: ids.membership,
          workspace: "customer",
          organizationId: null,
          clinicId: null,
          actions: ["workspace:enter"],
          validFrom: before,
          expiresAt: after,
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
          decidedAt: before,
          expiresAt: null,
          revokedAt: null,
        }),
      ],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_locations(id,name) VALUES($1,'synthetic')",
      [ids.clinic],
    );
    await fixture.source.query(
      `INSERT INTO core.commerce_orders(id,operation_id,actor_id,location_id,request_key,amount_paise,expires_at,source,hold_policy_reference) VALUES($1,$1,$2,$3,'synthetic',12345,$4,'native','synthetic-policy')`,
      [orderId, ids.actor, ids.clinic, after],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_order_addresses(order_id,address) VALUES($1,$2::jsonb)",
      [
        orderId,
        JSON.stringify({
          recipientName: "Synthetic",
          line1: "1 Synthetic Street",
          city: "Test",
          region: "Test",
          postalCode: "680001",
          country: "IN",
          contactPhone: "+919876543210",
        }),
      ],
    );
    await fixture.source.query(
      `INSERT INTO core.commerce_payment_intents(id,operation_id,subject_kind,subject_id,owner_id,amount_paise,currency,account_id,state,provider_order_id,authority_revision) VALUES($1,$2,'order',$3,$4,12345,'INR','acc_synthetic','ready',$5,1)`,
      [intentId, operationId, orderId, ids.actor, providerOrderId],
    );

    const keys = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "RS256", typ: "JWT", kid: "synthetic-checkout" })}.${encode({ iss: "https://identity.example.invalid", client_id: "client_syntheticcheckout", sub: "user_syntheticcheckout", sid: "session_syntheticcheckout", iat: Math.floor(Date.parse(before) / 1000), exp: Math.floor(Date.parse(after) / 1000) })}`;
    token = `${unsigned}.${Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(unsigned))).toString("base64url")}`;
    identityTransport.mockImplementation(async (input, init) => {
      const url = String(input);
      expect(init?.redirect).toBe("error");
      if (url === "https://api.workos.com/sso/jwks/client_syntheticcheckout") {
        expect(new Headers(init?.headers).has("authorization")).toBe(false);
        return Response.json({
          keys: [{ ...jwk, kid: "synthetic-checkout", alg: "RS256", use: "sig" }],
        });
      }
      expect(url).toBe(
        "https://api.workos.com/user_management/users/user_syntheticcheckout/sessions?limit=100",
      );
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer synthetic-identity-only-fixture",
      );
      return Response.json({
        data: [
          {
            id: "session_syntheticcheckout",
            user_id: "user_syntheticcheckout",
            organization_id: null,
            status: providerSessionActive ? "active" : "revoked",
            expires_at: after,
            ended_at: null,
          },
        ],
        list_metadata: { after: null },
      });
    });
    const verify = createWorkosVerifier(
      {
        apiKey: "synthetic-identity-only-fixture",
        clientId: "client_syntheticcheckout",
        issuer: "https://identity.example.invalid",
        approved: true,
      },
      identityTransport,
    );
    checkoutRead.mockImplementation((principal, id) =>
      fixture.runtime("core", (context) =>
        readCommerceCheckout(context, id, {
          actorId: principal.actorId,
          identity: principal.identity,
          accountId: "acc_synthetic",
          keyId: "rzp_test_synthetic",
          authorizeTransaction: (active) => revalidateCommerceTransaction(active, principal),
        }),
      ),
    );
    const dependencies: CommerceCheckoutDependencies = {
      async verifySession(request) {
        const verified = await verify(request);
        if (verified.status !== "verified") return verified;
        const identity = await fixture.runtime("core", (context) =>
          linkWorkosSession(context.client, verified.session),
        );
        return identity ? { status: "verified", identity } : { status: "unauthenticated" };
      },
      loadCurrentAuthority: (identity) =>
        fixture.runtime("core", (context) =>
          withIdentityTransaction(context.client, identity, async (authority) => authority),
        ),
      async loadCommerceGrants() {
        return [];
      },
      checkout: checkoutRead,
    };
    const app = createService("core-api", () => {}, {
      registerRoutes: (service) => registerCommerceCheckoutRoutes(service, dependencies),
    });
    server = createServer(async (incoming, outgoing) => {
      try {
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (Array.isArray(value)) for (const entry of value) headers.append(name, entry);
          else if (value !== undefined) headers.set(name, value);
        }
        const response = await app.fetch(
          new Request(`${origin}${incoming.url}`, { method: incoming.method ?? "GET", headers }),
          { APP_ENV: "local" },
        );
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        outgoing.writeHead(500);
        outgoing.end();
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing local test listener");
    origin = `http://127.0.0.1:${address.port}`;
    const originalFetch = globalThis.fetch;
    network = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin !== origin)
        throw new Error("Outbound network is forbidden in this synthetic checkout test");
      return originalFetch(input, init);
    });
  }, 60000);
  afterAll(async () => {
    network?.mockRestore();
    if (server)
      await new Promise<void>((resolve, reject) =>
        server?.close((error) => (error ? reject(error) : resolve())),
      );
    await fixture?.close();
  });
  const request = (bearer = token) =>
    fetch(`${origin}/v1/payments/${intentId}/checkout`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });

  it("signed RS256/JWKS plus freshly verified active session reaches real SQL checkout over HTTP without financial writes", async () => {
    const beforeState = await fixture.source.query(
      "SELECT (SELECT count(*)::int FROM core.commerce_payment_intents) AS intents,(SELECT count(*)::int FROM core.commerce_payment_ledger) AS ledger,(SELECT count(*)::int FROM core.commerce_payment_receipts) AS receipts,(SELECT count(*)::int FROM platform.outbox) AS outbox",
    );
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({
        keyId: "rzp_test_synthetic",
        providerOrderId,
        amountPaise: 12345,
        currency: "INR",
        intentId,
        operationId,
        subject: { kind: "order", id: orderId },
      });
    }
    expect(checkoutRead).toHaveBeenCalledTimes(2);
    expect(
      identityTransport.mock.calls.filter(([url]) => String(url).includes("/sessions?")),
    ).toHaveLength(2);
    expect(
      (
        await fixture.source.query(
          "SELECT (SELECT count(*)::int FROM core.commerce_payment_intents) AS intents,(SELECT count(*)::int FROM core.commerce_payment_ledger) AS ledger,(SELECT count(*)::int FROM core.commerce_payment_receipts) AS receipts,(SELECT count(*)::int FROM platform.outbox) AS outbox",
        )
      ).rows,
    ).toEqual(beforeState.rows);
    expect(
      (
        await fixture.source.query(
          "SELECT state,provider_order_id FROM core.commerce_payment_intents WHERE id=$1",
          [intentId],
        )
      ).rows[0],
    ).toEqual({ state: "ready", provider_order_id: providerOrderId });
    expect(
      (await fixture.source.query("SELECT status FROM core.commerce_orders WHERE id=$1", [orderId]))
        .rows[0]?.status,
    ).toBe("reserved");
    expect(network?.mock.calls.every(([input]) => String(input).startsWith(`${origin}/`))).toBe(
      true,
    );
    expect(
      identityTransport.mock.calls.every(([url]) =>
        String(url).startsWith("https://api.workos.com/"),
      ),
    ).toBe(true);
  });
  it("tampered signature returns 401 before live-session lookup and checkout SQL", async () => {
    const reads = checkoutRead.mock.calls.length;
    const lookups = identityTransport.mock.calls.filter(([url]) =>
      String(url).includes("/sessions?"),
    ).length;
    const parts = token.split(".");
    const signature = parts[2];
    if (!signature) throw new Error("Missing test signature");
    parts[2] = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    const response = await request(parts.join("."));
    expect(response.status).toBe(401);
    expect(checkoutRead).toHaveBeenCalledTimes(reads);
    expect(
      identityTransport.mock.calls.filter(([url]) => String(url).includes("/sessions?")),
    ).toHaveLength(lookups);
  });
  it("same valid signed bearer is denied after the synthetic provider session is revoked (no cached acceptance)", async () => {
    const reads = checkoutRead.mock.calls.length;
    const lookups = identityTransport.mock.calls.filter(([url]) =>
      String(url).includes("/sessions?"),
    ).length;
    providerSessionActive = false;
    try {
      expect((await request()).status).toBe(401);
      expect(checkoutRead).toHaveBeenCalledTimes(reads);
      expect(
        identityTransport.mock.calls.filter(([url]) => String(url).includes("/sessions?")),
      ).toHaveLength(lookups + 1);
    } finally {
      providerSessionActive = true;
    }
  });
  it("same signed active-provider bearer is denied after actual PostgreSQL internal-session revocation", async () => {
    const reads = checkoutRead.mock.calls.length;
    await fixture.source.query(
      "UPDATE core.identity_sessions SET revoked_at=clock_timestamp() WHERE id=$1",
      [ids.session],
    );
    try {
      expect((await request()).status).toBe(401);
      expect(checkoutRead).toHaveBeenCalledTimes(reads);
    } finally {
      await fixture.source.query("UPDATE core.identity_sessions SET revoked_at=NULL WHERE id=$1", [
        ids.session,
      ]);
    }
  });
});
