import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { call, db, makeWorld, NAMES, type World } from "./helpers";
import { seedLoop } from "./scenario";
import { NOTICE_VERSION } from "../worker/lib/notice";
import { flags, flagTopics, formQuestions, participation, pilot, questions } from "../worker/db/schema";

/** Answers: for each Form A question, correct unless listed in `wrongTopics` (then wrong for 2 of 4). */
async function answersFor(w: World, form: "A" | "B", wrongPerTopic: Record<string, number> = {}) {
  const f = await call("GET", `/api/my/forms/${form.toLowerCase()}`, { token: w.tokens.student });
  expect(f.status).toBe(200);
  const ans: Record<string, number> = {};
  for (const t of f.body.topics) {
    t.questions.forEach((q: any, i: number) => {
      ans[q.id] = i < (wrongPerTopic[t.name] ?? 0) ? 0 : 1; // seeded correct index is 1
    });
  }
  return ans;
}

describe("student flow", () => {
  let w: World;
  let ids: Awaited<ReturnType<typeof seedLoop>>;
  beforeEach(async () => {
    w = await makeWorld();
    ids = await seedLoop(w, { submitA: false });
    await db().delete(participation);
  });

  it("T1 and T2 before and after the notice; the choice is stored with the notice version", async () => {
    expect((await call("GET", "/api/my/checks", { token: w.tokens.student })).body.state).toBe("notice");
    expect((await call("GET", "/api/me", { token: w.tokens.student })).body.needsNotice).toBe(true);
    const n = await call("GET", "/api/my/notice", { token: w.tokens.student });
    expect(n.body.version).toBe(NOTICE_VERSION);
    expect(n.text).toContain(NAMES.bank);
    expect(n.text).toContain(NAMES.fuo);
    expect(n.text).toContain(`${NAMES.reviewer}, who checks the questions, doesn't see your name or your answers.`);
    expect(n.text).toContain("about 8 multiple-choice questions on Returns process and Ticket tool");
    // Form not reachable before choosing.
    expect((await call("GET", "/api/my/forms/a", { token: w.tokens.student })).body.code).toBe("notice");
    await call("POST", "/api/my/participation", { token: w.tokens.student, json: { choice: "decline" } });
    expect((await call("GET", "/api/my/checks", { token: w.tokens.student })).body.state).toBe("declined");
    expect((await call("GET", "/api/my/forms/a", { token: w.tokens.student })).body.code).toBe("notice");
    // Changing their mind.
    await call("POST", "/api/my/participation", { token: w.tokens.student, json: { choice: "take_part" } });
    const c = await call("GET", "/api/my/checks", { token: w.tokens.student });
    expect(c.body).toMatchObject({ state: "form_a", questionCount: 8 });
    const rows = await db().select().from(participation);
    expect(rows.map((r) => [r.choice, r.noticeVersion])).toEqual([["decline", NOTICE_VERSION], ["take_part", NOTICE_VERSION]]);
  });

  it("the notice drops the reviewer sentence when the reviewer is also the manager", async () => {
    await call("PUT", "/api/roles/reviewer", { token: w.tokens.bank, json: { personId: w.ids.fuo } });
    const n = await call("GET", "/api/my/notice", { token: w.tokens.student });
    expect(n.text).not.toContain("who checks the questions");
  });

  it("the form hides correct answers and is gated on HR sign-off and Form A being sent", async () => {
    await call("POST", "/api/my/participation", { token: w.tokens.student, json: { choice: "take_part" } });
    const f = await call("GET", "/api/my/forms/a", { token: w.tokens.student });
    expect(f.body.total).toBe(8);
    expect(f.text).not.toMatch(/correct/i);
    // Only published questions of this form.
    const fq = await db().select().from(formQuestions).where(eq(formQuestions.form, "A"));
    expect(f.body.topics.flatMap((t: any) => t.questions.map((q: any) => q.id)).sort()).toEqual(fq.map((x) => x.questionId).sort());
    await db().update(pilot).set({ hrNoticeVersion: 0 }).where(eq(pilot.id, 1));
    expect((await call("GET", "/api/my/forms/a", { token: w.tokens.student })).body.code).toBe("not_available");
    await db().update(pilot).set({ hrNoticeVersion: 1, formASentAt: null }).where(eq(pilot.id, 1));
    expect((await call("GET", "/api/my/checks", { token: w.tokens.student })).body.state).toBe("nothing_sent");
    expect((await call("GET", "/api/my/forms/a", { token: w.tokens.student })).body.code).toBe("not_available");
  });

  it("submitting scores per topic, creates one flag for weak topics, and can happen once", async () => {
    await call("POST", "/api/my/participation", { token: w.tokens.student, json: { choice: "take_part" } });
    const ans = await answersFor(w, "A", { "Returns process": 2 });
    const partial = { ...ans };
    delete partial[Object.keys(partial)[0]];
    const miss = await call("POST", "/api/my/forms/a/attempt", { token: w.tokens.student, json: { answers: partial } });
    expect(miss.status).toBe(400);
    expect(miss.body.error).toBe("1 question still needs an answer.");
    const r = await call("POST", "/api/my/forms/a/attempt", { token: w.tokens.student, json: { answers: ans } });
    expect(r.status).toBe(201);
    const again = await call("POST", "/api/my/forms/a/attempt", { token: w.tokens.student, json: { answers: ans } });
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ code: "already_submitted", attemptId: r.body.attemptId });

    const [f] = await db().select().from(flags);
    expect(f.ownerPersonId).toBe(w.ids.fuo);
    const ft = await db().select().from(flagTopics).where(eq(flagTopics.flagId, f.id));
    expect(ft).toEqual([{ flagId: f.id, topicId: ids.weakTopicId, correct: 2, total: 4 }]);

    // R1: student sees per-topic results and correct answers, not the overall score.
    const mine = await call("GET", `/api/attempts/${r.body.attemptId}`, { token: w.tokens.student });
    expect(mine.body.viewer).toBe("self");
    expect(mine.body.overall).toBeNull();
    expect(mine.body.flag).toEqual({ dueDate: f.dueDate, id: null });
    expect(mine.body.topics.map((t: any) => [t.name, t.correct, t.total, t.below])).toEqual([
      ["Returns process", 2, 4, true],
      ["Ticket tool", 4, 4, false],
    ]);
    const adm = await call("GET", `/api/attempts/${r.body.attemptId}`, { token: w.tokens.cpo });
    expect(adm.body.overall).toEqual({ correct: 6, total: 8 });
    const mgr = await call("GET", `/api/attempts/${r.body.attemptId}`, { token: w.tokens.fuo });
    expect(mgr.body.overall).toBeNull();
    expect(mgr.body.flag.id).toBe(f.id);

    // T1: follow-up pending; Form B locked.
    const t1 = await call("GET", "/api/my/checks", { token: w.tokens.student });
    expect(t1.body).toMatchObject({ state: "followup_pending", dueDate: f.dueDate, followups: [{ topic: "Returns process", doneDate: null }] });
    expect((await call("GET", "/api/my/forms/b", { token: w.tokens.student })).body.code).toBe("not_available");
  });

  it("E7: no weak topic means no flag and Form B opens straight away", async () => {
    await call("POST", "/api/my/participation", { token: w.tokens.student, json: { choice: "take_part" } });
    const ans = await answersFor(w, "A", { "Returns process": 1 }); // 3 of 4 = 75%, not below 70%
    const r = await call("POST", "/api/my/forms/a/attempt", { token: w.tokens.student, json: { answers: ans } });
    expect(r.status).toBe(201);
    expect(await db().select().from(flags)).toHaveLength(0);
    const t1 = await call("GET", "/api/my/checks", { token: w.tokens.student });
    expect(t1.body.state).toBe("form_b_no_flag");
    expect((await call("GET", "/api/my/forms/b", { token: w.tokens.student })).status).toBe(200);
    // Form B never flags.
    const b = await answersFor(w, "B", { "Returns process": 4 });
    const rb = await call("POST", "/api/my/forms/b/attempt", { token: w.tokens.student, json: { answers: b } });
    expect(rb.status).toBe(201);
    expect(await db().select().from(flags)).toHaveLength(0);
    expect((await call("GET", "/api/my/checks", { token: w.tokens.student })).body.state).toBe("both_done");
  });

  it("student responses never contain drafts, notes or unpublished questions", async () => {
    const now = Date.now();
    await db().insert(questions).values({ topicId: ids.weakTopicId, text: "SECRET DRAFT", options: ["a", "b", "c", "d"], correctIndex: 0, status: "pending", createdAt: now, updatedAt: now });
    await call("POST", "/api/my/participation", { token: w.tokens.student, json: { choice: "take_part" } });
    for (const p of ["/api/my/checks", "/api/my/notice", "/api/my/forms/a", "/api/me"]) {
      const r = await call("GET", p, { token: w.tokens.student });
      expect(r.text).not.toContain("SECRET DRAFT");
      expect(r.text).not.toContain("correctIndex");
    }
  });
});

describe("A5 Send Form A", () => {
  it("is gated on readiness and returns the student's sign-in link", async () => {
    const w = await makeWorld();
    const blocked = await call("POST", "/api/pilot/form-a/link", { token: w.tokens.bank });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("Complete the readiness checklist to send Form A.");
    expect((await call("POST", "/api/pilot/form-a/sent", { token: w.tokens.bank })).status).toBe(409);
    await seedLoop(w, { submitA: false });
    await db().update(pilot).set({ formASentAt: null }).where(eq(pilot.id, 1));
    const link = await call("POST", "/api/pilot/form-a/link", { token: w.tokens.bank });
    expect(link.status).toBe(200);
    expect(link.body.studentName).toBe(NAMES.student);
    const token = link.body.url.split("#t=")[1];
    const ex = await call("POST", "/api/auth/exchange", { json: { token } });
    expect((await call("GET", "/api/me", { token: ex.body.sessionToken })).body.roles).toEqual(["student"]);
    expect((await call("POST", "/api/pilot/form-a/sent", { token: w.tokens.bank })).status).toBe(200);
    expect((await call("GET", "/api/pilot", { token: w.tokens.bank })).body.formASent).toMatch(/^\d{4}-/);
  });
});
