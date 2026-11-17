---
paths:
  - "crates/**"
  - "migrations/**"
  - "specs/**"
---

# Playbooks for `rust` — load on demand

Before editing a file under these paths, read the playbook that governs
it. Do not `@`-import a playbook: this rule is the routing entry and the
always-on instruction set stays inside the harness budget.

- `PLAYBOOK_RUST.md` — the stack contract for this kit.
- `PLAYBOOK_BACKEND.md` — the shared architecture contract.
- `PLAYBOOK_SECURITY.md` — shared contract.
- `PLAYBOOK_TESTS.md` — shared contract.
- `PLAYBOOK_URLS.md` — shared contract.
- `PLAYBOOK_AUDIT.md` — shared contract.
- `PLAYBOOK_CLAUDE_CODE.md` — shared contract.

If a rule here contradicts a playbook, the playbook is the contract:
change it in the same PR, then re-copy it into the kit.
