// Synthetic demo data for manual testing on the LOCAL app only (no AI).
// Fictional company, no real names. Used by scripts/seed-slack-demo.mjs and
// checked by test/seed-demo.test.ts with the app's own validation and grounding.
//
// Questions are hand-written. Three are deliberately flawed (see `flaw`) so the
// reviewer can practise rejecting and editing. `flaw` is never written to the DB.

export const DEMO_MODEL = "seed (hand-written, no AI)";
export const DEMO_DOC_NAME = "Collaborating in Slack: team guide";
export const DEMO_DOC_VERSION_DATE = "2026-09-15";
export const DEMO_DOC_SOURCE = "paste" as const;

export const DEMO_TOPICS = [
  "Channels: where to post",
  "Threads and replies",
  "Mentions and notifications",
  "Status, availability and async etiquette",
  "Security and sensitive information",
] as const;
export type DemoTopic = (typeof DEMO_TOPICS)[number];

export const DEMO_DOC_TEXT = `Collaborating in Slack: team guide

Tallowmere Systems - internal onboarding material. Owner: Workplace Tools team. This guide applies to all employees, working students and contractors with a Tallowmere Slack account.

Why this guide exists

Slack is where most day-to-day work at Tallowmere is coordinated. It is fast, but it is also noisy, and a message posted in the wrong place, at the wrong volume or with the wrong content can cost colleagues time or put customer data at risk. This guide sets out the shared habits we expect from everyone. Read it in your first week and come back to it whenever you are unsure.

Slack is not a system of record. Decisions, tickets and customer commitments must be written down in the tool that owns them (the ticket tool, the project tracker or the wiki), with a link back to the Slack conversation if useful.

1. Channels: where to post

Default to public channels. If a conversation is about work and does not involve confidential information, it belongs in a public channel where others can find it later. Private channels are for topics that genuinely need restricted access, such as HR matters, unannounced customer deals or security incidents.

Every channel name starts with a prefix that tells you what kind of channel it is:

- team- for a team's home channel, for example team-billing.
- proj- for a time-limited project, for example proj-warehouse-migration. Project channels are archived within 30 days of the project ending.
- help- for asking questions of a support team, for example help-it or help-payroll.
- ext- for channels shared with people outside Tallowmere, such as customers or suppliers.
- social- for non-work conversation, for example social-running.

Channel names use lowercase letters, numbers and hyphens only. Before you create a new channel, search for an existing one; duplicate channels split the conversation and are merged by the Workplace Tools team.

Use direct messages (DMs) for quick, personal or one-to-one coordination, such as agreeing a meeting time. Do not use DMs for work questions that others could answer or benefit from. If you are asking how a process works, ask in the relevant help- channel instead of messaging a colleague you happen to know. Group DMs with more than four people should become a channel.

When you join a channel, read its pinned messages and the channel description before posting. Many channels pin a short list of rules, such as which request form to use.

2. Threads and replies

Reply in a thread, not in the main channel. When someone posts a question or an update, answer by choosing "Reply in thread" so that the conversation stays grouped under the original message. Replying in the main channel breaks the conversation apart and makes it hard for people who join later to follow.

Start a new top-level message only when you are raising a new subject. One topic per top-level message makes channels scannable.

Use the option "Also send to channel" sparingly. It is meant for the final outcome of a thread, such as a decision or a fix, when the wider channel needs to see it. Do not use it for every reply.

Keep the first message of a thread self-contained. Include the context someone needs to help you: what you are trying to do, what you already tried and any link or ticket number. "Quick question?" on its own forces people to wait for a second message.

When a request in a help- channel has been resolved, the person who asked adds a :white_check_mark: reaction to the original message. This tells the support team that nothing more is needed. Reactions are also a good way to acknowledge a message without adding a reply: :eyes: means "I'm looking at it".

If a thread grows beyond roughly 20 replies or turns into a debate, move it to a short call or a document, then post a summary of the outcome back in the thread.

3. Mentions and notifications

An @mention sends a notification to the person you name. Mention someone when you need them specifically to act or answer, not simply to make them aware of a message they will see anyway.

@here notifies everyone in the channel who is currently active. @channel notifies every member of the channel, including people who are offline, on holiday or in another time zone. Both interrupt many people at once, so use them only for time-critical information that affects everyone in the channel, such as an outage or a change to a meeting that starts soon.

In channels with more than 50 members, only channel managers may use @channel. Everyone else should use @here, and only if the matter is urgent. Never use @channel or @here in social- channels.

To reach a whole team, use its user group, for example @billing-oncall, rather than listing names. User groups are maintained by team leads, so the right people are notified even when rotas change.

Configure your notifications in your first week. We recommend the following settings:

- Set desktop and mobile notifications to "Direct messages, mentions and keywords".
- Add keywords for your team name and the systems you own, so you notice relevant discussions.
- Mute social- channels and any channel you only read occasionally; muted channels still show your mentions.
- Turn on notification schedules so Slack does not notify you outside your working hours.

If a message needs a response from you but you cannot deal with it now, use "Remind me about this" instead of leaving it unread.

4. Status, availability and async etiquette

Tallowmere has offices in Lisbon, Hamburg and Bucharest, which are in three different time zones, and many colleagues work part-time, including working students. Assume the person you are writing to may not be online.

Keep your Slack status up to date. Set a status when you are in a meeting, focusing, travelling, off sick or on holiday, and add an end time so that it clears automatically. When you are on holiday, also turn on "Pause notifications".

Response-time expectations:

- Direct messages and mentions during your working hours: respond within four working hours, even if only to say when you will answer properly.
- Messages in help- channels: the owning team responds within one working day.
- Messages sent outside the recipient's working hours: no response is expected until their next working day.

Slack is not the right channel for anything that needs an answer within minutes. For genuine emergencies, such as a production outage or a safety issue, phone the on-call number listed in the wiki.

Write so that people can respond asynchronously. Put the question and all the information needed to answer it in one message. Avoid sending "Hi" and waiting for a reply before explaining what you need.

Use the "Schedule message" option when you write to someone outside their working hours, so that the message arrives at the start of their day. Check a colleague's local time in their profile before you send.

Huddles are for short, unscheduled conversations of up to 15 minutes, such as unblocking a problem together. Anything longer, or anything that needs an agenda, should be a scheduled meeting. Do not start a huddle with someone whose status shows they are focusing or in a meeting. After a huddle that leads to a decision, post a one-line summary in the related thread or channel.

5. Security and sensitive information

Never post passwords, API keys, access tokens or any other credentials in Slack, not even in a DM or a private channel. Share credentials only through the company password manager. If you post a credential by mistake, delete the message, rotate the credential immediately and report it in help-security.

Do not put personal data in Slack. This includes customer names combined with contact details, employees' health information, home addresses, bank details and ID numbers. Refer to customers by their ticket or account number instead. If you need to discuss a specific person's data, do it in the system that holds the data, where access is controlled and logged.

Channels with the ext- prefix are shared with people outside Tallowmere. Everything you post there, including files and threads, is visible to the external organisation. Before posting in an ext- channel, check the channel banner and ask yourself whether you would send the same content by email to that customer or supplier. Only the Workplace Tools team can create ext- channels, and each one needs a named Tallowmere owner.

Do not upload confidential documents to Slack. Share a link to the file in the company drive instead, so that access follows the drive's permissions and can be withdrawn later. Files uploaded directly to Slack are kept according to Slack's retention settings and can be forwarded outside the original audience.

Be alert to phishing in Slack. Messages that urgently ask you to click a link, approve a login or send a code are suspicious even when they appear to come from a colleague. Check the sender's profile, and if in doubt, report the message in help-security without clicking anything.

Slack messages in public and private channels are kept for two years, and direct messages for one year. After that they are deleted automatically.

Where to get help

For questions about this guide or about Slack settings, ask in help-slack. For anything security-related, use help-security. The Workplace Tools team reviews this guide every six months.`;

export type DemoQuestion = {
  topic: DemoTopic;
  question: string;
  options: [string, string, string, string];
  correct_index: 0 | 1 | 2 | 3;
  /** Copied word for word from DEMO_DOC_TEXT. */
  quote: string;
  /** Set only on the deliberately flawed questions. Never stored. */
  flaw?: string;
};

const C: DemoTopic = "Channels: where to post";
const T: DemoTopic = "Threads and replies";
const M: DemoTopic = "Mentions and notifications";
const S: DemoTopic = "Status, availability and async etiquette";
const X: DemoTopic = "Security and sensitive information";

export const DEMO_QUESTIONS: DemoQuestion[] = [
  // Channels: where to post
  {
    topic: C,
    question: "According to the guide, where should a work conversation without confidential information take place?",
    options: ["In a DM to the most relevant colleague", "In a public channel", "In a private channel for your team", "In a group DM with everyone involved"],
    correct_index: 1,
    quote: "If a conversation is about work and does not involve confidential information, it belongs in a public channel where others can find it later.",
  },
  {
    topic: C,
    question: "Which channel prefix is used for channels shared with people outside Tallowmere?",
    options: ["ext-", "proj-", "team-", "help-"],
    correct_index: 0,
    quote: "ext- for channels shared with people outside Tallowmere, such as customers or suppliers.",
  },
  {
    topic: C,
    question: "When are project (proj-) channels archived?",
    options: ["When the last member leaves", "After one year without activity", "Within 30 days of the project ending", "At the end of each quarter"],
    correct_index: 2,
    quote: "Project channels are archived within 30 days of the project ending.",
  },
  {
    topic: C,
    question: "You want to know how the expense process works. Where should you ask?",
    options: ["In a DM to a colleague you know in Finance", "In a social- channel", "In your team's channel, using @channel", "In the relevant help- channel"],
    correct_index: 3,
    quote: "If you are asking how a process works, ask in the relevant help- channel instead of messaging a colleague you happen to know.",
  },
  {
    topic: C,
    question: "Which characters may a Tallowmere channel name contain?",
    options: ["Lowercase letters, numbers and hyphens only", "Any letters, numbers and spaces", "Lowercase letters and underscores only", "Upper- and lowercase letters, numbers and hyphens"],
    correct_index: 0,
    quote: "Channel names use lowercase letters, numbers and hyphens only.",
  },
  {
    topic: C,
    question: "What should you do before you create a new channel?",
    options: ["Ask your manager for written approval", "Search for an existing one", "Post a request in help-it", "Create it as a private channel first"],
    correct_index: 1,
    quote: "Before you create a new channel, search for an existing one; duplicate channels split the conversation and are merged by the Workplace Tools team.",
  },
  {
    topic: C,
    question: "A group DM about a piece of work has grown to six people. What does the guide say?",
    options: ["It is fine as long as it stays under ten people", "Remove people until four are left", "It should become a channel", "Move the conversation to email"],
    correct_index: 2,
    quote: "Group DMs with more than four people should become a channel.",
  },
  {
    topic: C,
    question: "What are private channels meant for?",
    options: ["Every team's day-to-day work", "Topics that genuinely need restricted access, such as HR matters", "Conversations you would rather your manager didn't see", "Non-work conversation"],
    correct_index: 1,
    quote: "Private channels are for topics that genuinely need restricted access, such as HR matters, unannounced customer deals or security incidents.",
  },
  {
    topic: C,
    question: "What should you read when you join a channel, before you post?",
    options: ["The full message history of the last month", "The list of members", "Its pinned messages and the channel description", "Slack's terms of service"],
    correct_index: 2,
    quote: "When you join a channel, read its pinned messages and the channel description before posting.",
  },
  {
    topic: C,
    question: "Which of these is an appropriate use of a direct message (DM)?",
    options: ["Agreeing a meeting time with one colleague", "Asking how the payroll process works", "Quick one-to-one coordination with a colleague", "Posting an update for your whole team"],
    correct_index: 0,
    quote: "Use direct messages (DMs) for quick, personal or one-to-one coordination, such as agreeing a meeting time.",
    flaw: "Ambiguous: options A and C are both correct (more than one right answer).",
  },

  // Threads and replies
  {
    topic: T,
    question: "How should you answer a question someone posted in a channel?",
    options: ["Reply in the main channel so everyone sees it", "Reply in a thread under the original message", "Send the person a DM", "Post a new top-level message quoting them"],
    correct_index: 1,
    quote: "Reply in a thread, not in the main channel.",
  },
  {
    topic: T,
    question: "When should you start a new top-level message in a channel?",
    options: ["Whenever you reply to someone", "Every morning, as a daily check-in", "When a thread has more than five replies", "Only when you are raising a new subject"],
    correct_index: 3,
    quote: "Start a new top-level message only when you are raising a new subject.",
  },
  {
    topic: T,
    question: "What is the \"Also send to channel\" option meant for?",
    options: ["Every reply, so nobody misses anything", "Asking the channel for more opinions", "Reminding people to reply", "The final outcome of a thread, such as a decision or a fix"],
    correct_index: 3,
    quote: "It is meant for the final outcome of a thread, such as a decision or a fix, when the wider channel needs to see it.",
  },
  {
    topic: T,
    question: "What should the first message of a thread include?",
    options: ["What you are trying to do, what you already tried and any link or ticket number", "Only a greeting, to check someone is available", "An @channel mention so the right person sees it", "Just the words \"Quick question?\""],
    correct_index: 0,
    quote: "Include the context someone needs to help you: what you are trying to do, what you already tried and any link or ticket number.",
  },
  {
    topic: T,
    question: "Your request in help-it has been resolved. What should you do?",
    options: ["Delete your original message", "Post \"thanks\" as a new message in the channel", "Add a :white_check_mark: reaction to your original message", "Nothing: the support team closes it"],
    correct_index: 2,
    quote: "When a request in a help- channel has been resolved, the person who asked adds a :white_check_mark: reaction to the original message.",
  },
  {
    topic: T,
    question: "What does an :eyes: reaction on a message mean?",
    options: ["I'm looking at it", "I disagree", "This is resolved", "Please look at this"],
    correct_index: 0,
    quote: "Reactions are also a good way to acknowledge a message without adding a reply: :eyes: means \"I'm looking at it\".",
  },
  {
    topic: T,
    question: "A thread has passed about 20 replies and turned into a debate. What should happen?",
    options: ["Continue until everyone agrees", "Delete the thread and start again", "Use @channel to get more opinions", "Move it to a short call or a document, then post a summary in the thread"],
    correct_index: 3,
    quote: "If a thread grows beyond roughly 20 replies or turns into a debate, move it to a short call or a document, then post a summary of the outcome back in the thread.",
  },
  {
    topic: T,
    question: "Why is replying in the main channel, instead of in a thread, a problem?",
    options: ["It notifies everyone in the workspace", "It deletes the original message", "It breaks the conversation apart and makes it hard to follow", "It hides the reply from guests"],
    correct_index: 2,
    quote: "Replying in the main channel breaks the conversation apart and makes it hard for people who join later to follow.",
  },
  {
    topic: T,
    question: "According to the guide, what does keeping to one topic per top-level message achieve?",
    options: ["It makes channels scannable", "It reduces storage use", "It keeps messages private", "It avoids notifications"],
    correct_index: 1,
    quote: "One topic per top-level message makes channels scannable.",
    flaw: "Wrong answer key: marked correct is B (\"It reduces storage use\"); the guide supports A.",
  },
  {
    topic: T,
    question: "Why should you avoid posting \"Quick question?\" on its own?",
    options: ["It is considered rude", "It forces people to wait for a second message", "It sends a notification to everyone", "Slack deletes very short messages"],
    correct_index: 1,
    quote: "\"Quick question?\" on its own forces people to wait for a second message.",
  },

  // Mentions and notifications
  {
    topic: M,
    question: "What is the difference between @here and @channel?",
    options: ["There is no difference", "@here notifies only the channel managers", "@here notifies members who are active; @channel notifies all members, including offline ones", "@channel notifies members who are active; @here notifies all members"],
    correct_index: 2,
    quote: "@here notifies everyone in the channel who is currently active. @channel notifies every member of the channel, including people who are offline, on holiday or in another time zone.",
  },
  {
    topic: M,
    question: "When is it appropriate to use @here or @channel?",
    options: ["To say good morning to the team", "For time-critical information that affects everyone in the channel", "Whenever your question is unanswered after an hour", "To share an interesting article"],
    correct_index: 1,
    quote: "Both interrupt many people at once, so use them only for time-critical information that affects everyone in the channel, such as an outage or a change to a meeting that starts soon.",
  },
  {
    topic: M,
    question: "In a channel with more than 50 members, who may use @channel?",
    options: ["Anyone in the channel", "Only team leads", "Nobody at all", "Only channel managers"],
    correct_index: 3,
    quote: "In channels with more than 50 members, only channel managers may use @channel.",
  },
  {
    topic: M,
    question: "How should you reach the whole billing on-call team?",
    options: ["Use the team's user group, such as @billing-oncall", "List each person's name in the message", "Use @channel in team-billing", "DM the team lead and ask them to pass it on"],
    correct_index: 0,
    quote: "To reach a whole team, use its user group, for example @billing-oncall, rather than listing names.",
  },
  {
    topic: M,
    question: "Which desktop and mobile notification setting does the guide recommend?",
    options: ["All new messages", "Nothing", "Direct messages, mentions and keywords", "Mentions only, and only at weekends"],
    correct_index: 2,
    quote: "Set desktop and mobile notifications to \"Direct messages, mentions and keywords\".",
  },
  {
    topic: M,
    question: "You mute a channel you only read occasionally. What happens when someone mentions you there?",
    options: ["The mention is lost", "The mention still shows", "The mention is sent to you by email", "The mention is forwarded to your manager"],
    correct_index: 1,
    quote: "Mute social- channels and any channel you only read occasionally; muted channels still show your mentions.",
  },
  {
    topic: M,
    question: "In which channels must you never use @channel or @here?",
    options: ["help- channels", "proj- channels", "social- channels", "team- channels"],
    correct_index: 2,
    quote: "Never use @channel or @here in social- channels.",
  },
  {
    topic: M,
    question: "A message needs a response from you, but you can't deal with it now. What does the guide suggest?",
    options: ["Leave it unread as a reminder", "Reply \"later\" in the channel", "Forward it to a colleague", "Use \"Remind me about this\""],
    correct_index: 3,
    quote: "If a message needs a response from you but you cannot deal with it now, use \"Remind me about this\" instead of leaving it unread.",
  },
  {
    topic: M,
    question: "Why should you turn on notification schedules?",
    options: ["So Slack does not notify you outside your working hours", "So you get a daily summary email", "So your manager can see when you are online", "So muted channels are unmuted automatically"],
    correct_index: 0,
    quote: "Turn on notification schedules so Slack does not notify you outside your working hours.",
  },
  {
    topic: M,
    question: "Who maintains user groups such as @billing-oncall?",
    options: ["Every member of the group", "The Workplace Tools team", "Team leads", "HR"],
    correct_index: 2,
    quote: "User groups are maintained by team leads, so the right people are notified even when rotas change.",
  },

  // Status, availability and async etiquette
  {
    topic: S,
    question: "What should you assume when you write to a colleague in Slack?",
    options: ["They are online and will reply at once", "They may not be online", "They read every channel they are in", "They work full-time"],
    correct_index: 1,
    quote: "Assume the person you are writing to may not be online.",
  },
  {
    topic: S,
    question: "When you set a Slack status, what should you add so that it clears automatically?",
    options: ["An end time", "An emoji", "A reason", "A link to your calendar"],
    correct_index: 0,
    quote: "Set a status when you are in a meeting, focusing, travelling, off sick or on holiday, and add an end time so that it clears automatically.",
  },
  {
    topic: S,
    question: "How quickly should you respond to direct messages and mentions during your working hours?",
    options: ["Within 15 minutes", "Within one working hour", "Within one working day", "Within one week"],
    correct_index: 1,
    quote: "Direct messages and mentions during your working hours: respond within four working hours, even if only to say when you will answer properly.",
    flaw: "Incorrect: no option is right. The key marks B (\"Within one working hour\"); the guide says four working hours.",
  },
  {
    topic: S,
    question: "How quickly does the owning team respond to messages in help- channels?",
    options: ["Within one hour", "Within four working hours", "Within one working day", "Within one week"],
    correct_index: 2,
    quote: "Messages in help- channels: the owning team responds within one working day.",
  },
  {
    topic: S,
    question: "A colleague messages you after your working hours have ended. When are you expected to respond?",
    options: ["Immediately, using the mobile app", "Within four hours, even at night", "Not until your next working day", "Within 30 minutes"],
    correct_index: 2,
    quote: "Messages sent outside the recipient's working hours: no response is expected until their next working day.",
  },
  {
    topic: S,
    question: "What should you do in a genuine emergency, such as a production outage?",
    options: ["Post in help-it and wait for a reply", "Send a DM to the Workplace Tools team", "Start a huddle in your team channel", "Phone the on-call number listed in the wiki"],
    correct_index: 3,
    quote: "For genuine emergencies, such as a production outage or a safety issue, phone the on-call number listed in the wiki.",
  },
  {
    topic: S,
    question: "You are writing to a colleague outside their working hours. What does the guide recommend?",
    options: ["Send it now with @here so it is not missed", "Use \"Schedule message\" so it arrives at the start of their day", "Phone them instead", "Send it by email instead of Slack"],
    correct_index: 1,
    quote: "Use the \"Schedule message\" option when you write to someone outside their working hours, so that the message arrives at the start of their day.",
  },
  {
    topic: S,
    question: "How long should a huddle last at most?",
    options: ["Up to 15 minutes", "Up to 30 minutes", "Up to an hour", "As long as needed"],
    correct_index: 0,
    quote: "Huddles are for short, unscheduled conversations of up to 15 minutes, such as unblocking a problem together.",
  },
  {
    topic: S,
    question: "What should you do after a huddle that leads to a decision?",
    options: ["Nothing: huddles are informal", "Send everyone a calendar invite", "Post a one-line summary in the related thread or channel", "Ask everyone to take their own notes"],
    correct_index: 2,
    quote: "After a huddle that leads to a decision, post a one-line summary in the related thread or channel.",
  },
  {
    topic: S,
    question: "What does the guide say about opening a conversation with just \"Hi\"?",
    options: ["It is required as a polite opening", "Avoid it: put your question and the information needed in one message", "Use it only with people you know well", "Use it only in DMs"],
    correct_index: 1,
    quote: "Put the question and all the information needed to answer it in one message. Avoid sending \"Hi\" and waiting for a reply before explaining what you need.",
  },

  // Security and sensitive information
  {
    topic: X,
    question: "Where may you share credentials such as passwords or API keys?",
    options: ["In a private channel", "In a DM", "Only through the company password manager", "In an ext- channel with the customer"],
    correct_index: 2,
    quote: "Share credentials only through the company password manager.",
  },
  {
    topic: X,
    question: "You posted an API key in Slack by mistake. What must you do?",
    options: ["Delete the message, rotate the credential immediately and report it in help-security", "Edit the message to hide the key", "Delete the message; nothing else is needed", "Ask people in the channel not to use it"],
    correct_index: 0,
    quote: "If you post a credential by mistake, delete the message, rotate the credential immediately and report it in help-security.",
  },
  {
    topic: X,
    question: "How should you refer to a customer in Slack?",
    options: ["By full name and email address", "By their phone number", "By company name and contact person", "By their ticket or account number"],
    correct_index: 3,
    quote: "Refer to customers by their ticket or account number instead.",
  },
  {
    topic: X,
    question: "Who can see what you post in an ext- channel?",
    options: ["Only Tallowmere employees", "The external organisation as well", "Only the channel's owner", "Only the people you @mention"],
    correct_index: 1,
    quote: "Everything you post there, including files and threads, is visible to the external organisation.",
  },
  {
    topic: X,
    question: "Who can create ext- channels?",
    options: ["Any employee", "Any team lead", "Only the Workplace Tools team", "The customer or supplier"],
    correct_index: 2,
    quote: "Only the Workplace Tools team can create ext- channels, and each one needs a named Tallowmere owner.",
  },
  {
    topic: X,
    question: "How should you share a confidential document with colleagues?",
    options: ["Upload it to a private channel", "Share a link to the file in the company drive", "Send it as a file in a DM", "Upload it and delete it after a week"],
    correct_index: 1,
    quote: "Do not upload confidential documents to Slack. Share a link to the file in the company drive instead, so that access follows the drive's permissions and can be withdrawn later.",
  },
  {
    topic: X,
    question: "A message that seems to come from a colleague urgently asks you to approve a login. What should you do?",
    options: ["Approve it quickly so they aren't blocked", "Reply with the code they asked for", "Check the sender's profile and, if in doubt, report it in help-security without clicking anything", "Forward it to your team channel"],
    correct_index: 2,
    quote: "Check the sender's profile, and if in doubt, report the message in help-security without clicking anything.",
  },
  {
    topic: X,
    question: "Which of these counts as personal data that must not be posted in Slack?",
    options: ["An employee's home address", "A ticket number", "The name of a proj- channel", "A link to a wiki page"],
    correct_index: 0,
    quote: "This includes customer names combined with contact details, employees' health information, home addresses, bank details and ID numbers.",
  },
  {
    topic: X,
    question: "How long are direct messages kept before they are deleted automatically?",
    options: ["30 days", "Six months", "One year", "Two years"],
    correct_index: 2,
    quote: "Slack messages in public and private channels are kept for two years, and direct messages for one year.",
  },
  {
    topic: X,
    question: "Is it acceptable to post a password in a private channel or a DM?",
    options: ["Yes, private channels are secure", "Yes, but only in a DM", "Only if you delete it within an hour", "No, not even in a DM or a private channel"],
    correct_index: 3,
    quote: "Never post passwords, API keys, access tokens or any other credentials in Slack, not even in a DM or a private channel.",
  },
];
