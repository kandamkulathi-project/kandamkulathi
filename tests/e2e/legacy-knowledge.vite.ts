import { fileURLToPath } from "node:url";
import {
  defineConfig,
  mergeConfig,
  type ViteDevServer,
} from "../../apps/workspaces/node_modules/vite/dist/node/index.js";
import workspace from "../../apps/workspaces/vite.config.ts";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
export default mergeConfig(
  workspace,
  defineConfig({
    root: path("../../apps/workspaces"),
    plugins: [
      {
        name: "legacy-proposed-knowledge-test-harness",
        configureServer(server: ViteDevServer) {
          server.middlewares.use(async (request, response, next) => {
            if (!/^\/__legacy-knowledge\/(staff|physician)$/.test(request.url ?? "")) return next();
            const html = await server.transformIndexHtml(
              request.url ?? "",
              `<div id="root"></div><script type="module" src="/@fs${path("./legacy-knowledge.harness.tsx")}"></script>`,
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
