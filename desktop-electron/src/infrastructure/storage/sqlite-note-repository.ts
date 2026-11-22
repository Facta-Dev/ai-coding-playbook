// <app> — the SQLite projection of the notes.
//
// The kit chose `node:sqlite` (`DatabaseSync`) to carry zero native modules
// — no per-ABI rebuilds, nothing to unpack from ASAR, nothing extra to sign
// (docs/08, ADR 0003). The driver loads behind an async factory: if
// `node:sqlite` is unavailable inside the Electron runtime — the known,
// unverified gap per the docs — the promise resolves the in-memory
// repository instead of crashing the core. Until verified on the packaged
// target, treat the fallback as the shipped behavior.
//
// Forward-only migrations, `PRAGMA user_version` (migrations.ts).

import type { DatabaseSync, StatementSync } from "node:sqlite";
import { err, ok, type Result } from "../../shared-kernel";
import { NoteDtoSchema } from "../../contracts";
import { Note } from "../../features/notes/domain/note";
import type { NoteRepositoryPort } from "../../features/notes/application/ports";
import { runMigrations } from "./migrations";
import { createInMemoryNoteRepository } from "./in-memory-note-repository";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A stored row, narrowed and re-validated against the contract. */
function noteFromRow(raw: unknown): Result<Note> {
  if (!isRecord(raw)) {
    return err({ code: "internal", message: "a stored note row is not an object." });
  }
  const { id, title, body, created_at, updated_at } = raw;
  const parsed = NoteDtoSchema.safeParse({
    id,
    title,
    body,
    createdAt: created_at,
    updatedAt: updated_at,
  });
  if (!parsed.success) {
    return err({
      code: "internal",
      message: "a stored note row does not match the NoteDto contract.",
    });
  }
  return Note.fromDto(parsed.data);
}

export class SqliteNoteRepository implements NoteRepositoryPort {
  private readonly select: StatementSync;
  private readonly upsert: StatementSync;

  constructor(db: DatabaseSync) {
    this.select = db.prepare(
      "SELECT id, title, body, created_at, updated_at FROM notes ORDER BY created_at, id",
    );
    this.upsert = db.prepare(
      `INSERT INTO notes (id, title, body, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         body = excluded.body,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
    );
  }

  list(): Promise<Result<Note[]>> {
    const answer = this.read();
    return Promise.resolve(answer);
  }

  /** The synchronous body of the driver, wrapped once for the port. */
  private read(): Result<Note[]> {
    try {
      const notes: Note[] = [];
      for (const row of this.select.all()) {
        const note = noteFromRow(row);
        if (!note.ok) return { ok: false, error: note.error };
        notes.push(note.value);
      }
      return ok(notes);
    } catch (error) {
      return err({
        code: "internal",
        message: `reading the notes failed: ${error instanceof Error ? error.message : String(error)}.`,
      });
    }
  }

  add(note: Note): Promise<Result<Note>> {
    const answer = this.write(note);
    return Promise.resolve(answer);
  }

  private write(note: Note): Result<Note> {
    try {
      this.upsert.run(note.id, note.title, note.body, note.createdAt, note.updatedAt);
      return ok(note);
    } catch (error) {
      return err({
        code: "internal",
        message: `storing the note failed: ${error instanceof Error ? error.message : String(error)}.`,
      });
    }
  }
}

/**
 * The async factory of the notes storage. Prefers the SQLite projection at
 * `path`; resolves the in-memory repository when the driver fails to load,
 * the file cannot be opened or a migration fails — the data is rebuildable
 * by re-fetching, so the fallback is always a valid state (docs/08).
 */
export async function createSqliteNoteRepository(path: string): Promise<NoteRepositoryPort> {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(path);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
    const migrated = runMigrations(db);
    if (!migrated.ok) {
      try {
        db.close();
      } catch {
        // The file may already be unusable; the fallback carries the state.
      }
      return createInMemoryNoteRepository();
    }
    return new SqliteNoteRepository(db);
  } catch {
    // node:sqlite unavailable in this runtime — the documented fallback.
    return createInMemoryNoteRepository();
  }
}
