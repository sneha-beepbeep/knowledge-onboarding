// Refuses a production deploy while required config is still a placeholder.
// Run automatically by `npm run deploy` (technical plan §10).
import { readFileSync } from "node:fs";

const text = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const problems = [];

const tz = /"APP_TIMEZONE"\s*:\s*"([^"]*)"/.exec(text)?.[1] ?? "";
let tzValid = false;
try {
  new Intl.DateTimeFormat("en-GB", { timeZone: tz });
  tzValid = tz.length > 0;
} catch {}
if (!tzValid) problems.push(`APP_TIMEZONE is "${tz}". Set the company's IANA timezone in wrangler.jsonc.`);

if (text.includes("00000000-0000-0000-0000-000000000000"))
  problems.push("D1 database_id is the local placeholder. Run `wrangler d1 create` and paste the id.");

if (!/"ENVIRONMENT"\s*:\s*"production"/.test(text))
  problems.push('ENVIRONMENT must be "production" in wrangler.jsonc.');

if (problems.length) {
  console.error("Deploy blocked:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log("Deploy config OK.");
