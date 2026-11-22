---
name: "add-slice"
description: "Scaffolds a new vertical slice in the <app> Electron tree — domain, application, adapters, viewmodels, views and tests — with the typed IPC contract, the ports, the preload surface and the core wiring that keep the trust zones intact."
division: core
---

# `<app>` add-slice skill

> Reusable workflow for adding one vertical slice to `<app>`. An agent invokes
> this skill; the requester supplies the feature, the skill supplies the
> scaffolding, the trust-zone discipline and the gate ladder.

## When to Activate

Activate this skill when the request is a new feature that owns its own
domain — a new kind of entity, screen or workflow that will grow: a new
"tasks" slice, a new "settings" slice, a new billing slice.

Do NOT activate this skill when:

- The change adds a field, a rule or a screen to an **existing** slice — that
  is a change inside `src/features/<slice>/`, not a new slice.
- The change is a bug fix (fix it in place, with a red test first).
- The request only adds an IPC channel or a policy key — use the dedicated
  skills for those; this skill may consume them.

## Core Principles

- **Vertical, not horizontal.** A slice owns one feature end to end: domain
  rules, use cases, adapters, view models and views. Nothing about the feature
  is scattered across `src/infrastructure/` or `src/main/`.
- **The renderer stays thin.** Views render view-model state; the view model
  is a plain class without React, tested with a fake `CorePort`; all real work
  happens in the core process behind the typed RPC.
- **Ports are consumer-defined.** The interface a use case needs lives in
  `application/`, next to the use case; the adapter that satisfies it lives in
  `adapters/` and may depend on the SDK, `node:sqlite` or the platform tree.
- **Layer walls are enforced, not promised.** Domain and application never
  import `electron` or `node:*`; the renderer never imports `electron`,
  `node:*` or `@/sdk` — the tsconfig restrictions, ESLint rules, the
  dependency-cruiser config and the architecture test must all stay honest.
- **Mirror the `notes` slice.** The template already ships a worked example in
  `src/features/notes/`; copy its shape rather than inventing a new one.

## Rules

- No fabricated paths: every file created must be listed with its real path,
  and every existing path referenced must exist in the tree.
- The renderer reaches the core only through the typed RPC: any new channel
  needs a contract-map entry with a `.strict()` request schema, a response
  schema and a `windows` allowlist, plus the contract and policy tests.
- No `electron`, `node:*` or SDK type enters the domain, application or
  renderer layers; no React type enters the domain or application layers.
- The slice ships with at least one test per layer: a domain test, an
  application test against the fakes in `tests/_shared/fakes/`, a view-model
  test, and an architecture-test update if the slice introduces a new rule.
- No new third-party dependency without an ADR.
- No step is "done" until `pnpm typecheck`, `pnpm lint`, `pnpm test` and
  `pnpm build` are green; run them and report the real output.

## Research References

| Claim | Source | Year | Link |
|-------|--------|------|------|
| The process model, layers and slice mapping | `PLAYBOOK_DESKTOP_ELECTRON.md` §3 | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| The typed IPC contract and preload bridge rules | `PLAYBOOK_DESKTOP_ELECTRON.md` §5, Appendix B | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| The repository layout the slice must follow | `PLAYBOOK_DESKTOP_ELECTRON.md` §4 | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| The worked slice to mirror | `src/features/notes/` | - | `src/features/notes/` |

## Output Format

```
Slice: <name> — path: src/features/<name>/
Created:
  domain/       <files> — <what they hold>
  application/  <files> — <use cases, ports>
  adapters/     <files> — <port implementations>
  viewmodels/   <files> — <view model, status set>
  views/        <files> — <React components>
  tests/        <files> — <cases>
IPC: <channels added, windows allowlists, tests>
Wiring: <what src/core/container.ts and the renderer composition now construct>
Gates:
  pnpm typecheck → <result>
  pnpm lint → <result>
  pnpm test → <result>
  pnpm build → <result>
Open: <anything left for the next slice>
```
