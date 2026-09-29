// Student participation helpers (T1, T2, T3 gates).
import { desc, eq } from "drizzle-orm";
import { participation } from "../db/schema";
import { getPilot, type DB } from "./state";
import { NOTICE_VERSION } from "./notice";

export async function latestParticipation(db: DB, personId: number) {
  const [row] = await db
    .select()
    .from(participation)
    .where(eq(participation.personId, personId))
    .orderBy(desc(participation.id))
    .limit(1);
  return row ?? null;
}

/** The latest choice counts only if it was made on the current notice version. */
export async function currentChoice(db: DB, personId: number) {
  const p = await latestParticipation(db, personId);
  if (!p || p.noticeVersion !== NOTICE_VERSION) return null;
  return p;
}

export async function studentNeedsNotice(db: DB, personId: number): Promise<boolean> {
  const pilotRow = await getPilot(db);
  if (!pilotRow.formASentAt) return false;
  return (await currentChoice(db, personId)) === null;
}
