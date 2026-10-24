import { fileURLToPath } from "node:url";
export default {
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: {
      "@kandamkulathi/client/private-video": fileURLToPath(
        new URL("../../packages/client/src/private-video.ts", import.meta.url),
      ),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5196,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
  },
};
