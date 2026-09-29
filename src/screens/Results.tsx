// R1 Results for one attempt (shared view). Only the heading changes by viewer.
import { api, ok, ApiError } from "../api";
import { Page, Skeleton, LoadError, StatusLabel, DataTable } from "../components/ui";
import { useLoad } from "../lib/useLoad";
import { Link } from "../lib/router";
import { formatDate } from "../../shared/dates";
import { pct } from "../../shared/scoring";

const LETTERS = "ABCD";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function R1Results({ params }: { params: Record<string, string> }) {
  const { data, error, loading, reload } = useLoad(() => ok(api.attempts[":id"].$get({ param: { id: params.attemptId } })), [params.attemptId]);
  const already = new URLSearchParams(location.search).get("already") === "1";
  if (loading && !data) return <Page title="Results"><Skeleton lines={8} /></Page>;
  if (error || !data)
    return (
      <Page title="Results">
        {error instanceof ApiError && error.status === 404 ? (
          <p>This page isn't available to you. If these results existed, they may have been deleted.</p>
        ) : (
          <LoadError message="Couldn't load these results. Reload the page." onRetry={reload} />
        )}
      </Page>
    );
  const self = data.viewer === "self";
  const manager = data.managerName ?? "your manager";
  const heading = self ? "Your results" : `${data.studentName}'s results`;
  const weak = data.topics.filter((t) => t.below);
  const topicName = new Map(data.topics.map((t) => [t.topicId, t.name]));

  return (
    <Page title={`${heading}: check ${data.checkNumber}`} heading={`${heading}: check ${data.checkNumber}`}>
      {already && <p className="notice">You've already submitted this check.</p>}
      <p className="muted">Submitted on {formatDate(data.submittedDate)}.</p>
      {self && <p>These results are for your development, not an evaluation. They show where more onboarding support would help.</p>}
      <DataTable head={["Topic", "Correct", "Status"]}>
        {data.topics.map((t) => (
          <tr key={t.topicId}>
            <th scope="row">{t.name}</th>
            <td>
              {t.correct} of {t.total} ({pct(t.correct, t.total)}%)
            </td>
            <td>
              {!t.below ? (
                <StatusLabel tone="ok">Looks solid</StatusLabel>
              ) : data.form === "A" ? (
                <StatusLabel tone="attention">To go over with {manager}</StatusLabel>
              ) : (
                <StatusLabel tone="attention">More support would help</StatusLabel>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      {data.form === "A" && weak.length > 0 && data.flag && (
        <p>
          {cap(manager)} will get in touch by {formatDate(data.flag.dueDate)} to go over these topics with {self ? "you" : data.studentName}.
        </p>
      )}
      {data.overall && (
        <p className="muted">
          Overall (shown to admins only): {data.overall.correct} of {data.overall.total} ({pct(data.overall.correct, data.overall.total)}%).
        </p>
      )}
      {data.flag?.id && (
        <p>
          <Link to={`/flags/${data.flag.id}`}>Open the follow-up for this check</Link>
        </p>
      )}
      {data.bothDone && (
        <p>
          <Link to={`/compare/${data.personId}`}>Compare check 1 and check 2</Link>
        </p>
      )}

      <h2>Answers</h2>
      {data.topics.map((t) => (
        <details key={t.topicId} open={t.below} className="card">
          <summary>
            <strong>{topicName.get(t.topicId)}</strong> ({t.correct} of {t.total})
          </summary>
          {data.answers
            .filter((a) => a.topicId === t.topicId)
            .map((a) => (
              <div key={a.questionId} style={{ margin: "12px 0" }}>
                <p>
                  <strong>{a.text}</strong>
                </p>
                <p>
                  {a.isCorrect ? <StatusLabel tone="ok">Your answer</StatusLabel> : <StatusLabel tone="attention">Your answer</StatusLabel>}:{" "}
                  {LETTERS[a.chosenIndex]}. {a.options[a.chosenIndex]}
                </p>
                {!a.isCorrect && (
                  <p>
                    <StatusLabel tone="ok">Correct answer</StatusLabel>: {LETTERS[a.correctIndex]}. {a.options[a.correctIndex]}
                  </p>
                )}
                {a.isCorrect && <p className="muted">That's the correct answer.</p>}
                {a.documentName && <p className="muted">From: {a.documentName}</p>}
              </div>
            ))}
        </details>
      ))}
      <footer>
        <p className="muted">Think a question is wrong? Mention it in your debrief. The reviewer will check it.</p>
        {self && <Link to="/checks">Back to My checks</Link>}
      </footer>
    </Page>
  );
}

/** R2 Form A vs. Form B comparison (shared view; F9). */
export function R2Compare({ params }: { params: Record<string, string> }) {
  const { data, error, loading, reload } = useLoad(() => ok(api.comparison[":personId"].$get({ param: { personId: params.personId } })), [params.personId]);
  if (loading && !data) return <Page title="Compare checks"><Skeleton /></Page>;
  if (error || !data)
    return (
      <Page title="Compare checks">
        {error instanceof ApiError && error.status === 404 ? <p>This page isn't available to you.</p> : <LoadError message="Couldn't load these results. Reload the page." onRetry={reload} />}
      </Page>
    );
  const self = data.viewer === "self";
  const heading = self ? "Your results: check 1 and check 2" : `${data.studentName}'s results: check 1 and check 2`;
  if (!data.bothDone)
    return (
      <Page title="Compare checks" heading={heading}>
        <p>Check 2 isn't done yet.</p>
        <Link to={`/results/${data.attemptAId}`}>Back to check 1 results</Link>
      </Page>
    );
  const points = data.perTopic ? Math.round(100 / data.perTopic) : null;
  const change = (n: number | null) => (n === null ? "–" : n === 0 ? "no change" : n > 0 ? `+${n}` : `−${Math.abs(n)}`);
  return (
    <Page title="Compare checks" heading={heading}>
      <DataTable head={["Topic", "Check 1", "Check 2", "Change", "Followed up"]}>
        {data.rows.map((r) => (
          <tr key={r.topicId}>
            <th scope="row">
              {r.name}
            </th>
            <td>
              {r.a.correct} of {r.a.total} ({pct(r.a.correct, r.a.total)}%)
            </td>
            <td>{r.b ? `${r.b.correct} of ${r.b.total} (${pct(r.b.correct, r.b.total)}%)` : "–"}</td>
            <td>{change(r.change)}</td>
            <td>
              {/* Form A's weak topics are marked here: ◆ Yes, [date]. */}
              {r.weakInA ? <StatusLabel tone="attention">{r.followedUpDate ? `Yes, ${formatDate(r.followedUpDate)}` : "Yes"}</StatusLabel> : "–"}
            </td>
          </tr>
        ))}
      </DataTable>
      <p className="muted">
        Check 1 and check 2 use different questions on the same topics, so part of any change can come from the questions themselves.
        {points !== null && ` With ${data.perTopic} questions per topic, one question moves a topic's result by ${points} points.`}
      </p>
      <p>
        <Link to={`/results/${data.attemptAId}`}>Check 1 results</Link>
        {data.attemptBId && (
          <>
            {" · "}
            <Link to={`/results/${data.attemptBId}`}>Check 2 results</Link>
          </>
        )}
      </p>
    </Page>
  );
}
