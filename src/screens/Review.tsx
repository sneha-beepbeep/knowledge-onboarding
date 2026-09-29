// V1 Review queue, V2 Review a question, V3 Question statistics.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ok, ApiError } from "../api";
import { Page, Skeleton, LoadError, StatusLabel, ErrorSummary, InlineError, LiveRegion, DataTable, errProps, type FieldError } from "../components/ui";
import { useLoad } from "../lib/useLoad";
import { Link, navigate } from "../lib/router";
import { formatDate } from "../../shared/dates";
import { useMe } from "../lib/me";

const LETTERS = "ABCD";

function Checklist() {
  return (
    <aside className="card side-panel" aria-labelledby="checklist-h">
      <h2 id="checklist-h">Reviewer checklist</h2>
      <ol>
        <li>Correct according to the source and current practice.</li>
        <li>Exactly one defensible correct answer.</li>
        <li>The wrong options are clearly wrong but plausible.</li>
        <li>Tests understanding, not trivia or wording.</li>
        <li>No confidential detail that shouldn't appear in a quiz.</li>
      </ol>
    </aside>
  );
}

const FILTERS = [
  { key: "waiting", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "edited", label: "Edited" },
  { key: "rejected", label: "Rejected" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

function statusLabel(s: string, edit: string) {
  if (s === "pending") return <StatusLabel tone="wait">Waiting</StatusLabel>;
  if (s === "rejected") return <StatusLabel tone="attention">Rejected</StatusLabel>;
  return <StatusLabel tone="done">{edit === "none" ? "Approved" : `Edited (${edit})`}</StatusLabel>;
}

export function V1Queue() {
  const [filter, setFilter] = useState<Filter>("waiting");
  const ai = useMe().me.aiEnabled;
  const { data, error, loading, reload } = useLoad(() => ok(api.review.questions.$get({ query: { status: filter } })), [filter]);
  if (loading && !data) return <Page title="Review"><Skeleton /></Page>;
  if (error || !data) return <Page title="Review"><LoadError message="Couldn't load the review queue. Reload the page." onRetry={reload} /></Page>;
  const groups = new Map<string, typeof data.items>();
  for (const q of data.items) groups.set(q.topicName, [...(groups.get(q.topicName) ?? []), q]);
  return (
    <Page title="Review" heading="Review queue" wide>
      <div className="with-panel">
        <div>
          {data.published && <p className="banner">Version 1 is published. Reviews are closed.</p>}
          <p>
            <strong>
              {data.counts.waiting} waiting · {data.counts.reviewed} reviewed
            </strong>{" "}
            · <Link to="/review/stats">Question statistics</Link>
          </p>
          {data.firstWaitingId && !data.published && (
            <p>
              <button type="button" onClick={() => navigate(`/review/${data.firstWaitingId}`)}>
                Start reviewing
              </button>
            </p>
          )}
          <div role="group" aria-label="Filter" className="row">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" className={filter === f.key ? undefined : "secondary"} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          {data.counts.total === 0 ? (
            <p>
              {ai
                ? "No questions to review yet. You'll be notified when drafts are ready."
                : "No questions to review yet. They appear here once the pilot team loads them."}
            </p>
          ) : data.counts.waiting === 0 && filter === "waiting" && !data.published ? (
            <p>
              All caught up. {data.bankOwnerName ?? "The bank owner"} can now publish{ai ? ", or may draft more questions" : ""}.
            </p>
          ) : data.items.length === 0 ? (
            <p className="muted">No questions in this list.</p>
          ) : (
            [...groups.entries()].map(([topic, items]) => (
              <section key={topic}>
                <h2>{topic}</h2>
                <ul className="plain">
                  {items.map((q) => (
                    <li key={q.id} className="row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      <Link to={`/review/${q.id}`}>{q.start}</Link>
                      {statusLabel(q.status, q.editKind)}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
        <Checklist />
      </div>
    </Page>
  );
}

type Q = Awaited<ReturnType<typeof loadQ>>;
const loadQ = (id: string) => ok(api.review.questions[":id"].$get({ param: { id } }));

export function V2Question({ params }: { params: Record<string, string> }) {
  const { data, error, loading, reload } = useLoad(() => loadQ(params.id), [params.id]);
  const [mode, setMode] = useState<"view" | "edit" | "reject">("view");
  const [msg, setMsg] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode("view");
    setSaveError(null);
  }, [params.id]);

  const decide = async (json: Record<string, unknown>) => {
    if (!data) return false;
    setBusy(true);
    setSaveError(null);
    try {
      await ok(
        api.review.questions[":id"].decision.$post({
          param: { id: String(data.id) },
          json: { expectedUpdatedAt: data.updatedAt, ...(json as { action: "approve" }) },
        }),
      );
      setMsg("Saved.");
      if (data.nextWaitingId) navigate(`/review/${data.nextWaitingId}`);
      else navigate("/review");
      return true;
    } catch (e) {
      setSaveError(e instanceof ApiError && (e.status === 409 || e.status === 400) ? e.message : "Your decision wasn't saved. Try again.");
      if (e instanceof ApiError && e.status === 400 && Array.isArray(e.body.errors)) throw e;
      return false;
    } finally {
      setBusy(false);
    }
  };

  async function undo() {
    if (!data) return;
    setBusy(true);
    setSaveError(null);
    try {
      await ok(api.review.questions[":id"].undo.$post({ param: { id: String(data.id) }, json: { expectedUpdatedAt: data.updatedAt } }));
      setMsg("Decision undone. The question is waiting for review again.");
      await reload();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Your decision wasn't saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Keyboard shortcuts A/E/R, only when focus is not in a text field (§9).
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (!data || !data.canDecide || data.status !== "pending" || mode !== "view" || busy) return;
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "a") {
      e.preventDefault();
      void decide({ action: "approve" });
    } else if (k === "e") {
      e.preventDefault();
      setMode("edit");
    } else if (k === "r") {
      e.preventDefault();
      setMode("reject");
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  if (loading && !data) return <Page title="Review a question"><Skeleton lines={10} /></Page>;
  if (error || !data)
    return (
      <Page title="Review a question">
        <LoadError message={error instanceof ApiError && error.status === 404 ? "This page isn't available to you." : "Couldn't load this question. Reload the page."} onRetry={reload} />
      </Page>
    );

  const reviewed = data.status !== "pending";
  return (
    <Page title="Review a question" wide>
      <p>
        <Link to="/review">Back to the queue</Link>
      </p>
      {data.published && <p className="banner">Version 1 is published. Reviews are closed.</p>}
      <LiveRegion>{msg}</LiveRegion>
      {saveError && (
        <p className="notice notice-error" role="alert">
          {saveError}
        </p>
      )}
      <div className="with-panel">
        <div className="two-col">
          <section aria-labelledby="src-h" className="card">
            <h2 id="src-h">Source</h2>
            {data.source.documentName ? (
              <p>
                <strong>{data.source.documentName}</strong>
                {data.source.versionDate && <span className="muted"> · version {formatDate(data.source.versionDate)}</span>}
              </p>
            ) : null}
            {data.source.removed && <p className="notice notice-warn">The source document has since been removed from the bank.</p>}
            {data.source.contextBefore && <p className="source-context">{data.source.contextBefore}</p>}
            {data.source.quote && (
              <blockquote className="quote">
                <span className="quote-label">Quoted passage</span>
                {data.source.quote}
              </blockquote>
            )}
            {data.source.contextAfter && <p className="source-context">{data.source.contextAfter}</p>}
          </section>

          <section aria-labelledby="draft-h" className="card">
            <h2 id="draft-h">Draft question</h2>
            <p className="muted">Topic: {data.topic.name}</p>
            <p>{reviewed ? statusLabel(data.status, data.editKind) : <StatusLabel tone="wait">Waiting for review</StatusLabel>}</p>
            {mode === "edit" ? (
              <EditForm q={data} busy={busy} onCancel={() => setMode("view")} onSave={(json) => decide({ action: "edit", ...json })} />
            ) : (
              <>
                <p>
                  <strong>{data.text}</strong>
                </p>
                <ol type="A" className="plain">
                  {data.options.map((o, i) => (
                    <li key={i} className="option">
                      <span>
                        <strong>{LETTERS[i]}.</strong> {o}{" "}
                        {i === data.correctIndex && <StatusLabel tone="ok">Correct answer</StatusLabel>}
                      </span>
                    </li>
                  ))}
                </ol>
                {data.status === "rejected" && (data.rejectReasons.length > 0 || data.rejectNote) && (
                  <p className="muted">
                    Reason: {[...data.rejectReasons, data.rejectNote].filter(Boolean).join(" · ")}
                  </p>
                )}
                {mode === "reject" && (
                  <RejectForm q={data} busy={busy} onCancel={() => setMode("view")} onReject={(json) => decide({ action: "reject", ...json })} />
                )}
                {data.canDecide && !reviewed && mode === "view" && (
                  <div className="actions">
                    <button type="button" disabled={busy} onClick={() => decide({ action: "approve" })} aria-keyshortcuts="A">
                      Approve (A)
                    </button>
                    <button type="button" className="secondary" disabled={busy} onClick={() => setMode("edit")} aria-keyshortcuts="E">
                      Edit (E)
                    </button>
                    <button type="button" className="secondary" disabled={busy} onClick={() => setMode("reject")} aria-keyshortcuts="R">
                      Reject (R)
                    </button>
                  </div>
                )}
                {data.canDecide && reviewed && (
                  <div className="actions">
                    <button type="button" className="secondary" disabled={busy} onClick={undo}>
                      Undo
                    </button>
                  </div>
                )}
              </>
            )}
            <nav aria-label="Questions" className="actions">
              {data.prevId && <Link to={`/review/${data.prevId}`}>Previous</Link>}
              {data.nextId && <Link to={`/review/${data.nextId}`}>Next</Link>}
            </nav>
          </section>
        </div>
        <Checklist />
      </div>
    </Page>
  );
}

function EditForm({ q, busy, onCancel, onSave }: { q: Q; busy: boolean; onCancel: () => void; onSave: (json: Record<string, unknown>) => Promise<boolean> }) {
  const [text, setText] = useState(q.text);
  const [options, setOptions] = useState<string[]>([...q.options]);
  const [correct, setCorrect] = useState<number>(q.correctIndex);
  const [kind, setKind] = useState<"" | "minor" | "substantial">("");
  const [errors, setErrors] = useState<FieldError[]>([]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: FieldError[] = [];
    if (!text.trim()) errs.push({ field: "edit-text", message: "Add the question text." });
    options.forEach((o, i) => {
      if (!o.trim()) errs.push({ field: `edit-option-${i}`, message: `Add option ${LETTERS[i]}.` });
    });
    if (options.every((o) => o.trim()) && new Set(options.map((o) => o.trim().toLowerCase())).size !== 4)
      errs.push({ field: "edit-option-0", message: "The 4 options must be different." });
    if (!kind) errs.push({ field: "edit-kind-minor", message: "Say what kind of change this was." });
    setErrors(errs);
    if (errs.length) return;
    try {
      await onSave({ text, options, correctIndex: correct, editKind: kind });
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.body.errors)) setErrors(err.body.errors as FieldError[]);
    }
  }
  const e = (f: string) => errors.find((x) => x.field === f)?.message;
  return (
    <form onSubmit={submit} noValidate className="stack">
      <ErrorSummary errors={errors} />
      <label htmlFor="edit-text">Question</label>
      <InlineError id="edit-text" message={e("edit-text")} />
      <textarea id="edit-text" value={text} onChange={(ev) => setText(ev.target.value)} {...errProps("edit-text", e("edit-text"))} style={{ minHeight: 80 }} />
      <fieldset>
        <legend>Options (choose the correct one)</legend>
        {options.map((o, i) => (
          <div key={i} className="stack" style={{ marginBottom: 8 }}>
            <label htmlFor={`edit-option-${i}`}>Option {LETTERS[i]}</label>
            <InlineError id={`edit-option-${i}`} message={e(`edit-option-${i}`)} />
            <div className="row">
              <input
                id={`edit-option-${i}`}
                value={o}
                onChange={(ev) => setOptions(options.map((x, j) => (j === i ? ev.target.value : x)))}
                {...errProps(`edit-option-${i}`, e(`edit-option-${i}`))}
                style={{ flex: 1 }}
              />
              <label className="option">
                <input type="radio" name="edit-correct" id={i === 0 ? "edit-correct" : undefined} checked={correct === i} onChange={() => setCorrect(i)} />
                Correct
              </label>
            </div>
          </div>
        ))}
      </fieldset>
      <fieldset>
        <legend>What kind of change was this?</legend>
        <InlineError id="edit-kind-minor" message={e("edit-kind-minor")} />
        <label className="option">
          <input type="radio" id="edit-kind-minor" name="edit-kind" checked={kind === "minor"} onChange={() => setKind("minor")} />
          Minor: wording or typo, same meaning
        </label>
        <label className="option">
          <input type="radio" name="edit-kind" checked={kind === "substantial"} onChange={() => setKind("substantial")} />
          Substantial: changed the answer, an option or what's being tested
        </label>
      </fieldset>
      <div className="actions">
        <button type="submit" disabled={busy}>
          Save and approve
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RejectForm({ q, busy, onCancel, onReject }: { q: Q; busy: boolean; onCancel: () => void; onReject: (json: Record<string, unknown>) => Promise<boolean> }) {
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  return (
    <form
      className="stack card"
      onSubmit={(e) => {
        e.preventDefault();
        void onReject({ reasons, note });
      }}
    >
      <fieldset>
        <legend>Reason (optional)</legend>
        <div className="chips">
          {q.rejectReasonOptions.map((r) => (
            <label key={r.code} className="chip">
              <input
                type="checkbox"
                checked={reasons.includes(r.code)}
                onChange={(e) => setReasons(e.target.checked ? [...reasons, r.code] : reasons.filter((x) => x !== r.code))}
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="reject-note">Note (optional)</label>
      <input id="reject-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      <div className="actions">
        <button type="submit" className="danger" disabled={busy}>
          Reject
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function V3Stats() {
  const ai = useMe().me.aiEnabled;
  const { data, error, loading, reload } = useLoad(() => ok(api.stats.$get()));
  if (loading && !data) return <Page title="Question statistics"><Skeleton /></Page>;
  if (error || !data) return <Page title="Question statistics"><LoadError message="Couldn't load the statistics. Reload the page." onRetry={reload} /></Page>;
  const t = data.m3.total;
  return (
    <Page title="Question statistics" wide>
      <p>
        <Link to="/review">Back to the queue</Link>
      </p>
      <h2>Review outcomes</h2>
      {ai ? (
        <p>
          Drafts reviewed: {t.reviewed}. Approved as is: {t.approvedAsIs}. Edited (minor): {t.minor}. Edited (substantial): {t.substantial}. Rejected:{" "}
          {t.rejected}. <strong>Rewrite rate: {t.rewriteRatePct === null ? "not yet known" : `${t.rewriteRatePct}%`}</strong> (kill line: more than 50%).
        </p>
      ) : (
        <p>
          Questions reviewed: {t.reviewed}. Approved as is: {t.approvedAsIs}. Edited (minor): {t.minor}. Edited (substantial): {t.substantial}. Rejected:{" "}
          {t.rejected}.
        </p>
      )}
      <DataTable
        caption="By topic"
        head={["Topic", "Reviewed", "Approved as is", "Edited (minor)", "Edited (substantial)", "Rejected", ...(ai ? ["Rewrite rate"] : [])]}
      >
        {data.m3.byTopic.map((r) => (
          <tr key={r.topicId}>
            <th scope="row">{r.topic}</th>
            <td>{r.reviewed}</td>
            <td>{r.approvedAsIs}</td>
            <td>{r.minor}</td>
            <td>{r.substantial}</td>
            <td>{r.rejected}</td>
            {ai && <td>{r.rewriteRatePct === null ? "–" : `${r.rewriteRatePct}%`}</td>}
          </tr>
        ))}
      </DataTable>
      <h2>Answer statistics per question</h2>
      {!data.published ? (
        <p className="muted">No version is published yet.</p>
      ) : (
        <DataTable head={["Form", "Topic", "Question", "Answers"]}>
          {data.questions.map((q) => (
            <tr key={q.id}>
              <td>{q.form === "A" ? "Check 1" : "Check 2"}</td>
              <td>{q.topic}</td>
              <td>{q.start}</td>
              <td>
                {q.shown
                  ? `${q.pctCorrect}% correct · chosen: ${q.optionCounts!.map((n, i) => `${LETTERS[i]} ${n}`).join(", ")}`
                  : `Not shown: fewer than ${data.minRespondents} people have answered this question. Showing it would identify them.`}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </Page>
  );
}
