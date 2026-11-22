// <app> — forward-only migrations, tracked by `PRAGMA user_version`.
//
// One ordered list, applied in strict version order; a migration that does
// not follow the current version is refused instead of guessed (docs/08).
// Every migration is a projection rebuild, never a destructive rewrite: a
// schema change that cannot be expressed with `CREATE`/`ALTER` reruns the
// sync, because the backend is the source of truth.

import { err, ok, type Result } from "../../shared-kernel";
import type { DatabaseSync } from "node:sqlite";

/** One forward step of the local schema. */
export interface Migration {
  /** The `user_version` this migration moves the database to. */
  version: number;
  /** The statements, in order; each is its own `exec` so a failure names its statement. */
  readonly statements: readonly string[];
}

/** The migrations of the notes projection, in order. */
export const NOTE_MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS notes (
         id TEXT PRIMARY KEY NOT NULL,
         title TEXT NOT NULL,
         body TEXT NOT NULL,
         created_at INTEGER NOT NULL,
         updated_at INTEGER NOT NULL
       )`,
    ],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readUserVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get();
  if (isRecord(row)) {
    const value = row["user_version"];
    if (typeof value === "number") return value;
  }
  return 0;
}

function failureMessage(action: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `the migration failed: ${action}: ${detail}`;
}

/**
 * Brings the database to the latest version. The migration list is
 * forward-only: one already applied is skipped, one that would skip a
 * version is refused (a gap is never guessed through), and a database
 * already newer than the list is left untouched (an older binary on a
 * newer schema is a projection, it still reads).
 */
export function runMigrations(
  db: DatabaseSync,
  migrations: readonly Migration[] = NOTE_MIGRATIONS,
): Result<number> {
  try {
    let version = readUserVersion(db);
    for (const migration of migrations) {
      if (migration.version <= version) continue; // already applied
      if (migration.version !== version + 1) {
        return err({
          code: "internal",
          message: `the migration to version ${migration.version} was expected to follow version ${version}.`,
        });
      }
      for (const statement of migration.statements) {
        db.exec(statement);
      }
      db.exec(`PRAGMA user_version = ${migration.version}`);
      version = migration.version;
    }
    return ok(version);
  } catch (error) {
    return err({ code: "internal", message: failureMessage("a statement failed", error) });
  }
}
