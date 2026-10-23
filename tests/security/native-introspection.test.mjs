import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

for (const environment of ["local", "dev"]) {
  test(`actual Expo native plugin output enforces ${environment} network, storage and capture policy`, () => {
    const result = spawnSync(
      process.execPath,
      ["node_modules/expo/bin/cli", "config", "--type", "introspect", "--json"],
      {
        cwd: resolve("apps/mobile"),
        encoding: "utf8",
        timeout: 90000,
        windowsHide: true,
        env: {
          ...process.env,
          EXPO_NO_DOTENV: "1",
          EXPO_NO_TELEMETRY: "1",
          EXPO_PUBLIC_APP_ENV: environment,
          EXPO_PUBLIC_CORE_API_ORIGIN:
            environment === "local" ? "http://127.0.0.1:8787" : "https://dev-api.example.com",
          MOBILE_IOS_BUNDLE_ID: "com.examplecompany.kandamkulathi.dev",
          MOBILE_ANDROID_APPLICATION_ID: "com.examplecompany.kandamkulathi.dev",
          MOBILE_EXPO_OWNER: "synthetic-company",
          MOBILE_EAS_PROJECT_ID: "00000000-0000-4000-8000-000000000001",
        },
      },
    );
    assert.equal(result.status, 0, "Native configuration introspection must succeed");
    const config = JSON.parse(result.stdout);
    const ios = config._internal.modResults.ios.infoPlist;
    const application = config._internal.modResults.android.manifest.manifest.application[0].$;
    assert.equal(
      ios.NSAppTransportSecurity.NSAllowsArbitraryLoads,
      false,
      "Native arbitrary cleartext access must be disabled",
    );
    assert.equal(
      application["android:usesCleartextTraffic"],
      environment === "local" ? "true" : "false",
    );
    assert.equal(application["android:allowBackup"], "false");
    assert(application["android:fullBackupContent"].includes("secure_store"));
    assert(
      !ios.UIBackgroundModes?.includes("audio"),
      "Local capture must not enable background audio",
    );
    assert(ios.NSCameraUsageDescription && ios.NSMicrophoneUsageDescription);
    assert(
      ios.UIAppFonts.includes("NotoSansMalayalam.ttf") &&
        ios.UIAppFonts.includes("NotoSansTamil.ttf"),
    );
    if (environment !== "local")
      assert.deepEqual(ios.NSAppTransportSecurity.NSExceptionDomains, {});
  });
}
