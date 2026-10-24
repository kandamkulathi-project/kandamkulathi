import { fileURLToPath } from "node:url";
import {
  defineConfig,
  mergeConfig,
  type ViteDevServer,
} from "../../apps/workspaces/node_modules/vite/dist/node/index.js";
import workspace from "../../apps/workspaces/vite.config.ts";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
// Run the real application config, with React resolution also available to the test-only harness.
export default mergeConfig(
  workspace,
  defineConfig({
    root: path("../../apps/workspaces"),
    // Synthetic first-party routing for actual root authoring integration tests only.
    define: {
      "import.meta.env.VITE_COMPANION_API_ORIGIN": JSON.stringify("http://127.0.0.1:8787"),
    },
    plugins: [
      {
        name: "strict-lifecycle-test-harness",
        configureServer(server: ViteDevServer) {
          server.middlewares.use(async (request, response, next) => {
            if (request.url !== "/__strict-lifecycle") return next();
            const html = await server.transformIndexHtml(
              request.url,
              `<div id="root"></div><script type="module" src="/@fs${path("./web-strict-lifecycle.harness.tsx")}"></script>`,
            );
            response.setHeader("Content-Type", "text/html");
            response.end(html);
          });
        },
      },
    ],
    resolve: {
      alias: {
        react: path("../../apps/workspaces/node_modules/react"),
        "react-dom": path("../../apps/workspaces/node_modules/react-dom"),
      },
    },
  }),
);
