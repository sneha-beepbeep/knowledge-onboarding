// Refuses a production deploy while required config is still a placeholder.
// Run automatically by `npm run deploy` (technical plan §10).
// Checks the top-level (production) config only; env.demo is deployed separately
// by `npm run deploy:demo` and never goes through this guard.
import { readFileSync } from "node:fs";
import { parseJsonc, productionProblems } from "./lib/wrangler-config.mjs";

const config = parseJsonc(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const problems = productionProblems(config, process.env);

if (problems.length) {
  console.error("Deploy blocked:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log("Deploy config OK.");
