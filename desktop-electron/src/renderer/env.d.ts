// <app> — the renderer's environment types.
//
// The only browser global the renderer may reach for is `window.hmd`, the
// typed bridge the preload script installs (src/preload/index.ts). Everything
// else — electron, Node, process, require — does not exist in this surface
// (PLAYBOOK_DESKTOP_ELECTRON §3, §6):
//
//   window.hmd.rpc(type, payload)   → the typed RPC over the contract table.
//   window.hmd.platform.info()      → static platform facts (os, arch).
//
// The preload module is the source of truth for the exact `PlatformInfo`
// fields; the renderer treats them as display strings and never branches a
// rule on them (`process.platform` lives in src/platform only).

interface HmdBridge {
  /** One call over the rpc channel; both ends validate against `src/contracts/ipc.ts`. */
  readonly rpc: (type: string, payload: unknown) => Promise<unknown>;
  readonly platform: {
    /** Static platform facts, for display and support-matrix logging. */
    readonly info: () => Promise<Record<string, string>>;
  };
}

interface Window {
  readonly hmd: HmdBridge;
}
