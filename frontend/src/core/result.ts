// <app> - core: a minimal Result type for the SDK's return values.
//
// The SDK returns Result<T, SdkError> rather than throwing: a non-Error
// exception is awkward to catch and loses the typed envelope. ViewModels
// discriminate on `.ok` and never inspect raw HTTP.

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T, E>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
}
