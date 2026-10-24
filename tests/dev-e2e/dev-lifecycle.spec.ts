import { expect, test } from "@playwright/test";

test("pnpm dev keeps all four services alive under agent detection", async ({ page, request }) => {
  for (const [port, service] of [
    [8787, "core-api"],
    [8788, "companion"],
  ] as const) {
    await expect
      .poll(
        async () => {
          try {
            const response = await request.get(`http://127.0.0.1:${port}/health/live`, {
              timeout: 3000,
            });
            return response.ok() ? response.json() : null;
          } catch {
            return null;
          }
        },
        { timeout: 90000 },
      )
      .toMatchObject({ service, status: "alive" });
  }
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kandamkulathi", exact: true })).toBeVisible();
  await expect
    .poll(
      async () => {
        try {
          return (await request.get("http://127.0.0.1:5173/customer", { timeout: 3000 })).status();
        } catch {
          return null;
        }
      },
      { timeout: 90000 },
    )
    .toBe(200);
  await page.goto("http://127.0.0.1:5173/customer");
  await expect(page.locator("[data-session-state]")).toHaveAttribute(
    "data-session-state",
    "unavailable",
  );
  for (const port of [8787, 8788]) {
    expect((await request.get(`http://127.0.0.1:${port}/health/live`)).status()).toBe(200);
    expect((await request.get(`http://127.0.0.1:${port}/health/ready`)).status()).toBe(503);
  }
});
