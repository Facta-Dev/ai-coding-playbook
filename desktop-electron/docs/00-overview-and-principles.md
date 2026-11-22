# 00 — Overview & Principles

## What this kit is

`desktop-electron` is a runnable TypeScript Electron template for a
cross-platform desktop client (Windows · Linux · macOS) that shares one
language stack with the web, extension and mobile clients: a generated SDK,
shared ViewModels, a shared route table, a permission catalog and design
tokens. It implements the contract of
[`PLAYBOOK_DESKTOP_ELECTRON.md`](../PLAYBOOK_DESKTOP_ELECTRON.md) — the twin of
`PLAYBOOK_DESKTOP_QT` for the Electron runtime: Electron 45, Chromium 156,
Node 24, released 2026-10-20.

The reference slice of this kit is the same `notes` slice the Qt desktop ships:
one entity, one list view, one add form — end to end across all four processes.

## The one rule

**Renderers are untrusted web pages, and the main process never blocks.**
A compromised renderer must not be able to reach the OS, the filesystem,
tokens or other windows; anything slow, parsing-heavy, network-bound or
crash-prone runs in the core utility process. The full argument is in
[02 — Processes & Trust](02-processes-and-trust.md); the layer rules live in
[03 — Layers & MVVM](03-layers-and-mvvm.md).

## Ten principles

1. **Three trust zones, three jobs.** Main is the thin trust anchor; core is
   the application brain; renderer draws state and sends intents
   ([§3.1](../PLAYBOOK_DESKTOP_ELECTRON.md)).
2. **One typed, validated, minimal IPC contract.** Allowlisted channels, zod
   schemas validated on main and core, senders verified
   ([06](06-ipc-and-preload.md), [§5](../PLAYBOOK_DESKTOP_ELECTRON.md)).
3. **Domain and application know nothing about Electron.** They talk through
   ports; Electron, Node and DOM types are confined to adapters and
   entrypoints, enforced by per-target `tsconfig` walls and
   `dependency-cruiser` ([03](03-layers-and-mvvm.md)).
4. **The main process only orchestrates.** No SDK calls, parsing, crypto
   loops, DB access or file scanning in main
   ([§2.4](../PLAYBOOK_DESKTOP_ELECTRON.md)).
5. **The backend is the source of truth.** The desktop holds a projection
   cache and an outbox; authorization is server-side
   ([08](08-storage-outbox-and-offline.md)).
6. **Ship signed, integrity-checked and reversible.** Fuses flipped and
   verified before signing; ASAR integrity where the platform supports it
   ([09](09-security-fuses-csp-and-secrets.md), [10](10-packaging-signing-and-updates.md)).
7. **Supply chain is the main attack surface.** Pin, verify, scan, upgrade on
   the 8-week cadence ([01](01-platform-support-and-budgets.md)).
8. **Errors are values.** `Result<T, E>` inside layers and typed error codes
   across IPC; nothing throws across a process boundary
   ([§5.1](../PLAYBOOK_DESKTOP_ELECTRON.md)).
9. **Realtime is optional and degradable.** The app is correct with polling
   or none ([07](07-sdk-auth-and-realtime.md)).
10. **Administrators can govern it.** Managed policy, kill switch, update
    control, diagnostics, audit trail ([11](11-enterprise-policy-and-observability.md)).

## State of the kit

The kit ships the architecture, the hardening and the seams — not the
filled-in product. The known gaps, stated honestly rather than hidden:

| Gap | Where it is described |
| --- | --- |
| No real IdP integration (OIDC loopback flow is specified, not implemented) | [07](07-sdk-auth-and-realtime.md) |
| No updater wiring (`autoUpdater`/`electron-updater` is specified, not implemented) | [10](10-packaging-signing-and-updates.md) |
| MessagePort streaming (`ipc` fan-out for streams) is designed, not implemented | [06](06-ipc-and-preload.md) |
| `node:sqlite` availability in Electron 45's Node 24 is unconfirmed (verify); the storage adapter falls back to memory | [08](08-storage-outbox-and-offline.md) |

## Chapter map

| # | Chapter | What it covers |
| --- | --- | --- |
| 01 | [Platform, Support & Budgets](01-platform-support-and-budgets.md) | The hardware floor, the budgets, the cadence |
| 02 | [Processes & Trust](02-processes-and-trust.md) | Main, core, preload, renderer; who owns what |
| 03 | [Layers & MVVM](03-layers-and-mvvm.md) | The hexagon across processes, the tsconfig walls |
| 04 | [Vertical Slicing](04-vertical-slicing.md) | The `notes` slice, end to end |
| 05 | [Repository Layout](05-repository-layout.md) | The tree, the configs, the gates |
| 06 | [IPC & Preload](06-ipc-and-preload.md) | The envelope, the PEP, the bridge rules |
| 07 | [SDK, Auth & Realtime](07-sdk-auth-and-realtime.md) | The SDK in core, tokens, SSE/WS/polling |
| 08 | [Storage, Outbox & Offline](08-storage-outbox-and-offline.md) | SQLite, migrations, the projection cache |
| 09 | [Security](09-security-fuses-csp-and-secrets.md) | Fuses, CSP, hardening, secrets, Linux sandbox |
| 10 | [Packaging, Signing & Updates](10-packaging-signing-and-updates.md) | Forge, fuses order, the update channel |
| 11 | [Enterprise Policy & Observability](11-enterprise-policy-and-observability.md) | Policy keys, kill switch, telemetry |
| 12 | [Testing & CI](12-testing-and-ci.md) | The levels, the gates, the commands |
| 13 | [Playbooks](13-playbooks.md) | Which local playbook answers which question |
| 14 | [Glossary](14-glossary.md) | Every term used in this set |
