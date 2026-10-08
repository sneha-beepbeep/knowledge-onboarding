// Question importer (scripts/import-questions.mjs): arguments and remote targets,
// the file checks (all or nothing), and imported questions working in the app.
import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import wranglerText from "../wrangler.jsonc?raw";
import exampleText from "../scripts/import/example.json?raw";
import exampleDoc from "../scripts/import/example-document.txt?raw";
import {
  EMPTY_STATE,
  IMPORT_FORMAT,
  IMPORT_MODEL,
  STATE_SQL,
  importStatements,
  planImport,
  stateFromRows,
  type DbState,
  type ImportFile,
} from "../scripts/lib/bank-import";
import { parseImportArgs, remoteTarget } from "../scripts/lib/d1-target.mjs";
import { DEMO_DB, DEMO_PLACEHOLDER_ID, PROD_PLACEHOLDER_ID, parseJsonc, setDemoDatabaseId } from "../scripts/lib/wrangler-config.mjs";
import { DEMO_DOC_NAME, DEMO_DOC_TEXT, DEMO_DOC_VERSION_DATE, DEMO_QUESTIONS, DEMO_TOPICS } from "../scripts/seed/slack-demo-data";
import { call, makeWorld, type World } from "./helpers";

const example = () => JSON.parse(exampleText) as ImportFile;
const readExample = (p: string) => {
  if (p !== "example-document.txt") throw new Error("not found");
  return exampleDoc;
};
const errorsOf = (file: unknown, state: DbState = EMPTY_STATE) => {
  const r = planImport(file, state, readExample);
  return r.ok ? [] : r.errors;
};

describe("import arguments", () => {
  it("defaults to local and needs exactly one file", () => {
    expect(parseImportArgs(["f.json"])).toMatchObject({ file: "f.json", remote: undefined, dryRun: false });
    expect(parseImportArgs(["--local", "f.json", "--check"])).toMatchObject({ file: "f.json", local: true, dryRun: true });
    expect(parseImportArgs(["f.json", "--dry-run"])).toMatchObject({ dryRun: true });
    expect(() => parseImportArgs([])).toThrow(/exactly one question file/);
    expect(() => parseImportArgs(["a.json", "b.json"])).toThrow(/exactly one question file/);
    expect(() => parseImportArgs(["f.json", "--force"])).toThrow(/unknown option/);
  });

  it("remote needs --remote <db> and the same name in --confirm-remote", () => {
    expect(parseImportArgs(["f.json", "--remote", "x-db", "--confirm-remote=x-db"])).toMatchObject({ remote: "x-db" });
    expect(() => parseImportArgs(["f.json", "--remote", "x-db"])).toThrow(/--confirm-remote=x-db/);
    expect(() => parseImportArgs(["f.json", "--remote", "x-db", "--confirm-remote=y-db"])).toThrow(/--confirm-remote=x-db/);
    expect(() => parseImportArgs(["f.json", "--remote"])).toThrow(/needs a database name/);
    expect(() => parseImportArgs(["f.json", "--confirm-remote=x-db"])).toThrow(/only used with --remote/);
    // `npm run import:questions` always passes --local, so remote can't go through it.
    expect(() => parseImportArgs(["--local", "f.json", "--remote", "x-db", "--confirm-remote=x-db"])).toThrow(/not both/);
  });
});

describe("remote targets", () => {
  const REAL_ID = "3f2a1c4e-9b7d-4e21-8a6f-0c5d2e7b9a11";
  // deploy:demo writes the real demo id into wrangler.jsonc, and rollout step 4.3 commits
  // the real production id, so start from a copy with both placeholders rather than
  // whatever ids are committed today.
  const placeholderText = setDemoDatabaseId(wranglerText, DEMO_PLACEHOLDER_ID);
  const config = () => {
    const c = parseJsonc(placeholderText);
    c.d1_databases[0].database_id = PROD_PLACEHOLDER_ID;
    return c;
  };

  it("production is refused while the production deploy guard fails", () => {
    const t = remoteTarget(config(), "onboarding-knowledge-check-db", {});
    expect(t.kind).toBe("production");
    expect(t.problems.join()).toMatch(/database_id is the local placeholder/);
  });

  it("production passes only with the real config and no CLOUDFLARE_ENV", () => {
    const c = config();
    c.d1_databases[0].database_id = REAL_ID;
    const ok = remoteTarget(c, "onboarding-knowledge-check-db", {});
    expect(ok.problems).toEqual([]);
    expect(ok.argv).toEqual(["onboarding-knowledge-check-db", "--remote", "--config", "wrangler.jsonc"]);
    expect(remoteTarget(c, "onboarding-knowledge-check-db", { CLOUDFLARE_ENV: "demo" }).problems.join()).toMatch(/CLOUDFLARE_ENV/);
    c.vars.AI_MOCK = "1";
    expect(remoteTarget(c, "onboarding-knowledge-check-db", {}).problems.join()).toMatch(/AI_MOCK/);
  });

  it("the demo DB needs a real demo id and targets env.demo", () => {
    expect(remoteTarget(config(), DEMO_DB).problems.join()).toMatch(/not a real id/);
    const c = parseJsonc(setDemoDatabaseId(placeholderText, REAL_ID));
    const t = remoteTarget(c, DEMO_DB);
    expect(t.problems).toEqual([]);
    expect(t.argv).toEqual([DEMO_DB, "--remote", "--config", "wrangler.jsonc", "--env", "demo"]);
  });

  it("any other database is refused", () => {
    const t = remoteTarget(config(), "some-other-db");
    expect(t.kind).toBe("refused");
    expect(t.problems).toHaveLength(1);
  });
});

describe("planImport", () => {
  it("accepts the committed example file", () => {
    const r = planImport(example(), EMPTY_STATE, readExample);
    expect(r.ok, r.ok ? "" : r.errors.join("\n")).toBe(true);
    if (!r.ok) return;
    expect(r.plan.questions).toHaveLength(4);
    expect(r.plan.newTopics).toEqual(["Expense claims (example)", "Expense approval (example)"]);
    expect(r.plan.runs).toEqual([
      { topic: "Expense claims (example)", kind: "initial", count: 2 },
      { topic: "Expense approval (example)", kind: "initial", count: 2 },
    ]);
    // Quotes are the exact document slice, with context, as for AI drafts.
    for (const q of r.plan.questions) {
      expect(exampleDoc).toContain(q.draft.quote);
      expect(q.draft.contextBefore.length + q.draft.contextAfter.length).toBeGreaterThan(0);
    }
  });

  it("accepts the Slack demo data (the seeder uses the same planner)", () => {
    const file = {
      format: IMPORT_FORMAT,
      documents: [{ key: "d", name: DEMO_DOC_NAME, versionDate: DEMO_DOC_VERSION_DATE, topics: [...DEMO_TOPICS], text: DEMO_DOC_TEXT }],
      questions: DEMO_QUESTIONS.map((q) => ({ ...q, document: "d", correctIndex: q.correct_index })),
    };
    const r = planImport(file, EMPTY_STATE, readExample);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.questions).toHaveLength(50);
  });

  it("checks the file shape", () => {
    expect(errorsOf(null)[0]).toMatch(/must start with \{/);
    expect(errorsOf([])[0]).toMatch(/must start with \{/);
    expect(errorsOf({ ...example(), format: "v0" })[0]).toMatch(/"format": "knowledge-check-import\/1"/);
    expect(errorsOf({ ...example(), questions: [] })[0]).toMatch(/"questions" is missing or empty/);
    expect(errorsOf(example(), { ...EMPTY_STATE, published: true })[0]).toMatch(/already published/);
  });

  it("checks documents like A3a", () => {
    const f = example();
    f.documents[0].versionDate = "01.09.2026";
    f.documents[0].text = "inline";
    const errs = errorsOf(f);
    expect(errs).toEqual([
      'Document 1 ("Expense claims: quick guide (example)"): "versionDate" must be the material\'s date written as year-month-day, for example "2026-09-15".',
      'Document 1 ("Expense claims: quick guide (example)"): give the text in exactly one way: "textFile" (a .txt file next to this file) or "text" (pasted in), not both or neither.',
    ]);
    const g = example();
    g.documents[0].textFile = "missing.txt";
    expect(errorsOf(g).join()).toMatch(/the text file "missing.txt" wasn't found/);
    const state: DbState = {
      ...EMPTY_STATE,
      documents: [{ id: 7, name: "expense claims: quick guide (EXAMPLE)", versionDate: "2026-01-01", text: "x", topicIds: [] }],
    };
    expect(errorsOf(example(), state).join()).toMatch(/the app already has a document with this name. To add questions to it, use "existing"/);
  });

  it("runs every question through validation and grounding, and reports all problems at once", () => {
    const f = example();
    f.questions[0].quote = "This sentence is not in the document at all, not even close.";
    f.questions[1].options = ["A", "B", "C"];
    f.questions[2].correctIndex = 4;
    f.questions[3].quote = "Too short.";
    const errs = errorsOf(f);
    expect(errs).toEqual([
      'Question 1: the quote isn\'t found word for word in "Expense claims: quick guide (example)". Copy it exactly from the uploaded text (same words, spelling and capital letters).',
      'Question 2: "options" must list exactly 4 answers, each 1 to 200 characters, and all different. Check for a missing, empty, repeated or very long answer.',
      'Question 3: "correctIndex" must be 0, 1, 2 or 3: 0 is the first answer, 1 the second, 2 the third, 3 the fourth.',
      "Question 4: the quote is 10 characters long. It must be 30 to 600 characters: copy one or two whole sentences from the document.",
    ]);
  });

  it("refuses unknown documents, untagged topics and duplicates", () => {
    const f = example();
    f.questions[0].document = "nope";
    f.questions[1].topic = "Unrelated topic";
    f.questions[3] = { ...f.questions[2] };
    const errs = errorsOf(f);
    expect(errs).toEqual([
      'Question 1: "document" is "nope", but no document in this file has that key. Use one of: "expenses".',
      'Question 2: the topic "Unrelated topic" isn\'t one of the topics of "Expense claims: quick guide (example)". Use one of: "Expense claims (example)", "Expense approval (example)".',
      "Question 4: this is the same question as question 3. Remove one of them, or reword it.",
    ]);
    // Already in the app (case-insensitive), on a reused topic spelled differently.
    const state: DbState = {
      ...EMPTY_STATE,
      topics: [{ id: 3, name: "EXPENSE CLAIMS (EXAMPLE)" }],
      questions: [{ topicId: 3, text: "within how many days of the purchase must you submit an expense claim?" }],
    };
    const e2 = errorsOf(example(), state);
    expect(e2).toEqual(['Question 1: the app already has this question on "EXPENSE CLAIMS (EXAMPLE)". Remove it from the file, or reword it.']);
  });

  it("adds questions to an existing document, as a 'more' run on a topic that has questions", () => {
    const state: DbState = {
      published: false,
      topics: [{ id: 3, name: "Expense claims (example)" }],
      documents: [{ id: 9, name: "Expense guide.pdf", versionDate: "2026-08-01", text: exampleDoc.trim(), topicIds: [3] }],
      questions: [{ topicId: 3, text: "Some earlier question?" }],
    };
    const file = {
      format: IMPORT_FORMAT,
      documents: [{ key: "pdf", existing: "Expense guide.pdf" }],
      questions: [{ ...example().questions[0], document: "pdf" }],
    };
    const r = planImport(file, state, readExample);
    expect(r.ok, r.ok ? "" : r.errors.join()).toBe(true);
    if (!r.ok) return;
    expect(r.plan.runs).toEqual([{ topic: "Expense claims (example)", kind: "more", count: 1 }]);
    expect(r.plan.questions[0].draft.documentId).toBe(9);
    expect(r.plan.newTopics).toEqual([]);
    expect(importStatements(r.plan, { now: 1, model: IMPORT_MODEL }).some((s) => s.startsWith("INSERT INTO documents"))).toBe(false);
    expect(errorsOf({ ...file, documents: [{ key: "pdf", existing: "Nope.pdf" }] }, state)).toEqual([
      'Document 1 ("Nope.pdf"): no document in the app is called "Nope.pdf". Copy the name exactly as the Bank page shows it.',
    ]);
  });
});

describe("imported questions in the app", () => {
  let w: World;
  beforeEach(async () => {
    w = await makeWorld();
  });

  async function runImport() {
    const sets = await env.DB.batch(STATE_SQL.split("\n").map((s) => env.DB.prepare(s)));
    const r = planImport(example(), stateFromRows(sets as { results: any[] }[]), readExample);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    await env.DB.batch(importStatements(r.plan, { now: Date.now(), model: IMPORT_MODEL }).map((s) => env.DB.prepare(s)));
  }

  it("land as pending drafts that review, undo and the bank handle like AI drafts", async () => {
    await runImport();
    const bank = await call("GET", "/api/bank", { token: w.tokens.bank });
    expect(bank.body.topics.map((t: any) => [t.name, t.counts.pending, t.run.status, t.run.createdCount])).toEqual([
      ["Expense approval (example)", 2, "done", 2],
      ["Expense claims (example)", 2, "done", 2],
    ]);
    const queue = await call("GET", "/api/review/questions?status=waiting", { token: w.tokens.reviewer });
    expect(queue.body.counts).toEqual({ waiting: 4, reviewed: 0, total: 4 });
    const id = queue.body.items[0].id;
    const q = await call("GET", `/api/review/questions/${id}`, { token: w.tokens.reviewer });
    expect(q.body.source.documentName).toBe("Expense claims: quick guide (example)");
    expect(exampleDoc).toContain(q.body.source.quote);
    expect(q.body.source.removed).toBe(false);

    // Edit, then Undo restores the loaded version.
    const edited = await call("POST", `/api/review/questions/${id}/decision`, {
      token: w.tokens.reviewer,
      json: { action: "edit", expectedUpdatedAt: q.body.updatedAt, text: q.body.text + " (edited)", options: q.body.options, correctIndex: q.body.correctIndex, editKind: "minor" },
    });
    expect(edited.status).toBe(200);
    const undo = await call("POST", `/api/review/questions/${id}/undo`, { token: w.tokens.reviewer, json: { expectedUpdatedAt: edited.body.updatedAt } });
    expect(undo.status).toBe(200);
    const back = await call("GET", `/api/review/questions/${id}`, { token: w.tokens.reviewer });
    expect(back.body.text).toBe(q.body.text);
    expect(back.body.status).toBe("pending");
  });

  it("a second import of the same file is refused", async () => {
    await runImport();
    await expect(runImport()).rejects.toThrow(/the app already has a document with this name/);
  });
});
