// <app> — the Result type.
//
// Errors cross a layer boundary as values, never as exceptions: a failed
// call is answered with a typed error (the default error type is AppError),
// so a handler never throws across the IPC or the process boundary.

import type { AppError } from "./errors";

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

/** A successful result. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/** A failed result. */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
