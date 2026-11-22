// <app> — the Result kernel: errors cross a boundary as values, never thrown.
//
// The tests pin the shape the every layer speaks: `ok`/`err` constructors,
// the `ok` discriminant a switch can narrow on, and the default error type
// plus the exact code list (src/shared-kernel/errors.ts) — one list shared by
// the backend envelope, the core and the renderer.

import { describe, expect, it } from "vitest";
import { APP_ERROR_CODES, ok, err, type AppError } from "../../src/shared-kernel";

describe("ok", () => {
  it("wraps a value behind a true discriminant", () => {
    const answer = ok(42);
    expect(answer).toEqual({ ok: true, value: 42 });
    if (answer.ok) expect(answer.value).toBe(42);
  });
});

describe("err", () => {
  it("wraps an AppError behind a false discriminant", () => {
    const answer = err({ code: "validation", message: "no." });
    expect(answer.ok).toBe(false);
    if (!answer.ok) {
      expect(answer.error.code).toBe("validation");
      expect(answer.error.message).toBe("no.");
    }
  });

  it("carries the optional permission and correlation fields", () => {
    const error: AppError = {
      code: "forbidden",
      message: "no.",
      requiredPermission: "notes.write",
      correlationId: "c-1",
    };
    const answer = err(error);
    expect(answer.ok).toBe(false);
    if (!answer.ok) {
      expect(answer.error.requiredPermission).toBe("notes.write");
      expect(answer.error.correlationId).toBe("c-1");
    }
  });

  it("carries a custom error type", () => {
    type Custom = { reason: "disk" };
    const answer = err<Custom>({ reason: "disk" });
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.error.reason).toBe("disk");
  });
});

describe("the AppError code list", () => {
  it("is exactly the contract's codes, in order", () => {
    expect([...APP_ERROR_CODES]).toEqual([
      "validation",
      "forbidden",
      "not-found",
      "conflict",
      "unauthenticated",
      "rate-limited",
      "network",
      "server",
      "upgrade-required",
      "policy-blocked",
      "internal",
    ]);
  });
});

describe("the Result type", () => {
  it("narrowing is exhaustive over the discriminant", async () => {
    const results = [ok(1), err({ code: "server", message: "" })];
    let okCount = 0;
    let errorCount = 0;
    for (const result of results) {
      if (result.ok) okCount += result.value;
      else errorCount += 1;
    }
    expect(okCount).toBe(1);
    expect(errorCount).toBe(1);
    await Promise.resolve();
  });
});
