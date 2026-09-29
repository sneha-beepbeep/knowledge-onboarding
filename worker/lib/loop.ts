// A1 section 2: the pilot loop, one row per stage with a status and a date.
import { and, desc, eq } from "drizzle-orm";
import { attempts, deletionLog } from "../db/schema";
import { dateOf, type DB, type PilotRow, type RoleMap, type VersionRow } from "./state";
import { formBState } from "./flags";
import { latestParticipation } from "./student";
import { NOTICE_VERSION } from "./notice";
import { formatDate, workingDaysBetween } from "../../shared/dates";

export type Tone = "done" | "wait" | "overdue" | "info" | "attention";
export type LoopRow = { stage: string; status: string; tone: Tone; link?: string };

export async function pilotLoop(
  db: DB,
  env: Env,
  t: string,
  p: PilotRow,
  version: VersionRow | null,
  roles: RoleMap,
): Promise<{ rows: LoopRow[]; deleted: { date: string; by: string; name: string } | null }> {
  const student = roles.student;
  const row = (stage: string, status: string, tone: Tone = "wait", link?: string): LoopRow => ({ stage, status, tone, link });
  const rows: LoopRow[] = [];
  rows.push(version ? row("Bank published", formatDate(dateOf(env, version.publishedAt)), "done") : row("Bank published", "Not started"));
  rows.push(p.formASentAt ? row("Form A sent", formatDate(dateOf(env, p.formASentAt)), "done") : row("Form A sent", "Not started"));

  let deleted: { date: string; by: string; name: string } | null = null;
  if (student) {
    const [d] = await db.select().from(deletionLog).where(eq(deletionLog.personId, student.personId)).orderBy(desc(deletionLog.id)).limit(1);
    if (d) deleted = { date: dateOf(env, d.deletedAt), by: d.deletedByName, name: d.personName };
  }

  const part = student ? await latestParticipation(db, student.personId) : null;
  const a =
    student && version
      ? (await db.select().from(attempts).where(and(eq(attempts.personId, student.personId), eq(attempts.form, "A"))))[0]
      : undefined;
  const later = ["Notice", "Form A submitted (day 0)", "Flags", "Follow-up", "Form B available", "Form B submitted", "Comparison"];

  // After F11: the loop rows read "Data deleted [date]".
  if (deleted && !part && !a) {
    for (const s of later) rows.push(row(s, `Data deleted ${formatDate(deleted.date)}`, "info"));
    return { rows, deleted };
  }

  if (!part || part.noticeVersion !== NOTICE_VERSION) rows.push(row("Notice", "Not yet"));
  else if (part.choice === "take_part") rows.push(row("Notice", `Took part ${formatDate(dateOf(env, part.recordedAt))}`, "done"));
  else rows.push(row("Notice", `Declined ${formatDate(dateOf(env, part.recordedAt))}`, "info"));

  if (!a || !version) {
    for (const s of later.slice(1)) rows.push(row(s, "Not started"));
    return { rows, deleted };
  }
  rows.push(
    row("Form A submitted (day 0)", `${formatDate(a.submittedDate)} · overall ${a.overallCorrect} of ${a.overallTotal}`, "done", `/results/${a.id}`),
  );
  const fb = await formBState(db, student!.personId, version.id);
  if (!fb.flag) {
    rows.push(row("Flags", "none", "done"));
    rows.push(row("Follow-up", "Not needed", "done"));
  } else {
    const f = fb.flag;
    rows.push(row("Flags", `${f.topics.length} ${f.topics.length === 1 ? "topic" : "topics"}`, "attention", `/flags/${f.id}`));
    if (f.allDone) rows.push(row("Follow-up", `Done ${formatDate(f.lastFollowupDate!)}`, "done", `/flags/${f.id}`));
    else if (t > f.dueDate) {
      const n = workingDaysBetween(f.dueDate, t);
      rows.push(row("Follow-up", `Due ${formatDate(f.dueDate)} · Overdue by ${n} working ${n === 1 ? "day" : "days"}`, "overdue", `/flags/${f.id}`));
    } else rows.push(row("Follow-up", `Due ${formatDate(f.dueDate)} · On time`, "info", `/flags/${f.id}`));
  }
  const [b] = await db.select().from(attempts).where(and(eq(attempts.personId, student!.personId), eq(attempts.form, "B")));
  if (!fb.available) rows.push(row("Form B available", "Not yet"));
  else if (b) rows.push(row("Form B available", `Was due by ${formatDate(fb.dueDate!)}`, "done"));
  else if (t > fb.dueDate!) rows.push(row("Form B available", `Due by ${formatDate(fb.dueDate!)} · Overdue`, "overdue"));
  else rows.push(row("Form B available", `Due by ${formatDate(fb.dueDate!)}`, "info"));
  rows.push(b ? row("Form B submitted", formatDate(b.submittedDate), "done", `/results/${b.id}`) : row("Form B submitted", "Not started"));
  rows.push(b ? row("Comparison", "See the comparison", "done", `/compare/${student!.personId}`) : row("Comparison", "Not started"));
  return { rows, deleted };
}
