// Deploy config: the production guard still guards production only, env.demo is
// fully separate, and the deploy:demo helpers behave. No fs, no network: the real
// wrangler.jsonc is imported as text.
import { describe, expect, it } from "vitest";
import wranglerText from "../wrangler.jsonc?raw";
import {
  DEMO_DB,
  DEMO_PLACEHOLDER_ID,
  DEMO_WORKER,
  DEMO_WORKFLOW,
  PROD_PLACEHOLDER_ID,
  demoProblems,
  parseJsonc,
  productionProblems,
  setDemoDatabaseId,
} from "../scripts/lib/wrangler-config.mjs";
import {
  builtConfigProblems,
  extractDemoUrl,
  findDemoDatabase,
  parseArgs,
  pickAccount,
  renderCommand,
} from "../scripts/lib/deploy-demo-lib.mjs";

const REAL_ID = "3f2a1c4e-9b7d-4e21-8a6f-0c5d2e7b9a11";
const OTHER_ID = "7c1e2d3f-4a5b-4c6d-8e9f-a0b1c2d3e4f5";
const config = () => parseJsonc(wranglerText);
const withProdId = (c: ReturnType<typeof config>, id = REAL_ID) => {
  c.d1_databases[0].database_id = id;
  return c;
};

describe("wrangler.jsonc: production (top level) is unchanged", () => {
  it("keeps the production worker, DB, workflow and vars, with the real timezone", () => {
    const c = config();
    expect(c.name).toBe("onboarding-knowledge-check");
    expect(c.d1_databases).toEqual([
      { binding: "DB", database_name: "onboarding-knowledge-check-db", database_id: PROD_PLACEHOLDER_ID, migrations_dir: "migrations" },
    ]);
    expect(c.workflows).toEqual([{ name: "draft-topic", binding: "DRAFT_WORKFLOW", class_name: "DraftTopicWorkflow" }]);
    expect(c.vars).toEqual({ ENVIRONMENT: "production", AI_MODEL: "claude-opus-5-5", APP_TIMEZONE: "Etc/GMT-2" });
  });

  it("Etc/GMT-2 is UTC+2 all year (no daylight saving)", () => {
    const hour = (ms: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "Etc/GMT-2", hour: "2-digit", hourCycle: "h23" }).format(ms);
    expect(hour(Date.UTC(2026, 0, 15, 22, 0))).toBe("00"); // winter
    expect(hour(Date.UTC(2026, 6, 15, 22, 0))).toBe("00"); // summer
  });
});

describe("production deploy guard (npm run deploy)", () => {
  it("still blocks the real config, and only for the production DB id placeholder", () => {
    const p = productionProblems(config(), {});
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/database_id is the local placeholder/);
  });

  it("passes once the production id is set; env.demo does not block it", () => {
    expect(productionProblems(withProdId(config()), {})).toEqual([]);
  });

  it("blocks a bad timezone, a non-production ENVIRONMENT and AI_MOCK at the top level", () => {
    const c = withProdId(config());
    c.vars.APP_TIMEZONE = "UNSET-BEFORE-DEPLOY";
    expect(productionProblems(c, {}).join()).toMatch(/APP_TIMEZONE/);
    const d = withProdId(config());
    d.vars.ENVIRONMENT = "demo";
    expect(productionProblems(d, {}).join()).toMatch(/ENVIRONMENT must be "production"/);
    const m = withProdId(config());
    m.vars.AI_MOCK = "1";
    expect(productionProblems(m, {}).join()).toMatch(/AI_MOCK/);
  });

  it("ignores env.demo's ENVIRONMENT (the old text regex could be fooled by it)", () => {
    const c = withProdId(config());
    c.vars.ENVIRONMENT = "local";
    // env.demo still contains ENVIRONMENT "demo", top level is wrong: must block.
    expect(productionProblems(c, {}).length).toBe(1);
  });

  it("blocks when CLOUDFLARE_ENV is set (it would build and deploy another environment)", () => {
    expect(productionProblems(withProdId(config()), { CLOUDFLARE_ENV: "demo" }).join()).toMatch(/CLOUDFLARE_ENV/);
  });

  it("blocks a top level that points at the demo worker or DB", () => {
    const c = withProdId(config());
    c.name = DEMO_WORKER;
    expect(productionProblems(c, {}).join()).toMatch(/demo worker/);
  });
});

describe("env.demo is a separate demo copy", () => {
  it("has its own worker, DB, workflow and demo vars", () => {
    const demo = config().env.demo;
    expect(demo.name).toBe(DEMO_WORKER);
    expect(demo.d1_databases[0]).toMatchObject({ binding: "DB", database_name: DEMO_DB, database_id: DEMO_PLACEHOLDER_ID });
    expect(demo.workflows[0]).toEqual({ name: DEMO_WORKFLOW, binding: "DRAFT_WORKFLOW", class_name: "DraftTopicWorkflow" });
    expect(demo.vars).toEqual({ ENVIRONMENT: "demo", AI_MOCK: "1", AI_MODEL: "claude-opus-5-5", APP_TIMEZONE: "Etc/GMT-2" });
    expect(demoProblems(config())).toEqual([]);
  });

  it("requires a real id before remote use", () => {
    expect(demoProblems(config(), { requireId: true }).join()).toMatch(/not a real id/);
  });

  it("refuses a demo that shares production's DB name, DB id or workflow name", () => {
    const a = config();
    a.env.demo.d1_databases[0].database_name = "onboarding-knowledge-check-db";
    expect(demoProblems(a).join()).toMatch(/production database|database_name must be/);
    const b = withProdId(config());
    b.env.demo.d1_databases[0].database_id = REAL_ID;
    expect(demoProblems(b).join()).toMatch(/production database/);
    const w = config();
    w.env.demo.workflows[0].name = "draft-topic";
    expect(demoProblems(w).join()).toMatch(/production workflow name/);
    const e = config();
    e.env.demo.vars.ENVIRONMENT = "production";
    expect(demoProblems(e).join()).toMatch(/ENVIRONMENT must be "demo"/);
  });
});

describe("setDemoDatabaseId", () => {
  it("changes only env.demo's database_id, keeps comments, and is idempotent", () => {
    const next = setDemoDatabaseId(wranglerText, REAL_ID);
    const before = config();
    const after = parseJsonc(next);
    expect(after.env.demo.d1_databases[0].database_id).toBe(REAL_ID);
    expect(after.d1_databases).toEqual(before.d1_databases);
    after.env.demo.d1_databases[0].database_id = DEMO_PLACEHOLDER_ID;
    expect(after).toEqual(before);
    expect(next).toContain("// DEMO COPY");
    expect(next.split("\n").length).toBe(wranglerText.split("\n").length);
    expect(demoProblems(parseJsonc(next), { requireId: true })).toEqual([]);
    // Re-running with another id (e.g. DB recreated) replaces it again.
    expect(parseJsonc(setDemoDatabaseId(next, OTHER_ID)).env.demo.d1_databases[0].database_id).toBe(OTHER_ID);
    expect(setDemoDatabaseId(next, REAL_ID)).toBe(next);
  });

  it("refuses anything that isn't a D1 id", () => {
    expect(() => setDemoDatabaseId(wranglerText, "knowledge-check-demo-db")).toThrow(/not a D1 database id/);
    expect(() => setDemoDatabaseId(wranglerText, '"; "x": "')).toThrow();
  });
});

describe("parseJsonc", () => {
  it("strips comments and trailing commas but not // inside strings", () => {
    expect(parseJsonc('{ // c\n "a": "https://x", /* b */ "b": [1, 2,], }')).toEqual({ a: "https://x", b: [1, 2] });
  });
});

describe("deploy:demo helpers", () => {
  it("parses flags and rejects unknown ones", () => {
    expect(parseArgs([])).toEqual({ yes: false, dryRun: false, seed: false, help: false });
    expect(parseArgs(["--yes", "--seed", "--dry-run"])).toEqual({ yes: true, dryRun: true, seed: true, help: false });
    expect(() => parseArgs(["--prod"])).toThrow(/unknown argument/);
  });

  it("picks the single account, honours CLOUDFLARE_ACCOUNT_ID, refuses ambiguity and signed-out", () => {
    const one = { loggedIn: true, accounts: [{ id: "a1", name: "Company" }] };
    const two = { loggedIn: true, accounts: [{ id: "a1", name: "Company" }, { id: "a2", name: "Personal" }] };
    expect(pickAccount(one)).toEqual({ id: "a1", name: "Company" });
    expect(pickAccount(two, "a1").name).toBe("Company");
    expect(() => pickAccount(two)).toThrow(/CLOUDFLARE_ACCOUNT_ID/);
    expect(() => pickAccount(two, "zz")).toThrow(/not one of/);
    expect(() => pickAccount({ loggedIn: false })).toThrow(/wrangler login/);
  });

  it("finds the demo DB by exact name only", () => {
    const list = [
      { uuid: REAL_ID, name: "onboarding-knowledge-check-db" },
      { uuid: OTHER_ID, name: DEMO_DB },
      { uuid: "x", name: `${DEMO_DB}-old` },
    ];
    expect(findDemoDatabase(list)).toEqual({ id: OTHER_ID, name: DEMO_DB });
    expect(findDemoDatabase(list.slice(0, 1))).toBeNull();
  });

  it("extracts only the demo worker's workers.dev URL", () => {
    expect(extractDemoUrl("Deployed\n  https://knowledge-check-demo.acme.workers.dev\n")).toBe("https://knowledge-check-demo.acme.workers.dev");
    expect(extractDemoUrl("https://onboarding-knowledge-check.acme.workers.dev")).toBeNull();
  });

  it("accepts only a demo build before deploying", () => {
    const built = {
      name: DEMO_WORKER,
      targetEnvironment: "demo",
      d1_databases: [{ binding: "DB", database_name: DEMO_DB, database_id: REAL_ID }],
      vars: { ENVIRONMENT: "demo" },
    };
    expect(builtConfigProblems(built, REAL_ID)).toEqual([]);
    expect(builtConfigProblems({ ...built, name: "onboarding-knowledge-check", targetEnvironment: undefined }, REAL_ID)).toHaveLength(2);
    expect(builtConfigProblems(built, OTHER_ID).join()).toMatch(/database_id/);
  });

  it("renders commands shell-style", () => {
    expect(renderCommand("npm", ["run", "build"], { CLOUDFLARE_ENV: "demo" })).toBe("CLOUDFLARE_ENV=demo npm run build");
    expect(renderCommand("x", ["a b", "it's"])).toBe("x 'a b' 'it'\\''s'");
  });
});
