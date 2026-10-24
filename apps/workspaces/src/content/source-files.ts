import { type KnowledgeContent, knowledgeSourceSchema } from "@kandamkulathi/contracts/knowledge";
import {
  knowledgeAuthoringRequestMaxBytes,
  knowledgeSourceDecodedMaxBytes,
} from "@kandamkulathi/contracts/knowledge-authoring";
import type { SourceUpload } from "./authoring-dto";

// Frozen owner technical limits, not a duplicated clinical/source policy.
export const sourceFileMaxBytes = knowledgeSourceDecodedMaxBytes;
export const knowledgeBodyMaxBytes = knowledgeAuthoringRequestMaxBytes;
export type SourceFileStatus =
  | "missing"
  | "hashing"
  | "ready"
  | "mismatch"
  | "size"
  | "duplicate"
  | "error";
export type SourceFileState = { sourceId: string; status: SourceFileStatus; name: string };
export interface LocalSourceFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}
export type SourceDigest = (bytes: Uint8Array<ArrayBuffer>) => Promise<string>;
export const digestSourceBytes: SourceDigest = async (bytes) => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/** Local bytes only. No upload, URL fetch, reconstruction, storage or base64 work on selection. */
export function createSourceFileSelection(
  sources: KnowledgeContent["sources"],
  publish: (states: SourceFileState[]) => void,
  digest: SourceDigest = digestSourceBytes,
) {
  const registry = sources.map((source) => knowledgeSourceSchema.parse(source));
  if (new Set(registry.map((source) => source.sourceId)).size !== registry.length)
    throw new Error("Duplicate registered source");
  const states = new Map<string, SourceFileState>();
  const bytes = new Map<string, Uint8Array<ArrayBuffer>>();
  const hashing = new Map<Uint8Array<ArrayBuffer>, string>();
  const versions = new Map<string, number>();
  let live = true;
  const snapshot = () =>
    registry.map((source) => ({
      ...(states.get(source.sourceId) ?? {
        sourceId: source.sourceId,
        status: "missing" as const,
        name: "",
      }),
    }));
  const release = (sourceId: string) => {
    bytes.get(sourceId)?.fill(0);
    bytes.delete(sourceId);
    for (const [buffer, owner] of hashing) {
      if (owner === sourceId) {
        buffer.fill(0);
        hashing.delete(buffer);
      }
    }
  };
  const emit = () => {
    if (live) publish(snapshot());
  };
  return {
    snapshot,
    ready: () =>
      live &&
      registry.length > 0 &&
      registry.every(
        (source) => states.get(source.sourceId)?.status === "ready" && bytes.has(source.sourceId),
      ),
    async select(sourceId: string, files: readonly LocalSourceFile[]) {
      const source = registry.find((value) => value.sourceId === sourceId);
      if (!live || !source) return;
      const version = (versions.get(sourceId) ?? 0) + 1;
      versions.set(sourceId, version);
      release(sourceId);
      const file = files[0];
      const status =
        files.length > 1
          ? "duplicate"
          : !file
            ? "missing"
            : !Number.isSafeInteger(file.size) || file.size < 1 || file.size > sourceFileMaxBytes
              ? "size"
              : "hashing";
      states.set(sourceId, { sourceId, status, name: file && files.length === 1 ? file.name : "" });
      emit();
      if (status !== "hashing" || !file) return;
      let local: Uint8Array<ArrayBuffer> | undefined;
      try {
        local = new Uint8Array(await file.arrayBuffer());
        if (!live || versions.get(sourceId) !== version) return;
        if (
          local.byteLength !== file.size ||
          local.byteLength < 1 ||
          local.byteLength > sourceFileMaxBytes
        ) {
          states.set(sourceId, { sourceId, status: "size", name: file.name });
        } else {
          hashing.set(local, sourceId);
          const hash = await digest(local);
          hashing.delete(local);
          if (!live || versions.get(sourceId) !== version) return;
          const matches = hash === source.sha256;
          if (matches) {
            bytes.set(sourceId, local);
            local = undefined;
          }
          states.set(sourceId, {
            sourceId,
            status: matches ? "ready" : "mismatch",
            name: file.name,
          });
        }
      } catch {
        if (live && versions.get(sourceId) === version)
          states.set(sourceId, { sourceId, status: "error", name: file.name });
      } finally {
        if (local) hashing.delete(local);
        local?.fill(0);
        if (live && versions.get(sourceId) === version) emit();
      }
    },
    /** Explicit Save only: encode the actual verified local bytes, exactly once for this attempt. */
    prepareUploads(): SourceUpload[] | null {
      if (
        !live ||
        !registry.length ||
        registry.some(
          (source) =>
            states.get(source.sourceId)?.status !== "ready" || !bytes.has(source.sourceId),
        )
      )
        return null;
      return registry.map((source) => {
        const local = bytes.get(source.sourceId);
        if (!local) throw new Error("Missing source bytes");
        let binary = "";
        for (const byte of local) binary += String.fromCharCode(byte);
        return { sourceId: source.sourceId, bytesBase64: btoa(binary) };
      });
    },
    clear() {
      for (const source of registry) {
        versions.set(source.sourceId, (versions.get(source.sourceId) ?? 0) + 1);
        release(source.sourceId);
      }
      states.clear();
      emit();
    },
    dispose() {
      live = false;
      for (const source of registry) {
        versions.set(source.sourceId, (versions.get(source.sourceId) ?? 0) + 1);
        release(source.sourceId);
      }
      states.clear();
    },
  };
}

export function withinKnowledgeBodyLimit(body: unknown): boolean {
  try {
    const serialized = JSON.stringify(body);
    return (
      typeof serialized === "string" &&
      new TextEncoder().encode(serialized).byteLength <= knowledgeBodyMaxBytes
    );
  } catch {
    return false;
  }
}
