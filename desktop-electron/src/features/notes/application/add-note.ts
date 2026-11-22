// <app> — the use case of a new note.
//
// The domain validates the note, the repository stores it. The identity and
// the clock are injected: the composition root wires the id generator and
// the real clock, a test wires its own, so the use case stays deterministic.

import { asNoteId, type Clock, type Result } from "../../../shared-kernel";
import { Note } from "../domain/note";
import type { NoteRepositoryPort } from "./ports";

export type IdGenerator = () => string;

export interface AddNoteInput {
  title: string;
  body: string;
}

export class AddNote {
  constructor(
    private readonly repository: NoteRepositoryPort,
    private readonly clock: Clock,
    private readonly generateId: IdGenerator,
  ) {}

  async execute(input: AddNoteInput): Promise<Result<Note>> {
    const now = this.clock.now();
    const created = Note.create(asNoteId(this.generateId()), input.title, input.body, now, now);
    if (!created.ok) return { ok: false, error: created.error };
    return this.repository.add(created.value);
  }
}
