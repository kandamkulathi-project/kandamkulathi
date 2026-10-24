import { type DatabaseContext, withDatabase } from "@kandamkulathi/database/client";
import { platformConfig } from "@kandamkulathi/server/config";
import { loadCurrentAuthorityInTransaction } from "../../../packages/database/src/identity";
import {
  createKnowledgeIndexProvider,
  type KnowledgeIndexProviderOptions,
  type KnowledgeVectorizeBinding,
} from "../../../packages/providers/src/knowledge-index";
import { createKnowledgeWorkerRuntime } from "../../companion/src/knowledge/postgres";

function isVectorizeBinding(value: unknown): value is KnowledgeVectorizeBinding {
  return (
    !!value &&
    typeof value === "object" &&
    ["upsert", "deleteByIds", "query"].every(
      (name) => typeof Reflect.get(value, name) === "function",
    )
  );
}

/** The only source of provider configuration is approved Worker bindings. */
export function configuredKnowledgeIndexProviderOptions(
  bindings: Record<string, unknown>,
): KnowledgeIndexProviderOptions {
  const config = platformConfig(bindings);
  const approved = bindings.KNOWLEDGE_INDEX_CONFIGURATION_APPROVED === "true";
  const vectorize = bindings.KNOWLEDGE_VECTORIZE;
  const apiKey = bindings.OPENAI_API_KEY;
  return {
    namespace: config.RESOURCE_NAMESPACE,
    ...(approved && isVectorizeBinding(vectorize) ? { vectorize } : {}),
    ...(approved && typeof apiKey === "string" && apiKey.length > 0 && apiKey.length <= 1024
      ? { apiKey }
      : {}),
  };
}

/** Exact search remains a primary-database read even when semantic providers are unavailable. */
export function knowledgeSearchRuntimeFromBindings(bindings: unknown) {
  if (!bindings || typeof bindings !== "object") return undefined;
  const values = bindings as Record<string, unknown>;
  const config = platformConfig(values);
  const connectionString = config.DATABASE_URL;
  if (!connectionString) return undefined;
  const localProxy =
    typeof values.LOCAL_DATABASE_PROXY === "string" ? values.LOCAL_DATABASE_PROXY : undefined;
  const runtime = createKnowledgeWorkerRuntime({
    connectionString,
    environment: config.APP_ENV,
    namespace: config.RESOURCE_NAMESPACE,
    ...(localProxy ? { localProxy } : {}),
    loadCurrentAuthorityInTransaction,
  });
  return {
    withDatabase: <T>(work: (context: DatabaseContext) => Promise<T>) =>
      withDatabase(
        connectionString,
        config.APP_ENV,
        "k_core_runtime",
        work,
        localProxy,
        config.RESOURCE_NAMESPACE,
      ),
    exact: runtime.search,
    publicProduct: runtime.publicProduct,
    provider: createKnowledgeIndexProvider(configuredKnowledgeIndexProviderOptions(values)),
  };
}
