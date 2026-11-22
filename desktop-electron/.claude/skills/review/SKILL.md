---
name: "review"
description: "Reviews a <app> change against the desktop layer law, the process model and preload bridge rules, the secrets policy and the gate results, and reports severity-prefixed findings with a verdict."
division: core
---

# `<app>` review skill

> Reusable workflow for reviewing a change before it lands. An agent invokes
> this skill; the skill supplies the checklist, the order of the checks and
> the shape of the report.

## When to Activate

Activate this skill when a change is ready for review: a pull request, a
local diff, a branch that another session wrote.

Do NOT activate this skill when:

- The request is to write the change — implement it, with a red test first.
- The request is to fix a known failing test — use the failing output as the
  input to the fix, not the review.
- There is no diff to review.

## Core Principles

- **The law first, the style last.** Layer violations, a Node API called in
  the renderer, an IPC channel created without a contract and a leaked secret
  outrank naming and layout.
- **Evidence over impression.** A finding names a file, a line and the
  concrete failure it causes. A preference is not a finding.
- **The gates decide.** The review runs `make ci` (or the narrowest gate that
  covers the change) and reports the real output; a diff that fails a gate is
  never approved.
- **Root cause, not symptom.** When several call sites share the mistake, the
  finding points at the shared function.
- **Report the clean areas too.** Silence must not be mistaken for "not
  looked at".

## Rules

- One line per finding, prefixed with the severity: `critical`, `major`,
  `minor`. No prose paragraphs, no code fences around the finding list.
- Every finding names a file and a line, and states the scenario in which it
  fails.
- No fabricated finding: if a rule passes, it is listed as checked; if a file
  was not read, it is not reviewed.
- The checks, in order: layer law, process model and preload bridge, IPC
  contract coverage, secrets and privacy, storage and migrations, error
  handling, tests, style.
- The summary line is exactly `review: N findings — verdict: APPROVE | REVISE`.
- A missing test for a new behaviour is a `major` finding, not a nit.

## Research References

| Claim | Source | Year | Link |
|-------|--------|------|------|
| The layer law and its automated enforcement (`dependency-cruiser`, `no-restricted-imports`) | `PLAYBOOK_DESKTOP_ELECTRON.md` §3 | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| The three-process trust model and the typed preload bridge | `PLAYBOOK_DESKTOP_ELECTRON.md` §3, §5 | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| The secrets policy and the keystore requirement | `PLAYBOOK_SECURITY.md` | - | `PLAYBOOK_SECURITY.md` |
| The gate ladder: typecheck, lint, vitest, build, evals | `PLAYBOOK_TESTS.md` | - | `PLAYBOOK_TESTS.md` |
| `vitest run` executes the test suites and reports their result | Vitest documentation | 2025 | https://vitest.dev |

## Output Format

```
Review of: <diff or files>
Findings:
  [critical] <file>:<line> — <defect> — <failure scenario>
  [major]    <file>:<line> — <defect> — <failure scenario>
  [minor]    <file>:<line> — <defect> — <failure scenario>
Checked and passing: <layer law · process model · preload bridge · secrets · storage · tests>
Gates run: <command> → <result>
review: N findings — verdict: APPROVE | REVISE
```
