// <app> — the window registry.
//
// Pure module, no Electron import: it maps a `webContents.id` to the kind of
// window it belongs to, and the IPC policy-enforcement point reads that kind
// as the window's capability (which rpc types the sender may call). A
// webContents id the registry does not know belongs to no window of ours.

import type { IpcWindow } from "../contracts/ipc";

export type WindowRegistry = {
  /** Registers a window we created, keyed by its webContents id. */
  register(id: number, kind: IpcWindow): void;
  /** The kind of the window, or `undefined` for an unknown sender. */
  kindOf(id: number): IpcWindow | undefined;
  /** Forgets a window (called on the window's `destroyed` event). */
  unregister(id: number): void;
};

/** The registry the composition root owns. */
export function createWindowRegistry(): WindowRegistry {
  const kinds = new Map<number, IpcWindow>();
  return {
    register: (id, kind) => {
      kinds.set(id, kind);
    },
    kindOf: (id) => kinds.get(id),
    unregister: (id) => {
      kinds.delete(id);
    },
  };
}
