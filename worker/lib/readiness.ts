// A1 readiness checklist (design spec A1 section 1). Also the server-side gate
// for Send Form A (technical plan §3).
import { eq } from "drizzle-orm";
import { pilot } from "../db/schema";
import { aiEnabled, aiSetUp, getPilot, getRoleMap, getVersion, isProduction, type DB } from "./state";
import { NOTICE_VERSION } from "./notice";

export const REQUIRED_ROLES = ["student", "follow_up_owner", "bank_owner", "reviewer"] as const;

export async function readiness(db: DB, env: Env, now = Date.now()) {
  const [p, roles, version] = await Promise.all([getPilot(db), getRoleMap(db), getVersion(db)]);
  const missingRoles = REQUIRED_ROLES.filter((r) => !roles[r]);
  // Production only (PRD rev. 3): one person as both bank owner and reviewer is not
  // ready. A safety net for data created before PUT /roles refused it.
  const rolesOverlap = isProduction(env) && !!roles.bank_owner && roles.bank_owner.personId === roles.reviewer?.personId;
  const items = {
    rolesNamed: missingRoles.length === 0 && !rolesOverlap,
    aiSetUp: aiSetUp(env),
    bankPublished: !!version,
    hrSignoff: p.hrNoticeVersion === NOTICE_VERSION && !!p.hrSignoffDate,
  };
  // AI-off mode: the AI item is shown as "off for this round" and doesn't count.
  const ai = aiEnabled(env);
  const complete = items.rolesNamed && items.bankPublished && items.hrSignoff && (!ai || items.aiSetUp);
  let readySince = p.readySince;
  if (complete && !readySince) {
    readySince = now;
    await db.update(pilot).set({ readySince: now }).where(eq(pilot.id, 1));
  } else if (!complete && readySince) {
    readySince = null;
    await db.update(pilot).set({ readySince: null }).where(eq(pilot.id, 1));
  }
  return { items, complete, aiEnabled: ai, rolesOverlap, readySince, missingRoles, pilot: p, roles, version };
}
