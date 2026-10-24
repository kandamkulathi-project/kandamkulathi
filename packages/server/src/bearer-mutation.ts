import { browserOrigins } from "./browser-origins";
import { environmentSchema } from "./config";

/** Trusted operator configuration only; never reflect an arbitrary requesting Origin. */
export function approvedBearerOrigin(
  origin: string,
  requestUrl: string,
  bindings: Record<string, unknown>,
): boolean {
  if (!origin || origin === "null") return false;
  try {
    // requestUrl is deliberately not an authorization source; use the shared operator policy.
    void requestUrl;
    return browserOrigins(
      environmentSchema.parse(bindings.APP_ENV),
      bindings.BROWSER_ALLOWED_ORIGINS,
    ).includes(origin);
  } catch {
    return false;
  }
}

/** Nonambient Authorization is mandatory; cookie sessions are not a supported mutation credential. */
export function verifyBearerMutation(request: Request, bindings: Record<string, unknown>): boolean {
  const token = request.headers.get("authorization") ?? "";
  if (
    request.headers.has("cookie") ||
    token.length > 16384 ||
    !/^Bearer [A-Za-z0-9_.-]+$/.test(token)
  )
    return false;
  const origin = request.headers.get("origin");
  return origin === null || approvedBearerOrigin(origin, request.url, bindings);
}
