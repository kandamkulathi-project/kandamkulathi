import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { loadPublicKnowledge } from "../../packages/client/src/public-knowledge";
import { publicKnowledgeInput, publicKnowledgeReply } from "../fixtures/public-knowledge";

test("canonical client traverses a real synthetic HTTP boundary and drops content after current-state denial", async () => {
  let calls = 0;
  let mode: "ready" | "blocked" | "not-ready" = "ready";
  const server = createServer(async (request, response) => {
    calls++;
    expect(request.url).toBe("/v1/knowledge/public-product");
    expect(request.method).toBe("POST");
    expect(request.headers.cookie).toBeUndefined();
    expect(request.headers.authorization).toBeUndefined();
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(publicKnowledgeInput);
    response.writeHead(mode === "ready" ? 200 : mode === "blocked" ? 409 : 503, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(
      JSON.stringify(
        mode === "ready"
          ? publicKnowledgeReply
          : mode === "blocked"
            ? { status: "blocked", reason: "CURRENT_STATE_CHANGED" }
            : { status: "not-ready", reason: "NOT_CONFIGURED" },
      ),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Synthetic HTTP fixture failed");
    const run = () =>
      loadPublicKnowledge({
        origin: `http://127.0.0.1:${address.port}`,
        local: true,
        input: publicKnowledgeInput,
        signal: new AbortController().signal,
      });
    expect((await run()).status).toBe("ready");
    mode = "blocked";
    expect(await run()).toEqual({ status: "blocked", reason: "CURRENT_STATE_CHANGED" });
    mode = "not-ready";
    expect(await run()).toEqual({ status: "not-ready", reason: "NOT_CONFIGURED" });
    expect(calls).toBe(3);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
