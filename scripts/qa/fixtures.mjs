import { createCatalogue } from "../../tests/phase1/fixtures.mjs";

// Intentionally read-only: no URL, credential, reset, seed or production target accepted.
if (process.argv.length !== 3 || process.argv[2] !== "catalogue") {
  console.error(
    "Usage: node scripts/qa/fixtures.mjs catalogue (logical synthetic references only)",
  );
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(createCatalogue(), null, 2));
}
