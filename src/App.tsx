// App shell: restores the session, loads /api/me, builds the nav from the union
// of roles (with Review (N) and Flags (N) badges), and routes to screens.
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { api, ok, ApiError, SIGNED_OUT_EVENT } from "./api";
import { clearToken, getToken, setReturnTo } from "./lib/session";
import { Link, match, navigate, usePath } from "./lib/router";
import { MeContext, hasRole, homePath, isAdminMe, type MeData, type Role } from "./lib/me";
import { Skeleton, LoadError } from "./components/ui";
import { NoRoleScreen, NotAvailableScreen, SetupScreen, SignedOutScreen, StartScreen } from "./screens/S0";
import { routes as screenRoutes } from "./routes";

export type RouteDef = {
  path: string;
  roles: Role[];
  component: ComponentType<{ params: Record<string, string> }>;
  /** Full page, no nav (T2). */
  bare?: boolean;
};

type State = { kind: "loading" } | { kind: "signed_out" } | { kind: "error" } | { kind: "ready"; me: MeData };

export default function App() {
  const path = usePath();
  const [state, setState] = useState<State>({ kind: "loading" });

  const refreshMe = useCallback(async () => {
    if (!getToken()) {
      setState({ kind: "signed_out" });
      return;
    }
    try {
      const me = await ok(api.me.$get(), { handle401: false });
      setState({ kind: "ready", me });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearToken();
        setState({ kind: "signed_out" });
      } else setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    if (location.pathname !== "/start" && location.pathname !== "/setup") void refreshMe();
    const onSignedOut = () => {
      clearToken();
      setState({ kind: "signed_out" });
    };
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, [refreshMe]);

  // Refresh badges when the route changes.
  useEffect(() => {
    if (state.kind === "ready") void refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (path.startsWith("/start")) return <StartScreen onSignedIn={refreshMe} />;
  if (path.startsWith("/setup")) return <SetupScreen onSignedIn={refreshMe} />;
  if (state.kind === "loading") return <main><Skeleton /></main>;
  if (state.kind === "error") return <main><LoadError message="Couldn't load the app. Reload the page." /></main>;
  if (state.kind === "signed_out") {
    if (location.pathname !== "/") setReturnTo(location.pathname + location.search);
    return <SignedOutScreen />;
  }

  const { me } = state;
  if (me.roles.length === 0) return <NoRoleScreen bankOwnerName={me.bankOwnerName} />;

  if (path === "/" || path === "") {
    queueMicrotask(() => navigate(homePath(me), { replace: true }));
    return null;
  }

  let screen = <NotAvailableScreen />;
  let bare = false;
  for (const r of screenRoutes) {
    const params = match(r.path, path);
    if (params) {
      if (hasRole(me, ...r.roles)) {
        const C = r.component;
        screen = <C params={params} />;
        bare = !!r.bare;
      }
      break;
    }
  }

  return (
    <MeContext.Provider value={{ me, refreshMe }}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      {!bare && <Nav me={me} path={path} />}
      {screen}
    </MeContext.Provider>
  );
}

function Nav({ me, path }: { me: MeData; path: string }) {
  const items: { to: string; label: string; show: boolean }[] = [
    { to: "/checks", label: "My checks", show: hasRole(me, "student") },
    {
      to: "/flags",
      label: me.badges.flags ? `Flags (${me.badges.flags})` : "Flags",
      show: hasRole(me, "follow_up_owner"),
    },
    {
      to: "/review",
      label: me.badges.review ? `Review (${me.badges.review})` : "Review",
      show: hasRole(me, "reviewer"),
    },
    { to: "/pilot", label: "Pilot", show: isAdminMe(me) },
    { to: "/bank", label: "Bank", show: isAdminMe(me) },
    { to: "/data", label: "Data", show: isAdminMe(me) },
  ];
  async function signOut() {
    try {
      await ok(api.auth.signout.$post());
    } catch {
      /* signed out either way */
    }
    clearToken();
    location.assign("/");
  }
  return (
    <header className="topbar">
      <span className="brand">Onboarding Knowledge Check</span>
      <nav aria-label="Main">
        <ul>
          {items
            .filter((i) => i.show)
            .map((i) => (
              <li key={i.to}>
                <Link to={i.to} aria-current={path.startsWith(i.to) ? "page" : undefined}>
                  {i.label}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
      <span className="who">
        {me.person.name}{" "}
        <button type="button" className="link" onClick={signOut}>
          Sign out
        </button>
      </span>
    </header>
  );
}
