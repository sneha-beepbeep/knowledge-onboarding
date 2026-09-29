import { describe, expect, it } from "vitest";
import { contextAround, findQuote, normalise } from "../worker/ai/grounding";
import { validateDraft } from "../worker/ai/validate";

const doc = (text: string, id = 1) => ({ id, name: `Doc ${id}`, versionDate: "2026-09-01", text });

describe("normalise", () => {
  it("straightens quotes, unifies dashes, collapses whitespace, applies NFKC", () => {
    expect(normalise("It’s  a “good”—fine\n\n dayﬁ").text).toBe(`It's a "good"-fine dayfi`);
  });
  it("keeps a map back to original positions", () => {
    const s = "a  b—c";
    const n = normalise(s);
    expect(n.text).toBe("a b-c");
    expect(n.map).toEqual([0, 1, 3, 4, 5]);
  });
  it("composes decomposed characters", () => {
    expect(normalise("Café").text).toBe("Café");
  });
});

describe("findQuote", () => {
  const text = "Returns are accepted within 30 days.\n\nRefunds go to the original payment method – always.";
  it("matches across typographic differences and returns the original slice", () => {
    const m = findQuote('Refunds go to the original payment method - always.', [doc(text)]);
    expect(m).not.toBeNull();
    expect(text.slice(m!.start, m!.end)).toBe("Refunds go to the original payment method – always.");
  });
  it("matches whitespace differences (line breaks from PDFs)", () => {
    expect(findQuote("Returns are accepted\nwithin   30 days.", [doc(text)])).not.toBeNull();
  });
  it("is case-sensitive", () => {
    expect(findQuote("returns are accepted within 30 days.", [doc(text)])).toBeNull();
  });
  it("searches the stated document first, then others", () => {
    const m = findQuote("Returns are accepted within 30 days.", [doc("other", 1), doc(text, 2)], 1);
    expect(m!.doc.id).toBe(2);
  });
});

describe("contextAround", () => {
  it("returns the paragraph before and after", () => {
    const t = "P1 text.\n\nP2 before QUOTE after.\n\nP3 text.\n\nP4 text.";
    const s = t.indexOf("QUOTE");
    const c = contextAround(t, s, s + 5);
    expect(c.before).toBe("P1 text.\n\nP2 before ");
    expect(c.after).toBe(" after.\n\nP3 text.");
  });
});

describe("validateDraft", () => {
  const text = "Customers can return any unused item within thirty days of delivery for a full refund.";
  const good = {
    question: "How long do customers have to return unused items?",
    options: ["Seven days", "Thirty days", "Ninety days", "No returns"],
    correct_index: 1,
    document_id: 1,
    quote: "Customers can return any unused item within thirty days of delivery",
  };
  it("accepts a grounded draft and stores the original passage and context", () => {
    const v = validateDraft(good, [doc(text)]);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.draft.quote).toBe(good.quote);
      expect(v.draft.contextAfter).toBe(" for a full refund.");
    }
  });
  it.each([
    [{ question: "" }, "malformed"],
    [{ question: "x".repeat(501) }, "malformed"],
    [{ options: ["a", "b", "c"] }, "options"],
    [{ options: ["a", "b", "c", ""] }, "options"],
    [{ options: ["a", "B", "b", "c"] }, "options"],
    [{ options: ["a", "b", "c", "x".repeat(201)] }, "options"],
    [{ correct_index: 4 }, "answer"],
    [{ correct_index: "1" }, "answer"],
    [{ quote: "too short" }, "quote_length"],
    [{ quote: "x".repeat(601) }, "quote_length"],
    [{ quote: "This passage is not in the material at all, anywhere." }, "ungrounded"],
  ])("discards %j as %s", (over, reason) => {
    const v = validateDraft({ ...good, ...over }, [doc(text)]);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe(reason);
  });
});
