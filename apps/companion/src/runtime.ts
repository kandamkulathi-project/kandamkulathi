import { platformConfig } from "@kandamkulathi/server/config";
import { verifiedIdentitySchema } from "../../../packages/contracts/src/identity";
import { loadCurrentAuthorityInTransaction } from "../../../packages/database/src/identity";
import { createConfiguredIdentityRuntime } from "../../core-api/src/runtime";
import {
  createKnowledgeAuthoringRuntime,
  type KnowledgeAuthoringRoutes,
} from "./knowledge/authoring";
import { createKnowledgeWorkerRuntime } from "./knowledge/postgres";
import type { KnowledgeRuntimeRoutes } from "./knowledge/runtime";

/** Trusted per-request Worker bindings, never request-supplied scope or repository. */
export function knowledgeRuntimeFromBindings(
  bindings: unknown,
  request?: Request,
): KnowledgeRuntimeRoutes | undefined {
  if (!bindings || typeof bindings !== "object") return undefined;
  const values = bindings as Record<string, unknown>;
  const config = platformConfig(values);
  if (!config.DATABASE_URL) return undefined;
  const text = (key: string) => (typeof values[key] === "string" ? (values[key] as string) : "");
  const connectionString = config.DATABASE_URL;
  const localProxy = text("LOCAL_DATABASE_PROXY") || undefined;
  const identity = createConfiguredIdentityRuntime(values, request);
  return {
    runtime: createKnowledgeWorkerRuntime({
      connectionString,
      environment: config.APP_ENV,
      ...(localProxy ? { localProxy } : {}),
      namespace: config.RESOURCE_NAMESPACE,
      loadCurrentAuthorityInTransaction,
      guardSessionInTransaction: async (client, principal) => {
        if (!request) throw new Error("Knowledge event session unavailable.");
        await identity.withSessionInTransaction(client, request, principal, async () => {});
      },
    }),
    verifySession: async (request) => {
      const result = await identity.dependencies.verifySession(request);
      if (result.status !== "verified") return result;
      const parsed = verifiedIdentitySchema.safeParse(result.identity);
      return parsed.success
        ? { status: "verified", identity: parsed.data }
        : { status: "unavailable" };
    },
    authentication: "verified-session",
    verifyMutation: async (request) => {
      const result = await identity.dependencies.verifySession(request);
      if (result.status !== "verified")
        return result.status === "unavailable" ? "unavailable" : "denied";
      const principal = verifiedIdentitySchema.safeParse(result.identity);
      return principal.success ? identity.mutation(request, principal.data) : "unavailable";
    },
  };
}

export function knowledgeAuthoringRuntimeFromBindings(
  bindings: unknown,
  request: Request,
): KnowledgeAuthoringRoutes | undefined {
  if (!bindings || typeof bindings !== "object") return undefined;
  const values = bindings as Record<string, unknown>;
  if (!platformConfig(values).DATABASE_URL) return undefined;
  const configured = createConfiguredIdentityRuntime(values, request);
  return {
    verifySession: async (incoming) => {
      const result = await configured.dependencies.verifySession(incoming);
      if (result.status !== "verified") return result;
      const identity = verifiedIdentitySchema.safeParse(result.identity);
      return identity.success
        ? { status: "verified", identity: identity.data }
        : { status: "unavailable" };
    },
    runtime: createKnowledgeAuthoringRuntime({
      withClient: configured.identity.withClient,
      loadCurrentAuthorityInTransaction,
      guardSessionInTransaction: async (client, principal) => {
        await configured.withSessionInTransaction(client, request, principal, async () => {});
      },
    }),
  };
}
