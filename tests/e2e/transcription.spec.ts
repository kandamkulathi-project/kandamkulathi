import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { registerTranscriptionRoutes } from "../../apps/core-api/src/transcription";
import { nativeTranscription } from "../../apps/mobile/src/transcription";
import {
  createTranscriptionProvider,
  transcriptionEndpoint,
} from "../../packages/providers/src/transcription";
import { createService } from "../../packages/server/src/index";
import {
  transcriptionBindings,
  transcriptionInput,
  transcriptionRuntimeFixture,
} from "../fixtures/transcription";

test("bounded native controller → real Core HTTP → provider adapter → editable review, never Companion send", async () => {
  // Synthetic capture/identity/provider response. Real loopback HTTP and production controllers.
  // This does NOT establish real AAC decoding, PostgreSQL, provider or supported-device proof.
  const { runtime, fixture } = transcriptionRuntimeFixture();
  let providerCalls = 0;
  const provider = createTranscriptionProvider(transcriptionBindings, async (url) => {
    expect(url).toBe(transcriptionEndpoint);
    providerCalls++;
    return Response.json({ text: "Synthetic editable text" });
  });
  const app = createService("core-api", () => {}, {
    registerRoutes: (app) => registerTranscriptionRoutes(app, runtime, provider),
  });
  const paths: string[] = [];
  const server = createServer(async (incoming, outgoing) => {
    const parts: Buffer[] = [];
    for await (const chunk of incoming) parts.push(Buffer.from(chunk));
    paths.push(incoming.url ?? "");
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers))
      if (typeof value === "string") headers.set(name, value);
    const response = await app.request(
      incoming.url ?? "/",
      { method: incoming.method ?? "POST", headers, body: Buffer.concat(parts) },
      { APP_ENV: "local" },
    );
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Loopback unavailable");
  let draft = "";
  let state = "idle";
  let discarded = 0;
  const controller = nativeTranscription({
    origin: `http://127.0.0.1:${address.port}`,
    local: true,
    current: () => true,
    credential: () => "n1_synthetic",
    changed: (value) => {
      state = value;
    },
    review: (text) => {
      draft = text;
    },
    capture: {
      permission: async () => true,
      prepare: async () => {},
      record: () => {},
      stop: async () => {},
      encoded: async () => transcriptionInput().audio,
      discard: async () => {
        discarded++;
      },
    },
  });
  try {
    await controller.start();
    await controller.stop();
    expect(paths).toEqual([]);
    await controller.transcribe("synthetic-policy-only");
    expect(state).toBe("review");
    expect(draft).toBe("Synthetic editable text");
    draft = "User corrected draft";
    expect(draft).toBe("User corrected draft");
    expect(paths).toEqual(["/v1/transcription"]);
    expect(providerCalls).toBe(1);
    expect(discarded).toBe(1);
    await controller.transcribe("synthetic-policy-only");
    expect(providerCalls).toBe(1);
    fixture.authority.consents = [];
    await controller.start();
    await controller.stop();
    await controller.transcribe("synthetic-policy-only");
    expect(state).toBe("denied");
    expect(providerCalls).toBe(1);
    expect(draft).toBe("User corrected draft");
  } finally {
    await controller.invalidate();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
