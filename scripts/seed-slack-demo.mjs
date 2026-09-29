// Demo seed: a synthetic Slack onboarding guide, 5 topics and 50 hand-written
// questions waiting for review. No AI.
//
//   npm run seed:demo                      seed the local D1 (stops if demo data already exists)
//   npm run seed:demo -- --reset-demo      remove only the demo data, then stop
//   tsx scripts/seed-slack-demo.mjs --remote knowledge-check-demo-db [--reset-demo] [--dry-run]
//                                          the same, on the deployed DEMO database only
//                                          (run by `npm run deploy:demo -- --seed`)
//
// Runs with tsx so it can reuse the app's own validation and grounding
// (worker/ai/validate.ts). Local: `wrangler d1 execute DB --local`, the same local
// D1 that `npm run dev` uses. Remote: hard-restricted to the demo database name,
// through wrangler.jsonc env.demo; any other remote database is refused.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_DB, DEMO_ENV, demoProblems, parseJsonc } from "./lib/wrangler-config.mjs";
import { makeD1 } from "./lib/d1-runner.mjs";
import { EMPTY_STATE, IMPORT_FORMAT, STATE_SQL, importSql, planImport, sqlLit, stateFromRows } from "./lib/bank-import.ts";
import {
  DEMO_DOC_NAME,
  DEMO_DOC_SOURCE,
  DEMO_DOC_VERSION_DATE,
  DEMO_DOC_TEXT,
  DEMO_MODEL,
  DEMO_QUESTIONS,
  DEMO_TOPICS,
} from "./seed/slack-demo-data.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const KNOWN = new Set(["--local", "--reset-demo", "--dry-run"]);

function die(msg) {
  console.error(`seed:demo: ${msg}`);
  process.exit(1);
}

// --remote takes exactly one value, and only the demo database name is accepted.
const remoteAt = args.indexOf("--remote");
const REMOTE = remoteAt !== -1;
const remoteName = REMOTE ? args[remoteAt + 1] : undefined;
const rest = REMOTE ? args.filter((_, i) => i !== remoteAt && i !== remoteAt + 1) : args;
if (REMOTE && rest.includes("--local")) die("choose --local or --remote, not both.");
if (!REMOTE && !rest.includes("--local"))
  die(`refusing to run without --local (or --remote ${DEMO_DB}). Nothing was changed.`);
if (REMOTE && remoteName !== DEMO_DB)
  die(`refusing remote database "${remoteName ?? ""}". The only remote target allowed is the demo database ${DEMO_DB}. Nothing was changed.`);
const unknown = rest.filter((a) => !KNOWN.has(a) || (REMOTE && a === "--local"));
if (unknown.length) die(`unknown argument(s): ${unknown.join(" ")}. Accepted: --local | --remote ${DEMO_DB}, --reset-demo, --dry-run.`);
const RESET = rest.includes("--reset-demo");
const DRY = rest.includes("--dry-run");

if (REMOTE) {
  // Belt and braces: env.demo in wrangler.jsonc must still be the separate demo DB.
  const problems = demoProblems(parseJsonc(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8")), { requireId: !DRY });
  if (problems.length) die("wrangler.jsonc env.demo is not a safe demo config:\n- " + problems.join("\n- "));
}

// ---- wrangler d1 (shared runner, scripts/lib/d1-runner.mjs) ---------------------------
// --config pins the source config, so a leftover demo build (.wrangler/deploy) can't
// redirect the local seed to a different local database.
const TARGET = REMOTE
  ? [DEMO_DB, "--remote", "--config", "wrangler.jsonc", "--env", DEMO_ENV]
  : ["DB", "--local", "--config", "wrangler.jsonc"];
const where = REMOTE ? `remote ${DEMO_DB}` : "local";
if (REMOTE || DRY) console.log(`Seeding target: ${where}${DRY ? " (dry run: nothing is executed)" : ""}`);
const d1 = makeD1({ root: ROOT, argv: TARGET, where, show: REMOTE, dry: DRY, die });
const query = d1.query;
const execFile = d1.execSql;
const lit = sqlLit;

// ---- state checks ------------------------------------------------------------
const topicList = DEMO_TOPICS.map(lit).join(", ");
const NONE = { versions: 0, docs: 0, runs: 0, topics: 0 }; // dry run: nothing is queried
const [state = NONE] = query(
  `SELECT (SELECT count(*) FROM versions) AS versions,
          (SELECT count(*) FROM documents WHERE name = ${lit(DEMO_DOC_NAME)}) AS docs,
          (SELECT count(*) FROM draft_runs WHERE model = ${lit(DEMO_MODEL)}) AS runs,
          (SELECT count(*) FROM topics WHERE lower(name) IN (${DEMO_TOPICS.map((t) => lit(t.toLowerCase())).join(", ")})) AS topics`,
);
// Seeding the remote demo is part of the re-runnable `deploy:demo -- --seed`, so
// "already there" is a skip (exit 0) there; locally it stays an error as before.
const stop = (msg) => {
  if (REMOTE && !RESET) {
    console.log(`Skipped: ${msg}`);
    process.exit(0);
  }
  die(msg);
};
if (state.versions > 0)
  stop("a version is already published, so the bank is frozen. Demo data can't be added or removed. Nothing was changed.");

if (RESET) {
  reset();
  process.exit(0);
}

if (state.docs > 0 || state.runs > 0 || state.topics > 0)
  stop(
    `demo data already exists (document: ${state.docs}, seed runs: ${state.runs}, demo-named topics: ${state.topics}). Nothing was changed.\n` +
      (REMOTE
        ? `  To start again: npx tsx scripts/seed-slack-demo.mjs --remote ${DEMO_DB} --reset-demo, then re-run with --seed`
        : "  To start again: npm run seed:demo -- --reset-demo && npm run seed:demo"),
  );

seed();

// ---- seed --------------------------------------------------------------------
function seed() {
  // The demo data goes through the same planner as scripts/import-questions.mjs:
  // A3a's document checks, then validateDraft (validation and grounding) per question.
  const file = {
    format: IMPORT_FORMAT,
    documents: [{ key: "demo", name: DEMO_DOC_NAME, versionDate: DEMO_DOC_VERSION_DATE, topics: [...DEMO_TOPICS], text: DEMO_DOC_TEXT }],
    questions: DEMO_QUESTIONS.map((q) => ({
      topic: q.topic,
      document: "demo",
      question: q.question,
      options: q.options,
      correctIndex: q.correct_index,
      quote: q.quote,
    })),
  };
  const state = DRY ? EMPTY_STATE : stateFromRows(d1.queryAll(STATE_SQL));
  const result = planImport(file, state, () => {
    throw new Error("no text files");
  });
  if (!result.ok) die(`the demo data failed the import checks. Nothing was changed.\n- ${result.errors.join("\n- ")}`);
  const valid = result.plan.questions;
  const text = result.plan.docs[0].text;
  execFile(importSql(result.plan, { now: Date.now(), model: DEMO_MODEL }));
  if (DRY) {
    console.log(`(dry run) Would seed "${DEMO_DOC_NAME}" with ${valid.length} validated questions on ${DEMO_TOPICS.length} topics into the ${where} database.`);
    return;
  }

  const rows = query(
    `SELECT t.name AS topic, count(q.id) AS questions FROM topics t LEFT JOIN questions q ON q.topic_id = t.id AND q.status = 'pending' WHERE t.name IN (${topicList}) GROUP BY t.id ORDER BY t.name`,
  );
  console.log(`Seeded "${DEMO_DOC_NAME}" (${text.length} characters, source ${DEMO_DOC_SOURCE}).`);
  for (const r of rows) console.log(`  ${r.topic}: ${r.questions} pending`);
  console.log("\nDeliberately flawed questions (for practising Reject and Edit):");
  for (const q of DEMO_QUESTIONS.filter((x) => x.flaw)) console.log(`  [${q.topic}] "${q.question}"\n      ${q.flaw}`);
  console.log(`\nSeeded the ${where} database. Reload the app in the browser. Nothing was published; no consent, HR sign-off or attempts were recorded.`);
}

// ---- reset: only the demo document, its topics, their runs and questions ---------
function reset() {
  const demoTopicIds = `(SELECT id FROM topics WHERE name IN (${topicList}))`;
  // Dry run: pretend demo data exists so the delete command is shown.
  const [c = { docs: 1, questions: 0, runs: 0, otherQuestions: 0, otherTags: 0, topics: 0 }] = query(
    `SELECT (SELECT count(*) FROM documents WHERE name = ${lit(DEMO_DOC_NAME)}) AS docs,
            (SELECT count(*) FROM questions WHERE topic_id IN ${demoTopicIds}) AS questions,
            (SELECT count(*) FROM draft_runs WHERE topic_id IN ${demoTopicIds}) AS runs,
            (SELECT count(*) FROM questions WHERE topic_id IN ${demoTopicIds} AND (draft_run_id IS NULL OR draft_run_id NOT IN (SELECT id FROM draft_runs WHERE model = ${lit(DEMO_MODEL)}))) AS otherQuestions,
            (SELECT count(*) FROM document_topics WHERE topic_id IN ${demoTopicIds} AND document_id NOT IN (SELECT id FROM documents WHERE name = ${lit(DEMO_DOC_NAME)})) AS otherTags,
            (SELECT count(*) FROM topics WHERE name IN (${topicList})) AS topics`,
  );
  if (c.otherTags > 0)
    die(`${c.otherTags} other document tag(s) use a demo topic. Remove those tags or documents in the app first. Nothing was changed.`);
  if (!c.docs && !c.topics && !c.runs) {
    console.log("No demo data found. Nothing to remove.");
    return;
  }
  execFile(
    [
      `DELETE FROM questions WHERE topic_id IN ${demoTopicIds};`,
      `DELETE FROM draft_runs WHERE topic_id IN ${demoTopicIds};`,
      `DELETE FROM document_topics WHERE document_id IN (SELECT id FROM documents WHERE name = ${lit(DEMO_DOC_NAME)});`,
      `DELETE FROM documents WHERE name = ${lit(DEMO_DOC_NAME)};`,
      `DELETE FROM topics WHERE name IN (${topicList});`,
    ].join("\n"),
  );
  if (DRY) {
    console.log(`(dry run) Would remove the demo data from the ${where} database.`);
    return;
  }
  console.log(
    `Removed the demo data: ${c.docs} document, ${c.topics} topics, ${c.runs} draft runs, ${c.questions} questions` +
      (c.otherQuestions ? ` (including ${c.otherQuestions} drafted in the app on demo topics).` : "."),
  );
  console.log("People, roles, sessions, sign-in links, the pilot row and other documents were not touched.");
}
