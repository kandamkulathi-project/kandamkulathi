import type { MessageBatch, Queue } from "@cloudflare/workers-types";
import { expireDueBookingHolds } from "@kandamkulathi/database/booking";
import { channelIngressHandler } from "@kandamkulathi/database/channels";
import { withDatabase } from "@kandamkulathi/database/client";
import {
  acquireExecution,
  channelSchema,
  claimDue,
  type Envelope,
  envelopeSchema,
  executeClaim,
  probeHandlers,
  publishClaims,
  releaseExecution,
} from "@kandamkulathi/database/outbox";
import { executeExternalClaim } from "@kandamkulathi/database/outbox-external";
import { platformConfig } from "@kandamkulathi/server/config";
import { emitEvent } from "@kandamkulathi/server/observability";
import { expireCommerceReservations } from "../../../packages/database/src/commerce-reservations";
import { bridgeKnowledgeIndexObligations } from "../../../packages/database/src/knowledge-index";
import { executeCommerceReconcile } from "./commerce-jobs";
import { createKnowledgeIndexHandler } from "./knowledge-index";
import { configuredKnowledgeIndexProviderOptions } from "./knowledge-runtime";
import { createConfiguredIdentityRuntime } from "./runtime";
import { createConfiguredWebMaintenance } from "./web-maintenance-runtime";

export type PlatformBindings = {
  [key: string]: unknown;
  APP_ENV: string;
  RESOURCE_NAMESPACE: string;
  PROVIDER_MODE: string;
  ALLOW_LIVE_SENDS: string;
  ALLOW_LIVE_PAYMENTS: string;
  DATABASE_WORKER_URL?: string;
  DATABASE_URL?: string;
  LOCAL_DATABASE_PROXY?: string;
  FINANCIAL_QUEUE?: Queue<Envelope>;
  CLINICAL_QUEUE?: Queue<Envelope>;
  ENGAGEMENT_QUEUE?: Queue<Envelope>;
};

export async function dispatchJobs(env: PlatformBindings): Promise<void> {
  const config = platformConfig(env);
  const url = config.DATABASE_WORKER_URL;
  const queues = {
    financial: env.FINANCIAL_QUEUE,
    clinical: env.CLINICAL_QUEUE,
    engagement: env.ENGAGEMENT_QUEUE,
  };
  if (!url || Object.values(queues).some((queue) => !queue))
    throw new Error("Dispatcher resources are unavailable.");
  await withDatabase(
    url,
    config.APP_ENV,
    "k_jobs_runtime",
    async (context) => {
      const { client } = context;
      // Explicit expiry commits before doctor occupancy is released; never use a moving GiST predicate.
      await expireDueBookingHolds(context, 100);
      await expireCommerceReservations(context, 100);
      // Operational retry budget, not a company knowledge-freshness commitment.
      await bridgeKnowledgeIndexObligations(context, 24 * 60 * 60 * 1000, 100);
      const until = performance.now() + 20000;
      let processed = 0;
      while (processed < 1000 && performance.now() < until) {
        let progress = false;
        for (const channel of ["financial", "clinical", "engagement"] as const) {
          if (processed >= 1000 || performance.now() >= until) break;
          const jobs = await claimDue(client, Math.min(100, 1000 - processed), channel);
          if (jobs.length === 0) continue;
          progress = true;
          processed += jobs.length;
          for (const job of jobs)
            emitEvent({
              event: "job_claim",
              service: "core-api",
              environment: config.APP_ENV,
              jobId: job.id,
              pickupMs: job.pickupMs,
            });
          const published = await publishClaims(client, jobs, async (target, bodies) => {
            const queue = queues[target];
            if (!queue) throw new Error("Queue is unavailable.");
            await queue.sendBatch(bodies.map((body) => ({ body, contentType: "json" as const })));
          });
          if (!published)
            for (const job of jobs)
              emitEvent({
                event: "job_retry",
                service: "core-api",
                environment: config.APP_ENV,
                jobId: job.id,
              });
        }
        if (!progress) break;
      }
    },
    env.LOCAL_DATABASE_PROXY,
    config.RESOURCE_NAMESPACE,
  );
  // Admission/provider outages must not prevent durable financial work from being dispatched.
  const maintenance: Promise<unknown>[] = [];
  if (typeof env.WEB_AUTH_COOKIE_KEY === "string" && env.WEB_AUTH_COOKIE_KEY)
    maintenance.push(createConfiguredWebMaintenance(env).runCron());
  if (typeof env.NATIVE_AUTH_ENCRYPTION_KEY === "string" && env.NATIVE_AUTH_ENCRYPTION_KEY)
    maintenance.push(createConfiguredIdentityRuntime(env).nativeJobs.run());
  await Promise.all(maintenance);
}

export async function consumeJobs(
  batch: MessageBatch<unknown>,
  env: PlatformBindings,
): Promise<void> {
  const config = platformConfig(env);
  const url = config.DATABASE_WORKER_URL;
  const channel = channelSchema.parse(batch.queue.replace(`${config.RESOURCE_NAMESPACE}-`, ""));
  if (batch.queue !== `${config.RESOURCE_NAMESPACE}-${channel}` || !url)
    throw new Error("Consumer resources are unavailable.");
  await withDatabase(
    url,
    config.APP_ENV,
    "k_jobs_runtime",
    async (context) => {
      for (const message of batch.messages) {
        let claim: Awaited<ReturnType<typeof acquireExecution>> | undefined;
        try {
          const body = envelopeSchema.parse(message.body);
          if (body.channel !== channel) throw new Error("Queue channel mismatch.");
          claim = await acquireExecution(context.client, body);
          if (claim === "busy") {
            message.retry({ delaySeconds: 30 });
            continue;
          }
          if (claim === "terminal") {
            message.ack();
            continue;
          }
          // Unknown engagement obligations throw/retry; no unsupported provider send is reported successful.
          const result =
            claim.kind === "commerce.reconcile"
              ? await executeCommerceReconcile(context, claim, env)
              : claim.kind === "knowledge.index"
                ? await executeExternalClaim(
                    context,
                    claim,
                    createKnowledgeIndexHandler(configuredKnowledgeIndexProviderOptions(env)),
                  )
                : await executeClaim(context, claim, {
                    ...probeHandlers,
                    "engagement.notify": channelIngressHandler,
                  });
          if (result === "stale") {
            message.retry({ delaySeconds: 30 });
            continue;
          }
          emitEvent({
            event:
              result === "succeeded"
                ? "job_complete"
                : result === "dead"
                  ? "job_dead"
                  : "job_suppressed",
            service: "core-api",
            environment: config.APP_ENV,
            jobId: claim.id,
          });
          message.ack();
        } catch {
          if (claim && typeof claim !== "string") {
            await releaseExecution(context.client, claim);
            emitEvent({
              event: "job_retry",
              service: "core-api",
              environment: config.APP_ENV,
              jobId: claim.id,
            });
          }
          message.retry({ delaySeconds: 30 });
        }
      }
    },
    env.LOCAL_DATABASE_PROXY,
    config.RESOURCE_NAMESPACE,
  );
}
