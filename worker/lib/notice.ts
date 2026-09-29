// T2 student notice (design spec §7.1). DRAFT FOR HR APPROVAL.
// When HR's final text arrives: replace the text below, increase NOTICE_VERSION,
// and deploy. HR sign-off on A1 must then be recorded again for the new version
// before Form A can be sent (technical plan §6).
import { formatDate } from "../../shared/dates";

export const NOTICE_VERSION = 1;

export type NoticeBlock =
  | { kind: "p"; lead?: string; text: string }
  | { kind: "ol"; lead: string; items: string[] };

export type NoticeParams = {
  bankOwner?: { personId: number; name: string };
  cpo?: { personId: number; name: string };
  manager?: { personId: number; name: string };
  reviewer?: { personId: number; name: string };
  questionCount?: number;
  topics: string[];
  thresholdPct: number;
  /** Known once Form A is submitted (day 0 + 120 days). */
  retentionDate?: string;
};

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function renderNotice(p: NoticeParams) {
  const bankOwner = p.bankOwner?.name ?? "the bank owner";
  const cpo = p.cpo?.name ?? "the pilot sponsor";
  const manager = p.manager?.name ?? "your manager";
  const reviewer = p.reviewer?.name ?? "the content reviewer";
  const sameAdmin = !!p.bankOwner && !!p.cpo && p.bankOwner.personId === p.cpo.personId;
  const admins = sameAdmin ? [bankOwner] : [bankOwner, cpo];
  const runs = sameAdmin ? "who runs this pilot" : "who run this pilot";
  const adminList = joinNames(admins);

  // Role overlap (decision 7): drop the reviewer sentence if the reviewer is also
  // the manager or an admin, because it would be false.
  const rid = p.reviewer?.personId;
  const reviewerOverlaps =
    rid !== undefined && [p.manager?.personId, p.bankOwner?.personId, p.cpo?.personId].includes(rid);

  const n = p.questionCount;
  const questionsText = n ? `about ${n} multiple-choice questions` : "a short set of multiple-choice questions";
  const minutesText = n ? `It takes about ${n} minutes, with no time limit.` : "There is no time limit.";
  const topicsText = p.topics.length ? joinNames(p.topics) : "your onboarding topics";

  const whoSees =
    `You; ${manager}; ${adminList}, ${runs}.` +
    (reviewerOverlaps ? "" : ` ${reviewer}, who checks the questions, doesn't see your name or your answers.`);

  const retention = p.retentionDate
    ? `Until ${formatDate(p.retentionDate)}, which is 30 days after the pilot review. Then it is deleted.`
    : "Until 30 days after the pilot review, which is 120 days after you first take the check. Then it is deleted.";

  const blocks: NoticeBlock[] = [
    {
      kind: "p",
      lead: "It's for your development, not an evaluation.",
      text: "This short quiz shows which parts of your onboarding are clear and where more support would help. It is not used for performance reviews, probation, pay or contract decisions.",
    },
    {
      kind: "p",
      lead: "Taking part is voluntary.",
      text: `You can say no, and that has no consequences for you. If you say no, only ${adminList}, ${runs}, will know. Your manager won't be told.`,
    },
    {
      kind: "ol",
      lead: "What happens:",
      items: [
        `You answer ${questionsText} on ${topicsText}. ${minutesText}`,
        "You see your results and the correct answers straight away.",
        `If a topic scores below ${p.thresholdPct}%, ${manager} will go over it with you within 5 working days.`,
        "After that, you take a second check on the same topics with different questions, and you can see how the two compare.",
      ],
    },
    { kind: "p", lead: "Who sees your results:", text: whoSees },
    {
      kind: "p",
      lead: "What we keep:",
      text: "Your name, your answers and scores, and short notes from your manager on the follow-up. No written assessment of you.",
    },
    { kind: "p", lead: "For how long:", text: retention },
    {
      kind: "p",
      lead: "AI:",
      text: "The questions were drafted by an AI tool from our onboarding documents and then checked by a person. The AI tool never sees your name or your answers.",
    },
    {
      kind: "p",
      lead: "Questions, or want your data deleted?",
      // Decision 9: the contact defaults to the bank owner until HR names an HR contact.
      text: `Contact ${p.bankOwner?.name ?? "the pilot team"}.`,
    },
  ];

  return { version: NOTICE_VERSION, title: "Before you start: what this knowledge check is for", blocks };
}
