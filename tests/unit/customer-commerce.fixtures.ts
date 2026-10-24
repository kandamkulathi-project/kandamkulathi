import type {
  Catalogue,
  PrivateCommerce,
} from "../../apps/workspaces/src/customer/commerce/contracts";

// Deterministic synthetic projections only. No company catalogue/health records.
export const commerceOwner = "00000000-0000-4000-8000-000000000001";
export const commerceCatalogue: Catalogue = {
  categories: [{ id: "category-a", name: "Synthetic category" }],
  concerns: [{ id: "concern-a", name: "Synthetic concern" }],
  products: [
    {
      id: "product-a",
      name: "Synthetic product",
      description: "Approved-description fixture, not medical advice.",
      categoryIds: ["category-a"],
      concernIds: ["concern-a"],
      variants: [
        {
          id: "variant-a",
          name: "Synthetic pack",
          pricePaise: 12000,
          stock: "available",
          purchase: "allowed",
        },
        {
          id: "variant-consult",
          name: "Restricted pack",
          pricePaise: 15000,
          stock: "available",
          purchase: "consult_only",
        },
      ],
    },
  ],
};
export const commercePrivate: PrivateCommerce = {
  ownerId: commerceOwner,
  revision: "revision-1",
  account: { displayName: "Synthetic customer" },
  cart: {
    lines: [{ variantId: "variant-a", name: "Synthetic pack", quantity: 2, lineTotalPaise: 24000 }],
    totalPaise: 25000,
    pricing: "current",
    checkoutAllowed: true,
  },
  addresses: [
    {
      id: "address-a",
      recipient: "Synthetic recipient",
      line1: "1 Test Street",
      city: "Test City",
      state: "Kerala",
      pincode: "680001",
      phone: "9999999999",
      serviceability: "available",
    },
  ],
  orders: [
    {
      id: "order-a",
      reference: "SYNTHETIC-001",
      totalPaise: 25000,
      status: "pending",
      payment: "pending",
      tracking: "Pending courier verification",
      reorderAllowed: true,
    },
  ],
  operation: "idle",
};
