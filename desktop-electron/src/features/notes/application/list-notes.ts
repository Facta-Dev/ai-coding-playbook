// <app> — the use case of the list of notes.

import type { Result } from "../../../shared-kernel";
import type { Note } from "../domain/note";
import type { NoteRepositoryPort } from "./ports";

export class ListNotes {
  constructor(private readonly repository: NoteRepositoryPort) {}

  execute(): Promise<Result<Note[]>> {
    return this.repository.list();
  }
}
