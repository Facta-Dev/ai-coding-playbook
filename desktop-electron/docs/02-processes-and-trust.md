# 02 — Processes & Trust

## Three trust zones, three jobs

Electron gives every app one privileged process by default. This kit spends
that privilege on exactly two processes with jobs, and treats everything else
as untrusted ([§3.1](../PLAYBOOK_DESKTOP_ELECTRON.md)):

| Process | Trust | Owns | Must not |
| --- | --- | --- | --- |
| **Main** (Node, privileged, thin) | Trusted anchor | Window lifecycle, `app://` protocol, OS adapter host (`src/platform/`), policy **enforcement point** for IPC, `safeStorage`, updater host, crash reporter | Business logic, SDK, DB, long loops, blocking calls, remote content |
| **Core** (utility process, app brain) | Trusted, no UI | Use cases, generated SDK over `net.fetch`, realtime, SQLite, outbox/sync, session (tokens in memory only) | The DOM, privileged Electron UI APIs, messages from unvetted senders |
| **Preload** (sandboxed bridge) | Semi-trusted | The narrow `window.hmd` API generated from `src/contracts/ipc.ts` | Expose `ipcRenderer`, `require`, `process`, generic `invoke(channel, …)` |
| **Renderer** (React) | **Untrusted** | Views, ViewModels, local UI state | Node, filesystem, network, secrets, cross-window access |

Short-lived utility processes or Web Workers take the heavy tasks (parsing,
indexing, exports, hashing) and exit.

## Why main is thin

Main is the only process that can create windows and change OS state, so it
is also the blast radius of any bug that gets into it. Everything the main
process does not strictly need to do happens in core
(`utilityProcess.fork`):

* the **main process never blocks** — a stalled main loop is a frozen UI and
  a lost window;
* a **core crash is survivable** — main restarts core with backoff and the
  renderer shows "reconnecting"; a main crash takes the app down;
* **secrets and the SDK live in core**, so a compromised renderer (by
  threat model, the most likely break) can never reach a token by touching
  the bridge, whatever else it reaches ([§12.1](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## Supervision

`src/main/core-supervisor.ts` starts the core with `utilityProcess.fork`
passing a scrubbed environment, restarts it with backoff on
`exit`/crash (surfacing a reconnecting status to the renderers), and refuses
to run if the core binary is not inside the packaged app
([§3.1](../PLAYBOOK_DESKTOP_ELECTRON.md)). Transport: `child.postMessage`
with `{ kind: 'rpc', id, type, payload, ctx }`; core listens on
`process.parentPort` and replies `{ kind: 'rpc:result', id, result }`.

## The renderer's isolation is the default, not a flag

| Default | Since | Set where |
| --- | --- | --- |
| `contextIsolation: true` | Electron 12 | every `BrowserWindow`'s `webPreferences` |
| `sandbox: true` | Electron 20 | every renderer |
| `nodeIntegration: false` | Electron 5 | never enabled |

The kit's window factory (`src/main/windows.ts`) hardens these plus
`webSecurity`, `webviewTag: false`, `allowRunningInsecureContent: false`,
`devTools: !app.isPackaged`, and denies permission requests by default
([09](09-security-fuses-csp-and-secrets.md)). **Never disable context
isolation to fix a bug** — it also removes process sandboxing for that
renderer ([§12.2](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## Who talks to whom

```text
Renderer --(typed envelope)--> Preload --(ipcRenderer.invoke('rpc'))--> Main (PEP)
        --(MessagePortMain / postMessage)--> Core (use case) --> result --> Main --> Renderer
Events (core -> renderers): main fans out per subscription, coalesced
```

The PEP (`src/main/ipc-policy.ts`) is pure and testable: sender origin must
be the `app://` origin of a top frame of a window we created; the message
type must exist in the contract; the window kind must hold the capability for
it in `windows: ['main']`-style lists ([06](06-ipc-and-preload.md)).

## Failure containment

| Failure | Behavior |
| --- | --- |
| Core crash | main restarts it with backoff; renderers see a typed status; in-flight RPCs reject as `internal` |
| Renderer crash | `render-process-gone` → reload to last route ([§14](../PLAYBOOK_DESKTOP_ELECTRON.md)) |
| GPU process crash × N | safe mode next launch ([01](01-platform-support-and-budgets.md)) |
| Main event-loop stall > 50 ms | watchdog logs and counts it ([§2.4](../PLAYBOOK_DESKTOP_ELECTRON.md)) |

## See also

- [ADR 0001 — Three-process trust model](adr/0001-three-process-trust-model.md)
- [06 — IPC & Preload](06-ipc-and-preload.md)
- [§3.1 and §12.1 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md)
