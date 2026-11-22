---
name: "electron-upgrade"
description: "Bumps <app> to a new Electron major: the cadence policy, the breaking-change sweep across main/preload/core/renderer, the fuse and protocol recheck, the full gate ladder and the (verify) register for anything unconfirmed."
division: core
---

# `<app>` electron-upgrade skill

> Reusable workflow for upgrading the `<app>` Electron dependency to a new
> major. An agent invokes this skill; the skill drives the bump, the sweep and
> the gates.

## When to Activate

Activate this skill when the Electron dependency in `package.json` is being
moved to a new major (or a security patch within one): the scheduled cadence
bump, or a security-driven emergency bump.

Do NOT activate this skill when:

- Only a sibling dependency (Vite, React, zod, typescript) changes — that is an
  ordinary dependency change with the ordinary gates.
- The upgrade has no plan behind it: first state the target version and its
  release facts; never invent one.
- The change is a new feature during the upgrade — an upgrade diff is an
  upgrade diff, nothing else.

## Core Principles

- **The cadence is policy, not preference.** The playbook mandates supporting
  the latest three Electron majors with a new major every 8 weeks; falling
  behind is a policy finding, not a task to defer.
- **Facts before changes.** The target version's release facts (Chromium and
  Node versions, breaking API notes, platform floors such as the macOS
  minimum) come from the source; anything not confirmed at the source stays
  `(verify)` and is recorded, never asserted.
- **The sweep is across all four processes.** Breaking changes land
  asymmetrically in main, preload, core and renderer; each gets its own
  read.
- **Hardening survives the bump.** webPreferences defaults, the `app://`
  protocol, the PEP and the fuse table are re-verified after the upgrade, not
  assumed.
- **The gates decide.** `make ci` green on the new major is the only claim of
  success.

## Rules

- Never invent a version or a Chromium/Node pairing: read the playbook, the
  verify register and the actual release notes; mark everything unconfirmed
  `(verify)`.
- The bump touches `package.json` and the lockfile only for the version move;
  no drive-by dependency changes ride along.
- Sweep and fix, in order: main (`BrowserWindow`, protocol, handlers), preload
  (bridge integrity against newer contextIsolation semantics), core
  (`utilityProcess`, `parentPort`), renderer (Chromium-facing behaviour), then
  `forge.config.ts` and the fuse table.
- Re-run the architecture, contract and policy tests explicitly; an upgrade
  that only runs a subset has not run the gates.
- A test that starts failing after the bump is fixed, not deleted or weakened;
  if a fix needs a decision (an API moved), record it as an ADR candidate.
- No step is "done" until the full ladder — `pnpm typecheck`, `pnpm lint`,
  `pnpm test`, `pnpm build`, `pnpm evals`, `make ci` — is green with real
  output reported.

## Research References

| Claim | Source | Year | Link |
|-------|--------|------|------|
| Electron upgrade cadence (latest three majors, 8-week cycle) | `PLAYBOOK_DESKTOP_ELECTRON.md` §2.6 | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| Platform floors and support matrix policy | `PLAYBOOK_DESKTOP_ELECTRON.md` §2.1, Appendix L | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| Current verified Electron facts (versions, dates) | `ai-coding-playbook/verify-register.md` | - | `verify-register.md` |
| Fuses after packaging, before signing | `PLAYBOOK_DESKTOP_ELECTRON.md` §12.3 | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| The pin to bump | `package.json` | - | `package.json` |

## Output Format

```
Upgrade: electron <from> → <to>
Facts: Chromium <...>, Node <...>, released <...> — <(verify) if unconfirmed>
Sweep:
  main      <findings/fixes>
  preload   <findings/fixes>
  core      <findings/fixes>
  renderer  <findings/fixes>
  forge     <fuse recheck result>
Gates:
  pnpm typecheck → <result>
  pnpm lint → <result>
  pnpm test → <result>
  pnpm build → <result>
  pnpm evals → <result>
Records: <verify-register rows to add — (verify) items>
Left for humans: <signing, OS runners, release steps>
```
