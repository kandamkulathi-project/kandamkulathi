import { fileURLToPath } from "node:url";
import react from "../../apps/workspaces/node_modules/@vitejs/plugin-react/dist/index.js";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
export default {
  plugins: [react()],
  root: path("."),
  define: {
    "import.meta.env.VITE_P1_VIDEO_PROOF_ENABLED": JSON.stringify("1"),
    "import.meta.env.VITE_P1_VIDEO_PROOF_ENDPOINT": JSON.stringify(
      "https://signal.example.test/p1-private-video-proof",
    ),
  },
  resolve: {
    alias: {
      react: path("../../apps/workspaces/node_modules/react"),
      "react-dom": path("../../apps/workspaces/node_modules/react-dom"),
      "@kandamkulathi/client/private-video": path("../../packages/client/src/private-video.ts"),
    },
  },
  server: { host: "127.0.0.1", port: 5197, strictPort: true, fs: { allow: [path("../..")] } },
};
