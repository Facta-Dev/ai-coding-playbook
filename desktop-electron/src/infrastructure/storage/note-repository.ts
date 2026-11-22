// <app> — the notes storage seam of the infrastructure.
//
// The port is consumer-defined in the slice's application layer; this file
// re-exports it so the storage adapters and the containers import the port
// from one place. The adapters: the in-memory repository is the default in
// tests and the fallback, and the SQLite repository is the shipped
// projection (docs/08, ADR 0003).

export type { NoteRepositoryPort } from "../../features/notes/application/ports";
export { createInMemoryNoteRepository } from "./in-memory-note-repository";
export { createSqliteNoteRepository, SqliteNoteRepository } from "./sqlite-note-repository";
