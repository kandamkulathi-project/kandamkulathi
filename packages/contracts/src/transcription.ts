import { z } from "zod";

// Base64 + envelope must fit the existing 64 KiB service request cap.
export const transcriptionLimits = {
  bytes: 48000,
  durationMs: 15000,
  responseBytes: 24000,
} as const;
export const transcriptionRequestSchema = z.strictObject({
  contentType: z.literal("audio/mp4"),
  audio: z
    .string()
    .min(4)
    .max(64000)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  processingPolicyVersion: z.string().min(1).max(128),
  action: z.literal("transcribe-for-review"),
});
export const transcriptionReplySchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("review"), text: z.string().trim().min(1).max(4000) }),
  z.strictObject({
    status: z.enum(["empty", "not-configured", "denied", "invalid", "rate-limited", "unknown"]),
  }),
]);
export type TranscriptionReply = z.infer<typeof transcriptionReplySchema>;

/** Narrow ISO-BMFF audio-only profile. Never trust a client-supplied duration/MIME alone.
 * This validates container metadata, not decoded AAC; actual codec/device proof remains required.
 */
export function validateTranscriptionAudio(bytes: Uint8Array): number {
  if (bytes.length < 32 || bytes.length > transcriptionLimits.bytes)
    throw new Error("Invalid audio");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  type Box = { type: string; start: number; end: number };
  const boxes = (start: number, end: number): Box[] => {
    const result: Box[] = [];
    while (start < end) {
      if (end - start < 8 || result.length >= 128) throw new Error("Invalid audio");
      const size = view.getUint32(start);
      if (size < 8 || start + size > end) throw new Error("Invalid audio");
      result.push({ type: text(start + 4, 4), start: start + 8, end: start + size });
      start += size;
    }
    return result;
  };
  const one = (list: Box[], type: string): Box => {
    const found = list.filter((box) => box.type === type);
    if (found.length !== 1 || !found[0]) throw new Error("Invalid audio");
    return found[0];
  };
  const top = boxes(0, bytes.length);
  const ftyp = one(top, "ftyp");
  if (ftyp.end - ftyp.start < 8 || !["M4A ", "isom", "mp42"].includes(text(ftyp.start, 4)))
    throw new Error("Invalid audio");
  const mdat = one(top, "mdat");
  if (mdat.end <= mdat.start) throw new Error("Invalid audio");
  const moov = one(top, "moov");
  const trak = one(boxes(moov.start, moov.end), "trak");
  const mdia = one(boxes(trak.start, trak.end), "mdia");
  const media = boxes(mdia.start, mdia.end);
  const hdlr = one(media, "hdlr");
  if (hdlr.end - hdlr.start < 12 || text(hdlr.start + 8, 4) !== "soun")
    throw new Error("Invalid audio");
  const mdhd = one(media, "mdhd");
  if (mdhd.end - mdhd.start < 24 || view.getUint8(mdhd.start) !== 0)
    throw new Error("Invalid audio");
  const timescale = view.getUint32(mdhd.start + 12);
  const durationMs = (view.getUint32(mdhd.start + 16) * 1000) / timescale;
  if (
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    durationMs > transcriptionLimits.durationMs
  )
    throw new Error("Invalid audio");
  const minf = one(media, "minf");
  const stbl = one(boxes(minf.start, minf.end), "stbl");
  const tables = boxes(stbl.start, stbl.end);
  const stsd = one(tables, "stsd");
  if (stsd.end - stsd.start < 8 || view.getUint32(stsd.start + 4) !== 1)
    throw new Error("Invalid audio");
  const sample = one(boxes(stsd.start + 8, stsd.end), "mp4a");
  if (
    sample.end - sample.start < 28 ||
    timescale !== 16000 ||
    view.getUint32(sample.start + 24) !== 16000 * 65536
  )
    throw new Error("Invalid audio");
  // Cross-check sample timing instead of accepting only a mutable mdhd claim.
  const stts = one(tables, "stts");
  if (stts.end - stts.start < 8) throw new Error("Invalid audio");
  const count = view.getUint32(stts.start + 4);
  if (count < 1 || count > 128 || stts.end - stts.start !== 8 + count * 8)
    throw new Error("Invalid audio");
  let ticks = 0;
  for (let i = 0; i < count; i++)
    ticks += view.getUint32(stts.start + 8 + i * 8) * view.getUint32(stts.start + 12 + i * 8);
  if (ticks !== view.getUint32(mdhd.start + 16)) throw new Error("Invalid audio");
  return durationMs;
}
