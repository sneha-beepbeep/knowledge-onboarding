// A2 People & roles (F12). Admins manage roles and issue links; assigning the
// CPO role and issuing links for admins is CPO only (decision 8).
import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import type { AppEnv } from "../types";
import { ADMIN, allow, isCpo, issueLink, linkUrl } from "../auth";
import { body, badRequest, idParam, notAvailable, str } from "../lib/http";
import { aiEnabled, getDb, getRoleMap, ROLE_LABELS, type RoleMap } from "../lib/state";
import { flags, people, roleAssignments, ROLES, type Role } from "../db/schema";

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  student: "Takes the first check and the retake, and attends the debrief.",
  follow_up_owner: "Receives the low-score flag, delivers the follow-up, logs it, and tags the student's errors by cause.",
  bank_owner: "Uploads material, runs AI drafting, publishes the pilot's single version, and logs effort.",
  reviewer: "Approves, edits or rejects every draft question before use.",
  cpo: "HR clearance, the 90-day review, and the go/kill/checkpoint call.",
};

/** AI-off mode (round 1): the bank owner writes the questions; nothing is drafted by AI. */
const BANK_OWNER_AI_OFF = "Uploads material, writes the questions for the pilot team to load, publishes the pilot's single version, and logs effort.";

export const roleDescription = (role: Role, ai: boolean) =>
  role === "bank_owner" && !ai ? BANK_OWNER_AI_OFF : ROLE_DESCRIPTIONS[role];

const OVERLAP_NOTE = "The student notice will list this person once, under their other role.";

export function roleWarnings(roles: RoleMap): string[] {
  const rev = roles.reviewer?.personId;
  if (rev === undefined) return [];
  const w: string[] = [];
  if (roles.follow_up_owner?.personId === rev)
    w.push(
      `The PRD recommends a reviewer who isn't the manager. This person will see the student's named results as their manager. ${OVERLAP_NOTE}`,
    );
  if (roles.bank_owner?.personId === rev || roles.cpo?.personId === rev)
    w.push(`This person will see named results through their admin access. ${OVERLAP_NOTE}`);
  return w;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const peopleRoutes = new Hono<AppEnv>()
  .get("/roles", allow(...ADMIN), async (c) => {
    const db = getDb(c.env);
    const roles = await getRoleMap(db);
    const everyone = await db.select().from(people).orderBy(people.name);
    const holderIds = new Set(Object.values(roles).map((r) => r!.personId));
    const studentFlags = roles.student
      ? await db.select({ id: flags.id }).from(flags).where(eq(flags.personId, roles.student.personId))
      : [];
    return c.json(
      {
        isCpo: isCpo(c.get("me")),
        roles: ROLES.map((role) => ({
          role,
          label: ROLE_LABELS[role],
          description: roleDescription(role, aiEnabled(c.env)),
          person: roles[role] ?? null,
        })),
        people: everyone
          .filter((p) => holderIds.has(p.id))
          .map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            roles: ROLES.filter((r) => roles[r]?.personId === p.id),
          })),
        allPeople: everyone.map((p) => ({ id: p.id, name: p.name })),
        warnings: roleWarnings(roles),
        studentHasFlag: studentFlags.length > 0,
      },
      200,
    );
  })

  .put(
    "/roles/:role",
    allow(...ADMIN),
    body<{ personId?: number; name?: string; email?: string }>(),
    async (c) => {
      const role = c.req.param("role") as Role;
      if (!ROLES.includes(role)) return notAvailable(c);
      const me = c.get("me");
      if (role === "cpo" && !isCpo(me)) return notAvailable(c);
      const b = c.req.valid("json");
      const db = getDb(c.env);
      const now = Date.now();

      let personId: number | null = null;
      if (typeof b.personId === "number" && Number.isInteger(b.personId)) {
        const [p] = await db.select().from(people).where(eq(people.id, b.personId));
        if (!p) return badRequest(c, "Choose a person.");
        personId = p.id;
      } else {
        const name = str(b.name);
        const email = str(b.email);
        if (!name) return badRequest(c, "Add the person's name.");
        if (name.length > 120) return badRequest(c, "The name is too long.");
        if (email && (!EMAIL_RE.test(email) || email.length > 200)) return badRequest(c, "Check the email address.");
        const [p] = await db.insert(people).values({ name, email: email || null, createdAt: now }).returning();
        personId = p.id;
      }

      const before = await getRoleMap(db);
      if (before[role]?.personId === personId) return c.json({ ok: true }, 200);

      const upsert = db
        .insert(roleAssignments)
        .values({ role, personId, assignedAt: now })
        .onConflictDoUpdate({ target: roleAssignments.role, set: { personId, assignedAt: now } });
      // A2/E12: a new follow-up owner takes over the student's flags; the old owner loses access.
      if (role === "follow_up_owner" && before.student) {
        await db.batch([
          upsert,
          db.update(flags).set({ ownerPersonId: personId }).where(eq(flags.personId, before.student.personId)),
        ]);
      } else {
        await upsert;
      }
      return c.json({ ok: true }, 200);
    },
  )

  // Issues a new sign-in link (revoking the old one). Links for admins are CPO only.
  .post("/people/:id/link", allow(...ADMIN), async (c) => {
    const id = idParam(c.req.param("id"));
    if (!id) return notAvailable(c);
    const db = getDb(c.env);
    const [p] = await db.select().from(people).where(eq(people.id, id));
    if (!p) return notAvailable(c);
    const adminRoles = await db
      .select()
      .from(roleAssignments)
      .where(and(eq(roleAssignments.personId, id), inArray(roleAssignments.role, ["bank_owner", "cpo"])));
    if (adminRoles.length && !isCpo(c.get("me"))) return notAvailable(c);
    const token = await issueLink(db, id);
    return c.json({ url: linkUrl(c, token), name: p.name }, 200);
  });
