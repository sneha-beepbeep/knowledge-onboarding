// A3 Bank: material & topics (F1, F2).
import { useEffect, useState, type ReactNode } from "react";
import { api, ok, ApiError } from "../api";
import { Page, Skeleton, LoadError, ConfirmDialog, LiveRegion, StatusLabel } from "../components/ui";
import { useLoad } from "../lib/useLoad";
import { Link } from "../lib/router";
import { AddDocumentDialog } from "./A3aAddDocument";
import { formatDate } from "../../shared/dates";
import { MAX_PER_FORM, MIN_PER_FORM } from "../../shared/scoring";

export type BankData = Awaited<ReturnType<typeof loadBank>>;
export const loadBank = () => ok(api.bank.$get());

export function A3Bank() {
  const { data, error, loading, reload } = useLoad(loadBank);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<{ id: number; name: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [consentFor, setConsentFor] = useState<{ id: number; kind: "initial" | "more" } | null>(null);
  const [startError, setStartError] = useState<Record<number, string>>({});

  // Drafting runs in the background; check progress every 3 seconds while any topic is drafting.
  const anyRunning = !!data?.topics.some((t) => t.run?.status === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const h = setInterval(() => void reload(), 3000);
    return () => clearInterval(h);
  }, [anyRunning, reload]);

  if (loading && !data) return <Page title="Bank"><Skeleton lines={8} /></Page>;
  if (error || !data) return <Page title="Bank"><LoadError message="Couldn't load the bank. Reload the page." onRetry={reload} /></Page>;

  const locked = !!data.published;

  async function setCount(n: number) {
    try {
      await ok(api.bank.settings.$put({ json: { perTopicCount: n } }));
      setMsg(`Questions per topic per form set to ${n}.`);
      await reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Not saved. Try again.");
    }
  }

  async function startDraft(id: number, kind: "initial" | "more", consented = false) {
    if (!data!.consentGiven && !consented) return setConsentFor({ id, kind });
    setStartError((e) => ({ ...e, [id]: "" }));
    try {
      if (consented) await ok(api.bank.consent.$post());
      await ok(api.topics[":id"].drafts.$post({ param: { id: String(id) }, json: { kind } }));
      await reload();
    } catch (e) {
      setStartError((x) => ({ ...x, [id]: e instanceof ApiError ? e.message : "Drafting couldn't start. Try again." }));
    }
  }

  async function remove() {
    if (!removing) return;
    try {
      await ok(api.documents[":id"].$delete({ param: { id: String(removing.id) } }));
      setMsg(`${removing.name} was removed.`);
      setRemoving(null);
      await reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Couldn't remove the document. Try again.");
      setRemoving(null);
    }
  }

  return (
    <Page title="Bank" heading="Bank: material & topics" wide>
      {locked && (
        <p className="banner">
          Version 1 was published on {formatDate(data.published!.date)}. It stays unchanged for the whole pilot.
        </p>
      )}
      <div className="row">
        {!locked && (
          <button type="button" onClick={() => setAdding(true)}>
            Add document
          </button>
        )}
        <label htmlFor="per-topic">Questions per topic per form</label>
        <select
          id="per-topic"
          value={data.perTopicCount}
          disabled={locked}
          onChange={(e) => setCount(Number(e.target.value))}
        >
          {Array.from({ length: MAX_PER_FORM - MIN_PER_FORM + 1 }, (_, i) => MIN_PER_FORM + i).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <Link to="/publish">{locked ? "See the published forms" : "Publish version"}</Link>
      </div>
      <LiveRegion>{msg}</LiveRegion>
      {data.aiEnabled && !data.aiSetUp && !locked && (
        <p className="notice notice-warn">AI drafting isn't set up yet. The provider must be approved first.</p>
      )}
      {!data.aiEnabled && !locked && (
        <p className="notice">
          AI drafting is off for this round. The questions are written by the team and loaded by the pilot team, then reviewed
          here like any draft.
        </p>
      )}

      {data.topics.length === 0 ? (
        <div className="card">
          <p>
            No material yet. Add the onboarding documents you want the quiz to be based on. Only what you add here is used.
            Nothing is taken from the web.
          </p>
          {!locked && (
            <button type="button" onClick={() => setAdding(true)}>
              Add document
            </button>
          )}
        </div>
      ) : (
        data.topics.map((t) => (
          <TopicCard
            key={t.id}
            topic={t}
            data={data}
            locked={locked}
            onRemove={setRemoving}
            drafting={
              data.aiEnabled ? <DraftControls topic={t} data={data} locked={locked} error={startError[t.id]} onStart={startDraft} /> : undefined
            }
          />
        ))
      )}

      <AddDocumentDialog
        open={adding}
        topicNames={data.topicNames}
        onClose={() => setAdding(false)}
        onSaved={async () => {
          setMsg("Document added.");
          await reload();
        }}
      />
      <ConfirmDialog
        open={!!consentFor}
        title="Before the first draft"
        onClose={() => setConsentFor(null)}
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                const c = consentFor!;
                setConsentFor(null);
                void startDraft(c.id, c.kind, true);
              }}
            >
              Continue
            </button>
            <button type="button" className="secondary" onClick={() => setConsentFor(null)}>
              Cancel
            </button>
          </>
        }
      >
        <p>
          Drafting sends the text of this topic's documents to {data.providerName}. Only onboarding material is sent. No
          names, answers or results are ever sent. Only continue if these documents are cleared for this provider.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name ?? "document"}?`}
        onClose={() => setRemoving(null)}
        actions={
          <>
            <button type="button" className="danger" onClick={remove}>
              Remove
            </button>
            <button type="button" className="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </button>
          </>
        }
      >
        <p>The document is removed from the bank. Drafts already made from it stay in review, with their source passage.</p>
      </ConfirmDialog>
    </Page>
  );
}

export function TopicCard({
  topic: t,
  data,
  locked,
  onRemove,
  drafting,
}: {
  topic: BankData["topics"][number];
  data: BankData;
  locked: boolean;
  onRemove: (d: { id: number; name: string }) => void;
  drafting?: ReactNode;
}) {
  const needed = data.perTopicCount * 2;
  const c = t.counts;
  return (
    <section className="card" aria-labelledby={`topic-${t.id}`}>
      <h2 id={`topic-${t.id}`}>{t.name}</h2>
      <h3>Documents</h3>
      <ul>
        {t.documents.map((d) => (
          <li key={d.id}>
            {d.name} <span className="muted">(version {formatDate(d.versionDate)})</span>{" "}
            {!locked && (
              <button type="button" className="link" onClick={() => onRemove({ id: d.id, name: d.name })}>
                Remove<span className="sr-only"> {d.name}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      <h3>Drafts</h3>
      <p>
        {c.total === 0
          ? data.aiEnabled
            ? "Not drafted"
            : "No questions loaded yet"
          : `${c.total} drafts: ${c.approved} approved, ${c.rejected} rejected, ${c.pending} waiting for review`}
      </p>
      {c.total > 0 && c.approved === 0 && c.pending === 0 && (
        <p className="notice notice-warn">
          {data.aiEnabled
            ? `All drafts for ${t.name} were rejected. Draft more, add clearer material, or leave this topic out of the version.`
            : `All questions for ${t.name} were rejected. Ask the pilot team to load new ones, or leave this topic out of the version.`}
        </p>
      )}
      {drafting}
      <p>
        {c.approved >= needed ? (
          <StatusLabel tone="done">
            Has {c.approved} approved. Needs {needed} ({data.perTopicCount} per form).
          </StatusLabel>
        ) : (
          <StatusLabel tone="wait">
            Needs {needed} approved ({data.perTopicCount} per form). Has {c.approved}.
          </StatusLabel>
        )}
      </p>
    </section>
  );
}

function DraftControls({
  topic: t,
  data,
  locked,
  error,
  onStart,
}: {
  topic: BankData["topics"][number];
  data: BankData;
  locked: boolean;
  error?: string;
  onStart: (id: number, kind: "initial" | "more") => void;
}) {
  const run = t.run;
  const drafted = t.counts.total > 0;
  let status: ReactNode = null;
  if (run?.status === "running") status = <>Drafting… You can leave this page. Drafting continues.</>;
  else if (run?.status === "failed")
    status = (
      <>
        Drafting failed for {t.name}. {run.errorReason ? capitalise(run.errorReason) + "." : ""} Nothing was saved.
      </>
    );
  else if (run?.status === "done")
    status = (
      <>
        {run.createdCount} drafts ready for review.
        {run.discardedCount > 0 &&
          ` ${run.discardedCount} ${run.discardedCount === 1 ? "draft was" : "drafts were"} discarded because ${run.discardedCount === 1 ? "it" : "they"} didn't quote your material correctly.`}
      </>
    );
  if (locked) return null;
  const disabled = !data.aiSetUp || run?.status === "running";
  const failed = run?.status === "failed";
  const kind: "initial" | "more" = drafted ? "more" : "initial";
  const label = failed ? "Try again" : drafted ? "Draft 5 more" : "Draft questions";
  return (
    <>
      <LiveRegion>{status}</LiveRegion>
      {error && <p className="error" role="alert">{error}</p>}
      {(
        <p>
          <button type="button" className={drafted && !failed ? "secondary" : undefined} disabled={disabled} onClick={() => onStart(t.id, kind)}>
            {label}
          </button>
          {!data.aiSetUp && <span className="muted"> AI drafting isn't set up yet. The provider must be approved first.</span>}
        </p>
      )}
    </>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
