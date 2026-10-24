import { readFile, stat } from "node:fs/promises";
import { validateSyntheticImportText } from "./validate.ts";

// stdout is a safe issue/control report, never raw input or accepted catalogue content.
try {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0]) throw new Error("usage");
  const metadata = await stat(args[0]);
  if (!metadata.isFile() || metadata.size > 2_000_000) throw new Error("size");
  const report = validateSyntheticImportText(await readFile(args[0], "utf8"));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode =
    report.status !== "dry-run" || report.invalidRows.length > 0 || !report.controls.match ? 1 : 0;
} catch {
  console.error(
    "Synthetic dry-run unavailable. Provide one local JSON fixture file (maximum 2 MB).",
  );
  process.exitCode = 2;
}
