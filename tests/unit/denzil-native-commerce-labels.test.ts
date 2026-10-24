import { describe, expect, it } from "vitest";
import {
  formatNativeCommerceLabel,
  nativeCommerceLabels,
  nativeCommerceTranslationReview,
} from "../../packages/i18n/src/native-commerce";

describe("draft native commerce operational labels", () => {
  it("has identical nonblank EN/ML/TA keys and interpolation contracts", () => {
    const keys = Object.keys(nativeCommerceLabels.en).sort();
    expect(keys.length).toBeGreaterThan(45);
    for (const locale of ["en", "ml", "ta"] as const) {
      expect(Object.keys(nativeCommerceLabels[locale]).sort()).toEqual(keys);
      for (const key of Object.keys(
        nativeCommerceLabels.en,
      ) as (keyof typeof nativeCommerceLabels.en)[]) {
        const value = nativeCommerceLabels[locale][key];
        expect(value.trim()).not.toBe("");
        const placeholders = (text: string) =>
          [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map((match) => match[1]).sort();
        expect(placeholders(value)).toEqual(placeholders(nativeCommerceLabels.en[key]));
        expect(
          Array.from(value).some(
            (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
          ),
        ).toBe(false);
      }
    }
  });

  it("marks translations unreviewed and supplies actual Malayalam/Tamil operational copy", () => {
    expect(nativeCommerceTranslationReview).toBe("draft-unreviewed-nonclinical");
    for (const key of [
      "translationNotice",
      "uncertain",
      "conflict",
      "deliveryAddress",
      "paymentPending",
    ] as const) {
      expect(nativeCommerceLabels.ml[key]).toMatch(/[\u0d00-\u0d7f]/);
      expect(nativeCommerceLabels.ta[key]).toMatch(/[\u0b80-\u0bff]/);
    }
  });

  it.each(["en", "ml", "ta"] as const)(
    "preserves external values as literal text in %s",
    (locale) => {
      const name = "Synthetic {amount} <SKU> தமிழ் മലയാളം";
      expect(formatNativeCommerceLabel(locale, "addProduct", { name })).toContain(name);
      const line = formatNativeCommerceLabel(locale, "quoteLine", {
        id: "syn-sku-1",
        quantity: 2,
        amount: "₹125.00",
        tax: "₹0.00",
      });
      for (const value of ["syn-sku-1", "2", "₹125.00", "₹0.00"]) expect(line).toContain(value);
      expect(line).not.toMatch(/\{(?:id|quantity|amount|tax)\}/);
    },
  );

  it("rejects missing and extra substitutions instead of emitting incomplete labels", () => {
    expect(() => formatNativeCommerceLabel("en", "quantity", {})).toThrow("exact template values");
    expect(() =>
      formatNativeCommerceLabel("ml", "quantity", { name: "Synthetic", amount: 0 }),
    ).toThrow("exact template values");
    expect(formatNativeCommerceLabel("ta", "products", {})).toBe(nativeCommerceLabels.ta.products);
  });

  it("keeps reservation, captured payment and uncertainty notices distinct", () => {
    expect(nativeCommerceLabels.en.confirmNotice).toContain("does not mean payment was received");
    expect(nativeCommerceLabels.en.paymentCaptured).toContain("fulfilment is separate");
    expect(nativeCommerceLabels.en.uncertain).toContain("SAME operation");
    expect(nativeCommerceLabels.en.restored).toContain("not current success");
  });
});
