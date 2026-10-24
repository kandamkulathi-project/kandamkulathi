import { browserPrivateVideo } from "../../apps/workspaces/src/privateVideo";
import type { VideoState } from "../../packages/client/src/private-video";

function element<T extends Element>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Missing synthetic fixture element: ${selector}`);
  return value;
}
const local = element<HTMLVideoElement>("#local");
const remote = element<HTMLVideoElement>("#remote");
const output = element<HTMLOutputElement>("#state");
const now = Date.now();
const grant = {
  appointmentId: "11111111-1111-4111-8111-111111111111",
  revision: "synthetic",
  expiresAt: new Date(now + 60000).toISOString(),
  ticket: "synthetic-ticket-".repeat(4),
};
let revoke = () => {};
const owner = browserPrivateVideo({
  participantId: "synthetic-a",
  local,
  remote,
  onState: (state: VideoState) => {
    output.value = state;
  },
  signaling: {
    async open() {
      return {
        membership: {
          appointmentId: grant.appointmentId,
          revision: grant.revision,
          participantId: "synthetic-a",
          peerId: "synthetic-b",
          connectionId: "c".repeat(43),
          notBefore: now - 1000,
          expiresAt: now + 60000,
          role: "offerer",
          relays: [
            {
              urls: ["turns:relay.example.test:443"],
              username: "synthetic",
              credential: "synthetic",
            },
          ],
        },
        send: async () => {},
        receive: async () => ({ type: "answer", sdp: "synthetic answer; not device proof" }),
        onRevoked(listener) {
          revoke = listener;
          return () => {
            revoke = () => {};
          };
        },
        close() {},
      };
    },
  },
});
element("#join").addEventListener("click", () => {
  void owner.connect(grant, new AbortController().signal).catch(() => {
    output.value = "unavailable";
  });
});
element("#leave").addEventListener("click", () => owner.dispose());
element("#revoke").addEventListener("click", () => revoke());
