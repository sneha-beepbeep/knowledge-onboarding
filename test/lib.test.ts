import { describe, expect, it } from "vitest";
import { addWorkingDays, workingDaysBetween, formatDate, isIsoDate, dateInTz, addDays } from "../shared/dates";
import { isBelowThreshold, thresholdExplanation, wrongToFlag } from "../shared/scoring";
import { checkAssignment, defaultSplit } from "../worker/lib/split";

describe("working days (Mon-Fri, no holidays)", () => {
  it("adds working days across weekends", () => {
    expect(addWorkingDays("2026-10-01", 5)).toBe("2026-10-08"); // Thu -> Thu
    expect(addWorkingDays("2026-10-02", 1)).toBe("2026-10-05"); // Fri -> Mon
    expect(addWorkingDays("2026-10-03", 5)).toBe("2026-10-09"); // Sat -> Fri
    expect(addWorkingDays("2026-10-05", 10)).toBe("2026-10-19");
  });
  it("counts working days between dates, signed", () => {
    expect(workingDaysBetween("2026-10-01", "2026-10-08")).toBe(5);
    expect(workingDaysBetween("2026-10-02", "2026-10-05")).toBe(1);
    expect(workingDaysBetween("2026-10-03", "2026-10-04")).toBe(0);
    expect(workingDaysBetween("2026-10-08", "2026-10-01")).toBe(-5);
    expect(workingDaysBetween("2026-10-01", "2026-10-01")).toBe(0);
  });
  it("formats dates as 'Tue 6 Oct'", () => {
    expect(formatDate("2026-10-06")).toBe("Tue 6 Oct");
  });
  it("validates ISO dates and converts to a timezone", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(dateInTz(Date.UTC(2026, 9, 1, 23, 30), "Europe/Berlin")).toBe("2026-10-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("threshold (integer maths)", () => {
  it("2 of 4 is flagged at 70%, 3 of 4 is not", () => {
    expect(isBelowThreshold(2, 4, 70)).toBe(true);
    expect(isBelowThreshold(3, 4, 70)).toBe(false);
    expect(isBelowThreshold(7, 10, 70)).toBe(false);
    expect(isBelowThreshold(2, 3, 70)).toBe(true);
  });
  it("explains the threshold as a question count", () => {
    expect(thresholdExplanation(4, 70)).toBe("With 4 questions per topic: flagged if 2 or more are wrong (below 70%).");
    expect(thresholdExplanation(3, 70)).toBe("With 3 questions per topic: flagged if 1 or more is wrong (below 70%).");
    expect(thresholdExplanation(5, 70)).toBe("With 5 questions per topic: flagged if 2 or more are wrong (below 70%).");
    expect(wrongToFlag(4, 100)).toBe(1);
  });
});

describe("form split", () => {
  it("splits min(setting, floor(approved/2)) per form, rest unused", () => {
    expect(defaultSplit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4)).toEqual({ A: [1, 2, 3, 4], B: [5, 6, 7, 8], unused: [9, 10] });
    expect(defaultSplit([1, 2, 3, 4, 5, 6, 7], 4)).toEqual({ A: [1, 2, 3], B: [4, 5, 6], unused: [7] });
  });
  it("enforces balance, minimum 3, maximum setting, approved only, no duplicates", () => {
    const approved = new Map([[1, new Set([1, 2, 3, 4, 5, 6, 7, 8])]]);
    const names = new Map([[1, "Returns"]]);
    expect(checkAssignment([], approved, 4, names)).toBe("Include at least one topic.");
    expect(checkAssignment([{ topicId: 1, A: [1, 2, 3], B: [4, 5] }], approved, 4, names)).toMatch(/same number/);
    expect(checkAssignment([{ topicId: 1, A: [1, 2], B: [4, 5] }], approved, 4, names)).toMatch(/Needs at least 6/);
    expect(checkAssignment([{ topicId: 1, A: [1, 2, 3], B: [1, 5, 6] }], approved, 4, names)).toMatch(/one form only/);
    expect(checkAssignment([{ topicId: 1, A: [1, 2, 3], B: [4, 5, 99] }], approved, 4, names)).toMatch(/only approved/);
    expect(checkAssignment([{ topicId: 1, A: [1, 2, 3, 4, 5], B: [6, 7, 8, 1, 2] }], approved, 4, names)).toMatch(/at most 4/);
    expect(checkAssignment([{ topicId: 1, A: [1, 2, 3], B: [4, 5, 6] }], approved, 4, names)).toBeNull();
  });
});

describe("date formatting is runtime-independent", () => {
  it("uses fixed short names (Sep, not Sept)", () => {
    expect(formatDate("2026-09-29")).toBe("Tue 29 Sep");
    expect(formatDate("2027-01-03")).toBe("Sun 3 Jan");
  });
});
