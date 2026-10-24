import type { TranscriptionRuntime } from "../../apps/core-api/src/transcription";
import type { DatabaseClient } from "../../packages/database/src/client";
import { customerFixture, now } from "../unit/identity-fixtures";

// Synthetic container metadata ONLY. Not decodable AAC or actual provider/device evidence.
export function syntheticTranscriptionAudio(duration = 1000) {
  const u32 = (value: number) => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value);
    return bytes;
  };
  const join = (...parts: Uint8Array[]) => {
    const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let i = 0;
    for (const p of parts) {
      bytes.set(p, i);
      i += p.length;
    }
    return bytes;
  };
  const text = (value: string) => new TextEncoder().encode(value);
  const sample = new Uint8Array(28);
  new DataView(sample.buffer).setUint32(24, 16000 * 65536);
  const box = (type: string, ...parts: Uint8Array[]) => {
    const payload = join(...parts);
    return join(u32(payload.length + 8), text(type), payload);
  };
  return join(
    box("ftyp", text("M4A "), u32(0)),
    box("mdat", new Uint8Array([1])),
    box(
      "moov",
      box(
        "trak",
        box(
          "mdia",
          box("hdlr", new Uint8Array(8), text("soun")),
          box("mdhd", new Uint8Array(12), u32(16000), u32(duration * 16), new Uint8Array(4)),
          box(
            "minf",
            box(
              "stbl",
              box("stsd", u32(0), u32(1), box("mp4a", sample)),
              box("stts", u32(0), u32(1), u32(1), u32(duration * 16)),
            ),
          ),
        ),
      ),
    ),
  );
}
export const transcriptionBindings = {
  TRANSCRIPTION_CONFIGURATION_APPROVED: "true",
  TRANSCRIPTION_PROCESSING_APPROVED: "true",
  TRANSCRIPTION_PROCESSING_POLICY_VERSION: "synthetic-policy-only",
  OPENAI_API_KEY: "synthetic-key-only",
};
export const transcriptionInput = () => ({
  action: "transcribe-for-review",
  contentType: "audio/mp4",
  processingPolicyVersion: "synthetic-policy-only",
  audio: Buffer.from(syntheticTranscriptionAudio()).toString("base64"),
});
export function transcriptionRuntimeFixture() {
  const fixture = customerFixture();
  const client = {
    // Synthetic admission seam only. Durable limits/RLS are tested against real PostgreSQL.
    query: async (sql: string, values?: unknown[]) => ({
      rows: sql.includes("core.transcription_admission")
        ? [
            {
              status:
                values?.[0] === "reserve"
                  ? "admitted"
                  : values?.[0] === "check"
                    ? "allowed"
                    : "released",
            },
          ]
        : [],
      command: sql === "COMMIT" ? "COMMIT" : "",
    }),
  } as unknown as DatabaseClient;
  const runtime: TranscriptionRuntime = {
    identity: { now: () => now, withClient: async (run) => run(client) },
    dependencies: {
      now: () => now,
      verifySession: async () => ({ status: "verified", identity: fixture.identity }),
      loadCurrentAuthority: async () => fixture.authority,
    },
    mutation: async () => "allowed",
    withSessionInTransaction: async (_client, _request, _identity, run) => run(fixture.authority),
  };
  return { runtime, fixture };
}
