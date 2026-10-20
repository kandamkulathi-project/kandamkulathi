import { databaseTarget, type Environment } from "@kandamkulathi/server/config";
import { Client } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { roleProofSql } from "./roles.ts";
import * as schema from "./schema.ts";

export type DatabaseClient = Client;
export type DatabaseContext = { client: Client; db: ReturnType<typeof database> };
const database = (client: Client) => drizzle({ client, schema });
const activeTransactions = new WeakSet<Client>();
export const inTransaction = (client: Client): boolean => activeTransactions.has(client);

/** One connection per event, to Neon's pooled endpoint. Never retain sockets between Worker events. */
export async function withDatabase<T>(
  connectionString: string,
  environment: Environment,
  group: "k_core_runtime" | "k_jobs_runtime",
  callback: (context: DatabaseContext) => Promise<T>,
  localProxy?: string,
  namespace = `kandamkulathi-${environment}`,
): Promise<T> {
  const url = databaseTarget(connectionString, environment);
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 4000,
    query_timeout: 8000,
  });
  client.neonConfig.useSecureWebSocket = true;
  if (localProxy) {
    if (
      environment !== "local" ||
      !/^127\.0\.0\.1:\d{2,5}$/.test(localProxy) ||
      !["127.0.0.1", "localhost"].includes(url.hostname)
    )
      throw new Error("Invalid local database proxy.");
    // Test/development-only loopback transport. Remote connections always use verified WSS.
    client.neonConfig.wsProxy = `${localProxy}/v1`;
    client.neonConfig.useSecureWebSocket = false;
    client.neonConfig.pipelineConnect = false;
  }
  try {
    await client.connect();
    const result = await client.query<{
      permitted: boolean;
      privileged: boolean;
      owns_objects: boolean;
      major: number;
    }>(roleProofSql, [group]);
    const identity = result.rows[0];
    if (
      !identity?.permitted ||
      identity.privileged ||
      identity.owns_objects ||
      identity.major !== 17
    ) {
      throw new Error("Runtime database role or version is invalid.");
    }
    const target = await client.query<{ valid: boolean }>(
      `SELECT environment = $1 AND namespace = $2
      AND dataset_class = $3 AND platform_version = 1 AND min_api_version <= 1 AND max_api_version >= 1 AS valid
      FROM platform.environment WHERE singleton`,
      [environment, namespace, environment === "production" ? "production" : "synthetic"],
    );
    if (!target.rows[0]?.valid)
      throw new Error("Database environment or API compatibility does not match.");
    return await callback({ client, db: database(client) });
  } finally {
    await client.end();
  }
}

/** Callback contains bounded database work only; publish/provider calls run after commit. No automatic retry. */
export async function transaction<T>(client: Client, callback: () => Promise<T>): Promise<T> {
  if (inTransaction(client)) throw new Error("Nested platform transactions are not supported.");
  await client.query("BEGIN");
  activeTransactions.add(client);
  try {
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '5s'");
    const result = await callback();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    activeTransactions.delete(client);
  }
}
