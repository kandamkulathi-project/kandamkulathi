import type { Workspace } from "@kandamkulathi/contracts/client";

export type WorkspaceRoute =
  | { kind: "home" }
  | { kind: "not-found" }
  | { kind: "customer"; workspace: "customer"; section: "commerce" | "booking" }
  | { kind: "staff"; workspace: "staff"; section: "reads" | "knowledge" }
  | { kind: "knowledge"; workspace: "physician" }
  | { kind: "workspace"; workspace: Exclude<Workspace, "customer" | "staff"> };

const routes = new Map<string, WorkspaceRoute>([
  ["/", { kind: "home" }],
  ["/customer", { kind: "customer", workspace: "customer", section: "commerce" }],
  ["/customer/shop", { kind: "customer", workspace: "customer", section: "commerce" }],
  ["/customer/appointments", { kind: "customer", workspace: "customer", section: "booking" }],
  ["/staff", { kind: "staff", workspace: "staff", section: "reads" }],
  ["/staff/knowledge", { kind: "staff", workspace: "staff", section: "knowledge" }],
  ["/physician", { kind: "workspace", workspace: "physician" }],
  ["/physician/knowledge", { kind: "knowledge", workspace: "physician" }],
  ["/support", { kind: "workspace", workspace: "support" }],
]);

/** Exact presentation routes only; API identity, scope and ownership remain authoritative. */
export function workspaceRoute(pathname: string): WorkspaceRoute {
  return { ...(routes.get(pathname) ?? { kind: "not-found" }) };
}
