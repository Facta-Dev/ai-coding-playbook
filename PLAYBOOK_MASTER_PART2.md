---
id: MASTER_PART2
version: 1.0.0
status: active
last_reviewed: 2026-11-16
review_cadence_days: 30
owner: architecture + engineering-productivity
depends_on: [MASTER]
---

# PLAYBOOK_MASTER_PART2 — Master playbook: the constitution of the playbook set and the Claude Code operating model (part 2)

> Part 2 of 3. Main entry: [`PLAYBOOK_MASTER.md`](PLAYBOOK_MASTER.md). Covers: 4. The Claude Code operating model … 5. Applying the kit to the playbook set.

## 4. The Claude Code operating model

### 4.1 Layers and ownership

| Layer | What it is | Owner here |
|---|---|---|
| Model | The Claude model(s) selected per role | Anthropic; chosen per agent (`model`, `effort`) |
| **Runtime harness** | Claude Code itself: tool loop, permissions, hooks, subagents, memory loading | Anthropic |
| **Repository harness** | Our kit: `CLAUDE.md`, rules, skills, agents, hooks, specs, TDD runner, claims (`PLAYBOOK_CLAUDE_CODE`) | Engineering productivity |
| **Loop** | One bounded agent run with a goal, verifier and stop rule | Task owner |
| **Graph / orchestrator** | Several loops wired with explicit state, routing, joins and recovery | Task owner + integrator |
| **Governance** | Acceptance authority, permissions, budgets, release decisions | Named humans |

Keep the layers distinct in design reviews: "who owns context, tools, permissions, verification, recovery, coordination?" must have one answer per layer.

### 4.2 Choose the smallest control structure

| Need | Smallest structure | Must still be specified |
|---|---|---|
| One bounded task with local feedback | **Agent loop** (interactive session, `/goal`, Stop hook) | Goal, verifier, stop rule, tool policy |
| Several independent concerns, or author ≠ reviewer, or routing must be auditable | **Workflow graph** (subagents as nodes, hooks as deterministic edges, shared state files) | State schema, edges, joins, retry/budget, completion authority |
| Many tasks, queues, many runs, scheduled triggers | **Orchestrator** (dynamic workflow script, agent teams, routines, CI) | Admission, ownership/leases, budgets, escalation |

Escalate structure only when one of these is true: (a) the same agent would review its own work, (b) independent checks are being run sequentially, (c) you cannot explain what happened without reading the whole transcript. Every added component adds state, cost and failure modes.

Heuristics (practitioner guidance): a node you cannot describe in about five words is doing too much; each node owns one section of shared state; routing decisions are code or schema checks wherever they can be.

### 4.3 Deterministic and non-deterministic controls

| | Non-deterministic (Claude decides) | Deterministic (Claude Code/CI enforces) |
|---|---|---|
| What to do | Prompt, `CLAUDE.md`, rules, skills Claude picks up | Hooks, permission rules, which skills only a human can start |
| When it's done | Request for evidence, `/goal`, `/code-review` | Tests, typecheck, linters, **Stop hook**, CI |
| Who may do it | Instructions | Permissions, sandbox, managed settings |

Rules: anything that must hold **every time** is deterministic. A prompt-type or agent-type hook asks another model and therefore is **not** deterministic. A completion evaluator such as `/goal` reads evidence already present in the conversation; it does not independently inspect the patch or rerun commands, so pair it with real checks.

### 4.4 Context engineering (the budget)

* **Always-loaded context is paid on every turn**: `CLAUDE.md` (≤ ~200 lines), rules without `paths`, skill/agent descriptions, the auto-memory index. Keep it small.
* **On-demand context** loads when needed: path-scoped rules, nested `CLAUDE.md`, skill bodies, subagent prompts. Put procedures in skills and conventions in path-scoped rules.
* **Playbooks are reference material, not instructions**: never `@`-import them. `CLAUDE.md` holds the routing table (section 5.3); path-scoped rules carry the 5–15 invariants relevant to that path and **point to playbook IDs and section titles**; skills open exact sections.
* **Use subagents to protect the main context**: exploration, large reads, reviews and test runs happen in a subagent that returns a short result.
* **Reset deliberately**: after repeated failed corrections in a session, clear and restate the task with the lesson included rather than piling on corrections; use compaction with explicit focus; keep handoff state in files (specs, task lists), not in chat.
* **Instruction hygiene**: no duplicated or contradictory instructions across user, project, local, rules; audit with `/doctor` prompt checks; delete instructions that newer models no longer need.

### 4.5 Task intake: specs, not prompts

1. **Intent → spec** (`/spec-new`): context, goals/non-goals, requirements, **acceptance criteria**, security/privacy/compliance, interfaces, open questions. No implementation detail in the spec.
2. **Explore before implement**: a read-only mapper subagent summarizes the affected slice; plan mode (or `spec-architect`) produces `plan.md` with a **constitution check** (section 5.4) citing playbook sections.
3. **Give Claude a way to verify its work**: tests, typecheck, run scripts, screenshots/previews, a reproducible failing case. A request without a verifier produces plausible, unchecked work.
4. **Ask for evidence, not confidence**: "show the failing test, the command and exit code, the diff" rather than "are you sure?".
5. **Right model and effort per role**: higher effort for architecture/security/curation, mid-tier for execution (tests, implementation), small/fast models for mapping and search; configure per agent so the choice is versioned, not ad hoc.
6. **Canonical task prompts** (Appendix D) keep requests uniform across the team.

### 4.6 Loops (the unit of agent work)

A **loop contract** makes "keep going until it works" testable.

| Field | Question it must answer |
|---|---|
| Goal and input | Which requirement, repository revision and artifact define this run? |
| State | Which facts persist **outside** the context window, and who may update them? |
| Actions | Which tools, credentials, files and external effects are allowed? |
| Observation | Which outputs, tests, traces and human feedback enter the next iteration? |
| Verification | Which deterministic checks, independent reviews or human decisions can accept the work? |
| Stop and escalation | What ends success, failure, budget, timeout, or requires a person? |
| Evidence | Which commands, outputs, trace IDs and versions prove the final claim? |

Claude Code mechanisms for loops (verify names/versions against the docs):

| Mechanism | Use | Guardrail |
|---|---|---|
| Interactive session | Human-in-the-loop work | Plan mode, permissions, hooks |
| **`/goal <condition>`** | Drive one task to a verifiable finish line | Condition must be checkable ("tests X pass, exit 0"), never "the code is good"; evaluator sees only conversation evidence; budgets written in the condition are *requested*, not *enforced* |
| **Stop hook** | Refuse to end a turn without evidence (tests changed/pass) | Loop-breaker counter (max N blocks) |
| **`/loop`** | Local recurring monitoring/work on an interval | Local, time-limited; watch background cost |
| **`/schedule` / routines** | Cloud-scheduled tasks that run when your laptop is off; GitHub-event or API triggers | Admission control + ownership; scoped credentials; read-only first |
| Headless `claude -p` (+ `--bare` in CI) | Scripted runs, reviews, triage | Explicit allowed tools, budgets (`--max-turns`, `--max-budget-usd`), isolated environment |

Typical loop shapes: *goal-to-green* (one task to a verifiable finish), *backlog burn-down* (labelled issue queue), *parallel migration* (mechanical change across many files → dynamic workflow), *watcher* (PRs, CI, dependency updates).

Loop rules:

* **Enforced budgets live outside the model**: a controller (script/hook/CI) counts turns/cost/time across sessions; session counters reset on resume.
* **Never ship a loop straight to unattended-at-scale**: run it supervised on a small sample, then on a canary slice, then widen.
* **A loop never decides its own acceptance** for anything with impact: the verifier or acceptance authority is separate (4.8).
* **Background work costs money while you aren't typing** (`/loop`, goal checks, subagents): monitor with `/usage`-style tooling and set caps.

### 4.7 Graphs (when one loop is not enough)

> **A loop is a node in a graph.** The graph is the structure that connects loops, routes work, and manages what they pass to each other.

**Three problems a graph solves**

| Problem | Symptom | Graph answer |
|---|---|---|
| **Context pollution / self-review** | The agent reviews work it just wrote and knows why every decision was made | Separate nodes with clean contexts and structured handoffs |
| **Sequential work that is independent** | Security, logic and coverage checks run one after another | Fan-out then fan-in |
| **Invisible control flow** | You cannot explain what happened without reading the transcript | Explicit nodes, edges and state you can draw |

**Mapping graph concepts to Claude Code**

| Graph concept | Claude Code mechanism | Notes |
|---|---|---|
| Node | A **subagent** (own context, prompt, tools, model) or a **headless run** | One job per node; least privilege tools |
| Edge | The orchestrator's routing; **hooks** for edges that must fire every time; scripts/CI for deterministic transitions | Deterministic wherever possible |
| Shared state | Typed files (`specs/**`, JSON findings, task tables), the coordination dir (claims, TDD state), PR metadata | Each node owns one section; schema-validated |
| Fan-out / fan-in | Several subagents in parallel; merge step in the orchestrator or a script | Merge deterministically (union, max severity) |
| Loop-back | Retry router with a decrementing budget | Counter owned by exactly one writer |
| Orchestrator | Main session, **dynamic workflow** (a script holds the plan), **agent teams** (lead + teammates, experimental, disabled by default), **agent view/background sessions**, SDK | See below |
| Terminal states | `done`, `failed`, `escalated` | Only named authorities can mark each |

**Anthropic's five composable patterns** (prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer) are graph shapes: chain = line, routing = conditional edge, parallelization = fan-out/fan-in, orchestrator-workers = hub with workers, evaluator-optimizer = loop-back with a judge. Anthropic's multi-agent research system (a lead agent spawning parallel subagents) reported a large quality gain over a single-agent baseline **at roughly 15× the tokens of a chat turn**, and early versions over-spawned subagents for simple queries: cap fan-out and match effort to complexity.

**Choosing the orchestrator**

| Option | Use when | Constraints |
|---|---|---|
| Subagents in one session | Delegate-and-collect inside one conversation | Results return to the spawning conversation; subagents can't be assumed independent reviewers |
| **Dynamic workflows** (`/workflows`, `.claude/workflows/`) | Many subagents, verification of findings against each other, a script holding the plan | Keep the **control plane static** (allowed node types, permissions, budgets, concurrency); let the script create only bounded *data* tasks |
| **Agent teams** (experimental) | Lead assigns pieces to coordinated sessions with a shared task list | Disabled by default; **teammates are not worktree-isolated**, so partition work by file ownership |
| **Worktree sessions + launcher + claims** (our default, `PLAYBOOK_CLAUDE_CODE_PART2` §8) | Parallel slices owned by different sessions | One slice per session; integrator owns shared files |
| Headless runs in CI/routines | Triage, review, scheduled work | Scoped credentials, read-only first |
| Agent SDK | The graph must run unattended, be tested like code, embed in a product | Lift a graph you already hand-rolled and understood |

**Static vs dynamic graphs**: a static graph fixes topology in reviewed configuration (preferred for anything with consequences); a dynamic graph creates tasks or routes at runtime and needs creation policy, budgets, provenance, validation, audit log and revocation. *Dynamic never means an LLM writes workflow code and executes it unreviewed.*

**Graph contract** (must be reviewable without running the graph)

| Element | Minimum contract |
|---|---|
| Identity | Graph and policy versions, owner, compatible state schema |
| State | Typed fields, confidentiality, **writer**, reducer/conflict rule, retention |
| Node | Purpose, input/output, idempotency boundary, timeout, side effects, tools |
| Edge | Source, destination, condition, routing evidence, forbidden transitions |
| Join | Expected inputs, timeout, missing-input behavior, merge rule |
| Retry | Retryable failures, cap, backoff, compensation or escalation |
| Checkpoint | Persistence boundary, resume semantics, migration compatibility |
| Completion | Legal terminal states and who may mark each |

**When not to use a graph**: if one agent with a clear verifier already does the job, wiring three of them costs more and buys nothing. Nail the single loop first; each node must already be a reliable loop.

### 4.8 Reviewer independence and verification design

Separating author and reviewer is a **treatment to test, not proof of independence**: a reviewer with a fresh context can still share the same flawed spec, model, provider, tools and incentives.

| Axis | Options (increasing independence) |
|---|---|
| Information | Same context → fresh context → gets only requirement + candidate + checks (not the author's reasoning) |
| Model/provider | Same model → different tier → different provider |
| Evidence | Opinion → **reproduced** (failing test, command output) |
| Decision authority | Agent verdict → deterministic gate → named human adjudication |

Rules:

1. **Deterministic checks first** (tests, types, linters, schema/contract validators, permission/entitlement diffs). Agents review what machines can't decide.
2. **A finding is not a fact until reproduced** (a failing test, a trace, a proof). Reviewers should *verify claims against the code*, not accept a report "cold".
3. **Measure independence**: compare self-review, fresh-context review, different-model review, deterministic checks and human adjudication against the same sampled defects; record false accepts, false rejects, rescues, misses, disagreements and the evidence each verdict used.
4. **Sample human adjudication** of agent verdicts (for example 10% plus every high-severity item) and feed overturns into the improvement loop.
5. **A passing graph test proves routing followed the contract, not that the requirement is met.** Pair workflow tests with requirement-level verification, recovery drills and repeated representative tasks.

*Worked example (three-agent audit).* A context-gatherer writes a structured map, a bug-hunter produces typed findings, and an independent reviewer evaluates the findings without the codebase; it is a good teaching graph and catches report-quality issues, but its independence is limited (shared model, reviewer never inspects code). Our version adds: reviewer receives the **requirement and the diff** and may read code to verify findings; every finding must carry a reproduction (test or command); reviewer runs on a different model tier; results are merged deterministically; sampled human adjudication closes the loop.

### 4.9 Judgment allocation: three loops

| Loop | Responsibility | Human role |
|---|---|---|
| **Execution loop** | Plan, act, observe, verify, retry within a budget | Handle exceptions that exceed policy |
| **Governance loop** | Goals, permissions, budgets, acceptance policy, release authority | Accountable for risk and irreversible effects |
| **Improvement loop** | Inspect traces and failures, propose changes to prompts, graphs, rules, skills | Approve versioned changes against held-out evidence |

Removing a person from repetitive execution does not remove accountability. **Humans decide**: scope and priority; acceptance of ambiguous or high-impact changes; control-plane changes; permission/entitlement/privacy changes; key custody and signing; releases and rollbacks; risk acceptance and waivers; anything irreversible outside the repository.

### 4.10 Durable execution and recovery

* **State outside the model**: specs, `tasks.md`, JSONL event logs, claims/TDD state in the git-common coordination dir, findings JSON. Another process must be able to reconstruct the run.
* **Idempotency at every effect boundary** (idempotency keys, receipts, upserts, read-before-write). Resuming an interrupted node may re-run code before the interruption.
* **Reconcile before retry**: a remote operation can succeed while its response is lost; keep a stable logical effect ID and consumed budget across restarts; if no reliable receipt exists, keep the outcome *uncertain* and route to a decision.
* **Process recovery ≠ product recovery**: resuming a task shows continuity of execution, not that the result was sufficient or reversible; after a false acceptance you need detection, containment, an owner and a rehearsed restoration path.
* **Do not claim crash recovery unless exercised**: interrupt a run at a defined point, resume in a clean process, inspect the state transition, external effect, evidence record and duplicate-work behavior.
* **Make tool failures actionable**: report what failed, whether an effect may have occurred, and which bounded recovery is permitted.
* **Combined changes**: record base, reviewed heads and candidate integration revision; two individually green PRs can interact, so re-evaluate evidence when base or group changes.

### 4.11 Admission control and WIP

Faster generation moves pressure to verification. Bound the shared queue, not only each run.

* **Reserve verification capacity before dispatching authoring work** (reviewers, CI minutes, device-pool slots).
* **Pause new authoring** when the owner-approved queue length/age limit is reached, a required reviewer is unavailable, or queue telemetry is stale; **let in-flight reviews and corrections finish**.
* **Resume below a distinct threshold** (hysteresis) with fresh telemetry, otherwise the scheduler oscillates.
* **Stop on abnormality for real** (jidoka): an alert without a pause is not a stop; a recurring defect becomes an upstream control (test, hook, rule) and is checked for recurrence.
* Thresholds are **calibrated from your queue data**, not copied; per-feature WIP limits come from SDD (`tasks.md`).

### 4.12 Observability and evaluation of agent work

| Layer | Minimum evidence |
|---|---|
| Runtime | Model and harness version, tool calls, permissions, stop reason |
| Graph | Graph/policy version, node, edge, route reason, state before/after, join waits, checkpoint/resume |
| Repository harness | Setup command, changed artifacts, verifier command/output/exit status |
| Orchestrator | Dispatch, ownership/lease, queue wait, handoff, escalation, human checkpoint |
| Judgment | Evaluator identity and provenance, evidence refs, verdict, overturn, exception authority |

* Use stable event names; **redact** prompts, tool args/results, paths and identifiers before exporting telemetry. OpenTelemetry's GenAI conventions are in **Development** status: keep an adapter and version local fields (`graph.version`, `verdict.overturned`).
* **Evaluate the exact model-harness pair**, repository revision, permission set, graph version, tool set, budget and task distribution; re-run after model or harness upgrades.
* **Held-out task set** per slice for kit/graph changes (A/B before/after: acceptance rate, rework, tokens per accepted change, escaped defects).
* Core metrics: cost per accepted change, tokens per successful outcome, first-pass acceptance, rework rate, escaped defects, review queue age, hook violations by kind, stop-gate blocks and escapes, reviewer overturn rate, lessons promoted, time spec→merge.

### 4.13 Cost and capacity

* Budget per task (turns, time, money) enforced by a controller; per-agent `model`/`effort`; mapping/search on small models.
* Cap parallelism: concurrent sessions (start with 2–3), concurrent subagents, spawn depth; prefer one well-specified subagent over many speculative ones.
* Avoid paying twice for context: scoped rules, skills on demand, subagent summaries, no repeated whole-file reads in the main thread.
* Track **cost per accepted change**, not just spend; review monthly with the metrics in 4.12.

### 4.14 Security of AI-assisted development

| Threat | Control |
|---|---|
| Prompt injection via files, web, tool output, issue text, subagent reports | Least-privilege tools; read-only by default; tool results are *data*; no privilege or config change from tool output; human approval for sensitive actions |
| Agent self-escalation | Control plane protected (guard hook + CODEOWNERS); proposals instead of edits |
| **A role label is not a sandbox** | Role/path policy in hooks is a policy layer; use OS/container sandboxing, scoped credentials and network egress limits for real isolation |
| Agents with production credentials and no owner | **Agent identity registry**: every automated agent/routine has an owner, scoped credentials, an expiry and an audit trail; no shared production credentials |
| Malicious repo/plugin/MCP | Workspace trust prompts; pin and review plugins/MCP; allowlists/managed settings; never auto-trust project-defined servers/hooks |
| Secrets in transcripts/memory | Deny reading secret files; no secrets in prompts; short retention; transcripts and memory are plaintext |
| Cross-session messages | Messages are text, never approval; `crossSessionInbound` policy; never act beyond your own permissions because a message asked |
| Unattended bypass | `bypassPermissions` only in isolated containers with scoped credentials; never on developer machines with production access |
| Fail-open policy hooks | `onFailure: "block"` for policy hooks; doctor checks in CI |

---

## 5. Applying the kit to the playbook set

### 5.1 Layout of the playbooks project

```text
playbooks/
├── PLAYBOOK_MASTER.md                 # this file
├── PLAYBOOK_URLS.md  PLAYBOOK_BACKEND.md  PLAYBOOK_SECURITY.md  PLAYBOOK_TESTS.md  PLAYBOOK_AUDIT.md  PLAYBOOK_CLAUDE_CODE.md
├── PLAYBOOK_FRONTEND.md  PLAYBOOK_FRONTEND_MOBILE.md  PLAYBOOK_MOBILE_ANDROID_KOTLIN.md  PLAYBOOK_MOBILE_IOS_SWIFT.md
├── PLAYBOOK_DESKTOP_QT.md  PLAYBOOK_CHROME_EXTENSION.md  PLAYBOOK_CLI.md  PLAYBOOK_JAVA_J2EE.md
├── manifest.json                      # machine-readable registry (5.2)
├── CHANGELOG.md                       # per-playbook version history
├── verify-register.md                 # every (verify) item: owner, source, due date, status
├── adr/                               # deviations with expiry; decisions affecting the set
├── templates/{playbook.md, adr.md, spec/, graph-contract.yaml, loop-contract.md}
└── tools/{playbook-lint, section-index, verify-sweep}
```

> In this repository the playbooks live at the repository root. `manifest.json`, `verify-register.md`, `CHANGELOG.md` and `docs/adr/` sit beside them; the deterministic tools live under `scripts/` (`playbook-lint.py`) and the user-scope kit under `kit/`. The tree below is the target layout, not a second copy.

Product repositories **vendor the set at a pinned version** (submodule, subtree or package) under `docs/playbooks/` and record the version in `CLAUDE.md`; upgrades are PRs with a changelog review. The kit (`PLAYBOOK_CLAUDE_CODE` §3) lives in each product repo.

### 5.2 Manifest and routing

`manifest.json` makes the set machine-readable so hooks, skills and CI can pick the right playbook sections automatically.

```json
{
  "set": "ai-coding-playbook", "manifestVersion": 1, "updated": "2026-11-16",
  "alwaysLoad": ["MASTER#3"],
  "playbooks": [
    { "id": "BACKEND", "file": "PLAYBOOK_BACKEND.md", "version": "1.0.0", "layer": "foundation", "volatility": "slow", "owner": "architecture",
      "appliesTo": { "paths": ["src/slices/**", "backend-java/**", "services/**"], "keywords": ["slice", "use case", "repository", "outbox", "migration", "job"] },
      "anchors": ["Vertical slicing", "Data layer", "Services layer", "Batch processes layer", "Presentation layer", "Connecting slices", "Checklist"] },
    { "id": "SECURITY", "file": "PLAYBOOK_SECURITY.md", "layer": "foundation", "volatility": "medium",
      "appliesTo": { "paths": ["**/auth/**", "**/security/**", "**/adapters/in/**", "**/*.tf", "**/Dockerfile*"], "keywords": ["auth", "token", "secret", "input", "ssrf", "dependency"] },
      "alwaysForCodeChanges": true, "anchors": ["Authentication", "Authorization", "Input handling and injection (A05)", "Supply chain (A03, A08)", "Language profiles", "Checklist"] },
    { "id": "MOBILE_ANDROID_KOTLIN", "file": "PLAYBOOK_MOBILE_ANDROID_KOTLIN.md", "layer": "client", "volatility": "fast",
      "inherits": ["FRONTEND_MOBILE"], "appliesTo": { "paths": ["android/**"] } }
  ],
  "sectionIndex": "generated by tools/section-index (title → anchor → line)"
}
```

**Routing algorithm** (used by the SessionStart hook, `playbook-lookup` skill and `/spec-plan`):

1. Collect signals: changed/targeted paths, branch (`slice/<slice>/<spec>`), spec frontmatter (`platforms`, `controls`), keywords in the task.
2. Select playbooks whose `appliesTo.paths` match (score by specificity); add `inherits` parents; add `alwaysForCodeChanges` (SECURITY, TESTS) for any code change.
3. Cap at **≤ 4 playbooks** and **≤ 8 section anchors** per task; always include `MASTER#3` (invariants) and the target playbook's `Checklist`.
4. Emit **anchors, not files** (titles + line ranges) so Claude reads only those sections; log the routing decision for audit.
5. An optional `UserPromptSubmit` hook may add a ≤ 300-character hint ("applicable playbooks: …") using regex/BM25 matching on keywords. It is a **hint, never a control**, and costs context on every prompt: enable only if measured useful.

### 5.3 Path → playbook routing table (seed for `.claude/rules/` and the manifest)

| Path / signal | Playbooks to load (anchors in parentheses) |
|---|---|
| `src/slices/**/domain/**`, `application/**` | BACKEND (Services layer), SECURITY (Authorization), TESTS (Backend tests); JAVA_J2EE if Java |
| `**/adapters/in/http/**`, `openapi/**`, `**/routes/**` | URLS (all), BACKEND (Presentation layer), SECURITY (Authorization, Input handling), TESTS (Security tests) |
| `**/migrations/**`, `**/persistence/**` | BACKEND (Data layer), TESTS (Backend tests: migration), SECURITY (Cryptography and data protection) |
| `**/adapters/in/jobs/**`, `**/queue/**`, outbox | BACKEND (Batch processes layer), SECURITY (Batch, queue and event security), TESTS (concurrency) |
| `**/realtime/**`, SSE/WebSocket | DESKTOP_QT §Realtime, BACKEND (Connecting slices), SECURITY |
| `apps/web/**`, `packages/viewmodels/**`, `packages/sdk/**` | FRONTEND (SDK, MVVM, Adapting to the URL playbook), URLS |
| `apps/mobile-*/**`, `packages/feature-*/**` (RN) | FRONTEND_MOBILE (all relevant), FRONTEND (MVVM) |
| `android/**` | MOBILE_ANDROID_KOTLIN (+ FRONTEND_MOBILE for contracts/flows) |
| `ios/**` | MOBILE_IOS_SWIFT (+ FRONTEND_MOBILE) |
| `apps/desktop/**` (Qt) | DESKTOP_QT |
| `apps/extension/**` | CHROME_EXTENSION, FRONTEND (extension section) |
| `apps/cli/**` | CLI |
| `backend-java/**` | JAVA_J2EE, BACKEND, SECURITY (Language profiles) |
| `.claude/**`, `scripts/claude/**`, `specs/**` | CLAUDE_CODE, MASTER_PART2 §4–§5, MASTER_PART3 §6 |
| `**/Dockerfile*`, `infra/**`, `.github/**` | SECURITY (Infrastructure, Supply chain), AUDIT (Operational control processes) |
| `docs/playbooks/**` | MASTER_PART3 §9 (maintenance) |

### 5.4 Constitution check (in every `plan.md`)

The check is a short table filled by `spec-architect` and verified by `playbook-reviewer`:

| Check | Source | Result |
|---|---|---|
| Slice naming parity (I-1) and boundary rules (I-2) | BACKEND/client | ☐ |
| Routes, `{userType}`, permissions (I-3, I-4) | URLS | ☐ |
| Error envelope/taxonomy (I-5), tenancy (I-6) | URLS/BACKEND | ☐ |
| Idempotency/long ops/events (I-7, I-8, I-10) | BACKEND | ☐ |
| Sensitive data and privacy (I-17), secrets (I-15) | SECURITY/AUDIT | ☐ |
| Device tiers/budgets (I-12), push (I-13), policy/kill switch (I-14) | client playbooks | ☐ |
| Test levels per AC, authz/tenant suites, evidence (I-19) | TESTS | ☐ |
| Controls affected (SOC 2/ISO IDs), vendors, privacy impact | AUDIT | ☐ |
| Deviations → ADR with expiry (I-21) | MASTER §2 | ☐ |

### 5.5 Agent roster (extends `PLAYBOOK_CLAUDE_CODE` §6.3)

| Agent | Mission | Tools | Notes |
|---|---|---|---|
| `spec-architect` | Spec, plan (with constitution check), tasks | Read, Grep, Glob, Write/Edit (specs only) | High effort |
| `test-writer` | Failing tests from ACs, per platform conventions | + Bash | Edits tests only |
| `implementer` | Minimum code to pass; refactor on green | + Bash | Cannot edit tests |
| `code-reviewer` | Diff vs spec, rules, conventions, traceability | Read, Grep, Glob, Bash (read-only) | Gets requirement + diff, not author reasoning |
| `security-reviewer` | SECURITY checklist, authz/tenant/secrets/supply chain | Read-only | Different tier/model from the implementer when feasible |
| **`playbook-reviewer`** | Checks the diff against the routed playbook checklists; cites sections | Read-only | Output schema: `{playbook, section, status, evidence}` |
| **`contract-guardian`** | Route table, permission catalog, error envelope, OpenAPI/SDK parity, event/push schemas | Read + Bash | Deterministic scripts first |
| **`perf-budget-reviewer`** | Device-tier budgets, startup, memory, battery, bundle/binary size | Read + Bash | Consumes perf-gate outputs |
| `integrator` | Merges, shared files, lockfiles, generated contracts, release workflows | Write on shared paths | Only role allowed on shared paths |
| `kit-curator` | Improves agents/skills/rules/evals via PRs | Write on kit content (not control plane) | Writes `.claude/proposals/` for control-plane |
| **`playbook-curator`** | Maintains the playbook set (section 9) | Write under `playbooks/` only | Never edits product code; proposals reviewed by owners |
| `mapper` | Fast read-only slice map | Read, Grep, Glob | Small model |

### 5.6 Skills (extends `PLAYBOOK_CLAUDE_CODE` §6.5)

`spec-new/clarify/plan/tasks`, `tdd-cycle`, `spec-verify`, `slice-handoff`, `learn`, `retro`, `kit-audit` (as defined in CLAUDE_CODE) plus:

| Skill | Purpose |
|---|---|
| **`playbook-lookup`** | Given a task/path, run the routing algorithm and open only the relevant anchors |
| **`constitution-check`** | Fill and validate the 5.4 table for a spec/plan |
| **`new-slice-<platform>`** | Scaffold a slice per platform (backend-java, android, ios, rn, qt, extension, cli) with ports, tests, ArchUnit/Konsist/etc. |
| **`new-endpoint`** | OpenAPI first → route per URLS → permission in catalog → use case → resource → authz-matrix row → tests |
| **`contract-change`** | Cross-slice/cross-client contract change protocol (spec, compatibility statement, notify dependents, regenerate artifacts) |
| **`release-readiness-<platform>`** | Runs the platform release checklist and compiles the evidence bundle |
| **`security-review-graph`** | Launches the fan-out review graph (6.2) |
| **`verify-sweep`** | Re-checks `(verify)` items against primary sources and drafts proposals |
| **`playbook-lint`** | Runs the playbook linter (section 9.3) |

### 5.7 Hooks (extends `PLAYBOOK_CLAUDE_CODE_PART2` §7.3)

| Hook | Addition for the playbook set |
|---|---|
| `SessionStart` | Print applicable playbooks/anchors for the current slice/branch (routing algorithm), kit drift notice, switches in effect |
| `PreToolUse` guard | Unchanged policy (control plane, roles, claims, TDD); add: refuse edits to `playbooks/**` unless role is `playbook-curator` or human |
| `Stop` gate | Unchanged (prod code needs tests; tests not RED) |
| `SessionEnd` | Release claims; append routing/verdict log entry |
| CI (not a hook) | `playbook-lint`, `doctor`, constitution-check presence, "Playbook refs" in PR template, spec↔test traceability |

---


---

> Continues in [`PLAYBOOK_MASTER_PART3.md`](PLAYBOOK_MASTER_PART3.md).
