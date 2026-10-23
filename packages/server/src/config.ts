import { z } from "zod";

export const environmentSchema = z.enum(["local", "preview", "dev", "staging", "production"]);
export type Environment = z.infer<typeof environmentSchema>;
const flag = z.enum(["true", "false"]).default("false");
const schema = z.object({
  APP_ENV: environmentSchema,
  RESOURCE_NAMESPACE: z.string().regex(/^kandamkulathi-[a-z0-9-]{2,48}$/),
  PROVIDER_MODE: z.enum(["stub", "sandbox", "live"]),
  ALLOW_LIVE_SENDS: flag,
  ALLOW_LIVE_PAYMENTS: flag,
  DATABASE_URL: z.string().optional(),
  DATABASE_WORKER_URL: z.string().optional(),
});
export type PlatformConfig = z.infer<typeof schema>;
export class ConfigurationError extends Error {
  constructor() {
    super("Platform configuration is invalid.");
    this.name = "ConfigurationError";
  }
}

/** Validate before use. Errors deliberately contain neither input values nor credentials. */
export function platformConfig(input: Record<string, unknown>): PlatformConfig {
  // Existing local HTTP tests need only APP_ENV. Remote environments never receive defaults.
  const local = input.APP_ENV === "local";
  const result = schema.safeParse({
    ...(local ? { RESOURCE_NAMESPACE: "kandamkulathi-local", PROVIDER_MODE: "stub" } : {}),
    ...input,
  });
  if (!result.success) throw new ConfigurationError();
  const config = result.data;
  const prefix = `kandamkulathi-${config.APP_ENV}`;
  if (
    !(
      config.RESOURCE_NAMESPACE === prefix ||
      (config.APP_ENV === "preview" && config.RESOURCE_NAMESPACE.startsWith(`${prefix}-`))
    ) ||
    [
      "DATABASE_ADMIN_URL",
      "DATABASE_MIGRATION_URL",
      "DATABASE_BACKUP_URL",
      "DATABASE_RESTORE_URL",
      "PLATFORM_TEST_ADMIN_URL",
      "BACKUP_KEY_B64",
    ].some((key) => input[key]) ||
    (config.APP_ENV !== "local" && Boolean(input.LOCAL_DATABASE_PROXY)) ||
    (config.APP_ENV !== "production" &&
      (config.PROVIDER_MODE === "live" ||
        config.ALLOW_LIVE_SENDS === "true" ||
        config.ALLOW_LIVE_PAYMENTS === "true")) ||
    (config.PROVIDER_MODE !== "live" &&
      (config.ALLOW_LIVE_SENDS === "true" || config.ALLOW_LIVE_PAYMENTS === "true"))
  )
    throw new ConfigurationError();
  for (const value of [config.DATABASE_URL, config.DATABASE_WORKER_URL]) {
    if (value) databaseTarget(value, config.APP_ENV);
  }
  if (config.DATABASE_URL && config.DATABASE_WORKER_URL) {
    const api = new URL(config.DATABASE_URL);
    const jobs = new URL(config.DATABASE_WORKER_URL);
    if (api.host !== jobs.host || api.pathname !== jobs.pathname || api.username === jobs.username)
      throw new ConfigurationError();
  }
  return config;
}

export function databaseTarget(value: string, environment: Environment): URL {
  try {
    const url = new URL(value);
    const user = decodeURIComponent(url.username);
    const local = environment === "local" && ["127.0.0.1", "localhost"].includes(url.hostname);
    const allowedQuery = local ? [] : ["sslmode"];
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !user ||
      !url.password ||
      !/^\/[a-z][a-z0-9_]{2,62}$/.test(url.pathname) ||
      ["postgres", "neondb_owner", "root", "admin"].includes(user.toLowerCase()) ||
      [...url.searchParams.keys()].some((key) => !allowedQuery.includes(key)) ||
      url.hash ||
      (!local &&
        (!/^[a-z0-9-]+-pooler\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname) ||
          url.searchParams.get("sslmode") !== "verify-full" ||
          url.searchParams.getAll("sslmode").length !== 1 ||
          (url.port !== "" && url.port !== "5432")))
    )
      throw new ConfigurationError();
    return url;
  } catch {
    throw new ConfigurationError();
  }
}

export function requireProviderPermission(
  config: PlatformConfig,
  operation: "send" | "payment",
): void {
  if (config.PROVIDER_MODE !== "live") return;
  const allowed = operation === "send" ? config.ALLOW_LIVE_SENDS : config.ALLOW_LIVE_PAYMENTS;
  if (config.APP_ENV !== "production" || allowed !== "true") throw new ConfigurationError();
}
