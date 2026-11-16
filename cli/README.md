# cli - Claude Code kit for the terminal CLI/TUI stack

A `.claude` plane plus installer for building a cross-platform terminal
CLI/TUI in the style of Claude Code: one headless core (use cases, ports,
event stream) with the TUI, print mode, resource subcommands and an RPC
server as clients of that same core.

It enforces the contract in the root playbook file
[`PLAYBOOK_CLI.md`](../PLAYBOOK_CLI.md): scriptable by design (`stdout` is
data, `stderr` is diagnostics), stable exit codes and versioned output
schemas, terminal-lifecycle safety, platform-only `process.platform` code,
and signed, monotonic, reversible releases.

## What is here

- **The instruction plane** - `AGENTS.md` (agent-agnostic operating
  instructions), `CLAUDE.md` (a symlink to `AGENTS.md`), `MEMORY.md` (the
  durable premise: layers, contracts, stack, gates) and `.env.example` (the
  runtime env the product consumes once the config resolver is wired).
- **`docs/`** - the numbered walkthrough set `00..14` plus `docs/adr/` (two
  ADRs), adapted from the reference client kit to this stack. Topics that do
  not apply to a terminal CLI (service-worker lifetime, manifest and
  permissions, storage and migrations, policy, telemetry) say so in their own
  chapter and give the CLI analog instead of deleting the topic.
- **`.claude/`** - the contracts (`schemas/`), the module/target matrix
  (`manifest.json`), the hook wiring (`settings.json`), nine agents
  (core / client / security / testing), nineteen skills (one per command) and
  one slash command per skill, including the five SDD skills `spec`, `plan`,
  `review`, `ship`, `learn`.
- **`scripts/`** - the pure-bash installer and lint gates
  (`install-claude-runtime.sh`, `lint-agents.sh`, `lint-skills.sh`,
  `lint-commands.sh`, `instruction-budget.sh`, `leak-guard.sh`, plus
  `hooks/guard-bash.sh`).
- **A runnable Node CLI template** (TypeScript, Node stdlib + vitest only):
  - `src/core/` - commands as pure functions over consumer-owned ports, plus
    the versioned contracts (`exit-code` table, output envelope).
  - `src/adapters/` - the argv parser and the process-stdio adapter; the only
    layer that touches `process`/`node:`.
  - `src/bin/` - the composition root that wires the layers and maps the
    envelope onto `stdout`/`stderr` plus a versioned exit code.
  - `tests/` - unit tests for the feature and an architecture test that fails
    when a layer imports a forbidden layer.
  - `evals/` - native `node --test` contract harness that validates every
    `.claude` agent/skill/command against the schemas and reports pass counts.
- **Template machinery** - `scripts/rename.sh` (substitute
  `<app>`/`<APP>`/`<scope>`) and `scripts/verify-template.sh` (stage a
  throwaway copy, rename it, run every gate on the copy; the working tree is
  never mutated).
- **Local playbook copies** - `PLAYBOOK_CLI.md`, `PLAYBOOK_TESTS.md`,
  `PLAYBOOK_SECURITY.md`, `PLAYBOOK_URLS.md`, `PLAYBOOK_AUDIT.md` and
  `PLAYBOOK_CLAUDE_CODE.md`, byte-identical to the de-branded root playbooks.

Install the `.claude` plane into a repo with
`bash scripts/install-claude-runtime.sh --targets=claude,claude-project --dest=<repo>`.

## Gates

From this directory:

```bash
npm install       # bootstrap; generates package-lock.json
npm run lint      # ESLint with the layer walls
npm run test      # unit + architecture tests (vitest, hermetic)
npm run evals     # .claude contract evals (node --test)
npm run build     # tsc -> dist/
make ci           # lint + test + evals + build
make verify       # bash scripts/verify-template.sh (stages a renamed copy)
```

`npm run lint`, `npm run test`, `npm run evals`, `npm run build`,
`make ci` and `bash scripts/verify-template.sh` are the acceptance gates; all
exit 0 on a clean tree.

## Not included

- **GitHub CI workflows** (`.github/workflows/`) - the gates run locally via
  `make ci` and `scripts/verify-template.sh`; no Actions matrix is shipped.
- A committed `node_modules/` or `dist/` - both are build artifacts and are
  git-ignored.
- The richer surfaces the playbook specifies but the template does not wire -
  the interactive TUI, `stream-json`, the RPC server, the platform folder,
  config persistence, the keystore and the output sanitizer. The template
  ships the reduced form (core / adapters / bin) that demonstrates the same
  boundaries; `PLAYBOOK_CLI.md` is the target a real product grows into.
