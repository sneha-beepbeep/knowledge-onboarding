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
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_DB, DEMO_ENV, demoProblems, parseJsonc } from "./lib/wrangler-config.mjs";
import { validateDraft } from "../worker/ai/validate.ts";
import { MAX_DOC_CHARS, MAX_NAME, MAX_TOPIC_NAME } from "../shared/limits.ts";
import {
  DEMO_DOC_NAME,
  DEMO_DOC_SOURCE,
  DEMO_DOC_TEXT,
  DEMO_DOC_VERSION_DATE,
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

// ---- wrangler d1 ----------------------------------------------------------------
// Local: banner off (it runs an npm update check) and metrics off, so no network calls.
// --config pins the source config, so a leftover demo build (.wrangler/deploy) can't
// redirect the local seed to a different local database.
const WRANGLER_ENV = { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_HIDE_BANNER: "true", CI: "1" };
const WRANGLER = join(ROOT, "node_modules", ".bin", "wrangler");
const TARGET = REMOTE
  ? [DEMO_DB, "--remote", "--config", "wrangler.jsonc", "--env", DEMO_ENV]
  : ["DB", "--local", "--config", "wrangler.jsonc"];
const where = REMOTE ? `remote ${DEMO_DB}` : "local";
if (REMOTE || DRY) console.log(`Seeding target: ${where}${DRY ? " (dry run: nothing is executed)" : ""}`);

function d1(extra, { parse = true } = {}) {
  const argv = ["d1", "execute", ...TARGET, "--json", ...extra];
  if (REMOTE || DRY) {
    const shown = argv.map((a, i) => (argv[i - 1] === "--command" ? `'${a.replace(/\s+/g, " ").slice(0, 60)}...'` : a));
    console.log(`  $ npx wrangler ${shown.join(" ")}`);
  }
  if (DRY) return [{ results: [] }];
  const r = spawnSync(WRANGLER, argv, {
    cwd: ROOT,
    env: WRANGLER_ENV,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) die(`wrangler d1 execute (${where}) failed:\n${r.stderr || r.stdout}`);
  if (!parse) return null;
  const start = r.stdout.indexOf("[");
  return JSON.parse(r.stdout.slice(start));
}
const query = (sql) => d1(["--command", sql])[0].results;
function execFile(sql) {
  const dir = mkdtempSync(join(tmpdir(), "seed-demo-"));
  const file = join(dir, "seed.sql");
  try {
    writeFileSync(file, sql);
    // Remote --file output is an import report, not rows, so it isn't parsed.
    d1(["--file", DRY ? "<seed.sql>" : file, "--yes"], { parse: false });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const lit = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

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
  // Same shape and limits as POST /api/documents (A3a).
  const text = DEMO_DOC_TEXT.replace(/\r\n?/g, "\n").trim();
  if (text.length > MAX_DOC_CHARS || DEMO_DOC_NAME.length > MAX_NAME || DEMO_TOPICS.some((t) => t.length > MAX_TOPIC_NAME))
    die("demo document or topic names exceed the app's limits.");

  // Every question goes through the app's own validation and grounding, like the workflow.
  const docForCheck = { id: 1, name: DEMO_DOC_NAME, versionDate: DEMO_DOC_VERSION_DATE, text };
  const valid = DEMO_QUESTIONS.map((q, i) => {
    const v = validateDraft(
      { question: q.question, options: q.options, correct_index: q.correct_index, document_id: 1, quote: q.quote },
      [docForCheck],
    );
    if (!v.ok) die(`question ${i + 1} (${q.topic}) failed validation: ${v.reason}. Nothing was changed.`);
    return { topic: q.topic, d: v.draft };
  });

  const now = Date.now();
  const docId = `(SELECT max(id) FROM documents WHERE name = ${lit(DEMO_DOC_NAME)})`;
  const topicId = (t) => `(SELECT id FROM topics WHERE name = ${lit(t)})`;
  const runId = (t) => `(SELECT max(id) FROM draft_runs WHERE model = ${lit(DEMO_MODEL)} AND topic_id = ${topicId(t)})`;
  const sql = [
    `INSERT INTO documents (name, version_date, text, char_count, source, created_at) VALUES (${lit(DEMO_DOC_NAME)}, ${lit(DEMO_DOC_VERSION_DATE)}, ${lit(text)}, ${text.length}, ${lit(DEMO_DOC_SOURCE)}, ${now});`,
    ...DEMO_TOPICS.map((t) => `INSERT INTO topics (name) VALUES (${lit(t)}) ON CONFLICT DO NOTHING;`),
    ...DEMO_TOPICS.map((t) => `INSERT INTO document_topics (document_id, topic_id) SELECT ${docId}, id FROM topics WHERE name = ${lit(t)};`),
    // One finished "initial" run per topic, as the workflow leaves it (requested = 2 x 4 + 2).
    ...DEMO_TOPICS.map((t) => {
      const n = valid.filter((v) => v.topic === t).length;
      return `INSERT INTO draft_runs (topic_id, kind, requested, status, created_count, discarded_count, error_reason, model, started_at, finished_at) SELECT id, 'initial', ${n}, 'done', ${n}, 0, NULL, ${lit(DEMO_MODEL)}, ${now}, ${now} FROM topics WHERE name = ${lit(t)};`;
    }),
    // Questions stored exactly as the workflow's "validate and save" step stores them.
    ...valid.map(({ topic, d }) => {
      const original = JSON.stringify({ text: d.text, options: d.options, correctIndex: d.correctIndex });
      return (
        "INSERT INTO questions (topic_id, draft_run_id, document_id, document_name, document_version_date, quote, context_before, context_after, text, options, correct_index, ai_original, status, edit_kind, created_at, updated_at) VALUES (" +
        [topicId(topic), runId(topic), docId, lit(d.documentName), lit(d.documentVersionDate), lit(d.quote), lit(d.contextBefore), lit(d.contextAfter), lit(d.text), lit(JSON.stringify(d.options)), d.correctIndex, lit(original), "'pending'", "'none'", now, now].join(", ") +
        ");"
      );
    }),
  ].join("\n");
  execFile(sql);
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
