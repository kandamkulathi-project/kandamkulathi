import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import companion from "../../apps/companion/src/index";
import { createCompanionApi } from "../../apps/companion/src/service";
import type { DurableChannelInbox } from "../../packages/contracts/src/channels";
import { knowledgeFixture } from "../unit/knowledge.fixtures";

const webhook = "http://localhost/v1/channels/whatsapp/webhook";
const knowledge = "http://localhost/v1/knowledge/public-product";
const config = {
  appSecret: "synthetic-composition-secret-not-a-credential",
  verifyToken: "synthetic-composition-token",
  businessAccountId: "10001",
  receivingPhoneNumberId: "20001",
};
const challenge = `${webhook}?hub.mode=subscribe&hub.verify_token=${config.verifyToken}&hub.challenge=123`;
const publicRequest = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const request = (
  app: ReturnType<typeof createCompanionApi>,
  input: Parameters<typeof app.request>[0],
  init?: RequestInit,
) => app.request(input, init, { APP_ENV: "local" });

describe("combined Companion composition — synthetic ports are not provider/database proof", () => {
  it("mounts both fail-closed adapters in the default Worker and keeps readiness unavailable", async () => {
    const fixture = await knowledgeFixture();
    const response = await request(companion, knowledge, publicRequest(fixture.request));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "not-ready", reason: "NOT_CONFIGURED" });
    const channel = await request(companion, challenge, {
      headers: { Authorization: "Bearer fabricated", "X-Role": "admin" },
    });
    expect(channel.status).toBe(503);
    expect(await channel.json()).toMatchObject({ error: { code: "CHANNEL_UNAVAILABLE" } });
    for (const item of [response, channel]) {
      expect(item.headers.get("cache-control")).toBe("no-store");
      expect(item.headers.get("x-content-type-options")).toBe("nosniff");
      expect(item.headers.get("x-request-id")).toBeTruthy();
    }
    expect(response.headers.get("x-request-id")).not.toBe(channel.headers.get("x-request-id"));
    expect((await request(companion, "http://localhost/health/ready")).status).toBe(503);
  });

  it("does not let a missing channel adapter block authorized public knowledge", async () => {
    const fixture = await knowledgeFixture();
    const app = createCompanionApi({ knowledge: fixture });
    const response = await request(app, knowledge, publicRequest(fixture.request));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ready" });
    expect((await request(app, challenge)).status).toBe(503);
    expect((await request(app, "http://localhost/health/ready")).status).toBe(503);
  });

  it("can verify a configured challenge without pretending missing storage or knowledge is ready", async () => {
    const app = createCompanionApi({ whatsapp: { config } });
    const verified = await request(app, challenge);
    expect(verified.status).toBe(200);
    expect(await verified.text()).toBe("123");
    expect((await request(app, webhook, publicRequest({}))).status).toBe(503);
    expect((await request(app, knowledge, publicRequest({}))).status).toBe(503);
    expect((await request(app, "http://localhost/health/ready")).status).toBe(503);
  });

  it("preserves raw signed bytes and independent knowledge routing when both test ports exist", async () => {
    const fixture = await knowledgeFixture();
    // Deliberate contract double: no production in-memory receipt implementation exists.
    const inbox: DurableChannelInbox = {
      commitBatch: vi.fn<DurableChannelInbox["commitBatch"]>(async () => ({
        outcome: "committed",
        inserted: 1,
        duplicates: 0,
      })),
    };
    const app = createCompanionApi({ knowledge: fixture, whatsapp: { config, inbox } });
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
                metadata: {
                  display_phone_number: "0000000000",
                  phone_number_id: config.receivingPhoneNumberId,
                },
                messages: [
                  {
                    from: "30001",
                    id: "wamid.composition=",
                    timestamp: "1000",
                    type: "text",
                    text: { body: "Synthetic fixture" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const receipt = await request(app, webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": `sha256=${createHmac("sha256", config.appSecret).update(raw).digest("hex")}`,
      },
      body: raw,
    });
    expect(receipt.status).toBe(200);
    expect(inbox.commitBatch).toHaveBeenCalledOnce();
    const publicResponse = await request(app, knowledge, publicRequest(fixture.request));
    expect(publicResponse.status).toBe(200);
    expect(await publicResponse.json()).toMatchObject({ status: "ready" });
    expect(
      (await request(app, "http://localhost/v1/channels/whatsapp/send", publicRequest({}))).status,
    ).toBe(503);
  });
});
