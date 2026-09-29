import { defineConfig } from "drizzle-kit";

// `npm run db:generate` compares worker/db/schema.ts with existing migrations
// and writes a new SQL migration file into ./migrations.
export default defineConfig({
  dialect: "sqlite",
  schema: "./worker/db/schema.ts",
  out: "./migrations",
});
