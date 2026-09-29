// Runs `wrangler d1 execute` for the data scripts (seed:demo, import-questions).
// The target arguments come from the caller (local, or a checked remote target).
// Banner off (it runs an npm update check) and metrics off, so local runs make no
// network calls. --config is always pinned to wrangler.jsonc by the target argv.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * @param {{ root: string, argv: string[], where: string, show?: boolean, dry?: boolean, hint?: string, die: (msg: string) => never }} o
 *   show: print each command; dry: print only, execute nothing (queries return no rows);
 *   hint: a plain-language next step printed when wrangler fails.
 */
export function makeD1({ root, argv: target, where, show = false, dry = false, hint = "", die }) {
  const env = { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_HIDE_BANNER: "true", CI: "1" };
  const wrangler = join(root, "node_modules", ".bin", "wrangler");

  function run(extra, { parse = true } = {}) {
    const argv = ["d1", "execute", ...target, "--json", ...extra];
    if (show || dry) {
      const shown = argv.map((a, i) => (argv[i - 1] === "--command" ? `'${a.replace(/\s+/g, " ").slice(0, 60)}...'` : a));
      console.log(`  $ npx wrangler ${shown.join(" ")}`);
    }
    if (dry) return [{ results: [] }];
    const r = spawnSync(wrangler, argv, { cwd: root, env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) die(`wrangler d1 execute (${where}) failed:\n${r.stderr || r.stdout}${hint ? `\n${hint}` : ""}`);
    if (!parse) return null;
    return JSON.parse(r.stdout.slice(r.stdout.indexOf("[")));
  }

  return {
    where,
    /** All result sets of a (possibly multi-statement) query. */
    queryAll: (sql) => run(["--command", sql]),
    /** Rows of the first statement. */
    query: (sql) => run(["--command", sql])[0].results,
    /** Executes a SQL script from a temporary file (remote output is a report, not rows). */
    execSql(sql) {
      const dir = mkdtempSync(join(tmpdir(), "kc-d1-"));
      const file = join(dir, "script.sql");
      try {
        writeFileSync(file, sql);
        run(["--file", dry ? "<script.sql>" : file, "--yes"], { parse: false });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
