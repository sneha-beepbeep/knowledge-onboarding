# Onboarding Knowledge Check

A small internal web app that checks what a new working student has picked up from the company's onboarding material. The student takes a short multiple-choice check. Any topic that scores low goes to their manager for a follow-up conversation, and a second check afterwards shows whether the follow-up helped.

It is for development only. Results are never used for performance reviews, probation, pay or contract decisions.

**Round 1** is a 90-day pilot with one working student. It tests whether the check, the follow-up and the retake work together in practice. With a single participant it cannot show whether errors fall across the company, and it doesn't claim to.

## Who uses it

| Role (as shown in the app) | Who | What they do |
|---|---|---|
| **Pilot sponsor (CPO)** | The person running the pilot | Sets the app up, names everyone's role, records HR's sign-off, and chairs the review at the end of the pilot |
| **Bank owner** | A member of the product team | Writes the questions, loads them, publishes the question set, and sends the first check |
| **Content reviewer** | A subject-matter expert from the student's team | Checks every question before anyone sees it. Must be a different person from the bank owner |
| **Follow-up owner** | The student's manager | Goes over any low-scoring topic with the student and records that it happened |
| **Student** | The new working student | Takes the first check and the retake |

The pilot sponsor and the bank owner are the two admins.

## Signing in

There are no accounts or passwords. Everyone signs in with a personal link.

- An admin creates your link and sends it to you privately, for example in person or by direct message. Links for the bank owner and the pilot sponsor can only come from the pilot sponsor.
- **Open the link on the device you'll use.** It signs you in, and you stay signed in there while you keep using the app.
- An unused link expires after **14 days**.
- **Treat the link like a key.** Don't forward it. Anyone who opens it is signed in as you.
- If a link is lost, forwarded, or stops working, ask an admin for a new one. **A new link replaces the old one and signs out anywhere the old one was used.**
- If you see "You're signed out", open your link again. If that link no longer works, ask for a new one.
- **Sign out** is in the menu.

There are no emails. Waiting work shows as a count in the menu, for example **Review (3)** or **Flags (1)**.

## How the pilot runs, step by step

### 1. Setup (pilot sponsor)
1. Sign in once at `/setup` with the set-up code from whoever deployed the app. This makes you the pilot sponsor. The page stops working after that.
2. On **People & roles** (linked from **Pilot**), name the bank owner, content reviewer, follow-up owner and student.
   - Pick existing people with **Someone already in the app**.
   - The bank owner and the content reviewer must be different people.
   - **The follow-up owner should be neither you nor the bank owner.** Otherwise the manager would see a decline that the notice promises they won't be told about.
3. Create sign-in links for the bank owner and the content reviewer, and send them privately.

### 2. Writing and loading questions (bank owner)
1. Write the questions in a JSON file, following the guide in [`scripts/import/README.md`](scripts/import/README.md).
   - Each question has four options, one correct answer, and an **exact quote** from the onboarding document it is based on.
   - Aim for at least **8 approved questions per topic**, plus a few spares in case some are rejected.
2. Check the file before loading it. A check run writes nothing and lists every problem in plain language.
3. Load the file. Loading is all or nothing: if anything is wrong, nothing is loaded. Every loaded question waits for the content reviewer.
4. Log the hours you spend writing questions. The pilot review needs them.

### 3. Reviewing (content reviewer)
1. Open **Review**. Each question is shown next to the source passage it came from.
2. For each one, choose **Approve**, **Edit** (then save and say whether the change was minor or substantial), or **Reject** (the reason is optional). Keyboard shortcuts: A, E, R.
3. You can undo a decision until the question set is published.
4. You never see the student's name or answers.

### 4. Publishing (bank owner)
1. Once every question has been reviewed, open **Publish version**. The app splits the approved questions into **Form A** (the first check) and **Form B** (the retake): 4 questions per topic on each form, with no question on both.
2. Check the split, check the score threshold (70% by default), then publish.
3. **Publishing is final.** The questions, both forms and the threshold are fixed for the whole pilot.

### 5. HR sign-off (pilot sponsor)
HR approves the student notice outside the app. The pilot sponsor then opens **Pilot** and uses **Record sign-off** to enter the date and the name of the person who signed off. Until that is done, the first check can't be sent.

### 6. Sending the first check (bank owner)
1. On **Pilot**, the **Readiness** list shows what is still missing. **Send Form A** stays locked until roles are named, the question set is published, and HR's sign-off is recorded.
2. Choose **Send Form A to [student]**, copy the link, and send it to the student privately.
3. **Then press Mark as sent.** Until you do, the student only sees "Nothing to do yet".
4. If you need the link again, use **Copy Form A link again**. This creates a new link, so it signs out any device where the student already used the old one.

### 7. What the student experiences
1. The student opens their link and first sees a short notice: what the check is for, that taking part is voluntary, who sees the results, what is kept and for how long.
2. They choose **Take part** or **I'd rather not**.
   - Saying no has no consequences, and the manager isn't told. Only the bank owner and the pilot sponsor know.
   - The student can change their mind later.
3. **Knowledge check 1 of 2:** about one question per minute, with no time limit. Nothing is saved until they press **Submit**. If they leave halfway through, they start again.
4. Straight afterwards, they see a score for each topic and the correct answers. There is no overall score.
5. After the follow-up (or straight away, if no topic was below the threshold), **Knowledge check 2 of 2** opens. It covers the same topics with different questions. The student can then compare the two checks side by side.

### 8. Follow-up (follow-up owner)
1. If any topic scores below the threshold on the first check, a flag appears under **Flags**, listing the weak topics. You can read the source documents from the flag.
2. Go over those topics with the student **within 5 working days**. Working days are Monday to Friday, with no holiday calendar, in company time (GMT+2 all year).
3. Record the **Follow-up date** and a short note (up to 200 characters) under **What was done**. The student never sees the note.
4. Recording the follow-up unlocks the student's second check. The log closes once the second check is submitted.

### 9. At the end of the pilot (pilot sponsor and bank owner)
- **Data → Export** downloads a zip of 5 spreadsheet files (CSV) for the review. Dates are in company time; exact timestamps are in UTC. The files contain the student's personal data, so store them where HR has agreed.
- **Data → Delete a person's data** removes everything about one person in one step, after you type their full name to confirm. It can't be undone. Review outcomes, which contain no names, are kept.

## AI in round 1: off

Round 1 uses **no AI**. A person writes the questions and another person checks every one. Nothing, neither onboarding material nor student data, is sent to an AI service. The **Pilot** screen shows "AI drafting: Off for this round".

The app can draft questions with AI (Claude, from Anthropic), but that feature is switched off. Whether a later round uses it is decided at the end of this pilot. Turning it on would also need a new student notice approved by HR.

## Privacy and the student notice

- **Who sees a student's results:** the student, their manager (the follow-up owner), the bank owner and the pilot sponsor. The content reviewer does not.
- **What is kept:** the student's name, answers and scores, and the manager's short follow-up notes. No written assessment.
- **How long:** until 30 days after the pilot review, which is 120 days after the student first takes the check. Then it is deleted.
- **Changes to the notice:** the student reads the notice HR approved before starting. If the wording changes, HR must sign off again before any check can be sent.
- **Backups:** the hosting provider's automatic database backups can hold deleted data for up to 30 days.

## Contact

Questions, or want your data deleted? Contact the **bank owner**. The student notice names them. If HR names a separate contact, the notice will be updated to say so.

## Limitations

- One student, one fixed question set and one follow-up cycle per pilot.
- Questions come only from internal onboarding material. Web articles and other outside sources are not used.
- English only.
- The 5-working-day deadline ignores public holidays.
- No email or chat notifications. Links are shared by hand, and waiting work shows as counts in the menu.
- **Known gaps:**
  - The app doesn't warn you if the follow-up owner is also the pilot sponsor or the bank owner. Avoid that set-up (see Setup).
  - The rule that the bank owner and reviewer must be different people can be bypassed by typing the bank owner's name as a "new person". Always pick existing people.
  - A bank owner can pass admin access to someone else by issuing that person a link and then making them bank owner. The change is visible on **People & roles**.
  - A couple of admin screens still say "draft" where they mean "question".
- **Not yet checked in a real browser:** keyboard-only and screen-reader use, very small screens, and reading text from PDFs. Pasting text is the fallback if a PDF reads badly.

## Running it (for whoever operates the app)

It is one Cloudflare Worker that serves both the web app and its API, with a Cloudflare D1 (SQLite) database. The stack, commands and conventions are in [`STACK.md`](STACK.md).

**Locally:**

```sh
npm install
cp .dev.vars.example .dev.vars
npm run dev          # http://localhost:5173 — open /setup and use the code in .dev.vars
npm test
```

**In production**, use a company-owned Cloudflare account with the database in the EU. In outline:

1. Create the database with `npx wrangler d1 create onboarding-knowledge-check-db --location weur`, and put its id in `wrangler.jsonc`.
2. Run `npm run db:migrate:remote`, then `npm run deploy`. Deploy refuses to run while any required setting is still a placeholder.
3. Set the `BOOTSTRAP_TOKEN` secret, so the pilot sponsor can complete `/setup`.

Keep `AI_ENABLED` set to `"false"` and don't set an AI key for round 1. A separate demo copy with made-up data can be deployed with `npm run deploy:demo`. Never put real people or real results in it.

## License

MIT. See [`LICENSE`](LICENSE).
