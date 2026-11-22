# MEMORY — `<app>` Electron desktop template

Durable facts about this repository. Facts that survive a session; not a
scratchpad, not a changelog. Update it when the reality changes, in the same
commit as the change that causes it.

## Premise

A cross-platform **desktop client** for a SaaS backend, built on the one idea
that Electron's default single-trust-zone app is the bug: **renderers are
untrusted web pages, and the main process never blocks**. The renderer holds
views and nothing else; main orchestrates, enforces the IPC policy and keeps
OS adapters; a core worker owns the domain, the SDK, the session and the
storage. A violation must fail at typecheck/lint/test time, not in review.
No user data leaves the machine except through the API.

## Process map

| Process | Runs | Trust | Owns | Never |
|---|---|---|---|---|
| Main | Node, privileged | Trusted anchor | windows, `app://` protocol, PEP, `src/platform/`, `safeStorage`, updater host | business logic, blocking calls |
| Core | `utilityProcess` (`src/core/rpc-server.ts`) | Trusted, no UI | domain, application, SDK (`net.fetch`), realtime, `node:sqlite`, session tokens (memory only) | `electron`, React, DOM |
| Preload | sandboxed | Semi-trusted | `window.hmd.rpc(type, payload)` + `window.hmd.platform.info()` only | `ipcRenderer`/`process`/`require` exposure, channel passthrough |
| Renderer | Chromium sandbox | **Untrusted** | views, view models, local UI state | node, network, secrets, cross-window |

Transport: `child.postMessage({ kind: 'rpc', id, type, payload, ctx })` over
`utilityProcess.fork`; core listens on `process.parentPort` and replies
`{ kind: 'rpc:result', id, result }`. Main restarts core with backoff; the
supervisor refuses to run outside the packaged layout.

## Layer map

One direction only, enforced by per-target tsconfigs (`tsconfig.main/core/
preload/renderer/test`), dependency-cruiser (`dependency-cruiser.config.cjs`),
ESLint `no-restricted-imports`/`-globals`, and
`tests/_platform/architecture/architecture.test.ts`.

| Layer | Path | Owns |
|---|---|---|
| shared kernel | `src/shared-kernel/` | `Result<T>`, `AppError` codes, ids, time — pure TS |
| contracts | `src/contracts/` | zod wire schemas: the `ipc` map, `NoteDto`, policy |
| platform | `src/platform/` | the **only** OS-specific code: `process.platform`, paths, `safeStorage` |
| infrastructure | `src/infrastructure/` | SDK client, storage (sqlite + in-memory), SSE parser, policy reader, logging |
| features | `src/features/<slice>/` | one vertical slice per feature |
| core | `src/core/` | rpc server + composition container (the core's own root) |
| main | `src/main/` | windows, registry, `app://` protocol, PEP, supervisor — wiring only |
| renderer | `src/renderer/` | React entry, `CorePort`, `window.hmd` typings |
| ui-kit | `src/ui-kit/` | reusable React components, theme, tokens |
| sdk | `packages/sdk/` | generated client, regenerated, never hand-edited |

## Slice model

```
src/features/<slice>/
  domain/         pure TypeScript: entities, value objects, rules — no electron, no node:*, no DOM
  application/    use cases, ports (consumer-defined, Promise<Result<T, AppError>>)
  adapters/       port implementations (SDK, storage)
  viewmodels/     plain class, no React, no DOM — tested with a fake CorePort
  views/          React components over a useNotesViewModel hook
```

Views talk to view models; view models talk to `CorePort`; use cases live in
core. Slices never import each other's internals.

## Stack

- **Electron 45** (Chromium 156, Node 24; released 2026-10-20), latest three
  majors supported, new major every 8 weeks, macOS 13+ since Electron 44.
- **TypeScript strict** (5.9), one `tsconfig` per target with distinct
  `lib`/`types`; React 19; zod 4.
- **Vite 7** — four bundles: main, preload, core as CJS `index.cjs`
  (electron and node builtins external); renderer with `base: './'`.
- **Forge** for packaging (makers: zip + squirrel + deb + rpm), fuses pinned:
  `RunAsNode` off, `EnableCookieEncryption` on, `NODE_OPTIONS` off, inspect
  args off, ASAR integrity validation on, `OnlyLoadAppFromAsar` on,
  `GrantFileProtocolExtraPrivileges` off; `asar` on.
- **pnpm 11**, Node ≥ 24.

## Storage

`node:sqlite` `DatabaseSync` (`sqlite-note-repository.ts`) behind an async
factory with an **in-memory fallback** (the default in tests) — see ADR 0003.
Schema version is `PRAGMA user_version`; migrations are forward-only and
append-only: never edit a shipped migration, add the next number
(`src/infrastructure/storage/migrations.ts`).

## Storage schema version

**1** (single migration in `src/infrastructure/storage/migrations.ts`).

## Gates

`make ci` = typecheck (5 tsconfigs) + lint (eslint + dependency-cruiser) +
test (vitest, Node environment) + build (4 vite bundles) + evals (`node --test
evals/contracts.test.mjs`). The authoritative gate is
`bash scripts/verify-template.sh`: stages a **renamed** copy
(`ELECTRON_SKIP_BINARY_DOWNLOAD=1`), runs the `.claude` linters, the
instruction budget, the leak guard and every gate on it, and never mutates the
working tree. `bash evals/run-live.sh` must be a no-op without `EVALS=1`.
`make e2e` (Playwright for Electron) and packaging are **not** part of the
default gate.

## Contracts — the IPC map

`src/contracts/ipc.ts`: `notes.list` (req `{}`, res `NoteDto[]`, windows
`['main']`), `notes.add` (title 1..120, body 0..10000, res `NoteDto`,
windows `['main']`), `session.get` (res `{ permissions: string[] }`, windows
`['main','settings']`). Envelope: `v: 1`, `id`, `type`, `correlationId`,
`payload`; request schemas `.strict()`. The PEP (`src/main/ipc-policy.ts`) is
pure: origin, top-frame, schema, unknown type and window capability checks
return `Result`, always an `AppError` value.

AppError codes: `validation | forbidden | not-found | conflict |
unauthenticated | rate-limited | network | server | upgrade-required |
policy-blocked | internal`.

## Real gaps (designed, not implemented)

Stated honestly in `docs/README.md`; keep them true:

- **No real IdP flow** (`docs/07`) — the SDK client carries the seam only.
- **No updater wiring** (`docs/10`) — Forge packaging without an updater.
- **No MessagePort streaming** (`docs/06`) — fan-out is documented, not built.
- **`node:sqlite` unverified on the packaged target** until the Electron 45
  Node API surface is checked (`docs/08`, ADR 0003 fallback).

## Where the contracts live

- Process and trust rules: `AGENTS.md` + `docs/02-processes-and-trust.md` +
  ADR 0001.
- Layer walls: `dependency-cruiser.config.cjs`, `eslint.config.mjs`,
  the tsconfig family, ADR 0002.
- Architecture decisions: `docs/adr/` (0001–0003).
- Stack digest: `PLAYBOOK_DESKTOP_ELECTRON.md`; layer law:
  `PLAYBOOK_FRONTEND.md`; security: `PLAYBOOK_SECURITY.md`.
- IPC/bridge policy: `AGENTS.md` IPC rules + `docs/06-ipc-and-preload.md`.
