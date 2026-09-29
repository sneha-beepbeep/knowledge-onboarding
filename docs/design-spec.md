# Design Spec: Onboarding Knowledge Check (working title)

*Stage 4 `/design`, 2026-09-29, rev. 2. **CPO-approved 2026-09-29.** Rev. 2 records the CPO's decisions of 2026-09-29 on the open questions (section 12) and applies them throughout. Source: `docs/prd.md` (CPO-approved, rev. 2). Context: `docs/opportunity-brief.md`, `docs/ceo-review.md`. PRD rev. 2 carries the F12 reviewer-access (P1) and P9/P10 amendments this spec matches.*

**What this spec does not decide:** the tech stack, sign-in mechanism, AI provider, hosting, and whether notifications go by email. Those belong to `/plan`. Where the design depends on one of them, the dependency is marked **[plan]**. The named people for each role, the AI provider and HR sign-off with the final notice text are still open (section 12.3). The design handles "not yet decided" as an explicit state and does not assume an answer.

References of the form "(decision N)" point to section 12.

---

## 1. Design principles

1. **Fewest screens that close the loop.** Every screen traces to one of F1-F12 or the section 6 privacy gate. Nothing else ships.
2. **Development, not evaluation, in every word and layout.** The student and the manager see per-topic counts ("3 of 4") and "topics to go over". They never see "fail", a red overall grade or a rank.
3. **The same results page for everyone who may see results.** The student, the manager and the admins all look at one results view. The student can be told truthfully: "Your manager sees exactly this page."
4. **Gates are shown as states, not left as tribal knowledge.** Unapproved drafts, missing role holders, an unconfigured AI provider and missing HR sign-off each show up as a visible, blocking state with a reason.
5. **Text first.** Tables and plain sentences, no charts. Charts would need text alternatives anyway, and at n=1 a table is clearer.

---

## 2. Roles, access levels and entry points

### 2.1 Roles and entry points

| Role | Person | Entry point | Lands on |
|---|---|---|---|
| **Student** | Pilot working student *(unnamed, open)* | The link in the "Your knowledge check" message (email or pasted by the bank owner) **[plan]** | T1 Student home, or T2 Notice if not yet answered |
| **Follow-up owner** | Student's direct manager *(unnamed, open)* | The flag notification link, or opening the app | M1 Flags |
| **Bank owner** | Product-team member *(unnamed, open)* | Opening the app | A1 Pilot overview |
| **Content reviewer** | Subject-matter expert *(unnamed, open)* | The "Questions ready for review" link, or opening the app | V1 Review queue |
| **Pilot sponsor** | CPO | Opening the app | A1 Pilot overview |

One person can hold several roles. The navigation shows the union of their roles' screens. Nav items: *My checks* (student), *Flags* (follow-up owner), *Review* (reviewer), *Pilot* / *Bank* / *Data* (bank owner and CPO).

### 2.2 Access matrix (what each role can see)

| Data | Student | Follow-up owner | Reviewer | Bank owner | CPO |
|---|---|---|---|---|---|
| Uploaded material, drafts, review outcomes | - | Source passages linked from a flag only | Yes | Yes | Yes |
| Published forms (questions) | Only the form they are taking, and after submitting, that form's answers | Via their student's results | Yes | Yes | Yes |
| Attempts, answers, per-topic scores | **Own only** | **Their student's only** | **No.** Review-outcome statistics, plus answer statistics only once 5 or more people have answered (see 2.3) | All | All |
| Flags and follow-up log | Own flags (topics, due date, "done [date]"). Not the follow-up note text (decision 9) | Their student's | No | All | All |
| Participation record (notice seen, took part or declined) | Own | "Took part" only, never "declined" (decision 6) | No | All | All |
| Export (F10) | - | - | - | Yes | Yes |
| Delete a person's data (F11) | - | - | - | Yes | Yes |
| Assign people to roles, record HR sign-off | - | - | - | Roles: yes. HR sign-off: no | Yes |

### 2.3 Four access levels (P1)

The original F12 grouped "bank owner/reviewer/CPO (full)", while section 6 says the reviewer sees **per-question statistics only, not names**. The design uses **four access levels:** student, follow-up owner, reviewer (content and anonymised statistics), admin (bank owner and CPO). The Product Manager is amending F12 to match. This adds no screens.

**At n=1, answer statistics are not anonymous.** With one student, "question 7: 0 of 1 correct" is that student's answer, and the reviewer knows who the student is. **Decided (decision 1):** V3 Question statistics always shows the review-outcome statistics, which are about questions rather than people (rewrite rate, M3). It hides answer statistics for a question until **at least 5 different people** have answered it. In the n=1 pilot, the reviewer therefore sees no answer statistics.

If the reviewer is also the manager or an admin (possible at n=1), the four levels do not separate that person's access: they see what their other role allows. A2 People & roles shows a warning and does not block (decision 7), and the notice copy adjusts (section 7.1).

---

## 3. Screen inventory

| ID | Screen | Roles | PRD trace |
|---|---|---|---|
| S0 | Sign-in and access states | All | F12 |
| A1 | Pilot overview (admin home: readiness, loop status, deadlines) | Bank owner, CPO | F4, F7, F8, F9, F12, §6 gate, §9 (M1, M3) |
| A2 | People & roles | Bank owner, CPO | F12, §2, §7 |
| A3 | Bank: material & topics (includes drafting) | Bank owner | F1, F2 |
| A3a | Add document (dialog) | Bank owner | F1 |
| A4 | Publish version (split into Form A/B, threshold) | Bank owner | F3, F4, F7 |
| A5 | Send Form A (dialog on A1) | Bank owner, CPO | F5, C6 rollout bar, §6 gate |
| A6 | Data: export & delete | Bank owner, CPO | F10, F11, §6 retention |
| V1 | Review queue | Reviewer (bank owner and CPO can view it) | F2, F3 |
| V2 | Review a question | Reviewer | F2, F3, §5 |
| V3 | Question statistics (anonymised) | Reviewer, bank owner, CPO | §6, M3 |
| T1 | Student home ("My checks") | Student | F5, F9 |
| T2 | Notice & participation | Student | §6 notice, voluntary participation |
| T3 | Quiz (Form A or Form B) | Student | F4, F5 |
| R1 | Results for one attempt (shared view) | Student (own), follow-up owner (their student), admin | F5, F6, F7 |
| R2 | Form A vs. Form B comparison (shared view) | Student (own), follow-up owner, admin | F9 |
| M1 | Flags (follow-up owner home) | Follow-up owner (admin can view it) | F7, F8 |
| M2 | Flag detail & follow-up log | Follow-up owner | F7, F8 |

Eighteen screens and dialogs, of which R1 and R2 are shared. There is no settings area, profile page, dashboard of charts or in-app messaging.

---

## 4. End-to-end flows

### Flow 0: Pilot setup (bank owner, CPO)

1. The CPO or bank owner opens **A1**. The readiness checklist shows four unmet items: *Roles named*, *AI provider set up*, *Bank published*, *HR sign-off recorded*.
2. **A2:** assign a person to each role (student, follow-up owner, bank owner, reviewer). Items can be saved one at a time. Empty roles keep the checklist item open.
3. The AI provider is configured outside the UI **[plan]**. A1 shows it only as *Set up* or *Not set up*. Until it is set up, drafting on A3 is disabled with a reason.
4. HR sign-off: the CPO records the date and the name of the person who signed off on A1 (one small form). This is only a record. The approval itself happens outside the app.

Items 2-4 can happen in any order, alongside Flow 1.

### Flow 1: Bank setup, drafting, review, publish

1. **Bank owner, A3:** choose *Add document*, then **A3a**: upload a file (PDF or plain text) or paste text, and enter a name, a version date and one or more topic tags. Save. The document appears under each of its topics.
2. **A3:** set *Questions per topic per form* once (3-5, **default 4**, decision 2). Per topic, choose *Draft questions*. The app drafts `2 × per-form count + 2` questions per topic (10 at the default), in English (decision 5), from documents tagged with that topic only.
3. Drafting runs in the background. Each topic row shows *Drafting…*, then *10 drafts ready for review*, or an error with *Try again*.
4. When drafts exist, the reviewer is notified: "N questions are ready for review" (email or in-app **[plan]**).
5. **Reviewer, V1 → V2:** works through the queue one question at a time, with the source passage shown next to the question. For each one: **Approve**, **Edit** (then save and approve, and say whether the change was minor or substantial), or **Reject** (optional reason). Decisions can be undone until the version is published.
6. **Bank owner, A3:** if a topic ends up short of approved questions, choose *Draft 5 more* for that topic, or add material. Newly drafted questions go back to the queue (steps 3-5).
7. **Bank owner, A4:** once every topic included in the version has at least `2 × per-form count` approved questions (8 at the default), *Publish* becomes available. The app splits the approved questions into Form A and Form B (equal count per topic). The bank owner reviews the split, can move a question between forms, confirms the flag threshold (default 70%), and publishes.
8. The version is now read-only and frozen for the 90-day pilot (decision 4). A1 marks *Bank published*.

### Flow 2: Student notice, Form A, results

The rollout bar (C6) is: no more steps than sending a Forms link.

| | Forms link | This app |
|---|---|---|
| Bank owner | Open the form → Send → paste the address or copy the link → Send | A1 → *Send Form A* → **A5** confirm → Send (or copy the link) |
| Student | Open the link → answer → Submit | Open the link → **read the notice and choose *Take part*** → answer → Submit |

The only extra step is the notice. Section 6 requires it before the first attempt whichever tool is used, so a compliant Forms quiz would need it too. The bar holds **if** sign-in is silent (company single sign-on) or a one-click link. A flow that makes the student create an account and password would break the bar **[plan]**.

1. **Bank owner or CPO, A1:** *Send Form A to [student]*. This is only enabled when the readiness checklist is complete.
2. **A5:** one confirmation dialog. The app sends the message, or shows the link to copy **[plan]**. A1 shows *Form A sent [date]*.
3. **Student** opens the link and signs in (silently if possible). If they have not answered the notice, they see **T2**. Otherwise they see **T1**.
4. **T2:** the student reads the notice and chooses **Take part** or **I'd rather not**. The choice, its time and the notice version are recorded.
   - *Take part:* go to **T3**.
   - *I'd rather not:* go to T1 in its declined state. The bank owner and CPO see *Declined [date]* on A1. The manager is not told (decision 6).
5. **T3:** all questions on one page, grouped by topic, with no timer. Submit is enabled once every question has an answer.
6. After submission, the attempt is scored and stored (F6), and the student lands on **R1** with per-topic results and the correct answers.
7. Any topic below the threshold creates **one flag for the attempt**, listing all weak topics. It goes to the follow-up owner (Flow 3). If no topic is below the threshold, no flag is created and Form B opens straight away (E7, decision 8).

### Flow 3: Flag, follow-up logged, Form B, comparison

1. The **follow-up owner** is notified: "[Student] has 2 topics to go over. Follow-up due by [date]" (email if built, otherwise an in-app list **[plan]**; F7 allows either). The due date is 5 working days after the flag (Monday to Friday, public holidays not excluded; decision 11).
2. **M1 Flags → M2:** the owner sees the weak topics, the student's results (the R1 view), and links to the source documents for each weak topic.
3. The owner delivers the follow-up outside the app, for example in a conversation.
4. **M2:** for each weak topic, the owner enters the date of the follow-up (defaults to today) and a one-line note, then saves. The time from flag to follow-up is computed per topic. The note is not shown to the student (decision 9).
5. When **every** weak topic has a logged follow-up, Form B becomes available to the student automatically (decision 10). The student is notified (or told by the manager if there is no email). The retake is due 10 working days after the last follow-up date.
6. **Student, T1 → T3 (Form B)** → submit → **R1** for Form B, which links to **R2**.
7. **R2 comparison:** per topic, Form A and Form B side by side, with Form A's weak topics marked. The student, the manager and the admins all see this view.
8. Form B does not create new flags (F7 flags Form A only). Any second cycle is handled outside the app (PRD §8).

### Flow 4: Admin export and delete

1. **Bank owner or CPO, A6:** choose *Download CSV files*. They receive the five files described in section 5 under A6. A warning explains that the files contain personal data.
2. **Delete:** choose a person, and the app shows exactly what will be deleted (counts per data type) and what stays (anonymised question statistics and review outcomes). The admin types the person's name to confirm, and the data is deleted permanently. A1 records *Data deleted for [name] on [date] by [admin]*: a record that the deletion happened, not the deleted data.
3. The retention date (30 days after the 90-day review) is shown on A1 and A6 as a reminder. Deletion is not automatic (not a Must).

---

## 5. Screen specs

Conventions: "Admin" means bank owner or CPO. Every screen has a page title that matches its nav item. The UI is in English (decision 5). Dates are shown as "Tue 6 Oct" in the UI and in ISO format in exports. **Working days are Monday to Friday. Public holidays are not excluded in the pilot** (decision 11).

### S0 Sign-in and access states (F12)

- **Signed out:** company sign-in or a link-based sign-in **[plan]**. After signing in, the user returns to the page they requested.
- **Signed in, no role:** "You don't have access to the Onboarding Knowledge Check. If you think you should, contact [bank owner name, or 'the pilot team' if not assigned]."
- **Page outside your role** (for example a student opening another person's results): "This page isn't available to you." The response is the same whether or not the resource exists, so it reveals nothing.
- **Session expired mid-quiz:** see T3 error states.

### A1 Pilot overview (admin home)

Purpose: one page showing where the loop stands and what is blocking it.

**Section 1: Readiness** (shown until all items are done, then collapsed into one line, "Ready since [date]")
| Item | Done when | Action |
|---|---|---|
| Roles named | Student, follow-up owner, bank owner and reviewer are all assigned | *Assign roles* → A2 |
| AI provider set up | Configured **[plan]** | Text only: "Not set up. The provider must be approved before any material is sent (PRD Q2)." |
| Bank published | A version is published | *Go to bank* → A3 |
| HR sign-off recorded | The CPO has entered a date and a name | *Record sign-off* (CPO only): date, "Signed off by" (free text), Save |

**Section 2: Pilot loop.** One row per stage, each with a status and a date:
Bank published → Form A sent → Notice (Took part / Declined / Not yet) → Form A submitted (day 0) → Flags (N topics, or "none") → Follow-up (due date; *On time* / *Overdue by N working days* / *Done [date]*; or "Not needed" when there are no flags) → Form B available (due date) → Form B submitted → Comparison (link to R2).

Overdue states use a text label ("Overdue") plus an icon, not colour alone. The app does not escalate automatically (out of scope). The CPO chases by hand.

**Section 3: Key dates.** Day 0, day 90 (the review), and "Delete identifiable results by [day 90 + 30 days]".

**Section 4: Review quality (M3).** "Drafts reviewed: 40. Approved as is: 22. Edited (minor): 6. Edited (substantial): 5. Rejected: 7. **Rewrite rate: 30%** (kill line: more than 50%)." Above 50%, a text banner appears: "Rewrite rate is above 50%. This is kill signal K3 in the PRD. Consider `/checkpoint`." The banner is informational and blocks nothing.

**Primary action:** *Send Form A to [student]* (only when readiness is complete and Form A has not yet been sent). Afterwards the action reads *Copy Form A link again*.

**States**
- *Empty (first run):* the readiness checklist is expanded and the loop rows read "Not started".
- *Loading:* a skeleton of the sections. *Error:* "Couldn't load the pilot status. Reload the page." plus a *Reload* button.
- *Student deleted (after F11):* the loop rows read "Data deleted [date]".

### A2 People & roles (F12, §2, §7)

A list of the four roles. Each row shows the role name, a one-line description (taken from PRD §2), the assigned person (chosen from the company directory, or entered as name and email **[plan]**), and *Change*.

- The CPO appears as sponsor automatically (they have admin access).
- **Warnings** (shown as text, never blocking; decision 7): the reviewer is also the follow-up owner ("The PRD recommends a reviewer who isn't the manager. This person will see the student's named results as their manager."). The reviewer is also an admin ("This person will see named results through their admin access."). Either warning also notes: "The student notice will list this person once, under their other role."
- **Changing the follow-up owner** after a flag exists moves the open flag to the new owner. The old owner loses access to the student's results. A confirmation dialog explains this.
- **Unassigned roles:** the row reads "Not assigned. Required before Form A can be sent." Screens and messages that would name this person use the role label instead ("your manager").

### A3 Bank: material & topics (F1, F2)

Layout: one card per topic. Above the cards: *Add document* and the setting *Questions per topic per form* (a 3-5 selector, default 4 (decision 2), locked after publish).

Each topic card shows:
- Its documents (name, version date) with *Remove*. Removing a document does not delete drafts already made from it. They stay in review, and their source passage is kept.
- Draft status: "Not drafted" / "Drafting…" / "10 drafts: 6 approved, 1 rejected, 3 waiting for review" / an error.
- Actions: *Draft questions* (the first time), *Draft 5 more* (after that).
- A readiness line for publishing: "Needs 8 approved (4 per form). Has 6."

**Before drafting for the first time (once per bank):** a confirmation dialog: "Drafting sends the text of this topic's documents to [provider name] **[plan]**. Only onboarding material is sent. No names, answers or results are ever sent. Only continue if these documents are cleared for this provider." Buttons: *Continue*, *Cancel*.

**States**
- *Empty:* "No material yet. Add the onboarding documents you want the quiz to be based on. Only what you add here is used. Nothing is taken from the web." Button: *Add document*.
- *A topic with no documents* (if all its documents were removed): the topic card is removed. Its drafts stay in review.
- *AI provider not set up:* the drafting buttons are disabled, with the text "AI drafting isn't set up yet. The provider must be approved first."
- *Drafting in progress:* a per-topic status that the screen reader announces. "You can leave this page. Drafting continues."
- **AI drafting failed (the whole topic):** "Drafting failed for [topic]. [Short reason: service unavailable / timed out / document too long.] Nothing was saved." Button: *Try again*.
- **Partial or invalid output:** drafts with no answer, not exactly 4 options, or a source passage that cannot be found word for word in the uploaded text are discarded before review. The card shows: "2 drafts were discarded because they didn't quote your material correctly." Discarded drafts do not count towards M3 but are counted in the export (see A6).
- **All drafts for a topic rejected:** "All drafts for [topic] were rejected. Draft more, add clearer material, or leave this topic out of the version." The action *Leave this topic out* is on A4.
- *Short on approved questions:* the readiness line reads "Needs 8 approved. Has 5" and offers *Draft 5 more*.
- *After publish:* the whole page is read-only, with the banner "Version 1 was published on [date]. It stays unchanged for the whole pilot." (F13: no editing after publish; decision 4.)

### A3a Add document (dialog, F1)

Fields:
- **Source:** *Upload file* (PDF or .txt) or *Paste text*.
- **Name** (required). Pre-filled from the file name.
- **Version date** (required). The date of the material's own version, not today's date by default: "When was this material last updated?"
- **Topics** (required, one or more): pick existing topics or type a new one.

Validation and errors:
- "Add a name." / "Add the material's version date." / "Add at least one topic."
- *PDF with no extractable text:* "We couldn't read any text from this PDF. It may be a scanned image. Paste the text instead."
- *Unsupported file type:* "Only PDF and plain-text files can be added."
- *Too large* (limit set by **[plan]**): "This document is too long to use in one piece. Split it into smaller documents by topic."
- *Upload failed:* "Upload failed. Nothing was saved. Try again." All fields keep their values.

Helper text: "Add only your company's own onboarding material. Leave out anything that shouldn't appear in a quiz."

### A4 Publish version (F3, F4, F7)

Layout: a table with one row per topic. Columns: Topic, Approved questions, Form A, Form B, Included (a toggle, on by default).

- The app pre-splits each topic's approved questions evenly between A and B, using `min(per-form setting, floor(approved ÷ 2))` for each form. Extra approved questions stay unused and are listed as "Not used".
- Expanding a topic lists its questions under Form A, Form B and Not used, each with *Move to…*. Moving keeps the counts equal: a swap is offered if a move would unbalance them.
- **Flag threshold:** a number input, default 70%, with a live explanation per topic of what it means: "With 4 questions per topic: flagged if 2 or more are wrong (below 70%)." If a topic has only 3 per form: "flagged if 1 or more is wrong." Locked after publish.
- **Summary line:** "Form A: 20 questions across 5 topics. Form B: 20 questions across 5 topics. About 20 minutes each."
- **Publish** opens a confirmation: "Publish version 1? The questions, forms and threshold can't be changed after this, and this version is used for the whole pilot. Every attempt will be scored against exactly these questions." Buttons: *Publish*, *Cancel*.

Rules and states:
- *Blocked:* "Publish" is disabled while any included topic has fewer than 3 questions per form, or any draft is still waiting for review. The reason is listed per topic: "[Topic]: 5 approved. Needs at least 6 (3 per form)." / "3 drafts are still waiting for review."
- *Minimum 3 per form* matches the bottom of the PRD's 3-5 range. Topics below the minimum must be excluded or topped up (see P4). Topics that reach the minimum but not the default of 4 are published at their lower count, and the threshold line shows what that means for them.
- *No topics included:* "Include at least one topic."
- *Already published:* the page is read-only and shows the published forms.
- **Scope:** the pilot has **exactly one published version**, and the onboarding material and bank are frozen for the 90 days (decision 4). The data records the version, but the pilot has no "New version" action. If the company's own material changes during the pilot, the bank is not updated. Any question the change makes wrong is handled in the export analysis (decision 3).

### A5 Send Form A (dialog on A1; F5, C6, §6 gate)

"Send Form A to [student name]? They'll first see the notice explaining what the check is for and that taking part is voluntary."

- If the app sends messages: a preview of the message (see §7.3), then *Send*.
- If not **[plan]**: "Copy this link and send it to [student] the way you normally would:" [link] *Copy link*. After copying, *Mark as sent*.
- Available only when readiness on A1 is complete. If it is not, the A1 button is replaced with "Complete the readiness checklist to send Form A."
- *Send failed:* "The message couldn't be sent. Copy the link instead:" [link].

### A6 Data: export & delete (F10, F11, §6)

**Export.** Button: *Download CSV files*. The download contains five CSVs, all in ISO dates and UTF-8:
1. `attempts`: person, version, form, submitted at, overall score, per-topic scores.
2. `answers`: attempt, question ID, topic, chosen option, correct option, correct (yes/no).
3. `flags_followups`: flag ID, attempt, topic, flag score, flagged at, follow-up owner, follow-up date, note, logged at, working days from flag to follow-up, within SLA (yes/no).
4. `review_outcomes`: question ID, topic, outcome (approved as is / edited minor / edited substantial / rejected / discarded invalid), reason, reviewer, reviewed at, used in (Form A / Form B / not used).
5. `participation`: person, notice version, choice, recorded at.

The `answers` file carries question IDs, so a question confirmed wrong after publish can be taken out of that topic's score in the analysis (decision 3). The app itself does not rescore.

Warning shown next to the button: "These files contain personal data about [student]. Keep them only where HR has agreed, and delete them by [retention date]."

States: *Nothing to export yet* shows "Nothing to export yet" and disables the button. *Export failed* shows "The export couldn't be created. Try again."

**Delete a person's data.** Choose a person (the list shows anyone with attempts, flags or a participation record). The panel then shows:
"This permanently deletes for [name]: 2 attempts, 40 answers, 1 flag, 2 follow-up entries, 1 participation record. It keeps: anonymised question statistics and review outcomes (these contain no names). It can't be undone. Files that have already been exported are not affected. Delete those separately."
Confirmation: type the person's full name, then *Delete permanently*.
- *Success:* "Data for [name] was deleted." A1 then shows the deletion record.
- *Failed:* "Nothing was deleted. Try again." (All-or-nothing: no partial deletes.)
- *Name mismatch:* the button stays disabled.

A reminder line on the page: "Retention: identifiable results must be deleted by [day 90 + 30]."

### V1 Review queue (F2, F3)

A list grouped by topic. Filters: *Waiting* (default), *Approved*, *Edited*, *Rejected*. Each row shows the start of the question, its topic, and its status. The header reads "12 waiting · 28 reviewed". The primary action is *Start reviewing*, which opens V2 at the first waiting question.

The **reviewer checklist** (PRD §5) is shown in a side panel and stays visible on V1 and V2:
1. Correct according to the source *and* current practice.
2. Exactly one defensible correct answer.
3. The wrong options are clearly wrong but plausible.
4. Tests understanding, not trivia or wording.
5. No confidential detail that shouldn't appear in a quiz.

States:
- *Empty (nothing drafted yet):* "No questions to review yet. You'll be notified when drafts are ready."
- *All reviewed:* "All caught up. [Bank owner] can now publish, or may draft more questions."
- *After publish:* read-only, with "Version 1 is published. Reviews are closed."

### V2 Review a question (F2, F3, §5)

Layout: two columns on wide screens and stacked on narrow ones, with the source first.
- **Left: Source.** Document name, version date, and the quoted passage with about two paragraphs of context around it. The passage is highlighted with a background colour **and** marked with a left border and the label "Quoted passage", so colour is not the only cue.
- **Right: Draft question.** Topic, question text, and options A-D with the correct option marked by a text label, "Correct answer", plus an icon.

Actions (keyboard shortcuts shown on the buttons):
- **Approve** (A): saves the outcome "approved as is" and moves to the next question.
- **Edit** (E): the question text, options and correct-answer choice become editable. *Save and approve* then asks one required question: "What kind of change was this?" ○ *Minor: wording or typo, same meaning* ○ *Substantial: changed the answer, an option or what's being tested*. This gives the "substantially edited" figure for M3. It is the reviewer's own judgement, not a computed diff.
- **Reject** (R): optional reason chips that map to the checklist (*Incorrect or outdated*, *More than one right answer*, *Weak wrong options*, *Trivia or wording*, *Confidential*, *Wrong topic*, *Other*), plus an optional short text. *Reject* confirms.
- *Previous* and *Next*. *Undo* is available on any reviewed question until publish.

Validation when editing: the question text is required, all 4 options are required and must be distinct, and exactly one option must be correct. Errors are shown inline and in a summary at the top.

States:
- *Loading:* a skeleton layout.
- *Saving failed:* "Your decision wasn't saved. Try again." The decision stays selected.
- *Source document removed after drafting:* the passage is still shown (it was stored with the draft), with the note "The source document has since been removed from the bank."
- *Someone else changed this question* (unlikely at n=1): "This question was updated by [name]. Reload to see the latest version."

### V3 Question statistics (anonymised; §6, M3)

- **Review outcomes** (always shown): the same M3 figures as on A1, broken down by topic.
- **Answer statistics per question** (percent correct, and how often each option was chosen) are shown only for questions that at least 5 different people have answered (decision 1). Below that: "Not shown: fewer than 5 people have answered this question. Showing it would identify them." In the n=1 pilot this message appears for every question.
- No names, attempt dates or per-person data appear on this screen, for any role.

### T1 Student home ("My checks"; F5, F9)

One card per form, showing the next action only.

| State | Card copy | Action |
|---|---|---|
| Nothing sent yet | "Nothing to do yet. You'll get a link when your knowledge check is ready." | - |
| Notice not answered | "Your onboarding knowledge check is ready. First, a short note on what it's for." | *Read and start* → T2 |
| Declined | "You chose not to take part. That's completely fine and has no consequences. If you change your mind, you can still take part." | *I'd like to take part* → T2 |
| Form A available | "Knowledge check 1 of 2 · [N] questions · about [N] minutes · no time limit" | *Start* → T3 |
| Form A done, follow-up pending | "Check 1 done on [date]. [Manager] will go over [topics] with you by [due date]. After that, check 2 opens here." | *See your results* → R1 |
| Form A done, no weak topics | "Check 1 done on [date]. No topics need a follow-up. Check 2 is open now if you'd like to take it. Please take it by [due date]." | *Start* → T3; *See your results* → R1 |
| Form B available | "Knowledge check 2 of 2 · same topics, different questions · please take it by [due date]" | *Start* → T3; *Check 1 results* → R1 |
| Both done | "Both checks done. See how your topics compare." | *Compare* → R2 |

The student's view of a follow-up shows only the topics, the due date and "done [date]". It never shows the manager's note (decision 9).

*Loading* shows a skeleton. *Error* shows "Couldn't load your checks. Reload the page."

### T2 Notice & participation (§6)

Full page, with no nav distractions. The text is in §7.1. Two buttons of equal visual weight: **Take part** and **I'd rather not**. The choice, its time and the notice version are stored.

- The notice is readable again at any time from the T1 footer ("What this check is for").
- *Choice not saved:* "Your choice wasn't saved. Please try again." No quiz is shown until the choice is saved.
- **HR-approved text is a go-live dependency.** §7.1 is a draft for HR. The app shows the approved version and records which version the student saw.

### T3 Quiz (F4, F5)

- **Header:** "Knowledge check 1 of 2" (or 2 of 2). "[N] questions · no time limit · you'll see the correct answers right after you submit."
- **Body:** all questions on one page, grouped under topic headings. Each question is a radio group (fieldset and legend) with exactly 4 options. There is no "I don't know" option (decision 12). The progress count is sticky: "12 of 20 answered".
- **Helper line:** "Not sure? Pick your best guess. It helps show where more support would be useful."
- **Submit area at the end:** "You can submit once. Answers can't be changed afterwards." Button: **Submit answers**. If questions are unanswered, pressing it shows a summary instead of submitting: "3 questions still need an answer:" with links to each one. There is no separate confirmation dialog, to keep the step count at Forms parity (C6).
- **Leaving the page with answers selected:** the browser's "You have unsaved answers. Leave anyway?" prompt. Nothing is stored until submission. If the student leaves, the form stays available and they start again. *Tradeoff: saving progress is not a Must, and the quiz takes about 20 minutes.*
- *Session expired on submit:* the answers are kept in the page. "You were signed out. Sign in again to submit. Your answers are kept on this page." After signing in, submission continues **[plan]**.
- *Submit failed (network or server):* "Your answers weren't submitted. Check your connection and try again." The answers stay selected.
- *Already submitted* (link reopened): redirect to R1 with "You've already submitted this check."
- *Form not available yet* (for example Form B before follow-up): "Check 2 opens after your follow-up with [manager]." → T1.
- Option order is fixed as published. It is not shuffled per attempt (consistency, F4).

### R1 Results for one attempt (shared view; F5, F6, F7)

The same layout for the student, their follow-up owner and the admins. Only the heading changes: "Your results" for the student, "[Student]'s results" for everyone else.

- **Intro (student):** "These results are for your development, not an evaluation. They show where more onboarding support would help."
- **Per-topic table** (the main content): Topic | Correct | Status.
  - "Process X | 3 of 4 (75%) | ✓ Looks solid"
  - "Tool Y | 1 of 4 (25%) | ◆ To go over with [manager]"
  Status is shown as text plus an icon, never colour alone. The word "fail" is never used.
- If there are weak topics (Form A): "[Manager] will get in touch by [due date] to go over these topics with you."
- **Overall score:** not shown to the student or the manager. It is stored and exported (F6) and visible to admins on A1 and in the export (see D3).
- **Answers:** grouped by topic and expanded by default for weak topics. For each question: the question text, "Your answer: B …", "Correct answer: C …" (text labels plus icons), and "From: [document name]".
- **Footer:** "Think a question is wrong? Mention it in your debrief. The reviewer will check it." Reporting a wrong question is not built in-app (PRD §5 says in-app only if cheap, and it is not a Must). A confirmed wrong question does not change the scores shown here. It is corrected in the export analysis (decision 3).
- *For the manager and admins:* a link to M2 for this attempt's flag, if one exists.
- *Error:* "Couldn't load these results. Reload the page." *Deleted:* "These results have been deleted."

### R2 Form A vs. Form B comparison (shared view; F9)

- **Table:** Topic | Check 1 | Check 2 | Change | Followed up.
  - "Tool Y | 1 of 4 (25%) | 3 of 4 (75%) | +2 | ◆ Yes, [date]"
- The change is shown as a signed count of questions ("+2", "−1", "no change"), with no arrows or colour-only cues.
- **Note under the table** (always shown): "Check 1 and check 2 use different questions on the same topics, so part of any change can come from the questions themselves. With 4 questions per topic, one question moves a topic's result by 25 points."
- *Only Form A done:* "Check 2 isn't done yet." → back.
- Same audience as R1.

### M1 Flags (follow-up owner home; F7, F8)

A list with one row per flag: student name, number of weak topics, flagged date, due date, status (*Due in 3 working days* / *Overdue by 2 working days* / *Done [date]*).

- *Empty:* "No flags. When [student] scores below [70%] on a topic in check 1, it will show up here."
- *Student declined or not started:* "[Student] hasn't taken check 1 yet." The same text is used in both cases, so declining is not revealed (decision 6).
- If email is not built **[plan]**, this list is the notification, so the nav item shows a count badge: "Flags (1)".

### M2 Flag detail & follow-up log (F7, F8)

- **Header:** "[Student] · check 1 on [date] · follow-up due by [date] (5 working days)".
- **Weak topics:** each with its score ("1 of 4") and links to the source documents for that topic (open read-only). There is a link to the full results (R1).
- **Log form, one row per weak topic:**
  - *Follow-up date* (defaults to today; cannot be in the future or before the flag date).
  - *What was done* (one line, required, maximum 200 characters). Placeholder: "e.g. 30-min walkthrough of the returns process". Helper: "Describe the follow-up, not the person. Only you and the pilot team see this note. [Student] sees that the follow-up was done, not the note." (decision 9)
  - *Save*.
- **After saving all topics:** "Follow-up logged. Check 2 is now open for [student] and is due by [date]. [If there is no email: Let them know it's ready.]" (decision 10)
- Log entries can be edited until Form B is submitted. The original "logged at" time is kept.
- *Validation:* "Add the date of the follow-up." / "Add a short note about what was done." / "The date can't be before the flag ([date])."
- *Save failed:* "Not saved. Try again." The entered values are kept.
- *Overdue:* the header adds "Overdue by N working days". Logging is still allowed, and the delay is recorded.

---

## 6. Notifications

The PRD allows email (preferred) or an in-app list (F7). No reminders or escalation (F13, §8). If `/plan` does not build email, each "send" below becomes an in-app badge plus a manual message from the named person. All messages are in English (decision 5).

| Trigger | To | Content |
|---|---|---|
| Drafts ready | Reviewer | "[N] questions for [topics] are ready for review." Link to V1 |
| Form A sent | Student | See §7.3 |
| Flag created | Follow-up owner | "[Student] finished knowledge check 1. [N] topics scored below [70%]: [topics]. Please go over them and log what you did by [date] (5 working days)." Link to M2 |
| Follow-up fully logged | Student | "Knowledge check 2 is ready. Same topics, different questions. Please take it by [date]." Link to T1 |
| Form A submitted with no weak topics | Student | Not sent. The student lands on R1, and T1 shows that check 2 is open (E7) |
| Form B submitted | Follow-up owner, bank owner | "[Student] finished knowledge check 2. See the comparison." Link to R2 |

Messages contain no scores (only topic names), so a forwarded email reveals little. No message is sent to anyone when the student declines (decision 6).

---

## 7. Key copy

All copy is in English (decision 5).

### 7.1 Student notice (T2): draft for HR approval

> **Before you start: what this knowledge check is for**
>
> **It's for your development, not an evaluation.** This short quiz shows which parts of your onboarding are clear and where more support would help. It is **not** used for performance reviews, probation, pay or contract decisions.
>
> **Taking part is voluntary.** You can say no, and that has no consequences for you. If you say no, only [bank owner name] and [CPO name], who run this pilot, will know. Your manager won't be told.
>
> **What happens:**
> 1. You answer about [N] multiple-choice questions on [topics]. It takes about [N] minutes, with no time limit.
> 2. You see your results and the correct answers straight away.
> 3. If a topic scores below [70%], [manager name / your manager] will go over it with you within 5 working days.
> 4. After that, you take a second check on the same topics with different questions, and you can see how the two compare.
>
> **Who sees your results:** you; [manager name / your manager]; [bank owner name] and [CPO name], who run this pilot. [Reviewer name], who checks the questions, doesn't see your name or your answers.
>
> **What we keep:** your name, your answers and scores, and short notes from your manager on the follow-up. No written assessment of you.
>
> **For how long:** until [date], which is 30 days after the pilot review. Then it is deleted.
>
> **AI:** the questions were drafted by an AI tool from our onboarding documents and then checked by a person. The AI tool never sees your name or your answers.
>
> **Questions, or want your data deleted?** Contact [name / HR contact].
>
> [ Take part ]  [ I'd rather not ]

Rules for filling the placeholders:
- Placeholders for unnamed roles fall back to role labels.
- **Role overlap (decision 7):** if the reviewer is also the manager or an admin, drop the sentence "[Reviewer name], who checks the questions, doesn't see your name or your answers." That person is already listed under their other role, and the sentence would be false.
- The notice cannot be finalised until HR signs off and the names are known (section 12.3).

### 7.2 Framing rules (for every student- and manager-facing string)

| Use | Avoid |
|---|---|
| "knowledge check", "check 1 / check 2" | "test", "exam", "assessment" |
| "3 of 4", "to go over with [manager]", "looks solid" | "fail", "pass", "grade", "score: 45%" as a headline |
| "topics where more support would help" | "weaknesses", "gaps in your performance" |
| "follow-up" | "remediation", "intervention" |
| "results" | "performance" |

The internal UI (A-, V- and M-screens) may use "flag" and "threshold". The student never sees the word "flag".

### 7.3 Form A message to the student

> Subject: Your onboarding knowledge check
>
> Hi [first name], as part of your onboarding we're trying out a short knowledge check ([N] questions, about [N] minutes). It's for your development, not an evaluation, and taking part is voluntary. The link explains what it's for and who sees what before you start: [link]. Questions? Ask [bank owner name].

---

## 8. Cross-cutting edge cases

| # | Case | Handling |
|---|---|---|
| E1 | A role is not yet named | The readiness item stays open, *Send Form A* is disabled, and copy falls back to role labels (A1, A2) |
| E2 | The AI provider is not approved or configured | Drafting is disabled with a reason (A3). Everything else, including uploading material, still works |
| E3 | HR sign-off is not recorded | *Send Form A* is disabled (A1). No student result can be collected (§6 gate) |
| E4 | Drafting fails, or returns ungrounded or malformed output | Per-topic error and retry. Invalid drafts are discarded and counted (A3) |
| E5 | All drafts for a topic are rejected | Draft more, add material, or leave the topic out of the version (A3, A4) |
| E6 | Rewrite rate above 50% | Informational K3 banner on A1 (not blocking) |
| E7 | **No topic below the threshold on Form A** | Valid pilot data (decision 8). No flag is created. A1 shows "Flags: none" and "Follow-up: not needed". T1 shows "No topics need a follow-up" and opens Form B straight away as an optional second check, due within 10 working days. The flag-and-follow-up path is then not exercised in the pilot |
| E8 | The student declines | Recorded. Admins see it on A1. The manager is not told, and M1 shows the same "hasn't taken check 1 yet" text as for a student who has not started (decision 6). The student can change their mind from T1 |
| E9 | The student abandons the quiz midway | Nothing is stored. The form stays available (T3) |
| E10 | The follow-up is overdue | "Overdue" label on M1, M2 and A1. Logging is still allowed, and the delay is recorded. No escalation |
| E11 | Form B is not taken within 10 working days | "Overdue" on A1 and T1. No escalation |
| E12 | The follow-up owner changes mid-pilot | The open flag transfers, and the old owner loses access (A2) |
| E13 | The student reports a wrong question (in the debrief) | Handled outside the app. The published version is read-only. If the reviewer confirms the question is wrong, it is removed from that topic's score in the export analysis, not in the app (decision 3) |
| E14 | The company's onboarding material changes mid-pilot | The bank stays frozen on version 1 for the 90 days (decision 4). Questions made wrong by the change are handled as E13 |
| E15 | A person's data is deleted | All-or-nothing delete. Shared views show "deleted" states. Exported files are not affected (warning on A6) |
| E16 | The student leaves the company mid-pilot | The same as E15 on request. There is no special state |
| E17 | A due date falls on a public holiday | Not adjusted (decision 11). The overdue label may appear a day early. The CPO judges this by hand |

---

## 9. Accessibility basics

Target WCAG 2.2 AA for all screens, and especially for T2, T3 and R1, which a newly joined student may use on an unfamiliar setup.

- **Keyboard:** everything reachable and operable with the keyboard, with a visible focus indicator and a logical order. Radio groups use arrow keys. The review shortcuts (A/E/R) only fire when focus is not in a text field, and are also shown as buttons.
- **Semantics:** each question is a `fieldset` with a `legend`. Results are real tables with header cells. Every page has a unique title and a single H1.
- **Never colour alone:** correct/incorrect, weak/solid, overdue and the highlighted source passage each use text labels plus icons or borders.
- **Contrast:** 4.5:1 for text and 3:1 for UI components and focus indicators.
- **Status messages:** drafting progress, save results and form errors are announced to screen readers (live regions). Form errors appear inline and in a summary at the top that links to each field.
- **No time limits** on the quiz or the notice. Sessions warn before expiring and do not lose answers (T3).
- **Zoom and reflow:** usable at 200% zoom and at 320 px width without horizontal scrolling for T1-T3, R1, R2 and M2. The admin and review screens target desktop widths but must not break at narrow widths.
- **Plain language:** short sentences on student screens, and no jargon ("flag", "threshold", "version") in student copy.
- **Language:** the whole UI, the notice, the messages and the drafted questions are in English (decision 5). Pages declare English as their language so screen readers pronounce them correctly.

---

## 10. UX tradeoffs, simplifications and cuts

| Decision | Why | Cost |
|---|---|---|
| **D1: One results view (R1/R2) shared by the student, manager and admins** | One thing to build, and it makes "your manager sees exactly this" true and easy to explain | The manager sees per-question answers. This is allowed by F12 ("their student's results"), and it helps target the follow-up |
| **D2: Reviewer checklist shown as a reference, not ticked per question** | Five ticks × about 50 drafts is about 250 extra clicks against the effort metric M4. Approving means "meets the checklist" | Less audit evidence per question |
| **D3: No overall score shown to the student or the manager** | An overall percentage reads as a grade. Per-topic results are what drive follow-up | The overall score is still computed, stored and exported (F5, F6). Admins see it on A1 |
| **D4: "Minor or substantial" asked by the reviewer on each edit** | M3 needs "substantially edited". The reviewer's judgement is more accurate than an automatic diff and costs one click per edit | A subjective label |
| **D5: All questions on one page, no saved progress** | Simplest quiz. Takes about 20 minutes, with no timer | Closing the tab loses unsubmitted answers (with a warning) |
| **D6: No submit confirmation dialog** | Keeps the student's steps at Forms parity (C6). The submit area states that answers are final | A slightly higher risk of accidental submission, which is mitigated by requiring every question to be answered |
| **D7: Form B unlocks automatically once all follow-ups are logged** (decision 10) | Removes a handoff step. F9 only requires that the follow-up comes first | No one decides the timing. The manager can still tell the student when to take it |
| **D8: One flag per attempt, one log entry per weak topic** | One notification to the manager, and M1 ("all flagged topics followed up") can be measured per topic | Slightly more to type if there are several weak topics |
| **D9: Drafting count fixed at 2 × per-form + 2, with "Draft 5 more"** | No tuning UI. The top-up covers heavy rejection | May over-draft slightly |
| **D10: A single published version, frozen for the 90-day pilot** (decision 4) | PRD §8 (one version). F13 (no editing after publish). Keeps Form A and Form B comparable | Real material changes during the pilot are not reflected. Affected questions are corrected in the analysis (decision 3) |
| **D11: Declining is visible to admins, not to the manager** (decision 6) | Protects "no consequences" at n=1, where the manager is also the evaluator | The manager may wonder why no check happened. Admins tell them in general terms |
| **D12: HR sign-off recorded in the app (date and name)** | Makes the §6 gate enforceable by blocking *Send Form A*. It is one small form | Slightly beyond F1-F12, but traces to §6's gate. The CPO can cut it and enforce the gate by hand |
| **D13: A readiness checklist on A1** | Makes the open items (names, AI provider, HR) visible states rather than assumptions. It is the admin home, which is needed anyway | None significant |
| **D14: Wrong questions corrected in the analysis, not in the app** (decision 3) | No rescoring feature, and the published version stays read-only | Scores shown in R1/R2 are not corrected. The debrief and the 90-day analysis must use the corrected export |

**Cut or deliberately not designed:** in-app "question is wrong" reporting (PRD §5 "if cheap", not a Must); an admin "exclude question from scoring" action (decision 3); question shuffling; an "I don't know" option (decision 12); save-and-resume; reminders or escalation; a reviewer's own question authoring; editing or versioning after publish (decision 4); a holiday calendar (decision 11); languages other than English (decision 5); charts; any cross-person view; mobile-specific design beyond basic reflow; any in-app surface for error tagging, the effort log, the follow-up itself or the debrief (these stay outside the app per PRD §4).

---

## 11. Where this spec pushed back on the PRD or found gaps

| # | PRD item | Issue | Resolution |
|---|---|---|---|
| P1 | F12 vs. §6 | F12 gave the reviewer "full" access. §6 says statistics only, no names | Four access levels: student, follow-up owner, reviewer, admin (§2.3). The PM is amending F12 to match |
| P2 | §6 "anonymised statistics" | Not anonymous at n=1 | Answer statistics hidden until 5 people have answered. None shown in the pilot (decision 1) |
| P3 | F7 threshold and F4 size | At 3 questions per topic, 70% means **one wrong answer flags the topic**. At 4, two wrong. At 5, two wrong. The threshold is effectively a question count, and one lucky guess (a 25% chance per question) can hide a gap | Default 4 per topic per form, so a topic is flagged at 2 or more wrong (decision 2). A4 shows the threshold as a question count |
| P4 | F4 "3-5 per topic" | Is 3 a minimum, and what happens to a topic with too few approved questions? | Minimum 3 per form. Topics below it are topped up or excluded |
| P5 | F4 two forms | No rule on who splits A/B or how they are balanced. The forms are not difficulty-matched, so at n=1 part of any A→B change is a form effect | Auto-split with manual moves. A caveat is shown on R2. This weakens M2, and the CPO should know |
| P6 | F7/F8 "each flag" | Is a flag per topic or per attempt? | One flag per attempt, one log per topic (D8) |
| P7 | F9 "can be assigned" | Who assigns Form B? | Automatic unlock (D7, decision 10) |
| P8 | F7/F9 | What happens if nothing is flagged? The loop cannot be tested | Valid data. Form B still offered (E7, decision 8) |
| P9 | §5 "confirmed wrong question is removed from that topic's score" | Not in any F-requirement, and it conflicts with the read-only version | Done in the export analysis, not in the app (decision 3). The PM is amending the PRD to match |
| P10 | §5 / F4 "updates publish a new version" vs. §8 "one version" | Contradictory for the pilot | One version, frozen for 90 days (decision 4). The PM is amending the PRD to match |
| P11 | §6 gate | HR sign-off has no enforcement point | D12. The CPO may cut it |
| P12 | §6 notice | Voluntary participation needs a decline path, and it is unspecified who learns of a decline | Admins only; the manager is not told (D11, decision 6) |

---

## 12. Decisions (CPO, 2026-09-29)

### 12.1 Decided by the CPO

| # | Question | Decision | Where it applies |
|---|---|---|---|
| 1 | Reviewer answer statistics at n=1 (P2) | Answer statistics are hidden until at least 5 different people have answered a question. The reviewer sees none during the n=1 pilot, only review-outcome statistics. The notice keeps saying the reviewer doesn't see the student's name or answers | §2.2, §2.3, V3 |
| 2 | Questions per topic (P3) | Default 4 per topic per form. At the 70% threshold, a topic is flagged at 2 or more wrong. The 3-5 selector stays (F4), with 3 as the minimum | Flow 1, A3, A4, R2 note |
| 3 | A confirmed wrong question (P9) | Handled in the export analysis, not in the app. No rescoring or "exclude question" action. Scores shown in the app are not changed | A4 scope, A6, R1 footer, E13, E14, D14 |
| 4 | Material changes mid-pilot (P10) | The onboarding material and the bank are frozen for the 90-day pilot, with one published version | Flow 1 step 8, A3, A4, E14, D10 |
| 5 | App language | English: the UI, the notice, the messages and the AI-drafted questions | Flow 1 step 2, §5 conventions, §6, §7, §9 |
| 6 | Telling the manager about a decline (D11) | The manager is not told. Only the admins (bank owner and CPO) see it. The notice says so | Flow 2, §2.2, §6, §7.1, M1, E8 |

### 12.2 Designed defaults, accepted by the CPO

| # | Question | Decision | Where it applies |
|---|---|---|---|
| 7 | Reviewer who is also the manager or an admin | A warning on A2, not a blocker. At n=1 the overlap may be unavoidable. The notice drops the "reviewer doesn't see your answers" sentence in that case | §2.3, A2, §7.1 |
| 8 | Nothing flagged on Form A | Valid pilot data. No flag, and Form B still opens as an optional second check. The flag-and-follow-up path is then not exercised. Whether that calls for `/checkpoint` is for the CPO to judge at the 90-day review. There is no extra app behaviour | Flow 2 step 7, A1, T1, §6, E7 |
| 9 | The student seeing follow-up notes | No. The student sees the topics, the due date and "done [date]". The note is visible to the follow-up owner and the admins only, and M2 says so | §2.2, Flow 3, T1, M2 |
| 10 | Form B unlock | Automatic once every weak topic has a logged follow-up | Flow 3 step 5, M2, D7 |
| 11 | Working days and public holidays | Monday to Friday. Public holidays are not excluded. No holiday calendar | Flow 3, §5 conventions, E17 |
| 12 | An "I don't know" option | Not included. Every question has exactly 4 options (F2). The guessing effect is noted in the M2 analysis | T3, §10 cuts |

### 12.3 Still open (carried from the PRD; the design handles them as states)

- **Named people for each role** (PRD Q1). None are named yet. PRD §7 makes this a `/checkpoint` trigger if they are not named before `/design` completes. Handled by A1 readiness, A2, and role-label fallbacks in copy (E1).
- **The AI provider** (PRD Q2). Handled by the "AI provider set up" readiness item and disabled drafting (E2).
- **HR sign-off, with the final notice text** (§6). §7.1 is a draft for HR, including the decline sentence (decision 6). Handled by the "HR sign-off recorded" readiness item, which blocks *Send Form A* (E3).

---

## 13. Handoff notes for `/plan`

Decisions deliberately left to `/plan`: the sign-in method (it must keep the student's path at Forms parity, with no account creation), email vs. in-app-only notifications, the AI provider and how the "AI provider set up" state is detected, file size limits, the PDF text extraction approach, how quoted passages are checked word for word against the source, and how the CSV download is packaged.

Requirements on `/plan` that come from this design: draft content and published forms must never be reachable through a student-facing route. Access checks are needed on the server, per person and per role (four levels). The reviewer's answer statistics must be suppressed on the server below 5 distinct people, not just hidden in the UI. The follow-up note must never be returned to the student. The notice version and choice must be stored. Deletion must be all-or-nothing. Unsubmitted quiz answers must survive a sign-in expiry. The AI must be instructed to draft in English. Working-day calculations count Monday to Friday only, without a holiday calendar.

---

**Post-approval changes:** 2026-09-29, CPO decision 5 at `/plan`: A6 no longer says it keeps "anonymised question statistics". The delete panel now says it keeps "review outcomes (these contain no names)", because at n=1 answer statistics identify the student. V3 computes them live, so they are deleted with the person.
