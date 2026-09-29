// Published form contents and the student's form gate (T3, F4, F5).
import { and, asc, eq } from "drizzle-orm";
import { attempts, formQuestions, questions, topics } from "../db/schema";
import { getPilot, getRoleMap, getVersion, type DB, type VersionRow } from "./state";
import { currentChoice } from "./student";
import { formBState } from "./flags";
import { NOTICE_VERSION } from "./notice";

export type Form = "A" | "B";

export async function formQuestionsFor(db: DB, versionId: number, form: Form) {
  return db
    .select({
      id: questions.id,
      text: questions.text,
      options: questions.options,
      correctIndex: questions.correctIndex,
      topicId: formQuestions.topicId,
      topicName: topics.name,
      documentName: questions.documentName,
      position: formQuestions.position,
    })
    .from(formQuestions)
    .innerJoin(questions, eq(questions.id, formQuestions.questionId))
    .innerJoin(topics, eq(topics.id, formQuestions.topicId))
    .where(and(eq(formQuestions.versionId, versionId), eq(formQuestions.form, form)))
    .orderBy(asc(topics.name), asc(formQuestions.position));
}

export async function attemptFor(db: DB, personId: number, versionId: number, form: Form) {
  const [a] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.personId, personId), eq(attempts.versionId, versionId), eq(attempts.form, form)));
  return a ?? null;
}

export type Gate =
  | { ok: true; version: VersionRow }
  | { ok: false; code: "not_available" | "already_submitted" | "notice"; attemptId?: number; managerName?: string | null };

/**
 * A form is reachable only if: the version is published, Form A was sent, HR
 * sign-off matches the current notice version, the student chose Take part on
 * the current notice, and the form is open (B after follow-up) and not yet submitted.
 */
export async function formGate(db: DB, personId: number, form: Form): Promise<Gate> {
  const [version, p, roles] = await Promise.all([getVersion(db), getPilot(db), getRoleMap(db)]);
  const managerName = roles.follow_up_owner?.name ?? null;
  if (!version || !p.formASentAt || p.hrNoticeVersion !== NOTICE_VERSION) return { ok: false, code: "not_available", managerName };
  const choice = await currentChoice(db, personId);
  if (choice?.choice !== "take_part") return { ok: false, code: "notice", managerName };
  const done = await attemptFor(db, personId, version.id, form);
  if (done) return { ok: false, code: "already_submitted", attemptId: done.id, managerName };
  if (form === "B") {
    const b = await formBState(db, personId, version.id);
    if (!b.available) return { ok: false, code: "not_available", managerName };
  }
  return { ok: true, version };
}
