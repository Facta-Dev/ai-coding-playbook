# 0002 — The playbook size limit is advisory

- **Status:** accepted
- **Date:** 2026-11-17
- **Owner:** architecture

## Context

The harness keeps the first 40,000 chars of an **always-on** instruction file
and caps the whole set at 120,000 chars. `instruction-budget.sh` enforces both
limits and every kit's `verify-template.sh` runs it.

Several reference playbooks are larger than 40,000 chars. They are not
`@`-imported: a path-scoped rule points at them, and a session reads the
sections it needs. The same limit does not apply to on-demand references, and
splitting a 90,000-char playbook into fragments would break its section
anchors and its cross-playbook citations.

## Decision

- The **hard** limit applies to always-on files: `CLAUDE.md`/`AGENTS.md`, its
  transitive `@` imports and path-less `.claude/rules/*.md`. Violations fail.
- A playbook over 40,000 chars is a **warning** from `playbook-lint.py`.
  Split it by concern when navigation, not the harness, demands it.
- Every playbook stays mirrored byte-for-byte into the kits; a split is a
  deliberate content change with a major version bump and a re-copy.

## Consequences

- No mass rewrite of the ten large reference playbooks, and no broken anchors.
- The size warning stays visible and is reviewed; a playbook with no clear
  navigation problem is allowed to grow.
- `instruction-budget.sh` remains the only failing size gate, and it measures
  exactly what the harness actually loads.
