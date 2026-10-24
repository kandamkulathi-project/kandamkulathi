import { expect, test } from "@playwright/test";
import { endpoint, invitation, membership } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("http://127.0.0.1:8787/**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: "UNAUTHORIZED" }),
    }),
  );
  await page.addInitScript(() => {
    // Explicit deterministic peer double; actual Chromium synthetic capture tracks, NOT device/TURN proof.
    class SyntheticPeer extends EventTarget {
      localDescription: unknown = null;
      iceGatheringState = "complete";
      connectionState = "connecting";
      ontrack = null;
      onconnectionstatechange = null;
      constructor(config: RTCConfiguration) {
        super();
        if (config.iceTransportPolicy !== "relay") throw new Error("Expected relay-only");
      }
      addTrack() {}
      async createOffer() {
        return { type: "offer", sdp: "synthetic offer" };
      }
      async createAnswer() {
        return { type: "answer", sdp: "synthetic answer" };
      }
      async setLocalDescription(value: unknown) {
        this.localDescription = value;
      }
      async setRemoteDescription() {}
      close() {
        this.connectionState = "closed";
      }
    }
    Object.defineProperty(window, "RTCPeerConnection", { value: SyntheticPeer });
  });
});

test("actual WorkspaceApp mounts explicit controls, clears invitation, captures only after authorization, then stops tracks", async ({
  page,
}, testInfo) => {
  const now = Date.now(),
    expiresAt = now + 60000;
  const issued = {
    ...invitation,
    grant: { ...invitation.grant, expiresAt: new Date(expiresAt).toISOString() },
    member: { ...invitation.member, notBefore: now - 1000, expiresAt },
  };
  let joined = false;
  await page.route(endpoint, async (route) => {
    const request = route.request(),
      body = request.postDataJSON() as { action: string };
    expect(request.headers().authorization).toBe(`Bearer ${issued.grant.ticket}`);
    expect(request.url()).not.toContain(issued.grant.ticket);
    if (body.action === "join") joined = true;
    await route.fulfill({
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(
        body.action === "join"
          ? { ...membership, ...issued.member }
          : body.action === "receive"
            ? { type: "answer", sdp: "synthetic answer" }
            : null,
      ),
    });
  });
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Synthetic video compatibility check" });
  await expect(panel).toBeVisible();
  const input = panel.getByLabel("Private server-issued synthetic invitation JSON");
  await input.fill(JSON.stringify(issued));
  await panel.getByRole("button", { name: "Load private invitation" }).click();
  await expect(input).toHaveValue("");
  expect(joined).toBe(false);
  expect(
    await panel
      .locator("video")
      .first()
      .evaluate((element) => (element as HTMLVideoElement).srcObject),
  ).toBe(null);
  await panel.getByRole("button", { name: "Join synthetic video proof" }).click();
  await expect(panel.getByRole("status")).toContainText("not connected");
  expect(joined).toBe(true);
  await expect
    .poll(() =>
      panel
        .locator("video")
        .first()
        .evaluate((element) => (element as HTMLVideoElement).srcObject instanceof MediaStream),
    )
    .toBe(true);
  await panel.screenshot({ path: testInfo.outputPath("proof-desktop.png") });
  await page.evaluate(() => {
    const video = document.querySelector(
      "[aria-label='Local synthetic camera']",
    ) as HTMLVideoElement;
    (window as unknown as { proofTracks: MediaStreamTrack[] }).proofTracks = (
      video.srcObject as MediaStream
    ).getTracks();
  });
  await panel.getByRole("button", { name: "Stop and clear invitation" }).click();
  await expect(panel.getByRole("status")).toContainText("Stopped");
  expect(
    await page.evaluate(() =>
      (window as unknown as { proofTracks: MediaStreamTrack[] }).proofTracks.every(
        (track) => track.readyState === "ended",
      ),
    ),
  ).toBe(true);
  expect(
    await panel
      .locator("video")
      .first()
      .evaluate((element) => (element as HTMLVideoElement).srcObject),
  ).toBe(null);
  await expect(panel.getByRole("button", { name: "Join synthetic video proof" })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.screenshot({ path: testInfo.outputPath("proof-mobile.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("unbound invitations and transport setup denial stay unavailable without capturing media", async ({
  page,
}) => {
  let sent = false;
  await page.route(endpoint, (route) => {
    sent = true;
    return route.fulfill({ status: 403, contentType: "application/json", body: "null" });
  });
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Synthetic video compatibility check" });
  await panel
    .getByLabel("Private server-issued synthetic invitation JSON")
    .fill(JSON.stringify({ ...invitation, endpoint: "https://wrong.test/p1-private-video-proof" }));
  await panel.getByRole("button", { name: "Load private invitation" }).click();
  await expect(panel.getByRole("status")).toContainText("Unavailable");
  expect(sent).toBe(false);
  await expect(panel.getByRole("button", { name: "Join synthetic video proof" })).toBeDisabled();
  const now = Date.now(),
    expiresAt = now + 60000;
  await panel.getByLabel("Private server-issued synthetic invitation JSON").fill(
    JSON.stringify({
      ...invitation,
      grant: { ...invitation.grant, expiresAt: new Date(expiresAt).toISOString() },
      member: { ...invitation.member, notBefore: now - 1000, expiresAt },
    }),
  );
  await panel.getByRole("button", { name: "Load private invitation" }).click();
  await expect(panel.getByRole("button", { name: "Join synthetic video proof" })).toBeEnabled();
  await panel.getByRole("button", { name: "Join synthetic video proof" }).click();
  await expect(panel.getByRole("status")).toContainText("Unavailable");
  expect(sent).toBe(true);
  await expect(panel.getByLabel("Private server-issued synthetic invitation JSON")).toHaveValue("");
  await expect(panel.getByRole("button", { name: "Join synthetic video proof" })).toBeDisabled();
  expect(
    await panel
      .locator("video")
      .first()
      .evaluate((element) => (element as HTMLVideoElement).srcObject),
  ).toBe(null);
});
