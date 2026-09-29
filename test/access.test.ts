// Access matrix (technical plan §8): every route × {no session, student,
// follow-up owner, reviewer, bank owner, CPO}. Each persona holds exactly one role.
// "ok" means any 2xx or a 4xx that is NOT an access failure (400/409), i.e. the
// caller got past the access check. 404 and 401 are access failures.
import { beforeAll, describe, expect, it } from "vitest";
import { call, makeWorld, PERSONAS, type Persona, type World } from "./helpers";
import { seedLoop } from "./scenario";

type Expect = "ok" | 404 | 401;
type Row = {
  method: string;
  path: (ids: Ids) => string;
  json?: unknown;
  allowed: Persona[];
};
type Ids = Awaited<ReturnType<typeof seedLoop>>;

const ALL: Persona[] = ["student", "fuo", "bank", "reviewer", "cpo"];
const ADM: Persona[] = ["bank", "cpo"];

// Read-only routes plus writes that fail validation after the access check,
// so the matrix never changes state it depends on.
const MATRIX: Row[] = [
  { method: "GET", path: () => "/api/me", allowed: ALL },
  { method: "GET", path: () => "/api/pilot", allowed: ADM },
  { method: "POST", path: () => "/api/pilot/hr-signoff", json: {}, allowed: ["cpo"] },
  { method: "GET", path: () => "/api/roles", allowed: ADM },
  { method: "PUT", path: () => "/api/roles/reviewer", json: {}, allowed: ADM },
  { method: "PUT", path: () => "/api/roles/cpo", json: {}, allowed: ["cpo"] },
  { method: "GET", path: () => "/api/bank", allowed: ADM },
  { method: "PUT", path: () => "/api/bank/settings", json: { perTopicCount: 99 }, allowed: ADM },
  { method: "POST", path: () => "/api/documents", json: {}, allowed: ADM },
  { method: "GET", path: (i) => `/api/documents/${i.weakDocId}`, allowed: [...ADM, "reviewer", "fuo"] },
  { method: "GET", path: (i) => `/api/documents/${i.solidOnlyDocId}`, allowed: [...ADM, "reviewer"] },
  { method: "POST", path: (i) => `/api/topics/${i.topicIds[0]}/drafts`, json: { kind: "bogus" }, allowed: ADM },
  { method: "GET", path: () => "/api/publish", allowed: ADM },
  { method: "GET", path: () => "/api/review/questions?status=waiting", allowed: [...ADM, "reviewer"] },
  { method: "GET", path: (i) => `/api/review/questions/${i.questionId}`, allowed: [...ADM, "reviewer"] },
  { method: "POST", path: (i) => `/api/review/questions/${i.questionId}/decision`, json: {}, allowed: ["reviewer"] },
  { method: "POST", path: (i) => `/api/review/questions/${i.questionId}/undo`, json: {}, allowed: ["reviewer"] },
  { method: "GET", path: () => "/api/stats", allowed: [...ADM, "reviewer"] },
  { method: "GET", path: () => "/api/my/checks", allowed: ["student"] },
  { method: "GET", path: () => "/api/my/notice", allowed: ["student"] },
  { method: "POST", path: () => "/api/my/participation", json: { choice: "bogus" }, allowed: ["student"] },
  { method: "GET", path: () => "/api/my/forms/b", allowed: ["student"] },
  { method: "POST", path: () => "/api/my/forms/b/attempt", json: {}, allowed: ["student"] },
  { method: "GET", path: (i) => `/api/attempts/${i.attemptId}`, allowed: ["student", "fuo", ...ADM] },
  { method: "GET", path: (i) => `/api/comparison/${i.studentId}`, allowed: ["student", "fuo", ...ADM] },
  { method: "GET", path: () => "/api/flags", allowed: ["fuo", ...ADM] },
  { method: "GET", path: (i) => `/api/flags/${i.flagId}`, allowed: ["fuo", ...ADM] },
  { method: "PUT", path: (i) => `/api/flags/${i.flagId}/followups/${i.weakTopicId}`, json: {}, allowed: ["fuo"] },
  { method: "GET", path: () => "/api/export", allowed: ADM },
  { method: "GET", path: () => "/api/data/people", allowed: ADM },
  { method: "DELETE", path: (i) => `/api/data/people/${i.studentId}`, json: { confirmName: "wrong" }, allowed: ADM },
  { method: "POST", path: () => "/api/pilot/form-a/sent", json: { bogus: true }, allowed: ADM },
];

// Routes are added to the build step by step; rows for routes not built yet are todo.
const BUILT = new Set([
  "GET /api/me",
  "GET /api/pilot",
  "POST /api/pilot/hr-signoff",
  "GET /api/roles",
  "PUT /api/roles/reviewer",
  "PUT /api/roles/cpo",
  "GET /api/bank",
  "PUT /api/bank/settings",
  "POST /api/documents",
  "GET /api/documents/0",
  "POST /api/topics/0/drafts",
  "GET /api/review/questions?status=waiting",
  "GET /api/review/questions/0",
  "POST /api/review/questions/0/decision",
  "POST /api/review/questions/0/undo",
  "GET /api/stats",
  "GET /api/publish",
  "GET /api/my/checks",
  "GET /api/my/notice",
  "POST /api/my/participation",
  "GET /api/my/forms/b",
  "POST /api/my/forms/b/attempt",
  "GET /api/attempts/0",
  "GET /api/comparison/0",
  "POST /api/pilot/form-a/sent",
  "GET /api/flags",
  "GET /api/flags/0",
  "PUT /api/flags/0/followups/0",
  "GET /api/export",
  "GET /api/data/people",
  "DELETE /api/data/people/0",
]);
const built = (label: string) => BUILT.has(label);

describe("access matrix", () => {
  let w: World;
  let ids: Ids;
  beforeAll(async () => {
    w = await makeWorld();
    ids = await seedLoop(w);
  });

  for (const row of MATRIX) {
    const label = `${row.method} ${row.path({ weakDocId: 0, solidOnlyDocId: 0, topicIds: [0], questionId: 0, attemptId: 0, studentId: 0, flagId: 0, weakTopicId: 0 } as unknown as Ids)}`;
    if (!built(label)) {
      it.todo(label);
      continue;
    }
    it(label, async () => {
      const path = row.path(ids);
      const anon = await call(row.method, path, { json: row.json });
      expect(anon.status, `${label} anonymous`).toBe(401);
      for (const p of PERSONAS) {
        const res = await call(row.method, path, { token: w.tokens[p], json: row.json });
        const expected: Expect = row.allowed.includes(p) ? "ok" : 404;
        if (expected === "ok") {
          expect([401, 404], `${label} as ${p} should pass access (got ${res.status})`).not.toContain(res.status);
        } else {
          expect(res.status, `${label} as ${p}`).toBe(404);
          expect(res.body.error).toBe("This page isn't available to you.");
        }
      }
      const outsider = await call(row.method, path, { token: w.outsider.token, json: row.json });
      expect(outsider.status, `${label} as no-role`).toBe(path === "/api/me" ? 200 : 404);
    });
  }

  it.skipIf(!built("GET /api/attempts/0"))("a student can't reach another person's results", async () => {
    const other = await call("GET", `/api/attempts/${ids.attemptId + 999}`, { token: w.tokens.student });
    const cmp = await call("GET", `/api/comparison/${w.ids.fuo}`, { token: w.tokens.student });
    expect(other.status).toBe(404);
    expect(cmp.status).toBe(404);
    expect(other.text).toBe(cmp.text);
  });
});
