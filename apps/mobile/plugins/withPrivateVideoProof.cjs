// Official Expo WebRTC plugin, with its unnecessary overlay/legacy Bluetooth additions removed.
// No background audio, screen sharing, automatic call start or new public environment variables.
const { withAndroidManifest } = require("expo/config-plugins");
const official = require("@config-plugins/react-native-webrtc");
module.exports = function withPrivateVideoProof(config) {
  const plugin = official.default ?? official;
  const result = plugin(config, {
    cameraPermission:
      "Allow camera access for local checks or an explicitly started private video proof.",
    microphonePermission:
      "Allow microphone access for explicitly started voice input or a private video proof.",
  });
  const blocked = ["android.permission.SYSTEM_ALERT_WINDOW", "android.permission.BLUETOOTH"];
  result.android = {
    ...result.android,
    permissions: (result.android?.permissions ?? []).filter(
      (permission) => !blocked.includes(permission),
    ),
    blockedPermissions: [...new Set([...(result.android?.blockedPermissions ?? []), ...blocked])],
  };
  return withAndroidManifest(result, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest["uses-permission"] = (manifest["uses-permission"] ?? []).filter(
      (permission) =>
        !blocked.includes(permission.$["android:name"]) || permission.$["tools:node"] === "remove",
    );
    return mod;
  });
};
