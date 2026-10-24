import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const run = promisify(execFile);
test("synthetic import CLI reconciles valid controls and never enables writes", async () => {
  const { stdout } = await run(process.execPath, [
    "scripts/import-support/dry-run.ts",
    "tests/fixtures/denzil-import/valid.json",
  ]);
  expect(JSON.parse(stdout)).toMatchObject({
    status: "dry-run",
    readyForWrite: false,
    invalidRows: [],
    controls: { match: true },
    review: "JOSIN_REVIEW_REQUIRED",
  });
});
test("synthetic import CLI exits nonzero with invalid-row and control-total reports", async () => {
  let failed: unknown;
  try {
    await run(process.execPath, [
      "scripts/import-support/dry-run.ts",
      "tests/fixtures/denzil-import/invalid.json",
    ]);
  } catch (error) {
    failed = error;
  }
  expect(failed).toMatchObject({ code: 1 });
  const report = JSON.parse((failed as { stdout: string }).stdout);
  expect(report).toMatchObject({
    status: "dry-run",
    readyForWrite: false,
    controls: { match: false, differences: { units: -8 } },
  });
  expect(report.invalidRows.map((row: { row: number }) => row.row)).toEqual([2, 3, 4, 5]);
});
