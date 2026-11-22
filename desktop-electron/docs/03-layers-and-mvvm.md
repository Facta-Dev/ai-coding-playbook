# 03 — Layers & MVVM

## The hexagon, across processes

Same hexagon as every client in the family
([PLAYBOOK_FRONTEND.md](../PLAYBOOK_FRONTEND.md), playbook
[§3.2](../PLAYBOOK_DESKTOP_ELECTRON.md)); the difference is that layers **live
in processes**: domain and application run in core, views and ViewModels run
in the sandboxed renderer, and the bridge between them is a port
(`CorePort`) like any other.

```text
INBOUND:  Views + ViewModels · IPC handlers · OS events (deep links, power, tray)
OUTBOUND: SDK (net.fetch) · Realtime (SSE/WS/poll) · SQLite · safeStorage · Updater
              ──> APPLICATION (use cases, ports, policy) ──> DOMAIN (pure TypeScript)
```

| Layer | May depend on | Must not depend on |
| --- | --- | --- |
| `shared-kernel` | nothing (pure TS) | contracts, platform, infrastructure, features |
| `contracts` | shared-kernel | platform, infrastructure, features |
| `domain` | shared-kernel | `electron`, `node:*`, DOM, React, SDK, fs |
| `application` | domain, contracts, shared-kernel | Electron/Node/DOM APIs, adapters |
| adapters | application ports, platform, Node/Electron APIs | views, other slices' internals |
| `views` (React) | ViewModel hooks, `ui-kit` | SDK, `electron`, IPC directly |
| `platform` | Electron/Node APIs | domain/application |
| `preload` | contracts only | renderer, core internals |

`process.platform` appears **only** in `src/platform/` and build files.

## Where each layer runs

| Concern | Process |
| --- | --- |
| domain, application, SDK, realtime, storage, policy resolution | **Core** |
| IPC handlers (as the enforcement point) | **Main** → core executes the use case |
| Views, ViewModels | **Renderer**; ViewModels call a `CorePort` implemented over the bridge |
| OS adapters, updater host, `safeStorage`, policy reader | **Main** |

## The walls are machine-checked

A rule the compiler does not check is a convention, and conventions decay:

* **One `tsconfig` per target** — `tsconfig.main`, `tsconfig.core`,
  `tsconfig.preload`, `tsconfig.renderer` — each with distinct `lib`/`types`.
  The renderer cannot import `electron` or Node types; main/core cannot see
  DOM types ([ADR 0002](adr/0002-per-target-tsconfigs-and-dependency-walls.md)).
* **`dependency-cruiser`** encodes the table above; violations fail `lint`
  and CI.
* **ESLint** `no-restricted-imports`/`no-restricted-globals` bans
  `process` and `require` in renderer and application code,
  `@typescript-eslint/no-floating-promises`, and friends
  (`eslint.config.mjs`).
* **`tests/_platform/architecture/architecture.test.ts`** asserts the same
  rules against the source tree, as test evidence.

## Ports and errors

Ports are consumer-defined in the slice's `application/ports.ts`; adapters
implement them; ports return `Promise<Result<T, E>>`
([§3.4](../PLAYBOOK_DESKTOP_ELECTRON.md)). Nothing throws across a process
boundary: typed `AppError` codes ride inside the envelope and are serialized
into `src/shared-kernel/errors.ts`'s taxonomy
(`validation | forbidden | not-found | conflict | unauthenticated |
rate-limited | network | server | upgrade-required | policy-blocked |
internal`).

## MVVM in the renderer

* **ViewModel** — a plain TypeScript class, **no React and no DOM**
  (`features/notes/viewmodels/notes-view-model.ts`): a `Status` union over
  the shared set (`loading | ready | empty | forbidden | not-found | offline |
  error | policy-blocked`), commands, `snapshot()`, `subscribe(cb)`. Tested
  with a fake `CorePort`, no window.
* **View** — React components over a `useNotesViewModel` hook; no business
  logic, no SDK, no IPC.
* **Navigation** through a `Navigator` port; routes follow the shared table
  ([PLAYBOOK_URLS.md](../PLAYBOOK_URLS.md)).
* ViewModels identical to a web screen's VM are shared from
  `packages/viewmodels`; parity is enforced by shared fixtures, not hope
  ([§3.7](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## Do / don't

| Do | Don't |
| --- | --- |
| Add a port to `application/ports.ts`, then an adapter | Import the SDK from a view or a ViewModel |
| Keep the ViewModel DOM-free so unit tests stay headless | Reach for `ipcRenderer` inside a component |
| Encode a new dependency rule in depcruise **and** a test | "Fix" a layering violation by adding a typed import through a wall |

## See also

- [04 — Vertical Slicing](04-vertical-slicing.md)
- [ADR 0002 — Per-target tsconfigs and dependency walls](adr/0002-per-target-tsconfigs-and-dependency-walls.md)
- [§3.2–§3.5 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md)
