import type { MessageBatch, Queue } from "@cloudflare/workers-types";
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
import { platformConfig } from "@kandamkulathi/server/config";
import { emitEvent } from "@kandamkulathi/server/observability";

export type PlatformBindings = {
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
    async ({ client }) => {
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
          // Only the explicit synthetic probe has an implementation. Domain owners register reviewed SQL handlers.
          const result = await executeClaim(context, claim, probeHandlers);
          if (result === "stale") {
            message.retry({ delaySeconds: 30 });
            continue;
          }
          emitEvent({
            event: result === "succeeded" ? "job_complete" : "job_suppressed",
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
