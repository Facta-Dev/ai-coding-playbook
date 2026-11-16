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

- **`.claude/`** — the contracts (`schemas/`), the module/target matrix
  (`manifest.json`), the hook wiring (`settings.json`), agents
  (core / client / security / testing), skills (one per command) and one
  slash command per skill.
- **`scripts/`** — the pure-bash installer and lint gates
  (`install-claude-runtime.sh`, `lint-agents.sh`, `lint-skills.sh`,
  `lint-commands.sh`, `instruction-budget.sh`, `leak-guard.sh`, plus
  `hooks/guard-bash.sh`).
- **A runnable Node CLI template** (TypeScript, Node stdlib + vitest only):
  - `src/core/` — commands as pure functions over consumer-owned ports, plus
    the versioned contracts (`exit-code` table, output envelope).
  - `src/adapters/` — the argv parser and the process-stdio adapter; the only
    layer that touches `process`/`node:`.
  - `src/bin/` — the composition root that wires the layers and maps the
    envelope onto `stdout`/`stderr` plus a versioned exit code.
  - `tests/` — unit tests for the feature and an architecture test that fails
    when a layer imports a forbidden layer.
  - `evals/` — native `node --test` contract harness that validates every
    `.claude` agent/skill/command against the schemas and reports pass counts.
- **Template machinery** — `scripts/rename.sh` (substitute
  `<app>`/`<APP>`/`<scope>`) and `scripts/verify-template.sh` (stage a
  throwaway copy, rename it, run every gate on the copy; the working tree is
  never mutated).

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
bash scripts/verify-template.sh   # full gate on a renamed throwaway copy
```

`npm run lint`, `npm run test`, `npm run evals`, `npm run build` and
`bash scripts/verify-template.sh` are the acceptance gates; all exit 0 on a
clean tree.

## Not included

- **GitHub CI workflows** (`.github/workflows/`) — the gates run locally via
  `make ci` and `scripts/verify-template.sh`; no Actions matrix is shipped.
- **The docs 00-14 walkthrough set** — the layer doctrine lives in
  `PLAYBOOK_CLI.md` at the repo root; this kit ships the enforced rules and
  the tests, not the numbered prose docs.
- A committed `node_modules/` or `dist/` — both are build artifacts and are
  git-ignored.
