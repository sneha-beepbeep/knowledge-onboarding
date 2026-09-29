// Shared components (technical plan §6). Text first, never colour alone.
import { useEffect, useRef, type ReactNode } from "react";

const APP = "Onboarding Knowledge Check";

/** One H1 per page; sets the document title and moves focus to the heading on navigation. */
export function Page({ title, heading, children, wide }: { title: string; heading?: string; children: ReactNode; wide?: boolean }) {
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} · ${APP}`;
    h1.current?.focus();
  }, [title]);
  return (
    <main id="main" className={wide ? "wide" : undefined}>
      <h1 ref={h1} tabIndex={-1}>
        {heading ?? title}
      </h1>
      {children}
    </main>
  );
}

export type Tone = "ok" | "attention" | "done" | "info" | "overdue" | "wait";
const ICONS: Record<Tone, string> = { ok: "✓", attention: "◆", done: "✓", info: "•", overdue: "⚠", wait: "…" };

/** Status as text plus an icon (and a colour class), never colour alone. */
export function StatusLabel({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`status status-${tone}`}>
      <span aria-hidden="true">{ICONS[tone]} </span>
      {children}
    </span>
  );
}

export type FieldError = { field: string; message: string };

/** Error summary at the top of a form, linking to each field (WCAG 3.3.1). */
export function ErrorSummary({ errors, title = "There's a problem" }: { errors: FieldError[]; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors.length) ref.current?.focus();
  }, [errors]);
  if (!errors.length) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={ref}>
      <h2>{title}</h2>
      <ul>
        {errors.map((e) => (
          <li key={e.field + e.message}>
            <a
              href={`#${e.field}`}
              onClick={(ev) => {
                ev.preventDefault();
                document.getElementById(e.field)?.focus();
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InlineError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" id={`${id}-error`}>
      <span aria-hidden="true">⚠ </span>
      {message}
    </p>
  );
}

/** Polite live region for status messages (drafting progress, saves). */
export function LiveRegion({ children, assertive }: { children: ReactNode; assertive?: boolean }) {
  return (
    <div className="live" role={assertive ? "alert" : "status"} aria-live={assertive ? "assertive" : "polite"}>
      {children}
    </div>
  );
}

/** Native <dialog> confirmation. Opens as modal while `open` is true. */
export function ConfirmDialog({
  open,
  title,
  children,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dialog-title" className="dialog">
      <h2 id="dialog-title">{title}</h2>
      {children}
      <div className="actions">{actions}</div>
    </dialog>
  );
}

export function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton-line" />
      ))}
    </div>
  );
}

/** A real table with header cells. */
export function DataTable({ caption, head, children }: { caption?: string; head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="notice notice-error" role="alert">
      <p>{message}</p>
      <button type="button" onClick={onRetry ?? (() => location.reload())}>
        Reload
      </button>
    </div>
  );
}
