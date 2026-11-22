// <app> — the notes use cases over a fake repository (no DOM, no adapter).

import { describe, expect, it } from "vitest";
import type { Clock, Result } from "../../../shared-kernel";
import { ok } from "../../../shared-kernel";
import type { NoteDto } from "../../../contracts";
import { Note } from "../domain/note";
import type { NoteRepositoryPort } from "./ports";
import { AddNote } from "./add-note";
import { ListNotes } from "./list-notes";

const clock: Clock = { now: () => 1_000 };
const nextId = (() => {
  let counter = 0;
  return () => `note-${String((counter += 1))}`;
})();

class FakeRepository implements NoteRepositoryPort {
  notes: Note[] = [];
  failure: { code: "internal"; message: string } | undefined = undefined;

  list(): Promise<Result<Note[]>> {
    if (this.failure !== undefined) return Promise.resolve({ ok: false, error: this.failure });
    const notes = [...this.notes];
    return Promise.resolve(ok(notes));
  }

  add(note: Note): Promise<Result<Note>> {
    if (this.failure !== undefined) return Promise.resolve({ ok: false, error: this.failure });
    const index = this.notes.findIndex((candidate) => candidate.id === note.id);
    if (index >= 0) this.notes[index] = note;
    else this.notes.push(note);
    return Promise.resolve(ok(note));
  }
}

function firstNote(result: Result<Note[]>, reason: string): Note[] {
  if (!result.ok) throw new Error(reason);
  return result.value;
}

describe("AddNote", () => {
  it("stores a trimmed note stamped by the injected clock", async () => {
    const repository = new FakeRepository();
    const addNote = new AddNote(repository, clock, nextId);
    const answer = await addNote.execute({ title: "  Title  ", body: "Body" });
    expect(answer.ok).toBe(true);
    if (answer.ok) {
      expect(answer.value.title).toBe("Title");
      expect(answer.value.createdAt).toBe(1_000);
      expect(answer.value.updatedAt).toBe(1_000);
      expect(repository.notes).toHaveLength(1);
    }
  });

  it("rejects an invalid note and stores nothing", async () => {
    const repository = new FakeRepository();
    const addNote = new AddNote(repository, clock, nextId);
    const answer = await addNote.execute({ title: "", body: "Body" });
    expect(answer.ok).toBe(false);
    if (!answer.ok) {
      expect(answer.error.code).toBe("validation");
      expect(repository.notes).toHaveLength(0);
    }
  });
});

describe("ListNotes", () => {
  it("answers every stored note", async () => {
    const repository = new FakeRepository();
    const addNote = new AddNote(repository, clock, nextId);
    await addNote.execute({ title: "One", body: "a" });
    await addNote.execute({ title: "Two", body: "b" });
    const notes = firstNote(await new ListNotes(repository).execute(), "expected notes");
    expect(notes.map((note) => note.title)).toEqual(["One", "Two"]);
  });

  it("passes a repository failure through with its code", async () => {
    const repository = new FakeRepository();
    repository.failure = { code: "internal", message: "the disk is gone." };
    const answer = await new ListNotes(repository).execute();
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.error.code).toBe("internal");
  });
});

describe("Note.fromDto over stored shapes", () => {
  it("rebuilds a note from its DTO", () => {
    const dto: NoteDto = { id: "note-9", title: "Title", body: "Body", createdAt: 1, updatedAt: 2 };
    const note = Note.fromDto(dto);
    expect(note.ok).toBe(true);
  });
});
