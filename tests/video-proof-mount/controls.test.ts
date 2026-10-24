import { afterEach, expect, it, vi } from "vitest";
import {
  type ProofOwner,
  type ProofSnapshot,
  videoProofControls,
} from "../../packages/client/src/video-proof-controls";
import {
  invitedVideoSignaling,
  readVideoProofInvitation,
} from "../../packages/client/src/video-proof-invitation";
import { ports } from "../video-proof/fixtures";
import { endpoint, grant, invitation, membership, now, rawInvitation } from "./fixtures";

afterEach(() => vi.useRealTimers());
it("loads immutable metadata, consumes once on explicit join, no credentials in render snapshots", async () => {
  const snapshots: ProofSnapshot[] = [];
  const connect = vi.fn(async () => ({ close: vi.fn() })),
    dispose = vi.fn();
  const controls = videoProofControls({
    endpoint,
    now: () => now,
    onChange: (snapshot) => snapshots.push(snapshot),
    onClear: vi.fn(),
    create: () => ({ connect, dispose }),
  });
  controls.load(rawInvitation);
  expect(snapshots.at(-1)).toMatchObject({
    state: "armed",
    participantId: membership.participantId,
  });
  expect(connect).not.toHaveBeenCalled();
  await Promise.all([controls.start(), controls.start()]);
  expect(connect).toHaveBeenCalledOnce();
  expect(JSON.stringify(snapshots)).not.toContain(grant.ticket);
  controls.stop();
  await controls.start();
  expect(connect).toHaveBeenCalledOnce();
  expect(dispose).toHaveBeenCalledOnce();
  controls.dispose();
  const parsed = readVideoProofInvitation(rawInvitation, endpoint, now);
  expect(Object.isFrozen(parsed)).toBe(true);
  expect(Object.isFrozen(parsed.member)).toBe(true);
});

it("stop/background during lazy SDK renderer import disposes late owner and never connects", async () => {
  let complete!: (owner: ProofOwner) => void;
  const late = { connect: vi.fn(), dispose: vi.fn() };
  const changed = vi.fn(),
    clear = vi.fn();
  const controls = videoProofControls({
    endpoint,
    now: () => now,
    onChange: changed,
    onClear: clear,
    create: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  });
  controls.load(rawInvitation);
  const joining = controls.start();
  controls.stop();
  complete(late);
  await joining;
  expect(late.dispose).toHaveBeenCalledOnce();
  expect(late.connect).not.toHaveBeenCalled();
  const calls = changed.mock.calls.length;
  controls.dispose();
  expect(changed.mock.calls).toHaveLength(calls);
});

it("invalid/expired/wrong-endpoint invitation never creates an SDK owner", async () => {
  const create = vi.fn();
  const controls = videoProofControls({
    endpoint,
    create,
    now: () => now,
    onChange: vi.fn(),
    onClear: vi.fn(),
  });
  for (const raw of [
    "{}",
    rawInvitation.replace(endpoint, "https://other.test/p1-private-video-proof"),
    JSON.stringify({ ...invitation, purpose: "clinical" }),
    JSON.stringify({ ...invitation, patientName: "not permitted" }),
    JSON.stringify({ ...invitation, member: { ...invitation.member, expiresAt: now } }),
  ]) {
    controls.load(raw);
    await controls.start();
  }
  expect(create).not.toHaveBeenCalled();
  controls.dispose();
});

it("armed invitation expires without camera access", async () => {
  vi.useFakeTimers();
  const create = vi.fn(),
    onChange = vi.fn();
  const controls = videoProofControls({
    endpoint,
    create,
    now: () => now,
    onChange,
    onClear: vi.fn(),
  });
  controls.load(rawInvitation);
  await vi.advanceTimersByTimeAsync(60000);
  await controls.start();
  expect(create).not.toHaveBeenCalled();
  expect(onChange).toHaveBeenLastCalledWith({ state: "unavailable" });
  controls.dispose();
});

it("a stalled native renderer import is bounded and cannot later start media", async () => {
  vi.useFakeTimers();
  let complete!: (owner: ProofOwner) => void;
  const late = { connect: vi.fn(), dispose: vi.fn() },
    changed = vi.fn();
  const controls = videoProofControls({
    endpoint,
    now: () => now,
    onChange: changed,
    onClear: vi.fn(),
    create: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  });
  controls.load(rawInvitation);
  const pending = controls.start();
  await vi.advanceTimersByTimeAsync(30000);
  expect(changed).toHaveBeenLastCalledWith({ state: "unavailable" });
  complete(late);
  await pending;
  expect(late.connect).not.toHaveBeenCalled();
  expect(late.dispose).toHaveBeenCalledOnce();
  controls.dispose();
});

it.each(["peerId", "connectionId", "role", "notBefore", "expiresAt"] as const)(
  "server %s mismatch closes signaling before media capture",
  async (field) => {
    const p = ports();
    p.session.membership = {
      ...membership,
      [field]:
        field === "role"
          ? "answerer"
          : field === "notBefore"
            ? now - 2000
            : field === "expiresAt"
              ? now + 59000
              : "different",
    };
    const expected = readVideoProofInvitation(rawInvitation, endpoint, now);
    const signaling = invitedVideoSignaling(expected, () => now, { open: async () => p.session });
    await expect(signaling.open(grant, new AbortController().signal)).rejects.toThrow();
    expect(p.session.close).toHaveBeenCalledOnce();
    expect(p.sdk.capture).not.toHaveBeenCalled();
  },
);
