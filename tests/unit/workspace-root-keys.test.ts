import { afterEach, describe, expect, it, vi } from "vitest";

type ElementNode = { key: string | null; props: { children?: unknown } };

vi.mock("../../apps/workspaces/node_modules/react", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useState: (value: unknown) => [typeof value === "function" ? value() : value, vi.fn()],
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useEffect: vi.fn(),
}));
vi.mock("../../packages/ui/src/session", () => ({
  useSession: () => ({
    result: {
      status: "ready",
      data: {
        userId: "10000000-0000-4000-8000-000000000001",
        expiresAt: "2099-01-01T00:00:00Z",
        workspaces: ["customer", "staff", "physician", "support"],
      },
    },
    reload: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

function keyedSiblings(tree: unknown): string[][] {
  if (Array.isArray(tree)) {
    const keys = tree
      .filter((child): child is ElementNode =>
        Boolean(child && typeof child === "object" && "key" in child),
      )
      .flatMap((child) => (child.key === null ? [] : [String(child.key)]));
    return [keys, ...tree.flatMap(keyedSiblings)];
  }
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  return keyedSiblings((tree as ElementNode).props.children);
}

afterEach(() => vi.unstubAllGlobals());
describe("composed workspace root reconciliation identity", () => {
  it.each([
    "/",
    "/customer/shop",
    "/staff",
    "/staff/knowledge",
    "/physician",
    "/physician/knowledge",
  ])(
    "%s gives independent sibling surfaces distinct keys in the same verified epoch",
    async (pathname) => {
      vi.stubGlobal("location", { hostname: "127.0.0.1", pathname });
      const { default: App } = await import("../../apps/workspaces/src/WorkspaceApp");
      const groups = keyedSiblings(App());
      expect(groups.some((group) => group.length > 0)).toBe(true);
      for (const keys of groups) expect(new Set(keys).size).toBe(keys.length);
    },
  );
});
