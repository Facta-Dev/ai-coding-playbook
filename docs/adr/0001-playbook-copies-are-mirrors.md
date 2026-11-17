# 0001 — Playbook copies are mirrors

- **Status:** accepted
- **Date:** 2026-11-17
- **Owner:** architecture

## Context

Every kit ships the shared contracts next to its code so the kit is a
standalone repository. The first implementation hand-specialized backend
copies; the copies drifted, and the Java kit ended up shipping Go playbooks
under Java filenames. No gate compared a copy with its source.

## Decision

A kit copy is a **byte-identical mirror** of the root playbook. Stack-specific
rules belong in the stack playbook (`PLAYBOOK_GOLANG.md`,
`PLAYBOOK_CHROME_EXTENSION.md`, …), never in an edited shared copy.

The copy set is:

- every kit: `SECURITY`, `TESTS`, `URLS`, `AUDIT`, `CLAUDE_CODE`;
- backend kits: `BACKEND` + the stack playbook;
- visual client kits: `FRONTEND` + the stack playbook;
- frontend/cli: their stack playbook.

`scripts/claude-kit/check-playbook-copies.sh` enforces it; a missing, extra or
different copy fails.

## Consequences

- A root edit requires one mechanical re-copy into every kit that ships it.
- A stack rule that would have been a local patch is now a root playbook edit,
  which keeps one source of truth and makes reviews meaningful.
- The gate is cheap (a `cmp` per file) and runs in the root CI; the kit
  `verify-template.sh` remains self-contained.
