# 13 — Playbooks

## The playbooks are restrictions, not suggestions

The kit ships local copies of the governing playbooks next to this docs set.
A change that contradicts one is **wrong until the playbook changes in the
same pull request** ([NEW_UPDATE_PLAYBOOK.md](../../NEW_UPDATE_PLAYBOOK.md)).

## Which playbook answers which question

| File | Covers | Use it for |
| --- | --- | --- |
| [`PLAYBOOK_DESKTOP_ELECTRON.md`](../PLAYBOOK_DESKTOP_ELECTRON.md) | The stack digest: process model, IPC, security, packaging, budgets | Anything Electron-specific — the source this docs set paraphrases |
| [`PLAYBOOK_FRONTEND.md`](../PLAYBOOK_FRONTEND.md) | Layer law: MVVM, SDK interceptor order, route grammar | ViewModel/SDK/router changes |
| [`PLAYBOOK_SECURITY.md`](../PLAYBOOK_SECURITY.md) | Threat model, secrets, TLS, supply chain | Auth, token handling, dependency choices |
| [`PLAYBOOK_TESTS.md`](../PLAYBOOK_TESTS.md) | Test pyramid, environments, gates, evidence | New tests, CI changes |
| [`PLAYBOOK_URLS.md`](../PLAYBOOK_URLS.md) | Route naming, error envelope, realtime topics | Routes, errors, realtime topics |
| [`PLAYBOOK_AUDIT.md`](../PLAYBOOK_AUDIT.md) | Self-hosting an audit program | Release evidence, approvals |
| [`PLAYBOOK_CLAUDE_CODE.md`](../PLAYBOOK_CLAUDE_CODE.md) | The agent kit, TDD loop, multi-session governance | Working with coding agents |
| [`PLAYBOOK_MASTER.md`](../../PLAYBOOK_MASTER.md) | Invariants, routing, counts (parent repo, not copied) | Cross-kit consistency questions |

Playbooks load **on demand**: rules under `.claude/rules/` name the paths
each playbook guards; never `@`-import a playbook — the always-on set must
stay inside the harness budget (`scripts/instruction-budget.sh`).

## The changes you will make most

| Change | Path |
| --- | --- |
| New IPC type | [06](06-ipc-and-preload.md) — `contracts/ipc.ts` first, PEP test next |
| New slice | [04](04-vertical-slicing.md) — contract → domain → port → use case → adapter → ViewModel → view |
| New policy key | [11](11-enterprise-policy-and-observability.md) + `admin-guide.md` row + schema test |
| New storage need | [08](08-storage-outbox-and-offline.md) — port first, adapter behind the factory |
| Dependency / version bump | [01](01-platform-support-and-budgets.md) — cadence, SBOM, lockstep |
| Fuse or packaging change | [09](09-security-fuses-csp-and-secrets.md) + [10](10-packaging-signing-and-updates.md) — verify in packaged output |
| OS-specific behavior | `src/platform/` only ([02](02-processes-and-trust.md)) |
| Renderer network access of any kind | Nowhere — `connect-src 'none'` is the design ([09](09-security-fuses-csp-and-secrets.md)) |

## The review lens

A change is rejected when it contradicts the playbook: a widened bridge, a
schema-less channel, a fuse turned off, a token in a renderer, a blocking
main process, a `--no-sandbox` workaround, a deleted failing test. The
canonical review strings — *Review treats a broken contract as an automatic
Must fix*, *Architecture contracts (always Must fix, ranked first)* — live in
[`PLAYBOOK_CLAUDE_CODE.md`](../PLAYBOOK_CLAUDE_CODE.md) and
[`beautifulelectron`'s `electron-review` skill](https://github.com/Facta-Dev/beautifulelectron).

## How a playbook changes

A playbook change is not a chat agreement ([NEW_UPDATE_PLAYBOOK.md](../../NEW_UPDATE_PLAYBOOK.md)):

1. Propose the delta against the master playbook; the kit copy follows the
   master, never the other way around.
2. Change the master file, then regenerate/copy the kit copies
   (byte-identical, checked by `scripts/claude-kit/check-playbook-copies.sh`
   in the parent repo).
3. Update this docs set where it paraphrases the section changed — a doc
   that quietly disagrees with its playbook is a bug with a paper trail.
4. If the change moves a rule that `.claude/rules/` guards, regenerate the
   rules file (`scripts/claude-kit/generate-playbook-rules.py`).

## What wins on conflict

Playbook > this docs set > chapter cross-references > memory. A reviewer who
finds a contradiction files it against the docs set or opens the playbook
change — they do not silently pick a winner in the app code.

## See also

- [00 — Overview & Principles](00-overview-and-principles.md)
- [12 — Testing & CI](12-testing-and-ci.md)
- [`NEW_UPDATE_PLAYBOOK.md`](../../NEW_UPDATE_PLAYBOOK.md) — the runbook for
  changing any of these
