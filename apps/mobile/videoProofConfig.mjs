/** Only public, nonsecret diagnostic settings. Merge into extra; leave other policy parsers intact. */
export function parseVideoProofConfig(env, environment) {
  const flag = env.MOBILE_VIDEO_PROOF_APPROVED ?? "false";
  if (!["false", "true"].includes(flag)) throw new Error("Invalid video proof flag");
  const p1VideoProof = { enabled: flag === "true", endpoint: "" };
  if (p1VideoProof.enabled) {
    if (!["local", "dev"].includes(environment)) throw new Error("Video proof is development-only");
    const endpoint = new URL(env.MOBILE_VIDEO_PROOF_ENDPOINT ?? "");
    if (
      endpoint.href.length > 512 ||
      endpoint.protocol !== "https:" ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      endpoint.pathname !== "/p1-private-video-proof"
    )
      throw new Error("Approved HTTPS video proof endpoint required");
    p1VideoProof.endpoint = endpoint.href;
  }
  return { p1VideoProof };
}
