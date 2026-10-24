import type { ClientSession } from "@kandamkulathi/contracts/client";
import { knowledgeContentSchema, knowledgeRecordSchema } from "@kandamkulathi/contracts/knowledge";
import {
  type KnowledgeAuthoringTransport,
  knowledgeAuthoringPermissionSchema,
} from "@kandamkulathi/contracts/knowledge-authoring";
import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../styles.css";
import { ContentEditor } from "../ContentEditor";
import { createContentHttpIntegration } from "../http-source";
import { approverId, editorId, syntheticRecord } from "./records";

function Fixture() {
  const [mode, setMode] = useState("ready");
  const [actor, setActor] = useState("editor");
  const [calls, setCalls] = useState(0);
  const [submitted, setSubmitted] = useState("");
  const session = useMemo<ClientSession>(
    () => ({
      userId: actor === "editor" ? editorId.toUpperCase() : approverId,
      expiresAt: "2099-10-20T10:00:00Z",
      workspaces: [actor === "editor" ? "staff" : "physician"],
    }),
    [actor],
  );
  const integration = useMemo(() => {
    let current = knowledgeRecordSchema.parse(
      syntheticRecord(mode === "withdraw-ready" ? "approved" : "draft"),
    );
    const registeredSource = current.content.sources[0];
    if (!registeredSource) throw new Error("Synthetic source missing");
    registeredSource.sha256 = "2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881";
    // Synthetic canonical HTTP responses only. No production grants/clinical authority/HTTP calls.
    const transport: KnowledgeAuthoringTransport = async (request) => {
      if (request.method === "GET") {
        const permission = knowledgeAuthoringPermissionSchema.parse(
          new URL(request.path, "https://synthetic.example.com").searchParams.get("permission") ??
            "view",
        );
        const allowed =
          permission === "view" ||
          (permission === "edit" ? actor === "editor" : actor === "physician");
        if (!allowed || (mode === "no-grant" && permission !== "view"))
          return { httpStatus: 403, body: { status: "blocked", reason: "FORBIDDEN" } };
        return {
          httpStatus: 200,
          body: {
            status: "ready",
            schemaVersion: 1,
            record: current,
            capability: {
              actor: {
                actorId:
                  permission !== "view" && mode === "wrong-actor" ? approverId : session.userId,
                displayName: "Synthetic authority",
                authorityVersion: 1,
                evidenceId: "abcdefab-5555-4555-8555-555555555555",
              },
              organizationId: "abcdefab-8888-4888-8888-888888888888",
              permission,
              scope: current.content.scope,
              productId: current.content.productId,
              language:
                permission !== "view" && mode === "wrong-scope" ? "ml" : current.content.language,
              kind: current.content.kind,
              entryId: current.content.entryId,
              revision: current.content.revision,
              contentHash: current.contentHash,
              expiresAt:
                permission !== "view" && mode === "stale"
                  ? "2000-10-20T10:00:00Z"
                  : "2099-10-20T10:00:00Z",
            },
          },
        };
      }
      setCalls((value) => value + 1);
      setSubmitted(JSON.stringify({ path: request.path, body: request.body }));
      if (mode === "slow") await new Promise((resolve) => setTimeout(resolve, 600));
      if (mode === "error") throw new Error("Private mutation detail must not render");
      if (mode === "mutation-denied")
        return { httpStatus: 403, body: { status: "blocked", reason: "FORBIDDEN" } };
      if (mode === "conflict") return { httpStatus: 409, body: null };
      if (mode === "unavailable") return { httpStatus: 503, body: null };
      if (mode === "invalid")
        return { httpStatus: 200, body: { status: "candidate", record: current } };
      const body = request.body;
      if (!body || typeof body !== "object") return { httpStatus: 400, body: null };
      if (request.path === "/v1/knowledge/drafts" && "content" in body && "sources" in body) {
        const content = knowledgeContentSchema.parse(body.content);
        if (
          content.revision !== current.content.revision + 1 ||
          content.previousContentHash !== current.contentHash ||
          JSON.stringify(body.sources) !==
            JSON.stringify([{ sourceId: registeredSource.sourceId, bytesBase64: "eA==" }])
        )
          return { httpStatus: 409, body: null };
        current = knowledgeRecordSchema.parse({
          state: "draft",
          content,
          contentHash: "c".repeat(64),
        });
      } else if (
        !("revision" in body) ||
        !("contentHash" in body) ||
        body.revision !== current.content.revision ||
        body.contentHash !== current.contentHash
      )
        return { httpStatus: 409, body: null };
      else if (request.path.endsWith("/approve"))
        current = knowledgeRecordSchema.parse({
          ...current,
          state: "approved",
          approval: {
            approverId,
            approverDisplayName: "Synthetic reviewer — not physician approval",
            authorityVersion: 1,
            evidenceId: "abcdefab-5555-4555-8555-555555555555",
            approvedAt: "2026-10-20T10:00:00Z",
            contentHash: current.contentHash,
          },
        });
      else
        current = knowledgeRecordSchema.parse({
          ...current,
          state: "withdrawn",
          withdrawal: {
            actorId: approverId,
            withdrawnAt: "2026-10-20T11:00:00Z",
            evidenceId: "abcdefab-6666-4666-8666-666666666666",
          },
        });
      return { httpStatus: 200, body: { status: "persisted", record: current } };
    };
    const configured = createContentHttpIntegration({
      session,
      entryId: current.content.entryId,
      coreOrigin: "https://synthetic.example.com",
      companionOrigin: "https://synthetic.example.com",
      local: false,
      transport,
    });
    if (configured.status !== "configured")
      throw new Error("Synthetic same-origin configuration failed");
    return { port: configured.authoring, readRecord: configured.readRecord };
  }, [mode, actor, session]);
  return (
    <main>
      <h1>Synthetic authoring protocol fixture — no real grant endpoint</h1>
      <label>
        Authoring fixture mode
        <select
          value={mode}
          onChange={(event) => {
            setMode(event.target.value);
            setCalls(0);
          }}
        >
          {[
            "ready",
            "withdraw-ready",
            "no-grant",
            "stale",
            "wrong-actor",
            "wrong-scope",
            "mutation-denied",
            "conflict",
            "unavailable",
            "error",
            "invalid",
            "slow",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Authoring fixture actor
        <select value={actor} onChange={(event) => setActor(event.target.value)}>
          <option>editor</option>
          <option>physician</option>
        </select>
      </label>
      <output aria-label="Mutation call count">{calls}</output>
      <output aria-label="Synthetic submitted request">{submitted}</output>
      <ContentEditor
        locale="en"
        session={{ status: "ready", data: session }}
        readRecord={integration.readRecord}
        authoring={integration.port}
      />
    </main>
  );
}
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <Fixture />
    </StrictMode>,
  );
