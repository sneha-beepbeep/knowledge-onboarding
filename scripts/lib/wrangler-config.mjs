// Pure helpers for reading and checking wrangler.jsonc (no fs, no network), shared
// by the production deploy guard and the demo deploy script, and unit-tested.

export const DEMO_ENV = "demo";
export const DEMO_WORKER = "knowledge-check-demo";
export const DEMO_DB = "knowledge-check-demo-db";
export const DEMO_WORKFLOW = "knowledge-check-demo-draft-topic";
export const PROD_PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";
export const DEMO_PLACEHOLDER_ID = "00000000-0000-0000-0000-0000000000de";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** JSONC -> object: strips // and /* comments and trailing commas, leaving strings intact. */
export function parseJsonc(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  // Trailing commas before } or ] (strings already copied verbatim; a string can't
  // contain a bare ",}" sequence that matters here because keys/values are quoted).
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

export function isValidTimeZone(tz) {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Production guard: checks the TOP-LEVEL config only (env.demo is ignored), plus
 * the CLOUDFLARE_ENV variable, which would otherwise make `npm run build` and
 * `wrangler deploy` silently target another environment.
 */
export function productionProblems(config, processEnv = {}) {
  const problems = [];
  const vars = config.vars ?? {};
  if (!isValidTimeZone(vars.APP_TIMEZONE))
    problems.push(`APP_TIMEZONE is "${vars.APP_TIMEZONE ?? ""}". Set the company's IANA timezone in wrangler.jsonc.`);
  const db = (config.d1_databases ?? []).find((d) => d.binding === "DB");
  if (!db || !db.database_id || db.database_id === PROD_PLACEHOLDER_ID)
    problems.push("D1 database_id is the local placeholder. Run `wrangler d1 create` and paste the id.");
  if (vars.ENVIRONMENT !== "production") problems.push('ENVIRONMENT must be "production" in wrangler.jsonc.');
  if (vars.AI_MOCK !== undefined) problems.push("AI_MOCK must not be set in the production vars.");
  if (config.name === DEMO_WORKER || db?.database_name === DEMO_DB)
    problems.push("The top-level config points at the demo worker or demo database.");
  if (processEnv.CLOUDFLARE_ENV)
    problems.push(`CLOUDFLARE_ENV is set to "${processEnv.CLOUDFLARE_ENV}". Unset it: production is the top-level config.`);
  return problems;
}

/**
 * Demo guard: env.demo must be fully separate from production (worker, D1 and
 * Workflow names, database id) and must say ENVIRONMENT "demo".
 * With requireId, the database_id must be a real id (after d1 create / list).
 */
export function demoProblems(config, { requireId = false } = {}) {
  const problems = [];
  const demo = config.env?.[DEMO_ENV];
  if (!demo) return [`wrangler.jsonc has no env.${DEMO_ENV} section.`];
  if (demo.name !== DEMO_WORKER) problems.push(`env.demo.name must be "${DEMO_WORKER}" (is "${demo.name}").`);
  if (demo.name && demo.name === config.name) problems.push("env.demo.name is the production worker name.");

  const dbs = demo.d1_databases ?? [];
  const db = dbs.find((d) => d.binding === "DB");
  if (dbs.length !== 1 || !db) problems.push("env.demo must have exactly one D1 database, bound as DB.");
  else {
    if (db.database_name !== DEMO_DB) problems.push(`env.demo D1 database_name must be "${DEMO_DB}" (is "${db.database_name}").`);
    const prod = (config.d1_databases ?? []).find((d) => d.binding === "DB");
    if (prod && (prod.database_name === db.database_name || (prod.database_id === db.database_id && db.database_id !== DEMO_PLACEHOLDER_ID)))
      problems.push("env.demo D1 database is the production database.");
    if (requireId && (!UUID.test(db.database_id ?? "") || db.database_id === DEMO_PLACEHOLDER_ID || db.database_id === PROD_PLACEHOLDER_ID))
      problems.push(`env.demo D1 database_id is not a real id ("${db.database_id}").`);
  }

  const wfs = demo.workflows ?? [];
  const wf = wfs.find((w) => w.binding === "DRAFT_WORKFLOW");
  if (!wf) problems.push("env.demo must declare the DRAFT_WORKFLOW workflow.");
  else {
    if (wf.name !== DEMO_WORKFLOW) problems.push(`env.demo workflow name must be "${DEMO_WORKFLOW}" (is "${wf.name}").`);
    if ((config.workflows ?? []).some((w) => w.name === wf.name)) problems.push("env.demo workflow name is the production workflow name.");
  }

  const vars = demo.vars ?? {};
  if (vars.ENVIRONMENT !== "demo") problems.push('env.demo.vars.ENVIRONMENT must be "demo".');
  if (vars.AI_MOCK !== "1") problems.push('env.demo.vars.AI_MOCK must be "1" (no Anthropic key in round 1).');
  if (!isValidTimeZone(vars.APP_TIMEZONE)) problems.push(`env.demo.vars.APP_TIMEZONE is not a valid timezone ("${vars.APP_TIMEZONE ?? ""}").`);
  if (!vars.AI_MODEL) problems.push("env.demo.vars.AI_MODEL is missing (vars are not inherited by environments).");
  return problems;
}

/**
 * Writes the demo database_id into the env.demo D1 entry and nowhere else. The
 * text keeps its comments. Throws unless the result parses, the demo id is the
 * new one, and everything outside env.demo's database_id is unchanged.
 */
export function setDemoDatabaseId(text, id) {
  if (!UUID.test(id)) throw new Error(`not a D1 database id: "${id}"`);
  const before = parseJsonc(text);
  const re = new RegExp(`("database_name"\\s*:\\s*"${DEMO_DB}"[^}]*?"database_id"\\s*:\\s*")([^"]*)(")`);
  const matches = text.match(new RegExp(re.source, "g")) ?? [];
  if (matches.length !== 1) throw new Error(`expected one "${DEMO_DB}" entry with a database_id, found ${matches.length}`);
  const next = text.replace(re, `$1${id}$3`);

  const after = parseJsonc(next);
  const expected = structuredClone(before);
  expected.env[DEMO_ENV].d1_databases.find((d) => d.database_name === DEMO_DB).database_id = id;
  if (JSON.stringify(after) !== JSON.stringify(expected)) throw new Error("refusing to write: the edit changed more than env.demo's database_id");
  return next;
}
