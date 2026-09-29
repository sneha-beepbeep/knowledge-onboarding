// A1 Pilot overview (admin home).
import { useState, type FormEvent } from "react";
import { api, ok, ApiError } from "../api";
import { Page, Skeleton, LoadError, StatusLabel, ErrorSummary, InlineError, LiveRegion, DataTable, ConfirmDialog } from "../components/ui";
import { CopyLink } from "../components/CopyLink";
import { useLoad } from "../lib/useLoad";
import { Link } from "../lib/router";
import { formatDate } from "../../shared/dates";

type Data = Awaited<ReturnType<typeof load>>;
const load = () => ok(api.pilot.$get());


export function A1Pilot() {
  const { data, error, loading, reload } = useLoad(load);
  if (loading && !data) return <Page title="Pilot"><Skeleton lines={8} /></Page>;
  if (error || !data)
    return (
      <Page title="Pilot">
        <LoadError message="Couldn't load the pilot status. Reload the page." onRetry={reload} />
      </Page>
    );
  return (
    <Page title="Pilot" heading="Pilot overview" wide>
      <p>
        <Link to="/people">People & roles</Link>
      </p>
      {data.k3 && (
        <p className="banner" role="note">
          <span aria-hidden="true">⚠ </span>Rewrite rate is above 50%. This is kill signal K3 in the PRD. Consider <code>/checkpoint</code>.
        </p>
      )}
      <SendFormA data={data} reload={reload} />
      <Readiness data={data} reload={reload} />
      <Loop data={data} />
      <KeyDates data={data} />
      <Quality data={data} />
    </Page>
  );
}

function Readiness({ data, reload }: { data: Data; reload: () => Promise<void> }) {
  const r = data.readiness;
  const [expanded, setExpanded] = useState(!r.complete);
  if (r.complete && !expanded)
    return (
      <section aria-labelledby="ready-h">
        <h2 id="ready-h">Readiness</h2>
        <p>
          <StatusLabel tone="done">Ready since {r.readySince ? formatDate(r.readySince) : "today"}</StatusLabel>{" "}
          <button type="button" className="link" onClick={() => setExpanded(true)}>
            Show checklist
          </button>
        </p>
      </section>
    );
  const done = (b: boolean) => (b ? <StatusLabel tone="done">Done</StatusLabel> : <StatusLabel tone="wait">Not done</StatusLabel>);
  return (
    <section aria-labelledby="ready-h">
      <h2 id="ready-h">Readiness</h2>
      <DataTable head={["Item", "Status", "Action"]}>
        <tr>
          <th scope="row">Roles named</th>
          <td>{done(r.items.rolesNamed)}</td>
          <td>
            <Link to="/people">Assign roles</Link>
          </td>
        </tr>
        <tr>
          <th scope="row">AI provider set up</th>
          <td>
            {r.items.aiSetUp ? (
              <StatusLabel tone="done">Set up</StatusLabel>
            ) : (
              <StatusLabel tone="wait">Not set up</StatusLabel>
            )}
          </td>
          <td>{r.items.aiSetUp ? "" : "Not set up. The provider must be approved before any material is sent (PRD Q2)."}</td>
        </tr>
        <tr>
          <th scope="row">Bank published</th>
          <td>{done(r.items.bankPublished)}</td>
          <td>
            <Link to="/bank">Go to bank</Link>
          </td>
        </tr>
        <tr>
          <th scope="row">HR sign-off recorded</th>
          <td>
            {done(r.items.hrSignoff)}
            {data.hr.date && (
              <div className="muted">
                {formatDate(data.hr.date)}, signed off by {data.hr.by}
                {data.hr.noticeVersion !== data.hr.currentNoticeVersion &&
                  ` (for notice version ${data.hr.noticeVersion}; the current notice is version ${data.hr.currentNoticeVersion}, so sign-off is needed again)`}
              </div>
            )}
          </td>
          <td>{data.isCpo ? <HrSignoff today={data.today} onSaved={reload} /> : "Recorded by the CPO."}</td>
        </tr>
      </DataTable>
    </section>
  );
}

function HrSignoff({ today, onSaved }: { today: string; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [by, setBy] = useState("");
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);
  const [msg, setMsg] = useState("");
  if (!open)
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        Record sign-off
      </button>
    );
  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = [];
    if (!date) errs.push({ field: "hr-date", message: "Add the date of the sign-off." });
    else if (date > today) errs.push({ field: "hr-date", message: "The sign-off date can't be in the future." });
    if (!by.trim()) errs.push({ field: "hr-by", message: "Add who signed off." });
    setErrors(errs);
    if (errs.length) return;
    try {
      await ok(api.pilot["hr-signoff"].$post({ json: { date, by } }));
      setMsg("Sign-off recorded.");
      setOpen(false);
      await onSaved();
    } catch (err) {
      setErrors([{ field: "hr-date", message: err instanceof ApiError ? err.message : "Not saved. Try again." }]);
    }
  }
  const e = (f: string) => errors.find((x) => x.field === f)?.message;
  return (
    <form onSubmit={submit} className="stack" noValidate>
      <ErrorSummary errors={errors} />
      <label htmlFor="hr-date">Date</label>
      <InlineError id="hr-date" message={e("hr-date")} />
      <input id="hr-date" type="date" max={today} value={date} onChange={(ev) => setDate(ev.target.value)} aria-invalid={!!e("hr-date")} />
      <label htmlFor="hr-by">Signed off by</label>
      <InlineError id="hr-by" message={e("hr-by")} />
      <input id="hr-by" value={by} onChange={(ev) => setBy(ev.target.value)} aria-invalid={!!e("hr-by")} />
      <div className="actions">
        <button type="submit">Save</button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <LiveRegion>{msg}</LiveRegion>
    </form>
  );
}

/** A5 Send Form A (dialog on A1; F5, C6, §6 gate). No email: copy the link, then Mark as sent. */
function SendFormA({ data, reload }: { data: Data; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const student = data.student?.name ?? "the student";
  if (!data.readiness.complete)
    return (
      <p className="card">
        <StatusLabel tone="wait">Complete the readiness checklist to send Form A.</StatusLabel>
      </p>
    );
  async function createLink() {
    setErr(null);
    try {
      const r = await ok(api.pilot["form-a"].link.$post());
      setUrl(r.url);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "The link couldn't be created. Try again.");
    }
  }
  async function markSent() {
    try {
      await ok(api.pilot["form-a"].sent.$post());
      close();
      await reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Not saved. Try again.");
    }
  }
  function close() {
    setOpen(false);
    setUrl(null);
    setErr(null);
  }
  const again = !!data.formASent;
  return (
    <section className="card" aria-labelledby="send-h">
      <h2 id="send-h">Form A</h2>
      {again && <p>Form A sent {formatDate(data.formASent!)}.</p>}
      <button type="button" className={again ? "secondary" : undefined} onClick={() => setOpen(true)}>
        {again ? "Copy Form A link again" : `Send Form A to ${student}`}
      </button>
      <ConfirmDialog
        open={open}
        title={`Send Form A to ${student}?`}
        onClose={close}
        actions={
          url ? (
            <>
              {!again && (
                <button type="button" onClick={markSent}>
                  Mark as sent
                </button>
              )}
              <button type="button" className="secondary" onClick={close}>
                {again ? "Done" : "Cancel"}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={createLink}>
                {again ? "Create a new link" : "Create link"}
              </button>
              <button type="button" className="secondary" onClick={close}>
                Cancel
              </button>
            </>
          )
        }
      >
        <p>They'll first see the notice explaining what the check is for and that taking part is voluntary.</p>
        {again && <p className="hint">This creates a new link. The link you sent before stops working.</p>}
        {err && (
          <p className="error" role="alert">
            {err}
          </p>
        )}
        {url && (
          <>
            <p>Copy this link and send it to {student} the way you normally would:</p>
            <CopyLink url={url} label={`Form A link for ${student}`} />
            <p className="hint">This link signs {student} in. Send it only to them, privately.</p>
          </>
        )}
      </ConfirmDialog>
    </section>
  );
}

function Loop({ data }: { data: Data }) {
  return (
    <section aria-labelledby="loop-h">
      <h2 id="loop-h">Pilot loop</h2>
      {data.deletion && (
        <p className="notice">
          Data deleted for {data.deletion.name} on {formatDate(data.deletion.date)} by {data.deletion.by}.
        </p>
      )}
      <DataTable head={["Stage", "Status"]}>
        {data.loop.map((r) => (
          <tr key={r.stage}>
            <th scope="row">{r.stage}</th>
            <td>
              <StatusLabel tone={r.tone === "attention" ? "attention" : r.tone}>{r.status}</StatusLabel>
              {r.link && (
                <>
                  {" "}
                  <Link to={r.link}>Open</Link>
                </>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

function KeyDates({ data }: { data: Data }) {
  const k = data.keyDates;
  return (
    <section aria-labelledby="dates-h">
      <h2 id="dates-h">Key dates</h2>
      {k.dayZero ? (
        <dl className="kv">
          <dt>Day 0 (check 1 submitted)</dt>
          <dd>{formatDate(k.dayZero)}</dd>
          <dt>Day 90 (the review)</dt>
          <dd>{formatDate(k.dayNinety!)}</dd>
          <dt>Retention</dt>
          <dd>Delete identifiable results by {formatDate(k.retention!)}</dd>
        </dl>
      ) : (
        <p className="muted">Day 0 is set when the student submits check 1. Day 90 and the deletion date follow from it.</p>
      )}
    </section>
  );
}

function Quality({ data }: { data: Data }) {
  const m = data.m3;
  return (
    <section aria-labelledby="m3-h">
      <h2 id="m3-h">Review quality (M3)</h2>
      <p>
        Drafts reviewed: {m.reviewed}. Approved as is: {m.approvedAsIs}. Edited (minor): {m.minor}. Edited (substantial): {m.substantial}. Rejected:{" "}
        {m.rejected}. <strong>Rewrite rate: {m.rewriteRatePct === null ? "not yet known" : `${m.rewriteRatePct}%`}</strong> (kill line: more than 50%).
      </p>
      <p>
        <Link to="/review/stats">Question statistics</Link> · <Link to="/review">Review queue</Link> · <Link to="/flags">Flags</Link>
      </p>
    </section>
  );
}
