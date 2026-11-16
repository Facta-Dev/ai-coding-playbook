# MEMORY.md - `<app>` premise

Durable, versioned premise for every session. Keep it under ~100 lines: facts
an agent cannot derive quickly from the code, not a copy of the code.

## Product

`<app>` is a cross-platform terminal CLI/TUI in the style of Claude Code: one
headless core (pure use cases over consumer-owned ports) with the TUI, print
mode, resource subcommands and an RPC server as clients of that same core.
The shipped template demonstrates the discipline in reduced form: a single
example use case (`greet`), a thin adapter layer, and a composition root that
maps a versioned envelope onto `stdout`/`stderr` plus a versioned exit code.

## Layers

| Layer          | Owns                                                        | Must not import                     |
| -------------- | ----------------------------------------------------------- | ----------------------------------- |
| `src/core/`    | Pure use cases and the versioned contracts                  | `node:`, `process`, adapters, bin   |
| `src/adapters/` | The argv parser and the stdio streams                       | the bin entry                       |
| `src/bin/`     | The composition root that wires the layers                  | (it is the root)                    |

`src/core/contracts.ts` holds `ENVELOPE_VERSION` (1), the `ExitCode` table
(`Ok: 0`, `GeneralError: 1`, `Usage: 2`, `Validation: 7`) and the `Envelope`
(`OkEnvelope` / `ErrorEnvelope`). `src/core/greet.ts` is the example use case
(`greet(input, ports)` over an injected `now()` clock). `src/adapters/cli.ts`
parses argv into an `Invocation` and returns a `CliParse` `Result`, never
throws; `src/adapters/io.ts` owns the `process` streams. `src/bin/main.ts`
wires argv → adapter → core → io and maps the envelope to the exit-code table.

The layer walls are enforced twice: `eslint.config.mjs` (`no-restricted-imports`
and `no-restricted-globals`) and `tests/architecture.test.ts`.

## Contracts

- **stdout is data, stderr is diagnostics.** Progress, spinners and color go
  to stderr only, and never to stdout when stdout is not a TTY.
- **No prompt when not a TTY.** A piped invocation fails with an actionable
  message instead of prompting; `NO_COLOR`, `CI` and `TERM=dumb` degrade to
  plain text.
- **The envelope is versioned.** `--json` output is one of
  `{ v, ok: true, data }` or `{ v, ok: false, error: { code, message } }`,
  with nothing else on stdout. `ENVELOPE_VERSION` is **1**.
- **Exit codes are versioned.** `0` success, `1` general error, `2` usage,
  `7` validation. Scripts branch on these numbers; changing their meaning is
  a breaking change and is versioned.

The fuller contract (the fuller exit-code table, `stream-json`, the TUI, the
platform specifics) lives in `PLAYBOOK_CLI.md` sections 3, 4, 5 and 6.

## Test tiers

| Tier         | Where                          | Scope                                              |
| ------------ | ------------------------------ | -------------------------------------------------- |
| unit         | `tests/<feature>.test.ts`      | the use case over injected ports (a fake clock)    |
| adapter      | `tests/cli.test.ts`            | the argv parser (parse → Result, never throw)      |
| architecture | `tests/architecture.test.ts`   | the layer walls: core pure, adapters no bin, bin wires |
| contract     | `evals/contracts.test.mjs`     | the `.claude` layer: agents, skills, commands, fixtures |

No test touches the network, a real terminal or a real clock that is not
injected.

## Stack

Node **>= 24** · TypeScript **5.9** (strict, `noUncheckedIndexedAccess`,
`verbatimModuleSyntax`, ESM `nodenext`) · Vitest **5.1** · ESLint **9** flat
config with typescript-eslint · Prettier **3** · npm (the package manager).
Runtime dependencies: none beyond the Node stdlib. No zod, no
dependency-cruiser, no React or Ink.

## Gates

`make ci` (lint + test + evals + build) · `npm run evals`
(`node --test evals/contracts.test.mjs`) · `scripts/verify-template.sh`
(template factory only: it stages a renamed copy and runs every gate on it).

## Where the contracts live

`PLAYBOOK_CLI.md` (architecture, layers, the stream/exit-code contract, the
TUI, platform specifics) · `PLAYBOOK_TESTS.md` · `PLAYBOOK_SECURITY.md` ·
`PLAYBOOK_URLS.md` · `PLAYBOOK_AUDIT.md` · `PLAYBOOK_CLAUDE_CODE.md` ·
`AGENTS.md` (agent workflow).
