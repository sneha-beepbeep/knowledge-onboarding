// The Anthropic call (plain fetch, no SDK) and the local mock (technical plan §4).
import type { SourceDoc } from "./grounding";
import type { RawDraft } from "./validate";
import { SUBMIT_TOOL, SYSTEM_PROMPT, buildUserMessage } from "./prompt";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const MAX_TOKENS = 16_000;

/** Short reasons shown on A3 (design spec: "service unavailable / timed out / document too long"). */
export type FailReason = "service unavailable" | "timed out" | "document too long" | "AI set-up problem, contact the pilot team";

export class DraftError extends Error {
  constructor(
    public reason: FailReason,
    public retryable: boolean,
  ) {
    // The reason travels in the message so it survives the Workflow step boundary.
    super(`DRAFT_FAIL:${reason}`);
    this.name = "DraftError";
  }
}

export function reasonFromMessage(msg: string | undefined): FailReason {
  const m = /DRAFT_FAIL:(.+)$/.exec(msg ?? "");
  const r = m?.[1] as FailReason | undefined;
  const known: FailReason[] = ["service unavailable", "timed out", "document too long", "AI set-up problem, contact the pilot team"];
  return r && known.includes(r) ? r : "service unavailable";
}

export type DraftRequest = { topic: string; docs: SourceDoc[]; count: number; existing: string[] };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export async function callAnthropic(
  req: DraftRequest,
  opts: { apiKey: string; model: string; fetchImpl?: FetchLike; timeoutMs?: number },
): Promise<RawDraft[]> {
  const f = opts.fetchImpl ?? ((i: string, init: RequestInit) => fetch(i, init));
  let res: Response;
  try {
    res = await f(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": opts.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserMessage(req.topic, req.docs, req.count, req.existing) }],
        tools: [SUBMIT_TOOL],
        tool_choice: { type: "tool", name: SUBMIT_TOOL.name },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 5 * 60 * 1000),
    });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") throw new DraftError("timed out", true);
    throw new DraftError("service unavailable", true);
  }

  if (res.status === 401 || res.status === 403) throw new DraftError("AI set-up problem, contact the pilot team", false);
  if (res.status === 429 || res.status === 529 || res.status >= 500) throw new DraftError("service unavailable", true);
  if (res.status === 413) throw new DraftError("document too long", false);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (/prompt is too long|too many tokens|context (length|window)/i.test(text)) throw new DraftError("document too long", false);
    throw new DraftError("service unavailable", false);
  }

  let data: { stop_reason?: string; content?: { type: string; name?: string; input?: unknown }[] };
  try {
    data = await res.json();
  } catch {
    throw new DraftError("service unavailable", false);
  }
  // Output cut off at the token limit, or unreadable: nothing is saved.
  if (data.stop_reason === "max_tokens") throw new DraftError("service unavailable", false);
  const tool = data.content?.find((b) => b.type === "tool_use" && b.name === SUBMIT_TOOL.name);
  const qs = (tool?.input as { questions?: unknown } | undefined)?.questions;
  if (!Array.isArray(qs)) throw new DraftError("service unavailable", false);
  return qs as RawDraft[];
}

/**
 * Local mock (AI_MOCK=1, ENVIRONMENT=local only): canned drafts quoted from the
 * uploaded text, so the whole app can be built and tested with no material
 * leaving the laptop. Markers in the text exercise failure paths in tests:
 * [mock:ungrounded], [mock:malformed], [mock:429], [mock:timeout], [mock:unauthorized].
 */
export function mockDrafts(req: DraftRequest): RawDraft[] {
  const all = req.docs.map((d) => d.text).join("\n");
  if (all.includes("[mock:429]")) throw new DraftError("service unavailable", true);
  if (all.includes("[mock:timeout]")) throw new DraftError("timed out", true);
  if (all.includes("[mock:unauthorized]")) throw new DraftError("AI set-up problem, contact the pilot team", false);

  const sentences: { doc: SourceDoc; s: string }[] = [];
  for (const doc of req.docs) {
    for (const s of doc.text.split(/(?<=[.!?])\s+|\n+/)) {
      const t = s.trim();
      if (t.length >= 30 && t.length <= 600 && !t.includes("[mock:")) sentences.push({ doc, s: t });
    }
  }
  const out: RawDraft[] = [];
  const offset = req.existing.length;
  for (let i = 0; i < req.count && sentences.length; i++) {
    const { doc, s } = sentences[(i + offset) % sentences.length];
    const n = offset + i + 1;
    const correct = s.length > 190 ? s.slice(0, 187) + "…" : s;
    out.push({
      question: `(Mock ${n}) According to "${doc.name}", which statement is correct?`,
      options: [
        `Not stated in the material (mock distractor ${n}a)`,
        correct,
        `The opposite of what the material says (mock distractor ${n}b)`,
        `Only applies outside onboarding (mock distractor ${n}c)`,
      ],
      correct_index: 1,
      document_id: doc.id,
      quote: s,
    });
  }
  if (all.includes("[mock:ungrounded]") && out.length) {
    out[out.length - 1] = { ...out[out.length - 1], quote: "This sentence does not appear anywhere in the uploaded material." };
  }
  if (all.includes("[mock:malformed]") && out.length > 1) {
    out[0] = { ...out[0], options: ["Only", "three", "options"] };
  }
  return out;
}
