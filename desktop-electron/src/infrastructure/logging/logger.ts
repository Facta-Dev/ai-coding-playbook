// <app> — the structured logger of the main process and the core.
//
// One JSON line per record, a ring buffer for the diagnostics export and a
// redaction filter before anything leaves the process (docs/11): a bearer
// token in free text and a sensitive-shaped key in a field become `***`.
// The sink is injected — the main process wires the rotating file, the core
// passes the stream it owns — so this module imports no `node:*` module of
// its own and runs in every process the kit has.

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** The free-form context of a record: string, number or boolean values. */
export type LogFields = Record<string, string | number | boolean>;

/** The receiver of a serialized record; injected by the host process. */
export type LogSink = (line: string) => void;

export interface LoggerOptions {
  /** The sink; without one the log keeps only the ring buffer. */
  sink?: LogSink;
  /** The lowest level the log keeps; `debug` is dropped below it. */
  level?: LogLevel;
  /** The ring-buffer capacity for the diagnostics export. */
  capacity?: number;
  /** The context stamped onto every record the logger writes. */
  fields?: LogFields;
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** A logger that stamps `fields` on every record; shares the sink and the ring. */
  child(fields: LogFields): Logger;
  /** The recent records, oldest first — the diagnostics ring (docs/11). */
  recent(): string[];
}

/** The substrings that mark a field name as sensitive once normalized. */
const SENSITIVE_SUBSTRINGS = [
  "token",
  "password",
  "secret",
  "authorization",
  "apikey",
  "cookie",
  "credential",
] as const;

/** A sensitive-shaped field name: `accessToken`, `refresh-token`, `API_KEY`… */
export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replaceAll("-", "").replaceAll("_", "");
  return SENSITIVE_SUBSTRINGS.some((substring) => normalized.includes(substring));
}

/** Bearer credentials in free text, masked in place. */
export function redactText(text: string): string {
  return text.replace(/\bbearer\s+[a-z0-9._~+/=-]+/gi, "Bearer ***");
}

function createLoggerWith(fields: LogFields, options: Required<LoggerOptions>, ring: string[]): Logger {
  const write = (level: LogLevel, message: string, extra: LogFields): void => {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[options.level]) return;
    const record: Record<string, unknown> = {
      ts: Date.now(),
      level,
      msg: redactText(message),
    };
    const merged = { ...options.fields, ...fields, ...extra };
    // Redaction, not just serialization: a token-shaped key is masked
    // before the line exists, so nothing sensitive ever leaves the process.
    for (const [key, value] of Object.entries(merged)) {
      record[key] = isSensitiveKey(key) ? "***" : value;
    }
    const line = JSON.stringify(record);
    ring.push(line);
    if (ring.length > options.capacity) ring.splice(0, ring.length - options.capacity);
    options.sink(line);
  };

  return {
    debug: (message, extra) => write("debug", message, extra ?? {}),
    info: (message, extra) => write("info", message, extra ?? {}),
    warn: (message, extra) => write("warn", message, extra ?? {}),
    error: (message, extra) => write("error", message, extra ?? {}),
    child: (childFields) =>
      createLoggerWith({ ...fields, ...childFields }, options, ring),
    recent: () => [...ring],
  };
}

/** The structured logger, over the injected sink and the shared ring buffer. */
export function createLogger(options: LoggerOptions = {}): Logger {
  const complete: Required<LoggerOptions> = {
    sink: options.sink ?? (() => undefined),
    level: options.level ?? "info",
    capacity: options.capacity ?? 500,
    fields: options.fields ?? {},
  };
  return createLoggerWith({}, complete, []);
}
