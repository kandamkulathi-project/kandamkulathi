import { deliveryAddressSchema } from "../../../../../packages/contracts/src/commerce-address";
import {
  type CommerceProduct,
  cartSchema,
  checkoutSchema,
  commerceCataloguePageSchema,
  commerceCheckoutSchema,
  commerceProductSchema,
  commerceQuoteSchema,
} from "../../../../../packages/contracts/src/commerce-catalogue";
import { commercePaymentCheckoutSchema } from "../../../../../packages/contracts/src/commerce-checkout";
import {
  commercePaymentViewSchema,
  commerceReconcileRequestSchema,
} from "../../../../../packages/contracts/src/commerce-http";
import {
  commerceOrderDetailSchema,
  commerceOrderPageSchema,
} from "../../../../../packages/contracts/src/commerce-orders";
import { createPaymentSchema } from "../../../../../packages/contracts/src/commerce-payments";
import type { AuthoritativeCommerceSchemas } from "./authoritative-api";

/** Direct authoritative parsers and display-only field mapping. There are no
 * duplicated pricing, stock, authorization or medical eligibility rules here. */
export const commercePresentationSchemas: AuthoritativeCommerceSchemas<CommerceProduct> = {
  cataloguePage: commerceCataloguePageSchema,
  product: commerceProductSchema,
  cart: cartSchema,
  checkoutInput: checkoutSchema,
  quote: commerceQuoteSchema,
  reservation: commerceCheckoutSchema,
  orderPage: commerceOrderPageSchema,
  orderDetail: commerceOrderDetailSchema,
  paymentInput: createPaymentSchema,
  payment: commercePaymentViewSchema,
  paymentCheckout: commercePaymentCheckoutSchema,
  reconcileInput: commerceReconcileRequestSchema,
  deliveryAddress: deliveryAddressSchema,
  presentProduct: (product) => ({
    reference: product.skuId,
    title: product.name,
    description: product.description,
    concerns: product.concerns,
    variants: [{ reference: product.skuId, title: product.variant }],
    displayPricePaise: product.unitPaise,
    stockStatus: product.stockStatus,
    consultOnly: product.consultOnly,
    image: { src: product.imageUrl, alt: product.name },
  }),
};
