// A4 Publish version (F3, F4, F7).
import { useEffect, useMemo, useState } from "react";
import { api, ok, ApiError } from "../api";
import { Page, Skeleton, LoadError, ConfirmDialog, DataTable, StatusLabel, LiveRegion } from "../components/ui";
import { useLoad } from "../lib/useLoad";
import { Link } from "../lib/router";
import { formatDate } from "../../shared/dates";
import { useMe } from "../lib/me";
import { MIN_PER_FORM, thresholdExplanation } from "../../shared/scoring";

type Data = Awaited<ReturnType<typeof load>>;
const load = () => ok(api.publish.$get());
type ListKey = "A" | "B" | "unused";
const LIST_LABEL: Record<ListKey, string> = { A: "Form A", B: "Form B", unused: "Not used" };

export function A4Publish() {
  const { data, error, loading, reload } = useLoad(load);
  if (loading && !data) return <Page title="Publish version"><Skeleton lines={8} /></Page>;
  if (error || !data) return <Page title="Publish version"><LoadError message="Couldn't load the publish page. Reload the page." onRetry={reload} /></Page>;
  if (data.published) return <Published data={data} />;
  return <Draft data={data} reload={reload} />;
}

function Published({ data }: { data: Data }) {
  const p = data.published!;
  return (
    <Page title="Publish version" heading="Version 1 (published)" wide>
      <p className="banner">
        Version 1 was published on {formatDate(p.date)}. It stays unchanged for the whole pilot. Flag threshold: {p.thresholdPct}%.
      </p>
      {p.topics.map((t) => (
        <section key={t.id} className="card">
          <h2>{t.name}</h2>
          <p className="muted">{thresholdExplanation(t.A.length, p.thresholdPct)}</p>
          <div className="two-col">
            {(["A", "B"] as const).map((f) => (
              <div key={f}>
                <h3>{LIST_LABEL[f]}</h3>
                <ol>
                  {t[f].map((q) => (
                    <li key={q.id}>{q.text}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ))}
    </Page>
  );
}

type Split = Record<ListKey, number[]>;

function Draft({ data, reload }: { data: Data; reload: () => Promise<void> }) {
  const ai = useMe().me.aiEnabled;
  const [splits, setSplits] = useState<Record<number, Split>>({});
  const [included, setIncluded] = useState<Record<number, boolean>>({});
  const [threshold, setThreshold] = useState<string>(String(data.defaultThreshold));
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setSplits(Object.fromEntries(data.topics.map((t) => [t.id, { ...t.split }])));
    setIncluded(Object.fromEntries(data.topics.map((t) => [t.id, true])));
  }, [data]);

  const text = useMemo(() => new Map(data.topics.flatMap((t) => t.approved.map((q) => [q.id, q.text] as const))), [data]);
  const thr = Number(threshold);
  const thrValid = Number.isInteger(thr) && thr >= 1 && thr <= 100;

  const incl = data.topics.filter((t) => included[t.id] && splits[t.id]);
  const reasons: string[] = [];
  const noun = ai ? "draft" : "question";
  if (data.pendingCount > 0) reasons.push(`${data.pendingCount} ${data.pendingCount === 1 ? `${noun} is` : `${noun}s are`} still waiting for review.`);
  if (!incl.length) reasons.push("Include at least one topic.");
  for (const t of incl)
    if (splits[t.id].A.length < MIN_PER_FORM)
      reasons.push(`${t.name}: ${t.approved.length} approved. Needs at least ${2 * MIN_PER_FORM} (${MIN_PER_FORM} per form).`);
  if (!thrValid) reasons.push("The flag threshold must be a whole number from 1 to 100.");
  const totalA = incl.reduce((n, t) => n + splits[t.id].A.length, 0);

  function swap(topicId: number, fromList: ListKey, qid: number, toList: ListKey, otherId: number) {
    setSplits((s) => {
      const cur = s[topicId];
      const next: Split = { A: [...cur.A], B: [...cur.B], unused: [...cur.unused] };
      next[fromList][next[fromList].indexOf(qid)] = otherId;
      next[toList][next[toList].indexOf(otherId)] = qid;
      return { ...s, [topicId]: next };
    });
    setMsg(`Moved to ${LIST_LABEL[toList]}. Swapped with a question from ${LIST_LABEL[toList]}.`);
  }

  async function publish() {
    setErr(null);
    try {
      await ok(
        api.publish.$post({
          json: { thresholdPct: thr, topics: incl.map((t) => ({ topicId: t.id, A: splits[t.id].A, B: splits[t.id].B })) },
        }),
      );
      setConfirm(false);
      await reload();
    } catch (e) {
      setConfirm(false);
      setErr(e instanceof ApiError ? e.message : "Publishing failed. Nothing was changed. Try again.");
    }
  }

  return (
    <Page title="Publish version" wide>
      <p>
        <Link to="/bank">Back to the bank</Link>
      </p>
      {data.topics.length === 0 ? (
        <p>
          {ai
            ? "No approved questions yet. Draft and review questions on the bank page first."
            : "No approved questions yet. Review the loaded questions first."}
        </p>
      ) : (
        <>
          <DataTable head={["Topic", "Approved questions", "Form A", "Form B", "Included"]}>
            {data.topics.map((t) => {
              const s = splits[t.id];
              return (
                <tr key={t.id}>
                  <th scope="row">{t.name}</th>
                  <td>{t.approved.length}</td>
                  <td>{s?.A.length ?? 0}</td>
                  <td>{s?.B.length ?? 0}</td>
                  <td>
                    <label className="option">
                      <input
                        type="checkbox"
                        checked={!!included[t.id]}
                        onChange={(e) => setIncluded({ ...included, [t.id]: e.target.checked })}
                      />
                      <span className="sr-only">Include {t.name}</span>
                      {included[t.id] ? "Included" : "Left out"}
                    </label>
                  </td>
                </tr>
              );
            })}
          </DataTable>
          <LiveRegion>{msg}</LiveRegion>

          {incl.map((t) => (
            <details key={t.id} className="card">
              <summary>
                <strong>{t.name}</strong>: questions by form
              </summary>
              <p className="hint">Moving keeps the counts equal, so a move swaps with a question in the other list.</p>
              {(["A", "B", "unused"] as const).map((list) => (
                <div key={list}>
                  <h3>{LIST_LABEL[list]}</h3>
                  {splits[t.id][list].length === 0 ? (
                    <p className="muted">None.</p>
                  ) : (
                    <ul>
                      {splits[t.id][list].map((qid) => (
                        <li key={qid}>
                          {text.get(qid)}{" "}
                          <MoveSelect
                            label={`Move "${text.get(qid)?.slice(0, 40)}" to…`}
                            options={(["A", "B", "unused"] as const)
                              .filter((l) => l !== list)
                              .map((l) => ({ list: l, items: splits[t.id][l].map((id) => ({ id, text: text.get(id) ?? "" })) }))}
                            onPick={(to, other) => swap(t.id, list, qid, to, other)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </details>
          ))}

          <h2>Flag threshold</h2>
          <label htmlFor="threshold">Flag a topic when it scores below (%)</label>
          <div className="row">
            <input
              id="threshold"
              type="number"
              min={1}
              max={100}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              aria-invalid={!thrValid}
              style={{ width: 90 }}
            />
            %
          </div>
          {thrValid && (
            <ul>
              {[...new Set(incl.map((t) => splits[t.id].A.length))]
                .filter((n) => n > 0)
                .map((n) => (
                  <li key={n}>
                    {thresholdExplanation(n, thr)}{" "}
                    <span className="muted">({incl.filter((t) => splits[t.id].A.length === n).map((t) => t.name).join(", ")})</span>
                  </li>
                ))}
            </ul>
          )}

          <h2>Summary</h2>
          <p>
            Form A: {totalA} questions across {incl.length} topics. Form B: {totalA} questions across {incl.length} topics. About {totalA} minutes each.
          </p>
          {reasons.length > 0 && (
            <div className="notice notice-warn">
              <p>
                <strong>Publish isn't available yet:</strong>
              </p>
              <ul>
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {err && (
            <p className="notice notice-error" role="alert">
              {err}
            </p>
          )}
          <button type="button" disabled={reasons.length > 0} onClick={() => setConfirm(true)}>
            Publish
          </button>
          {reasons.length === 0 && <StatusLabel tone="ok">Ready to publish</StatusLabel>}
        </>
      )}
      <ConfirmDialog
        open={confirm}
        title="Publish version 1?"
        onClose={() => setConfirm(false)}
        actions={
          <>
            <button type="button" onClick={publish}>
              Publish
            </button>
            <button type="button" className="secondary" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </>
        }
      >
        <p>
          The questions, forms and threshold can't be changed after this, and this version is used for the whole pilot. Every attempt will be
          scored against exactly these questions.
        </p>
      </ConfirmDialog>
    </Page>
  );
}

function MoveSelect({
  label,
  options,
  onPick,
}: {
  label: string;
  options: { list: ListKey; items: { id: number; text: string }[] }[];
  onPick: (to: ListKey, otherId: number) => void;
}) {
  const usable = options.filter((o) => o.items.length);
  if (!usable.length) return null;
  return (
    <select
      aria-label={label}
      value=""
      onChange={(e) => {
        const [to, id] = e.target.value.split(":");
        if (to && id) onPick(to as ListKey, Number(id));
      }}
    >
      <option value="">Move to…</option>
      {usable.map((o) => (
        <optgroup key={o.list} label={`${LIST_LABEL[o.list]} (swap with)`}>
          {o.items.map((q) => (
            <option key={q.id} value={`${o.list}:${q.id}`}>
              {LIST_LABEL[o.list]}, swapping with: {q.text.slice(0, 60)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
