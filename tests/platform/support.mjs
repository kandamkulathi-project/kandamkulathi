import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { connect } from "node:net";
import pg from "pg";
import { WebSocketServer } from "ws";
import { withDatabase } from "../../packages/database/src/client.ts";
import { migrate } from "../../scripts/platform/database.mjs";

export async function testDatabase() {
  assert(
    process.env.PLATFORM_TEST_ADMIN_URL,
    "Set PLATFORM_TEST_ADMIN_URL for an isolated PostgreSQL 17 test instance; see platform setup.",
  );
  let adminUrl;
  try {
    adminUrl = new URL(process.env.PLATFORM_TEST_ADMIN_URL);
  } catch {
    throw new Error("Invalid PostgreSQL test configuration; credential values are not logged.");
  }
  assert(
    ["postgres:", "postgresql:"].includes(adminUrl.protocol) &&
      adminUrl.username &&
      adminUrl.password,
    "Explicit PostgreSQL test credentials required",
  );
  assert.equal(
    adminUrl.hostname,
    "127.0.0.1",
    "Tests require an explicit loopback PostgreSQL instance",
  );
  assert.equal(
    adminUrl.pathname,
    "/postgres",
    "Only the isolated test cluster's administrative database is allowed",
  );
  assert.equal(adminUrl.search, "");
  const admin = new pg.Client({ connectionString: adminUrl.href, connectionTimeoutMillis: 5000 });
  await admin.connect();
  const suffix = randomBytes(7).toString("hex");
  const databases = [];
  const logins = [];
  const sockets = new Set();
  const proxy = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise((resolve, reject) => {
    proxy.once("listening", resolve);
    proxy.once("error", reject);
  });
  proxy.on("connection", (socket, request) => {
    const target = new URL(request.url, "http://127.0.0.1").searchParams.get("address");
    if (target !== `127.0.0.1:${adminUrl.port || "5432"}`) {
      socket.close(1008);
      return;
    }
    const tcp = connect({ host: "127.0.0.1", port: Number(adminUrl.port || 5432) });
    sockets.add(tcp);
    socket.on("message", (data) => tcp.write(data));
    tcp.on("data", (data) => {
      if (socket.readyState === 1) socket.send(data);
    });
    socket.on("error", () => tcp.destroy());
    socket.on("close", () => tcp.destroy());
    tcp.on("error", () => socket.close());
    tcp.on("close", () => {
      sockets.delete(tcp);
      socket.close();
    });
  });
  const localProxy = `127.0.0.1:${proxy.address().port}`;
  const makeDatabase = async () => {
    const name = `k_platform_test_${randomBytes(9).toString("hex")}`;
    assert.match(name, /^k_platform_test_[a-f0-9]+$/);
    const statement = (
      await admin.query("SELECT format('CREATE DATABASE %I', $1::text) AS sql", [name])
    ).rows[0].sql;
    await admin.query(statement);
    databases.push(name);
    const value = new URL(adminUrl);
    value.pathname = `/${name}`;
    return value.href;
  };
  let source;
  const close = async () => {
    try {
      for (const socket of sockets) socket.destroy();
      for (const socket of proxy.clients) socket.terminate();
      await new Promise((resolve) => proxy.close(resolve));
      await source?.end();
      for (const name of databases) {
        assert.match(name, /^k_platform_test_[a-f0-9]+$/);
        const statement = (
          await admin.query("SELECT format('DROP DATABASE %I WITH (FORCE)', $1::text) AS sql", [
            name,
          ])
        ).rows[0].sql;
        await admin.query(statement);
      }
      for (const name of logins) {
        const statement = (
          await admin.query("SELECT format('DROP ROLE %I', $1::text) AS sql", [name])
        ).rows[0].sql;
        await admin.query(statement);
      }
    } finally {
      await admin.end();
    }
  };
  try {
    const sourceUrl = await makeDatabase();
    await migrate(sourceUrl, { environment: "local", namespace: "kandamkulathi-local" });
    source = new pg.Client({ connectionString: sourceUrl });
    await source.connect();
    const urls = {};
    for (const [key, group] of [
      ["core", "k_core_runtime"],
      ["jobs", "k_jobs_runtime"],
      ["backup", "k_backup_runtime"],
    ]) {
      const name = `k_test_${key}_${suffix}`;
      const password = randomBytes(24).toString("hex");
      const statement = (
        await admin.query(
          "SELECT format('CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', $1::text,$2::text) AS sql",
          [name, password],
        )
      ).rows[0].sql;
      await admin.query(statement);
      logins.push(name);
      await admin.query(
        (
          await admin.query("SELECT format('GRANT %I TO %I', $1::text,$2::text) AS sql", [
            group,
            name,
          ])
        ).rows[0].sql,
      );
      const url = new URL(sourceUrl);
      url.username = name;
      url.password = password;
      urls[key] = url.href;
    }
    const runtime = (role, callback, namespace) =>
      withDatabase(
        urls[role],
        "local",
        role === "core" ? "k_core_runtime" : "k_jobs_runtime",
        callback,
        localProxy,
        namespace,
      );
    const reset = async () => {
      // Only the randomly created, loopback synthetic database owned by this fixture.
      const target = new URL(sourceUrl);
      assert.equal(target.hostname, "127.0.0.1");
      assert.match(target.pathname, /^\/k_platform_test_[a-f0-9]+$/);
      assert(databases.includes(target.pathname.slice(1)));
      assert.equal(
        (await source.query("SELECT current_database() AS name")).rows[0].name,
        target.pathname.slice(1),
      );
      await source.query(
        "TRUNCATE core.knowledge_index_bridges, platform.receipts, platform.probe_effects, platform.outbox",
      );
    };
    return {
      admin,
      source,
      sourceUrl,
      urls,
      localProxy,
      runtime,
      makeDatabase,
      reset,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
