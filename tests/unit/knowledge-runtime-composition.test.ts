import { describe, expect, it, vi } from "vitest";
import { knowledgeRuntimeFromBindings } from "../../apps/companion/src/runtime";
import {
  configuredKnowledgeIndexProviderOptions,
  knowledgeSearchRuntimeFromBindings,
} from "../../apps/core-api/src/knowledge-runtime";

const vectorize = () => ({
  upsert: vi.fn(),
  deleteByIds: vi.fn(),
  query: vi.fn(),
});

describe("configured public knowledge provider boundary", () => {
  it("does not expose processing credentials or enable effects before explicit approval", () => {
    const binding = vectorize();
    const options = configuredKnowledgeIndexProviderOptions({
      APP_ENV: "local",
      KNOWLEDGE_VECTORIZE: binding,
      OPENAI_API_KEY: "synthetic-provider-key",
    });
    expect(options).toEqual({ namespace: "kandamkulathi-local" });
    expect(binding.upsert).not.toHaveBeenCalled();
    expect(binding.query).not.toHaveBeenCalled();
  });

  it("binds only the reviewed complete binding and isolated platform namespace", () => {
    const binding = vectorize();
    const options = configuredKnowledgeIndexProviderOptions({
      APP_ENV: "preview",
      RESOURCE_NAMESPACE: "kandamkulathi-preview-knowledge-unit",
      PROVIDER_MODE: "sandbox",
      KNOWLEDGE_INDEX_CONFIGURATION_APPROVED: "true",
      KNOWLEDGE_VECTORIZE: binding,
      OPENAI_API_KEY: "synthetic-provider-key",
    });
    expect(options.namespace).toBe("kandamkulathi-preview-knowledge-unit");
    expect(options.vectorize).toBe(binding);
    expect(options.apiKey).toBe("synthetic-provider-key");
    expect(binding.upsert).not.toHaveBeenCalled();
  });

  it.each([null, {}, { upsert: () => {} }, { upsert: 1, deleteByIds: () => {}, query: () => {} }])(
    "does not promote a malformed binding to a working provider %#",
    (binding) => {
      expect(
        configuredKnowledgeIndexProviderOptions({
          APP_ENV: "local",
          KNOWLEDGE_INDEX_CONFIGURATION_APPROVED: "true",
          KNOWLEDGE_VECTORIZE: binding,
        }).vectorize,
      ).toBeUndefined();
    },
  );

  it("does not fabricate an empty authoritative corpus without primary storage", () => {
    expect(knowledgeSearchRuntimeFromBindings(null)).toBeUndefined();
    expect(knowledgeSearchRuntimeFromBindings({ APP_ENV: "local" })).toBeUndefined();
  });

  it("preserves unavailable configured identity during mutation admission", async () => {
    const runtime = knowledgeRuntimeFromBindings({
      APP_ENV: "local",
      DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:5432/synthetic",
    });
    expect(runtime).toBeDefined();
    expect(
      await runtime?.verifyMutation(new Request("http://localhost/v1/knowledge/drafts"), {}),
    ).toBe("unavailable");
  });
});
