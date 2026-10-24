import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../../apps/workspaces/src/WorkspaceApp";
import "../../apps/workspaces/src/styles.css";
import "../../packages/i18n/fonts/fonts.css";

// Test-only entry mounts the actual shipped root in development StrictMode.
history.replaceState(null, "", "/");
const root = document.getElementById("root");
if (!root) throw new Error("Test application root is missing");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
