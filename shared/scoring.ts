// Threshold maths shared by the Worker (scoring) and the browser (A4 explanation).
// Integer maths only: a topic is below the threshold when correct/total < threshold%.

export const MIN_PER_FORM = 3;
export const MAX_PER_FORM = 5;
export const DEFAULT_PER_FORM = 4;
export const DEFAULT_THRESHOLD = 70;

export function isBelowThreshold(correct: number, total: number, thresholdPct: number): boolean {
  return correct * 100 < thresholdPct * total;
}

/** Smallest number of wrong answers (out of `total`) that flags a topic, or null if none does. */
export function wrongToFlag(total: number, thresholdPct: number): number | null {
  for (let wrong = 0; wrong <= total; wrong++) {
    if (isBelowThreshold(total - wrong, total, thresholdPct)) return wrong;
  }
  return null;
}

/** A4 explanation, e.g. "With 4 questions per topic: flagged if 2 or more are wrong (below 70%)." */
export function thresholdExplanation(perForm: number, thresholdPct: number): string {
  const w = wrongToFlag(perForm, thresholdPct);
  const head = `With ${perForm} questions per topic:`;
  if (w === null) return `${head} never flagged (threshold ${thresholdPct}%).`;
  if (w === 0) return `${head} always flagged (below ${thresholdPct}%).`;
  const verb = w === 1 ? "1 or more is wrong" : `${w} or more are wrong`;
  return `${head} flagged if ${verb} (below ${thresholdPct}%).`;
}

export function pct(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct * 100) / total);
}
