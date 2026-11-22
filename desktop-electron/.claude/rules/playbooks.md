---
paths:
  - "src/**"
  - "packages/**"
  - "vite.*.config.ts"
  - "forge.config.ts"
---

# Playbooks for `desktop-electron` — load on demand

Before editing a file under these paths, read the playbook that governs
it. Do not `@`-import a playbook: this rule is the routing entry and the
always-on instruction set stays inside the harness budget.

- `PLAYBOOK_DESKTOP_ELECTRON.md` — the stack contract for this kit.
  - `PLAYBOOK_DESKTOP_ELECTRON_PART2.md` — part of `PLAYBOOK_DESKTOP_ELECTRON.md`.
  - `PLAYBOOK_DESKTOP_ELECTRON_PART3.md` — part of `PLAYBOOK_DESKTOP_ELECTRON.md`.
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

## Cross-repo relationship (1:n)

This kit is part of the **1** (`ai-coding-playbook`); its Beautiful
counterpart is [`beautifulelectron`](https://github.com/Facta-Dev/beautifulelectron),
one of the **n** implementations of the same contract.

- **1 → n**: a contract change in this kit's playbooks requires an impact
  check in the Beautiful counterpart and the other implementations before
  release.
- **n → 1**: a gap found in the Beautiful implementation is reported here as
  an issue or a patch; it is not patched silently there.

The normative rule and the registry are in
[`PLAYBOOK_MASTER_PART3.md` §12](https://github.com/Facta-Dev/ai-coding-playbook/blob/main/PLAYBOOK_MASTER_PART3.md).
