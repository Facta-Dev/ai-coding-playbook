// <app> — the error codes of the desktop app.
//
// One list, shared by every layer: the backend error envelope, the core and
// the renderer all speak these codes, so a code that is not in this list can
// never cross a boundary.

export const APP_ERROR_CODES = [
  "validation",
  "forbidden",
  "not-found",
  "conflict",
  "unauthenticated",
  "rate-limited",
  "network",
  "server",
  "upgrade-required",
  "policy-blocked",
  "internal",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

/** A typed failure, as a value. `requiredPermission` is set on `forbidden`. */
export interface AppError {
  code: AppErrorCode;
  message: string;
  requiredPermission?: string;
  correlationId?: string;
}
