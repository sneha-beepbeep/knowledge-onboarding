# Loading your questions: a guide for the question bank owner

In round 1 there is no AI. You write the questions yourself, in one file, and
load that file into the app with one command. Every question then waits in the
review queue. The reviewer approves, edits or rejects each one, exactly as they
would an AI draft. Nothing reaches the student until the reviewer has approved
it and the bank is published.

You don't need to be an engineer to do this. You need:

- a text editor (for example VS Code, or TextEdit in plain-text mode);
- a terminal open in the project folder (`decision-bias`);
- the app started once on this computer with `npm run dev`, so that its local
  database exists. It can keep running while you load questions.

The fastest start is to copy `example.json` and `example-document.txt` from this
folder and change them.

## 1. Write the file

The file is JSON: plain text with `{ }`, `[ ]`, quotation marks and commas.
The example shows the exact shape. The file has three parts:

```json
{
  "format": "knowledge-check-import/1",
  "documents": [ ...your documents... ],
  "questions": [ ...your questions... ]
}
```

Keep the first line (`"format"`) exactly as it is.

### Documents: the material the questions come from

For each document, write:

```json
{
  "key": "security",
  "name": "Security guide",
  "versionDate": "2026-09-15",
  "topics": ["Passwords", "Sharing files"],
  "textFile": "security-guide.txt"
}
```

- **key**: a short nickname you choose. Your questions refer to the document by this nickname.
- **name**: the document's title, as people will see it in the app.
- **versionDate**: the date of this version of the material, written year-month-day.
- **topics**: the topics this document covers. Each question belongs to one of them.
  If the app already has a topic with the same name, it is reused.
- **textFile**: the document's text, saved as a plain `.txt` file **in the same folder** as your
  JSON file. Alternatively, paste the text in directly with `"text": "..."`, but a separate
  file is easier.

**If the document was uploaded as a PDF in the app**, don't make a text file. Point at
the uploaded document instead, so your quotes are checked against exactly the text the
app extracted and the reviewer sees:

```json
{ "key": "security", "existing": "Security guide.pdf" }
```

The name must match the Bank page exactly. The document's topics are the ones it already
has in the app.

### Questions

For each question, write:

```json
{
  "topic": "Passwords",
  "document": "security",
  "question": "Where may you share a password?",
  "options": ["In a private channel", "In a DM", "Only through the password manager", "By email"],
  "correctIndex": 2,
  "quote": "Share credentials only through the company password manager."
}
```

- **topic**: one of the document's topics, spelled the same way.
- **document**: the document's **key** (not its name).
- **question**: the question, up to 500 characters.
- **options**: exactly 4 answers, all different, each up to 200 characters.
- **correctIndex**: which answer is right, **counting from 0**: `0` = first answer,
  `1` = second, `2` = third, `3` = fourth. (In the example above, `2` means
  "Only through the password manager".)
- **quote**: one or two sentences **copied word for word** from the document, which
  show that the answer is right. It must be 30 to 600 characters. Copy and paste it;
  don't retype it. Straight versus curly quotation marks, dash types and line breaks
  don't matter, but words, spelling and capital letters must match exactly.

Put a comma between documents, and between questions, but not after the last one.

## 2. Check the file (nothing is loaded)

```sh
npm run import:questions -- path/to/your-file.json --check
```

This reads your file and runs every check the app uses, then tells you either
"All N questions passed the checks" or lists each problem. Nothing is written.
Fix the problems and run it again until it passes.

## 3. Load it

```sh
npm run import:questions -- path/to/your-file.json
```

This runs the same checks and, if they all pass, loads everything at once. If
**any** check fails, **nothing** is loaded, so you never end up with half a file.
Afterwards, tell the reviewer the questions are waiting in the review queue.

To add more questions later, make a new file with only the new questions. Point at
the documents with `"existing"`, because they are in the app now. If you load the same
file twice, the second load is refused because its documents are already in the app.

## What the messages mean

Every message names the document or question by its number in the file, counting
from 1 (question 1 is the first question in the list).

| Message says | What to do |
| --- | --- |
| isn't valid JSON (…position N…) | A comma, bracket or quotation mark is missing or extra near that point. Compare with the example. A common cause is a comma after the last item in a list. |
| The first line must be "format": … | Copy the `"format"` line from the example. |
| "documents" / "questions" is missing or empty | The list is missing or has nothing between `[` and `]`. |
| A version is already published | The bank is frozen after publishing. Nothing more can be loaded. Talk to the pilot team. |
| Document N: "key" is missing / already used | Give each document its own short key. |
| Document N: the app already has a document with this name | It was loaded or uploaded before. Use `{ "key": "…", "existing": "<name>" }` instead. |
| Document N: no document in the app is called … | The `existing` name doesn't match the Bank page exactly. Copy it from there. |
| Document N: "versionDate" must be … | Write the date as year-month-day, for example `"2026-09-15"`. |
| Document N: the text file … wasn't found | Put the `.txt` file in the same folder as the JSON file, and check the spelling. |
| Document N: give the text in exactly one way | Use either `"textFile"` or `"text"`, not both. |
| Question N: "document" is …, but no document in this file has that key | Use the document's `key`, not its name. |
| Question N: the topic … isn't one of the topics of … | Use a topic from that document's `topics` list, spelled the same. |
| Question N: "options" must list exactly 4 answers … | Check you have 4 answers, none empty, none the same, none over 200 characters. |
| Question N: "correctIndex" must be 0, 1, 2 or 3 | Count from 0. The last answer is 3, not 4. |
| Question N: the quote is … characters long | Make it one or two whole sentences (30 to 600 characters). |
| Question N: the quote isn't found word for word in … | Copy the sentence again from the document's text, exactly. Check for a changed word, a typo, or different capital letters. |
| Question N: the app already has this question | It was loaded before. Remove it from the file. |
| Question N: this is the same question as question M | Remove one of the two, or reword one. |
| The local database couldn't be read | Start the app once with `npm run dev`, then try again. |

After loading, the reviewer can still fix wording or the right answer. They can also
reject a question. A rejected question can't be used, so you would write a new one.

---

## For engineers: format reference and remote loading

- **Format id:** `knowledge-check-import/1`.
- **Parser and checks:** `scripts/lib/bank-import.ts` (`planImport`).
- **Document checks:** the same limits as A3a.
  - A new document's name must not exist yet (case-insensitive).
  - Topics are reused case-insensitively.
  - Text at most 150,000 characters. At most 20 topics per document, each at most 80 characters.
  - The text is stored with `source` `paste`.
- **Question checks:** each question goes through `validateDraft`, the same validation and grounding as AI drafts. Grounding is against the topic's documents, the stated one first.
- **What is written:**
  - one finished run per topic, `model = "manual import (no AI)"`. The run is `initial` if the topic had no questions yet, otherwise `more`;
  - questions as `pending`;
  - `ai_original` holds the loaded version, so Undo in the review screen restores it.
- **Behaviour:** all or nothing. Imports are refused after publishing.

**Remote loading** is a separate, explicit step at deploy time, with CPO approval. It is
not available through the npm command, which always passes `--local`:

```sh
npx tsx scripts/import-questions.mjs <file.json> --remote <db> --confirm-remote=<db> [--check]
```

Only two remote databases are accepted:

- `knowledge-check-demo-db`, which must pass the demo guard.
- The production database, which must pass the same guard as `npm run deploy`: a real
  database id, `ENVIRONMENT` `"production"`, no `AI_MOCK`, and no `CLOUDFLARE_ENV`.
