// <app> — the validated notes surface of the backend.
//
// The SDK shapes mirror `contracts/notes.ts` but cannot import them
// (packages/ is shared with the other implementations of this playbook).
// The core stays the authority: every answer passes `NoteDtoSchema` before
// it reaches the domain, so a drift between the two ends fails loudly
// instead of silently.
//
// The route and the error taxonomy live in the SDK (`./client`); this
// module only translates its answers into the app's own types.

import { NoteDtoSchema, type NoteDto } from "../../contracts";
import { err, ok, type AppError, type Result } from "../../shared-kernel";
import type { Sdk, SdkError, SdkNote } from "./client";

/** The notes API of the backend, as the core consumes it. */
export interface NotesApi {
  /** Every note, validated against the contract. */
  list(): Promise<Result<NoteDto[]>>;
  /** Stores a note (the server assigns the id) and answers the stored one. */
  add(note: { title: string; body: string }): Promise<Result<NoteDto>>;
}

export function createNotesApi(sdk: Sdk): NotesApi {
  function withAppError(error: SdkError): AppError {
    const appError: AppError = { code: error.code, message: error.message };
    if (error.requiredPermission !== undefined) {
      appError.requiredPermission = error.requiredPermission;
    }
    if (error.correlationId !== undefined) appError.correlationId = error.correlationId;
    return appError;
  }

  function toNoteDtos(value: SdkNote[]): Result<NoteDto[]> {
    const parsed = NoteDtoSchema.array().safeParse(value);
    return parsed.success ? ok(parsed.data) : err({
      code: "server",
      message: "the backend answered a note list that does not match the note contract.",
    });
  }

  function toNoteDto(value: SdkNote): Result<NoteDto> {
    const parsed = NoteDtoSchema.safeParse(value);
    return parsed.success ? ok(parsed.data) : err({
      code: "server",
      message: "the backend answered a note that does not match the note contract.",
    });
  }

  return {
    async list(): Promise<Result<NoteDto[]>> {
      const answer = await sdk.notes.list();
      if (!answer.ok) return { ok: false, error: withAppError(answer.error) };
      return toNoteDtos(answer.value);
    },

    async add(note: { title: string; body: string }): Promise<Result<NoteDto>> {
      const answer = await sdk.notes.add({ title: note.title, body: note.body });
      if (!answer.ok) return { ok: false, error: withAppError(answer.error) };
      return toNoteDto(answer.value);
    },
  };
}
