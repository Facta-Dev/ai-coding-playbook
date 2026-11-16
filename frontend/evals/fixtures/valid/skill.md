---
name: "demo Frontend Author"
description: "Review demo frontend diffs for layer boundaries; produce a line-anchored report."
division: core
---

# demo Frontend Author

A reusable review workflow for frontend layer and SDK contract correctness.

## When to Activate

Activate on any diff that touches src/ in demo.

## Core Principles

- Views talk to ViewModels; only the SDK talks to the backend.
- The SDK mirrors the URL playbook.

## Rules

- No fabricated data; every stat needs a source.
- No code-fenced final output where raw output is expected.

## Research References

| claim                        | source                    | year | link                                      |
| ---------------------------- | ------------------------- | ---- | ----------------------------------------- |
| the SDK imports no React     | frontend architecture doc | 2026 | https://example.invalid/frontend/layers   |

## Output Format

Plain text, one finding per line, severity-prefixed, then a summary line.
