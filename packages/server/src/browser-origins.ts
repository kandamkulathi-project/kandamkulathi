import { ConfigurationError, type Environment } from "./config";

const localOrigins = [
  "http://localhost:4321",
  "http://127.0.0.1:4321",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;

export const browserMethods = ["GET", "HEAD", "OPTIONS", "POST"];
export const browserHeaders = ["Content-Type", "Authorization", "X-CSRF-Token", "Idempotency-Key"];

/** Exact, canonical origins only. A CORS grant is never authentication or CSRF proof. */
export function browserOrigins(environment: Environment, configured: unknown): readonly string[] {
  if (configured !== undefined && typeof configured !== "string") throw new ConfigurationError();
  if (environment === "local") {
    if (configured !== undefined && configured !== "") throw new ConfigurationError();
    return localOrigins;
  }
  if (configured === undefined || configured === "") return [];
  if (configured.length > 2048) throw new ConfigurationError();
  const origins = configured.split(",").map((value) => value.trim());
  if (origins.length > 8 || new Set(origins).size !== origins.length)
    throw new ConfigurationError();
  for (const value of origins) {
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        url.origin !== value ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
        throw new ConfigurationError();
    } catch {
      throw new ConfigurationError();
    }
  }
  return origins;
}

export function unsafeBrowserMethod(method: string, requestedMethod?: string): boolean {
  const actual = method === "OPTIONS" ? (requestedMethod ?? "OPTIONS") : method;
  return !["GET", "HEAD", "OPTIONS"].includes(actual);
}
