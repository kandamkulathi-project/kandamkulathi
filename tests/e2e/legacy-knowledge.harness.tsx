import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { KnowledgeEditor } from "../../apps/workspaces/src/KnowledgeEditor";
import { SensitiveFlows } from "../../apps/workspaces/src/SensitiveFlows";
import { workspaceAccess } from "../../packages/client/src/index";
import { foundation } from "../../packages/i18n/src/index";
import { Button, Notice, useSession } from "../../packages/ui/src/index";
import "../../apps/workspaces/src/styles.css";

// Proposed client-knowledge contracts are intentionally not the canonical authoring API.
// Only test routing lives here; lifecycle, authorization presentation, editor and logout
// use the unchanged production hook/components. No session or business success is seeded.
function Harness() {
  const { result, reload, invalidate } = useSession("http://127.0.0.1:8787", true);
  const workspace = location.pathname.endsWith("/physician") ? "physician" : "staff";
  const status =
    result.status === "ready" && !workspaceAccess(result.data, workspace)
      ? "denied"
      : result.status;
  const text = foundation.en;
  return (
    <main>
      <h1>Legacy proposed knowledge client test harness</h1>
      <div data-session-state={status}>
        <Notice error={status === "denied" || status === "error"}>{text[status]}</Notice>
        <Button onClick={reload} disabled={status === "loading"}>
          {text.retry}
        </Button>
      </div>
      {status === "ready" && result.status === "ready" && (
        <KnowledgeEditor session={result.data} locale="en" onRevoked={invalidate} />
      )}
      {(status === "ready" || status === "anonymous") && (
        <SensitiveFlows
          session={result.status === "ready" ? result.data : null}
          route={workspace}
          locale="en"
          onRevoked={invalidate}
        />
      )}
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing legacy knowledge test root");
createRoot(root).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
