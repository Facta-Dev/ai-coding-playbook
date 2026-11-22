---
name: "ship"
description: "Prepares a <app> desktop release: bumps the version in package.json, updates the changelog and the packaging metadata, runs the full gate ladder and states what remains for the human to tag and publish."
division: core
---

# `<app>` ship skill

> Reusable workflow for cutting a release of the `<app>` desktop app. An
> agent invokes this skill; the skill supplies the checklist, the version
> bump and the gate ladder. Tagging, signing and publishing stay with the
> human.

## When to Activate

Activate this skill when the request is to cut or prepare a release: a
version bump, a release branch, a changelog entry, an artifact that CI must
build and sign.

Do NOT activate this skill when:

- The request is a code change without a release (implement it).
- The request is to file an issue (use `spec`) or to plan a large change (use
  `plan`).

## Core Principles

- **The version has one source.** `version` in `package.json` is the truth;
  the packaging metadata (`forge.config.ts`), the `about` dialog and the
  changelog all read from it, so they cannot disagree.
- **The gates decide, not the calendar.** A release is prepared only when the
  whole ladder is green: `typecheck`, `lint`, `test`, `build`, `evals`, and
  `bash scripts/verify-template.sh` for the template machinery.
- **The artifact is built by CI, on a signed tag.** The agent prepares the
  commit and the release notes; it does not tag, sign or publish.
- **The notes describe behaviour, not commits.** One line per user-visible
  change, plus the migration notes when the storage schema moved.
- **Nothing secret travels.** No token, key or private URL appears in the
  release notes, the changelog or the artifact.

## Rules

- Never tag, push, sign or publish from an agent session: the human does
  that. The agent stops at a green tree and a prepared commit.
- Never bump the version in one file only: check the packaging metadata and
  the `about` text for a duplicated version string.
- A storage schema change requires the migration note in the changelog and
  the version bump in the `src/infrastructure/storage/migrations.ts` list —
  the two travel together.
- The changelog entry lists what a user can see, not which commits landed.
- The full gate ladder is run and its real output reported; a skipped gate is
  reported as skipped, never as green.
- The release notes are written from the diff and the issue list, never from
  memory.

## Research References

| Claim | Source | Year | Link |
|-------|--------|------|------|
| The version lives in the `version` field of `package.json` | `package.json` | - | `package.json` |
| The release checklist and the packaging matrix | `PLAYBOOK_DESKTOP_ELECTRON.md` §15 | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| The gate ladder that must be green before a release | `PLAYBOOK_TESTS.md` | - | `PLAYBOOK_TESTS.md` |
| Forge packages the app and the Fuses plugin hardens the binary | `forge.config.ts` | - | `forge.config.ts` |
| Migrations are forward-only and keyed on `PRAGMA user_version` | `src/infrastructure/storage/migrations.ts` | - | `src/infrastructure/storage/migrations.ts` |

## Output Format

```
Release prepared for: <app> <old version> → <new version>
Version bump: package.json → <old> → <new>
Changelog: <path> — <entries>
Schema version: <unchanged | N+1 — migration note included>
Gates:
  pnpm run typecheck → <result>
  pnpm run lint → <result>
  pnpm run test → <result>
  pnpm run build → <result>
  pnpm run evals → <result>
  bash scripts/verify-template.sh → <result>
Release notes:
  - <user-visible change>
Ready for the human: commit, tag, sign, publish
Not done: <anything the human must complete>
```
