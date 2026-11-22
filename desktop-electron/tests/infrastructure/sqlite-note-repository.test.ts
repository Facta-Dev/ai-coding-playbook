// <app> — the SQLite notes projection tests.
//
// `node:sqlite` (`DatabaseSync`) is the shipped driver with the documented
// gap: the Electron Node runtime may ship without it (unverified on the
// packaged target, docs/08, ADR 0003). Every driver-dependent test therefore
// skips when the module is absent; the fallback test runs either way, because
// the in-memory fallback is valid in both worlds — the projection is
// rebuildable by re-fetching, a repository without persistence is never a
// crash.

import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { asNoteId } from "@shared/index";
import { Note } from "../../src/features/notes/domain/note";
import { NOTE_MIGRATIONS, runMigrations } from "../../src/infrastructure/storage/migrations";
import {
  createSqliteNoteRepository,
  SqliteNoteRepository,
} from "../../src/infrastructure/storage/sqlite-note-repository";

/** Whether this Node runtime ships the driver at all, and the class it holds. */
let DatabaseSync: typeof import("node:sqlite")["DatabaseSync"] | undefined;
let sqliteAvailable = false;
try {
  DatabaseSync = (await import("node:sqlite")).DatabaseSync;
  sqliteAvailable = DatabaseSync !== undefined;
} catch {
  sqliteAvailable = false;
}

function aNote(id: string, title: string, createdAt: number, updatedAt: number): Note {
  const created = Note.create(asNoteId(id), title, "Body", createdAt, updatedAt);
  if (!created.ok) throw new Error("expected a valid note");
  return created.value;
}

/** An in-memory database; only called inside driver-guarded tests. */
function openMemoryDb(): import("node:sqlite").DatabaseSync {
  if (!sqliteAvailable || DatabaseSync === undefined) throw new Error("node:sqlite is unavailable");
  return new DatabaseSync(":memory:");
}

describe("runMigrations", () => {
  // `it.skipIf` needs vitest 0.34+; vitest 5 supports it. When the driver is
  // absent the migrations are unreachable code anyway (the factory falls
  // back before it ever opens a database).
  it.skipIf(!sqliteAvailable)("applies the list in order and stamps user_version", () => {
    const db = openMemoryDb();
    const first = runMigrations(db);
    expect(first).toMatchObject({ ok: true, value: NOTE_MIGRATIONS.at(-1)?.version ?? 0 });
    const version = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    expect(version).toBe(NOTE_MIGRATIONS.at(-1)?.version ?? 0);
    db.close();
  });

  it.skipIf(!sqliteAvailable)("is idempotent: an applied migration is skipped", () => {
    const db = openMemoryDb();
    runMigrations(db);
    expect(runMigrations(db)).toMatchObject({ ok: true, value: 1 });
    db.close();
  });

  it.skipIf(!sqliteAvailable)("refuses a migration that skips a version", () => {
    const db = openMemoryDb();
    const gapped = runMigrations(db, [{ version: 3, statements: ["SELECT 1"] }]);
    expect(gapped.ok).toBe(false);
    if (!gapped.ok) expect(gapped.error.code).toBe("internal");
    db.close();
  });
});

describe("SqliteNoteRepository", () => {
  it.skipIf(!sqliteAvailable)("round-trips a note and orders by created_at", async () => {
    const db = openMemoryDb();
    runMigrations(db);
    const repository = new SqliteNoteRepository(db);
    expect((await repository.add(aNote("n-1", "Second", 2, 2))).ok).toBe(true);
    expect((await repository.add(aNote("n-0", "First", 1, 1))).ok).toBe(true);
    expect((await repository.add(aNote("n-2", "Third", 3, 3))).ok).toBe(true);

    const listed = await repository.list();
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.map((note) => note.title)).toEqual(["First", "Second", "Third"]);
      expect(listed.value[0]?.updatedAt).toBe(1);
    }
    db.close();
  });

  it.skipIf(!sqliteAvailable)("upserts by id", async () => {
    const db = openMemoryDb();
    runMigrations(db);
    const repository = new SqliteNoteRepository(db);
    await repository.add(aNote("n-1", "One", 1, 1));
    await repository.add(aNote("n-1", "Two", 1, 9));

    const listed = await repository.list();
    if (!listed.ok) throw new Error("expected a list");
    expect(listed.value).toHaveLength(1);
    expect(listed.value[0]?.title).toBe("Two");
    expect(listed.value[0]?.updatedAt).toBe(9);
    db.close();
  });

  it.skipIf(!sqliteAvailable)("persists across repository instances on a file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hmd-sqlite-"));
    const file = join(dir, "notes.db");
    try {
      const first = await createSqliteNoteRepository(file);
      expect((await first.add(aNote("n-1", "Persisted", 1, 1))).ok).toBe(true);

      const second = await createSqliteNoteRepository(file);
      const listed = await second.list();
      expect(listed.ok).toBe(true);
      if (listed.ok) expect(listed.value.map((note) => note.title)).toEqual(["Persisted"]);
    } finally {
      // The WAL journal rides next to the file; remove the family, then the dir.
      try {
        for (const suffix of ["", "-wal", "-shm"]) {
          try {
            unlinkSync(file + suffix);
          } catch {
            // A journal file may not exist; the temp dir is still cleaned.
          }
        }
        rmSync(dir, { force: true });
      } catch {
        // Cleanup only; the assertions above carry the verdict.
      }
    }
  });
});

describe("the fallback", () => {
  it("answers a working in-memory repository when the path cannot be opened", async () => {
    // The directory does not exist, so the driver cannot create the file:
    // the factory must resolve the fallback instead of rejecting.
    const repository = await createSqliteNoteRepository("/proc/hmd-no-such-dir/notes.db");
    expect((await repository.add(aNote("n-1", "Fallback", 1, 1))).ok).toBe(true);
    const listed = await repository.list();
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value.map((note) => note.title)).toEqual(["Fallback"]);
  });
});
