import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  commerceLocations,
  guardCommerceStaffReader,
  readCommerceClinics,
  StaffCommerceWorkspace,
  useCommerceClinics,
} from "../../apps/workspaces/src/CommerceDirectory";
import type { StaffReader } from "../../apps/workspaces/src/staff";

const clinic = {
  clinicId: "aaaaaaaa-0000-4000-8000-000000000101",
  locationId: "aaaaaaaa-0000-4000-8000-000000000102",
  name: "Synthetic approved clinic",
};
const options = { origin: "http://127.0.0.1:8787", local: true, staff: false };
type Transport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const signal = () => new AbortController().signal;
const read = (body: unknown, staff = false) =>
  readCommerceClinics(
    { ...options, staff, transport: vi.fn<Transport>().mockResolvedValue(Response.json(body)) },
    signal(),
  );

describe("root commerce directory", () => {
  it("decodes canonical public DTOs, retaining distinct clinic and location identities", async () => {
    const transport = vi.fn<Transport>().mockResolvedValue(Response.json({ items: [clinic] }));
    expect(await readCommerceClinics({ ...options, transport }, signal())).toEqual({
      status: "ready",
      items: [clinic],
    });
    expect(transport).toHaveBeenCalledWith(
      `${options.origin}/v1/commerce/clinics`,
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        credentials: "include",
        redirect: "error",
      }),
    );
    expect(commerceLocations([clinic])).toEqual([
      { reference: clinic.locationId, title: clinic.name },
    ]);
    expect(clinic.locationId).not.toBe(clinic.clinicId);
  });

  it("decodes staff actions only from the strict canonical staff route", async () => {
    const item = { ...clinic, actions: ["orders:read", "stock:read"] };
    const transport = vi.fn<Transport>().mockResolvedValue(Response.json({ items: [item] }));
    expect(await readCommerceClinics({ ...options, staff: true, transport }, signal())).toEqual({
      status: "ready",
      items: [item],
    });
    expect(transport).toHaveBeenCalledWith(
      `${options.origin}/v1/staff/commerce/clinics`,
      expect.anything(),
    );
    expect(await read({ items: [clinic] }, true)).toEqual({ status: "error" });
    expect(await read({ items: [{ ...clinic, actions: ["owner"] }] }, true)).toEqual({
      status: "error",
    });
    expect(await read({ items: [item] })).toEqual({ status: "error" });
  });

  it("preserves a genuinely empty directory, with no fabricated labels", async () => {
    expect(await read({ items: [] })).toEqual({ status: "empty" });
    expect(commerceLocations([])).toEqual([]);
  });

  it.each([
    { items: [{ ...clinic, clinicId: "bad" }] },
    { items: [{ ...clinic, locationId: "bad" }] },
    { items: [{ ...clinic, name: " " }] },
    { items: [{ ...clinic, name: "x".repeat(201) }] },
    { items: [{ ...clinic, privateNotes: "not public" }] },
    { items: [clinic], total: 1 },
    { clinics: [clinic] },
    { items: Array.from({ length: 101 }, () => clinic) },
    { items: [clinic, clinic] },
    { items: [clinic, { ...clinic, clinicId: clinic.clinicId.toUpperCase() }] },
    { items: [clinic, { ...clinic, clinicId: clinic.locationId, name: "Conflicting title" }] },
  ])("rejects malformed, oversized, duplicate or ambiguous canonical entries %#", async (body) => {
    expect(await read(body)).toEqual({ status: "error" });
  });

  it("deduplicates only identical approved location/name references", async () => {
    const items = [clinic, { ...clinic, clinicId: clinic.locationId }];
    expect(await read({ items })).toEqual({ status: "ready", items });
    expect(commerceLocations(items)).toEqual([
      { reference: clinic.locationId, title: clinic.name },
    ]);
    expect(() => commerceLocations([clinic, { ...clinic, name: "Other title" }])).toThrow();
  });

  it.each([
    [401, "anonymous"],
    [403, "denied"],
    [503, "unavailable"],
    [500, "error"],
    [404, "error"],
    [202, "error"],
  ] as const)("preserves HTTP %s as %s", async (code, status) => {
    const transport = vi
      .fn<Transport>()
      .mockResolvedValue(new Response("untrusted", { status: code }));
    expect(await readCommerceClinics({ ...options, transport }, signal())).toEqual({ status });
  });

  it.each([
    new Response("not-json", { headers: { "content-type": "application/json" } }),
    new Response("{}", { headers: { "content-type": "text/html" } }),
    new Response("{}", {
      headers: { "content-type": "application/json", "content-length": "131073" },
    }),
    new Response("{}", {
      headers: { "content-type": "application/json", "content-length": "invalid" },
    }),
    new Response(" ".repeat(131073), { headers: { "content-type": "application/json" } }),
  ])(
    "rejects invalid JSON, content types and declared/actual oversized responses %#",
    async (response) => {
      const transport = vi.fn<Transport>().mockResolvedValue(response);
      expect(await readCommerceClinics({ ...options, transport }, signal())).toEqual({
        status: "error",
      });
    },
  );

  it.each([
    "https://user:pass@example.com",
    "http://example.com",
    "https://example.com/path",
    "https://example.com?x=1",
  ])("rejects unsafe origins before transport: %s", async (origin) => {
    const transport = vi.fn<Transport>();
    expect(await readCommerceClinics({ ...options, origin, transport }, signal())).toEqual({
      status: "error",
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it("does not fetch when already aborted and rejects late transport results", async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = vi.fn<Transport>();
    expect(await readCommerceClinics({ ...options, transport }, controller.signal)).toEqual({
      status: "error",
    });
    expect(transport).not.toHaveBeenCalled();
    const later = new AbortController();
    transport.mockImplementation(async () => {
      later.abort();
      return Response.json({ items: [clinic] });
    });
    expect(await readCommerceClinics({ ...options, transport }, later.signal)).toEqual({
      status: "error",
    });
  });

  it("cancels a pending response stream on abort rather than displaying partial data", async () => {
    const controller = new AbortController();
    const cancelled = vi.fn();
    const response = new Response(new ReadableStream({ cancel: cancelled }), {
      headers: { "content-type": "application/json" },
    });
    const transport = vi.fn<Transport>().mockResolvedValue(response);
    const result = readCommerceClinics({ ...options, transport }, controller.signal);
    await Promise.resolve();
    controller.abort();
    expect(await result).toEqual({ status: "error" });
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it("reports transport failures instead of supplying fixtures", async () => {
    const transport = vi.fn<Transport>().mockRejectedValue(new Error("offline"));
    expect(await readCommerceClinics({ ...options, transport }, signal())).toEqual({
      status: "error",
    });
  });

  it("guards action presentation without inventing schedules or granting unauthorized reads", async () => {
    const underlying = vi
      .fn<StaffReader>()
      .mockResolvedValue({ status: "ready", data: { rows: [], nextCursor: null } });
    const reader = guardCommerceStaffReader({ ...clinic, actions: ["orders:read"] }, underlying);
    const query = { cursor: null, limit: 20, status: "" };
    expect((await reader("orders", query, signal())).status).toBe("ready");
    expect(await reader("batches", query, signal())).toEqual({ status: "denied" });
    expect(await reader("schedules", query, signal())).toEqual({ status: "unavailable" });
    expect(underlying).toHaveBeenCalledOnce();
    const stockReader = guardCommerceStaffReader(
      { ...clinic, actions: ["stock:read"] },
      underlying,
    );
    expect((await stockReader("batches", query, signal())).status).toBe("ready");
    expect(await stockReader("orders", query, signal())).toEqual({ status: "denied" });
  });

  it("exports the hook/component with explicit mapping and no raw transport fallback", () => {
    expect(useCommerceClinics).toBeTypeOf("function");
    expect(StaffCommerceWorkspace).toBeTypeOf("function");
    // No React test renderer is installed at repository root. Actual mounted behavior
    // belongs to the companion root E2E, not a fabricated component harness.
    const source = readFileSync(
      new URL("../../apps/workspaces/src/CommerceDirectory.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("locationId: clinic.locationId");
    expect(source).toContain("clinicName: clinic.name");
    expect(source).toContain("clinicId: clinic.clinicId");
    expect(source).not.toMatch(/transport\s*(?:=|\?\?)\s*fetch/);
  });
});
