import type { MessageBatch, ScheduledController } from "@cloudflare/workers-types";
import { consumeJobs, dispatchJobs, type PlatformBindings } from "./jobs";
import { createConfiguredCoreApi } from "./runtime";

export default {
  fetch: (
    request: Request,
    env: { APP_ENV?: string; BROWSER_ALLOWED_ORIGINS?: string; [key: string]: unknown } = {},
  ) => createConfiguredCoreApi(env, request).fetch(request, env),
  scheduled: async (_event: ScheduledController, env: PlatformBindings): Promise<void> => {
    try {
      await dispatchJobs(env);
    } catch {
      throw new Error("Platform dispatch is unavailable.");
    }
  },
  queue: async (batch: MessageBatch<unknown>, env: PlatformBindings): Promise<void> => {
    try {
      await consumeJobs(batch, env);
    } catch {
      throw new Error("Platform processing is unavailable.");
    }
  },
};
