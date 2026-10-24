import { describe, expect, it, vi } from "vitest";
import { nativeCustomerApiTransport } from "../../apps/mobile/src/customer/runtime";
import { nativeApiTransport } from "../../packages/client/src/knowledge";
import type { TestFetch } from "../fixtures/fetch";
import { selection } from "../fixtures/native-customer";

const origin = "https://api.example.com";
const query = new URLSearchParams({
  ...selection,
  modality: "online",
  from: "2026-10-24T09:00:00.000Z",
  until: "2026-10-25T09:00:00.000Z",
  limit: "50",
});
const offers = `${origin}/v1/booking-offers?${query}`;
describe("native bearer query exception", () => {
  it("permits canonical keyset GET queries only on catalogue/orders and never unknown/duplicate/unbounded fields", async () => {
    const read = vi.fn(async () => "synthetic_native_bearer_12345");
    const fetcher = vi.fn<TestFetch>(async () => Response.json({}));
    const send = nativeCustomerApiTransport(origin, false, read, () => true, fetcher);
    for (const path of ["catalogue", "orders"]) {
      for (const query of [
        "limit=0",
        "limit=101",
        "limit=25&limit=50",
        "limit=25&ownerId=other",
        "after=bad",
      ]) {
        await expect(send(`${origin}/v1/${path}?${query}`)).rejects.toThrow("Invalid API request");
      }
      await expect(send(`${origin}/v1/${path}?limit=25`, { method: "POST" })).rejects.toThrow(
        "Invalid API request",
      );
    }
    await expect(send(`${origin}/v1/payments?limit=25`)).rejects.toThrow("Invalid API request");
    expect(read).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    await send(`${origin}/v1/catalogue?limit=25`);
    await send(`${origin}/v1/orders?limit=25&after=${selection.doctorId}`);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("pins the validated URL before credential storage awaits even if the caller later mutates its URL object", async () => {
    let release: (token: string) => void = () => {};
    const read = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    const fetcher = vi.fn<TestFetch>(async () => Response.json({}));
    const input = new URL(offers);
    const pending = nativeCustomerApiTransport(origin, false, read, () => true, fetcher)(input);
    input.hostname = "attacker.invalid";
    release("synthetic_native_bearer_12345");
    await pending;
    expect(fetcher.mock.calls[0]?.[0]).toBe(offers);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe(
      "Bearer synthetic_native_bearer_12345",
    );
  });
  it("denies queries by default before reading credentials and permits only explicit true", async () => {
    const read = vi.fn(async () => "synthetic_native_bearer_12345");
    const fetcher = vi.fn<TestFetch>(async () => Response.json({}));
    await expect(
      nativeApiTransport(origin, false, read, () => true, fetcher)(offers),
    ).rejects.toThrow("Invalid API request");
    for (const policy of [
      () => false,
      () => {
        throw Error("Synthetic configuration failure");
      },
      () => JSON.parse('"untrusted non-boolean configuration"'),
    ]) {
      await expect(
        nativeApiTransport(origin, false, read, () => true, fetcher, policy)(offers),
      ).rejects.toThrow("Invalid API request");
    }
    expect(read).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("validates origin/path/credentials/fragment before invoking policy, and cannot mutate the actual credentialed target", async () => {
    const policy = vi.fn((url: URL) => {
      url.hostname = "attacker.invalid";
      url.pathname = "/changed";
      return true;
    });
    const read = vi.fn(async () => "synthetic_native_bearer_12345");
    const fetcher = vi.fn<TestFetch>(async () => Response.json({}));
    const send = nativeApiTransport(origin, false, read, () => true, fetcher, policy);
    for (const invalid of [
      offers.replace(origin, "https://attacker.invalid"),
      offers.replace("/v1/", "/v2/"),
      offers.replace("https://", "https://user:secret@"),
      `${offers}#fragment`,
      `${offers}#`,
    ])
      await expect(send(invalid)).rejects.toThrow("Invalid API request");
    expect(policy).not.toHaveBeenCalled();
    await send(offers);
    expect(fetcher).toHaveBeenCalledWith(
      offers,
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe(
      "Bearer synthetic_native_bearer_12345",
    );
  });
  it("native customer permits only the canonical bounded offer GET, rejecting unknown/duplicate/path trick and mutation queries", async () => {
    const read = vi.fn(async () => "synthetic_native_bearer_12345");
    const fetcher = vi.fn<TestFetch>(async () => Response.json({}));
    const send = nativeCustomerApiTransport(origin, false, read, () => true, fetcher);
    for (const invalid of [
      `${offers}&doctorId=${selection.doctorId}`,
      `${offers}&ownerId=${selection.doctorId}`,
      offers.replace("limit=50", "limit=101"),
      offers.replace("booking-offers?", "orders?"),
      offers.replace("booking-offers?", "%62ooking-offers?"),
      offers.replace("/v1/booking-offers?", "/v1/../v1/booking-offers?"),
      offers.replace("/v1/booking-offers?", "/v1//booking-offers?"),
      `${offers}#fragment`,
      offers.replace("until=2026-10-25", "until=2026-11-25"),
    ])
      await expect(send(invalid)).rejects.toThrow("Invalid API request");
    await expect(send(offers, { method: "POST" })).rejects.toThrow("Invalid API request");
    expect(read).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    await send(offers, { method: "GET" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
