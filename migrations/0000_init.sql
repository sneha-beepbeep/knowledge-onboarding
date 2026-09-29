CREATE TABLE `answers` (
	`attempt_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`topic_id` integer NOT NULL,
	`chosen_index` integer NOT NULL,
	`correct_index` integer NOT NULL,
	`is_correct` integer NOT NULL,
	PRIMARY KEY(`attempt_id`, `question_id`),
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `answers_question` ON `answers` (`question_id`);--> statement-breakpoint
CREATE TABLE `attempt_topic_scores` (
	`attempt_id` integer NOT NULL,
	`topic_id` integer NOT NULL,
	`correct` integer NOT NULL,
	`total` integer NOT NULL,
	`below_threshold` integer NOT NULL,
	PRIMARY KEY(`attempt_id`, `topic_id`),
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`version_id` integer NOT NULL,
	`form` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`submitted_date` text NOT NULL,
	`overall_correct` integer NOT NULL,
	`overall_total` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_person_version_form` ON `attempts` (`person_id`,`version_id`,`form`);--> statement-breakpoint
CREATE TABLE `deletion_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`person_name` text NOT NULL,
	`deleted_at` integer NOT NULL,
	`deleted_by_name` text NOT NULL,
	`counts` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document_topics` (
	`document_id` integer NOT NULL,
	`topic_id` integer NOT NULL,
	PRIMARY KEY(`document_id`, `topic_id`),
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`version_date` text NOT NULL,
	`text` text NOT NULL,
	`char_count` integer NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `draft_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` integer NOT NULL,
	`kind` text NOT NULL,
	`requested` integer NOT NULL,
	`status` text NOT NULL,
	`created_count` integer DEFAULT 0 NOT NULL,
	`discarded_count` integer DEFAULT 0 NOT NULL,
	`error_reason` text,
	`model` text,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `draft_runs_topic` ON `draft_runs` (`topic_id`);--> statement-breakpoint
CREATE TABLE `flag_topics` (
	`flag_id` integer NOT NULL,
	`topic_id` integer NOT NULL,
	`correct` integer NOT NULL,
	`total` integer NOT NULL,
	PRIMARY KEY(`flag_id`, `topic_id`),
	FOREIGN KEY (`flag_id`) REFERENCES `flags`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `flags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`owner_person_id` integer,
	`flagged_at` integer NOT NULL,
	`flagged_date` text NOT NULL,
	`due_date` text NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flags_attempt` ON `flags` (`attempt_id`);--> statement-breakpoint
CREATE TABLE `followups` (
	`flag_id` integer NOT NULL,
	`topic_id` integer NOT NULL,
	`followup_date` text NOT NULL,
	`note` text NOT NULL,
	`logged_by` integer NOT NULL,
	`logged_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`flag_id`, `topic_id`),
	FOREIGN KEY (`flag_id`) REFERENCES `flags`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`logged_by`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form_questions` (
	`version_id` integer NOT NULL,
	`form` text NOT NULL,
	`topic_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`version_id`, `question_id`),
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `participation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`notice_version` integer NOT NULL,
	`choice` text NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `participation_person` ON `participation` (`person_id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pilot` (
	`id` integer PRIMARY KEY NOT NULL,
	`per_topic_count` integer DEFAULT 4 NOT NULL,
	`drafting_consent_at` integer,
	`drafting_consent_by` integer,
	`hr_signoff_date` text,
	`hr_signoff_by` text,
	`hr_notice_version` integer,
	`hr_recorded_at` integer,
	`form_a_sent_at` integer,
	`form_a_sent_by` integer,
	`ready_since` integer
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` integer NOT NULL,
	`draft_run_id` integer,
	`document_id` integer,
	`document_name` text,
	`document_version_date` text,
	`quote` text,
	`context_before` text,
	`context_after` text,
	`text` text NOT NULL,
	`options` text NOT NULL,
	`correct_index` integer NOT NULL,
	`ai_original` text,
	`status` text NOT NULL,
	`edit_kind` text DEFAULT 'none' NOT NULL,
	`reject_reasons` text,
	`reject_note` text,
	`discard_reason` text,
	`reviewed_by` integer,
	`reviewed_at` integer,
	`updated_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`draft_run_id`) REFERENCES `draft_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `questions_topic` ON `questions` (`topic_id`);--> statement-breakpoint
CREATE INDEX `questions_status` ON `questions` (`status`);--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`role` text PRIMARY KEY NOT NULL,
	`person_id` integer NOT NULL,
	`assigned_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `sign_in_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sign_in_links_token_hash` ON `sign_in_links` (`token_hash`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_name` ON `topics` (`name`);--> statement-breakpoint
CREATE TABLE `versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` integer NOT NULL,
	`published_at` integer NOT NULL,
	`published_by` integer NOT NULL,
	`threshold_pct` integer NOT NULL,
	`per_topic_count` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `versions_number` ON `versions` (`number`);