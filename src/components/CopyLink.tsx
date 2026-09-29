import { useId, useState } from "react";
import { LiveRegion } from "./ui";

/** A read-only link field with a Copy link button (A2, A5). */
export function CopyLink({ url, label, onCopied }: { url: string; label: string; onCopied?: () => void }) {
  const id = useId();
  const [msg, setMsg] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMsg("Link copied.");
      onCopied?.();
    } catch {
      setMsg("Couldn't copy automatically. Select the link and copy it.");
    }
  }
  return (
    <div className="stack">
      <label htmlFor={id} className="visually-plain">
        {label}
      </label>
      <div className="row">
        <input id={id} readOnly value={url} onFocus={(e) => e.currentTarget.select()} size={48} />
        <button type="button" onClick={copy}>
          Copy link
        </button>
      </div>
      <LiveRegion>{msg}</LiveRegion>
    </div>
  );
}
