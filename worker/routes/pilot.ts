// A1 Pilot overview, HR sign-off (CPO only). Form A sending is added in step 9,
// the loop/key dates/M3 in step 11.
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { ADMIN, allow, isCpo } from "../auth";
import { body, badRequest, str } from "../lib/http";
import { dateOf, getDb, getPilot, today } from "../lib/state";
import { readiness } from "../lib/readiness";
import { NOTICE_VERSION } from "../lib/notice";
import { pilot } from "../db/schema";
import { isIsoDate } from "../../shared/dates";

export const pilotRoutes = new Hono<AppEnv>()
  .get("/pilot", allow(...ADMIN), async (c) => {
    const db = getDb(c.env);
    const r = await readiness(db, c.env);
    return c.json(
      {
        isCpo: isCpo(c.get("me")),
        readiness: {
          items: r.items,
          complete: r.complete,
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
        today: today(c.env),
      },
      200,
    );
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
