import { type ChildProcess, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";

test.describe.configure({ mode: "default" });

// Separate source fixture, no root route or production-build wiring. Parent owns browser lock.
const workspace = fileURLToPath(new URL("../../apps/workspaces/", import.meta.url));
const require = createRequire(new URL("../../apps/workspaces/package.json", import.meta.url));
const vite = resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js");
const origin = "http://127.0.0.1:5186";
async function selectPublicSource(
  page: Page,
  contents = "x",
  name = "synthetic-public-source.txt",
) {
  await page
    .locator('.content-source-files input[type="file"]')
    .first()
    .setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(contents) });
  await expect(page.locator('[data-source-state="ready"]')).toBeVisible();
}
let server: ChildProcess;
test.beforeAll(async () => {
  server = spawn(
    process.execPath,
    [vite, "--host", "127.0.0.1", "--port", "5186", "--strictPort"],
    { cwd: workspace, stdio: "pipe" },
  );
  server.stdout?.resume();
  server.stderr?.resume();
  await expect
    .poll(
      async () => {
        if (server.exitCode !== null) throw new Error("Isolated fixture server exited");
        try {
          return (await fetch(`${origin}/src/content/__fixtures__/index.html`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);
});
test.afterAll(async () => {
  if (server && server.exitCode === null) {
    const closed = new Promise<void>((done) => server.once("exit", () => done()));
    server.kill("SIGTERM");
    await closed;
  }
});
test.beforeEach(async ({ page }) => {
  await page.goto(`${origin}/src/content/__fixtures__/index.html`);
});

test("shows provenance, local-only editing and UUID-alias self-approval denial", async ({
  page,
}) => {
  await expect(page.locator('[data-content-state="ready"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "Synthetic source" })).toHaveAttribute(
    "href",
    "https://example.com/synthetic-reference",
  );
  await expect(page.getByText("Self-approval denied.", { exact: false })).toBeVisible();
  await page.getByLabel("Local title draft", { exact: true }).fill("Local change");
  await expect(page.getByText("Local draft only", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft — pending" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Approve — unavailable" })).toBeDisabled();
  await page.getByLabel("Local title draft", { exact: true }).fill(" ");
  await expect(page.getByText("Enter a nonblank title", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Refresh record" }).click();
  await expect(page.getByLabel("Local title draft", { exact: true })).toHaveValue(
    "Synthetic reference title",
  );
});

test("independent physician workspace still cannot save or approve; immutable states stay read-only", async ({
  page,
}) => {
  await page.getByLabel("Fixture actor").selectOption("physician");
  await expect(
    page.getByText("Workspace access is not approval permission.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve — unavailable" })).toBeDisabled();
  for (const state of ["approved", "withdrawn"]) {
    await page.getByLabel("Fixture scenario").selectOption(state);
    await expect(page.locator('[data-content-state="ready"]')).toBeVisible();
    await expect(page.getByLabel("Local title draft", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("Synthetic reviewer — not physician approval", { exact: false }),
    ).toBeVisible();
  }
});

test("same principal workspace change clears local edits and cannot bypass self-approval", async ({
  page,
}) => {
  await page
    .getByLabel("Local title draft", { exact: true })
    .fill("Discard on changed workspace grants");
  await page.getByLabel("Fixture actor").selectOption("editor-physician");
  await expect(page.getByLabel("Local title draft", { exact: true })).toHaveValue(
    "Synthetic reference title",
  );
  await expect(page.getByText("Self-approval denied.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve — unavailable" })).toBeDisabled();
  await page.getByLabel("Fixture actor").selectOption("editor-no-grants");
  await expect(page.locator('[data-content-state="denied"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "Synthetic source" })).toHaveCount(0);
  await page.getByLabel("Fixture actor").selectOption("editor");
  await expect(page.getByLabel("Local title draft", { exact: true })).toHaveValue(
    "Synthetic reference title",
  );
  await page.getByLabel("Fixture session").selectOption("expired");
  await expect(page.locator('[data-content-state="anonymous"]')).toBeVisible();
  await expect(page.getByLabel("Local title draft", { exact: true })).toHaveCount(0);
});

test("states hide old data, retry safely and never expose private exception detail", async ({
  page,
}) => {
  for (const state of ["empty", "invalid", "denied", "pending", "error", "loading"]) {
    await page.getByLabel("Fixture scenario").selectOption(state);
    await expect(page.locator(`[data-content-state="${state}"]`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Synthetic source" })).toHaveCount(0);
    await expect(page.getByText("Synthetic private error must not render")).toHaveCount(0);
  }
  await page.getByLabel("Fixture scenario").selectOption("draft");
  await expect(page.getByLabel("Local title draft", { exact: true })).toHaveValue(
    "Synthetic reference title",
  );
});

test("anonymous, invalid and customer sessions clear data; late reads cannot restore it", async ({
  page,
}) => {
  await page.getByLabel("Fixture scenario").selectOption("slow");
  await expect(page.locator('[data-content-state="loading"]')).toBeVisible();
  await page.getByLabel("Fixture session").selectOption("anonymous");
  await expect(page.locator('[data-content-state="anonymous"]')).toBeVisible();
  await page.waitForTimeout(700); // Deliberately beyond the synthetic read completion.
  await expect(page.locator('[data-content-state="ready"]')).toHaveCount(0);
  await page.getByLabel("Fixture session").selectOption("invalid");
  await expect(page.locator('[data-content-state="invalid"]')).toBeVisible();
  await page.getByLabel("Fixture actor").selectOption("customer");
  await page.getByLabel("Fixture session").selectOption("ready");
  await expect(page.locator('[data-content-state="denied"]')).toBeVisible();
});

test("page lifecycle clears edits; languages do not translate source content; narrow keyboard layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.getByLabel("Local title draft", { exact: true }).fill("Discard me");
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(page.getByText("Content and local edits cleared.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Local title draft", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh record" }).click();
  await expect(page.getByLabel("Local title draft", { exact: true })).toHaveValue(
    "Synthetic reference title",
  );
  for (const locale of ["ml", "ta", "en"]) {
    await page.locator("header select, main > label select").first().selectOption(locale);
    await expect(page.locator(".content-exact")).toHaveText(
      "Synthetic text only.\nNo medical content or approval.",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    // Embedding must not depend on the host document's language.
    await page.evaluate(() => {
      document.documentElement.lang = "en";
    });
    if (locale !== "en") {
      const family = await page
        .locator(".content-editor")
        .evaluate((element) => getComputedStyle(element).fontFamily);
      expect(family).toContain(locale === "ml" ? "Noto Sans Malayalam" : "Noto Sans Tamil");
    }
  }
  await page.getByRole("button", { name: "Refresh record" }).focus();
  await expect(page.getByRole("button", { name: "Refresh record" })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("explicit synthetic authoring port persists then reloads draft, independent approval and withdrawal", async ({
  page,
}) => {
  await page.goto(`${origin}/src/content/__fixtures__/authoring.html`);
  await expect(page.getByRole("button", { name: "Save draft — pending" })).toBeDisabled();
  await selectPublicSource(page);
  await page.getByLabel("Local title draft", { exact: true }).fill("New synthetic revision");
  await expect(page.getByRole("button", { name: "Save new draft revision" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Approve — unavailable" })).toBeDisabled();
  await page.getByRole("button", { name: "Save new draft revision" }).click();
  await expect(page.getByRole("heading", { name: "New synthetic revision" })).toBeVisible();
  await expect(page.getByLabel("Mutation call count")).toHaveText("1");
  const submitted = JSON.parse(
    (await page.getByLabel("Synthetic submitted request").textContent()) ?? "null",
  );
  expect(submitted.path).toBe("/v1/knowledge/drafts");
  expect(Object.keys(submitted.body).sort()).toEqual(["content", "sources"]);
  expect(submitted.body.sources).toEqual([
    { sourceId: "abcdefab-4444-4444-8444-444444444444", bytesBase64: "eA==" },
  ]);
  expect(submitted.body.content.revision).toBe(2);
  await page.getByLabel("Authoring fixture actor").selectOption("physician");
  await expect(page.getByRole("button", { name: "Approve this revision" })).toBeEnabled();
  await page.getByLabel("Local title draft", { exact: true }).fill("Unsaved local text");
  await expect(page.getByRole("button", { name: "Approve this revision" })).toBeDisabled();
  await page.getByRole("button", { name: "Refresh record" }).click();
  await page.getByRole("button", { name: "Approve this revision" }).click();
  await expect(page.getByRole("button", { name: "Withdraw this revision" })).toBeEnabled();
  const approvedRequest = JSON.parse(
    (await page.getByLabel("Synthetic submitted request").textContent()) ?? "null",
  );
  expect(Object.keys(approvedRequest.body).sort()).toEqual(["contentHash", "revision"]);
  await page.getByRole("button", { name: "Withdraw this revision" }).click();
  await expect(page.getByText("Withdrawn", { exact: true })).toBeVisible();
});

test("expired, missing, wrong-actor and wrong-scope authoring grants cannot enable actions", async ({
  page,
}) => {
  await page.goto(`${origin}/src/content/__fixtures__/authoring.html`);
  for (const mode of ["no-grant", "stale", "wrong-actor", "wrong-scope"]) {
    await page.getByLabel("Authoring fixture mode").selectOption(mode);
    await expect(
      page.getByText("No matching current authoring grant.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Save draft — pending" })).toBeDisabled();
    await expect(page.getByLabel("Mutation call count")).toHaveText("0");
  }
});

test("mutation denial, conflict and uncertainty clear content and never auto-retry", async ({
  page,
}) => {
  await page.goto(`${origin}/src/content/__fixtures__/authoring.html`);
  for (const [mode, state] of [
    ["mutation-denied", "denied"],
    ["conflict", "conflict"],
    ["unavailable", "pending"],
    ["error", "unknown"],
    ["invalid", "unknown"],
  ]) {
    await page.getByLabel("Authoring fixture mode").selectOption(mode ?? "");
    await selectPublicSource(page);
    await page.getByRole("button", { name: "Save new draft revision" }).click();
    await expect(page.locator(`[data-content-state="${state}"]`)).toBeVisible();
    await expect(page.getByLabel("Local title draft", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Private mutation detail must not render")).toHaveCount(0);
    await expect(page.getByLabel("Mutation call count")).toHaveText("1");
  }
});

test("double dispatch is fenced and session changes cannot display a late mutation reply", async ({
  page,
}) => {
  await page.goto(`${origin}/src/content/__fixtures__/authoring.html`);
  await page.getByLabel("Authoring fixture mode").selectOption("slow");
  await selectPublicSource(page);
  await page.getByLabel("Local title draft", { exact: true }).fill("Late synthetic mutation");
  await expect(page.getByRole("button", { name: "Save new draft revision" })).toBeEnabled();
  await page.getByRole("button", { name: "Save new draft revision" }).evaluate((button) => {
    if (button instanceof HTMLButtonElement) {
      button.click();
      button.click();
    }
  });
  await expect(page.getByLabel("Mutation call count")).toHaveText("1");
  await page.getByLabel("Authoring fixture actor").selectOption("physician");
  await page.waitForTimeout(700); // Beyond the old session's synthetic commit response.
  await expect(page.getByLabel("Local title draft", { exact: true })).toHaveValue(
    "Synthetic reference title",
  );
  await expect(page.getByRole("heading", { name: "Late synthetic mutation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve this revision" })).toBeEnabled();
});

test("local source selection rejects wrong hash, oversized and duplicate files; clearing removes names", async ({
  page,
}) => {
  await page.goto(`${origin}/src/content/__fixtures__/authoring.html`);
  const input = page.locator('.content-source-files input[type="file"]').first();
  await input.setInputFiles({
    name: "wrong.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("wrong"),
  });
  await expect(page.locator('[data-source-state="mismatch"]')).toBeVisible();
  await input.setInputFiles({
    name: "too-large.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(48001, 120),
  });
  await expect(page.locator('[data-source-state="size"]')).toBeVisible();
  await input.evaluate((element) => {
    if (!(element instanceof HTMLInputElement)) throw new Error("Expected file input");
    const transfer = new DataTransfer();
    transfer.items.add(new File(["x"], "first.txt"));
    transfer.items.add(new File(["x"], "second.txt"));
    element.files = transfer.files;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator('[data-source-state="duplicate"]')).toBeVisible();
  await selectPublicSource(page);
  await page.getByRole("button", { name: "Refresh record" }).click();
  await expect(page.locator('[data-source-state="missing"]')).toBeVisible();
  await expect(page.getByText("synthetic-public-source.txt", { exact: false })).toHaveCount(0);
  await selectPublicSource(page);
  await page.getByRole("button", { name: "Clear all local files" }).click();
  await expect(page.locator('[data-source-state="missing"]')).toBeVisible();
  await expect(page.getByText("synthetic-public-source.txt", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save draft — pending" })).toBeDisabled();
  await expect(page.getByLabel("Mutation call count")).toHaveText("0");
});

test("late actual-byte hashes cannot restore file names after session or authority loss", async ({
  page,
}) => {
  await page.goto(`${origin}/src/content/__fixtures__/authoring.html`);
  await page.evaluate(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    Object.defineProperty(crypto.subtle, "digest", {
      configurable: true,
      value: async (algorithm: AlgorithmIdentifier, bytes: BufferSource) => {
        const result = await digest(algorithm, bytes);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return result;
      },
    });
  });
  await page
    .locator('.content-source-files input[type="file"]')
    .first()
    .setInputFiles({
      name: "late-public-source.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("x"),
    });
  await expect(page.locator('[data-source-state="hashing"]')).toBeVisible();
  await page.getByLabel("Authoring fixture actor").selectOption("physician");
  await page.waitForTimeout(650);
  await expect(page.locator('.content-source-files input[type="file"]')).toHaveCount(0);
  await expect(page.getByText("late-public-source.txt", { exact: false })).toHaveCount(0);
  await expect(page.getByLabel("Mutation call count")).toHaveText("0");
  await page.getByLabel("Authoring fixture actor").selectOption("editor");
  await selectPublicSource(page);
  await page.getByLabel("Authoring fixture mode").selectOption("no-grant");
  await expect(page.locator('.content-source-files input[type="file"]')).toHaveCount(0);
  await expect(page.getByText("synthetic-public-source.txt", { exact: false })).toHaveCount(0);
});
