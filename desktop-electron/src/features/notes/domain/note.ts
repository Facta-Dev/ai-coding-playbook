// <app> — the note entity.
//
// The invariants live here (playbook 3.1: the rules live in the domain,
// never in a view and never in the storage): the title is never empty and
// never longer than the contract bound, the body never bigger, and a note
// is plain text — a tag-like fragment never enters the entity.

import { asNoteId, err, ok, type NoteId, type Result } from "../../../shared-kernel";
import type { NoteDto } from "../../../contracts";

/** The bounds of a note; the contracts restate them on the wire. */
export const MAX_TITLE_LENGTH = 120;
export const MAX_BODY_LENGTH = 10_000;

/** A tag-like fragment: `<` followed by a letter, a slash or `!`. */
function containsMarkup(text: string): boolean {
  const tagStart = text.indexOf("<");
  if (tagStart < 0) return false;
  const next = text.charAt(tagStart + 1);
  return /[a-z!/]/i.test(next);
}

export class Note {
  readonly id: NoteId;
  readonly title: string;
  readonly body: string;
  /** Epoch milliseconds, UTC. */
  readonly createdAt: number;
  /** Epoch milliseconds, UTC. */
  readonly updatedAt: number;

  private constructor(
    id: NoteId,
    title: string,
    body: string,
    createdAt: number,
    updatedAt: number,
  ) {
    this.id = id;
    this.title = title;
    this.body = body;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /** A new note: the caller owns the identity and the clock. */
  static create(
    id: NoteId,
    rawTitle: string,
    body: string,
    createdAt: number,
    updatedAt: number,
  ): Result<Note> {
    const title = rawTitle.trim();
    if (title === "") {
      return err({ code: "validation", message: "the title is empty." });
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return err({
        code: "validation",
        message: `the title is longer than ${MAX_TITLE_LENGTH} characters.`,
      });
    }
    if (body.length > MAX_BODY_LENGTH) {
      return err({
        code: "validation",
        message: `the body is longer than ${MAX_BODY_LENGTH} characters.`,
      });
    }
    if (containsMarkup(title) || containsMarkup(body)) {
      return err({ code: "validation", message: "a note is plain text, not markup." });
    }
    return ok(new Note(id, title, body, createdAt, updatedAt));
  }

  /** A note that arrives from the storage or the server: the same invariants. */
  static fromDto(dto: NoteDto): Result<Note> {
    return Note.create(asNoteId(dto.id), dto.title, dto.body, dto.createdAt, dto.updatedAt);
  }

  /** The wire shape, as the contract validates it. */
  toDto(): NoteDto {
    return {
      id: this.id,
      title: this.title,
      body: this.body,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
