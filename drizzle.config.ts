import { defineConfig } from "drizzle-kit";

// Drizzle Kit is used only to generate SQL migrations from the schema.
// Migrations are applied to D1 via `wrangler d1 migrations apply`.
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./src/worker/db/schema.ts",
  out: "./migrations",
});
