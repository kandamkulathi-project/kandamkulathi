import type { ServiceOptions } from "@kandamkulathi/server";
import { bookingIdSchema } from "../../../packages/contracts/src/booking.ts";
import {
  type BookingAuthorityLoader,
  BookingRuntimeError,
  bookingPrincipalSchema,
  isBookingValidationError,
  persistBookingHold,
  persistedHoldSchema,
  readBooking,
  readBookingAvailability,
  readBookingDirectory,
} from "../../../packages/database/src/booking.ts";
import type { DatabaseContext } from "../../../packages/database/src/client.ts";
import type { IdentityMutationDecision } from "./identity-runtime";

export interface BookingDependencies {
  loadAuthority: BookingAuthorityLoader;
  /** Real provider proof only. Request actor/role/scope headers are never evidence. */
  verifySession(
    request: Request,
  ): Promise<
    { status: "verified"; identity: unknown } | { status: "unauthenticated" | "unavailable" }
  >;
  /** Validate CSRF/session binding + approved origin, or reviewed bearer-only native proof. */
  verifyMutation(request: Request): Promise<IdentityMutationDecision>;
  /** Event-scoped non-owner CORE role connection, supplied by platform withDatabase. */
  withContext<T>(callback: (context: DatabaseContext) => Promise<T>): Promise<T>;
  guardInTransaction?(
    context: DatabaseContext,
    request: Request,
    principal: Parameters<BookingAuthorityLoader>[1],
  ): Promise<void>;
}

/** Register through createService's third argument, before its fail-closed fallback.
 * No capture, refund, clinical-data or configuration-write HTTP route is exposed.
 */
export function registerBookingRoutes(
  app: Parameters<NonNullable<ServiceOptions["registerRoutes"]>>[0],
  dependencies: BookingDependencies,
): void {
  const withContext: BookingDependencies["withContext"] = async (callback) => {
    try {
      return await dependencies.withContext(callback);
    } catch (error) {
      // Invalid stored configuration/provider facts are server unavailability,
      // not a request validation failure attributed to the customer.
      if (isBookingValidationError(error)) throw new BookingRuntimeError("UNAVAILABLE");
      throw error;
    }
  };
  const failure = (error: unknown) => {
    if (isBookingValidationError(error) || error instanceof SyntaxError)
      return { status: 400 as const, code: "INVALID_REQUEST" };
    if (error instanceof BookingRuntimeError) {
      if (error.code === "DENIED") return { status: 403 as const, code: "FORBIDDEN" };
      if (error.code === "CONFLICT") return { status: 409 as const, code: "BOOKING_CONFLICT" };
    }
    return { status: 503 as const, code: "BOOKING_UNAVAILABLE" };
  };
  app.get("/v1/doctors", async (context) => {
    try {
      return context.json({ doctors: await withContext(readBookingDirectory) });
    } catch (error) {
      const result = failure(error);
      return context.json({ error: { code: result.code } }, result.status);
    }
  });
  app.get("/v1/doctors/:id/availability", async (context) => {
    try {
      const id = bookingIdSchema.parse(context.req.param("id"));
      return context.json({
        windows: await withContext((database) => readBookingAvailability(database, id)),
      });
    } catch (error) {
      const result = failure(error);
      return context.json({ error: { code: result.code } }, result.status);
    }
  });
  app.get("/v1/availability", async (context) => {
    try {
      const id = bookingIdSchema.parse(context.req.query("doctorId"));
      return context.json({
        windows: await withContext((database) => readBookingAvailability(database, id)),
      });
    } catch (error) {
      const result = failure(error);
      return context.json({ error: { code: result.code } }, result.status);
    }
  });
  app.post("/v1/bookings", async (context) => {
    try {
      const verification = await dependencies.verifySession(context.req.raw);
      if (verification.status !== "verified")
        return context.json(
          {
            error: {
              code:
                verification.status === "unauthenticated"
                  ? "UNAUTHENTICATED"
                  : "IDENTITY_UNAVAILABLE",
            },
          },
          verification.status === "unauthenticated" ? 401 : 503,
        );
      const parsedIdentity = bookingPrincipalSchema.safeParse(verification.identity);
      if (!parsedIdentity.success)
        return context.json({ error: { code: "IDENTITY_UNAVAILABLE" } }, 503);
      const principal = parsedIdentity.data;
      const mutation = await dependencies.verifyMutation(context.req.raw);
      if (mutation === "unavailable")
        return context.json({ error: { code: "IDENTITY_UNAVAILABLE" } }, 503);
      if (mutation !== "allowed") return context.json({ error: { code: "FORBIDDEN" } }, 403);
      if (!context.req.header("Content-Type")?.toLowerCase().startsWith("application/json"))
        return context.json({ error: { code: "INVALID_REQUEST" } }, 400);
      const command = persistedHoldSchema.parse(await context.req.json());
      const booking = await withContext((database) =>
        persistBookingHold(database, principal, command, async (transaction, verified) => {
          await dependencies.guardInTransaction?.(transaction, context.req.raw, verified);
          return dependencies.loadAuthority(transaction, verified);
        }),
      );
      return context.json({ booking, persisted: true }, 200);
    } catch (error) {
      const result = failure(error);
      return context.json({ error: { code: result.code } }, result.status);
    }
  });
  app.get("/v1/bookings/history", (context) =>
    context.json({ error: { code: "FEATURE_UNAVAILABLE" } }, 503),
  );
  app.get("/v1/bookings/:id", async (context) => {
    try {
      const verification = await dependencies.verifySession(context.req.raw);
      if (verification.status !== "verified")
        return context.json(
          {
            error: {
              code:
                verification.status === "unauthenticated"
                  ? "UNAUTHENTICATED"
                  : "IDENTITY_UNAVAILABLE",
            },
          },
          verification.status === "unauthenticated" ? 401 : 503,
        );
      const parsedIdentity = bookingPrincipalSchema.safeParse(verification.identity);
      if (!parsedIdentity.success)
        return context.json({ error: { code: "IDENTITY_UNAVAILABLE" } }, 503);
      const principal = parsedIdentity.data;
      const id = bookingIdSchema.parse(context.req.param("id"));
      const booking = await withContext((database) =>
        readBooking(database, principal, id, async (transaction, verified) => {
          await dependencies.guardInTransaction?.(transaction, context.req.raw, verified);
          return dependencies.loadAuthority(transaction, verified);
        }),
      );
      return context.json({ booking, persisted: true });
    } catch (error) {
      const result = failure(error);
      return context.json({ error: { code: result.code } }, result.status);
    }
  });
}
