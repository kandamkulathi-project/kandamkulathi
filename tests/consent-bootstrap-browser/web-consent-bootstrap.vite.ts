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
        name: "test-only-consent-bootstrap",
        configureServer(server: ViteDevServer) {
          server.middlewares.use(async (request, response, next) => {
            if (request.url !== "/__test-consent-bootstrap") return next();
            const html = await server.transformIndexHtml(
              request.url,
              `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic consent fixture</title><div id="root"></div><script type="module" src="/@fs${path("./web-consent-bootstrap.harness.tsx")}"></script></html>`,
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
