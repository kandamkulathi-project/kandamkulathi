import { expect, test } from "@playwright/test";

// Browser transport contract test. UI scenarios are in customer-commerce.spec.ts;
// authoritative product rendering additionally needs the frozen shared schema.
test("real browser HTTP boundary uses frozen quote/reservation paths and retains operation identity", async ({
  page,
}) => {
  await page.route("**/__test/session", (route) =>
    route.fulfill({ status: 401, json: { error: { code: "UNAUTHENTICATED" } } }),
  );
  await page.route("**/__test/commerce/*", (route) =>
    route.fulfill({ status: 503, json: { status: "unavailable" } }),
  );
  const locationId = "00000000-0000-4000-8000-000000000001";
  const skuId = "00000000-0000-4000-8000-000000000002";
  const operationId = "00000000-0000-4000-8000-000000000003";
  const cart = { locationId, lines: [{ skuId, quantity: 2 }] };
  const quote = {
    lines: [
      {
        skuId,
        quantity: 2,
        version: 3,
        unitPaise: 100,
        taxPaise: 10,
        amountPaise: 210,
        taxPolicyId: locationId,
        rateBps: 500,
      },
    ],
    amountPaise: 210,
    currency: "INR",
    quoteKey: "synthetic-quote",
  };
  const checkout = {
    ...cart,
    deliveryAddress: {
      recipientName: "Synthetic recipient",
      line1: "1 Test Street",
      city: "Test City",
      region: "Kerala",
      postalCode: "680001",
      country: "IN",
      contactPhone: "+919999999999",
    },
    operationId,
    confirmed: true,
    quoteKey: quote.quoteKey,
    versions: { [skuId]: 3 },
  };
  const reservation = {
    orderId: operationId,
    amountPaise: 210,
    currency: "INR",
    status: "reserved",
    expiresAt: "2026-10-24T12:00:00.000Z",
  };
  const bodies: unknown[] = [];
  await page.route("**/v1/cart/quote", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual(cart);
    await route.fulfill({ json: quote });
  });
  await page.route("**/v1/checkout", async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill(
      bodies.length === 1
        ? {
            status: 503,
            json: {
              error: { code: "COMMERCE_UNAVAILABLE", message: "redacted", requestId: "synthetic" },
            },
          }
        : { status: 201, json: reservation },
    );
  });
  await page.goto("http://127.0.0.1:5184/commerce");
  const result = await page.evaluate(
    async ({ modulePath, cart, quote, checkout, reservation }) => {
      const { createAuthoritativeCommerceApi } = await import(/* @vite-ignore */ modulePath);
      // Exact finite synthetic parsers; production consumes the shared domain Zod schemas.
      const schema = (expected: unknown) => ({
        parse(value: unknown) {
          if (JSON.stringify(expected) !== JSON.stringify(value))
            throw new Error("Invalid test fixture");
          return value;
        },
      });
      const api = createAuthoritativeCommerceApi(
        {
          origin: location.origin,
          authorizeMutation: async () => ({ "X-Test-CSRF": "synthetic" }),
        },
        {
          cart: schema(cart),
          quote: schema(quote),
          checkoutInput: schema(checkout),
          reservation: schema(reservation),
        },
      );
      const quoteReply = await api.quote(cart, new AbortController().signal);
      const first = await api.checkout(checkout, new AbortController().signal);
      const second = await api.checkout(checkout, new AbortController().signal);
      return { quoteReply, first, second };
    },
    {
      modulePath: `/@fs${process.cwd()}/apps/workspaces/src/customer/commerce/authoritative-api.ts`,
      cart,
      quote,
      checkout,
      reservation,
    },
  );
  expect(result.quoteReply).toEqual({ status: "ready", data: quote });
  expect(result.first).toEqual({ status: "unavailable" });
  expect(result.second).toEqual({ status: "ready", data: reservation });
  expect(bodies).toEqual([checkout, checkout]);
  expect(bodies[0]).not.toHaveProperty("amountPaise");
  expect(bodies[0]).not.toHaveProperty("payment");
});
