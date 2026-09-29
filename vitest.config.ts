import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";

// Tests run inside the Workers runtime (Miniflare) with a local D1 that has the
// real migrations applied. AI is always mocked; no network, no real keys.
export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // The newest pool release bundles workerd that supports dates up to 2026-08-22;
          // wrangler.jsonc (production, vite dev) keeps 2026-09-01.
          compatibilityDate: "2026-08-22",
          bindings: {
            TEST_MIGRATIONS: migrations,
            ENVIRONMENT: "local",
            AI_MOCK: "1",
            // wrangler.jsonc sets AI_ENABLED "false" for round 1; tests run with AI on
            // by default, and the AI-off tests pass their own env (test/ai-off.test.ts).
            AI_ENABLED: "true",
            APP_TIMEZONE: "UTC",
            BOOTSTRAP_TOKEN: "test-bootstrap-token",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/setup.ts"],
    },
  };
});
