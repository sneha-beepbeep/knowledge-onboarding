// Draft validation (technical plan §4). A draft failing any rule is discarded,
// with its reason stored and counted.
import { contextAround, findQuote, type SourceDoc } from "./grounding";

export type RawDraft = {
  question?: unknown;
  options?: unknown;
  correct_index?: unknown;
  document_id?: unknown;
  quote?: unknown;
};

export type ValidDraft = {
  text: string;
  options: string[];
  correctIndex: number;
  documentId: number;
  documentName: string;
  documentVersionDate: string;
  quote: string;
  contextBefore: string;
  contextAfter: string;
};

export type Validation =
  | { ok: true; draft: ValidDraft }
  | { ok: false; reason: "malformed" | "options" | "answer" | "quote_length" | "ungrounded"; partial: Record<string, unknown> };

export function validateDraft(raw: RawDraft, docs: SourceDoc[]): Validation {
  const partial = { question: raw?.question, options: raw?.options, correct_index: raw?.correct_index, quote: raw?.quote };
  const text = typeof raw?.question === "string" ? raw.question.trim() : "";
  if (!text || text.length > 500) return { ok: false, reason: "malformed", partial };

  const opts = Array.isArray(raw.options) ? raw.options : null;
  if (!opts || opts.length !== 4 || !opts.every((o) => typeof o === "string")) return { ok: false, reason: "options", partial };
  const options = (opts as string[]).map((o) => o.trim());
  if (options.some((o) => !o || o.length > 200)) return { ok: false, reason: "options", partial };
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return { ok: false, reason: "options", partial };

  const ci = raw.correct_index;
  if (typeof ci !== "number" || !Number.isInteger(ci) || ci < 0 || ci > 3) return { ok: false, reason: "answer", partial };

  const quote = typeof raw.quote === "string" ? raw.quote.trim() : "";
  if (quote.length < 30 || quote.length > 600) return { ok: false, reason: "quote_length", partial };

  const preferred = typeof raw.document_id === "number" ? raw.document_id : Number(raw.document_id);
  const match = findQuote(quote, docs, Number.isFinite(preferred) ? preferred : undefined);
  if (!match) return { ok: false, reason: "ungrounded", partial };

  const ctx = contextAround(match.doc.text, match.start, match.end);
  return {
    ok: true,
    draft: {
      text,
      options,
      correctIndex: ci,
      documentId: match.doc.id,
      documentName: match.doc.name,
      documentVersionDate: match.doc.versionDate,
      quote: match.doc.text.slice(match.start, match.end),
      contextBefore: ctx.before,
      contextAfter: ctx.after,
    },
  };
}
