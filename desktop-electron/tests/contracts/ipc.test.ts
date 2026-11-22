// <app> — the IPC contract tests: the table and the envelope.
//
// The contract is the one thing both ends of the bridge validate against, so
// the tests pin it hard: the protocol version, the per-type request bounds
// (`.strict()`, extra fields fail), the response shapes, and the window
// capability lists — a type callable from a window it was never scoped to is
// a contract break (PLAYBOOK_DESKTOP_ELECTRON §6).

import { describe, expect, it } from "vitest";
import {
  EnvelopeSchema,
  IPC,
  IPC_VERSION,
  IPC_WINDOWS,
  isIpcType,
} from "@contracts/ipc";
import { NoteDtoSchema, NOTE_BODY_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from "@contracts/notes";

const aNote = {
  id: "note-1",
  title: "Title",
  body: "Body",
  createdAt: 1,
  updatedAt: 1,
};

describe("envelope", () => {
  it("accepts a well-formed rpc envelope", () => {
    const parsed = EnvelopeSchema.safeParse({
      v: 1,
      id: "r-1",
      type: "notes.list",
      correlationId: "c-1",
      payload: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a protocol version it does not speak", () => {
    expect(
      EnvelopeSchema.safeParse({
        v: IPC_VERSION + 1,
        id: "r-1",
        type: "notes.list",
        correlationId: "c-1",
        payload: {},
      }).success,
    ).toBe(false);
  });

  it("requires a correlation id and an id", () => {
    const base = { v: 1, type: "notes.list", payload: {} };
    expect(EnvelopeSchema.safeParse({ ...base, id: "r-1" }).success).toBe(false);
    expect(EnvelopeSchema.safeParse({ ...base, correlationId: "c-1" }).success).toBe(false);
    expect(EnvelopeSchema.safeParse({ v: 1, id: "", type: "notes.list", correlationId: "", payload: {} }).success)
      .toBe(false);
  });

  it("rejects unknown envelope fields (strict)", () => {
    expect(
      EnvelopeSchema.safeParse({
        v: 1,
        id: "r-1",
        type: "notes.list",
        correlationId: "c-1",
        payload: {},
        extra: true,
      }).success,
    ).toBe(false);
  });
});

describe("the rpc table", () => {
  it("speaks protocol version 1 over the two window kinds", () => {
    expect(IPC_VERSION).toBe(1);
    expect(IPC_WINDOWS).toEqual(["main", "settings"]);
  });

  it("knows exactly the three documented types", () => {
    expect(Object.keys(IPC).sort()).toEqual(["notes.add", "notes.list", "session.get"]);
    expect(isIpcType("notes.list")).toBe(true);
    expect(isIpcType("session.get")).toBe(true);
    expect(isIpcType("notes.delete")).toBe(false);
    expect(isIpcType("")).toBe(false);
  });

  it("scopes the window capability of every type", () => {
    expect(IPC["notes.list"].windows).toEqual(["main"]);
    expect(IPC["notes.add"].windows).toEqual(["main"]);
    expect(IPC["session.get"].windows).toEqual(["main", "settings"]);
    for (const entry of Object.values(IPC)) {
      for (const kind of entry.windows) {
        expect((IPC_WINDOWS as readonly string[]).includes(kind), kind).toBe(true);
      }
    }
  });
});

describe("notes.list", () => {
  it("answers an array of note DTOs", () => {
    const parsed = IPC["notes.list"].response.safeParse([aNote]);
    expect(parsed.success).toBe(true);
  });

  it("takes an empty request and nothing else", () => {
    expect(IPC["notes.list"].request.safeParse({}).success).toBe(true);
    expect(IPC["notes.list"].request.safeParse({ id: "x" }).success).toBe(false);
  });
});

describe("notes.add", () => {
  it("answers one note DTO", () => {
    expect(IPC["notes.add"].response.safeParse(aNote).success).toBe(true);
  });

  it("accepts the title and body at their contract bounds", () => {
    const request = IPC["notes.add"].request;
    expect(request.safeParse({ title: "x".repeat(NOTE_TITLE_MAX_LENGTH), body: "" }).success).toBe(true);
    expect(request.safeParse({ title: "x".repeat(NOTE_TITLE_MAX_LENGTH), body: "y".repeat(NOTE_BODY_MAX_LENGTH) }).success)
      .toBe(true);
  });

  it("rejects an empty title, an overlong title and an overlong body", () => {
    const request = IPC["notes.add"].request;
    expect(request.safeParse({ title: "", body: "" }).success).toBe(false);
    expect(request.safeParse({ title: "x".repeat(NOTE_TITLE_MAX_LENGTH + 1), body: "" }).success).toBe(false);
    expect(request.safeParse({ title: "Title", body: "y".repeat(NOTE_BODY_MAX_LENGTH + 1) }).success).toBe(false);
  });

  it("rejects extra request fields (strict)", () => {
    expect(IPC["notes.add"].request.safeParse({ title: "Title", body: "", id: "x" }).success).toBe(false);
  });
});

describe("session.get", () => {
  it("answers the permission list", () => {
    expect(IPC["session.get"].response.safeParse({ permissions: ["notes.read"] }).success).toBe(true);
    expect(IPC["session.get"].response.safeParse({}).success).toBe(false);
    expect(IPC["session.get"].request.safeParse({}).success).toBe(true);
  });
});

describe("the note DTO schema", () => {
  it("validates every field", () => {
    expect(NoteDtoSchema.safeParse(aNote).success).toBe(true);
    expect(NoteDtoSchema.safeParse({ ...aNote, id: "" }).success).toBe(false);
    expect(NoteDtoSchema.safeParse({ ...aNote, title: "" }).success).toBe(false);
    expect(NoteDtoSchema.safeParse({ ...aNote, createdAt: -1 }).success).toBe(false);
    expect(NoteDtoSchema.safeParse({ ...aNote, updatedAt: 1.5 }).success).toBe(false);
    expect(NoteDtoSchema.safeParse({ ...aNote, extra: 1 }).success).toBe(false);
  });
});
