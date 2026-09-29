import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { unzipSync, strFromU8 } from "fflate";
import { eq } from "drizzle-orm";
import { call, db, makeWorld, NAMES, type World } from "./helpers";
import { seedLoop } from "./scenario";
import { safeCell, toCsv } from "../worker/lib/csv";
import { answers, attempts, deletionLog, flags, followups, participation, people, questions, roleAssignments, sessions } from "../worker/db/schema";

describe("CSV", () => {
  it("quotes per RFC 4180 and neutralises formulas", () => {
    expect(safeCell('He said "hi", then left')).toBe('"He said ""hi"", then left"');
    expect(safeCell("line1\nline2")).toBe('"line1\nline2"');
    expect(safeCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(safeCell("+49 123")).toBe("'+49 123");
    expect(safeCell("-5")).toBe("'-5");
    expect(safeCell("@cmd")).toBe("'@cmd");
    expect(safeCell(-5)).toBe("-5"); // real numbers stay numbers
    expect(safeCell(true)).toBe("yes");
    expect(safeCell(null)).toBe("");
  });
  it("starts with a BOM and uses CRLF", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("﻿a,b\r\n1,x\r\n");
  });
});

describe("A6 export", () => {
  it("is empty before any data, then returns a zip with the five CSVs", async () => {
    const w = await makeWorld();
    expect((await call("GET", "/api/export", { token: w.tokens.bank })).status).toBe(409);
    const ids = await seedLoop(w);
    const now = Date.now();
    await db().insert(questions).values({ topicId: ids.weakTopicId, text: "=bad", options: [], correctIndex: -1, status: "discarded", discardReason: "ungrounded", createdAt: now, updatedAt: now });
    await db().insert(followups).values({ flagId: ids.flagId, topicId: ids.weakTopicId, followupDate: "2026-10-05", note: "=HYPERLINK(evil)", loggedBy: w.ids.fuo, loggedAt: now, updatedAt: now });
    const r = await call("GET", "/api/export", { token: w.tokens.cpo });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/zip");
    expect(r.headers.get("content-disposition")).toMatch(/attachment; filename="knowledge-check-export-\d{4}-\d{2}-\d{2}\.zip"/);
    const files = unzipSync(new Uint8Array(r.body));
    expect(Object.keys(files).sort()).toEqual(["answers.csv", "attempts.csv", "flags_followups.csv", "participation.csv", "review_outcomes.csv"]);
    const text = (n: string) => strFromU8(files[n]);
    for (const f of Object.values(files)) expect([...f.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    expect(text("attempts.csv").split("\r\n")[0]).toBe(
      "attempt_id,person,version,form,submitted_at,overall_correct,overall_total,Returns process correct,Returns process total,Ticket tool correct,Ticket tool total",
    );
    expect(text("attempts.csv")).toContain(`${NAMES.student},1,A,`);
    expect(text("answers.csv").split("\r\n")).toHaveLength(8 + 2);
    const fl = text("flags_followups.csv").split("\r\n")[1];
    // Flag on 2026-10-01 (Thu), follow-up 2026-10-05 (Mon): 2 working days, within SLA.
    expect(fl).toContain("1 of 4");
    expect(fl).toContain("'=HYPERLINK(evil)");
    expect(fl).toMatch(/,2,yes$/);
    expect(text("review_outcomes.csv")).toContain("discarded invalid,ungrounded");
    expect(text("review_outcomes.csv")).toContain(",Form A");
    expect(text("participation.csv")).toContain(`${NAMES.student},1,take part,`);
  });
});

describe("A6 delete (all-or-nothing)", () => {
  let w: World;
  let ids: Awaited<ReturnType<typeof seedLoop>>;
  beforeEach(async () => {
    w = await makeWorld();
    ids = await seedLoop(w);
    await db().insert(followups).values({ flagId: ids.flagId, topicId: ids.weakTopicId, followupDate: "2026-10-05", note: "x", loggedBy: w.ids.fuo, loggedAt: 1, updatedAt: 1 });
  });

  it("shows exact counts and needs the exact name", async () => {
    const list = await call("GET", "/api/data/people", { token: w.tokens.bank });
    expect(list.body.people).toEqual([{ id: w.ids.student, name: NAMES.student, counts: { attempts: 1, answers: 8, flags: 1, followups: 1, participation: 1 } }]);
    expect(list.body.dayZero).toBe("2026-10-01");
    expect(list.body.retention).toBe("2027-01-29");
    const bad = await call("DELETE", `/api/data/people/${w.ids.student}`, { token: w.tokens.bank, json: { confirmName: "pat student" } });
    expect(bad.status).toBe(400);
    expect(await db().select().from(attempts)).toHaveLength(1);
  });

  it("rolls back completely when any part fails", async () => {
    await env.DB.exec("CREATE TRIGGER fail_log BEFORE INSERT ON deletion_log BEGIN SELECT RAISE(ABORT, 'injected'); END;");
    try {
      const r = await call("DELETE", `/api/data/people/${w.ids.student}`, { token: w.tokens.bank, json: { confirmName: NAMES.student } });
      expect(r.status).toBe(500);
      expect(r.body.error).toBe("Nothing was deleted. Try again.");
      expect(await db().select().from(attempts)).toHaveLength(1);
      expect(await db().select().from(answers)).toHaveLength(8);
      expect(await db().select().from(flags)).toHaveLength(1);
      expect(await db().select().from(followups)).toHaveLength(1);
      expect(await db().select().from(participation)).toHaveLength(1);
      expect(await db().select().from(sessions).where(eq(sessions.personId, w.ids.student))).toHaveLength(1);
    } finally {
      await env.DB.exec("DROP TRIGGER fail_log;");
    }
  });

  it("deletes everything about the person, keeps the person, role and review outcomes, and logs it", async () => {
    const r = await call("DELETE", `/api/data/people/${w.ids.student}`, { token: w.tokens.bank, json: { confirmName: NAMES.student } });
    expect(r.status).toBe(200);
    for (const t of [attempts, answers, flags, followups, participation]) expect(await db().select().from(t)).toHaveLength(0);
    expect(await db().select().from(sessions).where(eq(sessions.personId, w.ids.student))).toHaveLength(0);
    expect(await db().select().from(people).where(eq(people.id, w.ids.student))).toHaveLength(1);
    expect(await db().select().from(roleAssignments).where(eq(roleAssignments.personId, w.ids.student))).toHaveLength(1);
    expect((await db().select().from(questions)).length).toBeGreaterThan(0);
    const [log] = await db().select().from(deletionLog);
    expect(log).toMatchObject({ personName: NAMES.student, deletedByName: NAMES.bank, counts: { attempts: 1, answers: 8, flags: 1, followups: 1, participation: 1 } });
    // V3 statistics are computed live, so they are gone too (decision 5).
    const stats = await call("GET", "/api/stats", { token: w.tokens.reviewer });
    expect(stats.body.questions.every((q: any) => q.shown === false)).toBe(true);
    // A1 shows the deletion record and "Data deleted" loop rows; R1 is gone.
    const a1 = await call("GET", "/api/pilot", { token: w.tokens.cpo });
    expect(a1.body.deletion).toMatchObject({ name: NAMES.student, by: NAMES.bank });
    expect(a1.body.loop.find((x: any) => x.stage === "Notice").status).toMatch(/^Data deleted /);
    expect((await call("GET", `/api/attempts/${ids.attemptId}`, { token: w.tokens.cpo })).status).toBe(404);
  });
});

describe("A1 loop, key dates and M3", () => {
  it("shows the loop for a flagged Form A, the overall score, key dates and the K3 banner", async () => {
    const w = await makeWorld();
    const ids = await seedLoop(w);
    const now = Date.now();
    // 3 rejected + 1 substantial out of 16+4 reviewed -> 20%; add rejections to pass 50%.
    for (let i = 0; i < 20; i++)
      await db().insert(questions).values({ topicId: ids.weakTopicId, text: `r${i}`, options: ["a", "b", "c", "d"], correctIndex: 0, status: "rejected", createdAt: now, updatedAt: now });
    const r = await call("GET", "/api/pilot", { token: w.tokens.cpo });
    const loop = Object.fromEntries(r.body.loop.map((x: any) => [x.stage, x.status]));
    expect(loop["Notice"]).toMatch(/^Took part /);
    expect(loop["Form A submitted (day 0)"]).toBe("Thu 1 Oct · overall 5 of 8");
    expect(loop["Flags"]).toBe("1 topic");
    expect(loop["Follow-up"]).toMatch(/^Due Thu 8 Oct · (On time|Overdue by \d+ working days?)$/);
    expect(loop["Form B available"]).toBe("Not yet");
    expect(r.body.keyDates).toEqual({ dayZero: "2026-10-01", dayNinety: "2026-12-30", retention: "2027-01-29" });
    expect(r.body.m3).toMatchObject({ reviewed: 36, rejected: 20, rewriteRatePct: 56 });
    expect(r.body.k3).toBe(true);
  });

  it("E8: admins see a decline", async () => {
    const w = await makeWorld();
    await seedLoop(w, { submitA: false });
    await call("POST", "/api/my/participation", { token: w.tokens.student, json: { choice: "decline" } });
    const r = await call("GET", "/api/pilot", { token: w.tokens.bank });
    expect(r.body.loop.find((x: any) => x.stage === "Notice").status).toMatch(/^Declined /);
  });
});
