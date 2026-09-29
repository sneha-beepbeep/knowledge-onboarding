// CSV for the F10 export (technical plan §7): RFC 4180 quoting, CRLF, UTF-8
// with a BOM so Excel opens it correctly, and formula-safe cells.

export type Cell = string | number | boolean | null | undefined;

/** Cells starting with = + - @ get a leading ' so spreadsheet formulas can't run. */
export function safeCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "boolean" ? (v ? "yes" : "no") : String(v);
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map((r) => r.map(safeCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export const iso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : "");
