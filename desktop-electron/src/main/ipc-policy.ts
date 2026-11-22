// <app> — the IPC policy decision, pure.
//
// No Electron import: the PEP (src/main/ipc-pep.ts) reads the sender facts
// off the incoming message and this module decides, as a pure function, on
// the values alone — so the sender classes are unit-test material
// (tests/main/ipc-policy.test.ts). The order of the checks is the policy:
//
//   1. the sender is the top frame of a window we created (sender check);
//   2. the sender origin is the `app://` origin (sender check);
//   3. the envelope parses (`EnvelopeSchema`, version included);
//   4. the rpc type exists in the contract table;
//   5. the window kind is in the type's capability list;
//   6. the payload parses against the type's request schema.
//
// A rejection is always an `AppError` value: `forbidden` for a sender that
// does not belong, `not-found` for an unknown type, `validation` for a
// malformed envelope or payload.

import {
  EnvelopeSchema,
  IPC,
  isIpcType,
  type Envelope,
  type IpcType,
  type IpcWindow,
} from "../contracts/ipc";
import { err, ok, type Result } from "../shared-kernel";

/** The window kinds as the contract table names them (readonly tuples). */
function allows(kind: IpcWindow, windows: readonly string[]): boolean {
  return windows.includes(kind);
}

/**
 * The pure authorization of one rpc envelope:
 *
 * - `envelope`        raw unknown payload the renderer sent;
 * - `windowKind`      registry kind of the sending webContents id;
 * - `senderOrigin`    origin of the top frame that sent the message;
 * - `expectedOrigin`  the `app://` origin this app serves;
 * - `mainFrame`       whether the sender is the window's top frame.
 */
export function authorize(
  envelope: unknown,
  windowKind: IpcWindow | undefined,
  senderOrigin: string,
  expectedOrigin: string,
  mainFrame: boolean,
): Result<IpcType> {
  if (!mainFrame) {
    return err({ code: "forbidden", message: "rpc is top-frame only; a child frame may not call." });
  }
  if (senderOrigin !== expectedOrigin) {
    return err({ code: "forbidden", message: `sender origin ${senderOrigin} is not the app origin.` });
  }
  if (windowKind === undefined) {
    return err({ code: "forbidden", message: "the sending window is not registered." });
  }
  const parsedEnvelope = EnvelopeSchema.safeParse(envelope);
  if (!parsedEnvelope.success) {
    return err({ code: "validation", message: "the rpc envelope is malformed." });
  }
  const message: Envelope = parsedEnvelope.data;
  if (!isIpcType(message.type)) {
    return err({ code: "not-found", message: `rpc type ${message.type} does not exist.` });
  }
  if (!allows(windowKind, IPC[message.type].windows)) {
    return err({
      code: "forbidden",
      message: `rpc type ${message.type} is not callable from this window.`,
    });
  }
  const parsedRequest = IPC[message.type].request.safeParse(message.payload);
  if (!parsedRequest.success) {
    return err({ code: "validation", message: `rpc type ${message.type} rejects the payload.` });
  }
  return ok(message.type);
}
