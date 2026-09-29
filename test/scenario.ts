// Seeds a full pilot state directly in D1 (no routes): two topics, published
// version 1, Form A submitted with one weak topic, one open flag.
import {
  answers, attemptTopicScores, attempts, documentTopics, documents, flagTopics, flags, formQuestions,
  participation, pilot, questions, topics, versions,
} from "../worker/db/schema";
import { NOTICE_VERSION } from "../worker/lib/notice";
import { db, type World } from "./helpers";

export async function seedLoop(w: World, opts: { submitA?: boolean } = {}) {
  const d = db();
  const now = Date.now();
  const [t1] = await d.insert(topics).values({ name: "Returns process" }).returning();
  const [t2] = await d.insert(topics).values({ name: "Ticket tool" }).returning();
  const [doc1] = await d
    .insert(documents)
    .values({ name: "Returns guide", versionDate: "2026-09-01", text: "Returns text.", charCount: 13, source: "paste", createdAt: now })
    .returning();
  const [doc2] = await d
    .insert(documents)
    .values({ name: "Tool guide", versionDate: "2026-09-01", text: "Tool text.", charCount: 10, source: "paste", createdAt: now })
    .returning();
  await d.insert(documentTopics).values([
    { documentId: doc1.id, topicId: t1.id },
    { documentId: doc2.id, topicId: t2.id },
  ]);
  const qIds: Record<number, number[]> = { [t1.id]: [], [t2.id]: [] };
  for (const t of [t1, t2]) {
    for (let i = 0; i < 8; i++) {
      const [q] = await d
        .insert(questions)
        .values({
          topicId: t.id,
          documentId: t.id === t1.id ? doc1.id : doc2.id,
          documentName: t.id === t1.id ? doc1.name : doc2.name,
          documentVersionDate: "2026-09-01",
          quote: "quoted passage",
          text: `${t.name} question ${i + 1}?`,
          options: ["Alpha", "Bravo", "Charlie", "Delta"],
          correctIndex: 1,
          status: "approved",
          reviewedBy: w.ids.reviewer,
          reviewedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      qIds[t.id].push(q.id);
    }
  }
  const [v] = await d
    .insert(versions)
    .values({ number: 1, publishedAt: now, publishedBy: w.ids.bank, thresholdPct: 70, perTopicCount: 4 })
    .returning();
  for (const t of [t1, t2]) {
    const ids = qIds[t.id];
    await d.insert(formQuestions).values([
      ...ids.slice(0, 4).map((qid, i) => ({ versionId: v.id, form: "A" as const, topicId: t.id, questionId: qid, position: i })),
      ...ids.slice(4, 8).map((qid, i) => ({ versionId: v.id, form: "B" as const, topicId: t.id, questionId: qid, position: i })),
    ]);
  }
  const pilotRow = {
    hrSignoffDate: "2026-09-20",
    hrSignoffBy: "HR Contact",
    hrNoticeVersion: NOTICE_VERSION,
    hrRecordedAt: now,
    formASentAt: now,
    formASentBy: w.ids.bank,
  };
  await d.insert(pilot).values({ id: 1, ...pilotRow }).onConflictDoUpdate({ target: pilot.id, set: pilotRow });
  await d.insert(participation).values({ personId: w.ids.student, noticeVersion: NOTICE_VERSION, choice: "take_part", recordedAt: now });

  let attemptId = 0;
  let flagId = 0;
  if (opts.submitA !== false) {
    const [a] = await d
      .insert(attempts)
      .values({ personId: w.ids.student, versionId: v.id, form: "A", submittedAt: now, submittedDate: "2026-10-01", overallCorrect: 5, overallTotal: 8 })
      .returning();
    attemptId = a.id;
    await d.insert(attemptTopicScores).values([
      { attemptId: a.id, topicId: t1.id, correct: 1, total: 4, belowThreshold: true },
      { attemptId: a.id, topicId: t2.id, correct: 4, total: 4, belowThreshold: false },
    ]);
    const aQs = [...qIds[t1.id].slice(0, 4), ...qIds[t2.id].slice(0, 4)];
    await d.insert(answers).values(
      aQs.map((qid, i) => {
        const topicId = i < 4 ? t1.id : t2.id;
        const chosen = i < 4 ? (i === 0 ? 1 : 0) : 1;
        return { attemptId: a.id, questionId: qid, topicId, chosenIndex: chosen, correctIndex: 1, isCorrect: chosen === 1 };
      }),
    );
    const [f] = await d
      .insert(flags)
      .values({ attemptId: a.id, personId: w.ids.student, ownerPersonId: w.ids.fuo, flaggedAt: now, flaggedDate: "2026-10-01", dueDate: "2026-10-08" })
      .returning();
    flagId = f.id;
    await d.insert(flagTopics).values({ flagId: f.id, topicId: t1.id, correct: 1, total: 4 });
  }

  return {
    topicIds: [t1.id, t2.id],
    weakTopicId: t1.id,
    weakDocId: doc1.id,
    solidOnlyDocId: doc2.id,
    questionId: qIds[t1.id][0],
    versionId: v.id,
    attemptId,
    flagId,
    studentId: w.ids.student,
  };
}
