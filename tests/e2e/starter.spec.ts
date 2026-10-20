import { expect, test } from "@playwright/test";

test("public starter renders, switches locale and fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kandamkulathi", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Customer services are not available yet");
  await page.getByRole("combobox").selectOption("ml");
  await expect(page.locator("html")).toHaveAttribute("lang", "ml");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("കണ്ടംകുളത്തി");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("combobox").selectOption("ta");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("கண்டம்குளத்தி");
});
test("workspace has no fake sign-in or live actions", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173");
  await expect(page.getByRole("status")).toContainText("Customer services are not available yet");
  await expect(page.getByRole("heading", { name: "Physician", exact: true })).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
  await page.getByRole("combobox").selectOption("ta");
  await expect(page.locator("html")).toHaveAttribute("lang", "ta");
});
for (const [port, service] of [
  [8787, "core-api"],
  [8788, "companion"],
] as const) {
  test(`${service} runs safely inside local workerd`, async ({ request }) => {
    const base = `http://127.0.0.1:${port}`;
    const live = await request.get(`${base}/health/live`);
    expect(live.status()).toBe(200);
    expect(await live.json()).toMatchObject({ service, status: "alive" });
    expect((await request.get(`${base}/health/ready`)).status()).toBe(503);
    const denied = await request.post(`${base}/v1/orders`, {
      data: {},
      headers: { Authorization: "Bearer fabricated" },
    });
    expect(denied.status()).toBe(503);
    expect(await denied.json()).toMatchObject({ error: { code: "FEATURE_UNAVAILABLE" } });
    expect(denied.headers()["cache-control"]).toBe("no-store");
    expect(denied.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    const privatePath = await request.get(
      `${base}/v1/patients/synthetic-private-marker?token=synthetic-token`,
      {
        headers: { "X-Request-ID": "untrusted-marker" },
      },
    );
    expect(privatePath.status()).toBe(503);
    expect(await privatePath.text()).not.toMatch(
      /synthetic-private-marker|synthetic-token|untrusted-marker/,
    );
  });
}
