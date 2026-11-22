---
id: CLAUDE_CODE
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: engineering-productivity
depends_on: [MASTER]
---


# PLAYBOOK_CLAUDE_CODE.md — Claude Code implementation kit: what every project must have

## Parts

This playbook is split so each file stays navigable. Sections keep
their original numbers; a reference to a section not in this file lives in a
sibling part.

| Part | File | Covers |
|---|---|---|
| 1 | [`PLAYBOOK_CLAUDE_CODE.md`](PLAYBOOK_CLAUDE_CODE.md) | 1. Anatomy of the kit: seven planes … 6. Capability plane: agents, skills and friends |
| 2 | [`PLAYBOOK_CLAUDE_CODE_PART2.md`](PLAYBOOK_CLAUDE_CODE_PART2.md) | 7. Control plane … 14. Security and governance of the kit |
| 3 | [`PLAYBOOK_CLAUDE_CODE_PART3.md`](PLAYBOOK_CLAUDE_CODE_PART3.md) | 15. CI/CD and compliance integration … Appendix C — Companion skill packs (optional) |

Specification of the **Claude Code implementation kit** for any software project:
the files, directories, agents, skills, rules, hooks, permissions, switches,
memory, collaboration protocol and improvement loop that make Claude Code
perform well, safely and consistently when **several `claude` CLI sessions work
in parallel** and the team practices **spec-driven development (SDD) +
test-driven development (TDD)**.

This document is the *guide*, not the kit. It tells you what the kit must
contain, why, and how to verify it. It is language- and stack-agnostic.
Companion playbooks (backend, frontend, URLs, tests, security, audit) plug into
it as the project's "constitution"; if your project has none, the kit still
works with your own conventions.

The rules that carry the whole file:

1. **Context is a budget.** Everything always loaded (CLAUDE.md, rules without
   `paths`, skill/agent descriptions, auto-memory index) is paid on every turn.
   Keep it small; load the rest on demand.
2. **Instructions guide, controls enforce.** CLAUDE.md, rules and skills are
   context Claude *tries* to follow. What must never be violated goes in
   permissions, hooks or managed settings.
3. **Least privilege per role.** Each agent gets only the tools, paths and
   skills its job needs.
4. **Spec before code, test before implementation.** Artifacts and test runs are
   the evidence, not chat history.
5. **One work unit, one worktree, one owner.** Parallel sessions never edit the
   same files at once.
6. **Coordination state lives outside the working tree** and is shared by all
   worktrees.
7. **Everything learned is captured, triaged and promoted deliberately** up a
   ladder (memory → rule → skill → hook), never silently.
8. **The control plane is human-owned.** Agents may propose changes to hooks,
   permissions and role policies; they cannot apply them.
9. **Autodetect, then verify.** Rely on native discovery (descriptions, `paths`,
   live reload) and add a registry that validates what was discovered.
10. **Measure the kit.** Agents, skills and rules have evals, budgets and owners
    like any other code.

> Verification note: Claude Code evolves quickly. Version numbers cited here
> come from the official documentation at the time of writing (baseline:
> Claude Code v2.1.309 or later). Before adopting a feature, confirm it with
> `claude --version`, `/doctor`, and the docs
> (<https://code.claude.com/docs>). Where this guide says "documented", it is
> stated in those docs; where it says "design choice", it is this playbook's
> recommendation.

---
## 1. Anatomy of the kit: seven planes

| Plane | Purpose | Main artifacts |
|---|---|---|
| **Instruction** | Tell Claude how this project works | `CLAUDE.md`, nested `CLAUDE.md`, `.claude/rules/*.md`, `CLAUDE.local.md`, optional `AGENTS.md` |
| **Memory** | Persist knowledge across sessions | auto memory, agent memory, specs, ADRs, lessons inbox |
| **Capability** | Reusable roles and procedures | `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`, optional MCP / plugins / output styles |
| **Control** | Enforce limits regardless of what Claude decides | `settings.json` permissions, hooks, role/ownership policy, managed settings |
| **Coordination** | Let many sessions work without collisions | worktrees, launcher, claims, cross-session messaging, ownership map |
| **Process** | Make work verifiable | SDD artifacts (`specs/`), TDD runner and state, CI gates |
| **Learning** | Improve the kit over time | lessons, retros, evals, registry, kit-curator, audit cadence |

A kit is **complete** only when all seven planes exist (section 19 is the
acceptance checklist).

### 1.1 Component inventory (what must exist)

| # | Component | Level | Section |
|---|---|---|---|
| 1 | Root `CLAUDE.md` (≤ 200 lines) | **Required** | 4 |
| 2 | `.claude/settings.json` (permissions, hooks, worktree, retention) | **Required** | 7 |
| 3 | `.claude/rules/*.md` with `paths` frontmatter | **Required** | 4.3 |
| 4 | Nested `CLAUDE.md` per vertical slice / package | Recommended | 4.4 |
| 5 | Core agents: spec-architect, test-writer, implementer, code-reviewer, security-reviewer, integrator, kit-curator, mapper | **Required** (names may vary) | 6 |
| 6 | Core skills: spec-new/plan/tasks, tdd-cycle, spec-verify, handoff, learn, retro, kit-audit, scaffolds | **Required** | 6.4 |
| 7 | Role policy (`roles.json`) + ownership map (`ownership.json`) | **Required** for multi-session | 7.4 |
| 8 | Hooks: SessionStart, PreToolUse guard, Stop gate, SessionEnd | **Required** | 7.3 |
| 9 | Launcher script (worktree + role + env + name) | **Required** for multi-session | 8.3 |
| 10 | Claim/coordination library (state outside the working tree) | **Required** for multi-session | 8.4 |
| 11 | TDD runner + state | **Required** | 10 |
| 12 | `specs/` tree + templates | **Required** | 9 |
| 13 | Registry/validator script + generated `REGISTRY.md` | **Required** | 11 |
| 14 | Doctor script (kit health) + CI job | **Required** | 15 |
| 15 | Switch profiles (`strict`, `standard`, `explore`) | **Required** | 12 |
| 16 | Lessons pipeline (capture → inbox → retro) | **Required** | 13 |
| 17 | Skill/agent evals dataset | Recommended | 11.5 |
| 18 | `.worktreeinclude`, `.gitignore`/`.gitattributes` entries | **Required** | 3 |
| 19 | `CODEOWNERS` entries for control-plane files | **Required** | 14 |
| 20 | MCP servers (`.mcp.json`), plugins | Optional | 6.6 |
| 21 | Managed settings / managed CLAUDE.md (organizations) | Optional (org level) | 14.5 |
| 22 | Output styles, status line | Optional | 6.7 |
| 23 | `kit/CLAUDE.md` — user-scope instructions (installed at `~/.claude/CLAUDE.md`) | Required (user scope) | 20 |
| 24 | `kit/settings.fragment.json` + `kit/settings.ollama.json` — base fragment (default model + deny list) merged everywhere; Ollama-only fragment (tier env + endpoint) merged when Ollama is the provider — into `~/.claude/settings.json` | Required (user scope) | 20 |

---

## 2. Principles of the design

### 2.1 Where each kind of knowledge goes (decision table)

| If the content is… | Put it in… | Why |
|---|---|---|
| A fact Claude needs in **every** session (commands, layout, hard rules) | `CLAUDE.md` | Always loaded; keep it short |
| Needed only when touching certain files | `.claude/rules/<topic>.md` with `paths:` or nested `CLAUDE.md` | Loaded on demand |
| A multi-step **procedure** | a **skill** | Body loads only when used |
| A specialized **worker** with its own tools/context | an **agent** (subagent) | Isolated context, restricted tools |
| Something that **must always** happen / never happen | a **hook** or **permission** | Enforced by the harness |
| A personal preference | `CLAUDE.local.md`, `settings.local.json`, `~/.claude/` | Not shared |
| Knowledge Claude should accumulate | auto memory / agent memory | Written by Claude |
| A decision with rationale | ADR in `docs/adr/` | Durable, reviewable |
| The *what* and *why* of a change | `specs/` | SDD source of truth |

### 2.2 Instructions vs. controls

CLAUDE.md content arrives as context after the system prompt; there is no
guarantee of strict compliance. If an instruction must hold at a specific
point (before every commit, after every edit, never touch a path), implement it
as a **hook** (runs at fixed lifecycle events) or **permission rule**. Use
managed settings to make controls non-overridable.

### 2.3 Cost model

Each subagent has its own context window and its own requests (they count
toward usage limits). Delegate to a subagent when output would flood the main
conversation; do small, tightly coupled edits in the main thread. Route
low-reasoning work (search, mapping) to lower-cost models via the agent's
`model` field.

A fresh machine pays this budget before any work starts: the installation
runbook ([PLAYBOOK_INSTALL.md](PLAYBOOK_INSTALL.md), §0) keeps the
always-loaded surface under target and measures it with `kit_check.py`.
Installation is shell-only, so it costs zero model tokens; the model is
consulted only for judgment.

### 2.4 Language policy

All generated artifacts are in **English**: source code, identifiers, comments,
docstrings, test names, commit messages, specs and ADRs, `CLAUDE.md` and rules,
agent and skill definitions, and documentation. State it once in the root
`CLAUDE.md` so every session and subagent inherits it; non-English text appears
only in user-facing localization resources. Mixed-language code, comments and
prompts cost context, break grep/search, and produce inconsistent review
findings.

---

## 3. Directory structure

```text
<repo>/
├── CLAUDE.md                          # team instructions, ≤ 200 lines            [commit]
├── CLAUDE.local.md                    # personal, per-project                      [gitignore]
├── AGENTS.md                          # optional, shared with other tools          [commit]
├── .mcp.json                          # team-shared MCP servers (optional)         [commit]
├── .worktreeinclude                   # gitignored files copied to new worktrees   [commit]
├── .gitattributes                     # merge=union for agent-memory indexes       [commit]
├── CODEOWNERS (or .github/CODEOWNERS) # kit control plane requires human review    [commit]
│
├── .claude/
│   ├── settings.json                  # permissions, hooks, worktree, retention    [commit]
│   ├── settings.local.json            # personal overrides                         [gitignore]
│   ├── roles.json                     # role → allowed/denied paths (kit-defined)  [commit, control plane]
│   ├── ownership.json                 # slice patterns, shared paths, tdd config   [commit, control plane]
│   ├── REGISTRY.md                    # generated index of agents/skills/rules     [commit, generated]
│   ├── agents/                        # subagent definitions (*.md)                [commit]
│   ├── skills/<name>/SKILL.md         # skills (+ scripts/, reference.md)          [commit]
│   ├── rules/*.md                     # topic/path-scoped rules                    [commit]
│   ├── hooks/                         # hook scripts (+ coordination library)      [commit, control plane]
│   ├── agent-memory/<agent>/          # project-scope agent memory                 [commit]
│   ├── agent-memory-local/<agent>/    # local-scope agent memory                   [gitignore]
│   ├── proposals/                     # agent-written change proposals for humans  [commit]
│   ├── evals/                         # trigger/behavior datasets for skills/agents[commit]
│   └── worktrees/                     # Claude-created worktrees (default path)    [gitignore]
│
├── specs/                             # spec-driven development
│   ├── _templates/{spec,plan,tasks}.md
│   └── <slice>/<NNNN-feature>/{spec.md, plan.md, tasks.md, contracts/}
├── docs/adr/                          # architecture decision records
├── src/ … tests/ …                    # your code; vertical slices recommended
├── src/<slice>/CLAUDE.md              # nested, loaded on demand when working there
└── scripts/
    ├── claude/{launcher, claim, registry, doctor, profiles/*.env}               [control plane]
    └── tdd/{run-tests, slice-test (project override)}                           [control plane]
```

Outside the repository (written by Claude Code, never committed):

| Path | Content |
|---|---|
| `~/.claude/CLAUDE.md`, `~/.claude/rules/`, `~/.claude/agents/`, `~/.claude/skills/`, `~/.claude/settings.json` | Personal, all projects |
| `~/.claude/projects/<project>/memory/` | **Auto memory** (`MEMORY.md` index + topic files), shared by all worktrees of a repo, machine-local |
| `~/.claude/projects/<project>/<session>.jsonl` | Transcripts (plaintext; retention `cleanupPeriodDays`, default 30) |
| `<git-common-dir>/claude-coord/` | **Kit coordination state**: claims, sessions, TDD state, lessons inbox, logs (shared across worktrees, not versioned) |
| `/etc/claude-code/` (Linux/WSL), `/Library/Application Support/ClaudeCode/` (macOS), `C:\Program Files\ClaudeCode\` (Windows) | Managed policy: `CLAUDE.md`, `managed-settings.json`, managed agents/skills |

`.gitignore` additions (minimum): `.claude/settings.local.json`,
`.claude/agent-memory-local/`, `.claude/worktrees/`, `CLAUDE.local.md`,
`__pycache__/`.

`.gitattributes` additions (minimum):
`.claude/agent-memory/**/MEMORY.md merge=union` (indexes are edited from many
worktrees), `.claude/REGISTRY.md linguist-generated=true`.

---

## 4. Instruction plane

### 4.1 Root `CLAUDE.md`

Documented behavior: loaded every session; survives compaction (re-read from
disk); content is delivered as context, not enforced. Target **under 200
lines**; a file over 4 MiB is skipped; startup warns when instruction files are
too long. HTML block comments are stripped before injection, so use them for
maintainer notes at zero token cost.

Required sections (skeleton in Appendix A):

1. **Identity**: one paragraph: what the project is, stack, languages.
2. **Commands**: build, test (single slice + full), lint, format, run.
   Concrete and copy-pastable.
3. **Layout**: where slices/packages live, where specs and tests live.
4. **Workflow**: SDD → TDD loop in five lines, with the entry skills
   (`/spec-new`, `/tdd-cycle`, …).
5. **Roles and permissions**: who may edit what (enforced by hooks).
6. **Multi-session rules**: worktree per work unit, claims, messaging,
   hot files.
7. **Memory and learning rules**: when to invoke `/learn`, never store secrets.
8. **Never list**: ≤ 10 hard prohibitions (also encoded as controls).
9. **Pointers** to deeper docs (playbooks, ADRs) *without* `@`-importing them.
   An import loads the whole file on every turn and saves nothing. Measured
   failure mode (observed on a production service, 2026-11-11): the harness
   keeps the first **40,000 chars** of a file and caps the whole always-on set
   at **120,000 chars**; importing the seven playbooks reached 283k, silently
   truncated the two largest and warned on every session. Load a playbook
   through a path-scoped rule that
   names it; `@`-import only a small digest when a conformance gate must hold
   in every session. `scripts/instruction-budget.sh` enforces this.

Writing rules: concrete and verifiable ("run `make test-slice SLICE=x` before
committing"), no duplicated or contradictory instructions across files, no
content Claude can derive from the code (directory listings, dependency lists).
Audit with `/doctor prompt-audit` (v2.1.283+) and `/doctor`'s CLAUDE.md checks.

### 4.2 `CLAUDE.local.md`, user memory, `AGENTS.md`

* `CLAUDE.local.md` (gitignored) holds private preferences; it only exists in
  the worktree where it was created. To share across worktrees, import a file
  from the home directory (`@~/.claude/my-project.md`; external imports require
  one-time approval).
* `~/.claude/CLAUDE.md` and `~/.claude/rules/` are personal and apply to every
  project. Keep them consistent with project rules: conflicts are resolved
  arbitrarily.
* **`AGENTS.md`**: Claude reads it (v2.1.277+) only when no `CLAUDE.md` exists
  in the directory path. To share one file with other tools, make `CLAUDE.md`
  start with `@AGENTS.md` and add Claude-specific lines below. On Windows prefer
  the import over a symlink.

### 4.3 Rules (`.claude/rules/*.md`)

* One topic per file, descriptive name, subfolders allowed (recursively
  discovered). Rules **without** `paths` load at launch like CLAUDE.md; rules
  **with** `paths` load when Claude reads/writes/edits a matching file.
* Frontmatter has exactly one field: `paths` (YAML list or comma string; glob
  patterns with brace expansion). Other fields are ignored.
* Standard rule set (adapt names to the project):

| Rule file | `paths` | Content |
|---|---|---|
| `architecture.md` | source roots | Layering and dependency direction, naming |
| `testing-tdd.md` | test roots | Test pyramid, naming, fixtures, no mocking the database |
| `specs.md` | `specs/**` | Spec format, IDs, status machine, "no code in specs" |
| `security.md` | source roots, infra | Authz in the use case, input validation, secrets |
| `api-contracts.md` | API/adapter dirs | Route naming, versioning, error envelope |
| `frontend.md` | web UI roots | View/ViewModel/SDK boundaries |
| `desktop.md` | desktop UI roots | Qt/QML structure, threading, packaging and updates |
| `mobile.md` | mobile app roots | Navigation and deep links, offline and secure storage |
| `migrations.md` | migration dirs | Expand/contract, one slice owns its schema |
| `kit-governance.md` | `.claude/**`, `scripts/**` | How to change the kit (proposals, evals) |

* Keep each rule short (tens of lines). A rule that is a procedure belongs in a
  skill. Always-on files (a root `CLAUDE.md`, its `@` imports, path-less rules)
  have a per-file size cap — 40,000 chars for a 200K context window — after
  which Claude only receives the start. Path-scoped rules and the playbooks
  they name are read on demand and take the whole file.
* **One playbook per client family** (`frontend`, `desktop`, `mobile`,
  extension), each behind its own path-scoped rule. `PLAYBOOK_FRONTEND.md` is
  the shared client document; split a family out — as
  `PLAYBOOK_DESKTOP_QT.md` and `PLAYBOOK_CHROME_EXTENSION.md` do — once it
  outgrows the budget or starts diverging. Never `@`-import the set: a family's
  playbook loads only for the files its rule governs. A playbook that passes
  ~40k chars stops working as one instruction file — split it by concern and
  keep the rule that names it short.

### 4.4 Nested `CLAUDE.md` per slice/package

Put slice-specific invariants (ports, events emitted, tables owned, gotchas) in
`src/<slice>/CLAUDE.md`. It loads once Claude reads/edits a file in that
directory, so vertical slicing gives you free, scoped context. Keep under ~50
lines; link to the slice's spec folder.

### 4.5 Large teams and monorepos

* `claudeMdExcludes` skips irrelevant ancestor CLAUDE.md/rules files (set in
  `settings.local.json` for personal exclusions).
* `--add-dir` grants file access to other directories; to also load their
  CLAUDE.md/rules set `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`.
* Organization-wide guidance: managed `CLAUDE.md` (or the `claudeMd` key in
  managed settings). Use it for guidance; use `permissions.deny` etc. for
  enforcement.

---

## 5. Memory plane

### 5.1 Layers

| Layer | Author | Scope | Loaded | Use |
|---|---|---|---|---|
| `CLAUDE.md` / rules | Humans | Team | Every session / on match | Standards, workflow |
| `CLAUDE.local.md` | You | You + project | Every session | Personal sandbox URLs, preferences |
| **Auto memory** | Claude | Repo, shared across worktrees, **machine-local** | `MEMORY.md` first 200 lines or 25 KB each session; topic files on demand | Your corrections, preferences, context not derivable from code |
| **Agent memory** (`memory:` in agent frontmatter) | The subagent | `user` / `project` / `local` | `MEMORY.md` (200 lines / 25 KB) injected into that agent | Role-specific lessons (reviewer patterns, test idioms) |
| Specs and ADRs | Humans + agents | Repo (versioned) | On demand | Why/what of features and decisions |
| Lessons inbox | `/learn` | Machine, all worktrees (kit state dir) | Only by `/retro` | Raw material for promotion |

Auto memory notes are typed `user | feedback | project | reference`; Claude
skips what is derivable from the code or already in CLAUDE.md. It is on by
default locally; toggle with `/memory`, `autoMemoryEnabled`, or
`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`; relocate with `autoMemoryDirectory`.
`MEMORY.md` is an index: one line per entry, details in topic files.

### 5.2 Concurrency rules for memory

* All worktrees of a repo **share one auto-memory directory**. Several sessions
  may write at once: instruct agents to create **new topic files** with unique
  names and touch the index minimally.
* Project-scope agent memory is versioned: configure `merge=union` for its
  `MEMORY.md` indexes, and review memory changes in PRs like code.
* Prefer `memory: project` for curated roles (reviewers, architect) and
  `memory: local` for noisy, personal ones.
* Memory is **not** the system of record: a rule that must hold is promoted
  (section 13), a decision is an ADR, a requirement is a spec.

### 5.3 Hygiene

* Never store secrets, tokens or personal data in any memory layer. Transcripts
  and memory are plaintext on disk.
* Review auto memory monthly (`/memory`): delete stale entries; promote
  stable ones.
* Memory files are not deleted by the retention sweep; clean them deliberately.
* `claude purge <path>` removes a project's local state when needed.

---

## 6. Capability plane: agents, skills and friends

### 6.1 How subagents work (documented facts the design depends on)

* Each subagent has its own context window, system prompt (the markdown body),
  tool allowlist, permission mode and optional hooks/MCP/skills/memory. It does
  **not** see the conversation; the delegation message carries the task.
* A non-fork subagent starts with: its prompt, the delegation message, the
  CLAUDE.md hierarchy (unless `omitClaudeMd: true`), git status, preloaded
  skills. Built-in `Explore` and `Plan` skip CLAUDE.md.
* Scope priority (highest first): managed settings, `--agents` CLI JSON,
  `.claude/agents/` (project), `~/.claude/agents/`, plugin agents. Same `name`
  → higher priority wins.
* Files are watched; new/edited agents apply within seconds. Exception:
  creating the **first** file in a brand-new `agents/` directory needs a
  restart; directories added with `--add-dir` are not watched.
* Subagents run in the background by default when spawned from the main
  conversation (fork mode is on by default from v2.1.302). Background
  subagents get a smaller built-in tool set. Concurrent subagent default cap is
  20 (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); nesting depth default is three
  layers (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`).
* `claude --agent <name>` runs the **whole session** as that agent; its prompt
  **replaces** the default Claude Code system prompt. Use it for focused,
  self-contained roles (spec writing, kit curation, review), not for general
  coding sessions.
* Plugin agents ignore `hooks`, `mcpServers` and `permissionMode`.

### 6.2 Agent frontmatter (all documented fields)

`name` (required), `description` (required), `tools`, `disallowedTools`,
`model` (`sonnet|opus|haiku|fable|inherit|<full id>`), `permissionMode`,
`maxTurns`, `autoCompactWindow` (v2.1.296+), `skills` (preloaded, full content),
`mcpServers`, `hooks`, `memory` (`user|project|local`), `background`, `effort`
(`low|medium|high|xhigh|max`), `isolation` (`worktree`), `color`,
`initialPrompt`, `omitClaudeMd` (v2.1.271+), `experimental`. Unknown fields are
ignored silently, so validate spelling (`--debug` reports near-misses on
v2.1.296+).

Design rules:

1. **One job per agent**; description states *when* to delegate, with
   "use proactively" where appropriate. Descriptions share a budget: a startup
   warning appears when combined agent descriptions exceed 15,000 tokens.
2. **Least privilege**: always set `tools` (or `disallowedTools`). Read-only
   roles get `Read, Grep, Glob` (+ `Bash` only if they must run git/tests).
3. **Preload skills** the agent needs (`skills:`); skills with
   `disable-model-invocation: true` cannot be preloaded.
4. **Memory**: `memory: project` for roles that accumulate reusable knowledge;
   tell the agent in its prompt to consult and update memory.
5. **Model/effort**: reasoning-heavy roles (architecture, security, curation)
   `opus`/high effort; execution roles `sonnet`; mapping/search `haiku`.
   Never hard-code a model the organization may disallow without `inherit`
   as the fallback (`availableModels` can substitute). A worked three-tier
   mapping (escalation / workhorse / cheap) with an `advisor` agent that
   reproduces the native advisor pattern on any Anthropic-compatible backend
   is in [CLAUDE_CODE_ROUTING_MODELS_OLLAMA.md](CLAUDE_CODE_ROUTING_MODELS_OLLAMA.md).
6. **Isolation**: `isolation: worktree` for agents that make broad edits in
   parallel; their worktree is auto-removed when unchanged.
7. **Hooks inside agents** (e.g., read-only SQL validator) only run after the
   folder is trusted; project agent hooks need the workspace trust dialog.
8. **Roles map to policy**: every agent `name` has an entry in `roles.json`
   (section 7.4); unknown agents fall to a restrictive `_default`.

### 6.3 Standard agent roster (any project)

| Agent | Mission | Tools | Model/effort | Memory | Role policy (paths) |
|---|---|---|---|---|---|
| `spec-architect` | Turn intent into spec, plan, tasks; surface ambiguity; check against project constitution | Read, Grep, Glob, Write, Edit | opus / high | project | `specs/**`, `docs/adr/**` |
| `test-writer` | Write failing tests from acceptance criteria; run them to prove RED | Read, Grep, Glob, Write, Edit, Bash | sonnet / medium | project | tests only |
| `implementer` | Minimum code to pass tests; refactor on green | Read, Grep, Glob, Write, Edit, Bash | sonnet / medium | project | source only; **cannot edit tests** |
| `code-reviewer` | Review diff vs spec, rules, conventions; traceability | Read, Grep, Glob, Bash | inherit | project | read-only |
| `security-reviewer` | Review authz, input handling, secrets, dependencies | Read, Grep, Glob, Bash | opus / high | project | read-only |
| `integrator` | Merge/rebase, contracts, migrations order, lockfiles, shared files | Read, Grep, Glob, Write, Edit, Bash | inherit | project | shared paths |
| `kit-curator` | Improve agents/skills/rules from lessons and evals | Read, Grep, Glob, Write, Edit, Bash | opus / high | project | kit content (not control plane) |
| `mapper` | Fast read-only map of a slice/module for context | Read, Grep, Glob | haiku / low | none | read-only |

Add domain agents only when a job repeats ≥ 3 times with the same
instructions (e.g., `migration-writer`, `perf-analyst`). Don't override the
built-in `Explore`/`Plan` names unless you mean to.

### 6.4 Skills

Documented behavior: a skill is `SKILL.md` + optional supporting files. Slash
commands (`.claude/commands/*.md`) are merged into skills (same mechanism).
Descriptions are always in context (listing budget ≈ 1% of context window; each
entry capped at 1,536 characters of `description` + `when_to_use`); the body
loads on invocation and stays in the conversation (re-attached after compaction
within a token budget: first 5,000 tokens per skill, 25,000 total).

Frontmatter fields: `name`, `description` (recommended), `when_to_use`,
`argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`,
`allowed-tools`, `disallowed-tools`, `model`, `effort`, `context` (`fork`),
`agent`, `background`, `hooks`, `paths`, `shell`, `metadata`, `license`,
`compatibility`. Substitutions: `$ARGUMENTS`, `$N`, `$name`,
`${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_SESSION_ID}`.
`` !`command` `` injects command output *before* Claude sees the skill (a failed
command aborts the invocation; can be disabled by `disableSkillShellExecution`).

Design rules:

1. `description` leads with the key use case and trigger phrases.
2. `SKILL.md` < 500 lines; move reference material to supporting files and link
   them with when-to-load hints.
3. Side-effect procedures (deploy, release, scaffold, retro) →
   `disable-model-invocation: true`. Reference knowledge Claude should apply on
   its own → default invocation. Background knowledge users shouldn't call →
   `user-invocable: false`.
4. `paths:` makes a skill **auto-activate** only when working on matching files:
   the native "autodetect by file" mechanism.
5. `allowed-tools` pre-approves tools for the turn that invokes the skill; use
   exact patterns (`Bash(${CLAUDE_SKILL_DIR}/scripts/x.sh *)`), and review it as
   a privilege grant.
6. Put rules that must hold every time in a **hook**, not in the skill body.
7. Only the Agent Skills spec fields (`name`, `description`, `license`,
   `compatibility`, `metadata`, `allowed-tools`) survive upload to claude.ai /
   the Skills API; Claude Code-only fields make packaging fail.

### 6.5 Standard skill roster (any project)

| Skill | Invocation | Purpose |
|---|---|---|
| `spec-new` | model + user | Create the next spec folder from the template; ask ≤ 3 blocking questions; map to routes/permissions/controls |
| `spec-clarify` | model + user | Resolve every `[NEEDS CLARIFICATION]` before planning |
| `spec-plan` | model + user | Produce `plan.md`: architecture per layers, data, contracts, test strategy, constitution check |
| `spec-tasks` | model + user | Produce `tasks.md`: ordered, test-first, parallel-marked, AC-referenced tasks |
| `tdd-cycle` | model + user | Red → Green → Refactor protocol with role separation and evidence |
| `spec-verify` | model + user | Traceability AC → test → result; gates; verification report; status transition |
| `slice-handoff` | user only | Handoff note, contract-change notifications, claim release |
| `learn` | model + user | Capture a lesson (correction, repeated review finding) into the inbox |
| `retro` | user only | Triage lessons, propose promotions, open PR/proposal |
| `kit-audit` | user only | Run doctor, registry validation, `/doctor prompt-audit`, `/skill-doctor`, budgets report |
| `new-slice` / `new-module` | user only | Scaffold directories, nested CLAUDE.md, ownership entry, test folders |
| `new-endpoint` / `new-<artifact>` | model, `paths`-scoped | Procedure for the project's most frequent artifact (route, command, component) |

Bundled skills worth knowing: `/doctor`, `/code-review`, `/batch`, `/debug`,
`/loop`, `/verify`, `/run`, `/run-skill-generator`, `/claude-api`.
`/run-skill-generator` records how to launch your app so `/run` and `/verify`
are reliable; commit the result.

### 6.6 MCP servers and plugins

* Team MCP servers in `.mcp.json`. To keep a server's tool descriptions out of
  the main context, define it inline in the subagent that needs it
  (`mcpServers:` in the agent frontmatter).
* Treat every MCP server, plugin, marketplace and skill source as code: pin,
  review, and allowlist (`allowedMcpServers` / managed settings). Prefer
  plugins for distributing the kit across repositories; plugin skills are
  namespaced (`/plugin:skill`).
* `claude plugin validate <dir>` (v2.1.233+) checks frontmatter of
  agents/skills; `claude plugin eval` (plugins) measures delegation/trigger
  quality with and without the plugin.

### 6.7 Optional extras

Output styles (`.claude/output-styles/`), status line, custom keybindings,
dynamic workflows (`.claude/workflows/*.js` saved from `/workflows`) for
scripted orchestration of many subagents. Add them when a need appears, not by
default.

---

---

> Continues in [`PLAYBOOK_CLAUDE_CODE_PART2.md`](PLAYBOOK_CLAUDE_CODE_PART2.md).
