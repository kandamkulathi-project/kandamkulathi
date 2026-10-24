import { expect, it, vi } from "vitest";
import { registerTranscriptionRoutes } from "../../apps/core-api/src/transcription";
import { createTranscriptionProvider } from "../../packages/providers/src/transcription";
import { createService } from "../../packages/server/src/index";
import {
  transcriptionBindings,
  transcriptionInput,
  transcriptionRuntimeFixture,
} from "../fixtures/transcription";

it("HTTP admission is fail-closed; actual provider adapter returns review-only text and rechecks current privacy", async () => {
  const { runtime, fixture } = transcriptionRuntimeFixture();
  const transport = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
    Response.json({ text: "Synthetic text" }),
  );
  const provider = createTranscriptionProvider(transcriptionBindings, transport);
  const app = createService("core-api", () => {}, {
    registerRoutes: (app) => registerTranscriptionRoutes(app, runtime, provider),
  });
  const request = (body: unknown = transcriptionInput(), extra: Record<string, string> = {}) =>
    app.request(
      "/v1/transcription",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer n1_synthetic",
          "Content-Type": "application/json",
          ...extra,
        },
        body: JSON.stringify(body),
      },
      { APP_ENV: "local" },
    );
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "review", text: "Synthetic text" });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect((await request({}, { cookie: "session=private" })).status).toBe(403);
  expect((await request({}, { origin: "https://untrusted.test" })).status).toBe(403);
  expect((await request({ ...transcriptionInput(), action: "send" })).status).toBe(400);
  expect(
    (
      await app.request(
        "/v1/transcription",
        {
          method: "POST",
          headers: { Authorization: "Bearer n1_synthetic", "Content-Type": "application/json" },
          body: "{",
        },
        { APP_ENV: "local" },
      )
    ).status,
  ).toBe(400);
  expect((await request({ ...transcriptionInput(), processingPolicyVersion: "old" })).status).toBe(
    403,
  );
  fixture.authority.consents = [];
  expect((await request()).status).toBe(403);
  expect(transport).toHaveBeenCalledTimes(1);
  const { fixture: fresh } = transcriptionRuntimeFixture();
  fixture.authority.consents = fresh.authority.consents;
  transport.mockImplementationOnce(async () => {
    fixture.authority.sessionRevokedAt = "2026-10-23T09:30:00.000Z";
    return Response.json({ text: "Must not escape" });
  });
  const revoked = await request();
  expect(revoked.status).toBe(401);
  expect(await revoked.text()).not.toContain("Must not escape");
  runtime.dependencies.verifySession = async () => ({ status: "unavailable" });
  expect((await request()).status).toBe(503);
  runtime.dependencies.verifySession = async () => ({ status: "unauthenticated" });
  expect((await request()).status).toBe(401);
  const unconfigured = createService("core-api", () => {}, {
    registerRoutes: (app) =>
      registerTranscriptionRoutes(app, runtime, createTranscriptionProvider({})),
  });
  expect(
    (
      await unconfigured.request(
        "/v1/transcription",
        { method: "POST", headers: { Authorization: "Bearer n1_synthetic" } },
        { APP_ENV: "local" },
      )
    ).status,
  ).toBe(503);
  expect((await request({ ...transcriptionInput(), audio: "x".repeat(66000) })).status).toBe(413);
});
