import { describe, expect, it, vi } from "vitest";
import {
  type KnowledgeAuthoringRoutes,
  registerKnowledgeAuthoringRoutes,
} from "../../apps/companion/src/knowledge/authoring";
import { createService } from "../../packages/server/src/index";
import { knowledgeId } from "../unit/knowledge.fixtures";

const identity = {
  actorId: knowledgeId(2),
  sessionId: knowledgeId(50),
  organizationId: knowledgeId(51),
  authenticatedAt: new Date(Date.now() - 1000).toISOString(),
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  mfa: null,
};
const read = () =>
  vi.fn(async () => ({
    httpStatus: 403 as const,
    body: { status: "blocked" as const, reason: "FORBIDDEN" as const },
  }));
const app = (configured?: KnowledgeAuthoringRoutes) =>
  createService("companion", undefined, {
    registerRoutes: (app) => registerKnowledgeAuthoringRoutes(app, configured),
  });
const path = `http://localhost/v1/knowledge/${knowledgeId(10)}/authoring`;
describe("new authenticated authoring GET HTTP registration", () => {
  it("registers a real default unavailable handler with private no-store", async () => {
    const response = await app().request(path, {}, { APP_ENV: "local" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "not-ready", reason: "NOT_CONFIGURED" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cache-control")).toContain("private");
  });
  it("authenticates before metadata read; spoofed headers cannot create a source capability", async () => {
    const readAuthoring = read();
    const service = app({
      runtime: { readAuthoring },
      verifySession: async () => ({ status: "unauthenticated" }),
    });
    const response = await service.request(
      path,
      { headers: { "X-Role": "physician", cookie: "fabricated=1" } },
      { APP_ENV: "local" },
    );
    expect(response.status).toBe(401);
    expect(readAuthoring).not.toHaveBeenCalled();
    expect(await response.json()).not.toHaveProperty("record");
  });
  it.each([
    "?permission=edit&permission=approve",
    "?permission=approve&role=physician",
    "?actorId=x",
  ])("rejects ambiguous/caller-grant queries %s", async (query) => {
    const readAuthoring = read();
    const service = app({
      runtime: { readAuthoring },
      verifySession: async () => ({ status: "verified", identity }),
    });
    expect((await service.request(`${path}${query}`, {}, { APP_ENV: "local" })).status).toBe(400);
    expect(readAuthoring).not.toHaveBeenCalled();
  });
  it("passes only verified identity, canonical-route ID and requested permission to current runtime", async () => {
    const readAuthoring = read();
    const service = app({
      runtime: { readAuthoring },
      verifySession: async () => ({ status: "verified", identity }),
    });
    const response = await service.request(`${path}?permission=edit`, {}, { APP_ENV: "local" });
    expect(response.status).toBe(403);
    expect(readAuthoring).toHaveBeenCalledWith(identity, knowledgeId(10), { permission: "edit" });
  });
});
