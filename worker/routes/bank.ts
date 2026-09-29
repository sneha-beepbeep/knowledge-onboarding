// A3 Bank: material & topics, A3a Add document (F1). Drafting is in drafts.ts.
import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import type { AppEnv } from "../types";
import { ADMIN, allow, has, isAdmin } from "../auth";
import { body, badRequest, frozen, idParam, notAvailable, str } from "../lib/http";
import { AI_PROVIDER_NAME, aiSetUp, dateOf, getDb, getPilot, getRoleMap, getVersion } from "../lib/state";
import { allTopics, latestRun, questionCounts, topicDocuments } from "../lib/bank";
import { documentTopics, documents, DOCUMENT_SOURCES, flagTopics, flags, pilot } from "../db/schema";
import { isIsoDate } from "../../shared/dates";
import { MAX_DOC_CHARS, MAX_NAME, MAX_TOPIC_NAME, MAX_TOPICS_PER_DOC } from "../../shared/limits";
import { MIN_PER_FORM, MAX_PER_FORM } from "../../shared/scoring";

export const bankRoutes = new Hono<AppEnv>()
  .get("/bank", allow(...ADMIN), async (c) => {
    const db = getDb(c.env);
    const [p, version, topicRows, docs, counts] = await Promise.all([
      getPilot(db),
      getVersion(db),
      allTopics(db),
      topicDocuments(db),
      questionCounts(db),
    ]);
    const cards = [];
    for (const t of topicRows) {
      const tDocs = docs.filter((d) => d.topicId === t.id);
      // A topic with no documents has no card; its drafts stay in review (A3).
      if (!tDocs.length) continue;
      const cnt = counts.get(t.id) ?? { approved: 0, rejected: 0, pending: 0, discarded: 0, total: 0 };
      cards.push({
        id: t.id,
        name: t.name,
        documents: tDocs.map((d) => ({ id: d.id, name: d.name, versionDate: d.versionDate, charCount: d.charCount })),
        run: await latestRun(db, t.id),
        counts: cnt,
      });
    }
    return c.json(
      {
        published: version ? { date: dateOf(c.env, version.publishedAt) } : null,
        perTopicCount: p.perTopicCount,
        aiSetUp: aiSetUp(c.env),
        consentGiven: !!p.draftingConsentAt,
        providerName: AI_PROVIDER_NAME,
        topics: cards,
        topicNames: topicRows.map((t) => t.name),
        documentCount: new Set(docs.map((d) => d.id)).size,
      },
      200,
    );
  })

  .put("/bank/settings", allow(...ADMIN), body<{ perTopicCount: number }>(), async (c) => {
    const n = c.req.valid("json").perTopicCount;
    if (!Number.isInteger(n) || n < MIN_PER_FORM || n > MAX_PER_FORM)
      return badRequest(c, `Choose between ${MIN_PER_FORM} and ${MAX_PER_FORM}.`);
    const db = getDb(c.env);
    if (await getVersion(db)) return frozen(c);
    await getPilot(db);
    await db.update(pilot).set({ perTopicCount: n }).where(eq(pilot.id, 1));
    return c.json({ ok: true }, 200);
  })

  // First-drafting consent (once per bank, A3).
  .post("/bank/consent", allow(...ADMIN), async (c) => {
    const db = getDb(c.env);
    if (await getVersion(db)) return frozen(c);
    const p = await getPilot(db);
    if (!p.draftingConsentAt)
      await db.update(pilot).set({ draftingConsentAt: Date.now(), draftingConsentBy: c.get("me").personId }).where(eq(pilot.id, 1));
    return c.json({ ok: true }, 200);
  })

  .post(
    "/documents",
    allow(...ADMIN),
    body<{ name: string; versionDate: string; topics: string[]; text: string; source: "pdf" | "txt" | "paste" }>(),
    async (c) => {
      const b = c.req.valid("json");
      const name = str(b.name);
      const text = typeof b.text === "string" ? b.text.replace(/\r\n?/g, "\n").trim() : "";
      if (!name) return badRequest(c, "Add a name.");
      if (name.length > MAX_NAME) return badRequest(c, "The name is too long.");
      if (!isIsoDate(b.versionDate)) return badRequest(c, "Add the material's version date.");
      const topicNames = Array.isArray(b.topics)
        ? [...new Set(b.topics.map(str).filter(Boolean))]
        : [];
      if (!topicNames.length) return badRequest(c, "Add at least one topic.");
      if (topicNames.length > MAX_TOPICS_PER_DOC || topicNames.some((t) => t.length > MAX_TOPIC_NAME))
        return badRequest(c, "Topic names must be short, and a document can have up to 20 topics.");
      if (!DOCUMENT_SOURCES.includes(b.source)) return badRequest(c, "Only PDF and plain-text files can be added.");
      if (!text) return badRequest(c, "There's no text to add.");
      if (text.length > MAX_DOC_CHARS)
        return c.json({ error: "This document is too long to use in one piece. Split it into smaller documents by topic.", code: "too_long" }, 413);

      const db = getDb(c.env);
      if (await getVersion(db)) return frozen(c);

      // Reuse existing topics case-insensitively.
      const existing = await allTopics(db);
      const resolved = topicNames.map((t) => existing.find((e) => e.name.toLowerCase() === t.toLowerCase())?.name ?? t);

      // One transaction: document, new topics and tags, or nothing ("Upload failed. Nothing was saved.").
      const now = Date.now();
      const D = c.env.DB;
      await D.batch([
        D.prepare(
          "INSERT INTO documents (name, version_date, text, char_count, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).bind(name, b.versionDate, text, text.length, b.source, now),
        ...resolved.map((t) => D.prepare("INSERT INTO topics (name) VALUES (?) ON CONFLICT DO NOTHING").bind(t)),
        ...resolved.map((t) =>
          D.prepare(
            "INSERT INTO document_topics (document_id, topic_id) SELECT (SELECT max(id) FROM documents), id FROM topics WHERE name = ?",
          ).bind(t),
        ),
      ]);
      return c.json({ ok: true }, 201);
    },
  )

  // Hard delete. Drafts keep their stored passage (document_id becomes null).
  .delete("/documents/:id", allow(...ADMIN), async (c) => {
    const id = idParam(c.req.param("id"));
    if (!id) return notAvailable(c);
    const db = getDb(c.env);
    if (await getVersion(db)) return frozen(c);
    const deleted = await db.delete(documents).where(eq(documents.id, id)).returning({ id: documents.id });
    if (!deleted.length) return notAvailable(c);
    return c.json({ ok: true }, 200);
  })

  // V2/M2 source view. FUO only for documents of their student's weak topics.
  .get("/documents/:id", async (c) => {
    const me = c.get("me");
    const id = idParam(c.req.param("id"));
    if (!id) return notAvailable(c);
    const db = getDb(c.env);
    let allowed = isAdmin(me) || has(me, "reviewer");
    if (!allowed && has(me, "follow_up_owner")) {
      const roles = await getRoleMap(db);
      const studentId = roles.student?.personId;
      if (studentId !== undefined) {
        const rows = await db
          .select({ topicId: flagTopics.topicId })
          .from(flagTopics)
          .innerJoin(flags, eq(flags.id, flagTopics.flagId))
          .where(and(eq(flags.ownerPersonId, me.personId), eq(flags.personId, studentId)));
        const weak = rows.map((r) => r.topicId);
        if (weak.length) {
          const tagged = await db
            .select()
            .from(documentTopics)
            .where(and(eq(documentTopics.documentId, id), inArray(documentTopics.topicId, weak)));
          allowed = tagged.length > 0;
        }
      }
    }
    if (!allowed) return notAvailable(c);
    const [d] = await db.select().from(documents).where(eq(documents.id, id));
    if (!d) return notAvailable(c);
    return c.json({ id: d.id, name: d.name, versionDate: d.versionDate, text: d.text }, 200);
  });
