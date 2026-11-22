# 06 — IPC & Preload

## One typed, validated, minimal IPC contract

Electron's IPC is a big open door by default: any channel, any payload, any
sender. This kit converts it to a turnstile ([§5.1](../PLAYBOOK_DESKTOP_ELECTRON.md)):

```text
Renderer → preload bridge → ipcRenderer.invoke('rpc', envelope) → MAIN (PEP)
        → core (use case) → result → MAIN → renderer
```

## The envelope

`src/contracts/ipc.ts` owns the shapes:

```text
EnvelopeSchema = { v: 1, id, type, correlationId, payload }
notes.list      req {}                          res NoteDto[]            windows ['main']
notes.add       req { title 1..120, body 0..10000 }  res NoteDto         windows ['main']
session.get     req {}                          res { permissions[] }    windows ['main','settings']
```

Request schemas are `.strict()`; unknown `v`/`type` is a typed rejection,
never a fallthrough.

## The policy-enforcement point

`src/main/ipc-policy.ts` is **pure** — no Electron import, so it is unit-test
material, not integration-test material:

```ts
authorize(envelope, windowKind, senderOrigin, expectedOrigin, mainFrame)
  : Result<IpcType>   // rejects bad origin, child frame, unknown type,
                      // window kind not in `windows`, schema failure
```

`src/main/ipc-pep.ts` wires it to `ipcMain.handle('rpc')` and forwards to
core (`src/main/core-supervisor.ts` → `core/rpc-server.ts`). Sender
verification follows [§5.1](../PLAYBOOK_DESKTOP_ELECTRON.md): the origin must
be the `app://` origin, the frame must be the **top frame** of a window in
the registry, and `webContents.id` must map to a known window kind. Child
frames and navigated pages are rejected.

Errors cross back as values riding the envelope (an `AppError` from
`src/shared-kernel/errors.ts`), never as thrown bridge exceptions with stack
traces.

## The preload bridge

`src/preload/index.ts` exposes **named functions only**:

```ts
window.hmd.rpc(type, payload)        // typed from contracts/ipc.ts
window.hmd.platform.info()
```

No `ipcRenderer`, no `require`, no `process`, no generic
`invoke(channel, …)`, only JSON-serializable data — bridging host objects is
a known escape hatch and is forbidden
([§5.3–§5.4](../PLAYBOOK_DESKTOP_ELECTRON.md)). The bridge is tiny because it
loads before every page.

**Disallowed** ([§5.4](../PLAYBOOK_DESKTOP_ELECTRON.md)): the `remote` module,
`ipcRenderer.sendSync`, `webContents.executeJavaScript` with dynamic strings,
`nodeIntegration`, `<webview>`, `enableBlinkFeatures`, sending tokens through
IPC (tokens never reach renderers).

Contract tests pin both sides: `tests/contracts/ipc.test.ts` parses the
schemas; `tests/main/ipc-policy.test.ts` proves the PEP rejects each bad
sender class.

## The renderer side

`src/renderer/core-port.ts` defines the `CorePort` interface
(`rpc<T extends IpcType>(type, payload): Promise<Result<…>>`). ViewModels
depend on the interface, so `tests/_shared/fakes/fake-core-port.ts` swaps the
bridge out in every unit test — the ViewModel never knows Electron exists.

## Direct MessagePorts — designed, not implemented

**Known gap.** For progress/streaming and realtime fan-out the design is:
after the PEP approves a window, main creates a `MessageChannelMain`, hands
one end to core (`child.postMessage(msg, [port])`) and the other to the
renderer (`webContents.postMessage('hmd:port', …, [port])`), with the port
scoped to a capability and closed on window close, navigation or policy
change ([§5.2](../PLAYBOOK_DESKTOP_ELECTRON.md)). The shipped kit routes
everything through the envelope RPC; the port plumbing, its capability
scoping and its lifecycle handling are **not** implemented here. Adding them
is a change to `main/core-supervisor.ts` + a new port lifecycle test; do not
route ordinary RPC over a port to "be modern" — the envelope's PEP path is
the security boundary.

## Do / don't

| Do | Don't |
| --- | --- |
| Add the type to `contracts/ipc.ts` first, with `.strict()` and the window list | Open a raw channel string out of the preload |
| Extend `ipc-policy.test.ts` with the new window capability | Validate only in the renderer ("the UI checks it") |
| Keep payloads JSON and small; stream via ports when one exists | Ship File/Blob/host objects across the bridge |

## See also

- [02 — Processes & Trust](02-processes-and-trust.md)
- [ADR 0001 — Three-process trust model](adr/0001-three-process-trust-model.md)
- [§5 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md) — the
  normative IPC chapter, including Appendix B's sketch
