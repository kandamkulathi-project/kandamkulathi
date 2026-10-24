import { describe, expect, it } from "vitest";
import { createCompanionApi } from "../../apps/companion/src/service";

describe("real channel runtime composition", () => {
  it("does not acknowledge signed ingress without configured durable storage", async () => {
    const app = createCompanionApi();
    const response = await app.request(
      "/v1/channels/whatsapp/webhook",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
      {
        APP_ENV: "local",
        WHATSAPP_APP_SECRET: "synthetic-transport-secret",
        WHATSAPP_VERIFY_TOKEN: "synthetic-verification-token",
        WHATSAPP_BUSINESS_ACCOUNT_ID: "101",
        WHATSAPP_PHONE_NUMBER_ID: "202",
      } as never,
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("CHANNEL_UNAVAILABLE");
  });
  it("serves provider challenge without opening an unnecessary database connection", async () => {
    const app = createCompanionApi();
    const response = await app.request(
      "/v1/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=synthetic-verification-token&hub.challenge=1234",
      {},
      {
        APP_ENV: "local",
        WHATSAPP_APP_SECRET: "synthetic-transport-secret",
        WHATSAPP_VERIFY_TOKEN: "synthetic-verification-token",
        WHATSAPP_BUSINESS_ACCOUNT_ID: "101",
        WHATSAPP_PHONE_NUMBER_ID: "202",
      } as never,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("1234");
  });
});
