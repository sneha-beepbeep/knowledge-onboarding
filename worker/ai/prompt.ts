// Prompt for AI drafting (technical plan §4). Only onboarding document text,
// topic names and existing question texts are ever sent. Nothing about people.
import type { SourceDoc } from "./grounding";

export const SYSTEM_PROMPT = `You write questions for an internal onboarding knowledge check at a company.

Rules:
- Write single-answer multiple-choice questions in English.
- Use ONLY the documents provided. Do not use outside knowledge, the web, or assumptions.
- Test understanding of how things work and why, not trivia, exact wording, dates or numbers that don't matter.
- Each question has exactly 4 options: one clearly correct answer and three plausible but clearly wrong options.
- Do not include confidential or personal details (names of people, customer data, credentials, salaries and similar).
- Each question must include, in "quote", the passage from one document that supports the correct answer, copied word for word (30 to 600 characters). Copy it exactly; do not paraphrase, shorten with ellipses, or fix typos.
- Set "document_id" to the id of the document the quote comes from.
- "correct_index" is the 0-based position of the correct option.
- Do not repeat or closely rephrase any existing question you are given.

Submit all questions with the submit_questions tool.`;

export const SUBMIT_TOOL = {
  name: "submit_questions",
  description: "Submit the drafted multiple-choice questions.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string", description: "The question text." },
            options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
            correct_index: { type: "integer", minimum: 0, maximum: 3 },
            document_id: { type: "integer", description: "Id of the document the quote comes from." },
            quote: { type: "string", description: "Word-for-word passage that supports the correct answer." },
          },
          required: ["question", "options", "correct_index", "document_id", "quote"],
        },
      },
    },
    required: ["questions"],
  },
} as const;

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function buildUserMessage(topic: string, docs: SourceDoc[], count: number, existing: string[]): string {
  const docBlocks = docs
    .map((d) => `<document id="${d.id}" name="${escapeAttr(d.name)}">\n${d.text}\n</document>`)
    .join("\n\n");
  const existingBlock = existing.length
    ? `\n\nExisting questions for this topic (do not duplicate them):\n${existing.map((q) => `- ${q}`).join("\n")}`
    : "";
  return `Topic: ${topic}\n\nDocuments:\n\n${docBlocks}${existingBlock}\n\nWrite ${count} questions for the topic "${topic}".`;
}
