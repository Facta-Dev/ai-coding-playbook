// <app> — the ports of the notes slice.
//
// The use cases talk to these interfaces and the adapters implement them
// (playbook 3.4: ports are consumer-defined). Every method answers a
// `Promise<Result<T>>`: a failure is a value the ViewModel can present,
// never a thrown exception.

import type { Result } from "../../../shared-kernel";
import type { Note } from "../domain/note";

/** The port of the notes storage. */
export interface NoteRepositoryPort {
  /** Every note of the local projection. */
  list(): Promise<Result<Note[]>>;
  /** Stores a note and answers the stored one (upsert by id). */
  add(note: Note): Promise<Result<Note>>;
}
