import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import Welcome from "../../apps/web-public/src/components/Welcome";
import { LanguageSelect } from "../../packages/ui/src/index";

// Resolve the application's existing React dependencies; no extra test/runtime dependency.
const require = createRequire(new URL("../../apps/web-public/package.json", import.meta.url));
const { createElement } = require("react") as {
  createElement(component: unknown, props?: object): unknown;
};
const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup(element: unknown): string;
};

describe("public locale hydration boundary", () => {
  it("renders the server-side locale control disabled until handlers attach", () => {
    const html = renderToStaticMarkup(createElement(Welcome));
    expect(html).toMatch(/<select[^>]*disabled=""/);
    expect(html).toContain("Kandamkulathi");
  });
  it("does not disable other language controls unless requested", () => {
    const props = { locale: "en", onChange() {} };
    expect(renderToStaticMarkup(createElement(LanguageSelect, props))).not.toContain('disabled=""');
    expect(
      renderToStaticMarkup(createElement(LanguageSelect, { ...props, disabled: true })),
    ).toMatch(/<select[^>]*disabled=""/);
  });
});
