// A1 Pilot overview, HR sign-off (CPO only). Form A sending is added in step 9,
// the loop/key dates/M3 in step 11.
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { ADMIN, allow, isCpo, issueLink, linkUrl } from "../auth";
import { body, badRequest, conflict, str } from "../lib/http";
import { dateOf, getDb, getPilot, today } from "../lib/state";
import { readiness } from "../lib/readiness";
import { NOTICE_VERSION } from "../lib/notice";
import { pilot } from "../db/schema";
import { isIsoDate } from "../../shared/dates";
import { pilotLoop } from "../lib/loop";
import { m3Figures } from "../lib/m3";
import { keyDates } from "./data";

export const pilotRoutes = new Hono<AppEnv>()
  .get("/pilot", allow(...ADMIN), async (c) => {
    const db = getDb(c.env);
    const r = await readiness(db, c.env);
    const t = today(c.env);
    const [loop, m3] = await Promise.all([pilotLoop(db, c.env, t, r.pilot, r.version, r.roles), m3Figures(db)]);
    return c.json(
      {
        isCpo: isCpo(c.get("me")),
        readiness: {
          items: r.items,
          complete: r.complete,
          aiEnabled: r.aiEnabled,
          rolesOverlap: r.rolesOverlap,
          readySince: r.readySince ? dateOf(c.env, r.readySince) : null,
          missingRoles: r.missingRoles,
        },
        hr: {
          date: r.pilot.hrSignoffDate,
          by: r.pilot.hrSignoffBy,
          noticeVersion: r.pilot.hrNoticeVersion,
          currentNoticeVersion: NOTICE_VERSION,
        },
        student: r.roles.student ? { id: r.roles.student.personId, name: r.roles.student.name } : null,
        formASent: r.pilot.formASentAt ? dateOf(c.env, r.pilot.formASentAt) : null,
        today: t,
        loop: loop.rows,
        deletion: loop.deleted,
        keyDates: await keyDates(db, r.roles.student?.personId),
        m3: m3.total,
        // K3 kill signal: informational only, blocks nothing. It judges AI drafts,
        // so it is never raised in AI-off mode.
        k3: r.aiEnabled && m3.total.rewriteRatePct !== null && m3.total.rewriteRatePct > 50,
      },
      200,
    );
  })

  // A5: creates the student's sign-in link, which is the Form A link. Replaces any earlier link.
  .post("/pilot/form-a/link", allow(...ADMIN), async (c) => {
    const db = getDb(c.env);
    const r = await readiness(db, c.env);
    if (!r.complete || !r.roles.student) return conflict(c, "Complete the readiness checklist to send Form A.");
    const token = await issueLink(db, r.roles.student.personId);
    return c.json({ url: linkUrl(c, token), studentName: r.roles.student.name, alreadySent: !!r.pilot.formASentAt }, 200);
  })

  .post("/pilot/form-a/sent", allow(...ADMIN), async (c) => {
    const db = getDb(c.env);
    const r = await readiness(db, c.env);
    if (!r.complete) return conflict(c, "Complete the readiness checklist to send Form A.");
    if (!r.pilot.formASentAt)
      await db.update(pilot).set({ formASentAt: Date.now(), formASentBy: c.get("me").personId }).where(eq(pilot.id, 1));
    return c.json({ ok: true }, 200);
  })

  // HR sign-off is a record only; the approval happens outside the app (design spec Flow 0).
  .post("/pilot/hr-signoff", allow("cpo"), body<{ date: string; by: string }>(), async (c) => {
    const b = c.req.valid("json");
    const by = str(b.by);
    if (!isIsoDate(b.date)) return badRequest(c, "Add the date of the sign-off.");
    if (b.date > today(c.env)) return badRequest(c, "The sign-off date can't be in the future.");
    if (!by) return badRequest(c, "Add who signed off.");
    if (by.length > 120) return badRequest(c, "The name is too long.");
    const db = getDb(c.env);
    await getPilot(db);
    await db
      .update(pilot)
      .set({ hrSignoffDate: b.date, hrSignoffBy: by, hrNoticeVersion: NOTICE_VERSION, hrRecordedAt: Date.now() })
      .where(eq(pilot.id, 1));
    return c.json({ ok: true }, 200);
  });
