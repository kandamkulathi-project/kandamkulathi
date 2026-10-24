import { createRequire } from "node:module";
import { beforeEach, expect, it, vi } from "vitest";
import {
  approvedTranscriptionNotice,
  NativeTranscriptionControls,
} from "../../apps/mobile/src/NativeTranscriptionControls";
import {
  createOwnedTranscription,
  createTranscriptionCleanupRegistry,
} from "../../apps/mobile/src/transcriptionCleanup";
import { transcriptionText } from "../../packages/i18n/src/transcription";

const config = vi.hoisted(() => ({ extra: {} as Record<string, unknown> }));
vi.mock("../../apps/mobile/node_modules/expo-constants", () => ({
  default: { expoConfig: config },
}));
vi.mock("../../apps/mobile/node_modules/expo-audio", () => ({
  useAudioRecorder: () => ({}),
  setAudioModeAsync: vi.fn(async () => {}),
}));
vi.mock("../../apps/mobile/node_modules/expo-file-system", () => ({ File: class {} }));
vi.mock("../../apps/mobile/src/transcriptionCapture", () => ({
  transcriptionRecordingOptions: {},
  expoTranscriptionCapture: vi.fn(),
}));
vi.mock("../../apps/mobile/node_modules/react-native", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(new URL("../../apps/workspaces/package.json", import.meta.url));
  const { createElement } = require("react");
  type Props = {
    children?: unknown;
    title?: string;
    value?: boolean;
    disabled?: boolean;
    accessibilityLabel?: string;
  };
  return {
    AppState: { currentState: "active", addEventListener: vi.fn() },
    View: ({ children }: Props) => createElement("section", null, children),
    Text: ({ children }: Props) => createElement("span", null, children),
    Button: ({ title, disabled }: Props) => createElement("button", { disabled }, title),
    Switch: ({ value, disabled, accessibilityLabel }: Props) =>
      createElement("input", {
        type: "checkbox",
        checked: value,
        disabled,
        "aria-label": accessibilityLabel,
        readOnly: true,
      }),
  };
});
const require = createRequire(new URL("../../apps/workspaces/package.json", import.meta.url));
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const policy = () => ({
  transcriptionProofApproved: true,
  transcriptionProcessingPolicy: {
    version: "synthetic-v1",
    notices: {
      en: "SYNTHETIC EN NOTICE — NOT COMPANY POLICY",
      ml: "SYNTHETIC ML NOTICE — NOT COMPANY POLICY",
      ta: "SYNTHETIC TA NOTICE — NOT COMPANY POLICY",
    },
  },
});
beforeEach(() => {
  config.extra = {};
});

it("retains unresolved unmount cleanup for one explicit retry, without automatic retry loops", async () => {
  const registry = createTranscriptionCleanupRegistry();
  const item = { dispose: vi.fn(async () => false) };
  expect(await registry.retire(item)).toBe(false);
  expect(registry.snapshot()).toBe("cleanup-error");
  expect(await registry.settle()).toBe(false);
  expect(item.dispose).toHaveBeenCalledTimes(1);
  item.dispose.mockResolvedValueOnce(true);
  expect(await registry.retry()).toBe(true);
  expect(registry.snapshot()).toBe("idle");
  expect(item.dispose).toHaveBeenCalledTimes(2);
});

it("detaches UI/session callbacks before retaining the file cleanup controller", async () => {
  const capture = {
    permission: async () => true,
    prepare: async () => {},
    record: vi.fn(),
    stop: vi.fn(async () => {}),
    encoded: async () => "",
    discard: vi.fn(async () => {}),
  };
  const lifetime = createOwnedTranscription({
    origin: "http://127.0.0.1:8787",
    local: true,
    capture,
  });
  const changed = vi.fn();
  lifetime.attach({ current: () => true, credential: () => undefined, changed, review: vi.fn() });
  await lifetime.controller.start();
  const count = changed.mock.calls.length;
  lifetime.detach();
  expect(await createTranscriptionCleanupRegistry().retire(lifetime.controller)).toBe(true);
  expect(capture.stop).toHaveBeenCalledOnce();
  expect(capture.discard).toHaveBeenCalledOnce();
  expect(changed).toHaveBeenCalledTimes(count);
});

it("requires exact boolean approval, bounded version and all approved localized notices", () => {
  expect(approvedTranscriptionNotice({}, "en")).toBeUndefined();
  expect(
    approvedTranscriptionNotice({ ...policy(), transcriptionProofApproved: "true" }, "en"),
  ).toBeUndefined();
  expect(
    approvedTranscriptionNotice(
      {
        ...policy(),
        transcriptionProcessingPolicy: { version: "v1", notices: { en: "Incomplete" } },
      },
      "en",
    ),
  ).toBeUndefined();
  expect(approvedTranscriptionNotice(policy(), "ta")).toEqual({
    version: "synthetic-v1",
    notice: "SYNTHETIC TA NOTICE — NOT COMPANY POLICY",
  });
});

it("renders unavailable without recording controls when default-off, and an unchecked upload acknowledgement in every locale", () => {
  const access = {
    origin: "http://127.0.0.1:8787",
    local: true,
    readCredential: vi.fn(),
    current: () => true,
  };
  const render = (locale: "en" | "ml" | "ta") =>
    renderToStaticMarkup(
      createElement(NativeTranscriptionControls, {
        access,
        locale,
        fontFamily: undefined,
        revision: 0,
        draftFence: { current: 0 },
        disabled: false,
        onReview: vi.fn(),
        onBusy: vi.fn(),
      }),
    );
  expect(render("en")).toContain(transcriptionText.en.unavailable);
  expect(render("en")).not.toContain("<button");
  config.extra = policy();
  for (const locale of ["en", "ml", "ta"] as const) {
    const html = render(locale);
    expect(html).toContain(transcriptionText[locale].record);
    expect(html).toContain(transcriptionText[locale].upload);
    expect(html).toContain(transcriptionText[locale].acknowledge);
    expect(html).toContain(`SYNTHETIC ${locale.toUpperCase()} NOTICE`);
    expect(html).toContain("synthetic-v1");
    expect(html).not.toContain('checked=""');
    expect(html).toContain('disabled=""');
  }
  expect(access.readCredential).not.toHaveBeenCalled();
});
