import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import test from "node:test";
import { handleWhatsAppWebhook } from "../../apps/companion/src/channels/whatsapp.ts";
import { configuredChannelNoticeHandler } from "../../apps/core-api/src/channel-notice-runtime.ts";
import { channelNoticeHandler } from "../../packages/database/src/channel-notices.ts";
import { postgresChannelInbox } from "../../packages/database/src/channels.ts";
import { acquireExecution, releaseExecution } from "../../packages/database/src/outbox.ts";
import { executeExternalClaim } from "../../packages/database/src/outbox-external.ts";
import { whatsappNoticeProvider } from "../../packages/providers/src/whatsapp-notice.ts";
import { testDatabase } from "./support.mjs";

const capabilityId = "11111111-1111-4111-8111-111111111111";
const config = {
  appSecret: "synthetic-signing-key-for-notice",
  verifyToken: "synthetic-verification-token",
  businessAccountId: "101",
  receivingPhoneNumberId: "202",
};
const eventTimestamp = String(Math.floor(Date.now() / 1000));
async function signed(id, from = "303", invalid = false, kind = "text") {
  const body = JSON.stringify({
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
              ...(kind === "status"
                ? {
                    statuses: [
                      { id, recipient_id: from, status: "sent", timestamp: eventTimestamp },
                    ],
                  }
                : {
                    messages: [
                      {
                        id,
                        from,
                        timestamp: eventTimestamp,
                        ...(kind === "audio"
                          ? {
                              type: "audio",
                              audio: {
                                id: "synthetic.media",
                                mime_type: "audio/ogg",
                                sha256: `${"A".repeat(43)}=`,
                              },
                            }
                          : {
                              type: "text",
                              text: { body: "synthetic nonclinical test" },
                            }),
                      },
                    ],
                  }),
            },
          },
        ],
      },
    ],
  });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(config.appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hash = Buffer.from(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  ).toString("hex");
  return new Request("http://localhost/v1/channels/whatsapp/webhook", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${invalid ? "0".repeat(64) : hash}`,
    },
  });
}

test("signed persisted event -> committed quota/reservation -> actual HTTP -> fenced receipt; replay/unknown/revocation/role denial", async () => {
  const db = await testDatabase();
  const owner = `k_notice_owner_${crypto.randomUUID().replaceAll("-", "")}`;
  await db.admin.query(`CREATE ROLE ${owner} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
  const ownerQuery = async (sql, values) => {
    await db.source.query(`SET ROLE ${owner}`);
    try {
      return await db.source.query(sql, values);
    } finally {
      await db.source.query("RESET ROLE");
    }
  };
  let calls = 0;
  let mode = "accepted";
  const server = createServer(async (req, res) => {
    calls++;
    const chunks = [];
    for await (const part of req) chunks.push(part);
    const sent = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(sent.to, "303");
    assert.deepEqual(sent.template, { name: "synthetic_test_notice", language: { code: "en" } });
    // Observable from a separate SQL connection: commit happened BEFORE HTTP.
    const reservation = (
      await db.source.query("SELECT state FROM engagement.channel_notices WHERE operation_id=$1", [
        sent.biz_opaque_callback_data,
      ])
    ).rows[0];
    assert.equal(reservation.state, "sending");
    if (mode === "unknown") {
      req.socket.destroy();
      return;
    }
    if (mode === "stale")
      await db.source.query(
        "UPDATE platform.outbox SET lease_until=clock_timestamp()-interval '1 second' WHERE operation_id=$1",
        [sent.biz_opaque_callback_data],
      );
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        messaging_product: "whatsapp",
        contacts: [{ input: "303", wa_id: "303" }],
        messages: [{ id: `wamid.synthetic.${calls}` }],
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    // Reapply ONLY this owned migration in the isolated DB as a real non-bypass owner.
    await db.source.query(
      "DROP TABLE IF EXISTS engagement.channel_notices,engagement.channel_notice_capabilities",
    );
    await db.source.query(
      "DROP FUNCTION IF EXISTS engagement.channel_notice_consume_usage(),engagement.channel_notice_preserve_usage()",
    );
    await db.source.query(`GRANT USAGE,CREATE ON SCHEMA engagement TO ${owner}`);
    await db.source.query(`GRANT USAGE ON SCHEMA platform TO ${owner}`);
    await db.source.query(
      `GRANT SELECT ON platform.outbox,engagement.mathew_channel_processing TO ${owner}`,
    );
    await db.source.query(
      `GRANT REFERENCES ON engagement.mathew_channel_inbox,engagement.mathew_channel_processing TO ${owner}`,
    );
    await ownerQuery(
      readFileSync(
        new URL("../../packages/database/migrations/0029_channel_notices.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.deepEqual(
      (
        await db.source.query("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1", [
          owner,
        ])
      ).rows[0],
      { rolsuper: false, rolbypassrls: false },
    );
    const capability = {
      purpose: "test_notice",
      businessAccountId: "101",
      phoneNumberId: "202",
      recipientId: "303",
      templateName: "synthetic_test_notice",
      language: "en",
      approvalRef: "synthetic-company-template-approval",
      consentRef: "synthetic-explicit-recipient-consent",
      policyVersion: "synthetic-v1",
      enabled: true,
      notBefore: new Date(Date.now() - 60000).toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      maxEventAgeSeconds: 600,
      maxNotices: 10,
    };
    await ownerQuery(
      "INSERT INTO engagement.channel_notice_capabilities(id,revision,capability) VALUES($1,1,$2)",
      [capabilityId, capability],
    );
    const receive = (request) =>
      db.runtime("core", (context) =>
        handleWhatsAppWebhook(request, { config, inbox: postgresChannelInbox(context) }),
      );
    assert.equal((await receive(await signed("bad", "303", true))).status, 401);
    assert.equal(
      (await handleWhatsAppWebhook(await signed("absent"), { inbox: undefined })).status,
      503,
    );
    const provider = whatsappNoticeProvider({
      accessToken: "synthetic",
      graphVersion: "v23.0",
      fetch: (_url, init) => fetch(`http://127.0.0.1:${server.address().port}`, init),
    });
    const handler = channelNoticeHandler(capabilityId, provider);
    const enqueue = async (id, from, kind) => {
      assert.equal((await receive(await signed(id, from, false, kind))).status, 200);
      const row = (
        await db.source.query(
          "SELECT o.id FROM platform.outbox o JOIN engagement.mathew_channel_inbox i ON i.id=o.subject_id WHERE i.event->>'providerEventId'=$1",
          [id],
        )
      ).rows[0];
      return { schemaVersion: 1, id: row.id, channel: "engagement" };
    };
    const execute = (envelope, selectedHandler = handler) =>
      db.runtime("jobs", async (context) => {
        const claim = await acquireExecution(context.client, envelope);
        assert.equal(typeof claim, "object");
        assert.equal(
          await db.runtime("jobs", (other) => acquireExecution(other.client, envelope)),
          "busy",
        );
        try {
          return await executeExternalClaim(context, claim, selectedHandler);
        } catch (error) {
          await releaseExecution(context.client, claim);
          throw error;
        }
      });
    const first = await enqueue("notice.first");
    assert.equal(await execute(first), "succeeded");
    assert.equal((await receive(await signed("notice.first"))).status, 200);
    assert.equal(
      await db.runtime("jobs", (context) => acquireExecution(context.client, first)),
      "terminal",
    );
    assert.equal(calls, 1);
    // Crash after the domain accepted receipt, before the platform receipt: reconcile, never resend.
    await db.source.query("DELETE FROM platform.receipts WHERE job_id=$1", [first.id]);
    await db.source.query(
      "UPDATE platform.outbox SET status='pending',completed_at=NULL,lease_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [first.id],
    );
    assert.equal(await execute(first), "succeeded");
    assert.equal(calls, 1);
    assert.equal(
      (await db.source.query("SELECT count(*)::int AS n FROM platform.receipts")).rows[0].n,
      1,
    );
    const wrong = await enqueue("notice.wrong", "404");
    assert.equal(await execute(wrong), "succeeded");
    assert.equal(calls, 1);
    await ownerQuery(
      "UPDATE engagement.channel_notice_capabilities SET capability=jsonb_set(capability,'{enabled}','false')",
    );
    const revoked = await enqueue("notice.revoked");
    assert.equal(await execute(revoked), "succeeded");
    await ownerQuery(
      "UPDATE engagement.channel_notice_capabilities SET capability=jsonb_set(capability,'{enabled}','true')",
    );
    await ownerQuery(
      "UPDATE engagement.channel_notice_capabilities SET capability=jsonb_set(capability,'{expiresAt}',to_jsonb($1::text))",
      [new Date(Date.now() - 1000).toISOString()],
    );
    assert.equal(await execute(await enqueue("notice.expired")), "succeeded");
    assert.equal(calls, 1);
    await ownerQuery(
      "UPDATE engagement.channel_notice_capabilities SET capability=jsonb_set(capability,'{expiresAt}',to_jsonb($1::text))",
      [capability.expiresAt],
    );
    for (const nextMode of ["unknown", "stale"]) {
      mode = nextMode;
      const envelope = await enqueue(`notice.${mode}`);
      await assert.rejects(execute(envelope));
      const beforeRetry = calls;
      await db.source.query(
        "UPDATE platform.outbox SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",
        [envelope.id],
      );
      await assert.rejects(execute(envelope), /reconciliation/);
      assert.equal(calls, beforeRetry);
    }
    assert.equal(
      (
        await db.source.query(
          "SELECT count(*)::int AS n FROM engagement.channel_notices WHERE state='unknown'",
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (await db.source.query("SELECT count(*)::int AS n FROM platform.receipts")).rows[0].n,
      4,
    );
    await db.runtime("jobs", async ({ client }) => {
      await assert.rejects(
        client.query("UPDATE engagement.channel_notice_capabilities SET capability='{}'"),
      );
      await assert.rejects(
        client.query(
          "INSERT INTO engagement.channel_notice_capabilities(id,revision,capability) VALUES(gen_random_uuid(),1,'{}')",
        ),
      );
      await assert.rejects(client.query("UPDATE engagement.mathew_channel_inbox SET event='{}'"));
      for (const expression of ["0", "used-1", "used+1", "used+2"])
        await assert.rejects(
          client.query(`UPDATE engagement.channel_notice_capabilities SET used=${expression}`),
        );
      await assert.rejects(
        client.query("UPDATE engagement.channel_notice_capabilities SET revision=revision+1"),
      );
    });
    await db.runtime("core", async ({ client }) => {
      await assert.rejects(client.query("SELECT * FROM engagement.channel_notice_capabilities"));
      await assert.rejects(client.query("UPDATE engagement.channel_notices SET state='accepted'"));
    });
    // Different authoritative events compete for one remaining approved send.
    mode = "accepted";
    await ownerQuery(
      "UPDATE engagement.channel_notice_capabilities SET capability=jsonb_set(capability,'{maxNotices}',to_jsonb(used+1))",
    );
    const quotaJobs = await Promise.all([enqueue("notice.quota.one"), enqueue("notice.quota.two")]);
    const quotaBefore = calls;
    const quotaResults = await Promise.all(quotaJobs.map((job) => execute(job)));
    assert.deepEqual(quotaResults, ["succeeded", "succeeded"]);
    assert.equal(calls, quotaBefore + 1);
    for (const kind of ["audio", "status"]) {
      assert.equal(await execute(await enqueue(`notice.${kind}`, "303", kind)), "succeeded");
    }
    assert.equal(
      await execute(
        await enqueue("notice.config"),
        configuredChannelNoticeHandler({ APP_ENV: "local" }),
      ),
      "succeeded",
    );
    assert.equal(calls, quotaBefore + 1);
    const routes = (
      await db.source.query(
        "SELECT i.state AS inbox_state,p.state AS processing_state FROM engagement.mathew_channel_inbox i JOIN engagement.mathew_channel_processing p ON p.inbox_id=i.id",
      )
    ).rows;
    assert(
      routes.every(
        (row) => row.inbox_state === "awaiting_human" && row.processing_state === "awaiting_human",
      ),
    );
    const suppressed = (
      await db.source.query(
        "SELECT state,provider_message_id FROM engagement.channel_notices WHERE state='suppressed'",
      )
    ).rows;
    assert.equal(suppressed.length, 7);
    assert(suppressed.every((row) => row.provider_message_id === null));
    const usage = (await ownerQuery("SELECT used FROM engagement.channel_notice_capabilities"))
      .rows[0].used;
    assert.equal(usage, calls);
    await assert.rejects(ownerQuery("UPDATE engagement.channel_notice_capabilities SET used=0"));
    assert.equal(
      (await ownerQuery("SELECT used FROM engagement.channel_notice_capabilities")).rows[0].used,
      usage,
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await db.source.query(`REASSIGN OWNED BY ${owner} TO CURRENT_USER`);
    await db.source.query(`DROP OWNED BY ${owner}`);
    await db.admin.query(`DROP ROLE ${owner}`);
    await db.close();
  }
});
