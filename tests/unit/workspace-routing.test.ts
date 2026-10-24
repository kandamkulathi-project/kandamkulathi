import { describe, expect, it } from "vitest";
import { workspaceRoute } from "../../apps/workspaces/src/routing";

describe("integrated workspace routing", () => {
  it.each([
    ["/customer", "customer", "commerce"],
    ["/customer/shop", "customer", "commerce"],
    ["/customer/appointments", "customer", "booking"],
    ["/staff", "staff", "reads"],
    ["/staff/knowledge", "staff", "knowledge"],
  ])("keeps %s inside its required workspace boundary", (path, workspace, section) => {
    expect(workspaceRoute(path)).toEqual({ kind: workspace, workspace, section });
  });

  it.each(["physician", "support"])("preserves the %s workspace", (workspace) => {
    expect(workspaceRoute(`/${workspace}`)).toEqual({ kind: "workspace", workspace });
  });
  it("keeps independent physician authoring under the physician grant, not a fabricated staff grant", () => {
    expect(workspaceRoute("/physician/knowledge")).toEqual({
      kind: "knowledge",
      workspace: "physician",
    });
  });

  it.each([
    "/customer-untrusted",
    "/customer/appointments/extra",
    "/staff/knowledge/extra",
    "/staff/../customer",
    "/%73taff/knowledge",
    "//staff",
    "/staff/",
    "/staff?scope=customer",
    "/Staff",
    "https://example.com/customer",
    "__proto__",
    "constructor",
    "",
  ])("does not turn unknown route %s into a home or private surface", (path) => {
    expect(workspaceRoute(path)).toEqual({ kind: "not-found" });
  });

  it("returns isolated route records rather than mutable shared state", () => {
    const route = workspaceRoute("/customer");
    if (route.kind !== "customer") throw new Error("Missing route");
    route.section = "booking";
    expect(workspaceRoute("/customer")).toMatchObject({ section: "commerce" });
    expect(workspaceRoute("/")).toEqual({ kind: "home" });
  });
});
