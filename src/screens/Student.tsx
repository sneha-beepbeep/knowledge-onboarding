// T1 Student home, T2 Notice & participation, T3 Quiz. Student copy follows
// the framing rules in design spec §7.2 (no "test", "fail", "flag", "score").
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ok, ApiError } from "../api";
import { Page, Skeleton, LoadError, StatusLabel, LiveRegion } from "../components/ui";
import { useLoad } from "../lib/useLoad";
import { Link, navigate } from "../lib/router";
import { useMe } from "../lib/me";
import { formatDate } from "../../shared/dates";

const LETTERS = "ABCD";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function joinList(xs: string[]) {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
}

export function T1Home() {
  const { data, error, loading, reload } = useLoad(() => ok(api.my.checks.$get()));
  if (loading && !data) return <Page title="My checks"><Skeleton /></Page>;
  if (error || !data) return <Page title="My checks"><LoadError message="Couldn't load your checks. Reload the page." onRetry={reload} /></Page>;
  const manager = data.managerName ?? "your manager";
  let card: React.ReactNode;
  switch (data.state) {
    case "nothing_sent":
      card = <p>Nothing to do yet. You'll get a link when your knowledge check is ready.</p>;
      break;
    case "notice":
      card = (
        <>
          <p>Your onboarding knowledge check is ready. First, a short note on what it's for.</p>
          <button type="button" onClick={() => navigate("/notice")}>Read and start</button>
        </>
      );
      break;
    case "declined":
      card = (
        <>
          <p>You chose not to take part. That's completely fine and has no consequences. If you change your mind, you can still take part.</p>
          <button type="button" onClick={() => navigate("/notice")}>I'd like to take part</button>
        </>
      );
      break;
    case "form_a":
      card = (
        <>
          <h2>Knowledge check 1 of 2</h2>
          <p>
            {data.questionCount} questions · about {data.questionCount} minutes · no time limit
          </p>
          <button type="button" onClick={() => navigate("/check/a")}>Start</button>
        </>
      );
      break;
    case "followup_pending":
      card = (
        <>
          <p>
            Check 1 done on {formatDate(data.doneDate)}. {cap(manager)} will go over {joinList(data.followups.map((f) => f.topic))} with you by{" "}
            {formatDate(data.dueDate)}. After that, check 2 opens here.
          </p>
          <FollowupList followups={data.followups} />
          <Link to={`/results/${data.attemptAId}`}>See your results</Link>
        </>
      );
      break;
    case "form_b_no_flag":
      card = (
        <>
          <p>
            Check 1 done on {formatDate(data.doneDate)}. No topics need a follow-up. Check 2 is open now if you'd like to take it. Please take it by{" "}
            {formatDate(data.dueDate)}. {data.overdue && <StatusLabel tone="overdue">Overdue</StatusLabel>}
          </p>
          <div className="actions">
            <button type="button" onClick={() => navigate("/check/b")}>Start</button>
            <Link to={`/results/${data.attemptAId}`}>See your results</Link>
          </div>
        </>
      );
      break;
    case "form_b":
      card = (
        <>
          <h2>Knowledge check 2 of 2</h2>
          <p>
            Same topics, different questions · please take it by {formatDate(data.dueDate)}{" "}
            {data.overdue && <StatusLabel tone="overdue">Overdue</StatusLabel>}
          </p>
          <FollowupList followups={data.followups} />
          <div className="actions">
            <button type="button" onClick={() => navigate("/check/b")}>Start</button>
            <Link to={`/results/${data.attemptAId}`}>Check 1 results</Link>
          </div>
        </>
      );
      break;
    case "both_done":
      card = (
        <>
          <p>Both checks done. See how your topics compare.</p>
          <button type="button" onClick={() => navigate(`/compare/${data.personId}`)}>Compare</button>
        </>
      );
      break;
  }
  return (
    <Page title="My checks">
      <section className="card">{card}</section>
      <footer>
        <Link to="/notice">What this check is for</Link>
      </footer>
    </Page>
  );
}

function FollowupList({ followups }: { followups: { topic: string; doneDate: string | null }[] }) {
  if (!followups.length) return null;
  return (
    <ul>
      {followups.map((f) => (
        <li key={f.topic}>
          {f.topic}: {f.doneDate ? <StatusLabel tone="done">done {formatDate(f.doneDate)}</StatusLabel> : <StatusLabel tone="wait">not yet</StatusLabel>}
        </li>
      ))}
    </ul>
  );
}

export function T2Notice() {
  const { refreshMe } = useMe();
  const { data, error, loading, reload } = useLoad(() => ok(api.my.notice.$get()));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Page title="What this check is for"><Skeleton lines={10} /></Page>;
  if (error || !data) return <Page title="What this check is for"><LoadError message="Couldn't load this page. Reload the page." onRetry={reload} /></Page>;

  async function choose(choice: "take_part" | "decline") {
    setBusy(true);
    setErr(null);
    try {
      await ok(api.my.participation.$post({ json: { choice } }));
      await refreshMe();
      navigate(choice === "take_part" && !data!.formASubmitted ? "/check/a" : "/checks");
    } catch {
      setErr("Your choice wasn't saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="What this check is for" heading={data.title}>
      {data.blocks.map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>
            {b.lead && <strong>{b.lead} </strong>}
            {b.text}
          </p>
        ) : (
          <div key={i}>
            <p>
              <strong>{b.lead}</strong>
            </p>
            <ol>
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ol>
          </div>
        ),
      )}
      {err && (
        <p className="notice notice-error" role="alert">
          {err}
        </p>
      )}
      {data.sent ? (
        <>
          {data.currentChoice && (
            <p className="muted">Your current choice: {data.currentChoice === "take_part" ? "Take part" : "I'd rather not"}.</p>
          )}
          <div className="actions">
            <button type="button" disabled={busy} onClick={() => choose("take_part")}>
              Take part
            </button>
            <button type="button" disabled={busy} onClick={() => choose("decline")}>
              I'd rather not
            </button>
          </div>
        </>
      ) : (
        <p>Nothing to do yet. You'll get a link when your knowledge check is ready.</p>
      )}
      <p>
        <Link to="/checks">Back to My checks</Link>
      </p>
    </Page>
  );
}

type FormData = { form: "A" | "B"; checkNumber: number; total: number; topics: { id: number; name: string; questions: { id: number; text: string; options: string[] }[] }[] };

export function T3Quiz({ params }: { params: Record<string, string> }) {
  const formKey = params.form === "b" ? "b" : "a";
  const storageKey = `kc.answers.${formKey}`;
  const [data, setData] = useState<FormData | null>(null);
  const [blocked, setBlocked] = useState<{ code: string; managerName: string | null } | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
    } catch {
      return {};
    }
  });
  const [missing, setMissing] = useState<number[]>([]);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoadErr(false);
    try {
      const d = await ok(api.my.forms[":form"].$get({ param: { form: formKey } }));
      setData(d as FormData);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        if (e.body.code === "already_submitted" && e.body.attemptId) {
          sessionStorage.removeItem(storageKey);
          navigate(`/results/${e.body.attemptId}?already=1`, { replace: true });
          return;
        }
        if (e.body.code === "notice") return navigate("/notice", { replace: true });
        setBlocked({ code: String(e.body.code), managerName: (e.body.managerName as string) ?? null });
      } else setLoadErr(true);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  // Mirror answers to sessionStorage (tab-only) so a reload after sign-in keeps them.
  useEffect(() => {
    if (!submitted.current) sessionStorage.setItem(storageKey, JSON.stringify(answers));
  }, [answers, storageKey]);

  const answeredCount = useMemo(
    () => (data ? data.topics.flatMap((t) => t.questions).filter((q) => answers[q.id] !== undefined).length : 0),
    [answers, data],
  );

  // "You have unsaved answers. Leave anyway?" when leaving with answers selected.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (answeredCount > 0 && !submitted.current) {
        e.preventDefault();
        e.returnValue = "You have unsaved answers. Leave anyway?";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [answeredCount]);

  if (blocked)
    return (
      <Page title={formKey === "a" ? "Knowledge check 1 of 2" : "Knowledge check 2 of 2"}>
        <p>
          {formKey === "b"
            ? `Check 2 opens after your follow-up with ${blocked.managerName ?? "your manager"}.`
            : "This check isn't available yet."}
        </p>
        <Link to="/checks">Back to My checks</Link>
      </Page>
    );
  if (loadErr) return <Page title="Knowledge check"><LoadError message="Couldn't load your check. Reload the page." onRetry={load} /></Page>;
  if (!data) return <Page title="Knowledge check"><Skeleton lines={10} /></Page>;

  const all = data.topics.flatMap((t) => t.questions);
  const numberOf = new Map(all.map((q, i) => [q.id, i + 1]));

  async function submit() {
    const miss = all.filter((q) => answers[q.id] === undefined).map((q) => q.id);
    setMissing(miss);
    setSubmitErr(null);
    if (miss.length) {
      setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      const r = await ok(api.my.forms[":form"].attempt.$post({ param: { form: formKey }, json: { answers } }), { handle401: false });
      submitted.current = true;
      sessionStorage.removeItem(storageKey);
      navigate(`/results/${r.attemptId}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        setSubmitErr("You were signed out. Sign in again to submit. Your answers are kept on this page. Open your sign-in link in a new tab, then come back here and choose Submit answers again.");
      else if (e instanceof ApiError && e.status === 409 && e.body.code === "already_submitted" && e.body.attemptId) {
        submitted.current = true;
        sessionStorage.removeItem(storageKey);
        navigate(`/results/${e.body.attemptId}?already=1`);
      } else setSubmitErr("Your answers weren't submitted. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const title = `Knowledge check ${data.checkNumber} of 2`;
  return (
    <Page title={title}>
      <p>
        {data.total} questions · no time limit · you'll see the correct answers right after you submit.
      </p>
      <p className="hint">Not sure? Pick your best guess. It helps show where more support would be useful.</p>
      <div className="sticky-progress" aria-live="polite">
        {answeredCount} of {data.total} answered
      </div>
      {data.topics.map((t) => (
        <section key={t.id} aria-labelledby={`t-${t.id}`}>
          <h2 id={`t-${t.id}`}>{t.name}</h2>
          {t.questions.map((q) => (
            <fieldset
              key={q.id}
              id={`q-${q.id}`}
              tabIndex={-1}
              aria-describedby={missing.includes(q.id) && answers[q.id] === undefined ? `q-${q.id}-error` : undefined}
            >
              <legend>
                {numberOf.get(q.id)}. {q.text}
              </legend>
              {missing.includes(q.id) && answers[q.id] === undefined && (
                <p className="field-error" id={`q-${q.id}-error`}>
                  <span aria-hidden="true">⚠ </span>This question still needs an answer.
                </p>
              )}
              {q.options.map((o, i) => (
                <label key={i} className="option">
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={i}
                    checked={answers[q.id] === i}
                    onChange={() => setAnswers({ ...answers, [q.id]: i })}
                  />
                  <span>
                    {LETTERS[i]}. {o}
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </section>
      ))}
      <section className="card" aria-labelledby="submit-h">
        <h2 id="submit-h">Submit</h2>
        {missing.filter((id) => answers[id] === undefined).length > 0 && (
          <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
            <p>
              <strong>
                {missing.filter((id) => answers[id] === undefined).length}{" "}
                {missing.filter((id) => answers[id] === undefined).length === 1 ? "question still needs" : "questions still need"} an answer:
              </strong>
            </p>
            <ul>
              {missing
                .filter((id) => answers[id] === undefined)
                .map((id) => (
                  <li key={id}>
                    <a
                      href={`#q-${id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById(`q-${id}`);
                        el?.scrollIntoView();
                        (el?.querySelector("input") as HTMLInputElement | null)?.focus();
                      }}
                    >
                      Question {numberOf.get(id)}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        )}
        {submitErr && (
          <p className="notice notice-error" role="alert">
            {submitErr}
          </p>
        )}
        <p>You can submit once. Answers can't be changed afterwards.</p>
        <button type="button" onClick={submit} disabled={busy}>
          {busy ? "Submitting…" : "Submit answers"}
        </button>
        <LiveRegion>{busy ? "Submitting your answers." : ""}</LiveRegion>
      </section>
    </Page>
  );
}
