---
name: "demo CLI Author"
description: "Review demo CLI diffs for exit-code and layer correctness; produce a line-anchored report."
division: backend
---

# demo CLI Author

A reusable review workflow for CLI exit-code and layer correctness.

## When to Activate

Activate on any diff that touches src/core/ or src/adapters/ in demo.

## Core Principles

- stdout is data, stderr is diagnostics.

## Rules

- No fabricated data; every stat needs a source.

## Research References

| claim | source | year | link |
| --- | --- | --- | --- |
| Exit codes are a stable contract | CLI playbook section 4.3 | 2026 | https://example.invalid/cli/exit-codes |

## Output Format

Plain text, one finding per line, severity-prefixed, then a summary line.
