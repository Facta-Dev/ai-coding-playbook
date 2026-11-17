# 0002 — Playbook size is split, not ignored

- **Status:** accepted
- **Date:** 2026-11-17
- **Owner:** architecture

## Context

The harness keeps the first 40,000 chars of an **always-on** instruction file
and caps the whole set at 120,000 chars. `instruction-budget.sh` enforces both
limits and every kit's `verify-template.sh` runs it.

Reference playbooks are not `@`-imported: a path-scoped rule points at them and
a session reads the sections it needs. Their size is a navigation concern, not
a harness truncation risk. The set originally grew past 40,000 chars in eleven
files, and `playbook-lint.py` reported them as warnings.

## Decision

- The **hard** limit applies to always-on files: `CLAUDE.md`/`AGENTS.md`, its
  transitive `@` imports and path-less `.claude/rules/*.md`. Violations fail.
- A playbook over 40,000 chars is a **warning**; it is resolved by splitting,
  not by raising the threshold. `scripts/split-playbook.py` performs the split
  deterministically at `## ` section boundaries:
  - the main file keeps the preamble and the first sections, plus a Parts index;
  - `PLAYBOOK_<NAME>_PART<n>.md` carries the rest;
  - section numbers stay stable, and cross-playbook references point at the
    part that now holds the section;
  - `manifest.json` gains one entry per part; kits mirror the parts.
- The 2026-11-17 split brought every root playbook under the threshold.
- Every playbook stays mirrored byte-for-byte into the kits; a split is a
  deliberate change and the copy gate includes the parts.

## Consequences

- `playbook-lint.py` reports zero size warnings; all 38 entries (21 mains and
  17 parts) are under 40,000 chars.
- Future growth has one deterministic path: run the splitter, re-copy the
  parts, and let the drift gate fail if a kit was missed.
- The always-on budget remains the only failing size gate, and it measures
  exactly what the harness actually loads.
