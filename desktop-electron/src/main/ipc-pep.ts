// <app> — the IPC policy-enforcement point (PEP).
//
// One `rpc` channel in main. Every invocation passes the pure policy
// decision (src/main/ipc-policy.ts) before anything reaches the core: the
// sender must be the top frame of a registered window, on the `app://`
// origin, and the envelope, type capability and payload must hold. On
// success the call is forwarded to the core and settles as a `Result`
// value; a rejected sender also settles — as a value, never a thrown bridge
// exception (docs/06).

import { ipcMain } from "electron";
import { EnvelopeSchema } from "../contracts/ipc";
import { authorize } from "./ipc-policy";
import type { CoreHandle } from "./core-supervisor";
import type { WindowRegistry } from "./window-registry";

/** The deps the PEP reads; the composition root wires them once. */
export type IpcPepDeps = {
  readonly registry: WindowRegistry;
  readonly core: CoreHandle;
  /** The `app://` origin this app serves. */
  readonly expectedOrigin: string;
};

/** The origin of one frame, or `""` when the URL cannot be parsed. */
function frameOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/** Installs the single rpc handler. Call once, before the first window. */
export function registerIpcPep(deps: IpcPepDeps): void {
  ipcMain.handle("rpc", async (event, raw: unknown) => {
    // Sender verification first (PLAYBOOK_DESKTOP_ELECTRON §5.1): the frame
    // that sent the message must be the top frame of a window we created.
    const sender = event.sender;
    const senderFrame = event.senderFrame;
    const senderOrigin = senderFrame !== null ? frameOrigin(senderFrame.url) : "";
    const envelope = EnvelopeSchema.safeParse(raw);
    const windowKind = deps.registry.kindOf(sender.id);
    if (!envelope.success) {
      return { ok: false, error: { code: "validation", message: "the rpc envelope is malformed." } };
    }
    if (senderFrame === null) {
      return { ok: false, error: { code: "forbidden", message: "the sender frame is gone." } };
    }
    const decision = authorize(
      raw,
      windowKind,
      senderOrigin,
      deps.expectedOrigin,
      senderFrame === sender.mainFrame,
    );
    if (!decision.ok) {
      return { ok: decision.ok, error: decision.error };
    }

    // The core re-validates; the payload travels unknown here.
    const result = await deps.core.call(decision.value, envelope.data.payload, {
      correlationId: envelope.data.correlationId,
      windowKind: windowKind ?? "",
    });
    return result;
  });
}
