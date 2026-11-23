---
id: CLAUDE_CODE_PART3
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: engineering-productivity
depends_on: [CLAUDE_CODE]
---

# PLAYBOOK_CLAUDE_CODE_PART3 — Claude Code implementation kit: what every project must have (part 3)

> Part 3 of 3. Main entry: [`PLAYBOOK_CLAUDE_CODE.md`](PLAYBOOK_CLAUDE_CODE.md). Covers: 15. CI/CD and compliance integration … Appendix C — Companion skill packs (optional).

## 15. CI/CD and compliance integration

### 15.1 CI checks (required)

1. **Kit health**: doctor (JSON validity of settings/roles/ownership; hook and
   script syntax and executable bits; registry validation; `REGISTRY.md` up to
   date; CLAUDE.md ≤ 200 lines; `claude plugin validate .claude/agents` and
   `.claude/skills` where available).
2. **Spec presence**: every PR touching a slice's source references a spec ID;
   spec status consistent with the PR (`in-progress` or later).
3. **Traceability**: every AC has a test reference; no orphan tests citing
   missing ACs.
4. **Test-first evidence**: commit history shows `test:` before `feat:` for new
   behavior (heuristic; warn first, then enforce).
5. **Ownership**: PR touches one slice unless labeled `integration`; shared files
   changed only by the integrator.
6. **Control-plane review**: CODEOWNERS enforced on protected paths.
7. **Evals**: changes to agent/skill descriptions run the trigger evals.
8. **Instruction budget**: `scripts/instruction-budget.sh` fails when the
   always-on set (CLAUDE.md or AGENTS.md, resolved `@` imports, path-less
   rules) exceeds 120,000 chars or one file exceeds 40,000; an `@PLAYBOOK_`
   import warns.

### 15.2 Using Claude Code in CI

Headless runs (`claude -p`) for review, release notes, triage: use `--bare` for
fast, deterministic runs that skip auto-discovery; pass explicit
`--settings`/`--allowedTools`; run in containers with scoped credentials;
output structured JSON; cap cost/time; never give CI sessions production
write access.

### 15.3 Audit evidence mapping (project-agnostic)

| SDLC control objective | Kit evidence |
|---|---|
| Requirements documented and approved | `spec.md` + review approvals |
| Secure design and threat consideration | `plan.md` constitution check, security section |
| Test-first and verification | TDD state log, commit order, `spec-verify` reports |
| Segregation of duties | Role policy; reviewer/integrator separation; CODEOWNERS |
| Change management | PR → checks → review; release evidence from CI |
| Access control for tooling | Permissions, managed settings, trust reviews |
| Logging and monitoring of tooling | Coordination logs; ConfigChange/InstructionsLoaded hooks (optional) |
| Continuous improvement | Retro records, CAPA-style lessons → promoted changes, eval results |

Map these to your framework controls (SOC 2, ISO 27001/9001) in your audit
playbook; retain logs and reports per policy; keep transcripts' retention
aligned with data-protection requirements.

---

## 16. Operating cadences

| Cadence | Activity | Owner |
|---|---|---|
| Per session | Launcher profile, claim, spec, TDD loop, handoff | Session owner |
| Daily | Review claims (`claim list`), reap stale, merge queue health | Integrator |
| Weekly | `retro` on lessons inbox; kit PRs; guard-violation review | Kit-curator + tech lead |
| Monthly | `kit-audit`: doctor, `/doctor prompt-audit`, `/skill-doctor`, metrics, memory hygiene | Tech lead |
| Quarterly | Retire unused components; review roles/ownership map; permissions and managed settings review; eval refresh | Tech lead + security |
| On Claude Code upgrade | Re-run doctor and evals; read changelog for hook/settings/frontmatter changes; re-audit instructions for obsolete workarounds | Kit owner |
| Annually | Threat-model review of the kit; compliance mapping review | Security |

---

## 17. Adoption roadmap and maturity levels

| Level | Description | Exit criteria |
|---|---|---|
| **L0 Ad hoc** | Plain `claude`, no shared config | – |
| **L1 Shared context** | `CLAUDE.md`, rules, `settings.json` permissions, `.gitignore`/`.gitattributes` | `/context` shows expected files; deny rules tested |
| **L2 Capabilities** | Core agents and skills, registry, doctor, evals seed | Registry validates; ≥ 80% of trigger evals pass |
| **L3 SDD + TDD enforced** | `specs/`, TDD runner/state, guard + stop-gate in `warn` | Specs precede code on all new work; violations visible |
| **L4 Parallel and governed** | Launcher, claims, roles, messaging etiquette, profiles `standard`, CODEOWNERS | 3+ concurrent sessions without file collisions for a month |
| **L5 Self-improving** | Retro cadence, curator, metrics, `enforce` modes, CI gates | Lessons inbox near zero; kit PRs shipped weekly with evals |

Suggested rollout: **Week 0** (L1) → **Weeks 1–2** (L2) → **Weeks 3–4** (L3 in
`warn`) → **Month 2** (L4, escalate to `enforce` per team) → **Month 3+** (L5).
Pilot with one team/slice; collect violations and friction; adjust the roles and
ownership files before generalizing.

---

## 18. Troubleshooting

| Problem | Likely cause / action |
|---|---|
| Hook doesn't run | `/hooks` to list; trust dialog not accepted; wrong path or non-executable; interpreter missing; `claude --debug` log; `disableAllHooks` set somewhere |
| Hook ran but didn't block | Exit code 1 is non-blocking (use 2 or JSON deny); invalid JSON; `if` filter mismatch; `permissionDecision` omitted |
| Policy hook silently off after a typo | Add `onFailure: "block"`; run doctor in CI |
| Guard blocks legitimate edit | Check role (`agent_type` vs launcher role), `roles.json` allow/deny, slice scope env, claim owner (`claim list`); use `explore` profile for spikes |
| Two sessions edited the same slice | Autoclaim off, TTL too long, or edits through Bash; tighten profile; add CI ownership check |
| Claim stuck after crash | `reap` (TTL) or manual release; check `SessionEnd` ran |
| TDD gate deadlock (can't edit prod, no test run) | Run the TDD runner for the slice; check state file; verify slice detection (branch name/env) |
| Stop gate loops | Confirm loop breaker counter; lower blocks; switch to `warn` |
| Messages not received | `/list-agents`; `crossSessionInbound`; version; deny rules for `SendMessage`; receiver bypassing permissions holds messages |
| Subagent lacks a tool | Background tool filter; `tools` list typo ("zero tools" error); MCP tools denied |
| Skill content lost after `/compact` | Re-invoke; move key instructions to the top of the file |
| Context bloated | `/context`; shrink CLAUDE.md/rules; convert procedures to skills; set rarely used skills to `name-only` in `skillOverrides`; `/skill-doctor` |
| Settings seem ignored | `/status` for active sources; managed settings win; JSON error (`/doctor`); env precedence for that variable |
| Worktree errors | Symlinked `.claude`, LFS filters, resume from inside worktree; see worktree docs; use manual `git worktree add` for exact branch naming |

---

## 19. Kit acceptance checklist

### Instruction plane
- [ ] Root `CLAUDE.md` ≤ 200 lines with commands, layout, SDD/TDD workflow, roles, multi-session rules, never-list, pointers.
- [ ] `.claude/rules/` has scoped rules (architecture, testing, specs, security, API/contracts, frontend if any, migrations, kit-governance).
- [ ] Nested `CLAUDE.md` for each slice/package that has its own invariants.
- [ ] `CLAUDE.local.md` documented as personal and gitignored; `AGENTS.md` interop decided.
- [ ] No contradictory instructions across user, project, local and rules (prompt-audit clean).

### Memory plane
- [ ] Auto memory enabled or deliberately disabled; hygiene cadence set.
- [ ] Agent memory scopes chosen per agent; `merge=union` configured for project-scope indexes.
- [ ] Specs and ADRs treated as durable memory; lessons inbox defined.
- [ ] No secrets in memory/transcripts; retention configured.

### Capability plane
- [ ] Agent roster defined (spec-architect, test-writer, implementer, reviewers, integrator, kit-curator, mapper) with least-privilege `tools`.
- [ ] Combined agent descriptions under the 15,000-token budget; skill listing within budget.
- [ ] Core skills present with correct invocation control; `paths` set where auto-activation by file is desired.
- [ ] Every agent has a role policy entry.
- [ ] MCP/plugins reviewed, pinned and allowlisted (if used).

### Control plane
- [ ] `settings.json` with allow/deny permissions and the four required hooks (`onFailure: block` on the guard).
- [ ] `roles.json` and `ownership.json` adapted to the project layout and tested.
- [ ] Control-plane paths protected in guard and CODEOWNERS.
- [ ] Switches and profiles documented, defaults safe for ad-hoc sessions.
- [ ] Hook interpreter prerequisites documented and checked by doctor.
- [ ] Managed settings considered for organizations.

### Coordination plane
- [ ] Launcher creates worktree + branch + env + session name for each mode.
- [ ] Claim library with atomic claims, heartbeat, TTL, reap, release on end.
- [ ] Shared/hot files assigned to the integrator role.
- [ ] Messaging etiquette and `crossSessionInbound` configuration documented.
- [ ] Contract-change and integration protocol written; limits (parallel sessions, subagents) set.

### Process plane
- [ ] `specs/` with templates, IDs, status machine and gates.
- [ ] TDD runner with detection and override, recorded red/green state, role separation, Stop gate.
- [ ] Traceability AC → test → result produced by `spec-verify`.
- [ ] Exceptions policy (spikes, emergency) with logging.

### Learning plane
- [ ] `learn` and `retro` skills, lessons inbox, promotion ladder documented.
- [ ] Registry validator, generated `REGISTRY.md`, SessionStart drift notice.
- [ ] Eval dataset and procedure for trigger quality.
- [ ] `kit-curator` constrained to non-control-plane edits; proposals folder.
- [ ] Metrics and cadences scheduled.

### Governance and CI
- [ ] Doctor runs locally and in CI; CI checks for spec presence, traceability, ownership, evals.
- [ ] Threats in section 14 mitigated; secrets denied; sandbox/container strategy for unattended runs.
- [ ] Compliance evidence mapping reviewed with the audit playbook.
- [ ] Rollout plan with pilot team and success criteria.

### Installation
- [ ] `install-user-kit.sh` ran; `kit_check.py` exits 0, or 1 with known warnings.
- [ ] `settings.json` is `chmod 600` and holds no plaintext secret.
- [ ] Your repositories were cloned by group (`clone-repos.sh --group=...`).
- [ ] Skill packs were registered and installed (`install-skill-packs.sh`), and the cost tracker's `install.sh` ran.
- [ ] Every active repo passes `configure-repo.sh --check`.

---

## 20. Installation and bootstrap

This section says what an install needs; [PLAYBOOK_INSTALL.md](PLAYBOOK_INSTALL.md)
is the full runbook (flags, groups, verification, rollback). Installation is
shell-only and therefore costs **zero model tokens**; the model is consulted
only for judgment calls.

**`kit/` ships the user-scope layer** — the files installed into `~/.claude`:
`kit/CLAUDE.md` (instructions), `kit/agents/` (`advisor`, `kit-curator`),
`kit/skills/` (the SDD and audit skills), `kit/templates/sdd/` and the settings
fragments (`kit/settings.fragment.json` — default model and the deny list;
`kit/settings.ollama.json` — the Ollama tier env, merged only when Ollama is
the provider; both merged into `settings.json`, never a replacement for it).

**`scripts/claude-kit/` ships the install scripts:**

| Script | Role |
|---|---|
| `install-user-kit.sh` | Installs `kit/` into `~/.claude`; skips user-owned files unless `--force`, backs up every overwrite, merges the settings fragments by provider (explicit `--provider`, no auto-detection) |
| `clone-repos.sh` | Clones the working set by group (`selected` — the default install set — `core`, `products`, `tools`, `clients`, `reference`, or `all`); `--dry-run` prints the plan |
| `install-skill-packs.sh` | Registers each skill-pack marketplace and installs its plugins into user scope; shell only, idempotent, `--dry-run` plans, `--self-test` checks the table against the clones |
| `configure-repo.sh` | Wires one repo: routing block, `.claude/README.md`, deny list, `.gitignore`, optional language kit; `--check` verifies without writing |
| `kit_check.py` | Read-only validator: agents, skills, rules, `CLAUDE.md`, settings, command collisions |
| `dedupe_plugins.py` | Moves user copies of plugin components aside (dry run by default, `--restore` puts them back) |

**A new machine runs four commands:**

```bash
bash scripts/claude-kit/install-user-kit.sh       # user scope
bash scripts/claude-kit/clone-repos.sh --group=selected --dir ~/work
bash scripts/claude-kit/install-skill-packs.sh --dir ~/work
bash scripts/claude-kit/configure-repo.sh ~/work/<repo> --kit=<lang>
```

Every step is idempotent: re-running skips what is already there and never
duplicates the `model-routing:ollama` marker. Note that under
`permissions.defaultMode: "bypassPermissions"` the **deny** list is the
enforced lever — an `allow` list is inert — so user-scope denies must anchor
`//` or `~/`, never `./`.

---

## 21. Shipping a new runnable stack kit

The kit directories are **runnable templates**: a renamed copy is a working
project. `golang/` is the reference for the backend kits and `extension/` the
reference for the client kits. A kit that installs but cannot be renamed,
evaluated or gated is not shippable. The five client kits
(`extension/`, `desktop/`, `frontend-mobile/`, `mobile-android/`,
`mobile-ios/`) are the reference for the checklist below.

### 21.1 Required surface

| Path | Contract |
|---|---|
| `AGENTS.md` + `CLAUDE.md` | `CLAUDE.md` is a symlink to `AGENTS.md`: one agent-agnostic source of truth |
| `MEMORY.md`, `README.md`, `Makefile`, `.gitignore`, `.env.example` | consumer entry points; the `Makefile` exposes `ci` and `verify` |
| `docs/00-*.md` … `docs/14-*.md`, `docs/adr/` | the numbered doc set and the ADRs the consumer inherits |
| `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/schemas/` | the capability plane, one directory per module kind |
| `.claude/settings.json`, `.claude/manifest.json` | the control plane; the manifest declares the modules, the always-on set, the opt-ins, the runtime config dirs and the format adapters |
| `scripts/hooks/guard-bash.sh` | the `PreToolUse` guard, byte-identical across the client kits |
| `scripts/lint-agents.sh`, `lint-skills.sh`, `lint-commands.sh`, `leak-guard.sh`, `instruction-budget.sh` | the static gates every renamed copy must pass |
| `scripts/rename.sh` | placeholder substitution (`<scope>` → `<APP>` → `<app>`); it validates the new slug **before** touching the tree |
| `scripts/verify-template.sh` | stages a renamed copy in a temp dir and runs every gate on it, one `PASS`/`FAIL` per stage, without mutating the working tree |
| `scripts/install-claude-runtime.sh` | the manifest-driven installer; `configure-repo.sh --kit=<kit>` runs it (kit-local, repo-local as fallback) |
| `evals/` | the contract suite, `fixtures/{valid,invalid}/` and `run-live.sh` |

The template ships placeholders (`<app>`, `<APP>`, `<scope>`), never a real
product name. `scripts/**` and `evals/fixtures/**` are excluded from
substitution on purpose: the gates keep their literal patterns and the
fixtures stay frozen.

The five client kits are the reference, not the definition: where a shipped
kit drifts from this table, the table wins and the kit is fixed.

### 21.2 Two eval tiers

- **Offline contract tier** — fixtures only, no network, no API budget. It is
  the `evals` gate and `verify` runs it on the staged renamed copy (gate
  names and their meaning: [PLAYBOOK_TESTS.md](PLAYBOOK_TESTS.md) §12).
- **Live tier** — `evals/run-live.sh`, opt-in with `EVALS=1`; it needs a live
  `claude` CLI and `ANTHROPIC_API_KEY`. Without them it prints why it skipped
  and **exits 0**. The default gate may call it, but only as a no-op: the
  live tier never spends budget unless a human opted in.

A kit that ships `evals/run-live.sh` proves the no-op with a `run-live no-op
guard` stage in `verify-template.sh`, and the live tier's default skill must
exist in the kit (`review` in the client kits).

### 21.3 Fixtures are frozen and domain-adapted

`evals/fixtures/**` never changes with a rename and is never copied from
another kit. Each kit writes its fixtures in its own domain: the extension
kit's valid fixture is an extension reviewer, the desktop kit's an ownership
reviewer, the mobile kits' an Android and a mobile reviewer. Reuse the file
*names* for the same failure modes, write the *content* for the new domain.
The `invalid/` fixtures keep their placeholders deliberately — they are what
the leak and lint gates must catch.

### 21.4 Local playbook copies

- **Every kit ships byte-identical copies** of the root playbooks it
  includes: the five shared contracts (`SECURITY`, `TESTS`, `URLS`, `AUDIT`,
  `CLAUDE_CODE`), the language-agnostic `BACKEND` (backend kits) or
  `FRONTEND` (visual client kits), and the kit's stack playbook.
- When a root playbook changes, re-copy it into every kit that ships it, in
  the same change. A stale copy is a silent second source of truth.
- **Stack-specific rules live in the stack playbook** (`PLAYBOOK_GOLANG.md`,
  `PLAYBOOK_CHROME_EXTENSION.md`, …), never in a hand-edited copy of a shared
  contract. Never fix a root rule by editing a kit copy: fix the root, then
  re-copy.
- **Enforced:** `scripts/claude-kit/check-playbook-copies.sh` compares every
  kit copy against the root and fails on drift, a missing copy, or an
  unmanaged `PLAYBOOK_*.md`. Run it from the repo root (and in CI) after any
  playbook edit.

### 21.5 Adding a kit updates every enumeration

A kit missing from one of these lists is invisible to the installer or to
the user. Update all of them in the same change:

1. `README.md` §3.2 — one row in the per-stack kits table, same columns.
2. `README.md` — the `--kit=` list in the decision tree.
3. `PLAYBOOK_INSTALL.md` §4 — the `--kit=` list.
4. `scripts/claude-kit/configure-repo.sh` — the usage comment and the
   `unknown kit` error message.
5. `scripts/claude-kit/bootstrap.sh` — the next-steps echo.
6. `scripts/claude-kit/README.md` — the `configure-repo.sh` row.
7. `PLAYBOOK_TESTS.md` §12 — the client kits that ship the same gate surface.

Then `configure-repo.sh <repo> --kit=<kit> --dry-run` must resolve the new
kit, and the kit's own `make ci` must be green.

---

## Appendix A — Reference templates

### A.1 `CLAUDE.md` skeleton

```markdown
# <Project name>
<One paragraph: purpose, stack, languages, multi-tenant/data sensitivity.>

## Commands
- Test one slice: `scripts/tdd/run-tests <slice>`
- Full test: `<cmd>`    - Lint/format: `<cmd>`    - Run: `<cmd>`
- Kit health: `scripts/claude/doctor`

## Layout
- `src/<slice>/` vertical slices (domain/application/adapters) · `tests/<slice>/` · `specs/<slice>/`
- Conventions: see `.claude/rules/` and `docs/adr/`; playbooks: <list, without @-imports>

## Workflow (spec → test → code)
1. `/spec-new` → `/spec-clarify` → `/spec-plan` → `/spec-tasks`
2. `/tdd-cycle`: test-writer (RED) → implementer (GREEN) → refactor
3. `/spec-verify` → PR → `/slice-handoff`
Never write production code before a recorded failing test (enforced by hooks).

## Who edits what (enforced)
spec-architect: specs/ · test-writer: tests/ · implementer: src/ · integrator: shared files ·
kit-curator: agents/skills/rules (control plane = human only)

## Multi-session rules
- One worktree per (slice, spec); start sessions with `scripts/claude/launcher`.
- Don't edit a slice claimed by another session; message its owner instead.
- Changed a contract or shared artifact? Message dependents (SendMessage) and tell the integrator.

## Memory and learning
- Corrected twice or a review finding repeats? Run `/learn`. Never store secrets.

## Never
- Commit secrets · force-push · edit hooks/settings/roles yourself · skip failing tests · disable guards to "make it work".
<!-- maintainer notes (stripped from context): keep ≤ 200 lines; move procedures to skills -->
```

### A.2 Agent template

```markdown
---
name: <kebab-case>
description: <When to delegate. One or two sentences. "Use proactively when …">
tools: Read, Grep, Glob            # least privilege; add Write/Edit/Bash only if needed
model: sonnet                      # sonnet|opus|haiku|fable|inherit
effort: medium
memory: project
skills: [<preloaded-skill>]        # must not be disable-model-invocation
---
You are <role>. Mission: <one sentence>.

When invoked:
1. Read the active spec (`specs/<slice>/<id>/spec.md`) and the slice's nested CLAUDE.md.
2. <role-specific procedure, numbered>
3. Report: <exact output format, concise>.

Boundaries: <paths you may edit / must not edit>; if blocked by a guard, report it, don't work around it.
Memory: consult your agent memory first; save durable, non-obvious learnings (new topic file, one line in MEMORY.md).
```

### A.3 Skill template

```markdown
---
name: <skill-name>
description: <What it does and when to use it. Key use case first. ≤ ~300 chars.>
when_to_use: <trigger phrases / example requests>
argument-hint: <args>
disable-model-invocation: true     # for side-effect procedures
paths: ["src/<slice>/**"]          # optional: auto-activate by file
allowed-tools: Bash(scripts/tdd/run-tests *)
---
## Context (optional dynamic injection)
!`git status --short`

## Procedure
1. …
2. …

## Done when
- <observable criteria>

See `reference.md` for details.
```

### A.4 Rule template

```markdown
---
paths:
  - "src/**/adapters/in/http/**"
---
# API adapter rules
- <verifiable instruction>
- <verifiable instruction>
```

### A.5 Hook contract (guard, language-agnostic pseudocode)

```text
input  = JSON from stdin {tool_name, tool_input, cwd, session_id, agent_type?, …}
role   = input.agent_type or $P_ROLE or "free"
path   = relpath(tool_input.file_path, toplevel(cwd))          # Edit|Write|NotebookEdit
if path in kit_control and not $P_KIT_EDIT:           deny("control plane: write a proposal")
if not role_allows(role, path):                       deny("role may not edit path")
slice = slice_of(path)
if path in shared and role not in shared_roles:       deny("shared path: ask integrator")
if slice and scoped_slice and slice != scoped_slice:  deny("session scoped to another slice")
if slice and not try_claim(slice):                    deny("claimed by <branch>/<worktree>")
if classify(path) == "test":  tdd_state[slice] = writing
if classify(path) == "prod" and role in tdd_roles and tdd_state[slice] not in (red, green):
                                                      deny("run a failing test first")
output deny as {"hookSpecificOutput":{"hookEventName":"PreToolUse",
                "permissionDecision":"deny","permissionDecisionReason": "<actionable>"}}
warn mode: {"systemMessage": "..."}; always log violations to the coordination log.
```

### A.6 `settings.json` skeleton

```json
{
  "permissions": {
    "allow": ["Bash(git status *)", "Bash(git diff *)", "Bash(git log *)",
              "Bash(scripts/tdd/run-tests *)", "Bash(scripts/claude/doctor)"],
    "deny":  ["Bash(git push --force *)", "Bash(git reset --hard *)", "Bash(rm -rf *)",
              "Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)", "Read(**/*.pem)", "Read(**/*.key)"]
  },
  "hooks": {
    "SessionStart": [{ "matcher": "startup|resume|clear|compact",
      "hooks": [{ "type": "command", "command": "python3",
                  "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/session_start.py"], "timeout": 20 }] }],
    "PreToolUse":  [{ "matcher": "Edit|Write|NotebookEdit|Bash",
      "hooks": [{ "type": "command", "command": "python3",
                  "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.py"],
                  "timeout": 15, "onFailure": "block" }] }],
    "Stop":        [{ "hooks": [{ "type": "command", "command": "python3",
                  "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/stop_gate.py"], "timeout": 20 }] }],
    "SessionEnd":  [{ "hooks": [{ "type": "command", "command": "python3",
                  "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/session_end.py"], "timeout": 5 }] }]
  },
  "worktree": { "baseRef": "fresh" },
  "cleanupPeriodDays": 30
}
```

### A.7 Lesson entry format

```markdown
---
kind: correction | pitfall | convention | tooling | process
slice: <slice or empty>
target: rule | skill | agent | hook | memory | adr
ts: <ISO-8601>
---
<One or two sentences: what to do or avoid, and why.>
Evidence: <PR / file / test / session note>
```

### A.8 Proposal format (for control-plane changes)

```markdown
# Proposal: <title>
Problem and evidence · Proposed change (diff) · Risk · Rollback · Eval/validation done · Requested reviewer
```

### A.9 Eval dataset entry

```json
{ "prompt": "Write the spec for lead stage transitions", "expect": { "skill": "spec-new" } }
{ "prompt": "What does this function do?", "expect": { "none": true } }
```

---

## Appendix B — Mapping to a vertical-slice, playbook-driven project (example)

If the project follows hexagonal vertical slicing with companion playbooks:

| Kit element | Mapping |
|---|---|
| Slice | `src/slices/<slice>/` ↔ `tests/<slice>/{backend,frontend}` ↔ `specs/<slice>/` ↔ URL `{module}` ↔ permission prefix `module.resource.action` |
| Constitution | Backend, frontend, URL, test, security and audit playbooks referenced from `CLAUDE.md` and path-scoped rules (never `@`-imported) |
| Spec content | Routes follow the URL playbook; permissions listed; tenant isolation and abuse cases in the security section; control IDs from the audit playbook |
| Plan content | Layers per the backend playbook (domain/application/adapters), batch idempotency, expand/contract migrations; frontend View/ViewModel/SDK |
| Test strategy | Matrix from the test playbook (unit, integration, contract, e2e, security, concurrency, migration) per AC |
| Shared files | Shared kernel, SDK, generated API specs, lockfiles, CI/infra → integrator |
| Evidence | Spec/test traceability, release evidence bundle, guard logs → SOC 2 / ISO SDLC controls |

---

## Appendix C — Companion skill packs (optional)

Companion skill packs are **optional**: the kit works without them. They add
stack-specific Agent Skills, lint configs and cost reporting — nothing the
playbooks depend on. Use the ones your stack needs and skip the rest.

Treat every clone as external code: review, pin and allowlist it (§6.6, §14.1),
and accept workspace trust deliberately (§14.3).

### C.1 Clone and install a pack

```bash
gh repo clone <your-org>/<skill-pack> ~/work/<skill-pack>
```

Cloning is not installing. Register the pack's marketplace and install its
plugins into user scope with one shell-only, idempotent command:

```bash
bash scripts/claude-kit/install-skill-packs.sh --dir ~/work
```

The marketplace name comes from the pack's `.claude-plugin/marketplace.json`,
not from the repository name (`my-skills-repo` → `my-skills`); a pack without
that manifest is clone-only — clone it and read it. The packs the installer
manages are listed in its own table (one row per repository:
`repo|marketplace|plugins`); the install path is documented in
[PLAYBOOK_INSTALL.md §4.1](PLAYBOOK_INSTALL.md#41-repositories-that-install-something).

Language kits install as project or user skills (`.claude/skills/`,
`~/.claude/skills/`); `paths`-scoped skills auto-activate on matching files
(§6.4). Their lint config belongs to project tooling, not to a rule file.

### C.2 Fork handling

When a pack is a fork of an upstream project, keep an `upstream` remote
configured. To refresh a fork that has no local commits:

```bash
git fetch --all --prune
git merge --ff-only upstream/main
```

If a fork has local commits, integrate upstream through a PR; never rewrite or
force-push (`git push --force` is denied in §7.2). Agents may run the fetch and
fast-forward commands; they never push from the kit.
