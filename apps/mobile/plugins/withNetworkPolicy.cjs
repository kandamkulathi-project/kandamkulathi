const { withAndroidManifest, withInfoPlist } = require("expo/config-plugins");
module.exports = function withNetworkPolicy(config, { local = false } = {}) {
  config = withAndroidManifest(config, (result) => {
    const application = result.modResults.manifest.application?.[0];
    if (!application) throw new Error("Native application manifest required");
    application.$["android:usesCleartextTraffic"] = local ? "true" : "false";
    application.$["android:allowBackup"] = "false";
    return result;
  });
  return withInfoPlist(config, (result) => {
    result.modResults.NSAppTransportSecurity = {
      NSAllowsArbitraryLoads: false,
      NSExceptionDomains: local
        ? {
            localhost: { NSExceptionAllowsInsecureHTTPLoads: true },
            "127.0.0.1": { NSExceptionAllowsInsecureHTTPLoads: true },
          }
        : {},
    };
    return result;
  });
};
