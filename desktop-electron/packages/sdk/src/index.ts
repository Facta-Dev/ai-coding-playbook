// <app> — the typed REST client of the backend.
//
// The routes live here and nowhere else (PLAYBOOK_URLS.md). The client
// imports no electron, no react and no node, and it takes the fetch it
// talks through: the same code runs in the core process, in a browser page
// and in a test.
//
// The note shape mirrors src/contracts/notes.ts. The SDK cannot import it —
// packages/ is shared with other implementations of the same playbook — so
// the shapes are declared here and the core stays the authority: it
// validates every answer it receives, so a drift between the two ends fails
// loudly instead of silently.

/** The route table of the SDK. A route is built here and nowhere else. */
export const SDK_PATHS = {
  notes: "/api/v1/app/notes",
} as const;

/** A note, as it travels. Epoch milliseconds, UTC. */
export interface SdkNote {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** The error codes of the backend; mirrors src/shared-kernel/errors.ts. */
export const SDK_ERROR_CODES = [
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

export type SdkErrorCode = (typeof SDK_ERROR_CODES)[number];

/** A failure, as a value. */
export interface SdkError {
  readonly code: SdkErrorCode;
  readonly message: string;
  readonly requiredPermission?: string;
  readonly correlationId?: string;
}

/** The answer of a call: a value or an error, never an exception. */
export type SdkResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SdkError };

/** The parts of an HTTP answer the client reads. */
export interface SdkResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface SdkRequestInit {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}

/** The transport, injected: any `fetch` that follows this shape. The first
 * argument is the full URL of the request. */
export type SdkFetch = (url: string, init?: SdkRequestInit) => Promise<SdkResponse>;

export interface SdkOptions {
  /** The fetch implementation; injected, never imported. */
  fetch: SdkFetch;
  /** The base URL of the backend, without a trailing slash. */
  baseUrl: string;
  /** The bearer token, or a reader that keeps it fresh in the session. */
  token?: string | (() => string | undefined);
}

/** The notes module of the backend. */
export interface SdkNotes {
  /** Every note. */
  list(): Promise<SdkResult<SdkNote[]>>;
  /** Stores a note and answers with the stored one. */
  add(note: { title: string; body: string }): Promise<SdkResult<SdkNote>>;
}

/** The client of the backend. */
export interface Sdk {
  readonly notes: SdkNotes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}${path}`;
}

function headersFor(token: SdkOptions["token"], hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (hasBody) headers["content-type"] = "application/json";
  const bearer = typeof token === "string" ? token : token?.();
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  return headers;
}

/** The code an HTTP status stands for, when the body does not name one. */
function errorFromStatus(status: number): SdkErrorCode {
  const table: Partial<Record<number, SdkErrorCode>> = {
    401: "unauthenticated",
    403: "forbidden",
    404: "not-found",
    409: "conflict",
    422: "validation",
    426: "upgrade-required",
    429: "rate-limited",
  };
  return table[status] ?? (status >= 500 ? "server" : "internal");
}

/** A code of the body, when it is one of the error codes. */
function readCode(value: unknown): SdkErrorCode | undefined {
  return (SDK_ERROR_CODES as readonly unknown[]).includes(value)
    ? (value as SdkErrorCode)
    : undefined;
}

/** The error of a failed answer: the body wins over the status code. */
function readError(body: unknown, status: number): SdkError {
  if (isRecord(body)) {
    const code = readCode(body["code"]);
    if (code) {
      const correlationId = body["correlationId"] ?? body["requestId"];
      return {
        code,
        message: typeof body["message"] === "string" ? body["message"] : "",
        ...(typeof body["requiredPermission"] === "string"
          ? { requiredPermission: body["requiredPermission"] }
          : {}),
        ...(typeof correlationId === "string" ? { correlationId } : {}),
      };
    }
  }
  return {
    code: errorFromStatus(status),
    message: `the server answered with the status ${status}.`,
  };
}

/** A note, when it is one. */
function readNote(value: unknown): SdkNote | undefined {
  if (!isRecord(value)) return undefined;
  const { id, title, body, createdAt, updatedAt } = value;
  if (typeof id !== "string" || id === "") return undefined;
  if (typeof title !== "string" || title === "") return undefined;
  if (typeof body !== "string") return undefined;
  if (typeof createdAt !== "number" || !Number.isInteger(createdAt) || createdAt < 0)
    return undefined;
  if (typeof updatedAt !== "number" || !Number.isInteger(updatedAt) || updatedAt < 0)
    return undefined;
  return { id, title, body, createdAt, updatedAt };
}

/** The notes of a list answer, when they are all notes. */
function readNotes(value: unknown): SdkNote[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const notes: SdkNote[] = [];
  for (const raw of value) {
    const note = readNote(raw);
    if (!note) return undefined;
    notes.push(note);
  }
  return notes;
}

async function safeJson(response: SdkResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * The client of the backend.
 *
 * Every call answers a result: a failure is a value of the call, not an
 * exception for the caller to catch. The bearer token, when present,
 * travels with every request; the routes come from `SDK_PATHS`.
 */
export function createSdk(options: SdkOptions): Sdk {
  const { fetch: transport } = options;

  async function call(
    method: "GET" | "POST",
    path: string,
    body?: string,
  ): Promise<SdkResult<unknown>> {
    let response: SdkResponse;
    try {
      response = await transport(joinUrl(options.baseUrl, path), {
        method,
        headers: headersFor(options.token, body !== undefined),
        ...(body !== undefined ? { body } : {}),
      });
    } catch {
      return {
        ok: false,
        error: { code: "network", message: "the request did not reach the server." },
      };
    }

    const payload = await safeJson(response);
    if (!response.ok) return { ok: false, error: readError(payload, response.status) };
    return { ok: true, value: payload };
  }

  const notes: SdkNotes = {
    list: async () => {
      const result = await call("GET", SDK_PATHS.notes);
      if (!result.ok) return result;
      const value = readNotes(result.value);
      return value
        ? { ok: true, value }
        : {
            ok: false,
            error: { code: "server", message: "the answer of the server is not a note list." },
          };
    },

    add: async (note) => {
      const result = await call("POST", SDK_PATHS.notes, JSON.stringify(note));
      if (!result.ok) return result;
      const value = readNote(result.value);
      return value
        ? { ok: true, value }
        : {
            ok: false,
            error: { code: "server", message: "the answer of the server is not a note." },
          };
    },
  };

  return { notes };
}
