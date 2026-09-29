// DraftTopicWorkflow (technical plan §4): drafting runs in the background, so
// "You can leave this page. Drafting continues." is true.
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { and, eq, ne } from "drizzle-orm";
import { documentTopics, documents, draftRuns, questions, topics } from "../db/schema";
import { aiMock, anthropicKey, getDb, type DB } from "../lib/state";
import { effectiveRun } from "../lib/bank";
import { DraftError, callAnthropic, mockDrafts, reasonFromMessage, type DraftRequest } from "./provider";
import { validateDraft, type RawDraft } from "./validate";
import type { SourceDoc } from "./grounding";
import { MAX_TOPIC_CHARS } from "../../shared/limits";

export type DraftParams = { runId: number };

async function loadMaterial(db: DB, topicId: number): Promise<{ topic: string; docs: SourceDoc[]; existing: string[] }> {
  const [t] = await db.select().from(topics).where(eq(topics.id, topicId));
  const docs = await db
    .select({ id: documents.id, name: documents.name, versionDate: documents.versionDate, text: documents.text })
    .from(documentTopics)
    .innerJoin(documents, eq(documents.id, documentTopics.documentId))
    .where(eq(documentTopics.topicId, topicId))
    .orderBy(documents.id);
  const existing = await db
    .select({ text: questions.text })
    .from(questions)
    .where(and(eq(questions.topicId, topicId), ne(questions.status, "discarded")));
  return { topic: t?.name ?? "", docs, existing: existing.map((q) => q.text) };
}

export class DraftTopicWorkflow extends WorkflowEntrypoint<Env, DraftParams> {
  async run(event: WorkflowEvent<DraftParams>, step: WorkflowStep) {
    const { runId } = event.payload;
    const env = this.env;
    const mock = aiMock(env);
    // Step outputs must be serializable; drafts travel as a JSON string.
    let raw: { drafts: RawDraft[]; model: string };

    try {
      const out = await step.do(
        "call model",
        {
          retries: { limit: 3, delay: mock ? "1 second" : "10 seconds", backoff: "exponential" },
          timeout: "6 minutes",
        },
        async () => {
          const db = getDb(env);
          const [run] = await db.select().from(draftRuns).where(eq(draftRuns.id, runId));
          if (!run) throw new NonRetryableError("DRAFT_FAIL:service unavailable");
          const m = await loadMaterial(db, run.topicId);
          const total = m.docs.reduce((n, d) => n + d.text.length, 0);
          if (!m.docs.length || total > MAX_TOPIC_CHARS) throw new NonRetryableError("DRAFT_FAIL:document too long");
          const req: DraftRequest = { topic: m.topic, docs: m.docs, count: run.requested, existing: m.existing };
          try {
            if (mock) return { json: JSON.stringify(mockDrafts(req)), model: "mock" };
            const apiKey = anthropicKey(env);
            if (!apiKey) throw new DraftError("AI set-up problem, contact the pilot team", false);
            const drafts = await callAnthropic(req, { apiKey, model: env.AI_MODEL });
            return { json: JSON.stringify(drafts), model: env.AI_MODEL as string };
          } catch (e) {
            if (e instanceof DraftError && !e.retryable) throw new NonRetryableError(e.message);
            throw e;
          }
        },
      );
      raw = { drafts: JSON.parse(out.json) as RawDraft[], model: out.model };
    } catch (e) {
      await this.fail(step, runId, reasonFromMessage((e as Error)?.message));
      return { status: "failed" };
    }

    try {
      return await step.do("validate and save", async () => {
        const db = getDb(env);
        const [runRow] = await db.select().from(draftRuns).where(eq(draftRuns.id, runId));
        // A run already shown as timed out stays failed; nothing is saved.
        if (!runRow || effectiveRun(runRow).status !== "running") return { status: "stale" };
        const m = await loadMaterial(db, runRow.topicId);
        const now = Date.now();
        const valid = [];
        const discarded = [];
        for (const d of raw.drafts.slice(0, runRow.requested)) {
          const v = validateDraft(d, m.docs);
          if (v.ok) valid.push(v.draft);
          else discarded.push({ reason: v.reason, raw: d });
        }
        const stmts = [
          ...valid.map((q) =>
            db.insert(questions).values({
              topicId: runRow.topicId,
              draftRunId: runId,
              documentId: q.documentId,
              documentName: q.documentName,
              documentVersionDate: q.documentVersionDate,
              quote: q.quote,
              contextBefore: q.contextBefore,
              contextAfter: q.contextAfter,
              text: q.text,
              options: q.options,
              correctIndex: q.correctIndex,
              aiOriginal: { text: q.text, options: q.options, correctIndex: q.correctIndex },
              status: "pending",
              createdAt: now,
              updatedAt: now,
            }),
          ),
          ...discarded.map((x) =>
            db.insert(questions).values({
              topicId: runRow.topicId,
              draftRunId: runId,
              text: typeof x.raw?.question === "string" ? x.raw.question.slice(0, 2000) : "",
              options: Array.isArray(x.raw?.options) ? (x.raw.options as unknown[]).map((o) => String(o).slice(0, 500)) : [],
              correctIndex: typeof x.raw?.correct_index === "number" ? x.raw.correct_index : -1,
              aiOriginal: x.raw ?? null,
              status: "discarded",
              discardReason: x.reason,
              createdAt: now,
              updatedAt: now,
            }),
          ),
          db
            .update(draftRuns)
            .set({
              status: "done",
              createdCount: valid.length,
              discardedCount: discarded.length,
              model: raw.model,
              finishedAt: now,
            })
            .where(eq(draftRuns.id, runId)),
        ];
        await db.batch(stmts as [ (typeof stmts)[number], ...(typeof stmts)[number][] ]);
        return { status: "done", created: valid.length, discarded: discarded.length };
      });
    } catch {
      await this.fail(step, runId, "service unavailable");
      return { status: "failed" };
    }
  }

  private async fail(step: WorkflowStep, runId: number, reason: string) {
    await step.do("record failure", async () => {
      await getDb(this.env)
        .update(draftRuns)
        .set({ status: "failed", errorReason: reason, finishedAt: Date.now() })
        .where(and(eq(draftRuns.id, runId), eq(draftRuns.status, "running")));
      console.error(`draft_run_failed run=${runId} reason=${reason}`);
    });
  }
}
