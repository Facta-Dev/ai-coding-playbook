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

What is here: the `.claude/{schemas,manifest.json,settings.json}` contracts,
agents (core / client / security / testing), skills (five generic upstream
skills plus four stack-specific ones: add-command, exit-code-contract,
packaging, pty-tests), one command per skill, and the pure-bash installer and
lint gates under `scripts/`.

Install into a repo with
`bash scripts/install-claude-runtime.sh --targets=claude,claude-project --dest=<repo>`.

Status: [partial] the .claude plane and installer exist; the stack template,
evals and CI gates of the sibling kits are not built yet.
