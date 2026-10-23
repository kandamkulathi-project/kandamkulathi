import { createService } from "@kandamkulathi/server";
import { consumeJobs, dispatchJobs, type PlatformBindings } from "./jobs";

const app = createService("core-api");
export default {
  fetch: app.fetch,
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
