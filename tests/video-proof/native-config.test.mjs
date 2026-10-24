import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { mobileConfig } from "../../apps/mobile/config.mjs";

test("installed official plugin works with exact Expo 58 config without overlays/background/cleartext changes", async () => {
  const projectRoot = resolve("apps/mobile");
  const require = createRequire(resolve(projectRoot, "package.json"));
  assert.equal(require("expo/package.json").version, "58.0.19");
  assert.equal(require("react-native/package.json").version, "0.88.0");
  assert.equal(require("react-native-webrtc/package.json").version, "155.0.1");
  assert.equal(require("@config-plugins/react-native-webrtc/package.json").version, "15.0.2");
  const { compileModsAsync, withPlugins } = require("expo/config-plugins");
  const config = mobileConfig(
    { name: "P1 synthetic", slug: "p1-synthetic" },
    { EXPO_PUBLIC_APP_ENV: "local" },
  );
  assert.equal(config.plugins.at(-1), "./plugins/withPrivateVideoProof.cjs");
  const configured = withPlugins({ ...config, _internal: { projectRoot } }, config.plugins);
  const result = await compileModsAsync(configured, {
    projectRoot,
    platforms: ["android", "ios"],
    introspect: true,
  });
  const ios = result._internal.modResults.ios.infoPlist;
  assert.equal(ios.NSAppTransportSecurity.NSAllowsArbitraryLoads, false);
  assert(!ios.UIBackgroundModes?.includes("audio"));
  assert(ios.NSCameraUsageDescription && ios.NSMicrophoneUsageDescription);
  const manifest = result._internal.modResults.android.manifest.manifest;
  const granted = manifest["uses-permission"]
    .filter((p) => p.$["tools:node"] !== "remove")
    .map((p) => p.$["android:name"]);
  assert(granted.includes("android.permission.CAMERA"));
  assert(granted.includes("android.permission.RECORD_AUDIO"));
  assert(!granted.includes("android.permission.SYSTEM_ALERT_WINDOW"));
  assert(!granted.includes("android.permission.BLUETOOTH"));
  assert.equal(manifest.application[0].$["android:allowBackup"], "false");
});
