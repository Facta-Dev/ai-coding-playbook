// <app> — the in-memory notes repository.
//
// The default in tests and the fallback when the SQLite driver cannot load
// (docs/08, ADR 0003): the projection is rebuildable by re-fetching, so a
// repository without persistence is always a valid state, never a crash.

import { ok, type Result } from "../../shared-kernel";
import type { Note } from "../../features/notes/domain/note";
import type { NoteRepositoryPort } from "../../features/notes/application/ports";

export function createInMemoryNoteRepository(): NoteRepositoryPort {
  const notes: Note[] = [];
  return {
    list(): Promise<Result<Note[]>> {
      const copy = [...notes];
      return Promise.resolve(ok(copy));
    },

    add(note: Note): Promise<Result<Note>> {
      const index = notes.findIndex((candidate) => candidate.id === note.id);
      if (index >= 0) notes[index] = note;
      else notes.push(note);
      return Promise.resolve(ok(note));
    },
  };
}
