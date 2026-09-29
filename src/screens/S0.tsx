// S0 Sign-in and access states (F12).
import { useEffect, useState, type FormEvent } from "react";
import { api, ok, ApiError } from "../api";
import { Page, ErrorSummary, InlineError } from "../components/ui";
import { setToken, takeReturnTo } from "../lib/session";
import { navigate } from "../lib/router";

/** `/start#t=…`: swaps the link token for a session, then clears it from the address bar. */
export function StartScreen({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const token = new URLSearchParams(location.hash.slice(1)).get("t") ?? "";
    history.replaceState(null, "", "/start");
    if (!token) {
      setError("This sign-in link is incomplete. Open the full link you were sent.");
      return;
    }
    ok(api.auth.exchange.$post({ json: { token } }), { handle401: false })
      .then(async (r) => {
        setToken(r.sessionToken);
        await onSignedIn();
        navigate(takeReturnTo() ?? "/", { replace: true });
      })
      .catch((e) => setError(e instanceof ApiError && e.status === 401 ? e.message : "Couldn't sign you in. Try the link again."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Page title="Signing in">
      {error ? <p role="alert">{error}</p> : <p role="status">Signing you in…</p>}
    </Page>
  );
}

export function SignedOutScreen() {
  return (
    <Page title="Signed out" heading="You're signed out">
      <p>Open your sign-in link again to continue. If it no longer works, ask the pilot team for a new one.</p>
    </Page>
  );
}

export function NoRoleScreen({ bankOwnerName }: { bankOwnerName: string | null }) {
  return (
    <Page title="No access">
      <p>
        You don't have access to the Onboarding Knowledge Check. If you think you should, contact{" "}
        {bankOwnerName ?? "the pilot team"}.
      </p>
    </Page>
  );
}

export function NotAvailableScreen() {
  return (
    <Page title="Not available">
      <p>This page isn't available to you.</p>
    </Page>
  );
}

/** First setup: the CPO signs in once with the BOOTSTRAP_TOKEN secret. */
export function SetupScreen({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [token, setTok] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = [];
    if (!token.trim()) errs.push({ field: "setup-token", message: "Add the set-up code." });
    if (!name.trim()) errs.push({ field: "setup-name", message: "Add your name." });
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      const r = await ok(api.auth.bootstrap.$post({ json: { token, name, email } }), { handle401: false });
      setToken(r.sessionToken);
      await onSignedIn();
      navigate("/people", { replace: true });
    } catch (err) {
      setErrors([
        {
          field: "setup-token",
          message:
            err instanceof ApiError && err.status === 404
              ? "Set-up is already complete. Sign in with your link."
              : err instanceof ApiError
                ? err.message
                : "Set-up failed. Try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  const err = (f: string) => errors.find((x) => x.field === f)?.message;
  return (
    <Page title="First set-up">
      <p>One-time set-up for the pilot sponsor (CPO). This page stops working once a CPO exists.</p>
      <ErrorSummary errors={errors} />
      <form onSubmit={submit} className="stack" noValidate>
        <label htmlFor="setup-token">Set-up code</label>
        <InlineError id="setup-token" message={err("setup-token")} />
        <input id="setup-token" type="password" value={token} onChange={(e) => setTok(e.target.value)} autoComplete="off" />
        <label htmlFor="setup-name">Your name</label>
        <InlineError id="setup-name" message={err("setup-name")} />
        <input id="setup-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <label htmlFor="setup-email">Email (optional)</label>
        <input id="setup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <div>
          <button type="submit" disabled={busy}>
            {busy ? "Setting up…" : "Set up"}
          </button>
        </div>
      </form>
    </Page>
  );
}
