import {
  type TechnicalVideoConfig,
  technicalVideoPreflight,
  technicalVideoRoom,
} from "./private-video-proof";

interface ProofEnvironment {
  P1_VIDEO_PROOF_CONFIG: string;
  P1_VIDEO_ROOMS: DurableObjectNamespace;
}
/** Dedicated entry, not Core API. Bind only to an isolated synthetic-proof Worker. */
export class P1VideoProofRoom implements DurableObject {
  private handle: ((request: Request) => Promise<Response>) | undefined;
  constructor(state: DurableObjectState, env: ProofEnvironment) {
    void state.blockConcurrencyWhile(async () => {
      // An unused room may restart. Only an accepted first join burns the connection ID.
      if (await state.storage.get("started")) return;
      try {
        let start: Promise<void> | undefined;
        this.handle = technicalVideoRoom(
          JSON.parse(env.P1_VIDEO_PROOF_CONFIG) as TechnicalVideoConfig,
          Date.now,
          () =>
            (start ??= state.blockConcurrencyWhile(async () => {
              // Check and persist while DO input gates are held, before returning membership.
              if (await state.storage.get("started")) throw new Error("Proof connection consumed");
              await state.storage.put("started", true);
            })),
        );
      } catch {
        /* Invalid/missing operator config is unavailable, not an open room. */
      }
    });
  }
  fetch(request: Request): Promise<Response> {
    return this.handle
      ? this.handle(request)
      : Promise.resolve(new Response(null, { status: 503 }));
  }
}

export default {
  async fetch(request: Request, env: ProofEnvironment): Promise<Response> {
    try {
      const config = JSON.parse(env.P1_VIDEO_PROOF_CONFIG) as TechnicalVideoConfig;
      const denied = technicalVideoPreflight(config, request);
      if (denied) return denied;
      const connection = (config.members[0].membership as Record<string, unknown>).connectionId;
      if (
        config.syntheticOnly !== true ||
        typeof connection !== "string" ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(connection)
      )
        return new Response(null, { status: 503 });
      return await env.P1_VIDEO_ROOMS.get(env.P1_VIDEO_ROOMS.idFromName(connection)).fetch(request);
    } catch {
      return new Response(null, { status: 503 });
    }
  },
};
