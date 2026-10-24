import { afterEach, describe, expect, it, vi } from "vitest";
import { consultationAccess } from "../../packages/client/src/consultation";
import {
  bookingExpired,
  mayJoin,
  paymentFlow,
  sensitiveClient,
} from "../../packages/client/src/sensitive";
import {
  appointmentSchema,
  consentSubmissionSchema,
  intakeSubmissionSchema,
  paymentSchema,
} from "../../packages/contracts/src/sensitive";
import {
  appointment,
  choices,
  consents,
  context,
  grant,
  otherReference,
  payment,
  receipt,
  reference,
  session,
} from "../fixtures/sensitive";

const origin = "https://api.example.com";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
function setup(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response> = () => json(payment),
) {
  let operation = 0;
  const transport = vi.fn<TestFetch>(async (url, init) =>
    String(url).endsWith("/v1/security/context") ? json(context) : handler(String(url), init),
  );
  const revoked = vi.fn();
  const client = sensitiveClient({
    origin,
    local: false,
    session,
    transport,
    uuid: () => `30000000-0000-4000-8000-${String(++operation).padStart(12, "0")}`,
    onRevoked: revoked,
  });
  return { client, transport, revoked };
}
afterEach(() => vi.useRealTimers());

describe("strict proposed sensitive contracts", () => {
  it("keeps optional marketing separate and refuses missing required consent or unreviewed fields", () => {
    expect(consentSubmissionSchema.parse(choices).marketingAccepted).toBe(false);
    expect(consentSubmissionSchema.safeParse({ ...choices, signupAccepted: false }).success).toBe(
      false,
    );
    expect(consentSubmissionSchema.safeParse({ ...choices, privacyAccepted: false }).success).toBe(
      false,
    );
    expect(consentSubmissionSchema.safeParse({ ...choices, userId: otherReference }).success).toBe(
      false,
    );
  });
  it("uses exact integer paise and refuses inconsistent checkout, duplicate intake and extra clinical information", () => {
    expect(paymentSchema.safeParse({ ...payment, amountPaise: 199.5 }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...payment, amountPaise: 20000 }).success).toBe(false);
    expect(
      appointmentSchema.safeParse({ ...appointment, fullMedicalHistory: "private" }).success,
    ).toBe(false);
    expect(
      intakeSubmissionSchema.safeParse({
        revision: "r1",
        policyVersion: "p1",
        answers: [
          { id: "age", value: "unknown", disposition: "unknown" },
          { id: "age", value: "unknown", disposition: "declined" },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("session-bound uncached API access", () => {
  it("requires a new client after effect cleanup and does not poison the restarted lifetime", async () => {
    const previous = setup();
    previous.client.dispose();
    expect(await previous.client.security()).toEqual({ status: "anonymous" });
    expect(previous.transport).not.toHaveBeenCalled();
    const restarted = setup();
    expect(await restarted.client.security()).toEqual({ status: "ready", data: context });
    expect(restarted.transport).toHaveBeenCalledTimes(1);
    restarted.client.dispose();
    expect(await restarted.client.security()).toEqual({ status: "anonymous" });
    expect(restarted.transport).toHaveBeenCalledTimes(1);
  });
  it("uses credentialed fixed routes, CSRF and a fresh identity for each completed action", async () => {
    const { client, transport } = setup(() => json({ ...consents, ...choices }));
    expect((await client.saveConsents(choices)).status).toBe("ready");
    expect((await client.saveConsents(choices)).status).toBe("ready");
    const posts = transport.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(2);
    for (const [url, init] of posts) {
      expect(url).toBe(`${origin}/v1/consents`);
      expect(init).toMatchObject({ cache: "no-store", credentials: "include", redirect: "error" });
      expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe(context.csrfToken);
      expect(new Headers(init?.headers).get("Idempotency-Key")).toMatch(/^[a-f0-9-]{36}$/);
      expect(JSON.parse(String(init?.body))).toEqual(choices);
    }
    expect(
      new Set(posts.map(([, init]) => new Headers(init?.headers).get("Idempotency-Key"))).size,
    ).toBe(2);
    client.dispose();
  });
  it("applies false -> true -> false consent actions against a replaying server", async () => {
    let current = { ...consents, ...choices };
    const replay = new Map<string, typeof current>();
    const { client } = setup((_url, init) => {
      const key = new Headers(init?.headers).get("Idempotency-Key") ?? "";
      expect(key).not.toBe("");
      const cached = replay.get(key);
      if (cached) return json(cached);
      current = { ...current, ...JSON.parse(String(init?.body)) };
      replay.set(key, current);
      return json(current);
    });
    for (const consultationAccepted of [false, true, false]) {
      expect(await client.saveConsents({ ...choices, consultationAccepted })).toMatchObject({
        status: "ready",
        data: { consultationAccepted },
      });
      expect(current.consultationAccepted).toBe(consultationAccepted);
    }
    expect(replay.size).toBe(3);
    client.dispose();
  });
  it("gets pending then paid without receipts instead of replaying an earlier poll", async () => {
    const replay = new Map<string, unknown>();
    let verifications = 0;
    const { client } = setup((_url, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({});
      const key = new Headers(init?.headers).get("Idempotency-Key") ?? "";
      expect(key).not.toBe("");
      if (!replay.has(key))
        replay.set(key, {
          ...payment,
          checkout: null,
          status: ++verifications === 1 ? "pending" : "paid",
        });
      return json(replay.get(key));
    });
    expect(await client.reconcile(reference)).toMatchObject({
      status: "ready",
      data: { status: "pending" },
    });
    expect(await client.reconcile(reference)).toMatchObject({
      status: "ready",
      data: { status: "paid" },
    });
    expect(verifications).toBe(2);
    client.dispose();
  });
  it.each([403, 409, 410])("retires an operation after definitive HTTP %i", async (code) => {
    let requests = 0;
    const { client, transport } = setup(() =>
      ++requests === 1 ? json({}, code) : json({ ...consents, ...choices }),
    );
    await client.saveConsents(choices);
    expect((await client.saveConsents(choices)).status).toBe("ready");
    const keys = transport.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => new Headers(init?.headers).get("Idempotency-Key"));
    expect(new Set(keys).size).toBe(2);
    client.dispose();
  });
  it.each(["unavailable", "server-error", "malformed"])(
    "retains an operation after an ambiguous %s result",
    async (kind) => {
      let requests = 0;
      const { client, transport } = setup(() =>
        ++requests === 1
          ? kind === "unavailable"
            ? json({}, 503)
            : kind === "server-error"
              ? json({}, 500)
              : json({ invalid: true })
          : json({ ...consents, ...choices }),
      );
      await client.saveConsents(choices);
      expect((await client.saveConsents(choices)).status).toBe("ready");
      const keys = transport.mock.calls
        .filter(([, init]) => init?.method === "POST")
        .map(([, init]) => new Headers(init?.headers).get("Idempotency-Key"));
      expect(keys).toHaveLength(2);
      expect(new Set(keys).size).toBe(1);
      client.dispose();
    },
  );
  it("does not exhaust retry-key memory after more than 64 completed actions", async () => {
    const { client } = setup(() => json({ ...consents, ...choices }));
    for (let i = 0; i < 65; i++)
      expect(
        (await client.saveConsents({ ...choices, privacyVersion: `privacy-${i}` })).status,
      ).toBe("ready");
    client.dispose();
  });
  it("does not evict an ambiguous operation when retry-key memory is full", async () => {
    let unavailable = true;
    const { client, transport } = setup(() =>
      unavailable ? json({}, 503) : json({ ...consents, ...choices }),
    );
    for (let i = 0; i < 64; i++)
      expect(
        (await client.saveConsents({ ...choices, privacyVersion: `privacy-${i}` })).status,
      ).toBe("unavailable");
    expect((await client.saveConsents({ ...choices, privacyVersion: "privacy-64" })).status).toBe(
      "error",
    );
    const posts = () => transport.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts()).toHaveLength(64);
    unavailable = false;
    expect((await client.saveConsents({ ...choices, privacyVersion: "privacy-0" })).status).toBe(
      "ready",
    );
    expect(new Headers(posts()[64]?.[1]?.headers).get("Idempotency-Key")).toBe(
      new Headers(posts()[0]?.[1]?.headers).get("Idempotency-Key"),
    );
    client.dispose();
  });
  it("reserves the mutation slot before awaiting security context", async () => {
    let resolve!: (response: Response) => void;
    const transport = vi
      .fn<TestFetch>()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(json({ ...consents, ...choices }));
    const client = sensitiveClient({ origin, local: false, session, transport });
    const first = client.saveConsents(choices);
    expect((await client.saveConsents(choices)).status).toBe("busy");
    resolve(json(context));
    expect((await first).status).toBe("ready");
    expect(transport.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    client.dispose();
  });
  it.each(["foreign", "expired", "overlong"])(
    "rejects %s security contexts before any mutation",
    async (kind) => {
      const transport = vi.fn<TestFetch>().mockResolvedValue(
        json({
          ...context,
          ...(kind === "foreign"
            ? { userId: otherReference }
            : {
                expiresAt: kind === "expired" ? "2020-01-01T00:00:00Z" : "2100-01-01T00:00:00Z",
              }),
        }),
      );
      const client = sensitiveClient({ origin, local: false, session, transport });
      expect((await client.saveConsents(choices)).status).toBe("anonymous");
      expect(transport.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    },
  );
  it.each([
    [401, "anonymous"],
    [403, "denied"],
    [409, "conflict"],
    [410, "expired"],
    [503, "unavailable"],
  ] as const)("maps HTTP %i safely", async (code, status) => {
    const { client, revoked } = setup(() => json({}, code));
    expect(await client.payment(reference)).toEqual({ status });
    expect(revoked).toHaveBeenCalledTimes(code === 401 ? 1 : 0);
    client.dispose();
  });
  it("does not accept a changed session ID while reusing a verified user", async () => {
    const transport = vi
      .fn<TestFetch>()
      .mockResolvedValueOnce(json(context))
      .mockResolvedValueOnce(json({ ...context, sessionId: reference }));
    const client = sensitiveClient({ origin, local: false, session, transport });
    expect((await client.security()).status).toBe("ready");
    expect((await client.security()).status).toBe("anonymous");
  });
  it("does not resurrect private data when a transport ignores cancellation", async () => {
    let resolve!: (response: Response) => void;
    const { client } = setup(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = client.payment(reference);
    client.dispose();
    resolve(json(payment));
    expect(await pending).toEqual({ status: "anonymous" });
  });
  it("preserves unknown mutation outcomes and never retries automatically", async () => {
    const { client, transport } = setup(() => {
      throw new Error("Synthetic disconnected response");
    });
    expect(await client.reconcile(reference)).toEqual({ status: "unknown" });
    expect(transport).toHaveBeenCalledTimes(2);
    client.dispose();
  });
  it("rejects oversized and malformed responses, invalid references and invalid consent before mutation", async () => {
    const { client, transport } = setup(() => json({ extra: "x".repeat(65536) }));
    expect(await client.payment(reference)).toEqual({ status: "error" });
    expect(await client.payment("../another-user")).toEqual({ status: "error" });
    expect(await client.saveConsents({ ...choices, privacyAccepted: false })).toEqual({
      status: "error",
    });
    expect(transport).toHaveBeenCalledTimes(1);
    client.dispose();
  });
  it("sign-in accepts only the fixed server-owned continuation and never an arbitrary redirect", async () => {
    const transport = vi
      .fn<TestFetch>()
      .mockResolvedValueOnce(json({ redirectPath: "https://evil.example/" }))
      .mockResolvedValueOnce(json({ redirectPath: "/v1/auth/authorize" }));
    const client = sensitiveClient({ origin, local: false, session: null, transport });
    expect(await client.signIn()).toEqual({ status: "error" });
    expect(await client.signIn()).toEqual({ status: "ready", data: `${origin}/v1/auth/authorize` });
    expect((await client.consents()).status).toBe("anonymous");
    client.dispose();
  });
  it("clears the local lifetime even when remote logout cannot be confirmed", async () => {
    const { client, revoked } = setup(() => json({}, 503));
    expect(await client.signOut()).toEqual({ status: "unavailable" });
    expect(revoked).toHaveBeenCalledOnce();
    expect((await client.payment(reference)).status).toBe("anonymous");
  });
  it("does not submit when CSRF/bootstrap is unavailable, or accept a response after the request deadline", async () => {
    const unavailable = vi.fn<TestFetch>().mockResolvedValue(json({}, 503));
    const client = sensitiveClient({ origin, local: false, session, transport: unavailable });
    expect(await client.saveConsents(choices)).toEqual({ status: "unavailable" });
    expect(unavailable).toHaveBeenCalledOnce();
    client.dispose();
    vi.useFakeTimers();
    let resolve!: (value: Response) => void;
    const late = setup(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const request = late.client.payment(reference);
    await vi.advanceTimersByTimeAsync(5001);
    resolve(json(payment));
    expect(await request).toEqual({ status: "error" });
    late.client.dispose();
  });
  it("retains the same operation key after an uncertain response instead of minting a replacement action", async () => {
    let submissions = 0;
    let verifications = 0;
    const replay = new Map<string, unknown>();
    const uuid = vi.fn().mockReturnValueOnce(otherReference).mockReturnValueOnce(reference);
    const transport = vi.fn<TestFetch>(async (url, init) => {
      if (String(url).endsWith("context")) return json(context);
      const key = new Headers(init?.headers).get("Idempotency-Key") ?? "";
      expect(key).not.toBe("");
      if (!replay.has(key))
        replay.set(key, {
          ...payment,
          status: ++verifications === 1 ? "pending" : "paid",
          checkout: null,
        });
      // The server committed and stored its replay result before the response was lost.
      if (++submissions === 1) throw new Error("Synthetic lost response");
      return json(replay.get(key));
    });
    const client = sensitiveClient({ origin, local: false, session, transport, uuid });
    expect((await client.reconcile(reference)).status).toBe("unknown");
    expect(await client.reconcile(reference)).toMatchObject({
      status: "ready",
      data: { status: "pending" },
    });
    expect(uuid).toHaveBeenCalledOnce();
    expect(verifications).toBe(1);
    expect(await client.reconcile(reference)).toMatchObject({
      status: "ready",
      data: { status: "paid" },
    });
    expect(uuid).toHaveBeenCalledTimes(2);
    expect(verifications).toBe(2);
    client.dispose();
  });
});

describe("authoritative payment reconciliation", () => {
  it.each(["success", "cancel", "malformed", "foreign-order"])(
    "reconciles SDK %s without claiming paid",
    async (outcome) => {
      const { client, transport } = setup((url) =>
        json(
          url.endsWith("reconcile") ? { ...payment, status: "pending", checkout: null } : payment,
        ),
      );
      const sdk = vi.fn(async () => {
        if (outcome === "cancel") throw new Error("Synthetic cancel");
        return outcome === "success"
          ? receipt
          : outcome === "malformed"
            ? { paid: true }
            : { ...receipt, razorpay_order_id: "order_foreign" };
      });
      expect(await paymentFlow(client, sdk).pay(reference, payment)).toMatchObject({
        status: "ready",
        data: { status: "pending" },
      });
      expect(sdk).toHaveBeenCalledWith(payment.checkout, expect.any(Function));
      const post = transport.mock.calls.find(([url]) => String(url).endsWith("reconcile"));
      expect(JSON.parse(String(post?.[1]?.body))).toEqual(outcome === "success" ? { receipt } : {});
      client.dispose();
    },
  );
  it("requires user review after a changed quote and refuses an expired checkout", async () => {
    const { client } = setup(() => json({ ...payment, revision: "quote-2" }));
    const sdk = vi.fn();
    expect((await paymentFlow(client, sdk).pay(reference, payment)).status).toBe("conflict");
    expect(sdk).not.toHaveBeenCalled();
    client.dispose();
    const expired = setup(() => json({ ...payment, expiresAt: "2020-01-01T00:00:00Z" }));
    expect((await paymentFlow(expired.client, sdk).pay(reference, payment)).status).toBe("expired");
    expect(sdk).not.toHaveBeenCalled();
    expired.client.dispose();
  });
  it("prevents double taps and fences an SDK callback after leaving the app", async () => {
    const { client, transport } = setup();
    let resolve!: (value: unknown) => void;
    const sdk = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const flow = paymentFlow(client, sdk);
    const pending = flow.pay(reference, payment);
    await vi.waitFor(() => expect(sdk).toHaveBeenCalledOnce());
    expect((await flow.pay(reference, payment)).status).toBe("busy");
    flow.dispose();
    resolve(receipt);
    expect((await pending).status).toBe("anonymous");
    expect(transport.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    client.dispose();
  });
  it("passes a live deadline guard to the adapter and reconciles if setup crosses expiry", async () => {
    let now = Date.now();
    const expiring = { ...payment, expiresAt: new Date(now + 1000).toISOString() };
    const { client } = setup((url) =>
      json(
        url.endsWith("reconcile") ? { ...expiring, status: "expired", checkout: null } : expiring,
      ),
    );
    const sdk = vi.fn(async (_checkout, isCurrent: () => boolean) => {
      expect(isCurrent()).toBe(true);
      now += 1001;
      expect(isCurrent()).toBe(false);
      throw new Error("Synthetic SDK setup crossed expiry");
    });
    expect(await paymentFlow(client, sdk, () => now).pay(reference, expiring)).toMatchObject({
      status: "ready",
      data: { status: "expired" },
    });
    client.dispose();
  });
});

describe("booking and consultation membership", () => {
  it("expires holds and denies staff, missing identity/consent/intake and out-of-window joins", () => {
    expect(
      bookingExpired({ ...appointment, status: "held", holdExpiresAt: "2020-01-01T00:00:00Z" }),
    ).toBe(true);
    expect(mayJoin(appointment)).toBe(true);
    for (const value of [
      { ...appointment, role: "staff" as const },
      { ...appointment, identityVerified: false },
      { ...appointment, consentCurrent: false },
      { ...appointment, status: "payment_pending" as const },
      { ...appointment, intake: { ...appointment.intake, status: "handoff" as const } },
    ])
      expect(mayJoin(value)).toBe(false);
    expect(mayJoin(appointment, Date.parse(appointment.endsAt))).toBe(false);
    expect(mayJoin(appointment, Date.parse(appointment.startsAt) - 1)).toBe(false);
  });
  it.each(["foreign", "stale", "expired", "too-long"])(
    "does not start media with a %s grant",
    async (kind) => {
      const bad = {
        ...grant,
        ...(kind === "foreign"
          ? { appointmentId: otherReference }
          : kind === "stale"
            ? { revision: "booking-old" }
            : { expiresAt: kind === "expired" ? "2020-01-01T00:00:00Z" : "2100-01-01T00:00:00Z" }),
      };
      const { client } = setup((url) => json(url.endsWith("video-grants") ? bad : appointment));
      const connect = vi.fn();
      const room = consultationAccess({ client, connect });
      expect((await room.join(reference)).status).toBe("denied");
      expect(connect).not.toHaveBeenCalled();
      room.dispose();
      client.dispose();
    },
  );
  it("closes delayed media after navigation and does not report a local preview as a call", async () => {
    const { client } = setup((url) => json(url.endsWith("video-grants") ? grant : appointment));
    let resolve!: (connection: { close(): void }) => void;
    const connect = vi.fn(
      () =>
        new Promise<{ close(): void }>((done) => {
          resolve = done;
        }),
    );
    const room = consultationAccess({ client, connect });
    const pending = room.join(reference);
    await vi.waitFor(() => expect(connect).toHaveBeenCalledOnce());
    const close = vi.fn();
    room.leave();
    resolve({ close });
    expect((await pending).status).toBe("expired");
    expect(close).toHaveBeenCalledOnce();
    room.dispose();
    client.dispose();
  });
  it("closes a private transport at the membership deadline", async () => {
    vi.useFakeTimers();
    const deadline = new Date(Date.now() + 1000).toISOString();
    const { client } = setup((url) =>
      json(url.endsWith("video-grants") ? { ...grant, expiresAt: deadline } : appointment),
    );
    const close = vi.fn();
    const room = consultationAccess({ client, connect: async () => ({ close }) });
    expect((await room.join(reference)).status).toBe("ready");
    await vi.advanceTimersByTimeAsync(1001);
    expect(close).toHaveBeenCalledOnce();
    room.dispose();
    client.dispose();
  });
  it("passes unknown/declined intake dispositions for approved server clarification without diagnosing", async () => {
    const { client, transport } = setup(() =>
      json({ ...appointment, intake: { ...appointment.intake, status: "handoff" } }),
    );
    const answers = [
      { id: "age" as const, value: "unknown", disposition: "unknown" as const },
      { id: "medication" as const, value: "declined", disposition: "declined" as const },
    ];
    expect(
      await client.submitIntake(reference, {
        revision: appointment.revision,
        policyVersion: appointment.intake.policyVersion,
        answers,
      }),
    ).toMatchObject({ status: "ready", data: { intake: { status: "handoff" } } });
    expect(JSON.parse(String(transport.mock.calls.at(-1)?.[1]?.body)).answers).toEqual(answers);
    client.dispose();
  });
});

import type { TestFetch } from "../fixtures/fetch";
