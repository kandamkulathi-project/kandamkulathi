import { describe, expect, it } from "vitest";
import { companionIntent } from "../../packages/client/src/knowledge";

describe("Companion intent lifetime", () => {
  for (const status of ["unknown", "unavailable", "error", "busy"] as const)
    it(`preserves the exact identity after ${status}`, () => {
      let sequence = 0;
      const intent = companionIntent(() => String(++sequence));
      const id = intent.reserve("en:synthetic message");
      intent.finish(id, status);
      expect(intent.reserve("en:synthetic message")).toBe(id);
      expect(sequence).toBe(1);
    });
  for (const status of ["ready", "anonymous", "denied", "conflict", "expired"] as const)
    it(`allocates a new identity after definitive ${status}`, () => {
      let sequence = 0;
      const intent = companionIntent(() => String(++sequence));
      const id = intent.reserve("en:handoff");
      intent.finish(id, status);
      expect(intent.reserve("en:handoff")).not.toBe(id);
    });
  it("fences old completions, changed payload/locale, and lifecycle clearing", () => {
    let sequence = 0;
    const intent = companionIntent(() => String(++sequence));
    const old = intent.reserve("en:message");
    const current = intent.reserve("ml:message");
    intent.finish(old, "ready");
    expect(intent.reserve("ml:message")).toBe(current);
    intent.clear();
    expect(intent.reserve("ml:message")).not.toBe(current);
  });
});
