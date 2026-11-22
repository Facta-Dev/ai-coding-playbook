// <app> — the realtime transport decision, pure.
//
// The app is fully correct with polling alone (docs/07): a transport the
// runtime does not provide degrades the policy's choice step by step —
// websocket -> sse -> polling -> off — and never to an error. `auto` walks
// the same preference list. `off` stays off: that is the policy speaking,
// not a capability test.

import type { RealtimeMode } from "../../contracts";

export type RealtimeTransport = "websocket" | "sse" | "polling" | "off";

/** The transports this runtime can actually open. */
export interface RealtimeCapabilities {
  /** Whether the Electron major provides `net.WebSocket` (verify per major). */
  supportsWebSocket: boolean;
  /** Whether a streaming `net.fetch` is available for the SSE path. */
  supportsSse: boolean;
}

const PREFERENCE: readonly Exclude<RealtimeTransport, "off">[] = ["websocket", "sse", "polling"];

function isSupported(
  transport: Exclude<RealtimeTransport, "off">,
  capabilities: RealtimeCapabilities,
): boolean {
  if (transport === "websocket") return capabilities.supportsWebSocket;
  if (transport === "sse") return capabilities.supportsSse;
  return true; // polling needs nothing the runtime lacks
}

/**
 * The transport to open for the mode the policy resolved, given the
 * capabilities of this runtime.
 */
export function resolveRealtimeTransport(
  mode: RealtimeMode,
  capabilities: RealtimeCapabilities,
): RealtimeTransport {
  if (mode === "off") return "off";
  const asked = mode === "auto" ? PREFERENCE : [mode, ...PREFERENCE];
  for (const transport of asked) {
    if (isSupported(transport, capabilities)) return transport;
  }
  return "off";
}
