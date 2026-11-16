# <app> Frontend Stack Kit

This is the `<app>` frontend stack kit for the ai-coding-playbook. It ships the
`.claude` plane: eight agents (core, client, security, testing), nine skills
(five generic, four stack-specific) and nine slash commands, plus the pure-bash
installer and linters that wire it into a target repository.

The stack it targets is the React frontend doctrine: View to ViewModel to SDK,
an SDK that mirrors the URL playbook, and platform-agnostic ViewModels shared
across web, native and extension.

The playbook it enforces is `PLAYBOOK_FRONTEND.md` in the repository root,
backed by `PLAYBOOK_URLS.md` for the route contract.

Install into a repo with
`bash scripts/install-claude-runtime.sh --targets=claude,claude-project --dest=<repo>`,
or via the root `scripts/claude-kit/configure-repo.sh --kit=frontend`.

[partial] the .claude plane and installer exist; the stack template, evals and
CI gates of the sibling kits are not built yet.
