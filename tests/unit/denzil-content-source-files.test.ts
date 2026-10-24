import { describe, expect, it, vi } from "vitest";
import { syntheticRecord } from "../../apps/workspaces/src/content/__fixtures__/records";
import { authoringRequest, draftCommand } from "../../apps/workspaces/src/content/authoring-dto";
import {
  createSourceFileSelection,
  digestSourceBytes,
  type LocalSourceFile,
  sourceFileMaxBytes,
  withinKnowledgeBodyLimit,
} from "../../apps/workspaces/src/content/source-files";

const hashX = "2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881";
function sources() {
  return syntheticRecord().content.sources.map((source) => ({ ...source, sha256: hashX }));
}
function file(text = "x", name = "synthetic-public.txt"): LocalSourceFile {
  const bytes = new TextEncoder().encode(text);
  return { name, size: bytes.byteLength, arrayBuffer: vi.fn(async () => bytes.slice().buffer) };
}

describe("explicit local public source bytes — no network/file reconstruction", () => {
  it("hashes actual selected bytes, keeps them local and only prepares exact base64 on explicit Save", async () => {
    const publish = vi.fn();
    const selection = createSourceFileSelection(sources(), publish);
    const sourceId = sources()[0]?.sourceId ?? "";
    expect(selection.prepareUploads()).toBeNull();
    await selection.select(sourceId, [file()]);
    expect(selection.ready()).toBe(true);
    expect(selection.snapshot()).toEqual([
      { sourceId, name: "synthetic-public.txt", status: "ready" },
    ]);
    expect(JSON.stringify(publish.mock.calls)).not.toContain("bytesBase64");
    expect(selection.prepareUploads()).toEqual([{ sourceId, bytesBase64: "eA==" }]);
    const previous = syntheticRecord();
    previous.content.sources = sources();
    const command = draftCommand(
      previous,
      previous.content.editorId,
      "Title",
      "Text",
      selection.prepareUploads() ?? [],
    );
    if (!command) throw new Error("Expected complete draft");
    const request = authoringRequest(command);
    expect(request.path).toBe("/v1/knowledge/drafts");
    expect(Object.keys(request.body).sort()).toEqual(["content", "sources"]);
    expect(request.body.sources).toEqual([{ sourceId, bytesBase64: "eA==" }]);
    expect(withinKnowledgeBodyLimit(request.body)).toBe(true);
    selection.dispose();
  });
  it("requires every registered source, and rejects unknown IDs and duplicate file lists", async () => {
    const registry = [
      ...sources(),
      {
        ...sources()[0],
        sourceId: "abcdefab-7777-4777-8777-777777777777",
        revision: 1,
        sha256: hashX,
        visibility: "public" as const,
        publicUrl: "https://example.com/second",
      },
    ];
    const selection = createSourceFileSelection(registry, vi.fn());
    await selection.select("not-registered", [file()]);
    expect(selection.snapshot().every((state) => state.status === "missing")).toBe(true);
    const first = registry[0]?.sourceId ?? "";
    await selection.select(first, [file()]);
    expect(selection.prepareUploads()).toBeNull();
    await selection.select(first, [file(), file()]);
    expect(selection.snapshot()[0]?.status).toBe("duplicate");
    expect(selection.prepareUploads()).toBeNull();
    await selection.select(first, [file()]);
    await selection.select(registry[1]?.sourceId ?? "", [file()]);
    expect(selection.prepareUploads()).toHaveLength(2);
    selection.dispose();
    expect(() =>
      createSourceFileSelection(
        [sources()[0] as ReturnType<typeof sources>[number], ...sources()],
        vi.fn(),
      ),
    ).toThrow("Duplicate registered source");
  });
  it("does not read oversized/empty files and rejects actual length and provenance hash mismatches", async () => {
    const selection = createSourceFileSelection(sources(), vi.fn());
    const sourceId = sources()[0]?.sourceId ?? "";
    const large = { ...file(), size: 48001 };
    await selection.select(sourceId, [large]);
    expect(large.arrayBuffer).not.toHaveBeenCalled();
    expect(selection.snapshot()[0]?.status).toBe("size");
    const empty = file("");
    await selection.select(sourceId, [empty]);
    expect(empty.arrayBuffer).not.toHaveBeenCalled();
    await selection.select(sourceId, [{ ...file("xy"), size: 1 }]);
    expect(selection.snapshot()[0]?.status).toBe("size");
    await selection.select(sourceId, [file("wrong")]);
    expect(selection.snapshot()[0]?.status).toBe("mismatch");
    expect(selection.prepareUploads()).toBeNull();
    selection.dispose();
  });
  it("accepts exactly 48000 matching bytes, but the actual complete request can still exceed 65536", async () => {
    const data = "x".repeat(sourceFileMaxBytes);
    const registry = sources();
    const registered = registry[0];
    if (!registered) throw new Error("Fixture missing");
    registered.sha256 = await digestSourceBytes(new TextEncoder().encode(data));
    const selection = createSourceFileSelection(registry, vi.fn());
    await selection.select(registered.sourceId, [file(data)]);
    const uploads = selection.prepareUploads();
    expect(uploads?.[0]?.bytesBase64).toHaveLength(64000);
    const previous = syntheticRecord();
    previous.content.sources = registry;
    const command = draftCommand(
      previous,
      previous.content.editorId,
      "Title",
      "T".repeat(16000),
      uploads ?? [],
    );
    if (!command) throw new Error("Expected complete draft");
    expect(withinKnowledgeBodyLimit(authoringRequest(command).body)).toBe(false);
    expect(withinKnowledgeBodyLimit("a".repeat(65534))).toBe(true);
    expect(withinKnowledgeBodyLimit("a".repeat(65535))).toBe(false);
    expect(withinKnowledgeBodyLimit("அ".repeat(21845))).toBe(false);
    expect(withinKnowledgeBodyLimit(undefined)).toBe(false);
    selection.dispose();
  });
  it("reselection fences stale hashes; clear and session/record disposal erase names and deny preparation", async () => {
    let finish: ((hash: string) => void) | undefined;
    const publish = vi.fn();
    const selection = createSourceFileSelection(
      sources(),
      publish,
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const sourceId = sources()[0]?.sourceId ?? "";
    const pending = selection.select(sourceId, [file("x", "old.txt")]);
    await vi.waitFor(() => expect(finish).toBeDefined());
    await selection.select(sourceId, []);
    finish?.(hashX);
    await pending;
    expect(selection.snapshot()[0]).toEqual({ sourceId, status: "missing", name: "" });
    expect(selection.prepareUploads()).toBeNull();
    const another = selection.select(sourceId, [file("x", "session-private-name.txt")]);
    await vi.waitFor(() => expect(selection.snapshot()[0]?.status).toBe("hashing"));
    selection.dispose();
    finish?.(hashX);
    await another;
    expect(selection.snapshot()[0]?.name).toBe("");
    expect(selection.prepareUploads()).toBeNull();
    expect(selection.ready()).toBe(false);
  });
  it("clear releases accepted bytes and a local read/hash failure never enables Save", async () => {
    const selection = createSourceFileSelection(sources(), vi.fn());
    const sourceId = sources()[0]?.sourceId ?? "";
    await selection.select(sourceId, [file()]);
    selection.clear();
    expect(selection.snapshot()[0]?.name).toBe("");
    expect(selection.prepareUploads()).toBeNull();
    await selection.select(sourceId, [
      {
        ...file(),
        arrayBuffer: async () => {
          throw new Error("private filename/path detail");
        },
      },
    ]);
    expect(selection.snapshot()[0]?.status).toBe("error");
    expect(selection.prepareUploads()).toBeNull();
    selection.dispose();
  });
  it("zeros in-flight owned bytes immediately on disposal even if hashing never settles", async () => {
    let pendingBytes: Uint8Array | undefined;
    const selection = createSourceFileSelection(sources(), vi.fn(), (bytes) => {
      pendingBytes = bytes;
      return new Promise(() => {});
    });
    void selection.select(sources()[0]?.sourceId ?? "", [file()]);
    await vi.waitFor(() => expect(pendingBytes?.[0]).toBe(120));
    selection.dispose();
    expect(pendingBytes?.[0]).toBe(0);
    expect(selection.prepareUploads()).toBeNull();
  });
});
