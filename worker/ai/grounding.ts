// Grounding check (technical plan §4): the quote must be found word for word in
// one of the topic's documents, after one normalisation applied to both sides:
// NFKC, curly quotes made straight, dash variants made one hyphen, runs of
// whitespace collapsed. Case-sensitive. The normaliser keeps a map back to
// positions in the original text so we can store the exact passage and context.

const QUOTES: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'",
  "“": '"', "”": '"', "„": '"', "‟": '"', "″": '"',
  "«": '"', "»": '"',
};
const DASH_RE = /[‐‑‒–—―−﹘﹣－]/;

export type Normalised = { text: string; map: number[] };

/** Normalises `s`; map[i] is the index in `s` of the source of normalised char i. */
export function normalise(s: string): Normalised {
  let out = "";
  const map: number[] = [];
  let pendingSpace = -1;
  // Segment into base character + combining marks so NFKC can compose them.
  const re = /\P{M}\p{M}*|\p{M}+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const start = m.index;
    let seg = m[0].normalize("NFKC");
    if (/^\s+$/u.test(seg)) {
      if (pendingSpace < 0) pendingSpace = start;
      continue;
    }
    if (pendingSpace >= 0) {
      if (out.length) {
        out += " ";
        map.push(pendingSpace);
      }
      pendingSpace = -1;
    }
    seg = [...seg].map((ch) => QUOTES[ch] ?? (DASH_RE.test(ch) ? "-" : /\s/u.test(ch) ? " " : ch)).join("");
    for (let i = 0; i < seg.length; i++) {
      out += seg[i];
      map.push(start);
    }
  }
  return { text: out, map };
}

export type SourceDoc = { id: number; name: string; versionDate: string; text: string };

export type Match = { doc: SourceDoc; start: number; end: number };

/** Finds the quote in the stated document first, then in the topic's other documents. */
export function findQuote(quote: string, docs: SourceDoc[], preferredId?: number): Match | null {
  const q = normalise(quote).text;
  if (!q) return null;
  const ordered = [...docs].sort((a, b) => (a.id === preferredId ? -1 : b.id === preferredId ? 1 : 0));
  for (const doc of ordered) {
    const n = normalise(doc.text);
    const idx = n.text.indexOf(q);
    if (idx < 0) continue;
    const start = n.map[idx];
    const lastSrc = n.map[idx + q.length - 1];
    // Extend the end over the whole source segment of the last matched char.
    const tail = /\P{M}\p{M}*|\p{M}+/gu;
    tail.lastIndex = lastSrc;
    const seg = tail.exec(doc.text);
    const end = seg && seg.index === lastSrc ? lastSrc + seg[0].length : lastSrc + 1;
    return { doc, start, end };
  }
  return null;
}

const MAX_CONTEXT = 1500;

/**
 * About two paragraphs of context (V2): from the start of the previous paragraph
 * to the quote, and from the quote to the end of the next paragraph. Capped.
 */
export function contextAround(text: string, start: number, end: number): { before: string; after: string } {
  const paraStarts: number[] = [0];
  const re = /\n\s*\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) paraStarts.push(m.index + m[0].length);
  // Paragraph containing the quote start, and the one before it.
  let pi = 0;
  for (let i = 0; i < paraStarts.length; i++) if (paraStarts[i] <= start) pi = i;
  const beforeStart = paraStarts[Math.max(0, pi - 1)];
  // Paragraph containing the quote end, and the one after it.
  let pj = 0;
  for (let i = 0; i < paraStarts.length; i++) if (paraStarts[i] < end) pj = i;
  const afterEnd = pj + 2 < paraStarts.length ? paraStarts[pj + 2] : text.length;
  let before = text.slice(beforeStart, start);
  let after = text.slice(end, afterEnd);
  if (before.length > MAX_CONTEXT) before = "…" + before.slice(-MAX_CONTEXT);
  if (after.length > MAX_CONTEXT) after = after.slice(0, MAX_CONTEXT) + "…";
  return { before: before.replace(/^\s+/, ""), after: after.replace(/\s+$/, "") };
}
