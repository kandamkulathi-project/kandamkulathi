import { apiVersion, type Service } from "@kandamkulathi/contracts";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

export type ServiceRuntime = { Bindings: { APP_ENV?: string }; Variables: { requestId: string } };
export type ServiceOptions = { registerRoutes?: (app: Hono<ServiceRuntime>) => void };
/** Shared HTTP boundary only; no session bypass, provider calls or business success stubs. */
export function createService(
  service: Service,
  _reservedLogSink?: undefined,
  options?: ServiceOptions,
) {
  const app = new Hono<ServiceRuntime>();
  app.use("*", async (context, next) => {
    context.set("requestId", crypto.randomUUID());
    context.header("X-Request-ID", context.get("requestId"));
    context.header("Cache-Control", "no-store");
    await next();
  });
  app.use("*", secureHeaders());
  app.use("*", (context, next) => {
    const origin = context.req.header("Origin") ?? "";
    const approved =
      context.env?.APP_ENV === "local" &&
      [
        "http://localhost:4321",
        "http://127.0.0.1:4321",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
      ].includes(origin);
    return cors({
      origin: approved ? origin : [],
      credentials: approved,
      allowMethods: ["GET", "HEAD", "OPTIONS"],
      exposeHeaders: ["X-Request-ID"],
    })(context, next);
  });
  app.use(
    "*",
    bodyLimit({
      maxSize: 64 * 1024,
      onError: (context) =>
        context.json(
          {
            error: {
              code: "PAYLOAD_TOO_LARGE",
              message: "Request exceeds the allowed size.",
              requestId: context.get("requestId"),
            },
          },
          413,
        ),
    }),
  );
  app.get("/health/live", (context) =>
    context.json({ service, status: "alive", stage: "scaffold" }),
  );
  app.get("/health/ready", (context) =>
    context.json(
      {
        error: {
          code: "APPLICATION_NOT_READY",
          message: "Application integrations and acceptance are pending.",
          requestId: context.get("requestId"),
        },
      },
      503,
    ),
  );
  app.get("/v1/system/status", (context) =>
    context.json({
      apiVersion,
      service,
      stage: "scaffold",
      ready: false,
      capabilities: {
        identity: "pending",
        commerce: "pending",
        consultations: "pending",
        companion: "pending",
      },
    }),
  );
  options?.registerRoutes?.(app);
  app.all("/v1/*", (context) =>
    context.json(
      {
        error: {
          code: "FEATURE_UNAVAILABLE",
          message: "This feature is not implemented in the starter.",
          requestId: context.get("requestId"),
        },
      },
      503,
    ),
  );
  app.notFound((context) =>
    context.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Route not found.",
          requestId: context.get("requestId"),
        },
      },
      404,
    ),
  );
  app.onError((_error, context) =>
    context.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to complete the request.",
          requestId: context.get("requestId"),
        },
      },
      500,
    ),
  );
  return app;
}
