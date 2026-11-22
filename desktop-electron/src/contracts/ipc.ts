// <app> — the IPC contract.
//
// One contract, both ends validate with it. The renderer calls
// `window.hmd.rpc(type, payload)`; the preload forwards the typed envelope to
// the main process, the policy gate rejects a sender that does not belong,
// and the core answers a Result. A request schema that is not `.strict()`
// lets an unexpected field through — never do that.

import { z } from "zod";
import { NoteDtoSchema, NOTE_BODY_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from "./notes";

/** The version of the RPC protocol. Bumped on a breaking change. */
export const IPC_VERSION = 1;

/** The windows the app opens; `settings` is the policy-gated surface. */
export const IPC_WINDOWS = ["main", "settings"] as const;
export type IpcWindow = (typeof IPC_WINDOWS)[number];

/**
 * The frame every message carries, as it travels between the renderer and
 * the main process. The `payload` stays unknown here: the typed `ipc` table
 * validates it against the per-type request schema.
 */
export const EnvelopeSchema = z.strictObject({
  v: z.literal(IPC_VERSION),
  id: z.string().min(1),
  type: z.string().min(1),
  correlationId: z.string().min(1),
  payload: z.unknown(),
});

export type Envelope = z.infer<typeof EnvelopeSchema>;

/** The typed table of the rpc channel: request schema, response schema, and
 * the windows each type may be called from. */
export const IPC = {
  "notes.list": {
    request: z.strictObject({}),
    response: NoteDtoSchema.array(),
    windows: ["main"],
  },
  "notes.add": {
    request: z.strictObject({
      title: z.string().min(1).max(NOTE_TITLE_MAX_LENGTH),
      body: z.string().max(NOTE_BODY_MAX_LENGTH),
    }),
    response: NoteDtoSchema,
    windows: ["main"],
  },
  "session.get": {
    request: z.strictObject({}),
    response: z.strictObject({ permissions: z.array(z.string()) }),
    windows: ["main", "settings"],
  },
} as const;

/** The rpc types the app answers, as the key of the `ipc` table. */
export type IpcType = keyof typeof IPC;

/** The request payload of a call, as the contract validates it. */
export type IpcRequest<T extends IpcType> = z.infer<(typeof IPC)[T]["request"]>;

/** The response payload of a call, as the contract validates it. */
export type IpcResponse<T extends IpcType> = z.infer<(typeof IPC)[T]["response"]>;

/** The windows a call may be issued from. */
export type IpcWindows<T extends IpcType> = (typeof IPC)[T]["windows"];

/** Whether `type` is a rpc type the app answers. */
export function isIpcType(type: string): type is IpcType {
  return Object.hasOwn(IPC, type);
}
