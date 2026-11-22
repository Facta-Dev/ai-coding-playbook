// <app> — the renderer's port into the core.
//
// The ViewModel depends on this interface, never on the bridge, so unit tests
// inject a fake `CorePort` and the composition root (src/renderer/App.tsx)
// injects the only real implementation — the one over `window.hmd`. The port
// re-validates every response against the contract table: the core already
// validates, and validating again on this side means a malformed payload is
// an `internal` AppError, never a rendered object (PLAYBOOK_DESKTOP_ELECTRON
// §6).

import { IPC, type IpcRequest, type IpcResponse, type IpcType } from "@contracts/ipc";
import { type AppError, type Result, err, ok } from "@shared/index";

export interface CorePort {
  /** Call the core over the typed RPC; errors arrive as values, never thrown. */
  rpc<T extends IpcType>(
    type: T,
    payload: IpcRequest<T>,
  ): Promise<Result<IpcResponse<T>, AppError>>;
}

/** The real `CorePort`, bound to the preload bridge. */
export function createBridgeCorePort(): CorePort {
  return {
    async rpc<T extends IpcType>(type: T, payload: IpcRequest<T>) {
      let raw: unknown;
      try {
        raw = await window.hmd.rpc(type, payload);
      } catch (reason) {
        return err({
          code: "network",
          message: `rpc ${type} failed on the bridge: ${String(reason)}`,
        });
      }
      const parsed = IPC[type].response.safeParse(raw);
      // The contract table is indexed per type; the parse result narrows to
      // the response of the very type that was called.
      return parsed.success
        ? ok(parsed.data as IpcResponse<T>)
        : err({
            code: "internal",
            message: `rpc ${type} returned a payload outside the contract.`,
          });
    },
  };
}
