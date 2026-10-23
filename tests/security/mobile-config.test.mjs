import assert from "node:assert/strict";
import test from "node:test";
import { mobileConfig } from "../../apps/mobile/config.mjs";

test("local native configuration is isolated and declares actual permission/secure-storage plugins", () => {
  const config = mobileConfig({ slug: "synthetic", name: "synthetic" }, {});
  assert.equal(config.scheme, "kandamkulathi-local");
  assert.equal(config.ios.bundleIdentifier, "com.example.kandamkulathi.local");
  assert.equal(config.android.allowBackup, false);
  assert.equal(config.extra.releaseApproved, false);
  assert(config.plugins.some((plugin) => plugin[0] === "expo-secure-store"));
});
test("nonlocal builds refuse missing company identifiers, insecure URLs and public secrets", () => {
  for (const env of [
    { EXPO_PUBLIC_APP_ENV: "dev" },
    { EXPO_PUBLIC_APP_ENV: "dev", EXPO_PUBLIC_CORE_API_ORIGIN: "http://127.0.0.1:8787" },
    { EXPO_PUBLIC_APP_ENV: "unknown" },
    { EXPO_PUBLIC_API_KEY: "synthetic" },
    { EXPO_PUBLIC_DATABASE_URL: "synthetic-credential" },
    { EXPO_PUBLIC_CORE_API_ORIGIN: "https://user:password@example.com" },
    { EXPO_PUBLIC_COMPANION_API_ORIGIN: "http://api.example.com" },
    { EXPO_PUBLIC_COMPANION_API_ORIGIN: "https://api.example.com/v1" },
    { EXPO_PUBLIC_COMPANION_API_ORIGIN: "https://api.example.com?token=private" },
    { EXPO_PUBLIC_COMPANION_API_ORIGIN: "https://user:password@api.example.com" },
  ])
    assert.throws(() => mobileConfig({}, env));
});
test("company development build uses only selected public fields and explicit identifiers", () => {
  const config = mobileConfig(
    {},
    {
      EXPO_PUBLIC_APP_ENV: "dev",
      EXPO_PUBLIC_CORE_API_ORIGIN: "https://dev-api.example.com",
      EXPO_PUBLIC_COMPANION_API_ORIGIN: "https://dev-companion.example.com",
      MOBILE_IOS_BUNDLE_ID: "com.examplecompany.kandamkulathi.dev",
      MOBILE_ANDROID_APPLICATION_ID: "com.examplecompany.kandamkulathi.dev",
      MOBILE_EXPO_OWNER: "synthetic-company",
      MOBILE_EAS_PROJECT_ID: "00000000-0000-4000-8000-000000000001",
      DATABASE_URL: "private-not-exported",
    },
  );
  assert.equal(config.scheme, "kandamkulathi-dev");
  assert.equal(config.extra.coreApiOrigin, "https://dev-api.example.com");
  assert.equal(config.extra.companionApiOrigin, "https://dev-companion.example.com");
  assert(!JSON.stringify(config).includes("private-not-exported"));
});
