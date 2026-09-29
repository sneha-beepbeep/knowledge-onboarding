// A3a Add document (dialog, F1). Text is extracted in the browser; only text is sent.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ok, ApiError } from "../api";
import { ErrorSummary, InlineError, LiveRegion, type FieldError } from "../components/ui";
import { MAX_DOC_CHARS, MAX_PDF_BYTES } from "../../shared/limits";

const TOO_LONG = "This document is too long to use in one piece. Split it into smaller documents by topic.";

export function AddDocumentDialog({
  open,
  topicNames,
  onClose,
  onSaved,
}: {
  open: boolean;
  topicNames: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState<"upload" | "paste">("upload");
  const [fileKind, setFileKind] = useState<"pdf" | "txt" | null>(null);
  const [fileText, setFileText] = useState("");
  const [pasted, setPasted] = useState("");
  const [name, setName] = useState("");
  const [versionDate, setVersionDate] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function reset() {
    setSource("upload");
    setFileKind(null);
    setFileText("");
    setPasted("");
    setName("");
    setVersionDate("");
    setTopics([]);
    setNewTopic("");
    setErrors([]);
    setStatus("");
  }

  async function onFile(file: File | undefined) {
    setErrors([]);
    setFileText("");
    setFileKind(null);
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf");
    const isTxt = file.type === "text/plain" || lower.endsWith(".txt");
    if (!isPdf && !isTxt) return setErrors([{ field: "doc-file", message: "Only PDF and plain-text files can be added." }]);
    if (!name) setName(file.name.replace(/\.(pdf|txt)$/i, ""));
    if (file.size > MAX_PDF_BYTES) return setErrors([{ field: "doc-file", message: TOO_LONG }]);
    setBusy(true);
    setStatus("Reading the file…");
    try {
      const text = isPdf ? await (await import("../lib/pdf")).extractPdfText(file) : await file.text();
      if (!text.trim()) {
        setErrors([
          {
            field: "doc-file",
            message: isPdf
              ? "We couldn't read any text from this PDF. It may be a scanned image. Paste the text instead."
              : "This file has no text.",
          },
        ]);
        setStatus("");
        return;
      }
      if (text.length > MAX_DOC_CHARS) {
        setErrors([{ field: "doc-file", message: TOO_LONG }]);
        setStatus("");
        return;
      }
      setFileText(text);
      setFileKind(isPdf ? "pdf" : "txt");
      setStatus(`Read ${text.length.toLocaleString("en-GB")} characters of text.`);
    } catch {
      setErrors([
        {
          field: "doc-file",
          message: "We couldn't read any text from this PDF. It may be a scanned image. Paste the text instead.",
        },
      ]);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function addTopic() {
    const t = newTopic.trim();
    if (!t) return;
    const existing = [...topicNames, ...topics].find((x) => x.toLowerCase() === t.toLowerCase()) ?? t;
    if (!topics.includes(existing)) setTopics([...topics, existing]);
    setNewTopic("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = source === "paste" ? pasted : fileText;
    const errs: FieldError[] = [];
    if (source === "upload" && !fileText) errs.push({ field: "doc-file", message: errors.find((x) => x.field === "doc-file")?.message ?? "Choose a PDF or plain-text file." });
    if (source === "paste" && !pasted.trim()) errs.push({ field: "doc-paste", message: "Paste the text of the material." });
    if (source === "paste" && pasted.length > MAX_DOC_CHARS) errs.push({ field: "doc-paste", message: TOO_LONG });
    if (!name.trim()) errs.push({ field: "doc-name", message: "Add a name." });
    if (!versionDate) errs.push({ field: "doc-date", message: "Add the material's version date." });
    if (!topics.length) errs.push({ field: "doc-new-topic", message: "Add at least one topic." });
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      await ok(
        api.documents.$post({
          json: { name, versionDate, topics, text, source: source === "paste" ? "paste" : (fileKind ?? "txt") },
        }),
      );
      await onSaved();
      reset();
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 413
          ? TOO_LONG
          : err instanceof ApiError && err.status === 400
            ? err.message
            : "Upload failed. Nothing was saved. Try again.";
      setErrors([{ field: source === "paste" ? "doc-paste" : "doc-file", message: msg }]);
    } finally {
      setBusy(false);
    }
  }

  const err = (f: string) => errors.find((x) => x.field === f)?.message;
  const allTopicOptions = [...new Set([...topicNames, ...topics])];

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="a3a-title" onClose={onClose}>
      <h2 id="a3a-title">Add document</h2>
      <p className="hint">Add only your company's own onboarding material. Leave out anything that shouldn't appear in a quiz.</p>
      <ErrorSummary errors={errors} />
      <form onSubmit={submit} className="stack" noValidate>
        <fieldset>
          <legend>Source</legend>
          <label className="option">
            <input type="radio" name="doc-source" checked={source === "upload"} onChange={() => setSource("upload")} />
            Upload file (PDF or .txt)
          </label>
          <label className="option">
            <input type="radio" name="doc-source" checked={source === "paste"} onChange={() => setSource("paste")} />
            Paste text
          </label>
        </fieldset>
        {source === "upload" ? (
          <>
            <label htmlFor="doc-file">File</label>
            <InlineError id="doc-file" message={err("doc-file")} />
            <input
              id="doc-file"
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              onChange={(e) => onFile(e.target.files?.[0])}
              aria-invalid={!!err("doc-file")}
              aria-describedby="doc-file-error"
            />
          </>
        ) : (
          <>
            <label htmlFor="doc-paste">Text</label>
            <InlineError id="doc-paste" message={err("doc-paste")} />
            <textarea id="doc-paste" value={pasted} onChange={(e) => setPasted(e.target.value)} aria-invalid={!!err("doc-paste")} />
          </>
        )}
        <LiveRegion>{status}</LiveRegion>

        <label htmlFor="doc-name">Name</label>
        <InlineError id="doc-name" message={err("doc-name")} />
        <input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err("doc-name")} />

        <label htmlFor="doc-date">Version date</label>
        <p className="hint" id="doc-date-hint">When was this material last updated?</p>
        <InlineError id="doc-date" message={err("doc-date")} />
        <input
          id="doc-date"
          type="date"
          value={versionDate}
          onChange={(e) => setVersionDate(e.target.value)}
          aria-describedby="doc-date-hint"
          aria-invalid={!!err("doc-date")}
        />

        <fieldset>
          <legend>Topics</legend>
          {allTopicOptions.map((t) => (
            <label key={t} className="option">
              <input
                type="checkbox"
                checked={topics.includes(t)}
                onChange={(e) => setTopics(e.target.checked ? [...topics, t] : topics.filter((x) => x !== t))}
              />
              {t}
            </label>
          ))}
          <label htmlFor="doc-new-topic">New topic</label>
          <InlineError id="doc-new-topic" message={err("doc-new-topic")} />
          <div className="row">
            <input
              id="doc-new-topic"
              value={newTopic}
              maxLength={80}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTopic();
                }
              }}
            />
            <button type="button" className="secondary" onClick={addTopic}>
              Add topic
            </button>
          </div>
        </fieldset>

        <div className="actions">
          <button type="submit" disabled={busy}>
            {busy ? "Working…" : "Save"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
