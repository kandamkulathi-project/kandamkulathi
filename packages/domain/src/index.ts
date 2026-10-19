import { moneyPaiseSchema, quantitySchema } from "@kandamkulathi/contracts";
/** Integer arithmetic only. Prices, tax and eligibility still require server/domain approval. */
export function lineSubtotalPaise(unitPricePaise: number, quantity: number): number {
  return moneyPaiseSchema.parse(
    moneyPaiseSchema.parse(unitPricePaise) * quantitySchema.parse(quantity),
  );
}
