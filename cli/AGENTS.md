# `<app>` - agent instructions

Operating instructions for any coding agent working in this repository
(Claude Code, Codex, Cursor, Aider, Gemini and the others). `<app>` is a
cross-platform terminal CLI/TUI skeleton: one headless core (pure use cases
over consumer-owned ports), a thin adapter layer that owns the process and
the stdio streams, a composition root that wires the layers, and versioned
`stdout`/`stderr` and exit-code contracts that scripts consume.

`CLAUDE.md` is a symlink to this file. Keep one source of truth.

## Hard rules

- **English only** in code, comments, UI copy, docs, test names and tool
  descriptions. No Spanish anywhere in the repo.
- **`make ci` green before you declare a change complete.** Plausibility is
  not correctness: read the output.
- **Never fabricate** paths, exit codes, envelope shapes, env vars, test
  results or commit hashes. Read the file or run the command.
- **Touch only what the request needs.** No drive-by refactors.
- **Never commit a lockfile.** The template ships with one for the npm
  gates, but `scripts/rename.sh` removes it and the renamed copy regenerates
  it on its first `npm install`.

## Never

- **No `process` or `node:` outside `src/adapters/**`.** The core is pure and
  the bin entry only wires; a feature that reaches for a stream, a signal or
  a builtin directly is a layer violation that ESLint fails.
- **No UI chrome on stdout when piped.** stdout carries data only; progress,
  spinners and color go to stderr, and only when stderr is a TTY.
- **No prompt when not a TTY.** A piped (non-TTY) invocation fails with an
  actionable message instead of hanging on input.
- **No secrets.** Nothing sensitive in the bundle, the config, the logs or
  the argv. The token belongs in the OS keystore, never in a committed file.
- **No invented contract.** An exit code, an output shape or a flag name is a
  public API for scripts; changing one without a version bump and a golden
  fixture is a breaking change.

## Layout

```
<app>/
├── src/
│   ├── core/                     # pure: contracts + use cases over ports
│   │   ├── contracts.ts          #   ENVELOPE_VERSION, ExitCode, the envelopes
│   │   └── greet.ts              #   the example use case (GreetPorts, greet)
│   ├── adapters/                 # the only layer that touches process/node:
│   │   ├── cli.ts                #   the argv parser (parseArgv -> Result)
│   │   └── io.ts                 #   the stdio adapter (Io, nodeIo)
│   └── bin/main.ts               # the composition root: argv -> core -> io
├── tests/
│   ├── architecture.test.ts      # the layer walls, asserted as a test
│   ├── cli.test.ts               # the argv parser
│   └── greet.test.ts             # the example use case, over injected ports
├── evals/                        # native contract tests (node --test) + live smoke
├── .claude/                      # agents · skills · commands · schemas · settings · manifest
├── scripts/                      # rename · verify-template · lint-* · leak-guard
│                                 # · instruction-budget · install-claude-runtime
│                                 # · hooks/guard-bash.sh
├── docs/                         # the numbered walkthrough (00..14) + ADRs
├── PLAYBOOK_*.md                 # six local contracts - read on demand
├── AGENTS.md                     # agent instructions; CLAUDE.md is a symlink to it
├── MEMORY.md                     # durable premise: contracts, layers, stack, gates
├── Makefile                      # install · build · lint · test · evals · ci · verify
└── package.json · tsconfig*.json · eslint.config.mjs · vitest.config.ts
```

## The layers and their rules

| Layer            | May import               | Must not import                       |
| ---------------- | ------------------------ | ------------------------------------- |
| `src/core/`      | nothing but the stdlib   | `node:` builtins, adapters, bin       |
| `src/adapters/`  | `node:*`, `core`         | the bin entry                         |
| `src/bin/`       | `core`, `adapters`       | nothing above it (it is the root)     |

Three invariants make the layers hold, and each one has a machine check:

1. **`src/core/` is pure.** `eslint.config.mjs` forbids `node:` imports and
   the `process` global inside `core`, and forbids imports that reach the
   adapters or the bin entry; `tests/architecture.test.ts` asserts the same
   rules so they fail as a test, not only as a lint opinion.
2. **`src/adapters/` owns the process.** argv parsing and the stdio streams
   live there; adapters never reach up into the composition root.
3. **`src/bin/` is the only wiring point.** It maps the returned envelope onto
   `stdout`/`stderr` and the versioned exit-code table; it contains no rules.

## Gates

```sh
make ci                      # npm lint + test + evals + build
npm run lint                 # eslint . (the layer walls)
npm run test                 # vitest run (unit + architecture, hermetic)
npm run evals                # node --test evals/contracts.test.mjs (native, zero deps)
npm run build                # tsc -p tsconfig.json -> dist/
npm run ci                   # lint && test && evals && build
bash scripts/verify-template.sh   # stages a renamed copy and runs every gate on it
```

`npm install` writes the lockfile the template ships; run it on the renamed
copy, never in the template root.

## The TDD loop

Spec → plan → red → green → refactor:

1. `/spec` writes `docs/specs/<slug>.md` (behaviour, acceptance criteria,
   non-goals, the contract surface, open questions); `/plan` writes
   `docs/plans/<slug>.md` (problem, constraints, design, files, risks, tests).
2. `/add-command` or a plain slice scaffold creates the shape (a use case in
   `src/core/`, an argv handler and a stream in `src/adapters/`, the wiring
   in `src/bin/`).
3. Write the failing test first (`/tdd-guide`, `test-author`): a use-case
   test against an injected port, or an architecture test against the layer
   walls. Watch it fail for the right reason - a missing symbol, not a typo.
4. Implement the minimum that makes it pass, then refactor with the suite as
   the safety net.
5. `/review` for the pre-landing checklist; `make ci` before declaring done.

Every new command ships with two tests: a use-case test (the core function
returns the documented envelope) and an adapter/architecture test (the argv
parser returns a `Result`, never throws; the layers still hold). Every change
to a machine-readable surface (an exit code, an output shape, a flag name)
ships with a version bump and a regenerated golden fixture.

## Who edits what

| Area                                                                                        | Owner                                          |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `docs/plans/`, `docs/specs/`                                                                | `planner`, `architect`                         |
| `tests/**`                                                                                  | `test-author`                                  |
| `src/core/**`, `src/adapters/**`, `src/bin/**`                                              | implementers (`build-resolver`, `tdd-guide`)   |
| `package.json`, `tsconfig*.json`, `eslint.config.mjs`, `vitest.config.ts`, `package-lock.json` | shared - integrator role                  |
| `.claude/settings.json`, `.claude/manifest.json`, `.claude/schemas/**`, `scripts/**`        | human only; an agent writes a proposal under `.claude/proposals/` |

## Multi-session rules

- One worktree per (slice, spec); name sessions `<slice>:<spec-id>`.
- Do not edit a slice claimed by another session - message its owner instead.
- Changing a published contract (an exit code, an envelope shape, a flag
  name)? Message the dependents and tell the integrator.
- Never force-push a shared branch.

## Native `.claude` layer

`.claude/agents/` ships the roster across four divisions (`core`, `client`,
`security`, `testing`). `.claude/skills/` + `.claude/commands/` ship
reusable workflows; every command is a thin shim delegating 1:1 to the skill
of the same slug. New slugs are discovered by walking the tree - no registry
edit. `scripts/lint-agents.sh`, `lint-skills.sh` and `lint-commands.sh`
validate the tree against `.claude/schemas/`.

Skills: **`/spec`** (behaviour before plan), **`/plan`** (ordered steps ending
at `make ci`), **`/review`** (the pre-landing checklist), **`/ship`** (release
preparation; user-invoked only), **`/learn`** (append one lesson),
**`/add-command`** (scaffold a command), **`/exit-code-contract`** (change a
stable contract with the version bump and fixtures), **`/tdd`** (the red-green
loop), **`/research`**, **`/diagnosing-bugs`**, **`/domain-modeling`**,
**`/grilling`**, **`/claim-check`**, **`/clean-room-rebuild`**,
**`/verified-status`**, **`/corpus-retrieval`**, **`/visual-review`**,
**`/packaging`**, **`/pty-tests`**.

## Playbooks

Six local contracts ship next to this file: `PLAYBOOK_CLI.md` (architecture,
layers, the stream/exit-code contract, the TUI, platform specifics),
`PLAYBOOK_TESTS.md`, `PLAYBOOK_SECURITY.md`, `PLAYBOOK_URLS.md`,
`PLAYBOOK_AUDIT.md` and `PLAYBOOK_CLAUDE_CODE.md`.

They are **restrictions, not suggestions**: a change that contradicts one is
wrong until the playbook changes in the same pull request. They load **on
demand only**: adopt one by adding a rule under `.claude/rules/` whose
`paths:` frontmatter names the files it guards and whose body names the
playbook - then read that playbook before editing those files. Never
`@`-import a playbook: the always-on set (this file plus the path-less rules)
must stay inside the harness budget, and `scripts/instruction-budget.sh`
fails the build when it does not.

## Learnings

`.claude/learnings.jsonl` is an append-only, project-local log of pitfalls,
patterns and preferences discovered while working on `<app>` (created on the
first `/learn`). Grep it by `kind` before repeating work that resembles a
logged pitfall.

## Conventions

- Parse results and use-case outcomes are values (`CliParse`, `Envelope`),
  never exceptions thrown across a layer boundary; the exit codes live in
  `src/core/contracts.ts`.
- The envelope is validated before it is written: `--json` output is exactly
  `{ v, ok: true, data }` or `{ v, ok: false, error }`, nothing else on stdout.
- `stdout` is data, `stderr` is diagnostics; the split is the contract.
- This project was instantiated from a template: the three substitution
  tokens documented in `scripts/rename.sh` were replaced at instantiation
  time. If one survives verbatim outside the frozen fixtures, it is a bug,
  not a template artifact.
