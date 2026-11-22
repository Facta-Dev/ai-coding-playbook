// <app> — the invariants of the note entity.

import { describe, expect, it } from "vitest";
import { asNoteId } from "../../../shared-kernel";
import { Note, MAX_BODY_LENGTH, MAX_TITLE_LENGTH } from "./note";

const id = asNoteId("note-1");

describe("Note.create", () => {
  it("accepts a plain note", () => {
    const created = Note.create(id, "Title", "Body", 1, 1);
    expect(created.ok).toBe(true);
  });

  it("trims the title", () => {
    const created = Note.create(id, "  Title  ", "Body", 1, 1);
    if (!created.ok) throw new Error("expected a valid note");
    expect(created.value.title).toBe("Title");
  });

  it("rejects an empty title and a title of blanks only", () => {
    expect(Note.create(id, "", "Body", 1, 1).ok).toBe(false);
    expect(Note.create(id, "   ", "Body", 1, 1).ok).toBe(false);
    const rejected = Note.create(id, "", "Body", 1, 1);
    if (rejected.ok) throw new Error("expected a validation error");
    expect(rejected.error.code).toBe("validation");
  });

  it("rejects an overlong title and body", () => {
    expect(Note.create(id, "x".repeat(MAX_TITLE_LENGTH + 1), "Body", 1, 1).ok).toBe(false);
    expect(Note.create(id, "Title", "x".repeat(MAX_BODY_LENGTH + 1), 1, 1).ok).toBe(false);
  });

  it("accepts the exact bounds", () => {
    expect(Note.create(id, "x".repeat(MAX_TITLE_LENGTH), "y".repeat(MAX_BODY_LENGTH), 1, 1).ok)
      .toBe(true);
  });

  it("rejects markup in the title and the body", () => {
    expect(Note.create(id, "<b>Title", "Body", 1, 1).ok).toBe(false);
    expect(Note.create(id, "Title", "</i>Body", 1, 1).ok).toBe(false);
    expect(Note.create(id, "Title", "<!--comment Body", 1, 1).ok).toBe(false);
  });

  it("accepts a bare < that is not a tag", () => {
    expect(Note.create(id, "1 < 2 forever", "Body", 1, 1).ok).toBe(true);
  });
});

describe("Note.fromDto and Note.toDto", () => {
  it("round-trips a note", () => {
    const created = Note.create(id, "Title", "Body", 1, 2);
    if (!created.ok) throw new Error("expected a valid note");
    const back = Note.fromDto(created.value.toDto());
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.value.id).toBe(created.value.id);
      expect(back.value.title).toBe(created.value.title);
      expect(back.value.body).toBe(created.value.body);
      expect(back.value.createdAt).toBe(1);
      expect(back.value.updatedAt).toBe(2);
    }
  });

  it("applies the same invariants to a note from the storage", () => {
    expect(
      Note.fromDto({ id: "note-1", title: "", body: "Body", createdAt: 1, updatedAt: 1 }).ok,
    ).toBe(false);
  });
});
