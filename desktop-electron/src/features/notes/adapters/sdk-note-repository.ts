// <app> — the notes repository backed by the backend.
//
// The backend is the source of truth; the local repository is a projection
// (docs/08). A read goes to the backend, refreshes the projection and
// answers it; when the backend cannot be reached the projection answers
// alone — offline as a status, not an incident. A write goes to the backend
// live and then into the projection; there is no outbox yet (the documented
// storage gap), so an offline write fails as a value and nothing is staged.
//
// The server assigns the id and the timestamps, which is why the stored
// answer of the backend travels back, not the locally drafted entity.

import { ok, type Result } from "../../../shared-kernel";
import { Note } from "../domain/note";
import type { NoteRepositoryPort } from "../application/ports";
import type { NotesApi } from "../../../infrastructure/sdk/notes-api";

export function createSdkNoteRepository(
  api: NotesApi,
  projection: NoteRepositoryPort,
): NoteRepositoryPort {
  return {
    async list(): Promise<Result<Note[]>> {
      const answer = await api.list();
      if (!answer.ok) {
        // Offline: read-only from the cache — ponytail: stale ids the backend
        // deleted stay until sign-out purge; swap in a replaceAll port call
        // when the outbox milestone lands.
        if (answer.error.code === "network") return projection.list();
        return { ok: false, error: answer.error };
      }
      const notes: Note[] = [];
      for (const dto of answer.value) {
        const note = Note.fromDto(dto);
        if (!note.ok) return { ok: false, error: note.error };
        notes.push(note.value);
      }
      for (const note of notes) {
        const cached = await projection.add(note);
        if (!cached.ok) return { ok: false, error: cached.error };
      }
      return ok(notes);
    },

    async add(note: Note): Promise<Result<Note>> {
      const answer = await api.add({ title: note.title, body: note.body });
      if (!answer.ok) return { ok: false, error: answer.error };
      const stored = Note.fromDto(answer.value);
      if (!stored.ok) return { ok: false, error: stored.error };
      const cached = await projection.add(stored.value);
      if (!cached.ok) return { ok: false, error: cached.error };
      return ok(stored.value);
    },
  };
}
