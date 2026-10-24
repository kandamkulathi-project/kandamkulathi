import { useEffect, useRef, useState } from "react";
import {
  type ProofSnapshot,
  proofControlLabels,
  videoProofControls,
} from "../../../packages/client/src/video-proof-controls";
import {
  invitedVideoSignaling,
  videoProofEndpoint,
} from "../../../packages/client/src/video-proof-invitation";
import { browserPrivateVideo } from "./privateVideo";

/** Opt-in development diagnostic only. The root, not an invitation, selects the server endpoint. */
export function WebVideoProof({ endpoint }: { endpoint: unknown }) {
  const [raw, setRaw] = useState("");
  const [snapshot, setSnapshot] = useState<ProofSnapshot>({ state: "needs-invitation" });
  const controls = useRef<ReturnType<typeof videoProofControls> | null>(null);
  const local = useRef<HTMLVideoElement>(null);
  const remote = useRef<HTMLVideoElement>(null);
  const [configured, setConfigured] = useState(false);
  useEffect(() => {
    let approved: string;
    try {
      approved = videoProofEndpoint(endpoint);
    } catch {
      setSnapshot({ state: "unavailable" });
      setConfigured(false);
      return;
    }
    setConfigured(true);
    setSnapshot({ state: "needs-invitation" });
    const current = videoProofControls({
      endpoint: approved,
      onChange: setSnapshot,
      onClear: () => setRaw(""),
      create(invitation, _signal, onState) {
        if (!local.current || !remote.current) throw new Error("Proof surface unavailable");
        return browserPrivateVideo({
          signaling: invitedVideoSignaling(invitation),
          participantId: invitation.member.participantId,
          local: local.current,
          remote: remote.current,
          onState,
        });
      },
    });
    controls.current = current;
    const stop = () => current.stop();
    const hidden = () => {
      if (document.visibilityState !== "visible") stop();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", stop);
    return () => {
      controls.current = null;
      current.dispose();
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", stop);
    };
  }, [endpoint]);
  const active = ["authorizing", "permissions", "negotiating", "connected"].includes(
    snapshot.state,
  );
  return (
    <section
      aria-labelledby="p1-video-title"
      lang="en"
      style={{ maxWidth: "68ch", marginBlock: 32 }}
    >
      <h2 id="p1-video-title">Synthetic video compatibility check</h2>
      <p>
        English technical diagnostics only — not a consultation. Use synthetic participants, never
        patient data. No clinical identity, consent or assignment is granted here.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const input = raw;
          setRaw("");
          controls.current?.load(input);
        }}
      >
        <label htmlFor="p1-video-invitation">Private server-issued synthetic invitation JSON</label>
        <input
          id="p1-video-invitation"
          type="password"
          autoComplete="off"
          spellCheck={false}
          maxLength={4096}
          value={raw}
          disabled={!configured || active || snapshot.state === "armed"}
          onChange={(event) => setRaw(event.target.value)}
          style={{ display: "block", width: "100%", boxSizing: "border-box", minHeight: 48 }}
        />
        <p>
          The invitation is held in memory only, cleared after loading and consumed once. Camera and
          microphone start only after Join and server authorization.
        </p>
        <button
          type="submit"
          disabled={!configured || active || snapshot.state === "armed" || !raw}
        >
          Load private invitation
        </button>
      </form>
      {snapshot.state === "armed" && (
        <p>
          Participant {snapshot.participantId} ↔ peer {snapshot.peerId}. Expires{" "}
          {new Date(snapshot.expiresAt ?? 0).toISOString()}.
        </p>
      )}
      <p role="status" aria-live="polite">
        {proofControlLabels[snapshot.state]}
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBlock: 16 }}>
        <button
          type="button"
          disabled={snapshot.state !== "armed"}
          onClick={() => {
            void controls.current?.start();
          }}
        >
          Join synthetic video proof
        </button>
        <button
          type="button"
          disabled={!active && snapshot.state !== "armed"}
          onClick={() => controls.current?.stop()}
        >
          Stop and clear invitation
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: 16,
        }}
      >
        <figure style={{ margin: 0 }}>
          <figcaption>Local camera (muted)</figcaption>
          <video
            ref={local}
            muted
            playsInline
            aria-label="Local synthetic camera"
            style={{ width: "100%", aspectRatio: "4 / 3", background: "#163d36" }}
          />
        </figure>
        <figure style={{ margin: 0 }}>
          <figcaption>Remote synthetic participant</figcaption>
          {/* Live technical media has no prerecorded caption asset. */}
          <video
            ref={remote}
            playsInline
            controls
            aria-label="Remote synthetic participant"
            style={{ width: "100%", aspectRatio: "4 / 3", background: "#163d36" }}
          >
            <track kind="captions" />
          </video>
        </figure>
      </div>
      <p>
        Peer connectivity is not device/TURN acceptance. Backgrounding, expiry, revocation or
        network failure stops media; use a fresh invitation for an explicit retry.
      </p>
    </section>
  );
}
