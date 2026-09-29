// Loads hand-written questions into the app (AI-off mode, round 1). For the
// question bank owner: the plain-language guide is scripts/import/README.md,
// the example is scripts/import/example.json.
//
//   npm run import:questions -- <file.json> --check   check only: nothing is written
//   npm run import:questions -- <file.json>           load into the local app (npm run dev)
//   npx tsx scripts/import-questions.mjs <file.json> --remote <db> --confirm-remote=<db> [--check]
//        remote: the demo DB, or the production DB only if the production deploy guard
//        passes. A separate, explicit, CPO-approved step at deploy time (engineer only).
//
// Every question goes through the app's own validation and grounding (validateDraft)
// and lands "waiting for review", so the reviewer approves each one before it can be
// published. All or nothing: any problem means nothing is written.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "./lib/wrangler-config.mjs";
import { LOCAL_TARGET, parseImportArgs, remoteTarget } from "./lib/d1-target.mjs";
import { makeD1 } from "./lib/d1-runner.mjs";
import { IMPORT_MODEL, STATE_SQL, importSql, planImport, stateFromRows } from "./lib/bank-import.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
function die(msg) {
  console.error(`import-questions: ${msg}`);
  process.exit(1);
}

let opts;
try {
  opts = parseImportArgs(process.argv.slice(2));
} catch (e) {
  die(e.message);
}

let target = LOCAL_TARGET;
if (opts.remote !== undefined) {
  const config = parseJsonc(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"));
  target = remoteTarget(config, opts.remote, process.env);
  if (target.problems.length) die(`refusing ${target.where}:\n- ${target.problems.join("\n- ")}\nNothing was changed.`);
}

// The file is read relative to the current directory; textFile paths relative to the file.
const filePath = resolve(process.cwd(), opts.file);
let input;
try {
  input = JSON.parse(readFileSync(filePath, "utf8"));
} catch (e) {
  die(
    e.code === "ENOENT"
      ? `the file "${opts.file}" wasn't found. Check the path and spelling.`
      : `"${opts.file}" isn't valid JSON (${e.message}). Look for a missing comma, bracket or quotation mark near that position.`,
  );
}
const readText = (p) => readFileSync(resolve(dirname(filePath), p), "utf8");

console.log(`Target: ${target.where} database${opts.dryRun ? " (check only: nothing will be written)" : ""}`);
const d1 = makeD1({
  root: ROOT,
  argv: target.argv,
  where: target.where,
  show: target.kind !== "local",
  hint: target.kind === "local" ? "The local database couldn't be read. Start the app once with `npm run dev` so it exists, then try again. Nothing was loaded." : "",
  die,
});
const state = stateFromRows(d1.queryAll(STATE_SQL));

const result = planImport(input, state, readText);
if (!result.ok) {
  const n = result.errors.length;
  console.error(`\n${n} ${n === 1 ? "problem" : "problems"} found in ${opts.file}. Nothing was loaded.\n`);
  for (const e of result.errors) console.error(`  - ${e}`);
  console.error("\nFix the file and run the same command again. The guide explains each message: scripts/import/README.md");
  process.exit(1);
}
const { plan } = result;

console.log(`All ${plan.questions.length} questions passed the checks.`);
for (const d of plan.docs) console.log(`  document ${d.existingId ? "(existing)" : "(new)"} "${d.name}": ${d.topics.join(", ")}`);
if (plan.newTopics.length) console.log(`  new topics: ${plan.newTopics.join(", ")}`);
for (const r of plan.runs) console.log(`  ${r.topic}: ${r.count} ${r.count === 1 ? "question" : "questions"}`);

if (opts.dryRun) {
  console.log("Check only: nothing was written. Run the same command without --check to load them.");
  process.exit(0);
}
d1.execSql(importSql(plan, { now: Date.now(), model: IMPORT_MODEL }));
console.log(`Loaded into the ${target.where} database. They are now waiting in the review queue for the reviewer.`);
