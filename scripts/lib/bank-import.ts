// Question import for AI-off mode (round 1): documents, topics and hand-written
// questions from a JSON file, checked exactly like A3a uploads and AI drafts, and
// turned into SQL that leaves every question "pending" for the reviewer.
// Pure: no fs, no network, no wrangler. Used by scripts/import-questions.mjs and
// scripts/seed-slack-demo.mjs; unit-tested in test/import.test.ts.
//
// File format ("knowledge-check-import/1"), documented in scripts/import/README.md:
// {
//   "format": "knowledge-check-import/1",
//   "documents": [
//     { "key": "slack", "name": "…", "versionDate": "YYYY-MM-DD", "topics": ["…"], "textFile": "slack.txt" },
//     { "key": "slack", "name": "…", "versionDate": "YYYY-MM-DD", "topics": ["…"], "text": "…" },
//     { "key": "old", "existing": "<name of a document already added in the app>" }
//   ],
//   "questions": [
//     { "topic": "…", "document": "slack", "question": "…", "options": ["…","…","…","…"], "correctIndex": 0, "quote": "…" }
//   ]
// }
import { validateDraft, type ValidDraft } from "../../worker/ai/validate";
import type { SourceDoc } from "../../worker/ai/grounding";
import { MAX_DOC_CHARS, MAX_NAME, MAX_TOPIC_NAME, MAX_TOPICS_PER_DOC } from "../../shared/limits";
import { isIsoDate } from "../../shared/dates";

export const IMPORT_FORMAT = "knowledge-check-import/1";
/** draft_runs.model for imported questions. */
export const IMPORT_MODEL = "manual import (no AI)";

export type ImportDocument = {
  key: string;
  name?: string;
  versionDate?: string;
  topics?: string[];
  text?: string;
  textFile?: string;
  existing?: string;
};
export type ImportQuestion = {
  topic: string;
  document: string;
  question: string;
  options: string[];
  correctIndex: number;
  quote: string;
};
export type ImportFile = { format: string; documents: ImportDocument[]; questions: ImportQuestion[] };

/** What the target database already holds (read before planning). */
export type DbState = {
  published: boolean;
  topics: { id: number; name: string }[];
  documents: { id: number; name: string; versionDate: string; text: string; topicIds: number[] }[];
  /** Non-discarded questions, for duplicate detection and the run kind. */
  questions: { topicId: number; text: string }[];
};
export const EMPTY_STATE: DbState = { published: false, topics: [], documents: [], questions: [] };

export type PlannedDoc = {
  key: string;
  name: string;
  versionDate: string;
  text: string;
  /** Resolved topic names (existing spelling reused, like A3a). */
  topics: string[];
  /** Set for "existing" documents: nothing is inserted for them. */
  existingId?: number;
};
export type PlannedQuestion = { topic: string; draft: ValidDraft; newDocName?: string };
export type PlannedRun = { topic: string; kind: "initial" | "more"; count: number };
export type Plan = { docs: PlannedDoc[]; questions: PlannedQuestion[]; runs: PlannedRun[]; newTopics: string[] };

export type PlanResult = { ok: true; plan: Plan } | { ok: false; errors: string[] };

const isStr = (v: unknown): v is string => typeof v === "string";
const clean = (s: string) => s.replace(/\r\n?/g, "\n").trim();
const lc = (s: string) => s.trim().toLowerCase();
const list = (xs: string[]) => xs.map((x) => `"${x}"`).join(", ");

/**
 * Checks the whole file against the database state. All or nothing: any error
 * means no plan. `readText` resolves a document's textFile (relative to the file).
 * Messages are for the bank owner, not an engineer: each names the document or
 * question by number (counting from 1) and says how to fix it.
 */
export function planImport(input: unknown, state: DbState, readText: (path: string) => string): PlanResult {
  const errors: string[] = [];
  const f = input as Partial<ImportFile> | null;
  if (!f || typeof f !== "object" || Array.isArray(f))
    return { ok: false, errors: ['The file must start with { and contain "format", "documents" and "questions". Start from scripts/import/example.json.'] };
  if (f.format !== IMPORT_FORMAT) errors.push(`The first line must be "format": "${IMPORT_FORMAT}". Copy it from the example file.`);
  if (!Array.isArray(f.documents) || !f.documents.length)
    errors.push('"documents" is missing or empty. List at least one document between [ and ].');
  if (!Array.isArray(f.questions) || !f.questions.length)
    errors.push('"questions" is missing or empty. List at least one question between [ and ].');
  if (state.published)
    errors.push("A version is already published, so the question bank is frozen. Nothing can be loaded any more.");
  if (errors.length) return { ok: false, errors };

  // Topics: reuse existing names case-insensitively (as A3a does); first spelling in the file wins otherwise.
  const topicName = new Map<string, string>(state.topics.map((t) => [lc(t.name), t.name]));
  const newTopics: string[] = [];
  const resolveTopic = (t: string) => {
    const k = lc(t);
    if (!topicName.has(k)) {
      topicName.set(k, t.trim());
      newTopics.push(t.trim());
    }
    return topicName.get(k)!;
  };
  const topicIdByName = new Map(state.topics.map((t) => [t.name, t.id]));

  // Documents.
  const docs: PlannedDoc[] = [];
  const keys = new Set<string>();
  const newNames = new Set<string>();
  f.documents!.forEach((d, i) => {
    let at = `Document ${i + 1}`;
    if (!d || typeof d !== "object") return errors.push(`${at}: must be written between { and }.`);
    if (isStr(d.name) && d.name.trim()) at += ` ("${d.name.trim()}")`;
    else if (isStr(d.existing)) at += ` ("${d.existing}")`;
    if (!isStr(d.key) || !d.key.trim()) return errors.push(`${at}: "key" is missing. Give it a short name, such as "security", and use it in its questions.`);
    if (keys.has(d.key)) return errors.push(`${at}: the key "${d.key}" is already used by another document. Each document needs its own key.`);
    keys.add(d.key);

    if (d.existing !== undefined) {
      const extra = (["name", "versionDate", "topics", "text", "textFile"] as const).filter((k) => d[k] !== undefined);
      if (extra.length)
        return errors.push(`${at}: a document with "existing" takes only "key" and "existing". Remove ${list([...extra])}.`);
      const hits = state.documents.filter((x) => x.name === d.existing);
      if (hits.length !== 1)
        return errors.push(
          hits.length
            ? `${at}: more than one document in the app is called "${d.existing}". Remove the extra copy in the app first.`
            : `${at}: no document in the app is called "${d.existing}". Copy the name exactly as the Bank page shows it.`,
        );
      const e = hits[0];
      const names = state.topics.filter((t) => e.topicIds.includes(t.id)).map((t) => t.name);
      docs.push({ key: d.key, name: e.name, versionDate: e.versionDate, text: e.text, topics: names, existingId: e.id });
      return;
    }

    const name = isStr(d.name) ? d.name.trim() : "";
    if (!name) errors.push(`${at}: "name" is missing. Add the document's title.`);
    else if (name.length > MAX_NAME) errors.push(`${at}: the name is longer than ${MAX_NAME} characters. Shorten it.`);
    else if (state.documents.some((x) => lc(x.name) === lc(name)))
      errors.push(`${at}: the app already has a document with this name. To add questions to it, use "existing" instead (see the guide).`);
    else if (newNames.has(lc(name))) errors.push(`${at}: another document in this file has the same name. Give each document its own name.`);
    newNames.add(lc(name));
    if (!isIsoDate(d.versionDate))
      errors.push(`${at}: "versionDate" must be the material's date written as year-month-day, for example "2026-09-15".`);
    const topics = Array.isArray(d.topics) ? [...new Set(d.topics.filter(isStr).map((t) => t.trim()).filter(Boolean))] : [];
    if (!topics.length) errors.push(`${at}: "topics" is missing or empty. List the topic names, for example ["Security"].`);
    if (topics.length > MAX_TOPICS_PER_DOC) errors.push(`${at}: a document can have at most ${MAX_TOPICS_PER_DOC} topics.`);
    for (const t of topics.filter((x) => x.length > MAX_TOPIC_NAME))
      errors.push(`${at}: the topic "${t}" is longer than ${MAX_TOPIC_NAME} characters. Shorten it.`);
    if ((d.text === undefined) === (d.textFile === undefined)) {
      errors.push(`${at}: give the text in exactly one way: "textFile" (a .txt file next to this file) or "text" (pasted in), not both or neither.`);
      return;
    }
    let raw = "";
    if (d.textFile !== undefined) {
      if (!isStr(d.textFile)) return errors.push(`${at}: "textFile" must be a file name in quotes, for example "security.txt".`);
      try {
        raw = readText(d.textFile);
      } catch {
        return errors.push(`${at}: the text file "${d.textFile}" wasn't found. Put it in the same folder as this file and check the spelling.`);
      }
    } else if (isStr(d.text)) raw = d.text;
    else return errors.push(`${at}: "text" must be the document text in quotes.`);
    const text = clean(raw);
    if (!text) errors.push(`${at}: the document text is empty.`);
    if (text.length > MAX_DOC_CHARS)
      errors.push(`${at}: the text is longer than ${MAX_DOC_CHARS.toLocaleString("en-GB")} characters. Split it into smaller documents by topic.`);
    docs.push({ key: d.key, name, versionDate: isStr(d.versionDate) ? d.versionDate : "", text, topics: topics.map(resolveTopic) });
  });
  if (errors.length) return { ok: false, errors };

  // Grounding sources per topic: the file's documents plus the app's documents on that topic,
  // as the drafting workflow grounds against all of a topic's documents. New docs get ids < 0.
  const sources = new Map<string, (SourceDoc & { newDocName?: string })[]>();
  const add = (topic: string, s: SourceDoc & { newDocName?: string }) => {
    const l = sources.get(topic) ?? [];
    if (!l.some((x) => x.id === s.id)) l.push(s);
    sources.set(topic, l);
  };
  const docKeyToId = new Map<string, number>();
  docs.forEach((d, i) => {
    const id = d.existingId ?? -(i + 1);
    docKeyToId.set(d.key, id);
    for (const t of d.topics)
      add(t, { id, name: d.name, versionDate: d.versionDate, text: d.text, newDocName: d.existingId ? undefined : d.name });
  });
  for (const e of state.documents)
    for (const tid of e.topicIds) {
      const t = state.topics.find((x) => x.id === tid);
      if (t) add(t.name, { id: e.id, name: e.name, versionDate: e.versionDate, text: e.text });
    }

  // Questions.
  const seen = new Set(state.questions.map((q) => `${q.topicId}|${lc(q.text)}`));
  const seenInFile = new Map<string, number>();
  const planned: PlannedQuestion[] = [];
  f.questions!.forEach((q, i) => {
    const at = `Question ${i + 1}`;
    if (!q || typeof q !== "object") return errors.push(`${at}: must be written between { and }.`);
    if (!isStr(q.document) || !docKeyToId.has(q.document))
      return errors.push(
        `${at}: "document" is ${isStr(q.document) ? `"${q.document}"` : "missing"}, but no document in this file has that key. Use one of: ${list([...docKeyToId.keys()])}.`,
      );
    const doc = docs.find((d) => d.key === q.document)!;
    if (!isStr(q.topic) || !q.topic.trim()) return errors.push(`${at}: "topic" is missing. Use one of the document's topics: ${list(doc.topics)}.`);
    const topic = topicName.get(lc(q.topic));
    if (!topic || !doc.topics.includes(topic))
      return errors.push(`${at}: the topic "${q.topic}" isn't one of the topics of "${doc.name}". Use one of: ${list(doc.topics)}.`);
    const v = validateDraft(
      { question: q.question, options: q.options, correct_index: q.correctIndex, document_id: docKeyToId.get(q.document), quote: q.quote },
      sources.get(topic) ?? [],
    );
    if (!v.ok) {
      const others = (sources.get(topic) ?? []).length > 1 ? ` or the other documents on "${topic}"` : "";
      const len = isStr(q.quote) ? q.quote.trim().length : 0;
      const msg: Record<string, string> = {
        malformed: `the question text is missing or longer than 500 characters. Write the question in "question".`,
        options: `"options" must list exactly 4 answers, each 1 to 200 characters, and all different. Check for a missing, empty, repeated or very long answer.`,
        answer: `"correctIndex" must be 0, 1, 2 or 3: 0 is the first answer, 1 the second, 2 the third, 3 the fourth.`,
        quote_length: `the quote is ${len} characters long. It must be 30 to 600 characters: copy one or two whole sentences from the document.`,
        ungrounded: `the quote isn't found word for word in "${doc.name}"${others}. Copy it exactly from the uploaded text (same words, spelling and capital letters).`,
      };
      return errors.push(`${at}: ${msg[v.reason] ?? v.reason}`);
    }
    const dupKey = lc(v.draft.text);
    const tid = topicIdByName.get(topic);
    if (tid !== undefined && seen.has(`${tid}|${dupKey}`))
      return errors.push(`${at}: the app already has this question on "${topic}". Remove it from the file, or reword it.`);
    const earlier = seenInFile.get(`${topic}|${dupKey}`);
    if (earlier) return errors.push(`${at}: this is the same question as question ${earlier}. Remove one of them, or reword it.`);
    seenInFile.set(`${topic}|${dupKey}`, i + 1);
    const src = (sources.get(topic) ?? []).find((s) => s.id === v.draft.documentId);
    planned.push({ topic, draft: v.draft, newDocName: src?.newDocName });
  });
  if (errors.length) return { ok: false, errors };

  const runs: PlannedRun[] = [];
  for (const q of planned) {
    let r = runs.find((x) => x.topic === q.topic);
    if (!r) {
      const tid = topicIdByName.get(q.topic);
      const has = tid !== undefined && state.questions.some((x) => x.topicId === tid);
      runs.push((r = { topic: q.topic, kind: has ? "more" : "initial", count: 0 }));
    }
    r.count++;
  }
  return { ok: true, plan: { docs, questions: planned, runs, newTopics } };
}

export const sqlLit = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

/**
 * SQL for a plan: documents, topics and tags as POST /api/documents writes them;
 * one finished run per topic and "pending" questions as the drafting workflow's
 * "validate and save" step writes them (ai_original keeps the loaded version, so
 * Undo in V2 restores it).
 */
export function importStatements(plan: Plan, opts: { now: number; model: string }): string[] {
  const { now, model } = opts;
  const lit = sqlLit;
  const newDocId = (name: string) => `(SELECT max(id) FROM documents WHERE name = ${lit(name)})`;
  const topicId = (t: string) => `(SELECT id FROM topics WHERE name = ${lit(t)})`;
  const runId = (t: string) => `(SELECT max(id) FROM draft_runs WHERE model = ${lit(model)} AND topic_id = ${topicId(t)})`;
  const out: string[] = [];
  for (const d of plan.docs.filter((x) => x.existingId === undefined)) {
    out.push(
      `INSERT INTO documents (name, version_date, text, char_count, source, created_at) VALUES (${lit(d.name)}, ${lit(d.versionDate)}, ${lit(d.text)}, ${d.text.length}, 'paste', ${now});`,
    );
    for (const t of d.topics) out.push(`INSERT INTO topics (name) VALUES (${lit(t)}) ON CONFLICT DO NOTHING;`);
    for (const t of d.topics)
      out.push(`INSERT INTO document_topics (document_id, topic_id) SELECT ${newDocId(d.name)}, id FROM topics WHERE name = ${lit(t)};`);
  }
  for (const r of plan.runs)
    out.push(
      `INSERT INTO draft_runs (topic_id, kind, requested, status, created_count, discarded_count, error_reason, model, started_at, finished_at) SELECT id, ${lit(r.kind)}, ${r.count}, 'done', ${r.count}, 0, NULL, ${lit(model)}, ${now}, ${now} FROM topics WHERE name = ${lit(r.topic)};`,
    );
  for (const { topic, draft: d, newDocName } of plan.questions) {
    const original = JSON.stringify({ text: d.text, options: d.options, correctIndex: d.correctIndex });
    const docId = newDocName !== undefined ? newDocId(newDocName) : String(d.documentId);
    out.push(
      "INSERT INTO questions (topic_id, draft_run_id, document_id, document_name, document_version_date, quote, context_before, context_after, text, options, correct_index, ai_original, status, edit_kind, created_at, updated_at) VALUES (" +
        [topicId(topic), runId(topic), docId, lit(d.documentName), lit(d.documentVersionDate), lit(d.quote), lit(d.contextBefore), lit(d.contextAfter),
          lit(d.text), lit(JSON.stringify(d.options)), d.correctIndex, lit(original), "'pending'", "'none'", now, now].join(", ") +
        ");",
    );
  }
  return out;
}

/** The statements as one SQL script (for `wrangler d1 execute --file`). */
export const importSql = (plan: Plan, opts: { now: number; model: string }) => importStatements(plan, opts).join("\n");

/** Reads DbState from the rows of STATE_SQL (one result set per statement). */
export const STATE_SQL = [
  "SELECT count(*) AS n FROM versions;",
  "SELECT id, name FROM topics ORDER BY id;",
  "SELECT id, name, version_date AS versionDate, text FROM documents ORDER BY id;",
  "SELECT document_id AS documentId, topic_id AS topicId FROM document_topics;",
  "SELECT topic_id AS topicId, text FROM questions WHERE status != 'discarded';",
].join("\n");

export function stateFromRows(sets: { results: any[] }[]): DbState {
  const [v, t, d, dt, q] = [0, 1, 2, 3, 4].map((i) => sets?.[i]?.results ?? []);
  return {
    published: Number(v[0]?.n ?? 0) > 0,
    topics: t.map((r) => ({ id: Number(r.id), name: String(r.name) })),
    documents: d.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      versionDate: String(r.versionDate),
      text: String(r.text),
      topicIds: dt.filter((x) => Number(x.documentId) === Number(r.id)).map((x) => Number(x.topicId)),
    })),
    questions: q.map((r) => ({ topicId: Number(r.topicId), text: String(r.text) })),
  };
}
