import { describe, expect, it } from "vitest";
import { customerCheckoutInput } from "../../apps/workspaces/src/customer/commerce/authoritative-api";
import { commercePresentationSchemas } from "../../apps/workspaces/src/customer/commerce/domainSchemas";
import {
  cartSchema,
  checkoutSchema,
  commerceProductSchema,
} from "../../packages/contracts/src/commerce-catalogue";

const product = {
  skuId: "00000000-0000-4000-8000-000000000001",
  sku: "SYNTHETIC-PACK",
  name: "Synthetic product",
  variant: "Synthetic pack",
  description: "Synthetic approved-description fixture; not medical advice.",
  imageUrl: "https://images.example.test/synthetic-product.webp",
  concerns: ["Synthetic concern"],
  unitPaise: 12000,
  version: 1,
  consultOnly: true,
  stockStatus: "unknown",
};

describe("canonical customer schema wiring", () => {
  it("uses the exact domain parsers instead of duplicating business validation", () => {
    expect(commercePresentationSchemas.cart).toBe(cartSchema);
    expect(commercePresentationSchemas.checkoutInput).toBe(checkoutSchema);
    expect(commercePresentationSchemas.product).toBe(commerceProductSchema);
  });
  it("maps only authoritative public fields and keeps stock/consultation truth", () => {
    const parsed = commercePresentationSchemas.product?.parse(product);
    if (!parsed || !commercePresentationSchemas.presentProduct) throw Error("Missing parser");
    expect(commercePresentationSchemas.presentProduct(parsed)).toEqual({
      reference: product.skuId,
      title: product.name,
      description: product.description,
      concerns: product.concerns,
      variants: [{ reference: product.skuId, title: product.variant }],
      displayPricePaise: 12000,
      stockStatus: "unknown",
      consultOnly: true,
      image: { src: product.imageUrl, alt: product.name },
    });
  });
  it("rejects fractional money and private/unknown fields through the domain parser", () => {
    expect(() =>
      commercePresentationSchemas.product?.parse({ ...product, unitPaise: 1.5 }),
    ).toThrow();
    expect(() =>
      commercePresentationSchemas.product?.parse({ ...product, ownerId: product.skuId }),
    ).toThrow();
  });
  it("constructs the actual checkout command without client-controlled source or totals", () => {
    const input = customerCheckoutInput(
      {
        cart: { locationId: product.skuId, lines: [{ skuId: product.skuId, quantity: 1 }] },
        quote: {
          lines: [
            {
              skuId: product.skuId,
              quantity: 1,
              version: 3,
              unitPaise: 12000,
              taxPaise: 0,
              amountPaise: 12000,
              taxPolicyId: product.skuId,
              rateBps: 0,
            },
          ],
          amountPaise: 12000,
          currency: "INR",
          quoteKey: "synthetic-current-quote",
        },
        deliveryAddress: {
          recipientName: "Synthetic recipient",
          line1: "1 Test Street",
          city: "Test City",
          region: "Kerala",
          postalCode: "680001",
          country: "IN",
          contactPhone: "+919999999999",
        },
        operationId: "00000000-0000-4000-8000-000000000002",
      },
      checkoutSchema,
    );
    expect(checkoutSchema.parse(input)).toEqual(input);
    expect(input).not.toHaveProperty("source");
    expect(input).not.toHaveProperty("amountPaise");
    expect(checkoutSchema.safeParse({ ...input, source: "web" }).success).toBe(false);
    expect(input.versions).toEqual({ [product.skuId]: 3 });
  });
});
