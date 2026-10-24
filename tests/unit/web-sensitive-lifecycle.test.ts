/// <reference path="../../apps/workspaces/node_modules/vite/client.d.ts" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestFetch } from "../fixtures/fetch";
import { knowledgeDraft } from "../fixtures/knowledge";
import { consents, reference, session } from "../fixtures/sensitive";

vi.mock("../../apps/workspaces/src/checkout", async (original) => {
  const actual = await original<typeof import("../../apps/workspaces/src/checkout")>();
  return {
    browserCheckout: vi.fn((local: boolean) => {
      const owned = actual.browserCheckout(local);
      return { ...owned, dispose: vi.fn(owned.dispose) };
    }),
  };
});

// Deterministic hook driver for the component's OWN effect callbacks. Browser tests separately
// exercise real React DEV replay. No DOM emulator or production dependency is introduced.
const hooks = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  initial: true,
  effects: [] as (() => undefined | (() => void))[],
  writes: 0,
}));
vi.mock("../../apps/workspaces/node_modules/react", async (original) => {
  const actual = await original<Record<string, unknown>>();
  return {
    ...actual,
    useState(initial: unknown) {
      const index = hooks.cursor++;
      if (hooks.initial) hooks.slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        hooks.slots[index],
        (value: unknown) => {
          hooks.writes++;
          hooks.slots[index] = typeof value === "function" ? value(hooks.slots[index]) : value;
        },
      ];
    },
    useRef(initial: unknown) {
      const index = hooks.cursor++;
      if (hooks.initial) hooks.slots[index] = { current: initial };
      return hooks.slots[index];
    },
    useEffect(setup: () => undefined | (() => void)) {
      if (hooks.initial) hooks.effects.push(setup);
    },
    useCallback: (callback: unknown) => callback,
    useEffectEvent: (callback: unknown) => callback,
    useMemo(factory: () => unknown) {
      const index = hooks.cursor++;
      if (hooks.initial) hooks.slots[index] = factory();
      return hooks.slots[index];
    },
  };
});

import { browserCheckout } from "../../apps/workspaces/src/checkout";
import { KnowledgeEditor } from "../../apps/workspaces/src/KnowledgeEditor";
import { SensitiveFlows } from "../../apps/workspaces/src/SensitiveFlows";

function elements(tree: unknown): Record<string, unknown>[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (
    !tree ||
    typeof tree !== "object" ||
    !("props" in tree) ||
    !tree.props ||
    typeof tree.props !== "object"
  )
    return [];
  const props = tree.props as Record<string, unknown>;
  return [props, ...elements(props.children)];
}
function invoke(props: Record<string, unknown> | undefined, event: string, value?: unknown) {
  const action = props?.[event];
  if (typeof action !== "function") throw new Error(`Missing ${event}`);
  return action(value);
}
function driver(component: () => unknown) {
  const render = () => {
    hooks.cursor = 0;
    const tree = component();
    hooks.initial = false;
    return tree;
  };
  render();
  expect(browserCheckout).not.toHaveBeenCalled();
  let cleanups: (() => void)[] = [];
  const setup = () => {
    cleanups = hooks.effects
      .map((effect) => effect())
      .filter((value) => typeof value === "function");
  };
  const cleanup = () => {
    for (const dispose of cleanups) dispose();
  };
  setup();
  cleanup();
  setup(); // Same render closures, same state/refs, as in StrictMode effect replay.
  return { render, cleanup };
}
const button = (tree: unknown, name: string) =>
  elements(tree).find((props) => props.children === name);
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  vi.clearAllMocks();
  hooks.slots = [];
  hooks.cursor = 0;
  hooks.initial = true;
  hooks.effects = [];
  hooks.writes = 0;
  vi.stubGlobal("location", { hostname: "127.0.0.1" });
  vi.stubGlobal("document", new EventTarget());
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe("web sensitive effect lifetimes", () => {
  it("allocates fresh checkout only in setup and obtains real consent after setup-cleanup-setup", async () => {
    const transport = vi.fn<TestFetch>(async () => Response.json(consents));
    vi.stubGlobal("fetch", transport);
    const mounted = driver(() =>
      SensitiveFlows({ session, route: "customer", locale: "en", onRevoked: vi.fn() }),
    );
    {
      const created = vi.mocked(browserCheckout).mock.results;
      expect(created).toHaveLength(2);
      expect(created[0]?.value).not.toBe(created[1]?.value);
      expect(created[0]?.value.dispose).toHaveBeenCalledTimes(1);
      expect(created[1]?.value.dispose).not.toHaveBeenCalled();
    }
    expect(transport).not.toHaveBeenCalled();
    invoke(button(mounted.render(), "Load current consent versions"), "onClick");
    await flush();
    expect(transport).toHaveBeenCalledTimes(1);
    expect(String(transport.mock.calls[0]?.[0])).toContain("/v1/consents/current");
    expect(
      elements(mounted.render()).find((props) => props["data-sensitive-state"])?.[
        "data-sensitive-state"
      ],
    ).toBe("current");
    mounted.cleanup();
  });

  it.each(["consent", "draft"] as const)(
    "%s unmount synchronously aborts HTTP and fences a transport ignoring abort",
    async (surface) => {
      let finish: ((response: Response) => void) | undefined;
      let signal: AbortSignal | null | undefined;
      const transport = vi.fn<TestFetch>(async (_input, init) => {
        signal = init?.signal;
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      });
      vi.stubGlobal("fetch", transport);
      const revoked = vi.fn();
      const mounted = driver(() =>
        surface === "consent"
          ? SensitiveFlows({ session, route: "customer", locale: "en", onRevoked: revoked })
          : KnowledgeEditor({
              session: { ...session, workspaces: ["staff"] },
              locale: "en",
              onRevoked: revoked,
            }),
      );
      if (surface === "draft") {
        const input = elements(mounted.render()).find((props) => props.maxLength === 36);
        invoke(input, "onChange", { target: { value: reference } });
      }
      const stale = button(
        mounted.render(),
        surface === "consent" ? "Load current consent versions" : "Load current draft",
      );
      invoke(stale, "onClick");
      // Same-turn duplicate activation cannot start a second request.
      invoke(stale, "onClick");
      expect(transport).toHaveBeenCalledTimes(1);
      expect(signal?.aborted).toBe(false);
      mounted.cleanup();
      expect(signal?.aborted).toBe(true);
      const writes = hooks.writes;
      finish?.(Response.json(surface === "consent" ? consents : knowledgeDraft));
      await flush();
      expect(hooks.writes).toBe(writes);
      expect(revoked).not.toHaveBeenCalled();
      invoke(stale, "onClick");
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );

  it("background disposal is immediate, clears private state and never revives the disposed client", async () => {
    const transport = vi.fn<TestFetch>(async () => Response.json(consents));
    vi.stubGlobal("fetch", transport);
    const mounted = driver(() =>
      SensitiveFlows({ session, route: "customer", locale: "en", onRevoked: vi.fn() }),
    );
    invoke(button(mounted.render(), "Load current consent versions"), "onClick");
    await flush();
    expect(elements(mounted.render()).some((props) => props.type === "checkbox")).toBe(true);
    window.dispatchEvent(new Event("pagehide"));
    expect(elements(mounted.render()).some((props) => props.type === "checkbox")).toBe(false);
    invoke(button(mounted.render(), "Load current consent versions"), "onClick");
    expect(transport).toHaveBeenCalledTimes(1);
    mounted.cleanup();
  });
});
