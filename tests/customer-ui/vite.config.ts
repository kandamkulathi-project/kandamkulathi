import { fileURLToPath } from "node:url";
import react from "../../apps/workspaces/node_modules/@vitejs/plugin-react/dist/index.js";
import { defineConfig } from "../../apps/workspaces/node_modules/vite/dist/node/index.js";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

// Test-only application: never registered in the shipped workspace or public site.
export default defineConfig({
  plugins: [react()],
  root: path("./"),
  resolve: {
    alias: {
      "@kandamkulathi/contracts/sensitive": path("../../packages/contracts/src/sensitive.ts"),
      react: path("../../apps/workspaces/node_modules/react"),
      "react-dom": path("../../apps/workspaces/node_modules/react-dom"),
    },
  },
  server: { host: "127.0.0.1", port: 5184, strictPort: true },
});
