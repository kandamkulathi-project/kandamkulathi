import { afterEach, describe, expect, it, vi } from "vitest";
import { recordingProbe } from "../../packages/client/src/capture";
import {
  apiOrigin,
  credentialVault,
  loadSession,
  notificationTarget,
  parseNotificationLink,
  returnGuard,
  workspaceAccess,
} from "../../packages/client/src/index";
import { mediaProbe } from "../../packages/client/src/media";
import { citedReplySchema, sessionSchema } from "../../packages/contracts/src/client";
import { formatDate, formatMoney, foundation, locales } from "../../packages/i18n/src/index";

const id = "dbdfb43b-cde1-4102-95ce-ab0654d1b6cc";
const session = { userId: id, expiresAt: "2099-01-01T00:00:00Z", workspaces: ["customer"] };
afterEach(() => vi.useRealTimers());
describe("session and navigation boundary", () => {
  it.each([
    [401, "anonymous"],
    [403, "denied"],
    [503, "unavailable"],
    [500, "error"],
  ] as const)("handles HTTP %i truthfully", async (code, status) => {
    const transport = vi.fn().mockResolvedValue(new Response("", { status: code }));
    expect(
      await loadSession("http://127.0.0.1:8787", true, new AbortController().signal, transport),
    ).toEqual({ status });
    expect(transport.mock.calls[0]?.[1]).toMatchObject({
      cache: "no-store",
      credentials: "include",
      redirect: "error",
    });
  });
  it("accepts strict current session metadata, never broadens workspace grants", async () => {
    const result = await loadSession(
      "https://api.example.com",
      false,
      new AbortController().signal,
      async () => Response.json(session),
    );
    expect(result.status).toBe("ready");
    const value = sessionSchema.parse(session);
    expect(workspaceAccess(value, "customer")).toBe(true);
    expect(workspaceAccess(value, "physician")).toBe(false);
    expect(workspaceAccess(value, "customer", Date.parse(value.expiresAt))).toBe(false);
  });
  it.each([
    { ...session, workspaces: ["superuser"] },
    { ...session, accessToken: "unapproved" },
    { ...session, userId: "bad" },
  ])("rejects invalid or overbroad session payloads", async (value) => {
    expect(
      (
        await loadSession(
          "https://api.example.com",
          false,
          new AbortController().signal,
          async () => Response.json(value),
        )
      ).status,
    ).toBe("error");
  });
  it("expires sessions, rejects HTML fallbacks and handles network errors", async () => {
    const signal = new AbortController().signal;
    expect(
      (
        await loadSession("https://api.example.com", false, signal, async () =>
          Response.json({ ...session, expiresAt: "2000-01-01T00:00:00Z" }),
        )
      ).status,
    ).toBe("anonymous");
    expect(
      (
        await loadSession(
          "https://api.example.com",
          false,
          signal,
          async () => new Response("<html/>"),
        )
      ).status,
    ).toBe("error");
    expect(
      await loadSession("https://api.example.com", false, signal, async () => {
        throw new Error("private upstream text");
      }),
    ).toEqual({ status: "error" });
  });
  it.each([
    "http://remote.example.com",
    "https://name:password@example.com",
    "https://api.example.com/path",
    "https://api.example.com?token=a",
    "javascript:alert(1)",
  ])("refuses unsafe origins: %s", (value) => expect(() => apiOrigin(value, false)).toThrow());
});

describe("callback and notification contracts", () => {
  const state = "a".repeat(64);
  const attempt = {
    redirectUri: "kandamkulathi-dev://auth/return",
    state,
    expiresAt: 10000,
    purpose: "auth" as const,
  };
  it("returns an auth code for server verification once only", () => {
    const accept = returnGuard(attempt);
    const url = `${attempt.redirectUri}?code=code123&state=${state}`;
    expect(accept(url, 1000)).toEqual({
      status: "server-verification-required",
      purpose: "auth",
      reference: "code123",
    });
    expect(accept(url, 1001).status).toBe("rejected");
  });
  it.each([
    `kandamkulathi-production://auth/return?code=x&state=${state}`,
    `kandamkulathi-dev://auth/other?code=x&state=${state}`,
    `${attempt.redirectUri}?code=x&state=${"b".repeat(64)}`,
    `${attempt.redirectUri}?code=x&state=${state}&state=${state}`,
    `${attempt.redirectUri}?code=x&state=${state}#access_token=bad`,
    `${attempt.redirectUri}?code=x&state=${state}&next=https://evil.example`,
  ])("rejects a forged, mixed-environment or ambiguous callback", (url) =>
    expect(returnGuard(attempt)(url, 1000).status).toBe("rejected"),
  );
  it("rejects expiry and never treats a payment return as paid", () => {
    expect(returnGuard(attempt)(`${attempt.redirectUri}?code=x&state=${state}`, 10000).status).toBe(
      "rejected",
    );
    const accept = returnGuard({ ...attempt, purpose: "payment" });
    expect(accept(`${attempt.redirectUri}?operation_id=${id}&state=${state}`, 1000).status).toBe(
      "server-verification-required",
    );
  });
  it("requires a session and record authorization after notification navigation", () => {
    const payload = { version: 1, kind: "order", reference: id };
    expect(notificationTarget(payload, false).status).toBe("session-required");
    expect(notificationTarget(payload, true).status).toBe("authorization-required");
    expect(notificationTarget({ ...payload, redirect: "https://evil.example" }, true).status).toBe(
      "rejected",
    );
    expect(
      parseNotificationLink(
        `kandamkulathi-dev://open?kind=order&reference=${id}`,
        "kandamkulathi-dev",
        false,
      ).status,
    ).toBe("session-required");
    expect(
      parseNotificationLink(
        `kandamkulathi-production://open?kind=order&reference=${id}`,
        "kandamkulathi-dev",
        true,
      ).status,
    ).toBe("rejected");
  });
  it("requires citations with approved-entry references; markup remains text", () => {
    expect(citedReplySchema.safeParse({ text: "uncited", citations: [] }).success).toBe(false);
    expect(
      citedReplySchema.parse({
        text: "<script>synthetic</script>",
        citations: [{ entryId: id, revision: 1, title: "Synthetic source" }],
      }).text,
    ).toContain("<script>");
  });
});

describe("secure storage ordering", () => {
  it("separates environments and diagnostics, serializes clear and refuses oversized credentials", async () => {
    const values = new Map<string, string>();
    const storage = {
      get: async (key: string) => values.get(key) ?? null,
      set: async (key: string, value: string) => {
        values.set(key, value);
      },
      remove: async (key: string) => {
        values.delete(key);
      },
    };
    const auth = credentialVault(storage, "dev");
    const diagnostic = credentialVault(storage, "dev", "diagnostic");
    await auth.write("real-synthetic-credential");
    await diagnostic.write("marker");
    await diagnostic.clear();
    expect(await auth.read()).toBe("real-synthetic-credential");
    expect(await credentialVault(storage, "staging").read()).toBeNull();
    const late = auth.write("stale");
    const cleared = auth.clear();
    await expect(late).rejects.toThrow("Stale");
    await cleared;
    expect(await auth.read()).toBeNull();
    await expect(auth.write("x".repeat(2049))).rejects.toThrow("size");
  });
  it("propagates native storage failures without a plaintext fallback", async () => {
    const vault = credentialVault(
      {
        get: async () => {
          throw new Error("locked");
        },
        set: async () => {
          throw new Error("locked");
        },
        remove: async () => {},
      },
      "local",
    );
    await expect(vault.write("token")).rejects.toThrow("locked");
    await expect(vault.read()).rejects.toThrow("locked");
    await expect(vault.clear()).resolves.toBeUndefined();
  });
});

describe("device lifecycle", () => {
  it("native cancellation before permission grant never starts recording", async () => {
    let grant: (value: boolean) => void = () => {};
    const record = vi.fn();
    const prepare = vi.fn();
    const changed = vi.fn();
    const probe = recordingProbe(
      {
        permission: () =>
          new Promise((resolve) => {
            grant = resolve;
          }),
        prepare,
        record,
        stop: vi.fn(),
        discard: vi.fn(),
      },
      changed,
    );
    const start = probe.start();
    const stop = probe.stop();
    grant(true);
    await start;
    await stop;
    expect(prepare).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    await probe.dispose();
  });
  it("native recording is bounded and discards bytes after stopping", async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const probe = recordingProbe(
      {
        permission: async () => true,
        prepare: async () => {},
        record: () => {
          order.push("record");
        },
        stop: async () => {
          order.push("stop");
        },
        discard: async () => {
          order.push("discard");
        },
      },
      vi.fn(),
    );
    await probe.start();
    await vi.advanceTimersByTimeAsync(15000);
    expect(order).toEqual(["record", "stop", "discard"]);
    await probe.dispose();
  });
  it("native cleanup blocks another capture until stop and discard finish", async () => {
    let finish: () => void = () => {};
    const record = vi.fn();
    const probe = recordingProbe(
      {
        permission: async () => true,
        prepare: async () => {},
        record,
        stop: () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
        discard: vi.fn(),
      },
      vi.fn(),
    );
    await probe.start();
    const stop = probe.stop();
    await Promise.resolve();
    const next = probe.start();
    expect(record).toHaveBeenCalledTimes(1);
    finish();
    await stop;
    await next;
    await probe.dispose();
  });
  it("releases capture on stop, switches and the 30-second bound", async () => {
    vi.useFakeTimers();
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const acquire = vi.fn().mockResolvedValue(stream);
    const changed = vi.fn();
    const probe = mediaProbe(acquire, changed);
    await probe.start("camera");
    await probe.start("microphone");
    expect(stop).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(changed).toHaveBeenLastCalledWith("idle");
    probe.dispose();
  });
  it("stops a late permission grant after disposal and reports denial without raw errors", async () => {
    let grant: (value: MediaStream) => void = () => {};
    const stop = vi.fn();
    const changed = vi.fn();
    const probe = mediaProbe(
      () =>
        new Promise((resolve) => {
          grant = resolve;
        }),
      changed,
    );
    const pending = probe.start("camera");
    probe.dispose();
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await pending;
    expect(stop).toHaveBeenCalledOnce();
    expect(changed).not.toHaveBeenCalledWith("active", expect.anything());
    const denied = mediaProbe(async () => {
      throw new Error("private device identifier");
    }, changed);
    await denied.start("microphone");
    expect(changed).toHaveBeenLastCalledWith("denied");
    denied.dispose();
  });
});

it("all foundation labels exist across EN/ML/TA and format integer paise/India dates", () => {
  for (const locale of locales) {
    expect(Object.keys(foundation[locale])).toEqual(Object.keys(foundation.en));
    expect(Object.values(foundation[locale]).every((value) => value.trim().length > 0)).toBe(true);
    expect(formatMoney(12550, locale)).toContain("125.50");
    expect(formatDate(new Date("2026-10-19T20:00:00Z"), locale)).toContain("20");
  }
  expect(() => formatMoney(1.5, "en")).toThrow();
});
