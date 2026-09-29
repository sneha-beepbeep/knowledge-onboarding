// The local demo seed (scripts/seed-slack-demo.mjs) must pass the same checks
// as AI drafts: validateDraft (options, answer, quote length) and grounding.
import { describe, expect, it } from "vitest";
import { validateDraft } from "../worker/ai/validate";
import { findQuote } from "../worker/ai/grounding";
import { MAX_DOC_CHARS, MAX_NAME, MAX_TOPIC_NAME, MAX_TOPICS_PER_DOC } from "../shared/limits";
import {
  DEMO_DOC_NAME,
  DEMO_DOC_TEXT,
  DEMO_DOC_VERSION_DATE,
  DEMO_QUESTIONS,
  DEMO_TOPICS,
} from "../scripts/seed/slack-demo-data";

const doc = { id: 1, name: DEMO_DOC_NAME, versionDate: DEMO_DOC_VERSION_DATE, text: DEMO_DOC_TEXT };

describe("Slack demo seed", () => {
  it("document is stored as A3a would store it, within limits", () => {
    expect(DEMO_DOC_TEXT).toBe(DEMO_DOC_TEXT.replace(/\r\n?/g, "\n").trim());
    expect(DEMO_DOC_TEXT.length).toBeLessThanOrEqual(MAX_DOC_CHARS);
    expect(DEMO_DOC_NAME.length).toBeLessThanOrEqual(MAX_NAME);
    expect(DEMO_TOPICS.length).toBeLessThanOrEqual(MAX_TOPICS_PER_DOC);
    for (const t of DEMO_TOPICS) expect(t.length).toBeLessThanOrEqual(MAX_TOPIC_NAME);
    const words = DEMO_DOC_TEXT.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(1500);
    expect(words).toBeLessThanOrEqual(2500);
  });

  it("has 10 questions per topic, with varied answer positions", () => {
    for (const t of DEMO_TOPICS) {
      const qs = DEMO_QUESTIONS.filter((q) => q.topic === t);
      expect(qs, t).toHaveLength(10);
      expect(new Set(qs.map((q) => q.correct_index)).size, t).toBeGreaterThanOrEqual(3);
    }
    expect(DEMO_QUESTIONS).toHaveLength(50);
    expect(new Set(DEMO_QUESTIONS.map((q) => q.question)).size).toBe(50);
    const flawed = DEMO_QUESTIONS.filter((q) => q.flaw).length;
    expect(flawed).toBeGreaterThanOrEqual(2);
    expect(flawed).toBeLessThanOrEqual(3);
  });

  it.each(DEMO_QUESTIONS.map((q, i) => [i + 1, q] as const))("question %i passes validation and grounding", (_, q) => {
    const v = validateDraft(
      { question: q.question, options: q.options, correct_index: q.correct_index, document_id: 1, quote: q.quote },
      [doc],
    );
    expect(v.ok, v.ok ? "" : v.reason).toBe(true);
    if (!v.ok) return;
    // Word for word: the stored passage is the exact slice of the document.
    expect(v.draft.quote).toBe(q.quote);
    expect(DEMO_DOC_TEXT.includes(q.quote)).toBe(true);
    expect(findQuote(q.quote, [doc])).not.toBeNull();
    expect(v.draft.contextBefore.length + v.draft.contextAfter.length).toBeGreaterThan(0);
  });
});
