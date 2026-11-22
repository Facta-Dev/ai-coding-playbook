// <app> — the sandboxed preload bridge.
//
// Exposes named functions only, no generic channel passthrough: `window.hmd
// .rpc(type, payload)` — one call over the single `rpc` channel — and
// `window.hmd.platform.info()`. No `ipcRenderer` is exposed, no `process`,
// no `require`; only JSON data crosses. The renderer types this surface in
// src/renderer/env.d.ts.

import { contextBridge, ipcRenderer } from "electron";
import { getSystemInfo } from "../platform/system-info";

/** One fresh identifier for each side of the frame. */
function freshId(): string {
  return globalThis.crypto.randomUUID();
}

// The bridge is auditable in one sitting: two functions, one channel name,
// JSON data only. The answer of a call is the wire `Result` of the PEP; the
// renderer validates the payload against the contract
// (src/renderer/core-port.ts).
contextBridge.exposeInMainWorld("hmd", {
  rpc: async (type: string, payload: unknown): Promise<unknown> => {
    const envelope = {
      v: 1,
      id: freshId(),
      type: String(type),
      correlationId: freshId(),
      payload,
    };
    return ipcRenderer.invoke("rpc", envelope);
  },
  platform: {
    info: getSystemInfo,
  },
});
