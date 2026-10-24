import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { nativeCompanionOperations } from "../../apps/mobile/src/companionOperations";
import { sensitiveClient } from "../../packages/client/src/sensitive";
import { reply } from "../fixtures/knowledge";
import { context, reference, session } from "../fixtures/sensitive";

test("native controller journey: lost acknowledgements replay once, later identical actions are new", async () => {
  // Real loopback HTTP and the production native controller/client, synthetic API only.
  // No page/device fixture: this is NOT native SDK, installed-device or provider proof.
  const effects = new Map<string, string>();
  const attempts: { route: string; id: string; body: string }[] = [];
  let loseAcknowledgement = true;
  let deny = false;
  const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/v1/security/context") {
      response.end(JSON.stringify(context));
      return;
    }
    if (request.headers["x-csrf-token"] !== context.csrfToken) {
      response.writeHead(403).end("{}");
      return;
    }
    const route = request.url ?? "";
    if (!["/v1/chat/replies", "/v1/support/handoffs"].includes(route)) {
      response.writeHead(404).end("{}");
      return;
    }
    const id = String(request.headers["idempotency-key"]);
    let body = "";
    for await (const chunk of request) body += chunk.toString();
    attempts.push({ route, id, body });
    if (deny) {
      response.writeHead(403).end("{}");
      return;
    }
    const previous = effects.get(id);
    if (previous && previous !== `${route}:${body}`) {
      response.writeHead(409).end("{}");
      return;
    }
    effects.set(id, `${route}:${body}`);
    if (loseAcknowledgement) {
      loseAcknowledgement = false;
      response.destroy(); // The synthetic effect committed, but the caller cannot know it.
      return;
    }
    response.end(
      JSON.stringify(route === "/v1/chat/replies" ? reply : { id: reference, status: "queued" }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Loopback server unavailable");
  const client = sensitiveClient({
    origin: `http://127.0.0.1:${address.port}`,
    local: true,
    session,
  });
  const operations = nativeCompanionOperations(client, randomUUID);
  try {
    expect(await operations.send("Synthetic question", "en")).toEqual({ status: "unknown" });
    expect((await operations.send("Synthetic question", "en")).status).toBe("ready");
    expect(effects.size).toBe(1);
    expect(attempts[0]).toEqual(attempts[1]);
    expect((await operations.send("Synthetic question", "en")).status).toBe("ready");
    expect(effects.size).toBe(2);
    expect(attempts[2]?.id).not.toBe(attempts[0]?.id);

    loseAcknowledgement = true;
    expect(await operations.requestHandoff("en")).toEqual({ status: "unknown" });
    expect((await operations.requestHandoff("en")).status).toBe("ready");
    expect(effects.size).toBe(3);
    expect(attempts[3]).toEqual(attempts[4]);
    expect((await operations.requestHandoff("en")).status).toBe("ready");
    expect(effects.size).toBe(4);
    expect(attempts[5]?.id).not.toBe(attempts[3]?.id);

    deny = true;
    expect(await operations.send("Denied question", "en")).toEqual({ status: "denied" });
    expect(await operations.requestHandoff("ta")).toEqual({ status: "denied" });
    expect(effects.size).toBe(4);
    deny = false;
    expect((await operations.send("Denied question", "en")).status).toBe("ready");
    expect((await operations.requestHandoff("ta")).status).toBe("ready");
    expect(attempts[6]?.id).not.toBe(attempts[8]?.id);
    expect(attempts[7]?.id).not.toBe(attempts[9]?.id);
    expect(effects.size).toBe(6);

    const count = attempts.length;
    expect(await operations.send("", "en")).toEqual({ status: "error" });
    expect(attempts).toHaveLength(count);
    client.dispose();
    expect(await operations.send("Synthetic question", "en")).toEqual({ status: "anonymous" });
    expect(await operations.requestHandoff("en")).toEqual({ status: "anonymous" });
    expect(attempts).toHaveLength(count);
  } finally {
    client.dispose();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
