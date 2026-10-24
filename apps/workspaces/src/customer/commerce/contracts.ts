import type { Locale } from "@kandamkulathi/i18n";

// Proposed presentation projections. Domain/API owners must map and review these
// ports; they are NOT implemented HTTP endpoints or client-side business rules.
export type Taxonomy = { id: string; name: string };
export type Variant = {
  id: string;
  name: string;
  pricePaise: number;
  stock: "available" | "unavailable" | "pending";
  purchase: "allowed" | "consult_only" | "unavailable";
};
export type Product = {
  id: string;
  name: string;
  description: string;
  categoryIds: string[];
  concernIds: string[];
  variants: Variant[];
};
export type Catalogue = { categories: Taxonomy[]; concerns: Taxonomy[]; products: Product[] };
export type AddressInput = {
  recipient: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
};
export type Address = AddressInput & {
  id: string;
  serviceability: "available" | "unavailable" | "pending";
};
export type Order = {
  id: string;
  reference: string;
  totalPaise: number;
  status: "pending" | "confirmed" | "cancelled" | "fulfilled";
  payment: "pending" | "failed" | "paid" | "reconciliation_required";
  tracking: string;
  reorderAllowed: boolean;
};
export type PrivateCommerce = {
  ownerId: string;
  revision: string;
  account: { displayName: string };
  cart: {
    lines: { variantId: string; name: string; quantity: number; lineTotalPaise: number }[];
    totalPaise: number;
    pricing: "current" | "stale";
    checkoutAllowed: boolean;
  };
  addresses: Address[];
  orders: Order[];
  operation: "idle" | "pending" | "failed" | "reconciliation_required";
};
export type Failure = "anonymous" | "denied" | "unavailable" | "error" | "conflict";
export type Reply<T> = { status: "ready"; data: T } | { status: Failure };
export type RequestContext = { signal: AbortSignal; locale: Locale };
export type MutationContext = RequestContext & { operationId: string; revision: string };
export interface CommerceApi {
  catalogue(context: RequestContext): Promise<Reply<Catalogue>>;
  readPrivate(context: RequestContext): Promise<Reply<PrivateCommerce>>;
  addItem(
    input: { variantId: string; quantity: number },
    context: MutationContext,
  ): Promise<Reply<PrivateCommerce>>;
  setQuantity(
    input: { variantId: string; quantity: number },
    context: MutationContext,
  ): Promise<Reply<PrivateCommerce>>;
  saveAddress(input: AddressInput, context: MutationContext): Promise<Reply<PrivateCommerce>>;
  requestCheckout(
    input: { addressId: string },
    context: MutationContext,
  ): Promise<Reply<PrivateCommerce>>;
  reorder(input: { orderId: string }, context: MutationContext): Promise<Reply<PrivateCommerce>>;
}

type Parser<T> = (value: unknown) => T;
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid object");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || keys.some((key) => !Object.hasOwn(record, key)))
    throw new Error("Invalid fields");
  return record;
}
function text(value: unknown, max = 200): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    throw new Error("Invalid text");
  return value;
}
function integer(value: unknown, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min)
    throw new Error("Invalid integer");
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Invalid boolean");
  return value;
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error("Invalid state");
  return value as T;
}
function list<T>(value: unknown, parse: Parser<T>): T[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error("Invalid list");
  return value.map(parse);
}
function unique<T extends { id: string }>(values: T[]): T[] {
  if (new Set(values.map((value) => value.id)).size !== values.length)
    throw new Error("Duplicate reference");
  return values;
}
const id: Parser<string> = (value) => {
  const result = text(value, 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) throw new Error("Invalid reference");
  return result;
};
const taxonomy: Parser<Taxonomy> = (value) => {
  const r = object(value, ["id", "name"]);
  return { id: id(r.id), name: text(r.name) };
};
export const parseCatalogue: Parser<Catalogue> = (value) => {
  const r = object(value, ["categories", "concerns", "products"]);
  const categories = unique(list(r.categories, taxonomy));
  const concerns = unique(list(r.concerns, taxonomy));
  const products = unique(
    list(r.products, (value): Product => {
      const p = object(value, [
        "id",
        "name",
        "description",
        "categoryIds",
        "concernIds",
        "variants",
      ]);
      const categoryIds = list(p.categoryIds, id);
      const concernIds = list(p.concernIds, id);
      if (
        categoryIds.some((id) => !categories.some((c) => c.id === id)) ||
        concernIds.some((id) => !concerns.some((c) => c.id === id))
      )
        throw new Error("Unknown taxonomy");
      return {
        id: id(p.id),
        name: text(p.name),
        description: text(p.description, 8000),
        categoryIds,
        concernIds,
        variants: unique(
          list(p.variants, (value): Variant => {
            const v = object(value, ["id", "name", "pricePaise", "stock", "purchase"]);
            return {
              id: id(v.id),
              name: text(v.name),
              pricePaise: integer(v.pricePaise),
              stock: choice(v.stock, ["available", "unavailable", "pending"]),
              purchase: choice(v.purchase, ["allowed", "consult_only", "unavailable"]),
            };
          }),
        ),
      };
    }),
  );
  const variants = products.flatMap((p) => p.variants);
  unique(variants);
  return { categories, concerns, products };
};
export const parseAddress: Parser<AddressInput> = (value) => {
  const r = object(value, ["recipient", "line1", "city", "state", "pincode", "phone"]);
  const pincode = text(r.pincode, 6);
  const phone = text(r.phone, 16);
  if (!/^[1-9]\d{5}$/.test(pincode) || !/^\+?[0-9]{10,15}$/.test(phone))
    throw new Error("Invalid pincode or phone");
  return {
    recipient: text(r.recipient, 100),
    line1: text(r.line1, 300),
    city: text(r.city, 100),
    state: text(r.state, 100),
    pincode,
    phone,
  };
};
export function parseQuantity(value: unknown): number {
  const quantity = integer(
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
    0,
  );
  if (quantity > 999) throw new Error("Invalid quantity");
  return quantity;
}
export function parsePrivate(value: unknown, ownerId: string): PrivateCommerce {
  const r = object(value, [
    "ownerId",
    "revision",
    "account",
    "cart",
    "addresses",
    "orders",
    "operation",
  ]);
  if (id(r.ownerId) !== ownerId) throw new Error("Owner mismatch");
  const account = object(r.account, ["displayName"]);
  const cart = object(r.cart, ["lines", "totalPaise", "pricing", "checkoutAllowed"]);
  const lines = list(cart.lines, (value) => {
    const l = object(value, ["variantId", "name", "quantity", "lineTotalPaise"]);
    const quantity = parseQuantity(l.quantity);
    if (quantity === 0) throw new Error("Invalid cart line");
    return {
      variantId: id(l.variantId),
      name: text(l.name),
      quantity,
      lineTotalPaise: integer(l.lineTotalPaise),
    };
  });
  if (new Set(lines.map((l) => l.variantId)).size !== lines.length)
    throw new Error("Duplicate line");
  return {
    ownerId,
    revision: id(r.revision),
    account: { displayName: text(account.displayName) },
    cart: {
      lines,
      totalPaise: integer(cart.totalPaise),
      pricing: choice(cart.pricing, ["current", "stale"]),
      checkoutAllowed: bool(cart.checkoutAllowed),
    },
    addresses: unique(
      list(r.addresses, (value): Address => {
        const a = object(value, [
          "id",
          "recipient",
          "line1",
          "city",
          "state",
          "pincode",
          "phone",
          "serviceability",
        ]);
        const { id: reference, serviceability, ...input } = a;
        return {
          ...parseAddress(input),
          id: id(reference),
          serviceability: choice(serviceability, ["available", "unavailable", "pending"]),
        };
      }),
    ),
    orders: unique(
      list(r.orders, (value): Order => {
        const o = object(value, [
          "id",
          "reference",
          "totalPaise",
          "status",
          "payment",
          "tracking",
          "reorderAllowed",
        ]);
        return {
          id: id(o.id),
          reference: text(o.reference),
          totalPaise: integer(o.totalPaise),
          status: choice(o.status, ["pending", "confirmed", "cancelled", "fulfilled"]),
          payment: choice(o.payment, ["pending", "failed", "paid", "reconciliation_required"]),
          tracking: text(o.tracking, 1000),
          reorderAllowed: bool(o.reorderAllowed),
        };
      }),
    ),
    operation: choice(r.operation, ["idle", "pending", "failed", "reconciliation_required"]),
  };
}
export function parseReply<T>(value: unknown, parse: Parser<T>): Reply<T> {
  if (!value || typeof value !== "object" || !("status" in value)) throw new Error("Invalid reply");
  if (value.status === "ready") {
    const r = object(value, ["status", "data"]);
    return { status: "ready", data: parse(r.data) };
  }
  const r = object(value, ["status"]);
  return { status: choice(r.status, ["anonymous", "denied", "unavailable", "error", "conflict"]) };
}
