// <app> — the core's rpc server.
//
// The core listens on `process.parentPort` (the Electron utilityProcess
// channel). The transport message from main is
// `{ kind: 'rpc', id, type, payload, ctx }` (docs/02); the payload is
// **re-validated against the contract** — the transport is never trusted,
// even though main already passed the PEP (docs/06, both ends validate).
// Dispatch goes to the handler map the container built; the answer is
// validated against the response schema and posted back as
// `{ kind: 'rpc:result', id, result }`. Handlers answer kernel `Result`
// values; nothing throws across the channel.

import { IPC, isIpcType, type IpcRequest, type IpcType } from "../contracts/ipc";
import { err, ok, type Result } from "../shared-kernel";

/** The call metadata the main process attaches (core-supervisor.ts). */
export type RpcContext = {
  readonly correlationId: string;
  readonly windowKind: string;
};

/** The handler map: one handler per contract rpc type. */
export type CoreHandlers = {
  [T in IpcType]: (payload: IpcRequest<T>, ctx: RpcContext) => Promise<Result<unknown>>;
};

/** The transport message of one rpc call, narrowed from the wire. */
type RpcCall = {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly ctx: RpcContext;
};

/**
 * The part of `process.parentPort` the core needs, as a narrow local shape:
 * Electron may not augment Node's typed `process` for the utility process,
 * so the core declares only what it touches (no `any`).
 */
export interface CoreParentPort {
  on(event: "message", listener: (event: { data: unknown }) => void): void;
  postMessage(message: unknown): void;
}

/** A transport message, when it is really a call. */
function readCall(data: unknown): RpcCall | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const record = data as Record<string, unknown>;
  if (record["kind"] !== "rpc") return undefined;
  if (typeof record["id"] !== "string" || record["id"] === "") return undefined;
  if (typeof record["type"] !== "string" || record["type"] === "") return undefined;
  if (typeof record["ctx"] !== "object" || record["ctx"] === null) return undefined;
  const ctx = record["ctx"] as Record<string, unknown>;
  if (typeof ctx["correlationId"] !== "string" || typeof ctx["windowKind"] !== "string") {
    return undefined;
  }
  return {
    id: record["id"],
    type: record["type"],
    payload: record["payload"],
    ctx: { correlationId: ctx["correlationId"], windowKind: ctx["windowKind"] },
  };
}

/** One settled rpc answer, posted back to main. */
function reply(port: CoreParentPort, id: string, result: Result<unknown>): void {
  port.postMessage({ kind: "rpc:result", id, result });
}

/** Validates, dispatches and answers one message. */
function handleMessage(handlers: CoreHandlers, data: unknown, port: CoreParentPort): void {
  const call = readCall(data);
  if (!call) {
    // Malformed transport: nothing to correlate or answer with a call id.
    port.postMessage({
      kind: "rpc:result",
      id: "unknown",
      result: err({ code: "internal", message: "the transport message is malformed." }),
    });
    return;
  }
  if (!isIpcType(call.type)) {
    reply(port, call.id, {
      ok: false,
      error: { code: "not-found", message: `rpc type ${call.type} does not exist.` },
    });
    return;
  }
  const validated = IPC[call.type].request.safeParse(call.payload);
  if (!validated.success) {
    reply(port, call.id, {
      ok: false,
      error: { code: "validation", message: "the payload is outside the contract." },
    });
    return;
  }
  void dispatch(handlers, call).then((result) => {
    reply(port, call.id, result);
  });
}

/** Runs the handler and validates its answer against the response schema. */
async function dispatch(handlers: CoreHandlers, call: RpcCall): Promise<Result<unknown>> {
  if (!isIpcType(call.type)) {
    return err({ code: "not-found", message: `rpc type ${call.type} does not exist.` });
  }
  const type = call.type;
  // The request schema for this exact type is validated in `handleMessage`;
  // `callHandler` is the typed bridge that carries the validated payload in.
  let answer: Result<unknown>;
  try {
    answer = await callHandler(handlers, type, call.payload, call.ctx);
  } catch (reason) {
    answer = err({
      code: "internal",
      message: `rpc type ${type} failed: ${reason instanceof Error ? reason.message : String(reason)}.`,
      correlationId: call.ctx.correlationId,
    });
  }
  if (!answer.ok) {
    return {
      ok: false,
      error: answer.error.correlationId
        ? answer.error
        : { ...answer.error, correlationId: call.ctx.correlationId },
    };
  }
  const response = IPC[type].response.safeParse(answer.value);
  return response.success
    ? ok(response.data)
    : err({
        code: "internal",
        message: `rpc type ${type} answered outside the contract.`,
        correlationId: call.ctx.correlationId,
      });
}

/** The typed bridge: one validated call into the handler of type `T`. */
function callHandler<T extends IpcType>(
  handlers: CoreHandlers,
  type: T,
  payload: unknown,
  ctx: RpcContext,
): Promise<Result<unknown>> {
  return handlers[type](payload as IpcRequest<T>, ctx);
}

/** Listens for rpc messages on the parent port. Runs once, at core boot. */
export function startRpcServer(port: CoreParentPort, handlers: CoreHandlers): void {
  port.on("message", (event) => {
    handleMessage(handlers, event.data, port);
  });
}
