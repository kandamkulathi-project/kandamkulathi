import { parseReply, type Reply } from "./contracts";

export type ResourceState<T> = Reply<T> | { status: "loading" };
/** One in-flight operation, abort + epoch fencing even for adapters ignoring abort. */
export class CommerceResource<T> {
  private generation = 0;
  private controller: AbortController | undefined;
  private busy = false;
  constructor(private readonly emit: (state: ResourceState<T>) => void) {}
  clear() {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    this.busy = false;
  }
  async run(call: (signal: AbortSignal) => Promise<unknown>, parse: (value: unknown) => T) {
    if (this.busy) return;
    this.busy = true;
    const epoch = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.emit({ status: "loading" });
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const aborted = new Promise<never>((_, reject) =>
        controller.signal.addEventListener("abort", () => reject(new Error("Aborted")), {
          once: true,
        }),
      );
      const reply = parseReply(await Promise.race([call(controller.signal), aborted]), parse);
      if (epoch === this.generation) this.emit(reply);
    } catch {
      if (epoch === this.generation) this.emit({ status: "error" });
    } finally {
      clearTimeout(timeout);
      if (epoch === this.generation) this.busy = false;
    }
  }
}
