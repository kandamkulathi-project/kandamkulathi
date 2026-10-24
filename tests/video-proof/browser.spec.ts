import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Only the deterministic negotiation port is fake. Browser MediaStreams/tracks are actual
  // Chromium synthetic capture; this is explicitly NOT signed-device, TURN or private-call proof.
  await page.addInitScript(() => {
    class SyntheticPeer extends EventTarget {
      localDescription: unknown = null;
      iceGatheringState = "complete";
      connectionState = "connecting";
      ontrack = null;
      onconnectionstatechange = null;
      constructor(config: RTCConfiguration) {
        super();
        if (config.iceTransportPolicy !== "relay" || !config.iceServers?.length)
          throw new Error("Expected private relay-only peer");
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
  await page.goto("/browser.html");
});

test("explicit start, no false connected claim, revoke releases actual browser tracks", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Start synthetic adapter check" }).click();
  await expect(page.locator("#state")).toHaveText("negotiating");
  expect(
    await page
      .locator("#local")
      .evaluate((el) => (el as HTMLVideoElement).srcObject instanceof MediaStream),
  ).toBe(true);
  await page.evaluate(() => {
    const stream = (document.querySelector("#local") as HTMLVideoElement).srcObject as MediaStream;
    (window as unknown as { proofTracks: MediaStreamTrack[] }).proofTracks = stream.getTracks();
  });
  await page.getByRole("button", { name: "Revoke synthetic membership" }).click();
  await expect(page.locator("#state")).toHaveText("closed");
  expect(
    await page.evaluate(() =>
      (window as unknown as { proofTracks: MediaStreamTrack[] }).proofTracks.every(
        (track) => track.readyState === "ended",
      ),
    ),
  ).toBe(true);
  expect(await page.locator("#local").evaluate((el) => (el as HTMLVideoElement).srcObject)).toBe(
    null,
  );
});

test("page lifecycle stop cleans capture and cannot passively remount", async ({ page }) => {
  await page.getByRole("button", { name: "Start synthetic adapter check" }).click();
  await expect(page.locator("#state")).toHaveText("negotiating");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  await expect(page.locator("#state")).toHaveText("closed");
  await page.getByRole("button", { name: "Start synthetic adapter check" }).click();
  await expect(page.locator("#state")).toHaveText("unavailable");
  expect(await page.locator("#local").evaluate((el) => (el as HTMLVideoElement).srcObject)).toBe(
    null,
  );
});
