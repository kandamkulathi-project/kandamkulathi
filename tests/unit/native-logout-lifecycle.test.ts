import { afterEach, describe, expect, it, vi } from "vitest";
import { nativeSessionLifecycle } from "../../apps/mobile/src/sessionLifecycle";

afterEach(() => vi.useRealTimers());

describe("native logout fence above child remounts", () => {
  it("blocks passive resume even if a new child lifetime begins", () => {
    const lifecycle = nativeSessionLifecycle();
    const beforeLogout = lifecycle.begin();
    lifecycle.block();
    const refresh = vi.fn();
    for (let i = 0; i < 3; i++) {
      lifecycle.suspend();
      lifecycle.resume(refresh);
    }
    expect(refresh).not.toHaveBeenCalled();
    expect(beforeLogout()).toBe(false);
    expect(lifecycle.begin()()).toBe(false);
    expect(lifecycle.isBlocked()).toBe(true);
  });

  it("only explicit retry permits a new lifetime, never an old response", () => {
    const lifecycle = nativeSessionLifecycle();
    const old = lifecycle.begin();
    lifecycle.block();
    lifecycle.retry();
    const refresh = vi.fn();
    lifecycle.resume(refresh);
    expect(refresh).toHaveBeenCalledOnce();
    expect(lifecycle.isBlocked()).toBe(false);
    expect(old()).toBe(false);
    expect(lifecycle.begin()()).toBe(true);
  });

  it("suspends pending bootstrap without logging out an ordinary background session", () => {
    const lifecycle = nativeSessionLifecycle();
    const old = lifecycle.begin();
    lifecycle.suspend();
    expect(old()).toBe(false);
    expect(lifecycle.isBlocked()).toBe(false);
    const refresh = vi.fn();
    lifecycle.resume(refresh);
    expect(refresh).toHaveBeenCalledOnce();
    expect(lifecycle.begin()()).toBe(true);
  });

  it("fences an in-flight bootstrap that ignores cancellation after logout", async () => {
    const lifecycle = nativeSessionLifecycle();
    const isCurrent = lifecycle.begin();
    let finish: (value: string) => void = () => {};
    const response = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const privateView = vi.fn();
    const bootstrap = response.then((value) => {
      if (isCurrent()) privateView(value);
    });
    lifecycle.block();
    lifecycle.suspend();
    lifecycle.retry();
    expect(lifecycle.begin()()).toBe(true);
    finish("synthetic private summary");
    await bootstrap;
    expect(privateView).not.toHaveBeenCalled();
  });

  it("keeps expiry blocked through restoration and invalidates earlier callbacks", async () => {
    vi.useFakeTimers();
    const lifecycle = nativeSessionLifecycle();
    const isCurrent = lifecycle.begin();
    const restorePrivateView = vi.fn();
    setTimeout(() => lifecycle.block(), 1000);
    setTimeout(() => {
      if (isCurrent()) restorePrivateView();
    }, 2000);
    await vi.advanceTimersByTimeAsync(2001);
    const refresh = vi.fn();
    lifecycle.resume(refresh);
    expect(refresh).not.toHaveBeenCalled();
    expect(isCurrent()).toBe(false);
    expect(restorePrivateView).not.toHaveBeenCalled();
  });
});
