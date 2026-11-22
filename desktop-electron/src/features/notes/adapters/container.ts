// <app> — the composition of the notes slice.
//
// The core's container creates the process-level dependencies (the SDK, the
// storage, the clock) and calls this to receive the slice's use cases.
// Nothing else builds a use case.

import { randomUUID } from "node:crypto";
import { systemClock, type Clock } from "../../../shared-kernel";
import { AddNote } from "../application/add-note";
import { ListNotes } from "../application/list-notes";
import type { NoteRepositoryPort } from "../application/ports";

export interface NotesSlice {
  readonly listNotes: ListNotes;
  readonly addNote: AddNote;
}

/** The identity generator of the composition root. */
export type IdGenerator = () => string;

/** The default identity: a random UUID from the core's Node runtime. */
export const generateNoteId: IdGenerator = randomUUID;

/**
 * The use cases of the slice, over the repository the core keeps.
 */
export function createNotesSlice(options: {
  repository: NoteRepositoryPort;
  /** When omitted the slice uses the system clock. */
  clock?: Clock;
  /** When omitted the slice uses a random UUID identity. */
  generateId?: IdGenerator;
}): NotesSlice {
  const clock = options.clock ?? systemClock;
  const generateId = options.generateId ?? generateNoteId;
  return {
    listNotes: new ListNotes(options.repository),
    addNote: new AddNote(options.repository, clock, generateId),
  };
}
