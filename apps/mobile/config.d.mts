import type { ExpoConfig } from "expo/config";
export function mobileConfig(
  base: Partial<ExpoConfig>,
  env: Record<string, string | undefined>,
): ExpoConfig;
