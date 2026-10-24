import { expect, it, vi } from "vitest";
import { nativeTranscription, type TranscriptionState } from "../../apps/mobile/src/transcription";
import { validateTranscriptionAudio } from "../../packages/contracts/src/transcription";
import {
  createTranscriptionProvider,
  transcriptionEndpoint,
  transcriptionModel,
} from "../../packages/providers/src/transcription";
import {
  syntheticTranscriptionAudio,
  transcriptionBindings,
  transcriptionInput,
} from "../fixtures/transcription";

it("bounds audio bytes, source timing, encoding and provider configuration", async () => {
  expect(validateTranscriptionAudio(syntheticTranscriptionAudio())).toBe(1000);
  for (const bytes of [
    syntheticTranscriptionAudio(15001),
    new Uint8Array(48001),
    new Uint8Array(50),
    syntheticTranscriptionAudio().subarray(1),
  ])
    expect(() => validateTranscriptionAudio(bytes)).toThrow();
  const transport = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
  for (const bindings of [
    {},
    { ...transcriptionBindings, TRANSCRIPTION_PROCESSING_APPROVED: "false" },
  ]) {
    expect(
      await createTranscriptionProvider(bindings, transport).transcribe(
        syntheticTranscriptionAudio(),
        new AbortController().signal,
      ),
    ).toEqual({ status: "not-configured" });
  }
  expect(transport).not.toHaveBeenCalled();
});

it("uses the exact approved endpoint/model without redirects, caps streamed responses and never retries", async () => {
  const transport = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (url, init) => {
      expect(url).toBe(transcriptionEndpoint);
      expect(init?.redirect).toBe("error");
      if (!(init?.body instanceof FormData)) throw new Error("Expected multipart upload");
      expect(init.body.get("model")).toBe(transcriptionModel);
      return Response.json({ text: "Synthetic review text" });
    });
  const provider = createTranscriptionProvider(transcriptionBindings, transport);
  const run = () =>
    provider.transcribe(syntheticTranscriptionAudio(), new AbortController().signal);
  expect(await run()).toEqual({ status: "review", text: "Synthetic review text" });
  transport.mockResolvedValueOnce(new Response(null, { status: 429 }));
  expect(await run()).toEqual({ status: "rate-limited" });
  transport.mockResolvedValueOnce(Response.json({ text: "" }));
  expect(await run()).toEqual({ status: "empty" });
  transport.mockResolvedValueOnce(Response.json({ text: "x".repeat(25000) }));
  expect(await run()).toEqual({ status: "unknown" });
  transport.mockRejectedValueOnce(new Error("private-provider-detail"));
  expect(await run()).toEqual({ status: "unknown" });
  expect(transport).toHaveBeenCalledTimes(5);
  const abort = new AbortController();
  abort.abort();
  expect(await provider.transcribe(syntheticTranscriptionAudio(), abort.signal)).toEqual({
    status: "unknown",
  });
  expect(transport).toHaveBeenCalledTimes(5);
});

it.each([
  [400, "invalid"],
  [413, "invalid"],
  [415, "invalid"],
  [401, "not-configured"],
  [403, "not-configured"],
  [429, "rate-limited"],
] as const)(
  "treats explicit provider HTTP %i rejection as terminal %s without reading private errors or retrying",
  async (status, result) => {
    const cancel = vi.fn();
    const transport = vi.fn(async () => new Response(new ReadableStream({ cancel }), { status }));
    const provider = createTranscriptionProvider(transcriptionBindings, transport);
    expect(
      await provider.transcribe(syntheticTranscriptionAudio(), new AbortController().signal),
    ).toEqual({ status: result });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledTimes(1);
  },
);

it.each([404, 408, 409, 422, 500, 502, 503, 504])(
  "keeps unmapped provider HTTP %i uncertain without retrying",
  async (status) => {
    const transport = vi.fn(async () => new Response(null, { status }));
    expect(
      await createTranscriptionProvider(transcriptionBindings, transport).transcribe(
        syntheticTranscriptionAudio(),
        new AbortController().signal,
      ),
    ).toEqual({ status: "unknown" });
    expect(transport).toHaveBeenCalledTimes(1);
  },
);

it.each(["not-json", '{"text":123}', '{"error":"synthetic"}'])(
  "keeps invalid successful provider body %s uncertain",
  async (body) => {
    const transport = vi.fn(
      async () => new Response(body, { headers: { "Content-Type": "application/json" } }),
    );
    expect(
      await createTranscriptionProvider(transcriptionBindings, transport).transcribe(
        syntheticTranscriptionAudio(),
        new AbortController().signal,
      ),
    ).toEqual({ status: "unknown" });
    expect(transport).toHaveBeenCalledTimes(1);
  },
);

it("requires an explicit upload action, fences late text, and does not replay unknown uploads", async () => {
  const capture = {
    permission: vi.fn(async () => true),
    prepare: vi.fn(async () => {}),
    record: vi.fn(),
    stop: vi.fn(async () => {}),
    encoded: vi.fn(async () => transcriptionInput().audio),
    discard: vi.fn(async () => {}),
  };
  const review = vi.fn();
  const changed = vi.fn();
  let complete!: (response: Response) => void;
  const transport = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const controller = nativeTranscription({
    origin: "http://127.0.0.1:8787",
    local: true,
    capture,
    current: () => true,
    credential: () => "n1_synthetic",
    review,
    changed,
    transport,
  });
  await controller.start();
  await controller.stop();
  expect(transport).not.toHaveBeenCalled();
  const upload = controller.transcribe("synthetic-policy-only");
  await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
  await controller.invalidate();
  complete(Response.json({ status: "review", text: "Late private text" }));
  await upload;
  expect(review).not.toHaveBeenCalled();
  expect(capture.discard).toHaveBeenCalled();
  await controller.transcribe("synthetic-policy-only");
  expect(transport).toHaveBeenCalledTimes(1);
});

it("aborts a stalled provider request after the bounded timeout without retrying", async () => {
  vi.useFakeTimers();
  try {
    const transport = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")), {
            once: true,
          });
        }),
    );
    const result = createTranscriptionProvider(transcriptionBindings, transport).transcribe(
      syntheticTranscriptionAudio(),
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(20000);
    expect(await result).toEqual({ status: "unknown" });
    expect(transport).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function lifecycle() {
  const capture = {
    permission: vi.fn(async () => true),
    prepare: vi.fn(async () => {}),
    record: vi.fn(),
    stop: vi.fn(async () => {}),
    encoded: vi.fn(async () => transcriptionInput().audio),
    discard: vi.fn(async () => {}),
  };
  const states: TranscriptionState[] = [];
  let current = true;
  const controller = nativeTranscription({
    origin: "http://127.0.0.1:8787",
    local: true,
    capture,
    current: () => current,
    credential: () => "n1_synthetic",
    changed: (state) => states.push(state),
    review: vi.fn(),
  });
  return {
    capture,
    states,
    controller,
    unmount: () => {
      current = false;
    },
  };
}

it("drains invalidation after a pending stop rejects, without deleting an active recording", async () => {
  const { capture, states, controller } = lifecycle();
  const first = deferred();
  const retry = deferred();
  capture.stop.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
  await controller.start();
  const stopping = controller.stop();
  await controller.invalidate();
  expect(capture.stop).toHaveBeenCalledTimes(1);
  expect(capture.discard).not.toHaveBeenCalled();
  first.reject(new Error("Native stop failed"));
  await vi.waitFor(() => expect(capture.stop).toHaveBeenCalledTimes(2));
  expect(states.at(-1)).toBe("cleaning");
  expect(states).not.toContain("idle");
  expect(capture.discard).not.toHaveBeenCalled();
  retry.resolve();
  await stopping;
  expect(capture.discard).toHaveBeenCalledTimes(1);
  expect(states.at(-1)).toBe("idle");
});

it("retains failed stop cleanup and blocks preparation until an explicit retry succeeds", async () => {
  const { capture, states, controller } = lifecycle();
  capture.stop.mockRejectedValue(new Error("Still active"));
  await controller.start();
  // Repeated start must not replace an actively recorded clip.
  await controller.start();
  expect(capture.prepare).toHaveBeenCalledTimes(1);
  await controller.stop();
  expect(capture.stop).toHaveBeenCalledTimes(2);
  expect(capture.discard).not.toHaveBeenCalled();
  expect(states.at(-1)).toBe("cleanup-error");
  await controller.start();
  expect(capture.prepare).toHaveBeenCalledTimes(1);
  expect(states.at(-1)).toBe("cleanup-error");
  capture.stop.mockResolvedValue(undefined);
  await controller.start();
  expect(capture.discard).toHaveBeenCalledTimes(1);
  expect(capture.prepare).toHaveBeenCalledTimes(2);
  await controller.invalidate();
});

it("cleans partial prepare failure and retains a failing discard for explicit retry", async () => {
  const { capture, states, controller } = lifecycle();
  capture.prepare.mockRejectedValueOnce(new Error("Partial preparation"));
  capture.discard.mockRejectedValue(new Error("File locked"));
  await controller.start();
  expect(capture.stop).toHaveBeenCalledTimes(1);
  expect(capture.record).not.toHaveBeenCalled();
  expect(states.at(-1)).toBe("cleanup-error");
  await controller.start();
  expect(capture.stop).toHaveBeenCalledTimes(1);
  expect(capture.prepare).toHaveBeenCalledTimes(1);
  expect(capture.discard).toHaveBeenCalledTimes(2);
  expect(states).not.toContain("idle");
  capture.discard.mockResolvedValue(undefined);
  await controller.start();
  expect(capture.prepare).toHaveBeenCalledTimes(2);
  await controller.invalidate();
});

it("keeps preparation failure visible after successful cleanup", async () => {
  const { capture, states, controller } = lifecycle();
  capture.prepare.mockRejectedValueOnce(new Error("Partial preparation"));
  await controller.start();
  expect(capture.stop).toHaveBeenCalledTimes(1);
  expect(capture.discard).toHaveBeenCalledTimes(1);
  expect(capture.record).not.toHaveBeenCalled();
  expect(states.at(-1)).toBe("unknown");
});

it("drains invalidation after a pending prepare rejects even when no longer current", async () => {
  const { capture, states, controller, unmount } = lifecycle();
  const preparation = deferred();
  capture.prepare.mockReturnValueOnce(preparation.promise);
  const starting = controller.start();
  await vi.waitFor(() => expect(capture.prepare).toHaveBeenCalledTimes(1));
  unmount();
  await controller.invalidate();
  expect(capture.stop).not.toHaveBeenCalled();
  preparation.reject(new Error("Preparation failed"));
  await starting;
  expect(capture.record).not.toHaveBeenCalled();
  expect(capture.stop).toHaveBeenCalledTimes(1);
  expect(capture.discard).toHaveBeenCalledTimes(1);
  expect(states.at(-1)).toBe("idle");
});

it("awaits unmount disposal, retains failure for a bounded retry, and never starts again", async () => {
  const { capture, states, controller, unmount } = lifecycle();
  const pending = deferred();
  capture.stop
    .mockReturnValueOnce(pending.promise)
    .mockRejectedValueOnce(new Error("Still active"));
  await controller.start();
  const stopping = controller.stop();
  unmount();
  let settled = false;
  const disposal = controller.dispose().then((result) => {
    settled = true;
    return result;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  pending.reject(new Error("Stop failed"));
  await stopping;
  expect(await disposal).toBe(false);
  expect(states.at(-1)).toBe("cleanup-error");
  expect(capture.discard).not.toHaveBeenCalled();
  expect(capture.stop).toHaveBeenCalledTimes(2);
  expect(await controller.dispose()).toBe(true);
  expect(capture.discard).toHaveBeenCalledTimes(1);
  expect(states.at(-1)).toBe("idle");
  await controller.start();
  expect(capture.prepare).toHaveBeenCalledTimes(1);
});
