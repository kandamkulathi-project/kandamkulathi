import type { VideoGrant } from "@kandamkulathi/contracts/sensitive";
import type { VideoState } from "./private-video";
import { readVideoProofInvitation, type SyntheticVideoInvitation } from "./video-proof-invitation";

export type ProofControlState = "needs-invitation" | "armed" | "unavailable" | VideoState;
export interface ProofSnapshot {
  state: ProofControlState;
  participantId?: string;
  peerId?: string;
  expiresAt?: number;
}
export interface ProofOwner {
  connect(grant: VideoGrant, signal: AbortSignal): Promise<{ close(): void }>;
  dispose(): void;
}
export const proofControlLabels: Record<ProofControlState, string> = {
  "needs-invitation": "No invitation loaded.",
  armed: "Invitation loaded. Join will request camera and microphone.",
  authorizing: "Checking synthetic server membership…",
  permissions: "Requesting camera and microphone…",
  negotiating: "Negotiating relay-only media; not connected.",
  connected: "WebRTC peer connected. Verify both live media directions manually.",
  closed: "Stopped. Load a fresh server-issued invitation to retry.",
  unavailable:
    "Unavailable. Check the endpoint/build and obtain a fresh invitation. No clinical call was joined.",
};

/** Shared control state for the actual mounted web/native diagnostic. Secrets never enter snapshots. */
export function videoProofControls(options: {
  endpoint: string;
  create(
    invitation: SyntheticVideoInvitation,
    signal: AbortSignal,
    state: (state: VideoState) => void,
  ): ProofOwner | Promise<ProofOwner>;
  onChange(snapshot: ProofSnapshot): void;
  onClear(): void;
  now?: () => number;
}) {
  let invitation: SyntheticVideoInvitation | undefined;
  let controller: AbortController | undefined;
  let owner: ProofOwner | undefined;
  let epoch = 0;
  let disposed = false;
  let armedDeadline: ReturnType<typeof setTimeout> | undefined;
  let setupDeadline: ReturnType<typeof setTimeout> | undefined;
  const now = options.now ?? Date.now;
  const stop = (state: "closed" | "unavailable" = "closed") => {
    epoch++;
    clearTimeout(armedDeadline);
    clearTimeout(setupDeadline);
    invitation = undefined;
    const current = owner;
    owner = undefined;
    const pending = controller;
    controller = undefined;
    pending?.abort();
    current?.dispose();
    if (!disposed) {
      options.onClear();
      options.onChange({ state });
    }
  };
  return {
    load(raw: string) {
      if (disposed || controller) return;
      clearTimeout(armedDeadline);
      try {
        invitation = readVideoProofInvitation(raw, options.endpoint, now());
        options.onChange({
          state: "armed",
          participantId: invitation.member.participantId,
          peerId: invitation.member.peerId,
          expiresAt: invitation.member.expiresAt,
        });
        armedDeadline = setTimeout(() => stop("unavailable"), invitation.member.expiresAt - now());
      } catch {
        stop("unavailable");
      }
    },
    async start() {
      if (disposed || controller || !invitation) return;
      const current = invitation;
      invitation = undefined;
      clearTimeout(armedDeadline);
      const attempt = ++epoch;
      const abort = new AbortController();
      controller = abort;
      armedDeadline = setTimeout(
        () => stop("unavailable"),
        Math.max(0, current.member.expiresAt - now()),
      );
      setupDeadline = setTimeout(() => stop("unavailable"), 30000);
      options.onChange({ state: "authorizing" });
      const alive = () => !disposed && epoch === attempt && !abort.signal.aborted;
      try {
        if (current.member.expiresAt <= now()) throw new Error("Expired proof invitation");
        const opened = await options.create(current, abort.signal, (state) => {
          if (!alive()) return;
          if (state === "connected") clearTimeout(setupDeadline);
          if (state === "closed") stop();
          else options.onChange({ state });
        });
        if (!alive()) {
          opened.dispose();
          return;
        }
        owner = opened;
        const connection = await opened.connect(current.grant, abort.signal);
        if (!alive()) connection.close();
      } catch {
        if (alive()) stop("unavailable");
      }
    },
    stop: () => stop(),
    dispose() {
      disposed = true;
      stop();
    },
  };
}
