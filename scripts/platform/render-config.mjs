import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readManifest } from "./manifest.mjs";

export function renderConfig(manifest, service, root = process.cwd()) {
  assert(["core-api", "companion"].includes(service), "Unknown Worker");
  const core = service === "core-api";
  const resources = manifest.resources;
  const config = {
    name: core ? resources.coreWorker : resources.companionWorker,
    main: resolve(root, `apps/${service}/src/index.ts`),
    compatibility_date: "2026-10-19",
    compatibility_flags: ["nodejs_compat"],
    workers_dev: false,
    preview_urls: false,
    routes: [],
    limits: { cpu_ms: core ? 100 : 50 },
    vars: {
      APP_ENV: manifest.environment,
      RESOURCE_NAMESPACE: manifest.namespace,
      PROVIDER_MODE: manifest.providerMode,
      ALLOW_LIVE_SENDS: "false",
      ALLOW_LIVE_PAYMENTS: "false",
    },
    observability: {
      enabled: true,
      redact_query_string: true,
      logs: { enabled: true, invocation_logs: false, head_sampling_rate: 1 },
      traces: { enabled: false },
    },
    r2_buckets: core
      ? [
          { binding: "PUBLIC_FILES", bucket_name: resources.publicBucket },
          { binding: "PRIVATE_FILES", bucket_name: resources.privateBucket },
        ]
      : [],
    triggers: {
      crons: core && ["staging", "production"].includes(manifest.environment) ? ["* * * * *"] : [],
    },
    queues: {
      producers: core
        ? ["financial", "clinical", "engagement"].map((channel) => ({
            binding: `${channel.toUpperCase()}_QUEUE`,
            queue: resources[`${channel}Queue`],
          }))
        : [],
      consumers: core
        ? ["financial", "clinical", "engagement"].map((channel) => ({
            queue: resources[`${channel}Queue`],
            max_batch_size: 10,
            max_batch_timeout: 5,
            max_retries: 5,
            retry_delay: 30,
            max_concurrency: 2,
            dead_letter_queue: resources[`${channel}Dlq`],
          }))
        : [],
    },
  };
  return config;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [manifestPath, service, output] = process.argv.slice(2);
    const manifest = readManifest(manifestPath);
    const config = renderConfig(manifest, service);
    assert(output, "Output required");
    const difference = relative(resolve(".local-data"), resolve(output));
    assert(
      difference && !difference.startsWith("..") && !isAbsolute(difference),
      "Generated configs belong in ignored .local-data",
    );
    mkdirSync(dirname(resolve(output)), { recursive: true });
    writeFileSync(output, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    // Loading the original file is deliberately separate: no secrets are merged from process.env.
    assert(!readFileSync(output, "utf8").includes("DATABASE_ADMIN_URL"));
    console.log(
      "Rendered isolated Worker configuration; this does not provision or deploy resources.",
    );
  } catch {
    console.error(
      "Unable to render resource configuration; verify manifest, service and ignored output path.",
    );
    process.exitCode = 1;
  }
}
