// A6 Data: export & delete (F10, F11, §6).
import { useState } from "react";
import { api, ok, ApiError } from "../api";
import { Page, Skeleton, LoadError, LiveRegion } from "../components/ui";
import { useLoad } from "../lib/useLoad";
import { formatDate } from "../../shared/dates";

export function A6Data() {
  const { data, error, loading, reload } = useLoad(() => ok(api.data.people.$get()));
  const [exportMsg, setExportMsg] = useState("");
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string>("");
  const [confirm, setConfirm] = useState("");
  const [delMsg, setDelMsg] = useState<string | null>(null);
  const [delErr, setDelErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Page title="Data"><Skeleton /></Page>;
  if (error || !data) return <Page title="Data"><LoadError message="Couldn't load this page. Reload the page." onRetry={reload} /></Page>;

  const retention = data.retention ? formatDate(data.retention) : "30 days after the 90-day review";
  const student = data.studentName ?? "the student";
  const person = data.people.find((p) => String(p.id) === personId);

  async function download() {
    setExportErr(null);
    setExportMsg("");
    try {
      const res = await api.export.$get();
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "knowledge-check-export.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg(`Downloaded ${name}.`);
    } catch {
      setExportErr("The export couldn't be created. Try again.");
    }
  }

  async function del() {
    if (!person) return;
    setBusy(true);
    setDelErr(null);
    try {
      await ok(api.data.people[":id"].$delete({ param: { id: String(person.id) }, json: { confirmName: confirm } }));
      setDelMsg(`Data for ${person.name} was deleted.`);
      setPersonId("");
      setConfirm("");
      await reload();
    } catch (e) {
      setDelErr(e instanceof ApiError && e.status === 400 ? e.message : "Nothing was deleted. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const c = person?.counts;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <Page title="Data" heading="Data: export & delete">
      <p className="notice">Retention: identifiable results must be deleted by {retention}.</p>

      <section aria-labelledby="export-h" className="card">
        <h2 id="export-h">Export</h2>
        <p className="notice notice-warn">
          These files contain personal data about {student}. Keep them only where HR has agreed, and delete them by {retention}.
        </p>
        {data.hasExportData ? (
          <button type="button" onClick={download}>
            Download CSV files
          </button>
        ) : (
          <>
            <p>Nothing to export yet</p>
            <button type="button" disabled>
              Download CSV files
            </button>
          </>
        )}
        <LiveRegion>{exportMsg}</LiveRegion>
        {exportErr && <p className="error" role="alert">{exportErr}</p>}
      </section>

      <section aria-labelledby="delete-h" className="card">
        <h2 id="delete-h">Delete a person's data</h2>
        {data.deletions.map((d, i) => (
          <p key={i} className="muted">
            Data deleted for {d.name} on {formatDate(d.date)} by {d.by}.
          </p>
        ))}
        <LiveRegion>{delMsg}</LiveRegion>
        {data.people.length === 0 ? (
          <p className="muted">Nobody has attempts, flags or a participation record.</p>
        ) : (
          <div className="stack">
            <label htmlFor="del-person">Person</label>
            <select
              id="del-person"
              value={personId}
              onChange={(e) => {
                setPersonId(e.target.value);
                setConfirm("");
                setDelErr(null);
              }}
            >
              <option value="">Choose…</option>
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {person && c && (
              <>
                <p>
                  This permanently deletes for {person.name}: {plural(c.attempts, "attempt", "attempts")}, {plural(c.answers, "answer", "answers")},{" "}
                  {plural(c.flags, "flag", "flags")}, {plural(c.followups, "follow-up entry", "follow-up entries")},{" "}
                  {plural(c.participation, "participation record", "participation records")}. It keeps: review outcomes (these contain no names). It
                  can't be undone. Files that have already been exported are not affected. Delete those separately.
                </p>
                <label htmlFor="del-confirm">Type the person's full name to confirm</label>
                <input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
                {delErr && <p className="error" role="alert">{delErr}</p>}
                <div>
                  <button type="button" className="danger" disabled={busy || confirm.trim() !== person.name} onClick={del}>
                    Delete permanently
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </Page>
  );
}
