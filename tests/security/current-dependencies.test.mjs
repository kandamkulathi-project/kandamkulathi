import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, it } from "node:test";

const mobile = createRequire(new URL("../../apps/mobile/package.json", import.meta.url));
const expo = createRequire(mobile.resolve("expo/package.json"));
const cli = createRequire(expo.resolve("@expo/cli/package.json"));
const { z } = cli("zod");
const api = createRequire(new URL("../../apps/companion/package.json", import.meta.url));
const wrangler = createRequire(api.resolve("wrangler/package.json"));
const miniflare = createRequire(wrangler.resolve("miniflare/package.json"));
const undici = miniflare("undici");
const web = createRequire(new URL("../../apps/web-public/package.json", import.meta.url));
const check = createRequire(web.resolve("@astrojs/check"));
const language = createRequire(check.resolve("@astrojs/language-server/package.json"));
const yaml = createRequire(language.resolve("volar-service-yaml/package.json"));
const yamlServer = createRequire(yaml.resolve("yaml-language-server/package.json"));
const ajv = createRequire(yamlServer.resolve("ajv/package.json"));
const uri = ajv("fast-uri");

describe("current registry fixes through actual parent-resolved dependencies", () => {
  it("bounds oversized Zod collections before parsing their elements", () => {
    assert.equal(cli("zod/package.json").version, "4.6.6");
    let visited = 0;
    const element = z.string().superRefine(() => visited++);
    for (const [schema, input] of [
      [z.array(element).max(2), ["a", "b", "c"]],
      [z.set(element).max(2), new Set(["a", "b", "c"])],
      [
        z.map(element, element).max(2),
        new Map([
          ["a", "a"],
          ["b", "b"],
          ["c", "c"],
        ]),
      ],
    ]) {
      const result = schema.safeParse(input);
      assert.equal(result.success, false);
      assert.equal(result.error.issues.length, 1);
      assert.equal(result.error.issues[0].code, "too_big");
    }
    assert.equal(visited, 0);
    assert.deepEqual(z.array(element).max(2).parse(["valid"]), ["valid"]);
    assert.equal(visited, 1);
  });

  it("preserves Expo CLI plugin validation and strict MCP command schemas across Zod majors", () => {
    const base = join(cli.resolve("@expo/cli/package.json"), "..", "build/src/start/server");
    const { PluginSchema, DevToolsPluginOutputSchema } = cli(
      join(base, "DevToolsPlugin.schema.js"),
    );
    const { createMCPDevToolsExtensionSchema } = cli(
      join(base, "createMCPDevToolsExtensionSchema.js"),
    );
    const plugin = PluginSchema.parse({
      packageName: "synthetic-plugin",
      packageRoot: "/synthetic",
      cliExtensions: {
        description: "Synthetic local fixture",
        entryPoint: "fixture.js",
        commands: [
          {
            name: "inspect",
            title: "Inspect",
            environments: ["mcp"],
            parameters: [
              { name: "label", type: "text" },
              { name: "count", type: "number" },
              { name: "confirm", type: "confirm" },
            ],
          },
        ],
      },
    });
    const schema = createMCPDevToolsExtensionSchema(plugin);
    assert.deepEqual(
      schema.parse({ command: "inspect", label: "fixture", count: 2, confirm: true }),
      { command: "inspect", label: "fixture", count: 2, confirm: true },
    );
    for (const input of [
      { command: "unknown" },
      { command: "inspect", count: "2" },
      { command: "inspect", extra: true },
    ]) {
      assert.equal(schema.safeParse(input).success, false);
    }
    assert.equal(
      PluginSchema.safeParse({ packageName: "", packageRoot: "/synthetic" }).success,
      false,
    );
    assert.throws(() => createMCPDevToolsExtensionSchema({ packageName: "empty" }), /no commands/);
    assert.equal(
      DevToolsPluginOutputSchema.safeParse([{ type: "text", text: "valid", level: "info" }])
        .success,
      true,
    );
    assert.equal(
      DevToolsPluginOutputSchema.safeParse([{ type: "audio", url: "not-a-url" }]).success,
      false,
    );
  });

  it("does not activate encoded schemes, conflate relative paths or silently rewrite invalid hosts", () => {
    assert.equal(ajv("fast-uri/package.json").version, "3.1.9");
    for (const input of ["%6Aavascript:alert(1)", "%u006Aavascript:alert(1)"]) {
      assert.notEqual(uri.parse(input).scheme, "javascript");
      assert.notEqual(uri.normalize(input), "javascript:alert(1)");
      assert.throws(() => uri.resolve("https://a.example/", input), /scheme is malformed/);
    }
    assert.equal(uri.equal("%68ttp://a/", "http://a/"), false);
    for (const ref of ["a/../b", "../x"]) {
      assert.equal(
        uri.resolve("https://a.example/dir/doc", uri.normalize(ref)),
        uri.resolve("https://a.example/dir/doc", ref),
      );
    }
    for (const input of [
      "http://a@b@evil.example/",
      "http://exa\tmple.com/",
      "http://exa\nmple.com/",
      "http://exa\rmple.com/",
    ]) {
      assert(uri.parse(input).error, `Expected host rejection: ${JSON.stringify(input)}`);
    }
    for (const scheme of ["javascript", "data", "vbscript"]) {
      const output = uri.serialize({ path: `${scheme}:alert(1)` }, { reference: "suffix" });
      assert.notEqual(uri.parse(output).scheme, scheme);
    }
    const Validator = ajv("ajv");
    const validate = new Validator().compile({
      $id: "https://schemas.example/root",
      type: "object",
      properties: { count: { type: "integer" } },
    });
    assert.equal(validate({ count: 2 }), true);
    assert.equal(validate({ count: "2" }), false);
  });

  it("bounds retained SSE data fields and fragmented unfinished lines", async () => {
    assert.equal(miniflare("undici/package.json").version, "7.30.1");
    const { EventSourceStream } = miniflare("undici/lib/web/eventsource/eventsource-stream.js");
    for (const chunks of [Array(1025).fill("data:\n"), Array(1025).fill("x")]) {
      const stream = new EventSourceStream({ maxEventSize: 128 * 1024 });
      const failure = once(stream, "error");
      for (const chunk of chunks) stream.write(Buffer.from(chunk));
      const [error] = await failure;
      assert.match(error.message, /size exceeded/);
    }
  });

  it("checks uppercase and mixed-case SRI against actual loopback HTTP responses", async () => {
    const server = createServer((_request, response) => response.end("synthetic response"));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const url = `http://127.0.0.1:${server.address().port}/`;
    try {
      for (const algorithm of ["SHA256", "Sha384", "SHA512"]) {
        const digest = (value) =>
          createHash(algorithm.toLowerCase()).update(value).digest("base64");
        const valid = await undici.fetch(url, {
          integrity: `${algorithm}-${digest("synthetic response")}`,
        });
        assert.equal(await valid.text(), "synthetic response");
        await assert.rejects(
          undici.fetch(url, { integrity: `${algorithm}-${digest("different response")}` }),
          /fetch failed/,
        );
      }
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("rejects excessive content codings and early close without crashing the process", () => {
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        `
      const assert = require('node:assert/strict');
      const { createServer } = require('node:http');
      const { fetch } = require(${JSON.stringify(miniflare.resolve("undici"))});
      const server = createServer((_req, res) => {
        res.writeHead(200, { 'content-encoding': 'gzip, gzip, gzip, gzip, gzip, gzip', 'content-length': '100' });
        res.flushHeaders();
        setImmediate(() => res.destroy());
      });
      server.listen(0, '127.0.0.1', async () => {
        try {
          await assert.rejects(fetch('http://127.0.0.1:' + server.address().port), error => {
            assert.equal(error.cause?.message, 'too many content-encodings in response: 6, maximum allowed is 5');
            return true;
          });
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) { console.error(error); process.exitCode = 1; }
        finally { server.closeAllConnections(); server.close(); }
      });
    `,
      ],
      { encoding: "utf8", timeout: 10000 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
  });
});
