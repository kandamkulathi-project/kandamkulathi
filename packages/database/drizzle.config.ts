import { defineConfig } from "drizzle-kit";
// Generation is offline. No migration/push command is supplied by the starter.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  strict: true,
});
