import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { registerChannelRoutes } from "../../apps/companion/src/channels";
import { registerKnowledgeRoutes } from "../../apps/companion/src/knowledge/service";
import { createCompanionApi } from "../../apps/companion/src/service";
import { createCoreApi } from "../../apps/core-api/src/identity";
import coreWorker from "../../apps/core-api/src/index";
import type { DurableChannelInbox } from "../../packages/contracts/src/channels";
import { errorSchema } from "../../packages/contracts/src/index";
import { registerIdentityRoutes } from "../../packages/server/src/identity";
import { createService } from "../../packages/server/src/index";
import type { LogSink } from "../../packages/server/src/observability";
import { now, physicianAuthority, physicianIdentity } from "../unit/identity-fixtures";
import { knowledgeFixture } from "../unit/knowledge.fixtures";

const local = { APP_ENV: "local" };
const config = {
  appSecret: "synthetic-platform-secret-not-a-credential",
  verifyToken: "synthetic-platform-token",
  businessAccountId: "10001",
  receivingPhoneNumberId: "20001",
};
const privateQuery = "synthetic-patient-query";
const credential = "synthetic-private-credential";
const raw = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: config.businessAccountId,
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "0000000000", phone_number_id: "20001" },
            messages: [
              {
                from: "30001",
                id: "wamid.platform-synthetic=",
                timestamp: "1000",
                type: "text",
                text: { body: "synthetic-private-patient-body" },
              },
            ],
          },
        },
      ],
    },
  ],
});

function incoming(path: string, body?: string) {
  return new Request(`http://localhost${path}?patient=${privateQuery}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${credential}`,
      Cookie: `session=${credential}`,
      "X-Request-ID": "synthetic-untrusted-request-id",
      "Content-Type": "application/json",
      "X-Hub-Signature-256": `sha256=${createHmac("sha256", config.appSecret)
        .update(body ?? "")
        .digest("hex")}`,
    },
    ...(body === undefined ? {} : { body }),
  });
}

async function denial(response: Response, code: string) {
  expect(response.status).toBe(503);
  const body = errorSchema.parse(await response.json());
  expect(body.error.code).toBe(code);
  expect(body.error.requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(body.error.requestId).not.toBe("synthetic-untrusted-request-id");
  expect(response.headers.get("x-request-id")).toBe(body.error.requestId);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(JSON.stringify(body)).not.toMatch(/synthetic-|Bearer|Cookie|stack/);
  return body.error.requestId;
}

async function ports() {
  // These doubles prove composition order only, not real identity, approval or durability.
  const identity = {
    verifySession: vi.fn(async () => ({
      status: "verified" as const,
      identity: physicianIdentity(),
    })),
    loadCurrentAuthority: vi.fn(async () => physicianAuthority()),
    now: () => now,
  };
  const knowledge = await knowledgeFixture();
  const repositoryRead = vi.spyOn(knowledge.repository, "withCurrentRead");
  const inbox = {
    commitBatch: vi.fn<DurableChannelInbox["commitBatch"]>(async () => ({
      outcome: "committed",
      inserted: 1,
      duplicates: 0,
    })),
  };
  return { identity, knowledge, repositoryRead, inbox };
}

describe("platform and feature composition — synthetic ports, no business readiness claim", () => {
  it("uses the actual default Core fetch and retains scheduled/queue handlers", async () => {
    expect(Object.keys(coreWorker).sort()).toEqual(["fetch", "queue", "scheduled"]);
    await denial(await coreWorker.fetch(incoming("/v1/session"), local), "IDENTITY_UNAVAILABLE");
    await denial(await coreWorker.fetch(incoming("/v1/session")), "CONFIGURATION_INVALID");
    await denial(await coreWorker.fetch(incoming("/health/ready"), local), "APPLICATION_NOT_READY");
    const env = {
      ...local,
      RESOURCE_NAMESPACE: "kandamkulathi-local",
      PROVIDER_MODE: "stub",
      ALLOW_LIVE_SENDS: "false",
      ALLOW_LIVE_PAYMENTS: "false",
    };
    await expect(
      coreWorker.scheduled({ scheduledTime: 0, cron: "* * * * *", noRetry: vi.fn() }, env),
    ).rejects.toThrow(/^Platform dispatch is unavailable\.$/);
    await expect(
      coreWorker.queue(
        {
          queue: "kandamkulathi-local-financial",
          messages: [],
          metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
          ackAll: vi.fn(),
          retryAll: vi.fn(),
        },
        env,
      ),
    ).rejects.toThrow(/^Platform processing is unavailable\.$/);
  });

  it.each([
    ["missing bindings", undefined],
    ["empty bindings", {}],
    ["unconfigured remote", { APP_ENV: "dev" }],
    [
      "mismatched remote namespace",
      {
        APP_ENV: "dev",
        RESOURCE_NAMESPACE: "kandamkulathi-production",
        PROVIDER_MODE: "sandbox",
      },
    ],
  ] as const)("blocks %s before any injected feature dependency", async (_name, env) => {
    const { identity, knowledge, repositoryRead, inbox } = await ports();
    const core = createCoreApi(identity);
    const companion = createCompanionApi({ knowledge, whatsapp: { config, inbox } });
    const ids = await Promise.all([
      denial(await core.fetch(incoming("/v1/session"), env), "CONFIGURATION_INVALID"),
      denial(
        await companion.fetch(
          incoming("/v1/knowledge/public-product", JSON.stringify(knowledge.request)),
          env,
        ),
        "CONFIGURATION_INVALID",
      ),
      denial(
        await companion.fetch(incoming("/v1/channels/whatsapp/webhook", raw), env),
        "CONFIGURATION_INVALID",
      ),
    ]);
    expect(new Set(ids).size).toBe(3);
    expect(identity.verifySession).not.toHaveBeenCalled();
    expect(identity.loadCurrentAuthority).not.toHaveBeenCalled();
    expect(repositoryRead).not.toHaveBeenCalled();
    expect(knowledge.authority.currentActor).not.toHaveBeenCalled();
    expect(knowledge.authority.isApprovalCurrent).not.toHaveBeenCalled();
    expect(knowledge.read.loadProduct).not.toHaveBeenCalled();
    expect(inbox.commitBatch).not.toHaveBeenCalled();
  });

  it("keeps the real log sink separate from route registration and emits only allowlisted telemetry", async () => {
    const { identity, knowledge, inbox } = await ports();
    const records: Parameters<LogSink>[0][] = [];
    const sink = vi.fn<LogSink>((record) => records.push(record));
    const core = createService("core-api", sink, {
      registerRoutes: (app) => registerIdentityRoutes(app, identity),
    });
    const companion = createService("companion", sink, {
      registerRoutes: (app) => {
        registerKnowledgeRoutes(app, knowledge);
        registerChannelRoutes(app, { config, inbox });
      },
    });
    const calls = [
      [core, incoming("/v1/session")],
      [companion, incoming("/v1/knowledge/public-product", JSON.stringify(knowledge.request))],
      [companion, incoming("/v1/channels/whatsapp/webhook", raw)],
    ] as const;
    const requestIds = [];
    for (const [app, request] of calls) {
      requestIds.push(await denial(await app.fetch(request.clone()), "CONFIGURATION_INVALID"));
      // The same trusted ports become reachable only with explicit valid local configuration.
      expect((await app.fetch(request, local)).status).toBe(200);
    }
    expect(identity.verifySession).toHaveBeenCalledOnce();
    expect(identity.loadCurrentAuthority).toHaveBeenCalledOnce();
    expect(knowledge.authority.isApprovalCurrent).toHaveBeenCalled();
    expect(inbox.commitBatch).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledTimes(9);
    expect(records.filter((record) => record.event === "platform_failure")).toHaveLength(3);
    for (const requestId of requestIds) {
      expect(records.filter((record) => record.requestId === requestId)).toHaveLength(2);
    }
    const keys = [
      "timestamp",
      "event",
      "service",
      "environment",
      "requestId",
      "status",
      "durationMs",
      "route",
      "sliEligible",
      "sliFailure",
    ];
    for (const record of records) {
      expect(Object.keys(record).every((key) => keys.includes(key))).toBe(true);
      expect(record.requestId).toMatch(/^[a-f0-9-]{36}$/);
      if (record.event === "http_request") expect(record.route).toBe("api");
    }
    expect(JSON.stringify(records)).not.toMatch(
      /synthetic-|Bearer|Cookie|patient|wamid|sha256|localhost|public-product|whatsapp|productId|entryId/,
    );
  });
});
