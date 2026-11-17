---
id: CLAUDE_CODE_PART2
version: 1.0.0
status: active
last_reviewed: 2026-11-17
review_cadence_days: 60
owner: engineering-productivity
depends_on: [CLAUDE_CODE]
---

# PLAYBOOK_CLAUDE_CODE_PART2 — Claude Code implementation kit: what every project must have (part 2)

> Part 2 of 3. Main entry: [`PLAYBOOK_CLAUDE_CODE.md`](PLAYBOOK_CLAUDE_CODE.md). Covers: 7. Control plane … 14. Security and governance of the kit.

## 7. Control plane

### 7.1 Settings layers

| File | Scope | Shared |
|---|---|---|
| Managed policy settings | Organization | Yes, cannot be overridden by user/project |
| `--settings`, CLI flags | One session | No |
| `.claude/settings.local.json` | You, this project | No (gitignored) |
| `.claude/settings.json` | Team, this project | Yes |
| `~/.claude/settings.json` | You, all projects | No |

Managed settings win over everything (with narrow documented exceptions); array
settings such as `permissions` merge across layers. Project hooks and some
settings are subject to **workspace trust**: don't rely on them running in a
folder you haven't trusted.

Baseline keys for the project file: `permissions`, `hooks`, `worktree.baseRef`
(`fresh` | `head`), `cleanupPeriodDays`; consider `skillOverrides`,
`claudeMdExcludes` (local), `enabledPlugins`. Decide the place for **each kit
switch** (shell/launcher vs. `settings.env`) and test it: precedence between
process environment and a settings `env` entry varies per variable (see the
environment-variables reference), so verify with a probe hook instead of
assuming.

### 7.2 Permissions

* Use `allow` for safe, frequent, deterministic commands (read-only git, the
  TDD runner, the kit scripts); use `deny` for destructive or secret-reading
  operations (`git push --force`, `git reset --hard`, `rm -rf`, piping `curl`
  to a shell, `Read(./.env*)`, keys and secrets directories).
* Permissions and hooks are the enforcement layer; the `if` filter on hooks and
  Bash pattern matching are **best-effort** (shell can be obfuscated). Hard
  isolation needs the sandbox (`sandbox.*` settings) or containers.
* Subagents inherit the main session's permission rules; `permissionMode` in
  an agent is ignored when the main session is in `bypassPermissions`,
  `acceptEdits` or auto mode.
* Never run unattended sessions in `bypassPermissions` outside an isolated
  container/VM.

### 7.3 Hooks: the required set

Hooks are shell/HTTP/MCP/prompt/agent handlers fired at lifecycle events;
command hooks receive JSON on stdin and communicate with exit codes and JSON
stdout. Documented contract highlights:

* Exit `0` success (JSON fields apply); exit `2` blocking error on events that
  can block (stderr is the reason); any other exit code is a **non-blocking
  error** (the action proceeds). Exit `1` is *not* a block.
* `PreToolUse` decisions via `hookSpecificOutput.permissionDecision`
  (`allow|deny|ask|defer`) and `permissionDecisionReason`.
* `Stop` can block via top-level `{"decision":"block","reason":"…"}` to make
  Claude continue.
* Universal JSON fields: `continue`, `stopReason`, `systemMessage`,
  `terminalSequence`, `additionalContext` (inside `hookSpecificOutput`).
* `onFailure: "block"` (v2.1.295+) makes a hook **fail closed** (script missing,
  crash, timeout, invalid JSON) for `command`/`http` hooks; use it on policy
  hooks. Without it, a mistyped path silently disables the policy.
* Prefer **exec form** (`command` + `args`) with `${CLAUDE_PROJECT_DIR}` for
  paths; hooks run in parallel per event; identical handlers dedupe; default
  timeout 600 s (30 s for `UserPromptSubmit`, 1.5 s budget for `SessionEnd`).
* Hooks need an interpreter available on every developer machine and in CI;
  the kit must declare it (e.g., `python3 ≥ 3.9`, stdlib only). On Windows run
  under WSL/Git Bash or provide PowerShell variants.
* Hook output over 10,000 characters is spilled to a file; keep injected
  context small.
* `${CLAUDE_PROJECT_DIR}` does not follow a worktree entered mid-session; hooks
  receive the live directory in the `cwd` field of their JSON input.

| Hook | Event / matcher | Responsibilities | Required behaviors |
|---|---|---|---|
| **session-start** | `SessionStart` (`startup\|resume\|clear\|compact`) | Register session; auto-claim assigned slice; inject ≤ 1.5 KB of context: role, slice, spec, next open task, switches in effect, other live claims, registry drift (new/removed agents/skills) | Fast (< 2 s); `additionalContext` only; re-injects after `compact` |
| **guard** | `PreToolUse` (`Edit\|Write\|NotebookEdit\|Bash`) | (1) control-plane protection, (2) role path policy via `agent_type`, (3) shared-path and slice ownership/claims, (4) TDD gate, (5) heartbeat | `deny` with an actionable reason; modes `off\|warn\|enforce`; `onFailure: block`; best-effort Bash write detection for protected paths |
| **stop-gate** | `Stop` | Block ending a turn when production code changed without tests, or tests are RED | At most N (e.g., 2) blocks per session to avoid loops; `warn` mode only informs |
| **session-end** | `SessionEnd` | Release claims, unregister session, write log entry | Idempotent; < 1.5 s |

Optional hooks worth considering: `PostToolUse` (format/lint touched files),
`InstructionsLoaded` (audit which instruction files load and why),
`ConfigChange` (alert on settings changes), `WorktreeCreate`/`WorktreeRemove`
(non-git VCS or custom locations), `SubagentStart`/`SubagentStop` (telemetry),
`PreCompact` (block compaction in critical phases), `FileChanged`.

### 7.4 Role policy and ownership map (project-defined, control plane)

These two JSON files make the guard hook data-driven and project-agnostic.

**`roles.json`**

```json
{
  "kit_control": [".claude/hooks/**", ".claude/settings.json", ".claude/roles.json",
                  ".claude/ownership.json", "scripts/claude/**", "scripts/tdd/**"],
  "roles": {
    "free":        { "allow": ["**"], "deny": [] },
    "slice-lead":  { "allow": ["specs/**", "docs/**", ".claude/proposals/**"], "deny": [] },
    "test-writer": { "allow": ["tests/**", "**/*.test.*", "**/*_test.go", "**/test_*.py"], "deny": [] },
    "implementer": { "allow": ["src/**", "specs/**/tasks.md"], "deny": ["tests/**", "**/*.test.*"] },
    "_default":    { "allow": ["src/**"], "deny": ["tests/**", "**/*.test.*"] }
  }
}
```

The **role** of a tool call is: `agent_type` from the hook input (set inside
subagents and for `--agent` sessions) → else a launcher-provided environment
variable for the main thread → else `free`. `kit_control` paths are editable
only by a human decision (an explicit switch).

**`ownership.json`**

```json
{
  "slice_patterns": ["^src/([^/]+)/", "^tests/([^/]+)/", "^specs/([^/]+)/"],
  "non_slice_names": ["_shared", "_platform", "_templates"],
  "shared": ["src/shared/**", "**/package-lock.json", "**/go.sum", "**/Cargo.lock", "openapi/**", ".github/**"],
  "shared_roles": ["integrator"],
  "tdd_roles": ["implementer", "free", "_default"],
  "code_extensions": [".py", ".ts", ".tsx", ".js", ".go", ".rs", ".java", ".kt"],
  "test_patterns": ["(^|/)tests?/", "\\.(test|spec)\\.[a-z0-9]+$", "_test\\.(go|py|rs)$", "(^|/)test_[^/]+\\.py$"],
  "tdd_exempt": ["**/*.md", "**/*.json", "**/*.yaml", "**/*.yml", "**/*.toml", "**/*.lock"]
}
```

Adapt `slice_patterns` to your layout; the capture group is the slice name. The
same patterns drive claims, scope checks, TDD classification and the Stop gate.

### 7.5 What hooks can't do (document it)

* Bash is not a sandbox: obfuscated shell can bypass path checks. Pair hooks
  with permissions (`deny`), the sandbox, container isolation and CI checks.
* A hook that crashes is a non-blocking error unless `onFailure: "block"`.
* Hooks cannot approve on behalf of a message from another session; no agent
  message is user consent.

---

## 8. Coordination plane: many `claude` sessions at once

### 8.1 Parallelism options and when to use each

| Mechanism | Isolation | Use for |
|---|---|---|
| **Worktrees** (`git worktree`, `claude --worktree`) | Files and branch per session | The unit of parallel work (one slice/feature per session) |
| **Subagents** | Context per task, same checkout | Delegating tests/implementation/review inside one session |
| **Subagents with `isolation: worktree`** | Files per subagent | Parallel mechanical edits in one session |
| **Background agents / sessions** | Separate sessions you monitor from one view | Long tasks without blocking |
| **Cross-session messaging** (v2.1.224+) | Text messages between sessions | Hand-offs, breaking-change warnings, status |
| **Agent teams** (experimental) | Coordinated sessions Claude supervises | Large investigations; evaluate before relying |

Default topology: **1 slice-lead session per work unit** (own worktree), each
delegating the TDD loop to subagents; plus on-demand `integrator`, `reviewer`
and `kit-curator` sessions. Start with 2–3 concurrent sessions; grow only with
a working integration flow and cost visibility.

### 8.2 Work unit and naming

* **Work unit = (slice, spec)**. Branch `slice/<slice>/<spec-id>`; worktree
  directory outside `.claude/worktrees` or the default location; session name
  `<slice>:<spec-id>` (`claude --name`).
* A work unit touches **one slice**. Cross-slice needs go through the other
  slice's published contracts and its owner session.
* Shared/hot files (lockfiles, generated API specs, shared kernel, CI config,
  infrastructure) are edited **only** by the integrator role.

### 8.3 Launcher (required script)

The launcher is the single entrance for starting sessions. It must:

1. Validate mode and arguments; derive `slice`, `spec-id`, branch, worktree
   path, session name.
2. Create or reuse the worktree from the right base (`origin/<main>`), copy the
   files listed in `.worktreeinclude`, and optionally run project setup.
3. Export the kit switches from the chosen **profile** (`strict`, `standard`,
   `explore`) and `<PROJECT>_ROLE`, `<PROJECT>_SLICE`, `<PROJECT>_SPEC`.
4. Start `claude` with `--name`, and `--agent <role>` for focused modes
   (spec writing, review, integration, curation) or plain for slice-lead mode;
   pass through extra flags (`--model`, `--permission-mode`).
5. Print the switches in effect and how to release the claim.

Suggested modes: `slice <slice> <spec>`, `spec <slice> <spec>` (agent
`spec-architect`, plan permission mode for exploration), `review <ref>`
(agent `code-reviewer`), `integrate`, `curate` (agent `kit-curator`),
`free` (human pair session, relaxed profile).

### 8.4 Claim protocol (required library)

State directory: **`<git-common-dir>/claude-coord/`** (shared by all worktrees
of the repo, never committed). Layout:

```text
claims/<slice>.lock/owner.json   # atomic mkdir; {worktree, branch, role, session, spec, started, heartbeat}
sessions/<session>.json          # live sessions
tdd/<slice>-<worktree-hash>.json # {state: writing|red|green, ts}
lessons/*.md                     # learning inbox
log/YYYY-MM-DD.jsonl             # violations, claims, tdd transitions, stop-gate events
stop-counts/<session>            # loop breaker for the Stop gate
registry.seen.json               # names seen, for "new agents/skills" notices
```

Rules:

* **Claim = atomic `mkdir`** of the lock directory; a missing `owner.json` for
  < 5 s means "claim in progress", not "stale".
* **Heartbeat** on every guarded tool call; **TTL** (default 30 min, tunable) →
  a claim whose heartbeat is older or whose worktree no longer exists is stale
  and can be taken over (logged).
* Auto-claim on first edit of a slice (switchable); explicit claim at session
  start when the launcher assigns a slice; release at `SessionEnd`; `reap`
  command removes stale claims.
* A session scoped to slice A (`<PROJECT>_SLICE`) cannot edit slice B; the
  denial message points to messaging the owner.
* Write all coordination state atomically (temp file + rename).

### 8.5 Cross-session messaging

* Claude finds peers with `ListAgents` and sends with `SendMessage`; you can
  address a session with `@name`. Messages are plain text, never include
  history or files, and **never count as user approval**.
* Delivery is governed by `crossSessionInbound` (`accept|hold|refuse`). From
  project/local settings only `refuse` is effective; to accept, set it in your
  **user** settings. Default behavior: a session that prompts for permissions
  accepts; a session bypassing permissions holds messages for approval.
* `isolatePeerMachines: true` requires approval before any message leaves the
  machine. Managed settings can disable messaging organization-wide.
* Required etiquette (put in CLAUDE.md): message the owner session when you
  change a slice's published contract or a shared artifact; keep messages
  self-contained; never ask another session for an action your own permissions
  deny.

### 8.6 Contract-change and integration protocol

1. A contract change (API, event schema, shared type) is its own spec in the
   owning slice, with a compatibility statement (additive vs. breaking).
2. On merge, the owning session messages the sessions that depend on it and the
   integrator updates generated artifacts (API specs, SDKs, lockfiles).
3. Integration is **trunk-based**: small PRs, rebase before merge, required
   checks, merge queue if available; the integrator resolves conflicts in
   shared files only.
4. Migrations: unique, time-ordered names to avoid collisions; each slice owns
   its own schema.
5. Never force-push shared branches; denied in permissions.

### 8.7 Operational limits and cost control

* Default concurrent subagent cap 20; spawn depth 3; tune with the documented
  variables. Cap parallel sessions to what your integration flow and review
  capacity can absorb.
* Use `CLAUDE_CODE_SUBAGENT_MODEL` (+ `_FORCE`) only for deliberate global
  overrides; per-agent `model` is the normal control.
* `/usage`, `/insights`, `/skill-doctor` identify heavy sessions and unused
  skills; review monthly.

---

## 9. Process plane I: spec-driven development (SDD)

### 9.1 Lifecycle and artifacts

```text
idea → /spec-new → spec.md (draft) → /spec-clarify → spec.md (clarified)
     → /spec-plan → plan.md → /spec-tasks → tasks.md → TDD loop (section 10)
     → /spec-verify → verification report → status: verified → merge → closed
```

Status field in `spec.md` frontmatter:
`draft → clarified → planned → in-progress → verified → closed` (+ `superseded`).
A transition is allowed only when its gate passes (below). Specs live in git,
reviewed like code; **no implementation code in specs**.

### 9.2 Gates

| Gate | Before | Checks |
|---|---|---|
| Clarity | planning | No `[NEEDS CLARIFICATION]`; every requirement has ≥ 1 acceptance criterion; non-goals stated |
| Constitution | planning | Plan satisfies project principles (architecture, security, URL/API conventions, test strategy, compliance mapping) |
| Testability | tasking | Every AC maps to a test level (unit/integration/contract/e2e/security) and file path |
| Coverage-of-intent | implementation | Task list covers 100% of ACs; tasks are test-first and ordered by dependency |
| Verification | merge | AC → test → passing result traceability; slice tests green; review findings closed |

### 9.3 Templates (skeletons)

**`spec.md`**

```markdown
---
id: <slice>-<NNNN>
title: <short title>
slice: <slice>
status: draft            # draft|clarified|planned|in-progress|verified|closed|superseded
owner: <person or role>
links: { issue: "", adr: [], controls: [] }
---
# <title>
## Context and problem
## Goals / Non-goals
## Users and scenarios
## Requirements
- FR-001 …
- NFR-001 (performance, availability, accessibility, privacy)
## Acceptance criteria
- AC-001 (FR-001): Given … When … Then …
## Security, privacy and compliance
(permissions, tenant isolation, data classification, abuse cases, control IDs)
## Interfaces
(routes/events/contracts — names only; details in plan.md)
## Open questions
- [NEEDS CLARIFICATION] …
```

**`plan.md`**: architecture per layer (domain/application/adapters),
ports and adapters, data model and **expand/contract** migrations, contract
changes and compatibility, test strategy matrix (AC × level), rollout/feature
flags, risks and mitigations, constitution check (checked boxes with
justification for every deviation).

**`tasks.md`**

```markdown
| ID | AC | Test (path) | Implementation target | Depends | [P] | Status | Session |
|----|----|-------------|-----------------------|---------|-----|--------|---------|
| T-001 | AC-001 | tests/<slice>/…/x.test | src/<slice>/…/x | – | | [ ] | |
```

Tasks are small (≈ ≤ 1 hour), each starts with a failing test; `[P]` marks
tasks safe to run in parallel (disjoint files). A task is `[x]` only with a
green run recorded.

### 9.4 Spec ↔ code ↔ evidence traceability

* IDs: `FR-`, `NFR-`, `AC-`, `T-`; test names/comments cite the AC
  (`AC-003`); commits cite the task (`T-007`).
* `spec-verify` produces a table AC → tests → last result and appends it to the
  spec; CI can fail a PR whose spec has an AC without a test reference.
* These artifacts are SDLC evidence for audits (requirements, design, test
  evidence, approvals).

### 9.5 Changing a spec mid-flight

Edit the spec first, mark affected tasks, re-run the gates; never "fix" a test
to match behavior that contradicts the spec without a spec change recorded.

---

## 10. Process plane II: test-driven development (TDD)

### 10.1 Cycle and role separation

```text
test-writer: write failing test(s) for the next task          state: writing
test-writer: run scripts/tdd/run-tests <slice>  → expect RED   state: red
implementer: minimum code to pass                              (allowed only if red|green)
implementer: run runner → GREEN                                state: green
implementer: refactor (tests untouched, stay green)
repeat for the next task; commit as test: / feat: / refactor:
```

* **The implementer cannot edit tests; the test-writer cannot edit source**
  (role policy). This prevents "fixing" tests to go green.
* **State machine** per (worktree, slice): any test edit sets `writing`; the
  runner sets `red` (non-zero) or `green` (zero). The guard allows production
  edits only when a run is recorded (`red`/`green`), and the **Stop gate**
  refuses to end a turn with production changes lacking test changes or with
  RED tests.
* A test that passes immediately (no RED) is suspicious: the test-writer must
  confirm it exercises new behavior.

### 10.2 Runner abstraction (language-agnostic)

One entry point `scripts/tdd/run-tests <slice> [-- args]` that:

1. Resolves the slice (argument, env, or branch name).
2. Uses a **project override** (`scripts/tdd/slice-test`) when present;
   otherwise detects the runner from the nearest marker file walking up from
   the slice directory: `go.mod` → `go test` on the slice's packages;
   `Cargo.toml` → `cargo test <slice>`; `pyproject.toml`/`pytest.ini` →
   `pytest tests/<slice>`; `package.json` → `npm test -- tests/<slice>`
   (vitest/jest path filter); otherwise exit with a clear message.
3. Passes through the runner's exit code and records `red`/`green` in the
   coordination state (`--no-state` for CI).

In polyglot monorepos each service provides its own override.

### 10.3 Exceptions (explicit, logged)

| Case | Rule |
|---|---|
| Spike / exploration | Separate branch, label `spike`, never merged; or `explore` profile |
| Generated code, config, docs, lockfiles | Exempt by pattern (`tdd_exempt`) |
| Pure refactor with existing tests | Allowed in `green`; no test changes |
| Bug fix | First write a failing regression test reproducing it |
| Migrations | Need migration tests (apply from scratch, from previous version) |
| Emergency fix | Human sets mode `warn`, adds the test within the same PR; logged |

### 10.4 Quality complements

Mutation testing on domain/application code (nightly), coverage as a floor not a
goal, contract/integration/e2e levels per the project's test playbook, and the
`code-reviewer` checking that tests assert behavior (not implementation).

---

## 11. Autodetection of agents and skills

### 11.1 What Claude Code already does (documented)

| Mechanism | Detects | Notes |
|---|---|---|
| Directory discovery | `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, plugin dirs, `~/.claude/*` | Project dirs discovered by walking up from the working directory to the repo root |
| **Live reload** | Edits/new files in watched dirs | Agents within seconds; skills in current session; first-ever `agents/` or `skills/` dir needs restart or `/reload-skills` |
| Description-based routing | Which agent/skill fits the task | Descriptions are the matching surface; write "use proactively" and trigger phrases |
| `paths` on skills and rules | Which skills/rules apply to the files being touched | Native file-based autodetection |
| Nested loading | Subdirectory `CLAUDE.md`, `.claude/skills/`, `.claude/rules/` | Load when Claude touches files there |
| Worktree read-through | Main checkout's untracked skills/agents/commands | v2.1.277+ for skills |
| Inspection commands | `/agents`, `/skills`, `/memory`, `/context`, `/status`, `/doctor`, `/hooks`, `/tasks` | Use them to confirm what is actually loaded |

### 11.2 What the kit adds: the registry

A stdlib-only script (`registry`) with four commands:

* `scan`: print agents, skills, rules with key attributes.
* `validate`: exit non-zero on errors (see 11.3).
* `write`: generate `.claude/REGISTRY.md` (human index, includes a content
  hash).
* `hash` / `names`: used by the SessionStart hook.

**SessionStart drift notice**: compares the current names with the last-seen
set on this machine and prints "new/removed agents, skills, rules since your
last session", and warns when `REGISTRY.md` is outdated. This is how a teammate
learns a new agent or skill exists.

### 11.3 Validation rules (the registry must enforce)

Agents: `name` and `description` present; `name` kebab-case ≤ 64 chars and
unique; `tools` or `disallowedTools` set (warn if inheriting all tools);
`model` valid; every `skills:` entry exists and is not
`disable-model-invocation`; recognized frontmatter keys only; has an entry in
`roles.json`; role write permissions consistent with tools; combined
description size under budget (warn at ~12,000 tokens, limit 15,000).
Skills: `SKILL.md` exists; `name` matches directory; `description` present and
`description + when_to_use` ≤ 1,536 chars; body < 500 lines; linked supporting
files exist; side-effect names (deploy/release/publish/migrate) must set
`disable-model-invocation`; frontmatter hooks flagged (trust requirement).
Rules: `paths` parse; non-empty; file size sane. `CLAUDE.md`: ≤ 200 lines.
Settings/policy: valid JSON; hook scripts exist and are executable.

### 11.4 Adding a new agent or skill (workflow)

1. Open an issue or a lesson explaining the repeated job.
2. `kit-curator` (or a human) drafts the file under `.claude/agents|skills`.
3. Add a `roles.json` entry via **proposal** (control plane) for new agents.
4. Add ≥ 3 positive and ≥ 3 negative trigger prompts to `.claude/evals/`.
5. Run `registry validate`, `/doctor prompt-audit`, and the trigger evals.
6. PR with CODEOWNERS review; merge; teammates see the SessionStart notice.

### 11.5 Evals

* Dataset format (kit-defined): `{ "prompt": "...", "expect": {"skill": "x"} | {"agent": "y"} | {"none": true} }`.
* Use the `skill-creator` plugin for with/without-skill comparisons and
  description tuning, and `claude plugin eval` for plugin-packaged components.
* Re-run evals whenever a description changes or a new skill/agent could
  overlap with an existing one; fix overlaps by sharpening descriptions or
  merging.

### 11.6 Diagnosing "it isn't being used"

| Symptom | Check |
|---|---|
| Agent never delegated | `/agents`; description too vague; combined descriptions over budget; name collision in a higher-priority scope; first-ever `agents/` dir requires restart |
| Skill missing in `/` menu | `/skills`; frontmatter parse error (`claude --debug`); `user-invocable: false`; `skillOverrides: off`; name refused (characters); skill in a nested dir not yet loaded |
| Skill triggers too often | Make description specific; `disable-model-invocation: true` |
| Skill stops being followed | Rule must be a hook; compaction trimmed the body: put key instructions first; re-invoke |
| Rule not applied | `/context` memory files; `paths` glob syntax; `InstructionsLoaded` hook to log loads |
| CLAUDE.md ignored | Too long or contradictory; `/memory`; instruction competes with built-in git instructions (`includeGitInstructions`) |

---

## 12. Switches and profiles

### 12.1 Kit switches (project-defined)

Use one prefix per project (`<PROJECT>_`). Each switch has modes
`off | warn | enforce` unless noted; the default when unset must be the
**safest non-blocking** value for ad-hoc sessions, while the launcher profiles
escalate.

| Switch | Values | Default (unset) | Effect |
|---|---|---|---|
| `<P>_ROLE_GUARD` | off/warn/enforce | enforce | Role path policy and control-plane protection |
| `<P>_OWNERSHIP` | off/warn/enforce | warn | Slice scope, shared-path and claim checks |
| `<P>_TDD` | off/warn/enforce | warn | Block production edits without a recorded test run |
| `<P>_STOP_GATE` | off/warn/enforce | warn | Block ending a turn without tests / with RED tests |
| `<P>_AUTOCLAIM` | 0/1 | 1 | Claim a slice on first edit |
| `<P>_CLAIM_TTL` | seconds | 1800 | Stale-claim threshold |
| `<P>_ROLE` | role name | free | Role of the main thread (subagents use `agent_type`) |
| `<P>_SLICE`, `<P>_SPEC` | strings | – | Scope of the session (set by the launcher) |
| `<P>_KIT_EDIT` | 0/1 | 0 | Human override to edit control-plane files |

### 12.2 Profiles (set by the launcher)

| Profile | Ownership | Roles | TDD | Stop gate | Autoclaim | TTL | Use |
|---|---|---|---|---|---|---|---|
| `strict` | enforce | enforce | enforce | enforce | on | 15 min | CI-like discipline, regulated work |
| `standard` | enforce | enforce | enforce | warn | on | 30 min | Default for slice sessions |
| `explore` | warn | warn | warn | off | off | 60 min | Spikes, onboarding, pair sessions |

### 12.3 Native Claude Code switches to know

| Switch | Where | Purpose |
|---|---|---|
| `--agent <name>` / `agent` setting | CLI / settings | Run the session as an agent (replaces default system prompt) |
| `--worktree`/`-w <name>`, `--name` | CLI | Isolated checkout; session name for messaging |
| `--permission-mode`, `--allowedTools`, `--disallowedTools` | CLI | Per-session permissions |
| `--settings`, `--setting-sources` | CLI | Layer or restrict settings sources |
| `--add-dir` | CLI | Extra directories (+ `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`) |
| `--bare` (with `-p`) | CLI | Skip hooks, skills, plugins, MCP, auto memory, CLAUDE.md (scripted runs) |
| `--agents '{…}'` | CLI | Session-only agent definitions (JSON file form v2.1.281+, `-p`) |
| `autoMemoryEnabled` / `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | settings / env | Auto memory |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` | env | Concurrency and nesting |
| `CLAUDE_CODE_SUBAGENT_MODEL` (+ `_FORCE`) | env | Global subagent model |
| `CLAUDE_CODE_FORK_SUBAGENT=0` | env | Disable fork mode (lets Claude wait for subagents) |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` | env | Disable background tasks |
| `crossSessionInbound`, `isolatePeerMachines` | settings | Cross-session messaging controls |
| `disableBundledSkills`, `skillOverrides`, `disableSkillShellExecution` | settings | Skill surface and shell injection |
| `cleanupPeriodDays`, `CLAUDE_CODE_SKIP_PROMPT_HISTORY` | settings / env | Transcript retention / no persistence |
| `CLAUDE_CODE_NEW_INIT=1` | env | Interactive multi-phase `/init` that can set up CLAUDE.md, skills, hooks |
| `allowManagedHooksOnly`, `strictPluginOnlyCustomization`, `allowManagedPermissionRulesOnly` | managed settings | Org-level lockdown of customization |

---

## 13. Learning and improvement plane

### 13.1 The promotion ladder

```text
conversation correction
   → auto memory (Claude's own note; machine-local)           [automatic]
   → lessons inbox (/learn; shared by worktrees; unversioned)  [explicit capture]
   → agent memory (role-specific, versioned if project scope)  [curated]
   → rule (path-scoped instruction)                            [reviewed PR]
   → skill (procedure) or agent prompt change                  [reviewed PR + evals]
   → hook / permission (must-always / must-never)              [human-applied, control plane]
```

Promote **up** only when evidence repeats (≥ 2–3 occurrences or one severe
incident). Each rung has a higher cost and review bar.

### 13.2 Capture

* `learn` skill (model-invocable): when the user corrects Claude, a review
  finding recurs, a test/CI failure reveals a missing convention, or a slice
  quirk is discovered. Entry = `kind` (correction | pitfall | convention |
  tooling | process), concise statement, evidence (file/PR), suggested target
  (rule/skill/agent/hook), slice.
* Never record secrets, personal data or speculation. Entries are deduplicated
  by `retro`.

### 13.3 Triage (`retro`, weekly or per milestone)

1. List inbox entries; cluster duplicates.
2. For each cluster decide: discard, memory, rule, skill/agent edit, hook (via
   proposal), or ADR.
3. Draft the change with the **smallest** context cost; prefer editing an
   existing file to adding one; delete obsolete instructions in the same PR.
4. Run registry validation and relevant evals (section 11.5) before opening the PR.
5. Archive processed entries (the inbox must trend to empty).

### 13.4 Governance of self-improvement

* `kit-curator` may edit agents, skills, rules, evals, agent memory,
  CLAUDE.md and docs; it **cannot** edit hooks, settings, role policy,
  ownership or scripts: it writes `.claude/proposals/*.md` (problem, evidence,
  proposed diff, risk, rollback) for a human to apply.
* CODEOWNERS requires human review for `.claude/{hooks,settings.json,roles.json,ownership.json}`
  and `scripts/{claude,tdd}`.
* Every kit change is a PR with: reason, evidence, eval results, context-cost
  delta (lines/tokens), rollback plan.

### 13.5 Metrics (review monthly)

| Metric | Source |
|---|---|
| Unused skills, context cost of skill listing | `/skill-doctor`, `/doctor` |
| Skill/agent trigger precision/recall | evals |
| Guard violations by kind (role, claim, scope, TDD) | coordination log |
| Stop-gate blocks and escapes | coordination log |
| Review findings repeating across PRs | review notes → lessons |
| Lessons inbox size and age | inbox |
| CLAUDE.md/rules size and contradictions | `/doctor prompt-audit` |
| Session cost and subagent counts | `/usage`, `/insights` |
| Time from spec to merge, rework rate | PR data |

### 13.6 Retirement

Remove skills/rules/agents with no usage for a quarter or superseded by a
better one; note removal in the registry and CLAUDE.md pointers. Anything
dropped from instructions because the model improved is a win: re-audit
instructions after model upgrades (`/doctor prompt-audit`).

---

## 14. Security and governance of the kit

### 14.1 Threats the kit must address

| Threat | Control |
|---|---|
| Prompt injection via files, web, tool output, subagent reports | Least-privilege tools; permissions; subagent output scanning (built-in); no secrets reachable; treat fetched content as data |
| Agent self-escalation (editing its own hooks/permissions) | Control-plane protection in guard; CODEOWNERS; proposals instead of edits; managed settings |
| Secrets leaking into transcripts/memory | `deny Read` on secret files; no secrets in prompts; short retention; `CLAUDE_CODE_SKIP_PROMPT_HISTORY` where required; transcripts are plaintext |
| Malicious repo config (hooks/MCP/agents in a cloned repo) | Workspace trust dialog; review `.claude/` changes in PRs; `allowManagedHooksOnly` / `strictPluginOnlyCustomization` in orgs |
| Cross-session message abuse | Messages cannot approve or change config; `crossSessionInbound` policy; no commands executed from messages |
| Destructive commands | `deny` rules; sandbox/containers; protected branches; no force-push |
| Supply chain (plugins, MCP, skills from outside) | Pin and review; allowlists; run third-party plugins only after code review |
| Over-privileged skills (`allowed-tools`) | Review as privilege grants; exact patterns; managed policy can ignore repo `allowed-tools` |
| Fail-open policy hooks | `onFailure: "block"`; doctor verifies hooks exist and are executable; CI check |
| Hook interpreter missing on a machine | Doctor checks; documented prerequisites |

### 14.2 Rules

1. No secrets in the repo, prompts, CLAUDE.md, skills or memory.
2. Unattended or CI sessions run in isolated environments with scoped
   credentials; never `bypassPermissions` on a developer machine with
   production credentials.
3. Skill `` !`cmd` `` injection and hook scripts are code: review and test.
4. Control-plane changes are never applied by an agent that benefits from them.
5. Auditability: coordination logs (violations, claims, TDD transitions, stop
   gate) are append-only JSON lines; ship them to your log store if the project
   needs evidence.

### 14.3 Workspace trust

Project hooks, project-agent frontmatter hooks and inline MCP servers in project
agents run only after trusting the folder; `-p` sessions don't confer trust for
agent hooks. Tell contributors to review `.claude/` in untrusted clones before
accepting the trust dialog.

### 14.4 Cross-session and subagent boundaries

A message from another session is plain text from "another session", never from
the user; permission prompts still fire for what it requests. A subagent's final
report is scanned for text that imitates harness output but is not a security
boundary; restrict what a subagent can reach.

### 14.5 Organization layer (optional but recommended at scale)

Managed settings deployed by MDM/config management: `permissions.deny`, sandbox
requirements, `allowManagedHooksOnly`, `strictPluginOnlyCustomization`,
`allowedMcpServers`/`deniedMcpServers`, `availableModels`, `cleanupPeriodDays`,
and a managed `CLAUDE.md` for company-wide guidance. Verify with `/status`
(shows active settings sources).

---


---

> Continues in [`PLAYBOOK_CLAUDE_CODE_PART3.md`](PLAYBOOK_CLAUDE_CODE_PART3.md).
