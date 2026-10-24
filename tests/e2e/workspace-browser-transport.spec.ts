import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Uses the existing test-only Vite harness, not a production entry point.
const moduleURL = `http://127.0.0.1:5184/@fs/${fileURLToPath(new URL("../../apps/workspaces/src/browserTransport.ts", import.meta.url))}`;
const userId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const csrfToken = "synthetic_csrf_fixture_01234567890123456789";

test.describe("browser cookie and CSRF transport over real loopback HTTP", () => {
  let server: Server;
  let origin: string;
  let mode: "valid" | "wrong-actor" | "expired" | "late";
  let contexts: number;
  let receipts: { cookie: boolean; csrf: boolean; operation: boolean; body: boolean }[];
  let release: (() => void) | undefined;

  test.beforeEach(async ({ page }) => {
    contexts = 0;
    receipts = [];
    mode = "valid";
    release = undefined;
    server = createServer(async (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      if (request.url === "/") {
        response.setHeader("Content-Type", "text/html");
        response.setHeader(
          "Set-Cookie",
          "synthetic_session=loopback; HttpOnly; SameSite=Lax; Path=/",
        );
        response.end("<!doctype html><title>Synthetic transport fixture</title>");
      } else if (request.url === "/v1/security/context") {
        contexts++;
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify({
            userId: mode === "wrong-actor" ? sessionId : userId,
            sessionId,
            expiresAt: new Date(Date.now() + (mode === "expired" ? -1000 : 30000)).toISOString(),
            csrfToken,
          }),
        );
      } else if (request.url === "/v1/orders" && request.method === "POST") {
        let body = "";
        for await (const chunk of request) body += String(chunk);
        receipts.push({
          cookie: request.headers.cookie === "synthetic_session=loopback",
          csrf: request.headers["x-csrf-token"] === csrfToken,
          operation: request.headers["idempotency-key"] === "caller-operation",
          body: body === '{"value":1}',
        });
        const finish = () => {
          if (response.headersSent || response.destroyed) return;
          response.writeHead(409);
          response.end("synthetic conflict");
        };
        if (mode === "late") release = finish;
        else finish();
      } else {
        response.writeHead(404);
        response.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No loopback address");
    origin = `http://127.0.0.1:${address.port}`;
    await page.goto(origin);
  });
  test.afterEach(async () => {
    release?.();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  test("real cookie, fresh CSRF and original conflict response; no automatic mutation retry", async ({
    page,
  }) => {
    const result = await page.evaluate(
      async ({ moduleURL, origin, userId }) => {
        const { createWorkspaceBrowserTransport } = (await import(
          moduleURL
        )) as typeof import("../../apps/workspaces/src/browserTransport");
        const client = createWorkspaceBrowserTransport({
          origin,
          local: true,
          session: {
            userId,
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            workspaces: [],
          },
          active: () => true,
          onRevoked: () => {},
        });
        try {
          const statuses: number[] = [];
          for (let i = 0; i < 2; i++) {
            const headers = new Headers(
              await client.authorizeMutation(new AbortController().signal),
            );
            headers.set("Content-Type", "application/json");
            headers.set("Idempotency-Key", "caller-operation");
            const response = await client.transport(`${origin}/v1/orders`, {
              method: "POST",
              headers,
              body: '{"value":1}',
            });
            statuses.push(response.status);
          }
          return statuses;
        } finally {
          client.dispose();
        }
      },
      { moduleURL, origin, userId },
    );
    expect(result).toEqual([409, 409]);
    expect(contexts).toBe(2);
    expect(receipts).toEqual(
      Array.from({ length: 2 }, () => ({ cookie: true, csrf: true, operation: true, body: true })),
    );
  });

  for (const invalid of ["wrong-actor", "expired"] as const) {
    test(`${invalid} context blocks the real mutation`, async ({ page }) => {
      mode = invalid;
      const denied = await page.evaluate(
        async ({ moduleURL, origin, userId }) => {
          const { createWorkspaceBrowserTransport } = (await import(
            moduleURL
          )) as typeof import("../../apps/workspaces/src/browserTransport");
          const client = createWorkspaceBrowserTransport({
            origin,
            local: true,
            session: {
              userId,
              expiresAt: new Date(Date.now() + 60000).toISOString(),
              workspaces: [],
            },
            active: () => true,
            onRevoked: () => {},
          });
          try {
            await client.transport(`${origin}/v1/orders`, { method: "POST" });
            return false;
          } catch {
            return true;
          } finally {
            client.dispose();
          }
        },
        { moduleURL, origin, userId },
      );
      expect(denied).toBe(true);
      expect(contexts).toBe(1);
      expect(receipts).toHaveLength(0);
    });
  }

  test("dispose aborts a pending real mutation and never exposes a late response", async ({
    page,
  }) => {
    mode = "late";
    const result = page.evaluate(
      async ({ moduleURL, origin, userId }) => {
        const { createWorkspaceBrowserTransport } = (await import(
          moduleURL
        )) as typeof import("../../apps/workspaces/src/browserTransport");
        const client = createWorkspaceBrowserTransport({
          origin,
          local: true,
          session: {
            userId,
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            workspaces: [],
          },
          active: () => true,
          onRevoked: () => {},
        });
        // Test-only event signals disposal from Node after the server receives the POST.
        window.addEventListener("dispose-transport", client.dispose, { once: true });
        try {
          await client.transport(`${origin}/v1/orders`, { method: "POST", body: '{"value":1}' });
          return "response";
        } catch (error) {
          return error instanceof DOMException ? error.name : "error";
        } finally {
          client.dispose();
          window.removeEventListener("dispose-transport", client.dispose);
        }
      },
      { moduleURL, origin, userId },
    );
    await expect.poll(() => receipts.length).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event("dispose-transport")));
    release?.();
    expect(await result).toBe("AbortError");
    expect(contexts).toBe(1);
    expect(receipts).toHaveLength(1);
  });
});
