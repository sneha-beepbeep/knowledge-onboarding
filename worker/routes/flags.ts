// M1 Flags and M2 Flag detail & follow-up log (F7, F8, F9).
// The manager has no route that returns participation: "declined" and "not
// started" are the same `not_taken` state (decision 6).
import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppEnv, Me } from "../types";
import { ADMIN, allow, has, isAdmin } from "../auth";
import { body, badRequest, conflict, idParam, notAvailable, str } from "../lib/http";
import { getDb, getRoleMap, getVersion, today, type DB } from "../lib/state";
import { FOLLOWUP_SLA_DAYS, FORM_B_DUE_DAYS, loadFlags, type FlagDetail } from "../lib/flags";
import { topicDocuments } from "../lib/bank";
import { attempts, followups } from "../db/schema";
import { addWorkingDays, formatDate, isIsoDate, workingDaysBetween } from "../../shared/dates";

type Status = { kind: "due"; days: number } | { kind: "overdue"; days: number } | { kind: "done"; date: string };

function flagStatus(f: FlagDetail, t: string): Status {
  if (f.allDone) return { kind: "done", date: f.lastFollowupDate! };
  if (t > f.dueDate) return { kind: "overdue", days: workingDaysBetween(f.dueDate, t) };
  return { kind: "due", days: workingDaysBetween(t, f.dueDate) };
}

/** FUO: only flags they own for the current student. Admins: all. */
async function visibleFlag(db: DB, me: Me, id: number) {
  const [f] = await loadFlags(db, { id });
  if (!f) return null;
  if (isAdmin(me)) return f;
  if (!has(me, "follow_up_owner") || f.ownerPersonId !== me.personId) return null;
  const roles = await getRoleMap(db);
  return roles.student?.personId === f.personId ? f : null;
}

async function formBSubmitted(db: DB, personId: number) {
  const [b] = await db.select({ id: attempts.id }).from(attempts).where(and(eq(attempts.personId, personId), eq(attempts.form, "B")));
  return !!b;
}

export const flagRoutes = new Hono<AppEnv>()
  .get("/flags", allow("follow_up_owner", ...ADMIN), async (c) => {
    const me = c.get("me");
    const db = getDb(c.env);
    const [roles, version] = await Promise.all([getRoleMap(db), getVersion(db)]);
    const student = roles.student;
    const t = today(c.env);
    let taken = false;
    if (student && version) {
      const [a] = await db
        .select({ id: attempts.id })
        .from(attempts)
        .where(and(eq(attempts.personId, student.personId), eq(attempts.form, "A")));
      taken = !!a;
    }
    const list = isAdmin(me)
      ? await loadFlags(db, {})
      : student
        ? await loadFlags(db, { ownerPersonId: me.personId, personId: student.personId })
        : [];
    const names = new Map<number, string>();
    if (student) names.set(student.personId, student.name);
    return c.json(
      {
        studentName: student?.name ?? null,
        thresholdPct: version?.thresholdPct ?? 70,
        state: taken ? ("taken" as const) : ("not_taken" as const),
        flags: list.map((f) => ({
          id: f.id,
          studentName: names.get(f.personId) ?? "Former student",
          weakCount: f.topics.length,
          flaggedDate: f.flaggedDate,
          dueDate: f.dueDate,
          status: flagStatus(f, t),
        })),
      },
      200,
    );
  })

  .get("/flags/:id", allow("follow_up_owner", ...ADMIN), async (c) => {
    const id = idParam(c.req.param("id"));
    if (!id) return notAvailable(c);
    const me = c.get("me");
    const db = getDb(c.env);
    const f = await visibleFlag(db, me, id);
    if (!f) return notAvailable(c);
    const roles = await getRoleMap(db);
    const [a] = await db.select().from(attempts).where(eq(attempts.id, f.attemptId));
    const docs = await topicDocuments(db, f.topics.map((x) => x.topicId));
    const bDone = await formBSubmitted(db, f.personId);
    const t = today(c.env);
    const student = roles.student?.personId === f.personId ? roles.student.name : null;
    return c.json(
      {
        id: f.id,
        studentName: student ?? "Former student",
        attemptId: f.attemptId,
        attemptDate: a?.submittedDate ?? f.flaggedDate,
        flaggedDate: f.flaggedDate,
        dueDate: f.dueDate,
        slaDays: FOLLOWUP_SLA_DAYS,
        status: flagStatus(f, t),
        today: t,
        canEdit: has(me, "follow_up_owner") && f.ownerPersonId === me.personId && roles.student?.personId === f.personId && !bDone,
        formBSubmitted: bDone,
        allDone: f.allDone,
        formBDueDate: f.allDone ? addWorkingDays(f.lastFollowupDate!, FORM_B_DUE_DAYS) : null,
        topics: f.topics.map((x) => ({
          topicId: x.topicId,
          name: x.name,
          correct: x.correct,
          total: x.total,
          documents: docs.filter((d) => d.topicId === x.topicId).map((d) => ({ id: d.id, name: d.name, versionDate: d.versionDate })),
          followup: x.followup
            ? { date: x.followup.date, note: x.followup.note, loggedAt: x.followup.loggedAt, updatedAt: x.followup.updatedAt }
            : null,
        })),
      },
      200,
    );
  })

  .put(
    "/flags/:id/followups/:topicId",
    allow("follow_up_owner"),
    body<{ date: string; note: string }>(),
    async (c) => {
      const id = idParam(c.req.param("id"));
      const topicId = idParam(c.req.param("topicId"));
      if (!id || !topicId) return notAvailable(c);
      const me = c.get("me");
      const db = getDb(c.env);
      const f = await visibleFlag(db, me, id);
      // Writing: the current follow-up owner only (admins can read but not log).
      if (!f || f.ownerPersonId !== me.personId) return notAvailable(c);
      const topic = f.topics.find((x) => x.topicId === topicId);
      if (!topic) return notAvailable(c);
      if (await formBSubmitted(db, f.personId)) return conflict(c, "Check 2 was submitted, so the follow-up log is closed.");
      const b = c.req.valid("json");
      const note = str(b.note);
      const t = today(c.env);
      if (!isIsoDate(b.date)) return badRequest(c, "Add the date of the follow-up.");
      if (b.date > t) return badRequest(c, "The date can't be in the future.");
      if (b.date < f.flaggedDate) return badRequest(c, `The date can't be before the flag (${formatDate(f.flaggedDate)}).`);
      if (!note) return badRequest(c, "Add a short note about what was done.");
      if (note.length > 200) return badRequest(c, "Keep the note to 200 characters.");
      const now = Date.now();
      await db
        .insert(followups)
        .values({ flagId: id, topicId, followupDate: b.date, note, loggedBy: me.personId, loggedAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: [followups.flagId, followups.topicId],
          // The original "logged at" time is kept.
          set: { followupDate: b.date, note, loggedBy: me.personId, updatedAt: now },
        });
      const [after] = await loadFlags(db, { id });
      return c.json(
        {
          ok: true,
          allDone: after.allDone,
          formBDueDate: after.allDone ? addWorkingDays(after.lastFollowupDate!, FORM_B_DUE_DAYS) : null,
        },
        200,
      );
    },
  );
