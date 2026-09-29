// M1 Flags (follow-up owner home) and M2 Flag detail & follow-up log.
import { useState, type FormEvent } from "react";
import { api, ok, ApiError } from "../api";
import { Page, Skeleton, LoadError, StatusLabel, DataTable, InlineError, LiveRegion, ErrorSummary, errProps } from "../components/ui";
import { useLoad } from "../lib/useLoad";
import { Link } from "../lib/router";
import { useMe } from "../lib/me";
import { formatDate } from "../../shared/dates";

type Status = { kind: "due"; days: number } | { kind: "overdue"; days: number } | { kind: "done"; date: string };

export function StatusText({ s }: { s: Status }) {
  if (s.kind === "done") return <StatusLabel tone="done">Done {formatDate(s.date)}</StatusLabel>;
  if (s.kind === "overdue")
    return <StatusLabel tone="overdue">Overdue by {s.days} working {s.days === 1 ? "day" : "days"}</StatusLabel>;
  return <StatusLabel tone="info">{s.days === 0 ? "Due today" : `Due in ${s.days} working ${s.days === 1 ? "day" : "days"}`}</StatusLabel>;
}

export function M1Flags() {
  const { data, error, loading, reload } = useLoad(() => ok(api.flags.$get()));
  if (loading && !data) return <Page title="Flags"><Skeleton /></Page>;
  if (error || !data) return <Page title="Flags"><LoadError message="Couldn't load the flags. Reload the page." onRetry={reload} /></Page>;
  const student = data.studentName ?? "the student";
  return (
    <Page title="Flags">
      {data.flags.length > 0 ? (
        <DataTable head={["Student", "Topics to go over", "Flagged", "Follow-up due", "Status"]}>
          {data.flags.map((f) => (
            <tr key={f.id}>
              <th scope="row">
                <Link to={`/flags/${f.id}`}>{f.studentName}</Link>
              </th>
              <td>{f.weakCount}</td>
              <td>{formatDate(f.flaggedDate)}</td>
              <td>{formatDate(f.dueDate)}</td>
              <td>
                <StatusText s={f.status as Status} />
              </td>
            </tr>
          ))}
        </DataTable>
      ) : data.state === "not_taken" ? (
        <p>{student} hasn't taken check 1 yet.</p>
      ) : (
        <p>
          No flags. When {student} scores below {data.thresholdPct}% on a topic in check 1, it will show up here.
        </p>
      )}
    </Page>
  );
}

type Detail = Awaited<ReturnType<typeof loadDetail>>;
const loadDetail = (id: string) => ok(api.flags[":id"].$get({ param: { id } }));

export function M2Flag({ params }: { params: Record<string, string> }) {
  const { refreshMe } = useMe();
  const { data, error, loading, reload } = useLoad(() => loadDetail(params.id), [params.id]);
  const [doc, setDoc] = useState<{ name: string; versionDate: string; text: string } | null>(null);
  const [docErr, setDocErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  if (loading && !data) return <Page title="Flag"><Skeleton lines={8} /></Page>;
  if (error || !data)
    return (
      <Page title="Flag">
        {error instanceof ApiError && error.status === 404 ? <p>This page isn't available to you.</p> : <LoadError message="Couldn't load this flag. Reload the page." onRetry={reload} />}
      </Page>
    );

  async function openDoc(id: number) {
    setDocErr(null);
    try {
      setDoc(await ok(api.documents[":id"].$get({ param: { id: String(id) } })));
    } catch {
      setDocErr("Couldn't open the document. Try again.");
    }
  }

  return (
    <Page title="Flag" heading={`${data.studentName} · check 1 on ${formatDate(data.attemptDate)}`} wide>
      <p>
        Follow-up due by {formatDate(data.dueDate)} ({data.slaDays} working days).{" "}
        {data.status.kind === "overdue" && <StatusText s={data.status as Status} />}
        {data.status.kind === "done" && <StatusText s={data.status as Status} />}
      </p>
      <p>
        <Link to={`/results/${data.attemptId}`}>See the full results</Link>
      </p>
      <LiveRegion>{done}</LiveRegion>
      {data.allDone && data.formBDueDate && (
        <p className="notice">
          Follow-up logged. Check 2 is now open for {data.studentName} and is due by {formatDate(data.formBDueDate)}. Let them know it's ready.
        </p>
      )}
      {data.formBSubmitted && <p className="notice">Check 2 was submitted. The follow-up log is closed.</p>}
      <div className="with-panel">
        <div>
          {data.topics.map((t) => (
            <section key={t.topicId} className="card" aria-labelledby={`wt-${t.topicId}`}>
              <h2 id={`wt-${t.topicId}`}>
                {t.name}: {t.correct} of {t.total}
              </h2>
              {t.documents.length > 0 && (
                <p>
                  Source material:{" "}
                  {t.documents.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && ", "}
                      <button type="button" className="link" onClick={() => openDoc(d.id)}>
                        {d.name}
                      </button>
                    </span>
                  ))}
                </p>
              )}
              <FollowupForm
                flagId={data.id}
                topic={t}
                flaggedDate={data.flaggedDate}
                today={data.today}
                canEdit={data.canEdit}
                studentName={data.studentName}
                onSaved={async (r) => {
                  if (r.allDone && r.formBDueDate)
                    setDone(`Follow-up logged. Check 2 is now open for ${data.studentName} and is due by ${formatDate(r.formBDueDate)}. Let them know it's ready.`);
                  else setDone(`Saved for ${t.name}.`);
                  await reload();
                  await refreshMe();
                }}
              />
            </section>
          ))}
        </div>
        <aside className="card side-panel" aria-labelledby="doc-h">
          <h2 id="doc-h">Source document</h2>
          {docErr && <p className="error">{docErr}</p>}
          {doc ? (
            <>
              <p>
                <strong>{doc.name}</strong> <span className="muted">(version {formatDate(doc.versionDate)})</span>
              </p>
              <div className="doc-text" tabIndex={0} aria-label={`Text of ${doc.name}`}>
                {doc.text}
              </div>
              <button type="button" className="link" onClick={() => setDoc(null)}>
                Close
              </button>
            </>
          ) : (
            <p className="muted">Choose a document to read it here (read-only).</p>
          )}
        </aside>
      </div>
    </Page>
  );
}

function FollowupForm({
  flagId,
  topic,
  flaggedDate,
  today,
  canEdit,
  studentName,
  onSaved,
}: {
  flagId: number;
  topic: Detail["topics"][number];
  flaggedDate: string;
  today: string;
  canEdit: boolean;
  studentName: string;
  onSaved: (r: { allDone: boolean; formBDueDate: string | null }) => Promise<void>;
}) {
  const f = topic.followup;
  const [date, setDate] = useState(f?.date ?? today);
  const [note, setNote] = useState(f?.note ?? "");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = `fu-${topic.topicId}`;

  if (!canEdit)
    return f ? (
      <p>
        <StatusLabel tone="done">Follow-up on {formatDate(f.date)}</StatusLabel>: {f.note}
      </p>
    ) : (
      <p>
        <StatusLabel tone="wait">Follow-up not logged yet</StatusLabel>
      </p>
    );

  async function submit(e: FormEvent) {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!date) x.date = "Add the date of the follow-up.";
    else if (date > today) x.date = "The date can't be in the future.";
    else if (date < flaggedDate) x.date = `The date can't be before the flag (${formatDate(flaggedDate)}).`;
    if (!note.trim()) x.note = "Add a short note about what was done.";
    setErrs(x);
    setSaveErr(null);
    if (Object.keys(x).length) return;
    setBusy(true);
    try {
      const r = await ok(
        api.flags[":id"].followups[":topicId"].$put({ param: { id: String(flagId), topicId: String(topic.topicId) }, json: { date, note } }),
      );
      await onSaved(r);
    } catch (err) {
      setSaveErr(err instanceof ApiError && err.status === 400 ? err.message : "Not saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack" noValidate>
      <ErrorSummary
        errors={[
          ...(errs.date ? [{ field: `${id}-date`, message: errs.date }] : []),
          ...(errs.note ? [{ field: `${id}-note`, message: errs.note }] : []),
        ]}
      />
      {f && <p className="muted">Logged {formatDate(f.date)}. You can edit this until check 2 is submitted.</p>}
      <label htmlFor={`${id}-date`}>Follow-up date</label>
      <InlineError id={`${id}-date`} message={errs.date} />
      <input
        id={`${id}-date`}
        type="date"
        value={date}
        min={flaggedDate}
        max={today}
        onChange={(e) => setDate(e.target.value)}
        {...errProps(`${id}-date`, errs.date)}
      />
      <label htmlFor={`${id}-note`}>What was done</label>
      <p className="hint" id={`${id}-note-hint`}>
        Describe the follow-up, not the person. Only you and the pilot team see this note. {studentName} sees that the follow-up was done, not the note.
      </p>
      <InlineError id={`${id}-note`} message={errs.note} />
      <input
        id={`${id}-note`}
        value={note}
        maxLength={200}
        placeholder="e.g. 30-min walkthrough of the returns process"
        onChange={(e) => setNote(e.target.value)}
        aria-invalid={!!errs.note}
        aria-describedby={errs.note ? `${id}-note-hint ${id}-note-error` : `${id}-note-hint`}
      />
      {saveErr && (
        <p className="error" role="alert">
          {saveErr}
        </p>
      )}
      <div>
        <button type="submit" disabled={busy}>
          Save
        </button>
      </div>
    </form>
  );
}
