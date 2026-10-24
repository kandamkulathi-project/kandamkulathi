import { describe, expect, it, vi } from "vitest";
import companion from "../../apps/companion/src/index";
import { registerKnowledgeRuntimeRoutes } from "../../apps/companion/src/knowledge/runtime";
import { knowledgeRuntimeFromBindings } from "../../apps/companion/src/runtime";
import core from "../../apps/core-api/src/index";
import { createService } from "../../packages/server/src/index";

const bindings = {
  APP_ENV: "local",
  DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:5432/synthetic",
};

describe("default registered knowledge runtime boundaries", () => {
  it("registers exact/vector search without claiming an unconfigured primary is an empty corpus", async () => {
    const response = await core.fetch(
      new Request("http://localhost/v1/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: "synthetic public product", language: "en" }),
      }),
      { APP_ENV: "local" },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "not-ready", reason: "NOT_CONFIGURED" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("registers authoring reads independently without fabricating a scoped view grant", async () => {
    const response = await companion.fetch(
      new Request(
        "http://localhost/v1/knowledge/10000000-0000-4000-8000-000000000001/authoring?permission=edit",
      ),
      { APP_ENV: "local" },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "not-ready", reason: "NOT_CONFIGURED" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns unavailable rather than denied when configured identity is unavailable", async () => {
    const response = await companion.fetch(
      new Request("http://localhost/v1/knowledge/drafts", { method: "POST" }),
      bindings,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "not-ready", reason: "AUTHORITY_UNAVAILABLE" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each(["unavailable", "denied"] as const)(
    "preserves %s mutation admission before parsing or persistence",
    async (decision) => {
      const configured = knowledgeRuntimeFromBindings(bindings);
      if (!configured) throw new Error("Missing synthetic runtime");
      const draft = vi.spyOn(configured.runtime, "draft");
      const verifySession = vi.spyOn(configured, "verifySession");
      const app = createService("companion", undefined, {
        registerRoutes: (app) =>
          registerKnowledgeRuntimeRoutes(app, {
            ...configured,
            verifyMutation: async () => decision,
          }),
      });
      const response = await app.request(
        "/v1/knowledge/drafts",
        { method: "POST", body: "malformed" },
        { APP_ENV: "local" },
      );
      expect(response.status).toBe(decision === "unavailable" ? 503 : 403);
      expect(await response.json()).toEqual(
        decision === "unavailable"
          ? { status: "not-ready", reason: "AUTHORITY_UNAVAILABLE" }
          : { status: "blocked", reason: "FORBIDDEN" },
      );
      expect(verifySession).not.toHaveBeenCalled();
      expect(draft).not.toHaveBeenCalled();
    },
  );
});
