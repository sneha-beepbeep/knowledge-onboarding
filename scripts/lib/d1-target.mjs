// Pure helpers (no fs, no network): which D1 database a data script may write to,
// and the wrangler arguments for it. Used by scripts/import-questions.mjs;
// unit-tested in test/import.test.ts.
import { DEMO_DB, DEMO_ENV, demoProblems, productionProblems } from "./wrangler-config.mjs";

export const LOCAL_TARGET = { kind: "local", where: "local", argv: ["DB", "--local", "--config", "wrangler.jsonc"] };

/**
 * import-questions arguments:
 *   <file.json> [--local] [--check]
 *   <file.json> --remote <db> --confirm-remote=<db> [--check]
 * --check (alias --dry-run): read and validate only, write nothing.
 * Local is the default. Remote needs the database name twice, spelled the same.
 */
export function parseImportArgs(argv) {
  const out = { file: undefined, remote: undefined, confirm: undefined, local: false, dryRun: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--local") out.local = true;
    else if (a === "--check" || a === "--dry-run") out.dryRun = true;
    else if (a === "--remote") {
      const v = argv[i + 1];
      if (!v || v.startsWith("--")) throw new Error("--remote needs a database name: --remote <db> --confirm-remote=<db>.");
      out.remote = v;
      i++;
    } else if (a.startsWith("--remote=")) out.remote = a.slice("--remote=".length);
    else if (a.startsWith("--confirm-remote=")) out.confirm = a.slice("--confirm-remote=".length);
    else if (a.startsWith("-")) throw new Error(`unknown option: ${a}. Accepted: <file.json>, --check, --local, --remote <db> --confirm-remote=<db>.`);
    else positional.push(a);
  }
  if (positional.length !== 1)
    throw new Error("give exactly one question file, for example: npm run import:questions -- my-questions.json");
  out.file = positional[0];
  if (out.local && out.remote !== undefined) throw new Error("choose --local or --remote, not both.");
  if (out.confirm !== undefined && out.remote === undefined) throw new Error("--confirm-remote is only used with --remote <db>.");
  if (out.remote !== undefined && !out.remote) throw new Error("--remote needs a database name.");
  if (out.remote !== undefined && out.confirm !== out.remote)
    throw new Error(`remote import needs --confirm-remote=${out.remote} (the same database name, typed again). Nothing was changed.`);
  return out;
}

/**
 * The remote target for a database name, or the reasons it's refused. Only the demo
 * database (env.demo, must pass the demo guard) and the production database (top
 * level, must pass the same guard as `npm run deploy`) are accepted.
 */
export function remoteTarget(config, db, processEnv = {}) {
  const prod = (config.d1_databases ?? []).find((d) => d.binding === "DB")?.database_name;
  if (db === DEMO_DB) {
    const problems = demoProblems(config, { requireId: true });
    return { kind: "demo", where: `remote ${DEMO_DB} (demo)`, argv: [DEMO_DB, "--remote", "--config", "wrangler.jsonc", "--env", DEMO_ENV], problems };
  }
  if (prod && db === prod) {
    const problems = productionProblems(config, processEnv);
    return { kind: "production", where: `remote ${prod} (PRODUCTION)`, argv: [prod, "--remote", "--config", "wrangler.jsonc"], problems };
  }
  return {
    kind: "refused",
    where: `remote ${db}`,
    argv: [],
    problems: [`"${db}" is not an allowed database. Remote targets: ${DEMO_DB} (demo) or ${prod ?? "the production database"}.`],
  };
}
