import { beforeEach, describe, expect, it } from "vitest";
import { call, db, makeWorld, type World } from "./helpers";
import { seedLoop } from "./scenario";
import { questions, versions } from "../worker/db/schema";

const doc = (over: Record<string, unknown> = {}) => ({
  name: "Returns guide",
  versionDate: "2026-08-15",
  topics: ["Returns process"],
  text: "Paragraph one about returns.\n\nParagraph two about refunds.",
  source: "paste",
  ...over,
});

describe("A3/A3a bank material", () => {
  let w: World;
  beforeEach(async () => {
    w = await makeWorld();
  });

  it("adds a document with topics; the topic card lists it", async () => {
    const r = await call("POST", "/api/documents", { token: w.tokens.bank, json: doc({ topics: ["Returns process", "Refunds"] }) });
    expect(r.status).toBe(201);
    const bank = await call("GET", "/api/bank", { token: w.tokens.bank });
    expect(bank.body.topics.map((t: any) => t.name)).toEqual(["Refunds", "Returns process"]);
    expect(bank.body.topics[0].documents[0]).toMatchObject({ name: "Returns guide", versionDate: "2026-08-15" });
    expect(bank.body.perTopicCount).toBe(4);
    expect(bank.body.aiSetUp).toBe(true);
    expect(bank.body.consentGiven).toBe(false);
  });

  it("reuses topics case-insensitively", async () => {
    await call("POST", "/api/documents", { token: w.tokens.bank, json: doc() });
    await call("POST", "/api/documents", { token: w.tokens.bank, json: doc({ name: "Other", topics: ["returns PROCESS"] }) });
    const bank = await call("GET", "/api/bank", { token: w.tokens.bank });
    expect(bank.body.topics).toHaveLength(1);
    expect(bank.body.topics[0].documents).toHaveLength(2);
  });

  it("validates fields and limits", async () => {
    const t = w.tokens.bank;
    expect((await call("POST", "/api/documents", { token: t, json: doc({ name: "" }) })).body.error).toBe("Add a name.");
    expect((await call("POST", "/api/documents", { token: t, json: doc({ versionDate: "2026-02-30" }) })).body.error).toBe(
      "Add the material's version date.",
    );
    expect((await call("POST", "/api/documents", { token: t, json: doc({ topics: [] }) })).body.error).toBe("Add at least one topic.");
    expect((await call("POST", "/api/documents", { token: t, json: doc({ source: "docx" }) })).status).toBe(400);
    const long = await call("POST", "/api/documents", { token: t, json: doc({ text: "x".repeat(150_001) }) });
    expect(long.status).toBe(413);
    expect(long.body.error).toMatch(/too long to use in one piece/);
    expect((await call("POST", "/api/documents", { token: t, json: doc({ text: "x".repeat(150_000) }) })).status).toBe(201);
  });

  it("per-topic setting is 3-5", async () => {
    expect((await call("PUT", "/api/bank/settings", { token: w.tokens.bank, json: { perTopicCount: 2 } })).status).toBe(400);
    expect((await call("PUT", "/api/bank/settings", { token: w.tokens.bank, json: { perTopicCount: 5 } })).status).toBe(200);
    expect((await call("GET", "/api/bank", { token: w.tokens.bank })).body.perTopicCount).toBe(5);
  });

  it("removing a document keeps drafts and their snapshot; the empty topic card disappears", async () => {
    await call("POST", "/api/documents", { token: w.tokens.bank, json: doc() });
    const bank = await call("GET", "/api/bank", { token: w.tokens.bank });
    const t = bank.body.topics[0];
    const now = Date.now();
    await db().insert(questions).values({
      topicId: t.id, documentId: t.documents[0].id, documentName: "Returns guide", quote: "Paragraph one about returns.",
      text: "Q?", options: ["a", "b", "c", "d"], correctIndex: 0, status: "pending", createdAt: now, updatedAt: now,
    });
    expect((await call("DELETE", `/api/documents/${t.documents[0].id}`, { token: w.tokens.bank })).status).toBe(200);
    const after = await call("GET", "/api/bank", { token: w.tokens.bank });
    expect(after.body.topics).toHaveLength(0);
    const [q] = await db().select().from(questions);
    expect(q.documentId).toBeNull();
    expect(q.quote).toBe("Paragraph one about returns.");
  });

  it("everything is frozen after publish", async () => {
    await call("POST", "/api/documents", { token: w.tokens.bank, json: doc() });
    const bank = await call("GET", "/api/bank", { token: w.tokens.bank });
    await db().insert(versions).values({ number: 1, publishedAt: Date.now(), publishedBy: w.ids.bank, thresholdPct: 70, perTopicCount: 4 });
    const t = w.tokens.bank;
    expect((await call("POST", "/api/documents", { token: t, json: doc({ name: "New" }) })).status).toBe(409);
    expect((await call("DELETE", `/api/documents/${bank.body.topics[0].documents[0].id}`, { token: t })).status).toBe(409);
    expect((await call("PUT", "/api/bank/settings", { token: t, json: { perTopicCount: 3 } })).status).toBe(409);
    expect((await call("POST", "/api/bank/consent", { token: t })).status).toBe(409);
    expect((await call("GET", "/api/bank", { token: t })).body.published.date).toMatch(/^\d{4}-/);
  });
});

describe("document access for the follow-up owner", () => {
  it("only documents of their student's weak topics", async () => {
    const w = await makeWorld();
    const ids = await seedLoop(w);
    const weak = await call("GET", `/api/documents/${ids.weakDocId}`, { token: w.tokens.fuo });
    expect(weak.status).toBe(200);
    expect(weak.body.text).toBe("Returns text.");
    expect((await call("GET", `/api/documents/${ids.solidOnlyDocId}`, { token: w.tokens.fuo })).status).toBe(404);
    expect((await call("GET", `/api/documents/${ids.weakDocId}`, { token: w.tokens.student })).status).toBe(404);
  });
});
