// Database schema (Drizzle). Technical plan §2.
// Timestamps are epoch milliseconds (integer). Calendar dates are `YYYY-MM-DD`
// strings in the company timezone (APP_TIMEZONE).
import {
  sqliteTable,
  integer,
  text,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const ROLES = ["student", "follow_up_owner", "bank_owner", "reviewer", "cpo"] as const;
export type Role = (typeof ROLES)[number];

export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email"),
  createdAt: integer("created_at").notNull(),
});

export const roleAssignments = sqliteTable("role_assignments", {
  role: text("role", { enum: ROLES }).primaryKey(),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  assignedAt: integer("assigned_at").notNull(),
});

export const signInLinks = sqliteTable(
  "sign_in_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    revokedAt: integer("revoked_at"),
  },
  (t) => [uniqueIndex("sign_in_links_token_hash").on(t.tokenHash)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [uniqueIndex("sessions_token_hash").on(t.tokenHash)],
);

// Single row (id = 1), created on first read.
export const pilot = sqliteTable("pilot", {
  id: integer("id").primaryKey(),
  perTopicCount: integer("per_topic_count").notNull().default(4),
  draftingConsentAt: integer("drafting_consent_at"),
  draftingConsentBy: integer("drafting_consent_by"),
  hrSignoffDate: text("hr_signoff_date"),
  hrSignoffBy: text("hr_signoff_by"),
  hrNoticeVersion: integer("hr_notice_version"),
  hrRecordedAt: integer("hr_recorded_at"),
  formASentAt: integer("form_a_sent_at"),
  formASentBy: integer("form_a_sent_by"),
  readySince: integer("ready_since"),
});

export const topics = sqliteTable(
  "topics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("topics_name").on(t.name)],
);

export const DOCUMENT_SOURCES = ["pdf", "txt", "paste"] as const;

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  versionDate: text("version_date").notNull(),
  text: text("text").notNull(),
  charCount: integer("char_count").notNull(),
  source: text("source", { enum: DOCUMENT_SOURCES }).notNull(),
  createdAt: integer("created_at").notNull(),
});

export const documentTopics = sqliteTable(
  "document_topics",
  {
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.topicId] })],
);

export const draftRuns = sqliteTable(
  "draft_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    kind: text("kind", { enum: ["initial", "more"] }).notNull(),
    requested: integer("requested").notNull(),
    status: text("status", { enum: ["running", "done", "failed"] }).notNull(),
    createdCount: integer("created_count").notNull().default(0),
    discardedCount: integer("discarded_count").notNull().default(0),
    errorReason: text("error_reason"),
    model: text("model"),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
  },
  (t) => [index("draft_runs_topic").on(t.topicId)],
);

export const QUESTION_STATUSES = ["pending", "approved", "rejected", "discarded"] as const;
export const EDIT_KINDS = ["none", "minor", "substantial"] as const;

export const questions = sqliteTable(
  "questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    draftRunId: integer("draft_run_id").references(() => draftRuns.id),
    documentId: integer("document_id").references(() => documents.id, { onDelete: "set null" }),
    documentName: text("document_name"),
    documentVersionDate: text("document_version_date"),
    quote: text("quote"),
    contextBefore: text("context_before"),
    contextAfter: text("context_after"),
    text: text("text").notNull(),
    options: text("options", { mode: "json" }).$type<string[]>().notNull(),
    correctIndex: integer("correct_index").notNull(),
    aiOriginal: text("ai_original", { mode: "json" }).$type<unknown>(),
    status: text("status", { enum: QUESTION_STATUSES }).notNull(),
    editKind: text("edit_kind", { enum: EDIT_KINDS }).notNull().default("none"),
    rejectReasons: text("reject_reasons", { mode: "json" }).$type<string[]>(),
    rejectNote: text("reject_note"),
    discardReason: text("discard_reason"),
    reviewedBy: integer("reviewed_by").references(() => people.id),
    reviewedAt: integer("reviewed_at"),
    // Who last changed this question (decision, edit or undo): V2 "updated by [name]".
    updatedBy: integer("updated_by").references(() => people.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("questions_topic").on(t.topicId), index("questions_status").on(t.status)],
);

export const versions = sqliteTable(
  "versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: integer("number").notNull(),
    publishedAt: integer("published_at").notNull(),
    publishedBy: integer("published_by").notNull(),
    thresholdPct: integer("threshold_pct").notNull(),
    perTopicCount: integer("per_topic_count").notNull(),
  },
  // The pilot has exactly one published version (decision 4): a second publish fails.
  (t) => [uniqueIndex("versions_number").on(t.number)],
);

export const formQuestions = sqliteTable(
  "form_questions",
  {
    versionId: integer("version_id")
      .notNull()
      .references(() => versions.id),
    form: text("form", { enum: ["A", "B"] }).notNull(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.versionId, t.questionId] })],
);

export const participation = sqliteTable(
  "participation",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    noticeVersion: integer("notice_version").notNull(),
    choice: text("choice", { enum: ["take_part", "decline"] }).notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (t) => [index("participation_person").on(t.personId)],
);

export const attempts = sqliteTable(
  "attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    versionId: integer("version_id")
      .notNull()
      .references(() => versions.id),
    form: text("form", { enum: ["A", "B"] }).notNull(),
    submittedAt: integer("submitted_at").notNull(),
    // Calendar date of submission in APP_TIMEZONE (day 0 for Form A).
    submittedDate: text("submitted_date").notNull(),
    overallCorrect: integer("overall_correct").notNull(),
    overallTotal: integer("overall_total").notNull(),
  },
  (t) => [uniqueIndex("attempts_person_version_form").on(t.personId, t.versionId, t.form)],
);

export const attemptTopicScores = sqliteTable(
  "attempt_topic_scores",
  {
    attemptId: integer("attempt_id")
      .notNull()
      .references(() => attempts.id),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    correct: integer("correct").notNull(),
    total: integer("total").notNull(),
    belowThreshold: integer("below_threshold", { mode: "boolean" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.topicId] })],
);

export const answers = sqliteTable(
  "answers",
  {
    attemptId: integer("attempt_id")
      .notNull()
      .references(() => attempts.id),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    chosenIndex: integer("chosen_index").notNull(),
    correctIndex: integer("correct_index").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.questionId] }), index("answers_question").on(t.questionId)],
);

export const flags = sqliteTable(
  "flags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    attemptId: integer("attempt_id")
      .notNull()
      .references(() => attempts.id),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id),
    ownerPersonId: integer("owner_person_id").references(() => people.id),
    flaggedAt: integer("flagged_at").notNull(),
    flaggedDate: text("flagged_date").notNull(),
    dueDate: text("due_date").notNull(),
  },
  (t) => [uniqueIndex("flags_attempt").on(t.attemptId)],
);

export const flagTopics = sqliteTable(
  "flag_topics",
  {
    flagId: integer("flag_id")
      .notNull()
      .references(() => flags.id),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    correct: integer("correct").notNull(),
    total: integer("total").notNull(),
  },
  (t) => [primaryKey({ columns: [t.flagId, t.topicId] })],
);

export const followups = sqliteTable(
  "followups",
  {
    flagId: integer("flag_id")
      .notNull()
      .references(() => flags.id),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    followupDate: text("followup_date").notNull(),
    note: text("note").notNull(),
    loggedBy: integer("logged_by")
      .notNull()
      .references(() => people.id),
    loggedAt: integer("logged_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.flagId, t.topicId] })],
);

export const deletionLog = sqliteTable("deletion_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id").notNull(),
  personName: text("person_name").notNull(),
  deletedAt: integer("deleted_at").notNull(),
  deletedByName: text("deleted_by_name").notNull(),
  counts: text("counts", { mode: "json" }).$type<Record<string, number>>().notNull(),
});
