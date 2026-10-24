import { parseVideoProofConfig } from "./videoProofConfig.mjs";

/** Public build configuration only. Signing credentials remain with company build tooling. */
export function mobileConfig(base, env) {
  const environment = env.EXPO_PUBLIC_APP_ENV ?? "local";
  if (!["local", "dev", "staging", "production"].includes(environment))
    throw new Error("Invalid mobile environment");
  for (const key of Object.keys(env)) {
    if (
      key.startsWith("EXPO_PUBLIC_") &&
      ![
        "EXPO_PUBLIC_APP_ENV",
        "EXPO_PUBLIC_CORE_API_ORIGIN",
        "EXPO_PUBLIC_COMPANION_API_ORIGIN",
      ].includes(key)
    )
      throw new Error("Unapproved public variable refused");
  }
  const local = environment === "local";
  const origin = env.EXPO_PUBLIC_CORE_API_ORIGIN ?? (local ? "http://127.0.0.1:8787" : "");
  const url = new URL(origin);
  const companion = new URL(
    env.EXPO_PUBLIC_COMPANION_API_ORIGIN ?? (local ? "http://127.0.0.1:8788" : ""),
  );
  if (
    companion.username ||
    companion.password ||
    companion.search ||
    companion.hash ||
    companion.pathname !== "/" ||
    !(
      companion.protocol === "https:" ||
      (local &&
        companion.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(companion.hostname))
    )
  )
    throw new Error("Invalid public Companion origin");
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !(
      url.protocol === "https:" ||
      (local && url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))
    )
  )
    throw new Error("Invalid public API origin");
  const ios = env.MOBILE_IOS_BUNDLE_ID ?? (local ? "com.example.kandamkulathi.local" : "");
  const android =
    env.MOBILE_ANDROID_APPLICATION_ID ?? (local ? "com.example.kandamkulathi.local" : "");
  if (
    ![ios, android].every(
      (value) =>
        /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*){2,}$/.test(value) &&
        (local || !value.startsWith("com.example.")),
    )
  )
    throw new Error("Approved company application identifiers required");
  if (
    !local &&
    (!/^[a-zA-Z0-9_-]{2,64}$/.test(env.MOBILE_EXPO_OWNER ?? "") ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        env.MOBILE_EAS_PROJECT_ID ?? "",
      ))
  )
    throw new Error("Company Expo project configuration required");
  let transcriptionProof;
  if (env.MOBILE_TRANSCRIPTION_PROOF_APPROVED === "true") {
    if (environment === "production") throw new Error("Transcription proof is nonproduction only");
    let policy;
    try {
      policy = JSON.parse(env.MOBILE_TRANSCRIPTION_PROCESSING_POLICY ?? "");
    } catch {
      throw new Error("Approved transcription notice configuration required");
    }
    if (
      !policy ||
      typeof policy !== "object" ||
      Array.isArray(policy) ||
      Object.keys(policy).some((key) => !["version", "notices"].includes(key)) ||
      typeof policy.version !== "string" ||
      !policy.version.trim() ||
      policy.version.length > 128 ||
      !policy.notices ||
      typeof policy.notices !== "object" ||
      Array.isArray(policy.notices) ||
      Object.keys(policy.notices).some((key) => !["en", "ml", "ta"].includes(key)) ||
      ["en", "ml", "ta"].some(
        (locale) =>
          typeof policy.notices[locale] !== "string" ||
          !policy.notices[locale].trim() ||
          policy.notices[locale].length > 12000,
      )
    )
      throw new Error("Approved transcription notice configuration required");
    transcriptionProof = {
      transcriptionProofApproved: true,
      transcriptionProcessingPolicy: policy,
    };
  }
  return {
    slug: base.slug ?? "kandamkulathi",
    ...base,
    name: `Kandamkulathi ${environment}`,
    scheme: `kandamkulathi-${environment}`,
    owner: env.MOBILE_EXPO_OWNER,
    ios: { ...base.ios, bundleIdentifier: ios, supportsTablet: true },
    android: { ...base.android, package: android, allowBackup: false },
    plugins: [
      ["expo-secure-store", { configureAndroidBackup: true }],
      [
        "expo-camera",
        {
          cameraPermission: "Allow the local camera check and consultation preview when requested.",
          recordAudioAndroid: false,
        },
      ],
      [
        "expo-audio",
        {
          microphonePermission:
            "Allow microphone capture only when you start voice input or a consultation.",
          enableBackgroundRecording: false,
          enableBackgroundPlayback: false,
        },
      ],
      "expo-notifications",
      "expo-web-browser",
      [
        "expo-font",
        {
          fonts: [
            "../../packages/i18n/fonts/NotoSansMalayalam.ttf",
            "../../packages/i18n/fonts/NotoSansTamil.ttf",
          ],
        },
      ],
      ["./plugins/withNetworkPolicy.cjs", { local }],
      "./plugins/withPrivateVideoProof.cjs",
    ],
    extra: {
      environment,
      coreApiOrigin: url.origin,
      companionApiOrigin: companion.origin,
      releaseApproved: false,
      ...parseVideoProofConfig(env, environment),
      ...transcriptionProof,
      ...(env.MOBILE_EAS_PROJECT_ID ? { eas: { projectId: env.MOBILE_EAS_PROJECT_ID } } : {}),
    },
  };
}
