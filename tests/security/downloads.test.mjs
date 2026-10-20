import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchBytes } from "../../scripts/security/tools.mjs";

const url = "https://example.invalid/synthetic-security-download";
const noWait = async () => {};
const success = () => ({
  ok: true,
  arrayBuffer: async () => Buffer.from("synthetic verified input"),
});
describe("bounded retries for read-only security downloads", () => {
  it("recovers from connection and truncated-body failures before returning fresh bytes", async () => {
    let attempts = 0;
    const result = await fetchBytes(
      url,
      async () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError("Synthetic disconnected socket");
        if (attempts === 2)
          return {
            ok: true,
            arrayBuffer: async () => {
              throw new Error("Synthetic truncated body");
            },
          };
        return success();
      },
      noWait,
    );
    assert.equal(attempts, 3);
    assert.equal(result.toString(), "synthetic verified input");
  });
  it("retries temporary HTTP errors but never returns success after exhaustion", async () => {
    let attempts = 0;
    await assert.rejects(
      fetchBytes(
        url,
        async () => {
          attempts += 1;
          return { ok: false, status: attempts === 1 ? 429 : 503 };
        },
        noWait,
      ),
      /after three attempts/,
    );
    assert.equal(attempts, 3);
  });
  it("does not retry permanent HTTP rejection or permit insecure transport", async () => {
    let attempts = 0;
    await assert.rejects(
      fetchBytes(
        url,
        async () => {
          attempts += 1;
          return { ok: false, status: 403 };
        },
        noWait,
      ),
      /HTTP 403/,
    );
    assert.equal(attempts, 1);
    await assert.rejects(fetchBytes(url.replace("https:", "http:"), success, noWait), /HTTPS/);
  });
});
