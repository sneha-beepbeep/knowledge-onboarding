import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { addPerson, call, db, makeWorld, NAMES, type World } from "./helpers";
import { seedLoop } from "./scenario";
import { attempts, flagTopics, flags, followups, participation } from "../worker/db/schema";
import { NOTICE_VERSION } from "../worker/lib/notice";
import { addWorkingDays, dateInTz } from "../shared/dates";

const todayUtc = () => dateInTz(Date.now(), "UTC");

describe("M1 privacy: declined and not started look the same to the manager", () => {
  it("returns byte-identical responses", async () => {
    const w = await makeWorld();
    await seedLoop(w, { submitA: false });
    await db().delete(participation);
    const notStarted = await call("GET", "/api/flags", { token: w.tokens.fuo });
    await db().insert(participation).values({ personId: w.ids.student, noticeVersion: NOTICE_VERSION, choice: "decline", recordedAt: Date.now() });
    const declined = await call("GET", "/api/flags", { token: w.tokens.fuo });
    expect(notStarted.status).toBe(200);
    expect(declined.text).toBe(notStarted.text);
    expect(declined.body.state).toBe("not_taken");
    expect(declined.text).not.toMatch(/declin/i);
  });
});

describe("M2 follow-up log and Form B unlock", () => {
  let w: World;
  let ids: Awaited<ReturnType<typeof seedLoop>>;
  beforeEach(async () => {
    w = await makeWorld();
    ids = await seedLoop(w);
    // Flag created today so date validation is realistic.
    const t = todayUtc();
    await db().update(flags).set({ flaggedDate: t, dueDate: addWorkingDays(t, 5) }).where(eq(flags.id, ids.flagId));
  });

  it("M1 lists the flag with its status", async () => {
    const r = await call("GET", "/api/flags", { token: w.tokens.fuo });
    expect(r.body.state).toBe("taken");
    expect(r.body.flags).toEqual([
      { id: ids.flagId, studentName: NAMES.student, weakCount: 1, flaggedDate: todayUtc(), dueDate: addWorkingDays(todayUtc(), 5), status: { kind: "due", days: 5 } },
    ]);
    expect((await call("GET", "/api/me", { token: w.tokens.fuo })).body.badges.flags).toBe(1);
  });

  it("shows overdue in working days", async () => {
    await db().update(flags).set({ dueDate: "2020-01-01", flaggedDate: "2019-12-24" }).where(eq(flags.id, ids.flagId));
    const r = await call("GET", "/api/flags", { token: w.tokens.fuo });
    expect(r.body.flags[0].status.kind).toBe("overdue");
    expect(r.body.flags[0].status.days).toBeGreaterThan(100);
  });

  it("validates, logs, unlocks Form B 10 working days out, keeps the note from the student", async () => {
    const put = (json: unknown, token = w.tokens.fuo) =>
      call("PUT", `/api/flags/${ids.flagId}/followups/${ids.weakTopicId}`, { token, json });
    const t = todayUtc();
    expect((await put({ date: "", note: "x" })).body.error).toBe("Add the date of the follow-up.");
    expect((await put({ date: "2099-01-01", note: "x" })).body.error).toBe("The date can't be in the future.");
    expect((await put({ date: "2020-01-01", note: "x" })).body.error).toMatch(/can't be before the flag/);
    expect((await put({ date: t, note: "  " })).body.error).toBe("Add a short note about what was done.");
    expect((await put({ date: t, note: "x".repeat(201) })).status).toBe(400);
    // Admins can read but not log.
    expect((await put({ date: t, note: "Walkthrough" }, w.tokens.cpo)).status).toBe(404);

    const ok = await put({ date: t, note: "SECRET NOTE walkthrough of returns" });
    expect(ok.body).toEqual({ ok: true, allDone: true, formBDueDate: addWorkingDays(t, 10) });
    const [first] = await db().select().from(followups);
    await new Promise((r) => setTimeout(r, 5));
    await put({ date: t, note: "SECRET NOTE edited" });
    const [edited] = await db().select().from(followups);
    expect(edited.loggedAt).toBe(first.loggedAt);
    expect(edited.updatedAt).toBeGreaterThan(first.updatedAt);

    const detail = await call("GET", `/api/flags/${ids.flagId}`, { token: w.tokens.fuo });
    expect(detail.body.allDone).toBe(true);
    expect(detail.body.topics[0].followup.note).toBe("SECRET NOTE edited");
    expect((await call("GET", "/api/me", { token: w.tokens.fuo })).body.badges.flags).toBe(0);

    // Student: Form B open, due 10 working days after the follow-up; never the note.
    const t1 = await call("GET", "/api/my/checks", { token: w.tokens.student });
    expect(t1.body).toMatchObject({ state: "form_b", dueDate: addWorkingDays(t, 10), followups: [{ topic: "Returns process", doneDate: t }] });
    for (const p of ["/api/my/checks", `/api/attempts/${ids.attemptId}`, `/api/comparison/${w.ids.student}`, "/api/my/notice"]) {
      const r = await call("GET", p, { token: w.tokens.student });
      expect(r.text).not.toContain("SECRET NOTE");
      expect(r.text).not.toContain('"note"');
    }
    expect((await call("GET", "/api/my/forms/b", { token: w.tokens.student })).status).toBe(200);
  });

  it("Form B stays locked until every weak topic is logged; the log closes after Form B", async () => {
    await db().insert(flagTopics).values({ flagId: ids.flagId, topicId: ids.topicIds[1], correct: 2, total: 4 });
    const t = todayUtc();
    await call("PUT", `/api/flags/${ids.flagId}/followups/${ids.weakTopicId}`, { token: w.tokens.fuo, json: { date: t, note: "Done one" } });
    expect((await call("GET", "/api/my/forms/b", { token: w.tokens.student })).body.code).toBe("not_available");
    const r = await call("PUT", `/api/flags/${ids.flagId}/followups/${ids.topicIds[1]}`, { token: w.tokens.fuo, json: { date: t, note: "Done two" } });
    expect(r.body.allDone).toBe(true);
    const form = await call("GET", "/api/my/forms/b", { token: w.tokens.student });
    const answers: Record<string, number> = {};
    for (const tp of form.body.topics) for (const q of tp.questions) answers[q.id] = 1;
    expect((await call("POST", "/api/my/forms/b/attempt", { token: w.tokens.student, json: { answers } })).status).toBe(201);
    expect((await call("PUT", `/api/flags/${ids.flagId}/followups/${ids.weakTopicId}`, { token: w.tokens.fuo, json: { date: t, note: "Late edit" } })).status).toBe(409);

    // R2 comparison, same for student, manager and admin.
    const cmp = await call("GET", `/api/comparison/${w.ids.student}`, { token: w.tokens.student });
    expect(cmp.body.bothDone).toBe(true);
    const returns = cmp.body.rows.find((x: any) => x.name === "Returns process");
    expect(returns).toMatchObject({ a: { correct: 1, total: 4 }, b: { correct: 4, total: 4 }, change: 3, weakInA: true, followedUpDate: t });
    expect(cmp.body.perTopic).toBe(4);
    const mgr = await call("GET", `/api/comparison/${w.ids.student}`, { token: w.tokens.fuo });
    expect(mgr.body.rows).toEqual(cmp.body.rows);
  });

  it("a new follow-up owner takes over; the old one loses access", async () => {
    const buddy = await addPerson("Jordan Buddy");
    await call("PUT", "/api/roles/follow_up_owner", { token: w.tokens.bank, json: { personId: buddy.id } });
    // The old owner no longer holds the role at all.
    expect((await call("GET", `/api/flags/${ids.flagId}`, { token: w.tokens.fuo })).status).toBe(404);
    expect((await call("GET", `/api/attempts/${ids.attemptId}`, { token: w.tokens.fuo })).status).toBe(404);
    const now = await call("GET", `/api/flags/${ids.flagId}`, { token: buddy.token });
    expect(now.status).toBe(200);
    expect(now.body.canEdit).toBe(true);
  });

  it("a follow-up owner can't see flags of a person who isn't the current student", async () => {
    const other = await addPerson("Other Joiner");
    const [a] = await db().insert(attempts).values({ personId: other.id, versionId: ids.versionId, form: "A", submittedAt: 1, submittedDate: "2026-10-01", overallCorrect: 0, overallTotal: 8 }).returning();
    const [f] = await db().insert(flags).values({ attemptId: a.id, personId: other.id, ownerPersonId: w.ids.fuo, flaggedAt: 1, flaggedDate: "2026-10-01", dueDate: "2026-10-08" }).returning();
    expect((await call("GET", `/api/flags/${f.id}`, { token: w.tokens.fuo })).status).toBe(404);
    expect((await call("GET", `/api/attempts/${a.id}`, { token: w.tokens.fuo })).status).toBe(404);
    const list = await call("GET", "/api/flags", { token: w.tokens.fuo });
    expect(list.body.flags.map((x: any) => x.id)).toEqual([ids.flagId]);
  });
});
