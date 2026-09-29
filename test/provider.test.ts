import { describe, expect, it } from "vitest";
import { callAnthropic, DraftError, mockDrafts } from "../worker/ai/provider";

const req = { topic: "Returns", docs: [{ id: 1, name: "Guide", versionDate: "2026-09-01", text: "Returns are accepted within 30 days of delivery." }], count: 2, existing: [] };

function stub(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { f, calls };
}

async function reason(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e instanceof DraftError ? [e.reason, e.retryable] : ["other"];
  }
  return ["none"];
}

describe("Anthropic call", () => {
  it("sends a forced tool call with only document text, and returns the questions", async () => {
    const qs = [{ question: "Q", options: ["a", "b", "c", "d"], correct_index: 0, document_id: 1, quote: "Returns are accepted" }];
    const { f, calls } = stub(200, { stop_reason: "tool_use", content: [{ type: "tool_use", name: "submit_questions", input: { questions: qs } }] });
    const out = await callAnthropic(req, { apiKey: "k", model: "claude-opus-5-5", fetchImpl: f });
    expect(out).toEqual(qs);
    const body = JSON.parse(calls[0].init.body as string);
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages");
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.tool_choice).toEqual({ type: "tool", name: "submit_questions" });
    expect(body.max_tokens).toBe(16000);
    expect(body.system).toMatch(/in English/);
    expect(body.messages[0].content).toContain('<document id="1" name="Guide">');
    expect((calls[0].init.headers as Record<string, string>)["x-api-key"]).toBe("k");
  });

  it.each([
    [429, ["service unavailable", true]],
    [500, ["service unavailable", true]],
    [529, ["service unavailable", true]],
    [401, ["AI set-up problem, contact the pilot team", false]],
    [403, ["AI set-up problem, contact the pilot team", false]],
  ])("maps HTTP %i", async (status, expected) => {
    expect(await reason(callAnthropic(req, { apiKey: "k", model: "m", fetchImpl: stub(status, {}).f }))).toEqual(expected);
  });

  it("maps a context-length error to 'document too long'", async () => {
    const { f } = stub(400, { type: "error", error: { message: "prompt is too long: 300000 tokens > 200000 maximum" } });
    expect(await reason(callAnthropic(req, { apiKey: "k", model: "m", fetchImpl: f }))).toEqual(["document too long", false]);
  });

  it("treats cut-off or unreadable output as service unavailable, not retried", async () => {
    expect(await reason(callAnthropic(req, { apiKey: "k", model: "m", fetchImpl: stub(200, { stop_reason: "max_tokens", content: [] }).f }))).toEqual([
      "service unavailable",
      false,
    ]);
    expect(await reason(callAnthropic(req, { apiKey: "k", model: "m", fetchImpl: stub(200, "not json").f }))).toEqual(["service unavailable", false]);
    expect(await reason(callAnthropic(req, { apiKey: "k", model: "m", fetchImpl: stub(200, { content: [{ type: "text" }] }).f }))).toEqual([
      "service unavailable",
      false,
    ]);
  });

  it("maps a timeout", async () => {
    const f = async () => {
      throw Object.assign(new Error("t"), { name: "TimeoutError" });
    };
    expect(await reason(callAnthropic(req, { apiKey: "k", model: "m", fetchImpl: f }))).toEqual(["timed out", true]);
  });
});

describe("mock provider", () => {
  it("quotes the uploaded text", () => {
    const out = mockDrafts(req);
    expect(out).toHaveLength(2);
    expect(out[0].quote).toBe("Returns are accepted within 30 days of delivery.");
  });
});
