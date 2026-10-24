import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommerceOperations } from "../../apps/core-api/src/commerce";
import { unavailableCommerceDependencies } from "../../apps/core-api/src/commerce";
import type { CommercePrincipal } from "../../apps/core-api/src/commerce-authorization";
import { createCommerceDatabaseDependencies } from "../../apps/core-api/src/commerce-database";
import type { DatabaseContext } from "../../packages/database/src/client";
import { inTransaction } from "../../packages/database/src/client";
import { customerFixture, ids } from "./identity-fixtures";

const state = vi.hoisted(() => ({
  context: null as DatabaseContext | null,
  namespace: undefined as string | undefined,
}));
vi.mock("../../packages/database/src/client", async (original) => ({
  ...(await original<typeof import("../../packages/database/src/client")>()),
  withDatabase: async (
    _url: unknown,
    _environment: unknown,
    _role: unknown,
    callback: (context: DatabaseContext) => Promise<unknown>,
    _proxy: unknown,
    namespace?: string,
  ) => {
    state.namespace = namespace;
    if (!state.context) throw new Error("missing transport spy");
    return callback(state.context);
  },
}));

describe("request-bound commerce cookie fence composition", () => {
  const address = {
    recipientName: "Synthetic",
    line1: "Synthetic Street",
    city: "Test City",
    region: "Kerala",
    postalCode: "680001",
    country: "IN" as const,
    contactPhone: "+919999999999",
  };
  const cart = { locationId: ids.clinic, lines: [{ skuId: ids.other, quantity: 1 }] };
  const journeys: Array<[string, (service: CommerceOperations) => Promise<unknown>]> = [
    ["quote", (service) => service.quote(cart)],
    [
      "checkout",
      (service) =>
        service.checkout({
          ...cart,
          deliveryAddress: address,
          operationId: ids.other,
          confirmed: true,
          quoteKey: "synthetic",
          versions: { [ids.other]: 1 },
        }),
    ],
    ["orders", (service) => service.orders({ limit: 25 })],
    ["order", (service) => service.order(ids.other)],
    ["staff orders", (service) => service.orders({ limit: 25 }, ids.clinic)],
    ["staff batches", (service) => service.batches({ limit: 25 }, ids.clinic)],
    ["staff directory", (service) => service.staffClinics()],
    ["payment read", (service) => service.payment(ids.other)],
    [
      "payment create",
      (service) =>
        service.createPayment({
          operationId: ids.other,
          subject: { kind: "order", id: ids.other },
          method: "razorpay",
        }),
    ],
    ["payment reconcile", (service) => service.reconcilePayment(ids.other)],
    [
      "refund",
      (service) =>
        service.refund({ operationId: ids.other, intentId: ids.assignment, amountPaise: 1 }),
    ],
    [
      "import",
      (service) =>
        service.importOpening(
          {
            operationId: ids.other,
            rows: [
              {
                skuId: ids.other,
                sku: "SYNTHETIC",
                name: "Synthetic",
                variant: "one",
                description: "Synthetic",
                imageUrl: "https://example.invalid/synthetic",
                concerns: [],
                approvedBy: ids.actor,
                consultOnly: false,
                unitPaise: 1,
                taxPolicyId: ids.assignment,
                locationId: ids.clinic,
                batchId: ids.patient,
                batchCode: "synthetic",
                expiresOn: "2030-01-01",
                quantity: 1,
                minimumShelfLifeDays: 0,
              },
            ],
            controls: { rows: 1, units: 1, baseValuePaise: 1 },
          },
          ids.clinic,
        ),
    ],
  ];
  beforeEach(() => {
    state.context = null;
  });
  it.each(journeys)(
    "%s invokes the request fence in the active transaction before effects and rolls back logout denial",
    async (_name, journey) => {
      const query = vi.fn(async (sql: string) => ({
        rows: [],
        rowCount: 0,
        command: sql === "COMMIT" ? "COMMIT" : "",
      }));
      const context = { client: { query } } as unknown as DatabaseContext;
      state.context = context;
      const principal: CommercePrincipal = {
        allowed: true,
        actorId: ids.actor,
        sessionId: ids.session,
        identity: customerFixture().identity,
        clinicId: null,
        action: null,
        directory: true,
      };
      const fence = vi.fn(async (active: DatabaseContext, actor: CommercePrincipal) => {
        expect(active).toBe(context);
        expect(actor).toBe(principal);
        expect(inTransaction(active.client)).toBe(true);
        throw new Error("synthetic logged-out cookie fence");
      });
      const network = vi.fn(async (): Promise<never> => {
        throw new Error("unexpected provider network");
      });
      const dependencies = createCommerceDatabaseDependencies({
        environment: "local",
        coreDatabaseUrl: "unused",
        resourceNamespace: "kandamkulathi-approved-preview-synthetic",
        jobsDatabaseUrl: "unused",
        identity: unavailableCommerceDependencies,
        verifyMutationRequest: unavailableCommerceDependencies.verifyMutationRequest,
        guardInTransaction: fence,
        paymentProvider: {
          accountId: "acc_synthetic",
          createOrder: network,
          reconcileOrder: network,
          reconcileCapture: network,
          verifyWebhook: network,
        },
      });
      await expect(dependencies.run(principal, journey)).rejects.toThrow("logged-out cookie fence");
      expect(fence).toHaveBeenCalledOnce();
      expect(state.namespace).toBe("kandamkulathi-approved-preview-synthetic");
      expect(query).toHaveBeenLastCalledWith("ROLLBACK");
      expect(network).not.toHaveBeenCalled();
      expect(inTransaction(context.client)).toBe(false);
    },
  );
});
