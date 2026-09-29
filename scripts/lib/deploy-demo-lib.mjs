// Pure helpers for scripts/deploy-demo.mjs (no fs, no network), unit-tested.
import { DEMO_DB, DEMO_ENV, DEMO_WORKER } from "./wrangler-config.mjs";

export const FLAGS = ["--yes", "--dry-run", "--seed", "--help"];

export function parseArgs(argv) {
  const unknown = argv.filter((a) => !FLAGS.includes(a) && a !== "-y" && a !== "-h");
  if (unknown.length) throw new Error(`unknown argument(s): ${unknown.join(" ")}. Accepted: ${FLAGS.join(" ")}`);
  return {
    yes: argv.includes("--yes") || argv.includes("-y"),
    dryRun: argv.includes("--dry-run"),
    seed: argv.includes("--seed"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

/**
 * From `wrangler whoami --json`, the one account wrangler will use. Several
 * accounts need CLOUDFLARE_ACCOUNT_ID, or wrangler fails non-interactively later.
 */
export function pickAccount(whoami, accountIdFromEnv) {
  if (!whoami || whoami.loggedIn !== true) throw new Error("wrangler is not signed in. Run `npx wrangler login` first.");
  const accounts = whoami.accounts ?? [];
  if (accountIdFromEnv) {
    const a = accounts.find((x) => x.id === accountIdFromEnv);
    if (!a) throw new Error(`CLOUDFLARE_ACCOUNT_ID=${accountIdFromEnv} is not one of the signed-in accounts.`);
    return a;
  }
  if (accounts.length === 1) return accounts[0];
  if (accounts.length === 0) throw new Error("the signed-in user has no Cloudflare accounts.");
  throw new Error(
    "several accounts are available. Choose one explicitly:\n" +
      accounts.map((a) => `    ${a.id}  ${a.name}`).join("\n") +
      "\n  then run: CLOUDFLARE_ACCOUNT_ID=<id> npm run deploy:demo",
  );
}

/** From `wrangler d1 list --json`, the demo database (exact name) or null. */
export function findDemoDatabase(list) {
  if (!Array.isArray(list)) throw new Error("unexpected `wrangler d1 list --json` output");
  const hits = list.filter((d) => d.name === DEMO_DB);
  if (hits.length > 1) throw new Error(`more than one database is named ${DEMO_DB}`);
  return hits[0] ? { id: hits[0].uuid, name: hits[0].name } : null;
}

/** The workers.dev URL printed by `wrangler deploy`, or null. */
export function extractDemoUrl(output) {
  const m = new RegExp(`https://${DEMO_WORKER}\\.[a-z0-9-]+\\.workers\\.dev`, "i").exec(output ?? "");
  return m ? m[0] : null;
}

/** Checks the flattened config the Vite build wrote (dist/<worker>/wrangler.json). */
export function builtConfigProblems(built, demoDatabaseId) {
  const p = [];
  if (built.name !== DEMO_WORKER) p.push(`built worker name is "${built.name}", expected "${DEMO_WORKER}"`);
  if (built.targetEnvironment !== DEMO_ENV) p.push(`build targetEnvironment is "${built.targetEnvironment}", expected "${DEMO_ENV}"`);
  const db = (built.d1_databases ?? []).find((d) => d.binding === "DB");
  if (!db || db.database_name !== DEMO_DB) p.push(`built D1 binding is not ${DEMO_DB}`);
  else if (demoDatabaseId && db.database_id !== demoDatabaseId) p.push(`built D1 database_id is ${db.database_id}, expected ${demoDatabaseId}`);
  if (built.vars?.ENVIRONMENT !== "demo") p.push(`built ENVIRONMENT is "${built.vars?.ENVIRONMENT}", expected "demo"`);
  return p;
}

/** Shell-style rendering of a command for --dry-run and logs. */
export function renderCommand(cmd, args, envPrefix = {}) {
  const q = (s) => (/^[\w@%+=:,./<>-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`);
  const env = Object.entries(envPrefix).map(([k, v]) => `${k}=${q(v)}`);
  return [...env, cmd, ...args.map(q)].join(" ");
}
