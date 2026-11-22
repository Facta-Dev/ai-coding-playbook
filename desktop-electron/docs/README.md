# Electron 45 Desktop Template — Documentation

The handbook of the desktop-electron kit: **TypeScript, Electron 45
(Chromium 156, Node 24), Vite + Forge, one typed IPC contract**. It describes
the kit as it is — the three-process model, the layers, the PEP, the SDK, the
storage adapter, the fuses — and marks the parts that are designed but not
implemented as stated gaps.

> 15 chapters · 4 reference documents · 3 ADRs.

## The one rule

**Renderers are untrusted web pages, and the main process never blocks.** The
domain knows nothing about Electron; core holds the SDK, the session and the
storage; main orchestrates and enforces the IPC policy. A violation fails at
typecheck/lint/architecture-test time, not in review. See
[02 — Processes & Trust](02-processes-and-trust.md) and
[03 — Layers & MVVM](03-layers-and-mvvm.md).

## Start here

New to the kit? Read [00 — Overview & Principles](00-overview-and-principles.md),
then [02 — Processes & Trust](02-processes-and-trust.md) and
[05 — Repository Layout](05-repository-layout.md). Starting a project? Copy
the kit, run `scripts/rename.sh`, then follow
[13 — Playbooks](13-playbooks.md). Reviewing a change? Read
[06 — IPC & Preload](06-ipc-and-preload.md) and
[09 — Security](09-security-fuses-csp-and-secrets.md).

## Chapters

| # | Chapter | What it covers |
| --- | --- | --- |
| 00 | [Overview & Principles](00-overview-and-principles.md) | The one idea, ten principles, the chapter map |
| 01 | [Platform, Support & Budgets](01-platform-support-and-budgets.md) | Electron 45 facts, hardware floor, budgets, cadence |
| 02 | [Processes & Trust](02-processes-and-trust.md) | Main/core/preload/renderer, supervision, failure containment |
| 03 | [Layers & MVVM](03-layers-and-mvvm.md) | The hexagon across processes, the tsconfig/dep walls |
| 04 | [Vertical Slicing](04-vertical-slicing.md) | The `notes` slice, end to end |
| 05 | [Repository Layout](05-repository-layout.md) | The tree, the four Vite targets, instantiating |
| 06 | [IPC & Preload](06-ipc-and-preload.md) | The envelope, the PEP, the bridge rules, the port gap |
| 07 | [SDK, Auth & Realtime](07-sdk-auth-and-realtime.md) | SDK in core, tokens, the IdP gap, SSE/WS/polling |
| 08 | [Storage, Outbox & Offline](08-storage-outbox-and-offline.md) | `node:sqlite` + fallback, migrations, the outbox gap |
| 09 | [Security](09-security-fuses-csp-and-secrets.md) | Fuses, CSP, hardening, secrets, Linux sandbox |
| 10 | [Packaging, Signing & Updates](10-packaging-signing-and-updates.md) | Forge, fuse order, signing, the updater gap |
| 11 | [Enterprise Policy & Observability](11-enterprise-policy-and-observability.md) | Policy keys, kill switch, telemetry |
| 12 | [Testing & CI](12-testing-and-ci.md) | Levels, gates, `verify-template.sh`, the CI matrix |
| 13 | [Playbooks](13-playbooks.md) | Which local playbook answers which question |
| 14 | [Glossary](14-glossary.md) | Every term used in this set |

## Reference

| Document | What it covers |
| --- | --- |
| [Support Matrix](support-matrix.md) | Per-release table: minimum OS, arches, display servers, end of support |
| [Data Flows](data-flows.md) | Four flows, the trust boundary written on every hop |
| [Admin Guide](admin-guide.md) | Policy keys, sources per OS, publish and verify |
| [Permissions Register](permissions-register.md) | IPC types → window capabilities → backend permissions; OS permissions |
| [ADR 0001 — Three-process trust model](adr/0001-three-process-trust-model.md) | Why main+core+renderer, and what it buys |
| [ADR 0002 — Per-target tsconfigs and dependency walls](adr/0002-per-target-tsconfigs-and-dependency-walls.md) | Machine-checked layer rules |
| [ADR 0003 — Vite multi-config, Forge/Fuses and the node:sqlite fallback](adr/0003-vite-multi-config-forge-fuses-and-node-sqlite.md) | One build graph, the fuse order, zero native modules |

## The gates

| Command | What it proves |
| --- | --- |
| `make ci` | Typecheck (5 tsconfigs) + lint + test + build + evals |
| `make verify` / `bash scripts/verify-template.sh` | The whole kit in a staged, renamed copy, gate by gate |
| `make e2e` | Playwright for Electron on the packaged app (skips without a display/binary) |
| `make evals` | The contract register harness |
| `bash evals/run-live.sh` | Must be a no-op without `EVALS=1` |

## Known gaps of the kit

The kit ships the seams, not the filled-in product. The gaps, listed once
and meant honestly: **no real IdP flow** ([07](07-sdk-auth-and-realtime.md)),
**no updater wiring** ([10](10-packaging-signing-and-updates.md)),
**MessagePort streaming designed but not implemented**
([06](06-ipc-and-preload.md)), and the **`node:sqlite` fallback**
([08](08-storage-outbox-and-offline.md)) until Electron 45's Node API surface
is verified on the packaged target.

## Where the normative text is

This docs set paraphrases
[`PLAYBOOK_DESKTOP_ELECTRON.md`](../PLAYBOOK_DESKTOP_ELECTRON.md). On any
conflict the playbook wins and this set gets fixed in the same pull request
([13 — Playbooks](13-playbooks.md)).
