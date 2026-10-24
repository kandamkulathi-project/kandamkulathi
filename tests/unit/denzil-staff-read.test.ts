import { describe, expect, it, vi } from "vitest";
import {
  createStaffReader,
  parseStaffPage,
  parseStaffQuery,
} from "../../apps/workspaces/src/staff/read-model";
import { staffReadLabels, staffReadTranslationReview } from "../../packages/i18n/src/staff-read";

const query = { cursor: null, limit: 20, status: "" };
const order = {
  id: "syn-order-a",
  reference: "Synthetic order A",
  clinicLabel: "Synthetic clinic A",
  status: "confirmed",
  totalPaise: 12500,
};
const page = { version: 1, rows: [order], nextCursor: "page_2" };
const config = {
  origin: "http://127.0.0.1:8787",
  local: true,
  endpoints: { orders: "/v1/staff/synthetic-orders" },
  decoders: { orders: (input: unknown) => input },
  cursorParameter: "cursor" as const,
  statusParameter: "status" as const,
  statuses: { orders: ["confirmed"] },
};
const signal = () => new AbortController().signal;

describe("bounded staff read proposal", () => {
  it("has identical nonempty EN/ML/TA nonclinical draft interface keys", () => {
    expect(staffReadTranslationReview).toBe("draft-unreviewed-nonclinical");
    const keys = Object.keys(staffReadLabels.en).sort();
    for (const locale of ["en", "ml", "ta"] as const) {
      expect(Object.keys(staffReadLabels[locale]).sort()).toEqual(keys);
      expect(Object.values(staffReadLabels[locale]).every((value) => value.trim().length > 0)).toBe(
        true,
      );
    }
    expect(staffReadLabels.ml.orders).toMatch(/[\u0d00-\u0d7f]/);
    expect(staffReadLabels.ta.orders).toMatch(/[\u0b80-\u0bff]/);
  });
  it("parses each allowlisted field without leaking extra private fields", () => {
    expect(parseStaffPage(page, "orders", query)).toEqual({
      rows: [{ ...order, kind: "orders" }],
      nextCursor: "page_2",
    });
    expect(
      parseStaffPage(
        {
          version: 1,
          rows: [
            {
              id: "batch",
              clinicLabel: "A",
              status: "held",
              productLabel: "Synthetic",
              batchCode: "B",
              expiresOn: "2028-02-29",
              quantity: 0,
            },
          ],
          nextCursor: null,
        },
        "batches",
        query,
      ).rows[0]?.kind,
    ).toBe("batches");
    expect(
      parseStaffPage(
        {
          version: 1,
          rows: [
            {
              id: "slot",
              clinicLabel: "A",
              status: "available",
              doctorLabel: "Synthetic doctor",
              startsAt: "2026-10-24T10:00:00Z",
              endsAt: "2026-10-24T10:30:00Z",
              modeLabel: "In clinic",
            },
          ],
          nextCursor: null,
        },
        "schedules",
        query,
      ).rows[0]?.kind,
    ).toBe("schedules");
  });
  it.each([
    { ...page, patient: "private" },
    { ...page, rows: [{ ...order, email: "private" }] },
    { ...page, rows: [{ ...order, totalPaise: 1.5 }] },
    { ...page, rows: [{ ...order, totalPaise: Number.MAX_SAFE_INTEGER + 1 }] },
    { ...page, rows: [order, order] },
    { ...page, nextCursor: "https://wrong.example" },
    {
      ...page,
      rows: Array.from({ length: 21 }, (_, index) => ({ ...order, id: `order-${index}` })),
    },
  ])("rejects malformed or overbroad response %#", (input) => {
    expect(() => parseStaffPage(input, "orders", query)).toThrow();
  });
  it("rejects impossible dates, invalid intervals and looping cursors", () => {
    const row = {
      id: "batch",
      clinicLabel: "A",
      status: "held",
      productLabel: "Synthetic",
      batchCode: "B",
      expiresOn: "2027-02-29",
      quantity: 1,
    };
    expect(() =>
      parseStaffPage({ version: 1, rows: [row], nextCursor: null }, "batches", query),
    ).toThrow();
    expect(() => parseStaffPage(page, "orders", { ...query, cursor: "page_2" })).toThrow();
    const schedule = {
      id: "slot",
      clinicLabel: "A",
      status: "available",
      doctorLabel: "Synthetic",
      startsAt: "2026-10-24T10:00:00Z",
      endsAt: "2026-10-24T10:00:00Z",
      modeLabel: "In clinic",
    };
    expect(() =>
      parseStaffPage({ version: 1, rows: [schedule], nextCursor: null }, "schedules", query),
    ).toThrow();
    expect(
      parseStaffPage(
        {
          version: 1,
          rows: [{ ...schedule, endsAt: "2026-10-24T10:00:00.500Z" }],
          nextCursor: null,
        },
        "schedules",
        query,
      ).rows,
    ).toHaveLength(1);
    expect(() =>
      parseStaffPage(
        {
          version: 1,
          rows: [{ ...schedule, endsAt: "2026-10-24T10:00:00.000Z" }],
          nextCursor: null,
        },
        "schedules",
        query,
      ),
    ).toThrow();
  });
  it.each([
    { ...query, limit: 0 },
    { ...query, limit: 101 },
    { ...query, limit: "20" },
    { ...query, cursor: "../wrong" },
    { ...query, status: "not-permitted" },
    { ...query, clinic: "other" },
  ])("rejects invalid filter/pagination %#", (input) => {
    expect(() => parseStaffQuery(input, ["confirmed"])).toThrow();
  });
  it("sends only bounded credentialed no-store GETs to an explicitly configured route", async () => {
    const transport = vi.fn<TestFetch>().mockResolvedValue(Response.json(page));
    const result = await createStaffReader(config, transport)(
      "orders",
      { cursor: "page_1", limit: 20, status: "confirmed" },
      signal(),
    );
    expect(result.status).toBe("ready");
    expect(transport).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/v1/staff/synthetic-orders?limit=20&cursor=page_1&status=confirmed",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        cache: "no-store",
        redirect: "error",
      }),
    );
  });
  it.each([
    [401, "anonymous"],
    [403, "denied"],
    [404, "unavailable"],
    [501, "unavailable"],
    [503, "unavailable"],
    [500, "error"],
  ] as const)("maps HTTP %s truthfully", async (code, status) => {
    const transport = vi
      .fn<TestFetch>()
      .mockResolvedValue(new Response("untrusted details", { status: code }));
    expect(await createStaffReader(config, transport)("orders", query, signal())).toEqual({
      status,
    });
  });
  it("leaves missing endpoints pending without making a request or fabricating data", async () => {
    const transport = vi.fn<TestFetch>();
    expect(await createStaffReader(config, transport)("schedules", query, signal())).toEqual({
      status: "unavailable",
    });
    expect(transport).not.toHaveBeenCalled();
  });
  it("requires an owner decoder and does not assume presentation fixtures match real API payloads", async () => {
    const transport = vi.fn<TestFetch>();
    expect(
      await createStaffReader(
        { origin: config.origin, local: true, endpoints: config.endpoints },
        transport,
      )("orders", query, signal()),
    ).toEqual({ status: "unavailable" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("defaults to owner pagination after and never sends unsupported status filters", async () => {
    const decode = vi.fn((input: unknown) => {
      expect(input).toEqual({ syntheticOwnerPayload: true });
      return page;
    });
    const transport = vi
      .fn<TestFetch>()
      .mockResolvedValue(Response.json({ syntheticOwnerPayload: true }));
    const reader = createStaffReader(
      {
        origin: config.origin,
        local: true,
        endpoints: config.endpoints,
        decoders: { orders: decode },
        statuses: { orders: ["confirmed"] },
      },
      transport,
    );
    expect((await reader("orders", { ...query, cursor: "previous_page" }, signal())).status).toBe(
      "ready",
    );
    expect(transport).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/v1/staff/synthetic-orders?limit=20&after=previous_page",
      expect.anything(),
    );
    expect(decode).toHaveBeenCalledOnce();
    expect(await reader("orders", { ...query, status: "confirmed" }, signal())).toEqual({
      status: "error",
    });
    expect(transport).toHaveBeenCalledOnce();
  });
  it("rejects unsafe endpoint/origin/filter configuration before transport", async () => {
    const transport = vi.fn<TestFetch>();
    for (const overrides of [
      { origin: "http://external.example" },
      { endpoints: { orders: "//external.example/v1/staff/orders" } },
    ]) {
      expect(
        await createStaffReader({ ...config, ...overrides }, transport)("orders", query, signal()),
      ).toEqual({ status: "error" });
    }
    expect(
      await createStaffReader(config, transport)(
        "orders",
        { ...query, status: "forged" },
        signal(),
      ),
    ).toEqual({ status: "error" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("does not accept a late response after abort even if transport ignores cancellation", async () => {
    const controller = new AbortController();
    let finish: ((response: Response) => void) | undefined;
    const transport = vi.fn<TestFetch>(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const result = createStaffReader(config, transport)("orders", query, controller.signal);
    controller.abort();
    finish?.(Response.json(page));
    expect(await result).toEqual({ status: "error" });
  });
  it("returns error for HTML, malformed JSON, schema failure and network failure; explicit retries can recover", async () => {
    const transport = vi
      .fn<TestFetch>()
      .mockResolvedValueOnce(
        new Response("<html>error</html>", { headers: { "content-type": "text/html" } }),
      )
      .mockResolvedValueOnce(new Response("{", { headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(Response.json({ ...page, version: 2 }))
      .mockRejectedValueOnce(new Error("private provider details"))
      .mockResolvedValueOnce(Response.json({ version: 1, rows: [], nextCursor: null }));
    const reader = createStaffReader(config, transport);
    for (let index = 0; index < 4; index++)
      expect(await reader("orders", query, signal())).toEqual({ status: "error" });
    expect(await reader("orders", query, signal())).toEqual({
      status: "ready",
      data: { rows: [], nextCursor: null },
    });
  });
  it("bounds response bytes and rejects invalid UTF-8 without showing raw payloads", async () => {
    const transport = vi
      .fn<TestFetch>()
      .mockResolvedValueOnce(
        new Response(" ".repeat(256001), { headers: { "content-type": "application/json" } }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0xff]), { headers: { "content-type": "application/json" } }),
      );
    const reader = createStaffReader(config, transport);
    expect(await reader("orders", query, signal())).toEqual({ status: "error" });
    expect(await reader("orders", query, signal())).toEqual({ status: "error" });
  });
});

import type { TestFetch } from "../fixtures/fetch";
