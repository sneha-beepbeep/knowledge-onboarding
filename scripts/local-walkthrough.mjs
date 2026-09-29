// Local API walkthrough of flows 0-4 against `npm run dev` (mock AI, fresh local DB).
// Usage: rm -rf .wrangler/state && npm run dev   (in one terminal)
//        node scripts/local-walkthrough.mjs       (in another)
// Needs .dev.vars from .dev.vars.example (BOOTSTRAP_TOKEN=local-bootstrap-token),
// with AI_ENABLED=true: this walkthrough drafts with the mock AI.
const BASE = "http://localhost:5173";
const log = (...a) => console.log(...a);
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; log("  FAIL:", msg); } else log("  ok:", msg); };
async function api(method, path, { token, json } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(BASE + path, { method, headers, body: json !== undefined ? JSON.stringify(json) : undefined });
  const ct = r.headers.get("content-type") || "";
  const body = ct.includes("json") ? await r.json() : await r.arrayBuffer();
  return { status: r.status, body, headers: r.headers };
}
const exchange = async (url) => (await api("POST", "/api/auth/exchange", { json: { token: url.split("#t=")[1] } })).body.sessionToken;

log("Flow 0: set-up");
const boot = await api("POST", "/api/auth/bootstrap", { json: { token: "local-bootstrap-token", name: "Casey Sponsor" } });
check(boot.status === 201, "CPO bootstrap");
const cpo = boot.body.sessionToken;
check((await api("POST", "/api/auth/bootstrap", { json: { token: "local-bootstrap-token", name: "X" } })).status === 404, "bootstrap shuts off");
for (const [role, name] of [["bank_owner", "Blake Bankowner"], ["reviewer", "Riley Reviewer"], ["follow_up_owner", "Morgan Manager"], ["student", "Pat Student"]])
  check((await api("PUT", `/api/roles/${role}`, { token: cpo, json: { name } })).status === 200, `assign ${role}`);
const roles = (await api("GET", "/api/roles", { token: cpo })).body;
const idOf = (r) => roles.roles.find((x) => x.role === r).person.personId;
const tok = {};
for (const r of ["bank_owner", "reviewer", "follow_up_owner"]) tok[r] = await exchange((await api("POST", `/api/people/${idOf(r)}/link`, { token: cpo })).body.url);
let a1 = (await api("GET", "/api/pilot", { token: tok.bank_owner })).body;
check(a1.readiness.items.rolesNamed && a1.readiness.items.aiSetUp && !a1.readiness.items.bankPublished, "readiness: roles + AI (mock) done, bank not published");

log("Flow 1: bank, drafting (Workflow under vite dev), review, publish");
const para = (t, n) => Array.from({ length: n }, (_, i) => `${t} rule ${i + 1}: an item returned after ${i + 5} days needs a receipt and a manager's approval.`).join("\n\n");
for (const [name, topic] of [["Returns guide", "Returns process"], ["Ticket tool handbook", "Ticket tool"]])
  check((await api("POST", "/api/documents", { token: tok.bank_owner, json: { name, versionDate: "2026-08-01", topics: [topic], text: para(topic, 12), source: "paste" } })).status === 201, `add ${name}`);
let bank = (await api("GET", "/api/bank", { token: tok.bank_owner })).body;
check((await api("POST", "/api/bank/consent", { token: tok.bank_owner })).status === 200, "drafting consent");
for (const t of bank.topics) check((await api("POST", `/api/topics/${t.id}/drafts`, { token: tok.bank_owner, json: { kind: "initial" } })).status === 202, `start drafting ${t.name}`);
const t0 = Date.now();
while (Date.now() - t0 < 30000) {
  bank = (await api("GET", "/api/bank", { token: tok.bank_owner })).body;
  if (bank.topics.every((t) => t.run && t.run.status !== "running")) break;
  await new Promise((r) => setTimeout(r, 500));
}
for (const t of bank.topics) check(t.run.status === "done" && t.counts.pending === 10, `${t.name}: workflow done, 10 drafts (${t.run.status}, ${t.counts.pending})`);
const me = (await api("GET", "/api/me", { token: tok.reviewer })).body;
check(me.badges.review === 20, "reviewer badge Review (20)");
let q = (await api("GET", "/api/review/questions?status=waiting", { token: tok.reviewer })).body;
let i = 0;
for (const item of q.items) {
  const d = (await api("GET", `/api/review/questions/${item.id}`, { token: tok.reviewer })).body;
  let json = { action: "approve", expectedUpdatedAt: d.updatedAt };
  if (i === 0) json = { action: "reject", expectedUpdatedAt: d.updatedAt, reasons: ["trivia"] };
  if (i === 1) json = { action: "edit", expectedUpdatedAt: d.updatedAt, text: d.text + " (edited)", options: d.options, correctIndex: d.correctIndex, editKind: "minor" };
  const r = await api("POST", `/api/review/questions/${item.id}/decision`, { token: tok.reviewer, json });
  if (r.status !== 200) check(false, `decision ${item.id}: ${r.status}`);
  i++;
}
check((await api("GET", "/api/stats", { token: tok.reviewer })).body.m3.total.reviewed === 20, "M3: 20 reviewed");
const pub = (await api("GET", "/api/publish", { token: tok.bank_owner })).body;
const pr = await api("POST", "/api/publish", { token: tok.bank_owner, json: { thresholdPct: 70, topics: pub.topics.map((t) => ({ topicId: t.id, A: t.split.A, B: t.split.B })) } });
check(pr.status === 201, "publish version 1");
check((await api("POST", "/api/documents", { token: tok.bank_owner, json: { name: "x", versionDate: "2026-08-01", topics: ["x"], text: "x", source: "paste" } })).status === 409, "bank frozen after publish");

log("Flow 2: HR gate, Form A, notice, quiz");
check((await api("POST", "/api/pilot/form-a/link", { token: tok.bank_owner })).status === 409, "Send Form A blocked without HR sign-off");
check((await api("POST", "/api/pilot/hr-signoff", { token: tok.bank_owner, json: { date: "2026-09-28", by: "HR" } })).status === 404, "HR sign-off: bank owner refused (CPO only)");
check((await api("POST", "/api/pilot/hr-signoff", { token: cpo, json: { date: "2026-09-28", by: "HR Partner" } })).status === 200, "HR sign-off by CPO");
const fa = await api("POST", "/api/pilot/form-a/link", { token: tok.bank_owner });
check(fa.status === 200 && fa.body.url.includes("/start#t="), "Form A link created");
check((await api("POST", "/api/pilot/form-a/sent", { token: tok.bank_owner })).status === 200, "Mark as sent");
const stu = await exchange(fa.body.url);
check((await api("GET", "/api/me", { token: stu })).body.needsNotice === true, "student lands on the notice");
check((await api("GET", "/api/flags", { token: tok.follow_up_owner })).body.state === "not_taken", "manager sees 'hasn't taken check 1 yet'");
check((await api("POST", "/api/my/participation", { token: stu, json: { choice: "take_part" } })).status === 200, "Take part");
const form = (await api("GET", "/api/my/forms/a", { token: stu })).body;
check(form.total === 8 && !JSON.stringify(form).includes("correctIndex"), "Form A: 8 questions, no answers sent");
// Answer: first topic all wrong-ish (1 of 4), second topic all right. The mock's correct option is index 1.
const ans = {};
form.topics.forEach((t, ti) => t.questions.forEach((qq, qi) => { ans[qq.id] = ti === 0 && qi > 0 ? 0 : 1; }));
const sub = await api("POST", "/api/my/forms/a/attempt", { token: stu, json: { answers: ans } });
check(sub.status === 201, "submit Form A");
const r1 = (await api("GET", `/api/attempts/${sub.body.attemptId}`, { token: stu })).body;
check(r1.overall === null && r1.topics.some((t) => t.below), "R1: weak topic shown, no overall score for the student");

log("Flow 3: flag, follow-up, Form B, comparison");
const flagsList = (await api("GET", "/api/flags", { token: tok.follow_up_owner })).body;
check(flagsList.flags.length === 1, "manager sees one flag");
const fl = (await api("GET", `/api/flags/${flagsList.flags[0].id}`, { token: tok.follow_up_owner })).body;
check((await api("GET", `/api/documents/${fl.topics[0].documents[0].id}`, { token: tok.follow_up_owner })).status === 200, "manager opens the weak topic's source");
check((await api("GET", "/api/my/forms/b", { token: stu })).body.code === "not_available", "Form B locked before follow-up");
const fu = await api("PUT", `/api/flags/${fl.id}/followups/${fl.topics[0].topicId}`, { token: tok.follow_up_owner, json: { date: fl.today, note: "30-min walkthrough of returns" } });
check(fu.status === 200 && fu.body.allDone, "follow-up logged; all done");
const t1 = (await api("GET", "/api/my/checks", { token: stu })).body;
check(t1.state === "form_b" && !JSON.stringify(t1).includes("walkthrough"), "T1: check 2 open, note not shown");
const fb = (await api("GET", "/api/my/forms/b", { token: stu })).body;
const ansB = {};
fb.topics.forEach((t) => t.questions.forEach((qq) => { ansB[qq.id] = 1; }));
const subB = await api("POST", "/api/my/forms/b/attempt", { token: stu, json: { answers: ansB } });
check(subB.status === 201, "submit Form B");
const cmp = (await api("GET", `/api/comparison/${idOf("student")}`, { token: tok.follow_up_owner })).body;
check(cmp.bothDone && cmp.rows.some((r) => r.change > 0), "R2 comparison shows improvement");
a1 = (await api("GET", "/api/pilot", { token: cpo })).body;
log("  A1 loop:", a1.loop.map((r) => `${r.stage}=${r.status}`).join(" | "));
check(a1.keyDates.dayZero !== null, "A1 key dates set");

log("Flow 4: export and delete");
const ex = await api("GET", "/api/export", { token: cpo });
check(ex.status === 200 && ex.headers.get("content-type") === "application/zip" && ex.body.byteLength > 500, `export zip (${ex.body.byteLength} bytes)`);
const del = await api("DELETE", `/api/data/people/${idOf("student")}`, { token: cpo, json: { confirmName: "Pat Student" } });
check(del.status === 200, "delete student data");
a1 = (await api("GET", "/api/pilot", { token: cpo })).body;
check(a1.deletion && a1.loop.at(-1).status.startsWith("Data deleted"), "A1 shows 'Data deleted'");
check((await api("GET", "/api/me", { token: stu })).status === 401, "student's sessions removed");

log(failures ? `\n${failures} FAILURE(S)` : "\nWALKTHROUGH PASSED");
process.exit(failures ? 1 : 0);
