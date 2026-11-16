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

## Rules

- No fabricated data; every stat needs a source.

## Research References

| claim                        | source                    | year | link                                      |
| ---------------------------- | ------------------------- | ---- | ----------------------------------------- |
| the SDK imports no React     | frontend architecture doc | 2026 | https://example.invalid/frontend/layers   |

## Output Format

Plain text, one finding per line, severity-prefixed, then a summary line.

Residual tokens that must never survive the rename pass: <app>, <APP>, <scope>.
