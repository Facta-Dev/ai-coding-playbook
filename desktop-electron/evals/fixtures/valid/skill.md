---
name: "demo Desktop Author"
description: "Review demo desktop diffs for fuse posture and trust zones; produce a line-anchored report."
division: core
---

# demo Desktop Author

A reusable review workflow for Electron trust-zone and ipc correctness.

## When to Activate

Activate on any diff that touches src/main/, src/preload/ or src/renderer/ in demo.

## Core Principles

- The fuse table is the safety baseline, never a tuning knob.
- The bridge exposes named functions only, no channel strings.

## Rules

- No fabricated data; every stat needs a source.
- No code-fenced final output where raw output is expected.

## Research References

| claim                            | source             | year | link                                        |
| -------------------------------- | ------------------ | ---- | ------------------------------------------- |
| run-as-node fuse stays off        | Electron docs      | 2026 | https://example.invalid/electron/fuses      |

## Output Format

Plain text, one finding per line, severity-prefixed, then a summary line.
