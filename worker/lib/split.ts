// Form split and balance rules (A4, F4). Pure functions, unit-tested.
import { MIN_PER_FORM } from "../../shared/scoring";

export type Split = { A: number[]; B: number[]; unused: number[] };

/** Default split: min(setting, floor(approved / 2)) per form; extras are "Not used". */
export function defaultSplit(approvedIds: number[], perTopicSetting: number): Split {
  const perForm = Math.min(perTopicSetting, Math.floor(approvedIds.length / 2));
  return {
    A: approvedIds.slice(0, perForm),
    B: approvedIds.slice(perForm, 2 * perForm),
    unused: approvedIds.slice(2 * perForm),
  };
}

export type TopicAssignment = { topicId: number; A: number[]; B: number[] };

/** Returns the first problem with a proposed publish, or null if it is valid. */
export function checkAssignment(
  topics: TopicAssignment[],
  approvedByTopic: Map<number, Set<number>>,
  perTopicSetting: number,
  names: Map<number, string>,
): string | null {
  if (!topics.length) return "Include at least one topic.";
  const seenTopics = new Set<number>();
  const seenQ = new Set<number>();
  for (const t of topics) {
    const name = names.get(t.topicId) ?? "A topic";
    if (seenTopics.has(t.topicId)) return `${name} is listed twice.`;
    seenTopics.add(t.topicId);
    const approved = approvedByTopic.get(t.topicId);
    if (!approved) return `${name} has no approved questions.`;
    if (!Array.isArray(t.A) || !Array.isArray(t.B)) return `${name}: the forms are incomplete.`;
    if (t.A.length !== t.B.length) return `${name}: Form A and Form B need the same number of questions.`;
    if (t.A.length < MIN_PER_FORM)
      return `${name}: ${approved.size} approved. Needs at least ${2 * MIN_PER_FORM} (${MIN_PER_FORM} per form).`;
    if (t.A.length > perTopicSetting) return `${name}: at most ${perTopicSetting} questions per form.`;
    for (const q of [...t.A, ...t.B]) {
      if (!approved.has(q)) return `${name}: only approved questions of this topic can be used.`;
      if (seenQ.has(q)) return `${name}: a question can be in one form only.`;
      seenQ.add(q);
    }
  }
  return null;
}
