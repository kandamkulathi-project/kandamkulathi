import { expect, type Page, test } from "@playwright/test";

const origin = "http://127.0.0.1:5173";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Credentials": "true",
  "Cache-Control": "no-store",
};
async function session(
  page: Page,
  status: number,
  workspaces = ["customer"],
  expiresAt = "2099-01-01T00:00:00Z",
) {
  await page.route("http://127.0.0.1:8787/v1/session", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      headers,
      body: JSON.stringify({
        userId: "dbdfb43b-cde1-4102-95ce-ab0654d1b6cc",
        expiresAt,
        workspaces,
      }),
    }),
  );
}
for (const [code, state] of [
  [401, "anonymous"],
  [403, "denied"],
  [503, "unavailable"],
  [500, "error"],
] as const) {
  test(`workspace renders HTTP ${code} without private content or fake success`, async ({
    page,
  }) => {
    await session(page, code);
    await page.goto(`${origin}/customer`);
    await expect(page.locator("[data-session-state]")).toHaveAttribute("data-session-state", state);
    await expect(page.getByRole("heading", { name: "No items to display." })).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  });
}
test("server grants restrict navigation and direct private routes; no-store headers persist", async ({
  page,
}) => {
  await session(page, 200);
  const response = await page.goto(`${origin}/customer`);
  expect(response?.headers()["cache-control"]).toBe("no-store");
  await expect(page.locator("[data-session-state]")).toHaveAttribute("data-session-state", "ready");
  await expect(page.getByRole("navigation").getByRole("link", { name: "Physician" })).toHaveCount(
    0,
  );
  await page.goto(`${origin}/physician`);
  await expect(page.getByRole("alert")).toHaveText("You do not have access to this workspace.");
  await expect(page.getByRole("heading", { name: "No items to display." })).toHaveCount(0);
});
test("session expiry removes access without retaining private state", async ({ page }) => {
  await session(page, 200, ["customer"], new Date(Date.now() + 2000).toISOString());
  await page.goto(`${origin}/customer`);
  await expect(page.locator("[data-session-state]")).toHaveAttribute("data-session-state", "ready");
  await expect(page.locator("[data-session-state]")).toHaveAttribute(
    "data-session-state",
    "anonymous",
    { timeout: 7000 },
  );
});
test("backgrounding invalidates a session and clears an editable draft", async ({ page }) => {
  await session(page, 200);
  await page.goto(origin);
  await expect(page.locator("[data-session-state]")).toHaveAttribute("data-session-state", "ready");
  await page.getByLabel("Editable message draft").fill("Synthetic private draft");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("[data-session-state]")).toHaveAttribute(
    "data-session-state",
    "loading",
  );
  await expect(page.getByLabel("Editable message draft")).toHaveValue("");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("[data-session-state]")).toHaveAttribute("data-session-state", "ready");
});
test("language routes use bundled fonts, keyboard focus and narrow layouts", async ({
  page,
}, testInfo) => {
  await session(page, 401);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(origin);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  for (const [locale, font] of [
    ["ml", "Noto Sans Malayalam"],
    ["ta", "Noto Sans Tamil"],
  ]) {
    await page.getByRole("combobox").selectOption(locale ?? "en");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate((name) => document.fonts.check(`16px "${name}"`), font)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`workspace-${locale}.png`), fullPage: true });
  }
});
test("camera UI releases a real MediaStream from synthetic canvas capture", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async (constraints: MediaStreamConstraints) => {
        if (!constraints.video || constraints.audio)
          throw new Error("Unexpected camera constraints");
        return document.createElement("canvas").captureStream();
      },
    });
  });
  await session(page, 401);
  await page.goto(origin);
  await page.getByRole("button", { name: "Check camera", exact: true }).click();
  await expect(page.getByText("Local preview only. Nothing is uploaded.")).toBeVisible();
  expect(
    await page
      .locator("video")
      .evaluate((video) => (video as HTMLVideoElement).srcObject instanceof MediaStream),
  ).toBe(true);
  await page.evaluate(() => {
    const stream = (document.querySelector("video") as HTMLVideoElement).srcObject as MediaStream;
    (window as unknown as { probeTrack: MediaStreamTrack }).probeTrack =
      stream.getTracks()[0] as MediaStreamTrack;
  });
  await page.getByRole("button", { name: "Stop and release devices" }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { probeTrack: MediaStreamTrack }).probeTrack.readyState,
    ),
  ).toBe("ended");
});
test("permission denial leaves draft editing usable and sends nothing", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("Synthetic denial", "NotAllowedError");
      },
    });
  });
  await session(page, 401);
  await page.goto(origin);
  await page.getByRole("button", { name: "Check microphone", exact: true }).click();
  await expect(
    page.getByText("Device access was denied or is unavailable. You can continue without it."),
  ).toBeVisible();
  await page.getByLabel("Editable message draft").fill("<script>synthetic</script>");
  await expect(page.getByLabel("Editable message draft")).toHaveValue("<script>synthetic</script>");
  await expect(page.getByRole("button", { name: "Sending is not available yet" })).toBeDisabled();
});
