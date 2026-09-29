// A2 People & roles (F12, §2, §7).
import { useState, type FormEvent } from "react";
import { api, ok, ApiError } from "../api";
import { Page, Skeleton, LoadError, ConfirmDialog, LiveRegion, InlineError, DataTable } from "../components/ui";
import { useLoad } from "../lib/useLoad";
import { useMe } from "../lib/me";
import { CopyLink } from "../components/CopyLink";

type Data = Awaited<ReturnType<typeof load>>;
const load = () => ok(api.roles.$get());

export function A2People() {
  const { data, error, loading, reload } = useLoad(load);
  const [editing, setEditing] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<number, string>>({});
  const [linkError, setLinkError] = useState<string | null>(null);

  if (loading && !data) return <Page title="People & roles"><Skeleton /></Page>;
  if (error || !data) return <Page title="People & roles"><LoadError message="Couldn't load people and roles. Reload the page." /></Page>;

  async function issue(personId: number) {
    setLinkError(null);
    try {
      const r = await ok(api.people[":id"].link.$post({ param: { id: String(personId) } }));
      setLinks((l) => ({ ...l, [personId]: r.url }));
    } catch (e) {
      setLinkError(e instanceof ApiError ? e.message : "Couldn't create the link. Try again.");
    }
  }

  const assignable = data.roles.filter((r) => r.role !== "cpo" || data.isCpo);

  return (
    <Page title="People & roles" wide>
      <p className="hint">Each role needs a named person before Form A can be sent. One person can hold several roles.</p>
      {data.warnings.map((w) => (
        <p key={w} className="notice notice-warn">
          <span aria-hidden="true">⚠ </span>
          <strong>Role overlap: </strong>
          {w}
        </p>
      ))}
      <DataTable head={["Role", "What they do", "Person", ""]}>
        {data.roles.map((r) => (
          <tr key={r.role}>
            <th scope="row">{r.label}</th>
            <td>{r.description}</td>
            <td>
              {r.person ? (
                <>
                  {r.person.name}
                  {r.person.email && <div className="muted">{r.person.email}</div>}
                </>
              ) : r.role === "cpo" ? (
                "Not assigned."
              ) : (
                <span>Not assigned. Required before Form A can be sent.</span>
              )}
            </td>
            <td>
              {assignable.some((a) => a.role === r.role) && (
                <button type="button" className="secondary" onClick={() => setEditing(r.role)} aria-label={`Change ${r.label}`}>
                  Change
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>

      {editing && (
        <AssignForm
          key={editing}
          data={data}
          role={editing}
          onDone={async () => {
            setEditing(null);
            await reload();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      <h2>Sign-in links</h2>
      <p className="hint">
        Each person signs in with their own link. Share it privately (for example in a direct message). A new link replaces the old one.
        Links last 14 days. {data.isCpo ? "" : "Only the CPO can create links for the bank owner and the CPO."}
      </p>
      {linkError && <p className="error" role="alert">{linkError}</p>}
      <DataTable head={["Person", "Roles", "Link"]}>
        {data.people.map((p) => {
          const adminPerson = p.roles.includes("bank_owner") || p.roles.includes("cpo");
          return (
            <tr key={p.id}>
              <th scope="row">{p.name}</th>
              <td>{p.roles.map((r) => data.roles.find((x) => x.role === r)?.label).join(", ")}</td>
              <td>
                {links[p.id] ? (
                  <CopyLink url={links[p.id]} label={`Sign-in link for ${p.name}`} />
                ) : adminPerson && !data.isCpo ? (
                  <span className="muted">CPO only</span>
                ) : (
                  <button type="button" className="secondary" onClick={() => issue(p.id)}>
                    Create sign-in link
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>
    </Page>
  );
}

function AssignForm({ data, role, onDone, onCancel }: { data: Data; role: string; onDone: () => void; onCancel: () => void }) {
  const { refreshMe } = useMe();
  const r = data.roles.find((x) => x.role === role)!;
  const [mode, setMode] = useState<"existing" | "new">(data.allPeople.length ? "existing" : "new");
  const [personId, setPersonId] = useState<string>(r.person ? String(r.person.personId) : "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const json = mode === "existing" ? { personId: Number(personId) } : { name, email };
      await ok(api.roles[":role"].$put({ param: { role }, json }));
      setSaved("Saved.");
      await refreshMe();
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Not saved. Try again.");
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "existing" && !personId) return setErr("Choose a person.");
    if (mode === "new" && !name.trim()) return setErr("Add the person's name.");
    const changing = r.person && (mode === "new" || Number(personId) !== r.person.personId);
    if (role === "follow_up_owner" && changing && data.studentHasFlag) return setConfirm(true);
    void save();
  }

  return (
    <section className="card" aria-labelledby="assign-h">
      <h2 id="assign-h">Assign: {r.label}</h2>
      <form onSubmit={submit} className="stack" noValidate>
        <fieldset>
          <legend>Person</legend>
          <label className="option">
            <input type="radio" name="mode" checked={mode === "existing"} onChange={() => setMode("existing")} disabled={!data.allPeople.length} />
            Someone already in the app
          </label>
          <label className="option">
            <input type="radio" name="mode" checked={mode === "new"} onChange={() => setMode("new")} />
            A new person
          </label>
        </fieldset>
        {mode === "existing" ? (
          <>
            <label htmlFor="assign-person">Person</label>
            <select id="assign-person" value={personId} onChange={(e) => setPersonId(e.target.value)} aria-invalid={!!err}>
              <option value="">Choose…</option>
              {data.allPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label htmlFor="assign-name">Name</label>
            <input id="assign-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err} />
            <label htmlFor="assign-email">Email (optional, shown only here)</label>
            <input id="assign-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </>
        )}
        <InlineError id="assign" message={err ?? undefined} />
        <div className="actions">
          <button type="submit" disabled={busy}>Save</button>
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        </div>
        <LiveRegion>{saved}</LiveRegion>
      </form>
      <ConfirmDialog
        open={confirm}
        title="Change the follow-up owner?"
        onClose={() => setConfirm(false)}
        actions={
          <>
            <button type="button" onClick={save} disabled={busy}>Change owner</button>
            <button type="button" className="secondary" onClick={() => setConfirm(false)}>Cancel</button>
          </>
        }
      >
        <p>
          The student's open flag moves to the new follow-up owner. {r.person?.name ?? "The current owner"} loses access to the
          student's results.
        </p>
      </ConfirmDialog>
    </section>
  );
}
