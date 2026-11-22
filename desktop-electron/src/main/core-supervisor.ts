// <app> — the core process supervisor.
//
// Main owns the core's life: it forks the built bundle (dist/core/index.cjs)
// with `utilityProcess.fork` and a scrubbed environment, correlates every rpc
// call with a pending-promise map, restarts the process with backoff when it
// exits, and fails in-flight calls while it comes back up. A call settles as
// a `Result` value — never a thrown exception across the process boundary
// (docs/06). Main does not run business logic; it supervises (docs/02).

import { app, utilityProcess, type UtilityProcess } from "electron";
import { randomUUID } from "node:crypto";
import { join, resolve, sep } from "node:path";
import type { IpcType } from "../contracts/ipc";
import { err, ok, type Result } from "../shared-kernel";
import { APP_ERROR_CODES, type AppErrorCode } from "../shared-kernel";

/** The metadata that rides with every call into the core. */
export type RpcCallContext = {
  readonly correlationId: string;
  readonly windowKind: string;
};

/** The handle the composition root and the PEP use. */
export type CoreHandle = {
  /** Calls the core; the answer is a value, an `AppError` on failure. */
  call(type: IpcType, payload: unknown, ctx: RpcCallContext): Promise<Result<unknown>>;
  /** Whether the core is up and taking calls. */
  isRunning(): boolean;
  /** Stops the core without a restart (app shutdown). */
  close(): void;
};

/** The exit-restart schedule: doubles from 250ms, capped at 5s. */
const BACKOFF_BASE_MS = 250;
const BACKOFF_MAX_MS = 5_000;

/** Per-call timeout: a dead-quiet core answers with a typed failure. */
const CALL_TIMEOUT_MS = 30_000;

/** One rpc answer as the core sends it: `{ kind: 'rpc:result', id, result }`. */
type WireResult = { readonly ok: boolean; readonly error?: unknown; readonly value?: unknown };

/** A pending rpc: everything needed to settle its promise. */
type Pending = {
  readonly resolve: (result: Result<unknown>) => void;
  readonly timer: NodeJS.Timeout;
};

/** A core's answer, when a message really is one. */
function readResult(message: unknown): { id: string; result: WireResult } | undefined {
  if (typeof message !== "object" || message === null) return undefined;
  if (!("kind" in message) || !("result" in message)) return undefined;
  const record = message as { kind: unknown; id: unknown; result: unknown };
  if (record.kind !== "rpc:result") return undefined;
  if (typeof record.id !== "string") return undefined;
  if (typeof record.result !== "object" || record.result === null) return undefined;
  const result = record.result as { ok: unknown };
  if (typeof result.ok !== "boolean") return undefined;
  return { id: record.id, result: record.result as WireResult };
}

/** A wire result as a kernel `Result`; a malformed one stays an `internal`. */
function asResult(wire: WireResult): Result<unknown> {
  if (wire.ok) return ok(wire.value);
  const error = (wire.error && typeof wire.error === "object" ? wire.error : {}) as Record<
    string,
    unknown
  >;
  const code = (APP_ERROR_CODES as readonly string[]).includes(
    typeof error["code"] === "string" ? error["code"] : "",
  )
    ? (error["code"] as AppErrorCode)
    : "internal";
  return err({ code, message: typeof error["message"] === "string" ? error["message"] : "the core failed." });
}

/** The failure a call settles with while the core is down. */
function coreFailure(message: string): Result<unknown> {
  return err({ code: "internal", message });
}

/**
 * Starts and keeps the core process alive. While a restart runs, in-flight
 * calls fail with a typed `internal` failure — the renderer sees a value,
 * not a hang. #ponytail: the backoff count never resets; reset it from a
 * successful call if recovery time matters.
 */
export function startCore(options: { storagePath?: string } = {}): CoreHandle {
  // The bundle lives next to the main one: dist/main/index.cjs is __dirname.
  const corePath = join(__dirname, "..", "core", "index.cjs");
  // Refuses to run when the core bundle is not inside this app: the
  // supervisor never forks a script from outside the packaged app.
  const appRoot = resolve(app.getAppPath());
  if (!resolve(corePath).startsWith(appRoot + sep)) {
    throw new Error(`the core bundle ${resolve(corePath)} is outside the app directory.`);
  }
  // The storage location rides as one fork arg (the environment stays
  // scrubbed); the core's boot reads it (src/core/index.ts).
  const forkArgs = options.storagePath ? [`--storage=${options.storagePath}`] : [];

  const pending = new Map<string, Pending>();
  let child: UtilityProcess | undefined;
  let restarts = 0;
  let restartTimer: NodeJS.Timeout | undefined;
  let stopped = false;

  function failPending(message: string): void {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.resolve(coreFailure(message));
    }
    pending.clear();
  }

  function spawn(): UtilityProcess {
    // Scrubbed environment: the core gets nothing — no tokens, no NODE_OPTIONS
    // (a fused binary would ignore it anyway), nothing inherited.
    const next = utilityProcess.fork(corePath, forkArgs, { serviceName: "core", env: {} });
    next.on("message", (message: unknown) => {
      const answer = readResult(message);
      if (!answer) return;
      const entry = pending.get(answer.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(answer.id);
      entry.resolve(asResult(answer.result));
    });
    next.on("exit", () => {
      if (stopped || child !== next) return;
      child = undefined;
      failPending("the core process died while the call was in flight.");
      const delay = Math.min(BACKOFF_BASE_MS * 2 ** restarts, BACKOFF_MAX_MS);
      restarts += 1;
      restartTimer = setTimeout(spawn, delay);
      restartTimer.unref();
    });
    return next;
  }

  child = spawn();

  return {
    call(type, payload, ctx) {
      const running = child;
      if (!running) return Promise.resolve(coreFailure("the core process is restarting; try again."));
      return new Promise<Result<unknown>>((settle) => {
        // The transport id is the supervisor's own; the correlation id of the
        // renderer rides in `ctx` for the core's error enrichment.
        const id = randomUUID();
        const timer = setTimeout(() => {
          pending.delete(id);
          settle(coreFailure("the core call timed out."));
        }, CALL_TIMEOUT_MS);
        timer.unref();
        pending.set(id, { resolve: settle, timer });
        // The message shape is the transport contract (docs/02): kind, id,
        // type, payload, ctx. The core re-validates both ends against the
        // contract schemas, so the payload stays unknown here.
        running.postMessage({ kind: "rpc", id, type, payload, ctx });
      });
    },
    isRunning() {
      return child !== undefined;
    },
    close() {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      failPending("the app is shutting down.");
      child?.kill();
      child = undefined;
    },
  };
}
