// Which environments honour AI_MOCK (CPO decision 2026-09-29): local and the
// deployed demo copy only. Production ignores it and needs a real key.
import { describe, expect, it } from "vitest";
import { aiMock, aiSetUp, appTz, isDemo, isLocal } from "../worker/lib/state";

const envOf = (vars: Record<string, string | undefined>) => vars as unknown as Env;

describe("AI mock and readiness by environment", () => {
  it("demo + AI_MOCK=1: mock on, AI counts as set up", () => {
    const env = envOf({ ENVIRONMENT: "demo", AI_MOCK: "1" });
    expect(isDemo(env)).toBe(true);
    expect(isLocal(env)).toBe(false);
    expect(aiMock(env)).toBe(true);
    expect(aiSetUp(env)).toBe(true);
  });

  it("production + AI_MOCK=1: mock ignored, AI still not set up", () => {
    const env = envOf({ ENVIRONMENT: "production", AI_MOCK: "1" });
    expect(aiMock(env)).toBe(false);
    expect(aiSetUp(env)).toBe(false);
  });

  it("production with a key is set up, without the mock", () => {
    const env = envOf({ ENVIRONMENT: "production", AI_MOCK: "1", ANTHROPIC_API_KEY: "sk-test" });
    expect(aiMock(env)).toBe(false);
    expect(aiSetUp(env)).toBe(true);
  });

  it("demo without AI_MOCK is not set up; only the exact value 'demo' counts", () => {
    expect(aiSetUp(envOf({ ENVIRONMENT: "demo" }))).toBe(false);
    expect(aiSetUp(envOf({ ENVIRONMENT: "demo", AI_MOCK: "0" }))).toBe(false);
    expect(aiSetUp(envOf({ ENVIRONMENT: "Demo", AI_MOCK: "1" }))).toBe(false);
    expect(aiSetUp(envOf({ ENVIRONMENT: "demo-production", AI_MOCK: "1" }))).toBe(false);
  });

  it("local + AI_MOCK=1 is unchanged", () => {
    expect(aiSetUp(envOf({ ENVIRONMENT: "local", AI_MOCK: "1" }))).toBe(true);
  });
});

describe("APP_TIMEZONE fixed GMT+2 (Etc/GMT-2)", () => {
  it("is accepted in production and demo", () => {
    expect(appTz(envOf({ ENVIRONMENT: "production", APP_TIMEZONE: "Etc/GMT-2" }))).toBe("Etc/GMT-2");
    expect(appTz(envOf({ ENVIRONMENT: "demo", APP_TIMEZONE: "Etc/GMT-2" }))).toBe("Etc/GMT-2");
  });

  it("demo does not get the local UTC fallback for a bad timezone", () => {
    expect(() => appTz(envOf({ ENVIRONMENT: "demo", APP_TIMEZONE: "UNSET-BEFORE-DEPLOY" }))).toThrow(/APP_TIMEZONE/);
  });
});
