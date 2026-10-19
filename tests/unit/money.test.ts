import { describe, expect, it } from "vitest";
import { lineSubtotalPaise } from "../../packages/domain/src/index";

describe("integer paise boundary", () => {
  it("computes exact integer subtotals", () => {
    expect(lineSubtotalPaise(19999, 3)).toBe(59997);
  });
  it.each([
    [1.1, 1],
    [-1, 1],
    [100, 0],
    [100, 1.5],
    [Number.MAX_SAFE_INTEGER, 2],
    [Number.NaN, 1],
  ])("rejects unsafe price/quantity %s %s", (price, quantity) => {
    expect(() => lineSubtotalPaise(price, quantity)).toThrow();
  });
});
