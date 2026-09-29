// Deploys the DEMO copy of the app to Cloudflare: worker knowledge-check-demo,
// D1 knowledge-check-demo-db (weur) and its own Workflow. Never the pilot.
//
//   npm run deploy:demo                  confirm the account, then deploy
//   npm run deploy:demo -- --seed        also load the Slack demo data (only into the demo DB)
//   npm run deploy:demo -- --yes         skip the y/N account confirmation
//   npm run deploy:demo -- --dry-run     print every command; touch nothing, call nothing
//
// Safe to re-run: reuses the demo database, applies only new migrations,
// redeploys, and replaces the bootstrap token with a fresh one.
// Every wrangler call gets --env demo (and --config wrangler.jsonc where the Vite
// build's redirect would otherwise pick the built config).
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { DEMO_DB, DEMO_ENV, DEMO_WORKER, DEMO_WORKFLOW, demoProblems, parseJsonc, setDemoDatabaseId } from "./lib/wrangler-config.mjs";
import { builtConfigProblems, extractDemoUrl, findDemoDatabase, parseArgs, pickAccount, renderCommand } from "./lib/deploy-demo-lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = join(ROOT, "wrangler.jsonc");
const TOKEN_FILE = join(ROOT, ".demo-bootstrap.local");
const WRANGLER_BIN = join(ROOT, "node_modules", ".bin", "wrangler");
// --config beats the .wrangler/deploy redirect left by any earlier Vite build.
const DEMO = ["--config", "wrangler.jsonc", "--env", DEMO_ENV];

function die(msg) {
  console.error(`\ndeploy:demo: ${msg}`);
  process.exit(1);
}

let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (e) {
  die(e.message);
}
if (opts.help) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(0, 11).join("\n"));
  process.exit(0);
}
const DRY = opts.dryRun;

// Wrangler runs non-interactively (stdin is a pipe): its own prompts take their
// safe defaults, so the y/N below is the only human gate.
const CHILD_ENV = { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_HIDE_BANNER: "true" };
if (CHILD_ENV.CLOUDFLARE_ENV && CHILD_ENV.CLOUDFLARE_ENV !== DEMO_ENV)
  die(`CLOUDFLARE_ENV is "${CHILD_ENV.CLOUDFLARE_ENV}" in your shell. Unset it; this script selects the demo environment itself.`);

/** Runs (or, in --dry-run, only prints) a command. Returns stdout when captured. */
function run(display, bin, args, { capture = false, input = "", env = {}, dryOutput = "" } = {}) {
  console.log(`  $ ${renderCommand(display, args, env)}${input && display === "npx wrangler" ? "   (value piped on stdin)" : ""}`);
  if (DRY) return dryOutput;
  const r = spawnSync(bin, args, {
    cwd: ROOT,
    env: { ...CHILD_ENV, ...env },
    input,
    stdio: ["pipe", capture ? "pipe" : "inherit", "inherit"],
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) die(`${display} failed to start: ${r.error.message}`);
  if (r.status !== 0) {
    if (capture && r.stdout) process.stdout.write(r.stdout);
    die(`command failed (exit ${r.status}). Nothing after this step was run; fix the error and re-run.`);
  }
  return r.stdout ?? "";
}
const wrangler = (args, o) => run("npx wrangler", WRANGLER_BIN, args, o);
const step = (n, title) => console.log(`\n[${n}/7] ${title}`);
const note = (s) => console.log(`      ${s}`);
const readConfig = () => parseJsonc(readFileSync(CONFIG, "utf8"));

console.log(`Demo deploy${DRY ? " (DRY RUN: no command is executed, no file is written)" : ""}`);
console.log(`  worker ${DEMO_WORKER}, D1 ${DEMO_DB} (weur), env "${DEMO_ENV}". The production pilot config is not used.`);

// ---- 0. local config sanity (before anything remote) ---------------------------
{
  const problems = demoProblems(readConfig());
  if (problems.length) die("wrangler.jsonc env.demo is not a safe, separate demo config:\n- " + problems.join("\n- "));
}

// ---- 1. account ------------------------------------------------------------------
step(1, "Cloudflare account");
const whoamiOut = wrangler(["whoami", "--json"], {
  capture: true,
  dryOutput: JSON.stringify({ loggedIn: true, email: "<signed-in user>", accounts: [{ id: "<account-id>", name: "<company account>" }] }),
});
let account;
try {
  const who = JSON.parse(whoamiOut.slice(whoamiOut.indexOf("{")));
  account = pickAccount(who, process.env.CLOUDFLARE_ACCOUNT_ID);
  note(`Signed in as ${who.email ?? "(email not visible)"}.`);
  note(`Account: ${account.name} (${account.id})`);
} catch (e) {
  die(e.message);
}
if (DRY) note("(dry run: would ask 'Deploy the DEMO copy to this account? [y/N]' unless --yes)");
else if (!opts.yes) {
  if (!process.stdin.isTTY) die("no terminal to confirm in. Re-run with --yes to confirm the account above.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`\n  Deploy the DEMO copy to "${account.name}"? [y/N] `)).trim().toLowerCase();
  rl.close();
  if (answer !== "y" && answer !== "yes") die("stopped. Nothing was changed.");
}
const acctEnv = process.env.CLOUDFLARE_ACCOUNT_ID ? {} : { CLOUDFLARE_ACCOUNT_ID: account.id };
Object.assign(CHILD_ENV, acctEnv); // pin every later call to the confirmed account

// ---- 2. demo database ------------------------------------------------------------
step(2, `D1 database ${DEMO_DB}`);
const listOut = wrangler(["d1", "list", "--json"], { capture: true, dryOutput: "[]" });
let db = findDemoDatabase(JSON.parse(listOut.slice(listOut.indexOf("["))));
if (db) note(`Exists (${db.id}); reusing it. (The weur location hint applies only at creation.)`);
else {
  if (DRY) note("(dry run: assuming it does not exist yet)");
  wrangler(["d1", "create", DEMO_DB, "--location", "weur", "--no-update-config"]);
  const again = wrangler(["d1", "list", "--json"], { capture: true, dryOutput: JSON.stringify([{ uuid: "<demo-database-id>", name: DEMO_DB }]) });
  db = DRY ? { id: "<demo-database-id>", name: DEMO_DB } : findDemoDatabase(JSON.parse(again.slice(again.indexOf("["))));
  if (!db) die(`created ${DEMO_DB} but it is not in \`wrangler d1 list\`. Re-run in a minute.`);
}
{
  const text = readFileSync(CONFIG, "utf8");
  const current = parseJsonc(text).env[DEMO_ENV].d1_databases[0].database_id;
  if (DRY) note(`(dry run: would write the database_id into wrangler.jsonc env.demo if it differs from "${current}")`);
  else if (current === db.id) note("wrangler.jsonc env.demo already has this database_id.");
  else {
    writeFileSync(CONFIG, setDemoDatabaseId(text, db.id));
    note(`Wrote database_id ${db.id} into wrangler.jsonc env.demo (nothing else changed). Commit it.`);
  }
  if (!DRY) {
    const problems = demoProblems(readConfig(), { requireId: true });
    if (problems.length) die("demo config check failed after writing the id:\n- " + problems.join("\n- "));
  }
}

// ---- 3. migrations -----------------------------------------------------------------
step(3, "Migrations (remote, demo database only)");
wrangler(["d1", "migrations", "apply", DEMO_DB, "--remote", ...DEMO]);

// ---- 4. build and deploy -------------------------------------------------------------
step(4, "Build and deploy the demo worker");
run("npm", "npm", ["run", "build"], { env: { CLOUDFLARE_ENV: DEMO_ENV } });
if (!DRY) {
  // The Vite plugin flattens env.demo into dist/<worker>/wrangler.json and points
  // .wrangler/deploy/config.json at it. Check that is the demo before deploying.
  const redirect = JSON.parse(readFileSync(join(ROOT, ".wrangler", "deploy", "config.json"), "utf8"));
  const builtPath = resolve(ROOT, ".wrangler", "deploy", redirect.configPath);
  if (!existsSync(builtPath)) die(`build output ${relative(ROOT, builtPath)} is missing.`);
  const problems = builtConfigProblems(JSON.parse(readFileSync(builtPath, "utf8")), db.id);
  if (problems.length) die("the build is not the demo build; not deploying:\n- " + problems.join("\n- "));
  note(`Build checked: ${relative(ROOT, builtPath)} is the demo worker.`);
} else note("(dry run: would check the built dist/<worker>/wrangler.json is the demo build before deploying)");
// --env demo makes wrangler refuse a build made for any other environment.
const deployOut = wrangler(["deploy", "--env", DEMO_ENV], {
  capture: true,
  dryOutput: `https://${DEMO_WORKER}.<your-subdomain>.workers.dev`,
});
if (!DRY) process.stdout.write(deployOut);
const url = extractDemoUrl(deployOut) ?? `https://${DEMO_WORKER}.<your-subdomain>.workers.dev`;

// ---- 5. bootstrap token --------------------------------------------------------------
step(5, "BOOTSTRAP_TOKEN secret (fresh on every run)");
const token = randomBytes(32).toString("base64url");
if (DRY) note(`(dry run: would write a new random token to ${relative(ROOT, TOKEN_FILE)}, mode 600)`);
else {
  writeFileSync(
    TOKEN_FILE,
    `# Set-up code (BOOTSTRAP_TOKEN) for the DEMO worker ${DEMO_WORKER}, ${new Date().toISOString()}.\n` +
      `# Paste the line below into ${url}/setup. Git-ignored; delete this file after the first sign-in.\n${token}\n`,
    { mode: 0o600 },
  );
  chmodSync(TOKEN_FILE, 0o600);
}
wrangler(["secret", "put", "BOOTSTRAP_TOKEN", ...DEMO], { input: token });
if (!DRY) note(`Token saved to ${TOKEN_FILE} (path only; the value is never printed).`);

// ---- 6. seed (optional) ----------------------------------------------------------------
step(6, "Slack demo data");
if (!opts.seed) note("Skipped (add --seed to load it).");
else run("npx tsx", join(ROOT, "node_modules", ".bin", "tsx"), ["scripts/seed-slack-demo.mjs", "--remote", DEMO_DB, ...(DRY ? ["--dry-run"] : [])]);

// ---- 7. next steps ------------------------------------------------------------------------
step(7, "Done" + (DRY ? " (dry run; nothing was deployed)" : ""));
console.log(`
  Demo URL:   ${url}
  First sign-in (once, creates the CPO):
    1. Open ${url}/setup
    2. Set-up code: the last line of ${relative(ROOT, TOKEN_FILE)}
    3. Your name (and optionally email), then Continue.
  After signing in, delete the secret and the local file:
    npx wrangler secret delete BOOTSTRAP_TOKEN --config wrangler.jsonc --env demo
    rm ${relative(ROOT, TOKEN_FILE)}
  AI is the demo mock (ENVIRONMENT=demo, AI_MOCK=1): drafts are canned sentences from your
  uploaded text; nothing is sent to Anthropic. Synthetic data only: the URL is public.
  Tear down: npx wrangler delete --config wrangler.jsonc --env demo
             npx wrangler workflows delete ${DEMO_WORKFLOW}
             npx wrangler d1 delete ${DEMO_DB}
             rm -f ${relative(ROOT, TOKEN_FILE)}`);
