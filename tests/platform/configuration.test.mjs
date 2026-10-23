import assert from "node:assert/strict";
import test from "node:test";
import { testDatabase } from "./support.mjs";

test("database tests reject missing/unsafe targets without exposing malformed credential input", async () => {
  const original = process.env.PLATFORM_TEST_ADMIN_URL;
  const marker = "do-not-log-this-synthetic-password";
  try {
    for (const value of [
      "",
      `postgresql://test:${marker}@:",`,
      `http://test:${marker}@127.0.0.1/postgres`,
      `postgresql://test:${marker}@remote.invalid/postgres`,
    ]) {
      process.env.PLATFORM_TEST_ADMIN_URL = value;
      await assert.rejects(testDatabase(), (error) => {
        assert(!JSON.stringify(error).includes(marker));
        assert(!error.message.includes(marker));
        return true;
      });
    }
  } finally {
    if (original === undefined) delete process.env.PLATFORM_TEST_ADMIN_URL;
    else process.env.PLATFORM_TEST_ADMIN_URL = original;
  }
});
