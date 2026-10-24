import { expect, test } from "@playwright/test";

test("public locale cannot change before hydration and works after handlers attach", async ({
  page,
}) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*.js", async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    const locale = page.getByRole("combobox");
    await expect(locale).toBeDisabled();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    release();
    await expect(locale).toBeEnabled();
    await locale.selectOption("ml");
    await expect(page.locator("html")).toHaveAttribute("lang", "ml");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("കണ്ടംകുളത്തി");
  } finally {
    release();
  }
});
