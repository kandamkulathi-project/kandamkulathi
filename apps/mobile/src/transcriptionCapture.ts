import { AudioModule, type RecordingOptions } from "expo-audio";
import { File } from "expo-file-system";
import {
  transcriptionLimits,
  validateTranscriptionAudio,
} from "../../../packages/contracts/src/transcription";
import type { TranscriptionCapturePort } from "./transcription";

/** SDK-supported settings, not a claim every Android/iOS encoder honors 16 kbps.
 * Oversize/nonconforming output is rejected rather than raising the global HTTP cap.
 */
export const transcriptionRecordingOptions: RecordingOptions = {
  extension: ".m4a",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 16000,
  android: { outputFormat: "mpeg4", audioEncoder: "aac", maxFileSize: 47000 },
  ios: { outputFormat: "aac ", audioQuality: 32 },
  web: {},
};

export function expoTranscriptionCapture(recorder: {
  uri: string | null;
  prepareToRecordAsync(): Promise<void>;
  record(options: { forDuration: number }): void;
  stop(): Promise<void>;
}): TranscriptionCapturePort {
  return {
    permission: async () => (await AudioModule.requestRecordingPermissionsAsync()).granted,
    prepare: () => recorder.prepareToRecordAsync(),
    record: () => recorder.record({ forDuration: 14.5 }),
    stop: () => recorder.stop(),
    async encoded() {
      if (!recorder.uri) throw new Error("Recording unavailable");
      const file = new File(recorder.uri);
      if (!file.exists || file.size > transcriptionLimits.bytes)
        throw new Error("Recording unavailable");
      const bytes = await file.bytes();
      validateTranscriptionAudio(bytes);
      return file.base64();
    },
    async discard() {
      if (recorder.uri) {
        const file = new File(recorder.uri);
        if (file.exists) file.delete();
      }
    },
  };
}
