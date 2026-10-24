import assert from "node:assert/strict";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import test from "node:test";
import {
  channelIngressHandler,
  postgresChannelInbox,
} from "../../packages/database/src/channels.ts";
import { acquireExecution, executeClaim } from "../../packages/database/src/outbox.ts";
import { semanticReceipts } from "../../packages/providers/src/whatsapp/index.ts";
import { testDatabase } from "./support.mjs";

const config = {
  appSecret: "synthetic-channel-signing-material",
  verifyToken: "synthetic-channel-verification",
  businessAccountId: "101",
  receivingPhoneNumberId: "202",
};
registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url.endsWith(".ts") && result.source != null) {
      return {
        ...result,
        format: "module",
        source: stripTypeScriptTypes(String(result.source), { mode: "transform", sourceUrl: url }),
      };
    }
    return result;
  },
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        !/\.[a-z]+$/i.test(specifier)
      )
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          return nextResolve(`${specifier}/index.ts`, context);
        }
      throw error;
    }
  },
});
const event = (id, text = "Synthetic nonclinical test") => ({
  businessAccountId: "101",
  receivingPhoneNumberId: "202",
  providerEventId: id,
  occurredAtSeconds: "1792820000",
  kind: "text",
  senderId: "303",
  text,
});
async function signedRequest(body, invalid = false) {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(config.appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hash = new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes));
  const signature = Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
  return new Request("http://localhost/v1/channels/whatsapp/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${invalid ? "0".repeat(64) : signature}`,
    },
    body: bytes,
  });
}
const body = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "101",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "202", display_phone_number: "202" },
            messages: [
              {
                id: "wamid.synthetic",
                from: "303",
                timestamp: "1792820000",
                type: "text",
                text: { body: "Synthetic nonclinical test" },
              },
            ],
          },
        },
      ],
    },
  ],
};

test("default Companion entry uses real bindings to commit receipts plus reference-only jobs, rejects signatures, and deduplicates", async () => {
  const db = await testDatabase();
  try {
    const { default: companion } = await import("../../apps/companion/src/index.ts");
    const receive = (request) =>
      companion.fetch(request, {
        APP_ENV: "local",
        DATABASE_URL: db.urls.core,
        LOCAL_DATABASE_PROXY: db.localProxy,
        RESOURCE_NAMESPACE: "kandamkulathi-local",
        WHATSAPP_APP_SECRET: config.appSecret,
        WHATSAPP_VERIFY_TOKEN: config.verifyToken,
        WHATSAPP_BUSINESS_ACCOUNT_ID: config.businessAccountId,
        WHATSAPP_PHONE_NUMBER_ID: config.receivingPhoneNumberId,
      });
    assert.equal((await receive(await signedRequest(body, true))).status, 401);
    assert.equal(
      (await db.source.query("SELECT count(*)::int AS count FROM engagement.mathew_channel_inbox"))
        .rows[0].count,
      0,
    );
    const responses = await Promise.all([
      receive(await signedRequest(body)),
      receive(await signedRequest(body)),
    ]);
    assert.deepEqual(
      responses.map((r) => r.status),
      [200, 200],
    );
    assert.equal(
      (await db.source.query("SELECT count(*)::int AS count FROM engagement.mathew_channel_inbox"))
        .rows[0].count,
      1,
    );
    assert.equal(
      (
        await db.source.query(
          "SELECT count(*)::int AS count FROM engagement.mathew_channel_processing",
        )
      ).rows[0].count,
      1,
    );
    const jobs = (await db.source.query("SELECT * FROM platform.outbox")).rows;
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].kind, "engagement.notify");
    assert.equal(JSON.stringify(jobs).includes("Synthetic nonclinical test"), false);
    const envelope = { schemaVersion: 1, id: jobs[0].id, channel: "engagement" };
    await db.runtime("jobs", async (context) => {
      const claim = await acquireExecution(context.client, envelope);
      assert.equal(typeof claim, "object");
      assert.equal(
        await executeClaim(context, claim, { "engagement.notify": channelIngressHandler }),
        "succeeded",
      );
      assert.equal(await acquireExecution(context.client, envelope), "terminal");
    });
    assert.equal(
      (await db.source.query("SELECT state FROM engagement.mathew_channel_processing")).rows[0]
        .state,
      "awaiting_human",
    );
    assert.equal(
      (await db.source.query("SELECT count(*)::int AS count FROM platform.receipts")).rows[0].count,
      1,
    );
  } finally {
    await db.close();
  }
});

test("conflicting channel replay rolls back whole batch and core cannot forge processing completion", async () => {
  const db = await testDatabase();
  try {
    const write = async (events) =>
      db.runtime("core", (context) =>
        semanticReceipts(events).then((receipts) =>
          postgresChannelInbox(context).commitBatch(receipts),
        ),
      );
    await write([event("same")]);
    await assert.rejects(write([event("new"), event("same", "Changed synthetic content")]));
    assert.equal(
      (await db.source.query("SELECT count(*)::int AS count FROM engagement.mathew_channel_inbox"))
        .rows[0].count,
      1,
    );
    assert.equal(
      (await db.source.query("SELECT count(*)::int AS count FROM platform.outbox")).rows[0].count,
      1,
    );
    await db.runtime("core", async ({ client }) => {
      await assert.rejects(
        client.query("UPDATE engagement.mathew_channel_processing SET state='awaiting_human'"),
      );
      await assert.rejects(client.query("DELETE FROM engagement.mathew_channel_inbox"));
    });
    await db.runtime("jobs", async ({ client }) => {
      await assert.rejects(
        client.query("UPDATE engagement.mathew_channel_inbox SET content_sha256=repeat('0',64)"),
      );
      await assert.rejects(
        client.query("UPDATE engagement.mathew_channel_inbox SET event='{}'::jsonb"),
      );
    });
  } finally {
    await db.close();
  }
});
