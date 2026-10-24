import { describe, expect, it } from "vitest";
import { errorSchema } from "../../packages/contracts/src/index";

const envelope = (code: string) => ({
  error: {
    code,
    message: "Synthetic rejection.",
    requestId: "10000000-0000-4000-8000-000000000001",
  },
});
describe("shared HTTP error contract", () => {
  it.each(["INVALID_INPUT", "CONFLICT", "UNAUTHENTICATED", "IDENTITY_UNAVAILABLE"])(
    "accepts the actual identity boundary's %s code",
    (code) => expect(errorSchema.parse(envelope(code)).error.code).toBe(code),
  );
  it("does not replace the closed error vocabulary with arbitrary server text", () => {
    expect(errorSchema.safeParse(envelope("synthetic-unrecognized-error")).success).toBe(false);
    expect(errorSchema.safeParse({ error: { code: "INVALID_INPUT" } }).success).toBe(false);
  });
});
