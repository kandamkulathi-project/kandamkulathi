import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      "@kandamkulathi/client/private-video": fileURLToPath(
        new URL("../../packages/client/src/private-video.ts", import.meta.url),
      ),
      "react-native": fileURLToPath(new URL("./native-stub.ts", import.meta.url)),
      "expo-constants": fileURLToPath(new URL("./expo-stub.ts", import.meta.url)),
      "react-native-webrtc": fileURLToPath(new URL("./sdk-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/video-proof/*.test.{ts,mjs}"],
    exclude: ["tests/video-proof/native-config.test.mjs"],
    environment: "node",
  },
});
