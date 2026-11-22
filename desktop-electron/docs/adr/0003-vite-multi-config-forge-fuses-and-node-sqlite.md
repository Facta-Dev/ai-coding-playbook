# ADR 0003 — Vite multi-config, Forge/Fuses and the node:sqlite fallback

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-22 |
| **Scope** | Build tooling, packaging and the storage driver |
| **Supersedes** | — |

## Context

Three build-time decisions had to be made together because they share one
constraint set: the sandboxed preload must load without a module loader above
it, the packaged app must survive a hostile local environment, and the kit
must not grow a native module for storage.

## Decision

**Vite multi-config, CJS for the Node-side targets.** Four configs —
`vite.main|core|preload|renderer.config.ts` — from one dependency graph:

| Target | Output | Why |
| --- | --- | --- |
| main, core, preload | CJS `index.cjs`, externals: `electron` + node builtins | the sandboxed preload is a self-contained bundle **(verify current ESM support); CJS is the stable path** |
| renderer | React app, `base: './'` | loaded from `app://` in production |

**Electron Forge** is the packager (official, Fuses plugin, makers for
zip/Squirrel/deb/rpm). The pipeline order is fixed
([10](../10-packaging-signing-and-updates.md)): build → package → fuses →
verify fuses → sign → verify → SBOM → publish.

**Fuses table** (full table in [09](../09-security-fuses-csp-and-secrets.md)):
`RunAsNode` off, NODE_OPTIONS off, inspect args off,
`EnableCookieEncryption` on, `EnableEmbeddedAsarIntegrityValidation` on,
`OnlyLoadAppFromAsar` on, file-protocol privileges off. CI verifies fuses
from the packaged output before signing — the fuse table is a claim the
artifact must restate.

**Storage: `node:sqlite` with an in-memory fallback.** The kit ships zero
native modules. `sqlite-note-repository.ts` loads `node:sqlite`'s
`DatabaseSync` behind an async factory; if the module fails to load, the
factory resolves the **in-memory repository** without crashing the core.
Migrations are forward-only, tracked by `PRAGMA user_version`.

## Why these choices

* One build graph means one dependency set and one dev loop (renderer HMR)
  ([ADR decision D4 of the playbook](../PLAYBOOK_DESKTOP_ELECTRON.md)); Forge is chosen over
  electron-builder to keep the official fuses/ASAR-integrity path native to
  the config ([§1 D5](../PLAYBOOK_DESKTOP_ELECTRON.md)).
* CJS for the Node-side targets costs nothing at runtime (bundled, so the
  module format is invisible from outside) and removes the preload-ESM
  question until verified.
* Zero native modules removes the whole `@electron/rebuild`-per-ABI pipeline
  — and its signing/ASAR-unpack surface
  ([§12.4 of the playbook](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## The fallback honesty

> **(verify)** The kit's claim — "`node:sqlite` `DatabaseSync` is available in
> Electron 45's bundled Node 24" — is **unconfirmed at the source**. That is
> why the adapter is a factory with a working in-memory fallback instead of a
> crash-prone eager import. Until verified on the packaged target, treat the
> in-memory path as shipped behavior: persistence is a build-once, verify-once
> step away. The alternatives if `node:sqlite` is not available remain
> (better-sqlite3 with per-ABI rebuilds, or WASM SQLite) — either is an ADR
> revision, and the repository port makes the swap local
> ([08](../08-storage-outbox-and-offline.md)).

## Consequences

**Accepted:** four configs instead of one; the storage fallback means the
shipped kit may run without persistence until verified; Forge's maker set
kept deliberately minimal (zip + Squirrel + deb + rpm — MSIX/pkg/Flatpak when
a product needs them).

**Bought:** no native-module rebuild matrix across 3 OS × 2 arch; packaging
that a hostile local environment cannot trivially unwind; one dev loop.

**Rejected:** electron-builder as default (its update path pulls
`electron-updater` in by default; a product choosing it needs the ADR);
ESM preload today (unverified); native modules for storage.

## See also

[05 — Repository Layout](../05-repository-layout.md) ·
[08 — Storage, Outbox & Offline](../08-storage-outbox-and-offline.md) ·
[10 — Packaging, Signing & Updates](../10-packaging-signing-and-updates.md)
