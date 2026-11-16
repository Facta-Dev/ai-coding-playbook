// argv adapter unit tests — hermetic: parseArgv takes the argument vector as
// a plain array, no process.argv involved.
import { describe, expect, it } from "vitest";
import { parseArgv } from "../src/adapters/cli.js";

describe("parseArgv", () => {
  it("parses greet with a name and the json flag", () => {
    expect(parseArgv(["greet", "--name", "Ada", "--json"])).toEqual({
      ok: true,
      invocation: { kind: "greet", name: "Ada", json: true },
    });
  });

  it("defaults the name to world and json to false", () => {
    expect(parseArgv(["greet"])).toEqual({
      ok: true,
      invocation: { kind: "greet", name: "world", json: false },
    });
  });

  it("rejects an unknown flag as a usage error", () => {
    const r = parseArgv(["greet", "--bogus"]);
    expect(r.ok).toBe(false);
  });

  it("rejects an unexpected positional argument", () => {
    const r = parseArgv(["greet", "extra"]);
    expect(r.ok).toBe(false);
  });

  it("reports the version invocation", () => {
    expect(parseArgv(["--version"])).toEqual({ ok: true, invocation: { kind: "version" } });
    expect(parseArgv(["-v"])).toEqual({ ok: true, invocation: { kind: "version" } });
  });

  it("reports the help invocation", () => {
    expect(parseArgv(["--help"])).toEqual({ ok: true, invocation: { kind: "help" } });
  });

  it("rejects an unknown command", () => {
    const r = parseArgv(["frobnicate"]);
    expect(r.ok).toBe(false);
  });
});
