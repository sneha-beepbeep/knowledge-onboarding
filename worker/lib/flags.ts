// Flag and follow-up reads shared by M1, M2, T1, A1 and R1.
import { and, eq, inArray } from "drizzle-orm";
import { attempts, flagTopics, flags, followups, topics } from "../db/schema";
import type { DB } from "./state";
import { addWorkingDays } from "../../shared/dates";

export const FOLLOWUP_SLA_DAYS = 5;
export const FORM_B_DUE_DAYS = 10;

export type FlagDetail = {
  id: number;
  attemptId: number;
  personId: number;
  ownerPersonId: number | null;
  flaggedAt: number;
  flaggedDate: string;
  dueDate: string;
  topics: {
    topicId: number;
    name: string;
    correct: number;
    total: number;
    followup: { date: string; note: string; loggedAt: number; updatedAt: number; loggedBy: number } | null;
  }[];
  allDone: boolean;
  /** Latest follow-up date once every topic is logged. */
  lastFollowupDate: string | null;
};

export async function loadFlags(db: DB, where: { personId?: number; ownerPersonId?: number; id?: number }) {
  const conds = [];
  if (where.personId !== undefined) conds.push(eq(flags.personId, where.personId));
  if (where.ownerPersonId !== undefined) conds.push(eq(flags.ownerPersonId, where.ownerPersonId));
  if (where.id !== undefined) conds.push(eq(flags.id, where.id));
  const rows = await db
    .select()
    .from(flags)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(flags.id);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const ft = await db
    .select({ flagId: flagTopics.flagId, topicId: flagTopics.topicId, correct: flagTopics.correct, total: flagTopics.total, name: topics.name })
    .from(flagTopics)
    .innerJoin(topics, eq(topics.id, flagTopics.topicId))
    .where(inArray(flagTopics.flagId, ids))
    .orderBy(topics.name);
  const fu = await db.select().from(followups).where(inArray(followups.flagId, ids));
  return rows.map((f): FlagDetail => {
    const ts = ft
      .filter((t) => t.flagId === f.id)
      .map((t) => {
        const log = fu.find((x) => x.flagId === f.id && x.topicId === t.topicId);
        return {
          topicId: t.topicId,
          name: t.name,
          correct: t.correct,
          total: t.total,
          followup: log
            ? { date: log.followupDate, note: log.note, loggedAt: log.loggedAt, updatedAt: log.updatedAt, loggedBy: log.loggedBy }
            : null,
        };
      });
    const allDone = ts.length > 0 && ts.every((t) => t.followup);
    const lastFollowupDate = allDone ? ts.map((t) => t.followup!.date).sort().at(-1)! : null;
    return { ...f, topics: ts, allDone, lastFollowupDate };
  });
}

/** Badge count for "Flags (N)": open flags owned by this person, for the current student only. */
export async function openFlagCount(db: DB, ownerPersonId: number, studentId: number | undefined) {
  if (studentId === undefined) return 0;
  const list = await loadFlags(db, { ownerPersonId, personId: studentId });
  return list.filter((f) => !f.allDone).length;
}

/**
 * Form B availability for a person (decision 10 and E7): available once every weak topic
 * is logged, or straight away when Form A created no flag. Due 10 working days later.
 */
export async function formBState(db: DB, personId: number, versionId: number) {
  const [a] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.personId, personId), eq(attempts.versionId, versionId), eq(attempts.form, "A")));
  if (!a) return { formA: null, flag: null, available: false, dueDate: null as string | null };
  const [flag] = await loadFlags(db, { personId }).then((l) => l.filter((f) => f.attemptId === a.id));
  if (!flag) return { formA: a, flag: null, available: true, dueDate: addWorkingDays(a.submittedDate, FORM_B_DUE_DAYS) };
  if (!flag.allDone) return { formA: a, flag, available: false, dueDate: null };
  return { formA: a, flag, available: true, dueDate: addWorkingDays(flag.lastFollowupDate!, FORM_B_DUE_DAYS) };
}
