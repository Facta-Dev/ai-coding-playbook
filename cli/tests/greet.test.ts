// greet unit tests — hermetic: the clock is injected, so no test touches the
// real time or any I/O.
import { describe, expect, it } from "vitest";
import { greet } from "../src/core/greet.js";

const frozenNow = (): number => 1_700_000_000_000;

describe("greet", () => {
  it("returns a versioned ok envelope with a greeting", () => {
    const r = greet({ name: "Ada" }, { now: frozenNow });
    expect(r).toEqual({
      v: 1,
      ok: true,
      data: { greeting: "Hello, Ada!", at: 1_700_000_000_000 },
    });
  });

  it("trims surrounding whitespace from the name", () => {
    const r = greet({ name: "  Ada  " }, { now: frozenNow });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.greeting).toBe("Hello, Ada!");
    }
  });

  it("rejects an empty name with the validation error envelope", () => {
    const r = greet({ name: "   " }, { now: frozenNow });
    expect(r).toEqual({
      v: 1,
      ok: false,
      error: { code: "validation_failed", message: "name must not be empty" },
    });
  });
});
