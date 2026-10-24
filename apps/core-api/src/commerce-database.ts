import type { Environment } from "@kandamkulathi/server/config";
import type { IdentityDependencies } from "@kandamkulathi/server/identity";
import {
  CommerceError,
  openingRowSchema,
} from "../../../packages/contracts/src/commerce-catalogue";
import { commercePaymentViewSchema } from "../../../packages/contracts/src/commerce-http";
import type { PaymentIntent } from "../../../packages/contracts/src/commerce-payments";
import type { BookingAuthorityLoader } from "../../../packages/database/src/booking";
import { type DatabaseContext, withDatabase } from "../../../packages/database/src/client";
import {
  CommerceCatalogueRepository,
  readCommerceCatalogue,
  readCommerceProduct,
} from "../../../packages/database/src/commerce-catalogue";
import {
  commerceLocationForClinic,
  loadCommerceClinicsInTransaction,
  readCommerceClinics,
} from "../../../packages/database/src/commerce-clinics";
import { CommerceOrdersRepository } from "../../../packages/database/src/commerce-orders";
import { createCommerceBookingPaymentHandlers } from "../../../packages/database/src/commerce-payment-bookings";
import { createCommerceFinancialHandlers } from "../../../packages/database/src/commerce-payment-orders";
import { CommercePaymentRepository } from "../../../packages/database/src/commerce-payments";
import {
  CommercePayments,
  type PaymentProvider,
  type RefundPolicy,
} from "../../../packages/domain/src/commerce-payments";
import type { CommerceDependencies, CommerceOperations } from "./commerce";
import type { CommercePrincipal } from "./commerce-authorization";
import { readCommerceStaffClinics, revalidateCommerceTransaction } from "./commerce-identity";

export interface CommerceDatabaseOptions {
  environment: Environment;
  coreDatabaseUrl: string;
  jobsDatabaseUrl: string;
  localProxy?: string;
  /** Trusted deployment namespace, never HTTP input. Defaults only for backward-compatible local transport. */
  resourceNamespace?: string;
  identity: IdentityDependencies;
  verifyMutationRequest: CommerceDependencies["verifyMutationRequest"];
  orderSource?: "web" | "native";
  /** Approved Razorpay adapter/configuration only. Missing provider stays unavailable. */
  paymentProvider?: PaymentProvider;
  refundPolicy?: RefundPolicy;
  bookingAuthorityLoader?: BookingAuthorityLoader;
  /** Request-bound cookie session fence in this already active owner transaction; no nested transaction/network. */
  guardInTransaction?: (context: DatabaseContext, principal: CommercePrincipal) => Promise<void>;
}

const paymentView = (intent: PaymentIntent) =>
  commercePaymentViewSchema.parse({
    intentId: intent.id,
    operationId: intent.operationId,
    subject: intent.subject,
    amountPaise: intent.amountPaise,
    currency: intent.currency,
    state: intent.state,
    providerOrderId: intent.providerOrderId,
  });

/** Real event-scoped database wiring; no in-memory order/stock/payment substitute. */
export function createCommerceDatabaseDependencies(
  options: CommerceDatabaseOptions,
): CommerceDependencies {
  const database = <T>(role: "core" | "jobs", work: (context: DatabaseContext) => Promise<T>) =>
    withDatabase(
      role === "core" ? options.coreDatabaseUrl : options.jobsDatabaseUrl,
      options.environment,
      role === "core" ? "k_core_runtime" : "k_jobs_runtime",
      work,
      options.localProxy,
      options.resourceNamespace,
    );
  const paymentStore = (context: DatabaseContext, principal: CommercePrincipal | null) => {
    const handlers = createCommerceFinancialHandlers(
      createCommerceBookingPaymentHandlers(
        principal?.identity ?? null,
        options.bookingAuthorityLoader,
      ),
    );
    return new CommercePaymentRepository(
      context,
      handlers.authority,
      options.refundPolicy,
      handlers.application,
      async (active, actorId) => {
        if (!principal || actorId !== principal.actorId) throw new CommerceError("denied");
        await options.guardInTransaction?.(active, principal);
        await revalidateCommerceTransaction(active, principal);
      },
    );
  };
  const payments = (
    context: DatabaseContext,
    role: "core" | "jobs",
    principal: CommercePrincipal | null,
  ) => {
    if (!options.paymentProvider) throw new CommerceError("unavailable");
    const store = paymentStore(context, principal);
    return new CommercePayments(
      store,
      options.paymentProvider,
      role === "jobs"
        ? store
        : {
            receive: (event) => database("jobs", (jobs) => paymentStore(jobs, null).receive(event)),
          },
    );
  };
  return {
    ...options.identity,
    verifyMutationRequest: options.verifyMutationRequest,
    loadCommerceGrants: (actorId) =>
      database("core", (context) => new CommerceOrdersRepository(context, actorId).grants()),
    async run(principal, work) {
      const actorId = () => {
        if (!principal) throw new CommerceError("denied");
        return principal.actorId;
      };
      const authorizeTransaction = (context: DatabaseContext) => {
        if (!principal) throw new CommerceError("denied");
        return (async () => {
          await options.guardInTransaction?.(context, principal);
          await revalidateCommerceTransaction(context, principal);
        })();
      };
      const catalogueOptions = {
        source: options.orderSource ?? "web",
        authorizeTransaction,
      } as const;
      const approvedLocation = async (context: DatabaseContext, locationId: string) => {
        await authorizeTransaction(context);
        if (
          !(await loadCommerceClinicsInTransaction(context)).some(
            (clinic) => clinic.locationId === locationId,
          )
        )
          throw new CommerceError("denied");
      };
      const operations: CommerceOperations = {
        clinics: () => database("core", readCommerceClinics),
        staffClinics: () => {
          if (!principal) throw new CommerceError("denied");
          return database("core", (context) =>
            readCommerceStaffClinics(
              context,
              principal,
              (active) => options.guardInTransaction?.(active, principal) ?? Promise.resolve(),
            ),
          );
        },
        catalogue: (page) =>
          database("core", (context) =>
            readCommerceCatalogue(context, {
              limit: page.limit,
              ...(page.after === undefined ? {} : { after: page.after }),
            }),
          ),
        product: (id) => database("core", (context) => readCommerceProduct(context, id)),
        quote: (input) =>
          database("core", (context) =>
            new CommerceCatalogueRepository(context, actorId(), {
              ...catalogueOptions,
              authorizeTransaction: (active) => approvedLocation(active, input.locationId),
            }).quote(input),
          ),
        checkout: (input) =>
          database("core", (context) =>
            new CommerceCatalogueRepository(context, actorId(), {
              ...catalogueOptions,
              authorizeTransaction: (active) => approvedLocation(active, input.locationId),
            }).checkout(input),
          ),
        orders: (page, clinicId) =>
          database("core", (context) =>
            new CommerceOrdersRepository(
              context,
              actorId(),
              authorizeTransaction,
              commerceLocationForClinic,
            ).orders(page, clinicId),
          ),
        order: (id, clinicId) =>
          database("core", (context) =>
            new CommerceOrdersRepository(
              context,
              actorId(),
              authorizeTransaction,
              commerceLocationForClinic,
            ).order(id, clinicId),
          ),
        batches: (page, clinicId) =>
          database("core", (context) =>
            new CommerceOrdersRepository(
              context,
              actorId(),
              authorizeTransaction,
              commerceLocationForClinic,
            ).batches(page, clinicId),
          ),
        importOpening: (input, clinicId) => {
          // Never let a single-clinic HTTP grant authorize rows from other locations.
          return database("core", (context) =>
            new CommerceCatalogueRepository(context, actorId(), {
              ...catalogueOptions,
              authorizeTransaction: async (active) => {
                await authorizeTransaction(active);
                const locationId = await commerceLocationForClinic(active, clinicId);
                for (const row of input.rows) {
                  const parsed = openingRowSchema.safeParse(row);
                  if (parsed.success && parsed.data.locationId !== locationId)
                    throw new CommerceError("denied");
                }
              },
            }).importOpening(input.operationId, input.rows, input.controls),
          );
        },
        createPayment: (input) =>
          database("core", async (context) =>
            paymentView(await payments(context, "core", principal).create(actorId(), input)),
          ),
        payment: (id) =>
          database("core", async (context) =>
            paymentView(await payments(context, "core", principal).get(actorId(), id)),
          ),
        reconcilePayment: (id) =>
          database("core", async (context) =>
            paymentView(await payments(context, "core", principal).reconcile(actorId(), id)),
          ),
        refund: (input) =>
          database("core", (context) =>
            payments(context, "core", principal).requestRefund(actorId(), input),
          ),
        webhook: (raw, signature, eventId) =>
          database("jobs", (context) =>
            payments(context, "jobs", null).webhook(raw, signature, eventId),
          ),
      };
      return work(operations);
    },
  };
}
