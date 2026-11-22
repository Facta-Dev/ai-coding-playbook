// <app> — the IPC policy decision tests (pure; no Electron).
//
// The order of the checks IS the policy (src/main/ipc-policy.ts): top frame,
// `app://` origin, registered window, envelope, type capability, payload.
// Each test drives one rung and pins the error code a misbehaving sender
// must receive — a rejection is always an AppError value, never a throw.

import { describe, expect, it } from "vitest";
import { authorize } from "../../src/main/ipc-policy";

const ORIGIN = "app://bundle";

function envelope(type: string, payload: unknown = {}): unknown {
  return { v: 1, id: "r-1", type, correlationId: "c-1", payload };
}

/**
 * The happy baseline registered `main` window sender, with every fact the
 * PEP reads taken as a knob. An options object, not positional defaults:
 * `call(undefined, undefined, ...)` would trigger the parameter defaults,
 * not the "unregistered window" case under test.
 */
function call(opts: {
  envelope?: unknown;
  windowKind?: "main" | "settings" | undefined;
  senderOrigin?: string;
  expectedOrigin?: string;
  mainFrame?: boolean;
} = {}): ReturnType<typeof authorize> {
  return authorize(
    opts.envelope === undefined ? envelope("notes.list") : opts.envelope,
    "windowKind" in opts ? opts.windowKind : "main",
    opts.senderOrigin ?? ORIGIN,
    opts.expectedOrigin ?? ORIGIN,
    opts.mainFrame ?? true,
  );
}

describe("authorize — the sender checks", () => {
  it("rejects a child frame out of hand", () => {
    const answer = call({ mainFrame: false });
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.error.code).toBe("forbidden");
  });

  it("rejects a sender whose origin is not the app origin", () => {
    for (const bad of ["file://", "http://evil.example", ""]) {
      const answer = call({ senderOrigin: bad });
      expect(answer.ok).toBe(false);
      if (!answer.ok) {
        expect(answer.error.code).toBe("forbidden");
        expect(answer.error.message).toContain(bad);
      }
    }
  });

  it("rejects an unregistered window: it is ours if we did not create it", () => {
    const answer = call({ windowKind: undefined });
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.error.code).toBe("forbidden");
  });
});

describe("authorize — the envelope and the type", () => {
  it("rejects a malformed envelope as validation", () => {
    for (const raw of [
      null,
      7,
      {},
      { v: 2, id: "r", type: "notes.list", correlationId: "c", payload: {} },
      { v: 1, id: "r", type: "notes.list", correlationId: "c" },
    ]) {
      const answer = call({ envelope: raw });
      expect(answer.ok).toBe(false);
      if (!answer.ok) expect(answer.error.code).toBe("validation");
    }
  });

  it("rejects an unknown rpc type as not-found", () => {
    const answer = call({ envelope: envelope("notes.delete") });
    expect(answer.ok).toBe(false);
    if (!answer.ok) {
      expect(answer.error.code).toBe("not-found");
      expect(answer.error.message).toContain("notes.delete");
    }
  });
});

describe("authorize — the window capability and the payload", () => {
  it("admits every type from its capability list", () => {
    expect(call({ envelope: envelope("notes.list") }).ok).toBe(true);
    expect(call({ envelope: envelope("notes.add", { title: "Title", body: "" }) })).toMatchObject({
      ok: true,
      value: "notes.add",
    });
    expect(call({ envelope: envelope("session.get") }).ok).toBe(true);
    expect(call({ envelope: envelope("session.get"), windowKind: "settings" }).ok).toBe(true);
  });

  it("refuses a type outside the window's capability list", () => {
    const answer = call({ envelope: envelope("notes.list"), windowKind: "settings" });
    expect(answer.ok).toBe(false);
    if (!answer.ok) {
      expect(answer.error.code).toBe("forbidden");
      expect(answer.error.message).toContain("not callable from this window");
    }
  });

  it("refuses a payload outside the request schema as validation", () => {
    for (const bad of ["x", { title: "", body: "" }, { title: "t", body: "", extra: 1 }]) {
      const answer = call({ envelope: envelope("notes.add", bad) });
      expect(answer.ok).toBe(false);
      if (!answer.ok) expect(answer.error.code).toBe("validation");
    }
  });
});
