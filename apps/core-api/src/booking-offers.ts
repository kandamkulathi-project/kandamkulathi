import type { ServiceOptions } from "@kandamkulathi/server";
import { bookingOffersQuerySchema } from "../../../packages/contracts/src/booking-offers.ts";
import {
  readBookingMetadata,
  readBookingOffers,
} from "../../../packages/database/src/booking-offers.ts";
import type { DatabaseContext } from "../../../packages/database/src/client.ts";

export interface BookingOffersDependencies {
  withContext<T>(callback: (context: DatabaseContext) => Promise<T>): Promise<T>;
}
/** Public GET only. No browser/bearer mutation or authentication policy is changed. */
export function registerBookingOffersRoutes(
  app: Parameters<NonNullable<ServiceOptions["registerRoutes"]>>[0],
  dependencies: BookingOffersDependencies,
): void {
  app.get("/v1/booking-metadata", async (context) => {
    context.header("Cache-Control", "no-store");
    try {
      return context.json(await dependencies.withContext(readBookingMetadata));
    } catch {
      return context.json({ error: { code: "BOOKING_METADATA_UNAVAILABLE" } }, 503);
    }
  });
  app.get("/v1/booking-offers", async (context) => {
    context.header("Cache-Control", "no-store");
    const entries = [...new URL(context.req.url).searchParams.entries()];
    if (new Set(entries.map(([key]) => key)).size !== entries.length)
      return context.json({ error: { code: "INVALID_REQUEST" } }, 400);
    const raw = Object.fromEntries(entries);
    const query = bookingOffersQuerySchema.safeParse({
      ...raw,
      ...(raw.limit === undefined
        ? {}
        : { limit: /^[1-9]\d{0,2}$/.test(raw.limit) ? Number(raw.limit) : Number.NaN }),
    });
    if (!query.success) return context.json({ error: { code: "INVALID_REQUEST" } }, 400);
    try {
      return context.json(
        await dependencies.withContext((database) => readBookingOffers(database, query.data)),
      );
    } catch {
      return context.json({ error: { code: "BOOKING_OFFERS_UNAVAILABLE" } }, 503);
    }
  });
}
