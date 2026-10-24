import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { KnowledgeEditor } from "../../apps/workspaces/src/KnowledgeEditor";
import { SensitiveFlows } from "../../apps/workspaces/src/SensitiveFlows";
import { session } from "../fixtures/sensitive";

const staff = { ...session, workspaces: ["staff"] as typeof session.workspaces };
const revoke = () => {};
function Harness() {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setMounted(!mounted)}>
        Toggle private components
      </button>
      {mounted && (
        <>
          <SensitiveFlows session={session} route="customer" locale="en" onRevoked={revoke} />
          <KnowledgeEditor session={staff} locale="en" onRevoked={revoke} />
        </>
      )}
    </>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing lifecycle test root");
createRoot(root).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
