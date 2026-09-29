// Size limits (technical plan §4, the spec's "[plan]" items).
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
/** Extracted or pasted text per document (about 60 pages). */
export const MAX_DOC_CHARS = 150_000;
/** All documents of one topic together (about 100k tokens). */
export const MAX_TOPIC_CHARS = 400_000;
export const MAX_NAME = 200;
export const MAX_TOPIC_NAME = 80;
export const MAX_TOPICS_PER_DOC = 20;
/** A run still "running" after this long is shown as failed, "timed out". */
export const DRAFT_TIMEOUT_MS = 15 * 60 * 1000;
