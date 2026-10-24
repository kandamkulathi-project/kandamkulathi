import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { NativeCommerceController } from "../../apps/mobile/src/customer/commerceController";
import { NativeCommerceCustomerViews } from "../../apps/mobile/src/customer/NativeCommerceCustomerViews";
import { type Locale, nativeCommerceLabels } from "../../packages/i18n/src/index";
import { nativeCustomerSession } from "../fixtures/native-customer";
import {
  address,
  locationId,
  locations,
  payment,
  setup,
  skuId,
} from "./native-commerce-forms.fixtures";

const require = createRequire(new URL("../../apps/workspaces/package.json", import.meta.url));
const { createElement } = require("react") as {
  createElement(component: unknown, props?: object, ...children: unknown[]): unknown;
};
const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup(element: unknown): string;
};

// Synthetic host rendering verifies labels/semantics, not RN layout, SDKs or device support.
vi.mock("../../apps/mobile/node_modules/react-native", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(new URL("../../apps/workspaces/package.json", import.meta.url));
  const { createElement } = require("react") as {
    createElement(component: unknown, props?: object | null, ...children: unknown[]): unknown;
  };
  type HostProps = {
    children?: unknown;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityLiveRegion?: string;
    title?: string;
    disabled?: boolean;
    value?: string;
  };
  const view = ({ children }: HostProps) => createElement("div", null, children);
  return {
    AppState: { currentState: "active", addEventListener: vi.fn() },
    StyleSheet: { create: (styles: unknown) => styles },
    ScrollView: view,
    View: view,
    Text: ({ children, accessibilityRole, accessibilityLiveRegion }: HostProps) =>
      createElement(
        accessibilityRole === "header" ? "h2" : "span",
        { "aria-live": accessibilityLiveRegion },
        children,
      ),
    TextInput: ({ accessibilityLabel, value }: HostProps) =>
      createElement("input", { "aria-label": accessibilityLabel, value, readOnly: true }),
    Button: ({ title, accessibilityLabel, disabled }: HostProps) =>
      createElement(
        "button",
        { type: "button", "aria-label": accessibilityLabel, disabled },
        title,
      ),
  };
});

describe("native commerce operational locale wiring (synthetic hosts)", () => {
  for (const locale of ["en", "ml", "ta"] satisfies Locale[]) {
    it(`renders ${locale} explicit provider action and hides it during opening and unknown outcomes`, async () => {
      const base = setup();
      base.controller.dispose();
      base.api.createPayment.mockResolvedValue({
        status: "ready",
        data: { ...payment, state: "ready", providerOrderId: "order_synthetic123" },
      });
      let release: () => void = () => {};
      const controller = new NativeCommerceController({
        api: base.api,
        locations,
        session: () => nativeCustomerSession,
        active: () => true,
        uuid: base.uuid,
        hardware: {
          async launch(_payment, _signal, _current, stage) {
            stage("opening");
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            return { status: "unavailable" };
          },
        },
      });
      const render = () =>
        renderToStaticMarkup(
          createElement(NativeCommerceCustomerViews, { controller, locations, locale }),
        );
      try {
        await controller.loadCatalogue();
        controller.selectLocation(locationId);
        controller.setQuantity(skuId, 1);
        for (const key of Object.keys(address) as (keyof typeof address)[])
          controller.setAddress(key, address[key]);
        await controller.requestQuote();
        await controller.confirmCheckout();
        await controller.createPayment();
        expect(render()).toContain(nativeCommerceLabels[locale].payWithProvider);
        const opening = controller.openPayment();
        expect(render()).toContain(nativeCommerceLabels[locale].openingProvider);
        expect(render()).not.toContain(nativeCommerceLabels[locale].payWithProvider);
        release();
        await opening;
        expect(render()).toContain(nativeCommerceLabels[locale].providerUnavailable);
        expect(render()).not.toContain(nativeCommerceLabels[locale].payWithProvider);
        expect(controller.getSnapshot().payment?.intentId).toBe(payment.intentId);
      } finally {
        release();
        controller.dispose();
      }
    });
    it(`renders ${locale} address accessibility names, empty states and actions from the actual resources`, () => {
      const { controller } = setup();
      try {
        const html = renderToStaticMarkup(
          createElement(NativeCommerceCustomerViews, { controller, locations, locale }),
        );
        const labels = nativeCommerceLabels[locale];
        for (const key of ["recipientName", "line1", "postalCode", "contactPhone"] as const) {
          expect(html).toContain(`aria-label="${labels[key]}"`);
        }
        for (const key of [
          "translationNotice",
          "cartEmpty",
          "deliveryAddress",
          "requestQuote",
        ] as const)
          expect(html).toContain(labels[key]);
        expect(html).toContain("Synthetic approved location");
        expect(html).not.toContain("draft English");
        if (locale !== "en") expect(html).not.toContain('aria-label="Recipient name"');
      } finally {
        controller.dispose();
      }
    });
    it(`renders localized ${locale} validation and authoritative quote confirmation without changing server totals`, async () => {
      const { controller, fill } = setup();
      try {
        await controller.requestQuote();
        const invalid = renderToStaticMarkup(
          createElement(NativeCommerceCustomerViews, { controller, locations, locale }),
        );
        expect(invalid).toContain(nativeCommerceLabels[locale].invalid);
        expect(invalid).toContain('aria-live="polite"');
        await fill();
        await controller.requestQuote();
        const quoted = renderToStaticMarkup(
          createElement(NativeCommerceCustomerViews, { controller, locations, locale }),
        );
        expect(quoted).toContain(nativeCommerceLabels[locale].confirmNotice);
        expect(quoted).toContain(nativeCommerceLabels[locale].reviewQuote);
        expect(quoted).toContain("Synthetic Recipient");
      } finally {
        controller.dispose();
      }
    });
  }
});
