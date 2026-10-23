import type { ConfigContext, ExpoConfig } from "expo/config";
import { mobileConfig } from "./config.mjs";
export default ({ config }: ConfigContext): ExpoConfig => mobileConfig(config, process.env);
