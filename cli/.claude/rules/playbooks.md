---
paths:
  - "src/**"
  - "tests/**"
---

# Playbooks for `cli` — load on demand

Before editing a file under these paths, read the playbook that governs
it. Do not `@`-import a playbook: this rule is the routing entry and the
always-on instruction set stays inside the harness budget.

- `PLAYBOOK_CLI.md` — the stack contract for this kit.
  - `PLAYBOOK_CLI_PART2.md` — part of `PLAYBOOK_CLI.md`.
- `PLAYBOOK_FRONTEND.md` — the shared architecture contract.
- `PLAYBOOK_SECURITY.md` — shared contract.
  - `PLAYBOOK_SECURITY_PART2.md` — part of `PLAYBOOK_SECURITY.md`.
- `PLAYBOOK_TESTS.md` — shared contract.
- `PLAYBOOK_URLS.md` — shared contract.
- `PLAYBOOK_AUDIT.md` — shared contract.
  - `PLAYBOOK_AUDIT_PART2.md` — part of `PLAYBOOK_AUDIT.md`.
- `PLAYBOOK_CLAUDE_CODE.md` — shared contract.
  - `PLAYBOOK_CLAUDE_CODE_PART2.md` — part of `PLAYBOOK_CLAUDE_CODE.md`.
  - `PLAYBOOK_CLAUDE_CODE_PART3.md` — part of `PLAYBOOK_CLAUDE_CODE.md`.

If a rule here contradicts a playbook, the playbook is the contract:
change it in the same PR, then re-copy it into the kit.
