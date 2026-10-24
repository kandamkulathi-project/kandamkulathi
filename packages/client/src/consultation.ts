import {
  type Appointment,
  type VideoGrant,
  videoGrantSchema,
} from "@kandamkulathi/contracts/sensitive";
import { mayJoin, type SensitiveClient, type SensitiveResult } from "./sensitive";

export interface PrivateConnection {
  close(): void;
}
/** The signaling owner supplies the transport. A local preview is never reported as a private call. */
export function consultationAccess(options: {
  client: SensitiveClient;
  connect: (grant: VideoGrant, signal: AbortSignal) => Promise<PrivateConnection>;
  now?: () => number;
  onClosed?: () => void;
}) {
  const now = options.now ?? Date.now;
  let busy = false;
  let closed = false;
  let epoch = 0;
  let connection: PrivateConnection | undefined;
  let controller: AbortController | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const leave = () => {
    epoch++;
    controller?.abort();
    controller = undefined;
    clearTimeout(expiry);
    connection?.close();
    connection = undefined;
    options.onClosed?.();
  };
  return {
    leave,
    dispose: () => {
      closed = true;
      leave();
    },
    async join(id: string): Promise<SensitiveResult<Appointment>> {
      if (closed) return { status: "anonymous" };
      if (busy || connection) return { status: "busy" };
      busy = true;
      const attempt = epoch;
      try {
        const current = await options.client.appointment(id);
        if (closed || attempt !== epoch) return { status: "anonymous" };
        if (current.status !== "ready") return current;
        if (current.data.id !== id || !mayJoin(current.data, now())) return { status: "denied" };
        const response = await options.client.videoGrant(id, current.data.revision);
        if (response.status !== "ready") return response;
        const parsed = videoGrantSchema.safeParse(response.data);
        if (
          !parsed.success ||
          parsed.data.appointmentId !== id ||
          parsed.data.revision !== current.data.revision ||
          Date.parse(parsed.data.expiresAt) <= now() ||
          Date.parse(parsed.data.expiresAt) - now() > 5 * 60 * 1000 ||
          Date.parse(parsed.data.expiresAt) > Date.parse(current.data.endsAt) ||
          closed ||
          attempt !== epoch
        )
          return { status: "denied" };
        controller = new AbortController();
        // Membership has a hard deadline even while media permissions/transport setup are pending.
        expiry = setTimeout(leave, Math.min(2147483647, Date.parse(parsed.data.expiresAt) - now()));
        const opened = await options.connect(parsed.data, controller.signal);
        if (
          closed ||
          attempt !== epoch ||
          Date.parse(parsed.data.expiresAt) <= now() ||
          !mayJoin(current.data, now())
        ) {
          opened.close();
          leave();
          return { status: "expired" };
        }
        connection = opened;
        return current;
      } catch {
        leave();
        return { status: "unavailable" };
      } finally {
        busy = false;
      }
    },
  };
}
