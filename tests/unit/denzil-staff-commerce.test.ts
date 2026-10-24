import { describe, expect, it, vi } from "vitest";
import { createCommerceStaffReader } from "../../apps/workspaces/src/staff/commerce-reader";
import {
  staffCommerceIds as ids,
  staffCommerceAssociation,
  staffCommerceBatchPage,
  staffCommerceOrderPage,
} from "../../apps/workspaces/src/staff/testing/commerce-fixtures";

const config = { origin: "http://127.0.0.1:8787", local: true, ...staffCommerceAssociation };
const query = { cursor: null, limit: 20, status: "" };
const signal = () => new AbortController().signal;

describe("canonical commerce staff read adapter", () => {
  it("requires an explicit location mapping without guessing clinic equality or fetching", async () => {
    const transport = vi.fn<TestFetch>();
    const { locationId: _, ...unmapped } = config;
    expect(await createCommerceStaffReader(unmapped, transport)("orders", query, signal())).toEqual(
      { status: "unavailable" },
    );
    expect(transport).not.toHaveBeenCalled();
  });
  it("uses raw location IDs as display fallback and preserves raw metadata with a clinic name", async () => {
    const transport = vi
      .fn<TestFetch>()
      .mockImplementation(async () => Response.json(staffCommerceOrderPage));
    const { clinicName: _, ...unnamed } = config;
    expect(
      await createCommerceStaffReader(
        { ...unnamed, locationId: ids.location.toUpperCase() },
        transport,
      )("orders", query, signal()),
    ).toMatchObject({
      status: "ready",
      data: { rows: [{ clinicLabel: ids.location, metadata: { locationId: ids.location } }] },
    });
    expect(
      await createCommerceStaffReader(config, transport)("orders", query, signal()),
    ).toMatchObject({
      status: "ready",
      data: { rows: [{ clinicLabel: config.clinicName, metadata: { locationId: ids.location } }] },
    });
  });
  it.each([{ clinicId: "bad" }, { locationId: "bad" }, { clinicId: "bad", locationId: "bad" }])(
    "rejects malformed directory UUIDs before fetch %#",
    async (fields) => {
      const transport = vi.fn<TestFetch>();
      expect(
        await createCommerceStaffReader({ ...config, ...fields }, transport)(
          "orders",
          query,
          signal(),
        ),
      ).toEqual({ status: "error" });
      expect(transport).not.toHaveBeenCalled();
    },
  );
  it.each(["", " ", "x".repeat(161), "unsafe\nname", "unsafe\u007fname"])(
    "rejects unsafe presentation names without fetching %#",
    async (clinicName) => {
      const transport = vi.fn<TestFetch>();
      expect(
        await createCommerceStaffReader({ ...config, clinicName }, transport)(
          "orders",
          query,
          signal(),
        ),
      ).toEqual({ status: "error" });
      expect(transport).not.toHaveBeenCalled();
    },
  );
  it.each(["orders", "batches"] as const)(
    "rejects wrong-location %s even when it equals the route clinic",
    async (kind) => {
      const body = kind === "orders" ? staffCommerceOrderPage : staffCommerceBatchPage;
      const transport = vi.fn<TestFetch>().mockResolvedValue(
        Response.json({
          ...body,
          items: body.items.map((row) => ({ ...row, locationId: ids.clinic })),
        }),
      );
      expect(await createCommerceStaffReader(config, transport)(kind, query, signal())).toEqual({
        status: "error",
      });
    },
  );
  it("parses the owner's order DTO then retains IDs, source, version, amount and timestamps", async () => {
    const transport = vi.fn<TestFetch>().mockResolvedValue(Response.json(staffCommerceOrderPage));
    const result = await createCommerceStaffReader(config, transport)("orders", query, signal());
    expect(result).toEqual({
      status: "ready",
      data: {
        nextCursor: ids.next,
        rows: [
          {
            kind: "orders",
            id: ids.order,
            reference: ids.order,
            clinicLabel: config.clinicName,
            status: "reserved",
            totalPaise: 12500,
            metadata: {
              locationId: ids.location,
              currency: "INR",
              version: 3,
              source: "phone",
              createdAt: "2026-10-24T10:00:00.000Z",
              expiresAt: "2026-10-24T10:15:00.000Z",
            },
          },
        ],
      },
    });
    expect(transport).toHaveBeenCalledWith(
      `${config.origin}/v1/staff/clinics/${ids.clinic}/orders?limit=20`,
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        cache: "no-store",
        redirect: "error",
      }),
    );
  });
  it("retains onHand, reserved and recalled separately without availability/status invention", async () => {
    const transport = vi.fn<TestFetch>().mockResolvedValue(Response.json(staffCommerceBatchPage));
    expect(await createCommerceStaffReader(config, transport)("batches", query, signal())).toEqual({
      status: "ready",
      data: {
        nextCursor: null,
        rows: [
          {
            kind: "batches",
            id: ids.batch,
            clinicLabel: config.clinicName,
            locationId: ids.location,
            productLabel: ids.sku,
            skuId: ids.sku,
            batchCode: "Synthetic batch A",
            expiresOn: "2027-10-24",
            onHand: 8,
            reserved: 3,
            recalled: true,
          },
        ],
      },
    });
    expect(transport).toHaveBeenCalledWith(
      `${config.origin}/v1/staff/clinics/${ids.clinic}/batches?limit=20`,
      expect.anything(),
    );
  });
  it("normalizes canonical UUID aliases and sends only after/limit (1..100)", async () => {
    const transport = vi
      .fn<TestFetch>()
      .mockImplementation(async () => Response.json({ items: [], nextCursor: null }));
    const reader = createCommerceStaffReader(
      { ...config, clinicId: ids.clinic.toUpperCase(), locationId: ids.location.toUpperCase() },
      transport,
    );
    for (const limit of [1, 100]) {
      expect(
        (await reader("orders", { ...query, limit, cursor: ids.next.toUpperCase() }, signal()))
          .status,
      ).toBe("ready");
      expect(transport).toHaveBeenLastCalledWith(
        `${config.origin}/v1/staff/clinics/${ids.clinic}/orders?limit=${limit}&after=${ids.next}`,
        expect.anything(),
      );
    }
  });
  it("retains valid shared timestamp precision without inventing a new DTO timestamp restriction", async () => {
    const body = {
      items: [
        {
          ...staffCommerceOrderPage.items[0],
          createdAt: "2026-10-24T10:00:00.1Z",
          expiresAt: "2026-10-24T10:15:00.123456Z",
        },
      ],
      nextCursor: null,
    };
    const transport = vi.fn<TestFetch>().mockResolvedValue(Response.json(body));
    expect(
      await createCommerceStaffReader(config, transport)("orders", query, signal()),
    ).toMatchObject({
      status: "ready",
      data: {
        rows: [
          {
            metadata: {
              createdAt: "2026-10-24T10:00:00.1Z",
              expiresAt: "2026-10-24T10:15:00.123456Z",
            },
          },
        ],
      },
    });
  });
  it.each([
    { ...query, cursor: "not-a-uuid" },
    { ...query, cursor: "https://wrong.example" },
    { ...query, status: "reserved" },
    { ...query, limit: 0 },
    { ...query, limit: 101 },
    { ...query, actorId: ids.order },
  ])("rejects invalid cursor/filter/page inputs before transport %#", async (input) => {
    const transport = vi.fn<TestFetch>();
    expect(await createCommerceStaffReader(config, transport)("orders", input, signal())).toEqual({
      status: "error",
    });
    expect(transport).not.toHaveBeenCalled();
  });
  it("rejects invalid clinic UUID and never constructs guessed alias routes", async () => {
    const transport = vi.fn<TestFetch>();
    expect(
      await createCommerceStaffReader({ ...config, clinicId: "../orders" }, transport)(
        "orders",
        query,
        signal(),
      ),
    ).toEqual({ status: "error" });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([
    { ...staffCommerceOrderPage, nextCursor: "bad" },
    { ...staffCommerceOrderPage, items: [{ ...staffCommerceOrderPage.items[0], orderId: "bad" }] },
    {
      ...staffCommerceOrderPage,
      items: [{ ...staffCommerceOrderPage.items[0], privateNotes: "never exposed" }],
    },
    {
      ...staffCommerceOrderPage,
      items: [{ ...staffCommerceOrderPage.items[0], status: "invented" }],
    },
    {
      ...staffCommerceOrderPage,
      items: [{ ...staffCommerceOrderPage.items[0], locationId: ids.otherLocation }],
    },
  ])("fails closed on malformed/out-of-location owner order DTO %#", async (body) => {
    const transport = vi.fn<TestFetch>().mockResolvedValue(Response.json(body));
    expect(await createCommerceStaffReader(config, transport)("orders", query, signal())).toEqual({
      status: "error",
    });
  });
  it.each([
    { ...staffCommerceBatchPage.items[0], reserved: undefined },
    { ...staffCommerceBatchPage.items[0], reserved: -1 },
    { ...staffCommerceBatchPage.items[0], recalled: "true" },
    { ...staffCommerceBatchPage.items[0], skuId: "bad" },
    { ...staffCommerceBatchPage.items[0], status: "available" },
  ])(
    "rejects missing/malformed/invented batch fields rather than hiding them %#",
    async (batch) => {
      const transport = vi
        .fn<TestFetch>()
        .mockResolvedValue(Response.json({ items: [batch], nextCursor: null }));
      expect(
        await createCommerceStaffReader(config, transport)("batches", query, signal()),
      ).toEqual({ status: "error" });
    },
  );
  it.each([
    [401, "anonymous"],
    [403, "denied"],
    [503, "unavailable"],
  ] as const)("preserves HTTP %s without projecting private data", async (code, status) => {
    const transport = vi
      .fn<TestFetch>()
      .mockResolvedValue(new Response("untrusted details", { status: code }));
    expect(await createCommerceStaffReader(config, transport)("orders", query, signal())).toEqual({
      status,
    });
  });
  it("leaves schedules Pending, rejects a cancelled read, and does not fabricate stock arithmetic", async () => {
    const transport = vi.fn<TestFetch>();
    const reader = createCommerceStaffReader(config, transport);
    expect(await reader("schedules", query, signal())).toEqual({ status: "unavailable" });
    const controller = new AbortController();
    controller.abort();
    expect(await reader("batches", query, controller.signal)).toEqual({ status: "error" });
    expect(transport).not.toHaveBeenCalled();
    // A server snapshot may represent reserved > onHand; the view must not silently subtract/clamp it.
    transport.mockResolvedValue(
      Response.json({
        items: [{ ...staffCommerceBatchPage.items[0], onHand: 0, reserved: 9, recalled: false }],
        nextCursor: null,
      }),
    );
    expect(await reader("batches", query, signal())).toMatchObject({
      status: "ready",
      data: { rows: [{ onHand: 0, reserved: 9, recalled: false }] },
    });
  });
  it("fences a late ignored-abort response and rejects cyclic owner cursors", async () => {
    let finish: ((response: Response) => void) | undefined;
    const transport = vi.fn<TestFetch>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const controller = new AbortController();
    const pending = createCommerceStaffReader(config, transport)(
      "orders",
      query,
      controller.signal,
    );
    controller.abort();
    finish?.(Response.json(staffCommerceOrderPage));
    expect(await pending).toEqual({ status: "error" });
    transport.mockResolvedValue(Response.json(staffCommerceOrderPage));
    expect(
      await createCommerceStaffReader(config, transport)(
        "orders",
        { ...query, cursor: ids.next },
        signal(),
      ),
    ).toEqual({ status: "error" });
  });
});

import type { TestFetch } from "../fixtures/fetch";
