import { createRoot } from "react-dom/client";
import App from "../../apps/workspaces/src/WorkspaceApp";
import "../../apps/workspaces/src/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing test root");
createRoot(root).render(<App />);
