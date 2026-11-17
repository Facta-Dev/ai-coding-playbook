---
id: MASTER
version: 1.0.0
status: active
last_reviewed: 2026-11-16
review_cadence_days: 30
owner: architecture + engineering-productivity
depends_on: [URLS, BACKEND, SECURITY, TESTS, AUDIT, CLAUDE_CODE]
---

# PLAYBOOK_MASTER.md — Master playbook: the constitution of the playbook set and the Claude Code operating model

This is the **entry point** of the ai-coding-playbook project. It does three things:

1. **Indexes and governs the playbook set** (what exists, what depends on what, which one wins in a conflict, how each is loaded, versioned and kept honest).
2. **States the cross-playbook invariants**: the small set of contracts and rules that must be identical on every backend, client and tool.
3. **Defines the operating model for building everything with Claude Code**: the latest practices for loops, graphs, subagents, hooks, memory, verification, cost and security, applied to our architecture (**hexagonal + vertical slicing**, SDD + TDD, many parallel sessions).

It does not repeat the detail of the other playbooks; it tells Claude (and humans)
**which playbook to load for which task, which rules never bend, and which control
structure to use to get verified work**.

The rules that carry the whole file:

1. **Load the smallest relevant slice of the playbooks.** Progressive disclosure:
   route by task and path, read section anchors, never paste whole playbooks into context.
2. **Instructions guide; controls enforce.** What must always or never happen lives in
   hooks, permissions, tests, CI and managed settings, not in prose.
3. **The cross-playbook invariants (section 3) are the constitution.** A platform
   playbook may be stricter, never looser.
4. **Pick the smallest control structure that makes the decision safely**: a single
   agent loop before a graph, a graph before an orchestrator.
5. **A loop is a node in a graph.** Every node is a bounded loop with a contract;
   every graph is a state machine you can read as a diagram.
6. **Verification is designed, not assumed.** Deterministic checks first; independent
   review measured, not presumed from role names; a green graph proves routing, not
   requirements.
7. **Humans own governance.** Agents may propose changes to the control plane, never
   apply them; humans own risk acceptance, releases and irreversible effects.
8. **State lives outside the context window** (specs, task files, coordination state,
   event logs) and every effect is idempotent and reconcilable.
9. **Every dated fact has an owner and a refresh date.** `(verify)` items are tracked,
   not forgotten.
10. **Measure the whole system** (cost per accepted change, escaped defects, review
    queue age, hook violations), not only token counts.

> Verification note (as of 2026-11-16). Claude Code facts below come from the official
> documentation (best-practices, subagents, skills, hooks, memory, worktrees, parallel
> agents, cross-session messaging) and from Anthropic engineering posts; practitioner
> sources (a loop/graph engineering newsletter, a Claude Code guide, a builder-community
> article) are used for vocabulary and experience and are labelled as such. Features
> marked beta/experimental can change; re-verify version-specific items with
> `claude --version`, `/doctor` and the docs. The ecosystem snapshot in Appendix F
> records every dated claim used across the set.

---

## 1. The playbook set

### 1.1 Catalog

| ID | File | Scope | Layer | Volatility | Load when |
|---|---|---|---|---|---|
| **MASTER** | `PLAYBOOK_MASTER.md` | Constitution, routing, Claude Code operating model | governance | fast | Always the first read of a session |
| **URLS** | `PLAYBOOK_URLS.md` | Route grammar `/{userType}/{module}/{resource}`, permissions `module.resource.action`, error shape | foundation | slow | Any route, endpoint, deep link, permission or guard |
| **BACKEND** | `PLAYBOOK_BACKEND.md` | Hexagonal + vertical slicing, data, services, batch (Dragonfly/Redis), presentation, slice integration, extraction | foundation | slow | Any server-side code or data change |
| **SECURITY** | `PLAYBOOK_SECURITY.md` | Threat model, authn/z, injection, SSRF, crypto, supply chain, secrets, logging, language profiles | foundation | medium | Every code change touching trust boundaries, secrets, auth, input, dependencies |
| **TESTS** | `PLAYBOOK_TESTS.md` | Test pyramid per slice, authz/tenant suites, environments, SOC 2/ISO evidence | foundation | slow | Every spec (test strategy) and every release |
| **AUDIT** | `PLAYBOOK_AUDIT.md` | SOC 2, ISO 27001/9001, control library, evidence, audits, vendors, privacy, certifications | foundation | medium | Controls, evidence, vendors, privacy, certifications, audits |
| **CLAUDE_CODE** | `PLAYBOOK_CLAUDE_CODE.md` | The Claude Code kit: memory, agents, skills, hooks, switches, multi-session, SDD/TDD, learning loop | process | fast | Setting up or changing the kit; multi-session work |
| **FRONTEND** | `PLAYBOOK_FRONTEND.md` | React web/RN/extension MVVM + SDK, guards, layouts | client | medium | Web UI, shared ViewModels/SDK |
| **FRONTEND_MOBILE** | `PLAYBOOK_FRONTEND_MOBILE.md` | React Native / Expo: Game · Market · Avatar variants, auth, push, device tiers | client | fast | RN mobile |
| **MOBILE_ANDROID_KOTLIN** | `PLAYBOOK_MOBILE_ANDROID_KOTLIN.md` | Native Android, Kotlin/Compose, same variants | client | fast | Android native |
| **MOBILE_IOS_SWIFT** | `PLAYBOOK_MOBILE_IOS_SWIFT.md` | Native iOS, Swift 6/SwiftUI in code, same variants | client | fast | iOS native |
| **DESKTOP_QT** | `PLAYBOOK_DESKTOP_QT.md` | Qt desktop, Windows/Linux/macOS, old hardware, SSE/WebSocket | client | fast | Desktop app |
| **CHROME_EXTENSION** | `PLAYBOOK_CHROME_EXTENSION.md` | MV3 TypeScript, enterprise policy, SW lifecycle | client | fast | Browser extension |
| **CLI** | `PLAYBOOK_CLI.md` | Cross-platform CLI/TUI in Claude-Code style, headless modes, updates | client/tool | fast | Terminal product |
| **JAVA_J2EE** | `PLAYBOOK_JAVA_J2EE.md` | Java 25 + Jakarta EE 11→12 backend on our architecture | backend stack | medium | Java backends |
| **GOLANG** | `PLAYBOOK_GOLANG.md` | Go backend: cmd/internal, chi, pgx/sqlc, River, go-redis, depguard | backend stack | medium | Go backends |
| **NODEJS** | `PLAYBOOK_NODEJS.md` | Node.js backend: Fastify 5, Kysely, migrations, outbox, realtime | backend stack | medium | Node.js backends |
| **PYTHON** | `PLAYBOOK_PYTHON.md` | Python backend: FastAPI, pydantic v2, SQLAlchemy 2 async, Alembic | backend stack | medium | Python backends |
| **RUST** | `PLAYBOOK_RUST.md` | Rust backend: crate graph, axum, sqlx, outbox worker, clippy | backend stack | medium | Rust backends |
| **INSTALL** | `PLAYBOOK_INSTALL.md` | Machine bootstrap, kit install, working-set clone, verification | governance | fast | New machine, re-provisioning |
| **REA** | `PLAYBOOK_REA.md` | Reverse-engineering MCP + skills for binaries, bundles and traffic | tooling | fast | Binary/bundle analysis |

### 1.2 Dependency map

```text
                                   MASTER
                 ┌───────────────────┼─────────────────────────────┐
                 ▼                   ▼                             ▼
        FOUNDATION (always)     PROCESS (how we work)        CLIENT / STACK PLAYBOOKS
   URLS ── BACKEND ── SECURITY      CLAUDE_CODE                     FRONTEND ─► FRONTEND_MOBILE ─► ANDROID, IOS
        ╲     │      ╱                │                                  DESKTOP_QT · CHROME_EXTENSION · CLI
         TESTS ── AUDIT ◄────────── evidence                             JAVA_J2EE (backend stack)
```

* **Foundation** playbooks apply to every deliverable. **Client/stack** playbooks specialize them; they cite foundation sections and must not contradict them.
* **Mobile native** playbooks inherit contracts, flows and budgets from `FRONTEND_MOBILE`.
* **`CLAUDE_CODE`** defines the kit; **`MASTER`** defines how the kit is used across the set.

### 1.3 Backlog: gaps to close (candidate playbooks)

| Candidate | Why |
|---|---|
| `INFRA` (Kubernetes, IaC, networking, secrets platform, DR runbooks) | Referenced by BACKEND/SECURITY/AUDIT but not specified |
| `OBSERVABILITY` (logs/metrics/traces schemas, SLOs, alerting, on-call) | Spread across playbooks |
| `DESIGN_SYSTEM` (tokens, components, a11y, i18n across clients) | Tokens/a11y are referenced everywhere |
| `AI_FEATURES` (LLM/voice features: prompts, evals, safety, cost, provider abstraction) | Avatar/voice/agentic CLI features depend on it |
| `INCIDENT_RESPONSE` | Runbooks are scattered |

New playbooks are created from the template in Appendix B and registered in the manifest (section 5.2).

---

## 2. Precedence, conflicts and deviations

Order of authority (highest first):

1. **Law, regulation and customer contracts** (privacy, consumer protection, CRA, sector rules).
2. **MASTER invariants** (section 3).
3. **SECURITY**.
4. **URLS**.
5. **BACKEND**.
6. **TESTS**, **AUDIT**.
7. **Client/stack playbooks** (FRONTEND*, MOBILE_*, DESKTOP_QT, CHROME_EXTENSION, CLI, JAVA_J2EE).
8. **CLAUDE_CODE** (kit/process; it governs *how* work is done, not *what* the product must satisfy).
9. **Project-local conventions** (ADRs, per-slice `CLAUDE.md`).

Rules:

* **The stricter rule wins.** A platform playbook may add requirements; it may not relax a foundation rule.
* **Deviations require an ADR** with: the rule, the reason, compensating control, owner, **expiry date**, and the approver. Expired ADRs fail CI (`playbook-lint`).
* **Contradictions are defects**: open an issue/proposal against the *lower-authority* playbook (or against MASTER if two foundation playbooks disagree), and record the interim decision.
* **Cite precisely** (`PLAYBOOK_SECURITY §5`, section titles stay stable even if numbers shift; the manifest maps titles to anchors).
* **Never copy** playbook text into specs or code comments; link by ID + section so updates propagate.

---

## 3. Cross-playbook invariants (the constitution)

These hold for every backend, client and tool. Each has a home playbook, a verification
method and an owner. Changing one is a MASTER version bump with a changelog entry.

| # | Invariant | Home | Verified by |
|---|---|---|---|
| I-1 | **One name per slice**: backend slice = URL module = permission prefix = spec folder = test folder = realtime topic prefix = client feature module | BACKEND §1, URLS | `playbook-lint` naming parity; architecture tests |
| I-2 | **Hexagonal + vertical slicing** everywhere; domain has no framework/platform imports; cross-slice only via `contracts` | BACKEND §1–§4, §7; each client/stack playbook | architecture tests per platform (ArchUnit, dependency-cruiser, module graph, Konsist, SwiftPM/Gradle/CMake targets) |
| I-3 | **Route grammar** `/api/{version}/{userType}/{module}/{resource}[/{id}[/{sub}]]`; **`{userType}` never authorizes** | URLS | route-table parity tests in every client; authz-matrix |
| I-4 | **Permissions are `module.resource.action`** from one shared catalog; checked **in the use case**, per object and per tenant | URLS, SECURITY §5 | authz-matrix + IDOR/tenant-isolation sweeps |
| I-5 | **One error envelope** `{error:{code,message,requiredPermission?,correlationId}}` and one taxonomy (`unauthenticated, forbidden, not-found, conflict, validation, rate-limited, network, server, upgrade-required`); mapped to HTTP, UI statuses and CLI exit codes | URLS, FRONTEND §3, CLI §4 | contract tests |
| I-6 | **Tenancy**: tenant from the token/session, validated against membership; `tenant_id` on every tenant table + row-level security; cross-tenant existence → `404` | BACKEND §3, SECURITY §5 | tenant-isolation suite |
| I-7 | **Idempotent mutations** (`Idempotency-Key`) and idempotent batch/jobs (deterministic `jobId`, fencing, DB unique constraints); Redis/Dragonfly coordinates, **the DB is the truth** | BACKEND §5–§6 | concurrency suite |
| I-8 | **Long operations** answer `202` + operation resource; no blocked connections | BACKEND §6, FRONTEND §6 | e2e/contract |
| I-9 | **Correlation**: `X-Correlation-Id` generated at the user action and propagated across HTTP, queues, events, push payloads and logs | SECURITY §14, all clients | observability assertions |
| I-10 | **Events**: transactional outbox; at-least-once; consumers idempotent; versioned envelopes; **realtime** is optional and degradable (`auto|websocket|sse|polling|off`), snapshot + stream, resume, resync | BACKEND §5/§7, DESKTOP_QT §8 | realtime conformance suite |
| I-11 | **Client contract parity**: generated SDKs/DTOs from OpenAPI; generated route builders from the shared route table; shared permission catalog; shared i18n keys; hand-written paths/DTOs forbidden | FRONTEND §3, each client | parity tests |
| I-12 | **Device tiers and budgets**: `low|mid|high`, measured not assumed, runtime quality governor, floor-device testing; budgets calibrated per product | FRONTEND_MOBILE §3, DESKTOP_QT §2, CLI §11 | device-pool perf gates |
| I-13 | **Push is a channel, not a data path**: minimal payloads, categories/channels, validated deep links, fetch after tap, reconcile on foreground | FRONTEND_MOBILE §8 (+ Android/iOS §8) | push suite |
| I-14 | **Managed policy + kill switch + diagnostics bundle** on every shipped client (extension, desktop, CLI, mobile via remote config) | CHROME_EXTENSION §12, DESKTOP_QT §12, CLI §8 | policy suites |
| I-15 | **Secrets and keys**: never in code, images, logs, bundles; OS keystore on clients; envelope encryption for tenant provider keys (write-only everywhere) | SECURITY §8, §13 | secrets scans; log-redaction tests |
| I-16 | **Supply chain**: lockfiles, frozen installs, cooldown for fresh versions, SCA/SBOM, signed artifacts, pinned CI actions, provenance | SECURITY §11 | CI gates |
| I-17 | **Sensitive data classes**: location, microphone/voice, camera/face-derived, tenant lead data, provider keys are *Restricted*: consent, minimization, retention, deletion cascade | AUDIT §13, SECURITY §8 | privacy suite |
| I-18 | **SDD + TDD**: spec with acceptance criteria and a constitution check before code; a failing test before production code; implementer cannot edit tests | CLAUDE_CODE §9–§10 | hooks + CI |
| I-19 | **Evidence by default**: every release produces a bundle (builds, SBOM, test/perf/security reports, approvals, permission/entitlement diffs) | TESTS §10, AUDIT §8 | release gate |
| I-20 | **Control plane is human-owned**: hooks, settings, role/ownership policy, signing/update keys, CI release workflows; agents propose, humans apply | CLAUDE_CODE §7, §14 | CODEOWNERS + guard hook |
| I-21 | **Every deviation is an ADR with an expiry** | MASTER §2 | `playbook-lint` |
| I-22 | **Compliance clocks are tracked**: EU CRA reporting obligations from 2026-09-11, most other obligations from 2027-12-11 (applicability confirmed with counsel); ISO 9001:2026 transition; store-policy deadlines | AUDIT §1, §14 | compliance calendar |

---

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
| **Worktree sessions + launcher + claims** (our default, `PLAYBOOK_CLAUDE_CODE` §8) | Parallel slices owned by different sessions | One slice per session; integrator owns shared files |
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
| `.claude/**`, `scripts/claude/**`, `specs/**` | CLAUDE_CODE, MASTER §4–§6 |
| `**/Dockerfile*`, `infra/**`, `.github/**` | SECURITY (Infrastructure, Supply chain), AUDIT (Operational control processes) |
| `docs/playbooks/**` | MASTER §9 (maintenance) |

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

### 5.7 Hooks (extends `PLAYBOOK_CLAUDE_CODE` §7.3)

| Hook | Addition for the playbook set |
|---|---|
| `SessionStart` | Print applicable playbooks/anchors for the current slice/branch (routing algorithm), kit drift notice, switches in effect |
| `PreToolUse` guard | Unchanged policy (control plane, roles, claims, TDD); add: refuse edits to `playbooks/**` unless role is `playbook-curator` or human |
| `Stop` gate | Unchanged (prod code needs tests; tests not RED) |
| `SessionEnd` | Release claims; append routing/verdict log entry |
| CI (not a hook) | `playbook-lint`, `doctor`, constitution-check presence, "Playbook refs" in PR template, spec↔test traceability |

---

## 6. Standard graphs (recipes)

Every recipe is a **static control plane**: node types, permissions, edges, budgets and terminal states are reviewed; only task data is dynamic.

### 6.1 Feature delivery (SDD → TDD → review → integrate)

```yaml
graph: feature-delivery
version: 1
owner: engineering-productivity
state:
  spec_ref:        { writer: spec-architect, validator: spec_schema }
  plan_ref:        { writer: spec-architect, validator: constitution_check_complete }
  tasks_ref:       { writer: spec-architect, validator: every_AC_has_a_test_path }
  tdd_state:       { writer: tdd_runner, values: [writing, red, green] }          # coordination dir, per worktree+slice
  patch_ref:       { writer: implementer, validator: commit_exists }
  test_evidence:   { writer: verify, validator: command_and_exit_status }
  review_findings: { writer: review_fanout, validator: finding_schema_with_reproduction }
  rework_budget:   { writer: retry_router, initial: 2, minimum: 0, decrement_when: verification_failed_and_value_gt_0 }
  verdicts:        { writer: adjudicate, validator: named_authority }
nodes:
  intake:       { actor: human + spec-architect, output: spec_ref, gate: clarity }
  plan:         { actor: spec-architect, output: [plan_ref, tasks_ref], gate: [constitution, testability] }
  tdd_loop:     { type: loop, actors: [test-writer, implementer], output: patch_ref, loop_contract: tdd-cycle, side_effect: git_worktree }
  verify:       { type: deterministic, runs: [unit, architecture, contract, lint, sast, sca, secrets, size_and_permission_diff], output: test_evidence }
  retry_router: { type: deterministic, input: [test_evidence, rework_budget] }
  review_fanout:{ type: parallel, nodes: [code-reviewer, security-reviewer, playbook-reviewer, contract-guardian, perf-budget-reviewer], inputs: [spec_ref, patch_ref, test_evidence], excludes: [author_reasoning] }
  merge:        { type: deterministic, rule: union_findings_max_severity }
  adjudicate:   { actor: human, when: [severity>=high, disagreement, ambiguous_requirement], sampling: 10% }
  integrate:    { actor: integrator, side_effects: [rebase, regenerate_contracts, lockfiles] }
  release_gate: { actor: human, authority: release_owner }
terminals:
  done:      { condition: accepted_with_evidence_and_integrated }
  failed:    { conditions: [rework_budget_exhausted, policy_violation] }
  escalated: { condition: human_escalation }
edges:
  - intake -> plan: spec_clarified
  - plan -> tdd_loop: tasks_ready
  - tdd_loop -> verify: patch_ref_exists
  - verify -> retry_router: verification_failed
  - retry_router -> tdd_loop: rework_budget_decremented
  - retry_router -> failed: rework_budget_exhausted
  - verify -> review_fanout: verification_passed
  - review_fanout -> merge: all_reviewers_returned_or_timeout
  - merge -> tdd_loop: blocking_findings_and_budget_remains
  - merge -> adjudicate: needs_human
  - merge -> integrate: no_blocking_findings
  - adjudicate -> integrate: accepted
  - adjudicate -> escalated: ambiguous_or_high_impact
  - integrate -> release_gate: integrated
  - release_gate -> done: approved
forbidden:
  - implementer edits tests; reviewer edits product code; any node edits control plane
  - integrate without verification_passed and merge verdict
```

The `tdd_loop` node is itself a loop (`PLAYBOOK_CLAUDE_CODE` §10): test-writer → RED (recorded) → implementer → GREEN → refactor, with a budget and the Stop gate.

### 6.2 Security review fan-out/fan-in

```yaml
graph: security-review
nodes:
  brief:        { actor: orchestrator, output: [requirement, diff, playbook_anchors] }          # no author reasoning
  authz:        { actor: security-reviewer, focus: [SECURITY#Authorization, URLS#Authorization rules, tenant isolation] }
  input:        { actor: security-reviewer, focus: [SECURITY#Input handling and injection, SECURITY#SSRF and outbound traffic] }
  secrets_data: { actor: security-reviewer, focus: [SECURITY#Cryptography and data protection, SECURITY#Secrets management] }
  supply_chain: { actor: security-reviewer, focus: [SECURITY#Supply chain, dependency/SBOM diff] }
  privacy:      { actor: playbook-reviewer, focus: [AUDIT#Privacy and product-compliance, data classes I-17] }
  merge:        { type: deterministic, rule: union_findings_max_severity, dedupe: by_location_and_cwe }
  reproduce:    { type: loop, input: merged_findings, rule: each_finding_needs_failing_test_or_trace_or_downgrade }
  sample_check: { actor: human, sampling: 10%_plus_all_critical }
output_schema: { id, location, severity, category, evidence_ref, reproduction_ref, recommendation }
```

Run the five reviewers **in parallel with clean contexts**; vary model tier for at least one; record overturn rate.

### 6.3 Other recipes (summaries)

| Recipe | Shape | Key controls |
|---|---|---|
| **New slice** | spec → scaffold skill (per platform) → ownership/roles entry → ArchUnit/module checks → first TDD task → docs | Slice naming parity (I-1), CODEOWNERS, permission catalog update |
| **Cross-slice contract change** | spec in owning slice → compatibility statement (additive vs breaking) → implement + contract tests → notify dependents (SendMessage) → integrator regenerates SDKs/route table → dependents adapt | Additive within version; breaking → new version + deprecation window |
| **Expand/contract migration** | expand migration + tests → deploy → backfill job (resumable) → switch reads/writes → contract migration later | Never rename/drop with the code change; migration tests from scratch and N-1 |
| **Hotfix** | reproduce failing test → minimal fix → full gate subset → staged rollout → retrospective | Emergency mode logged; test added in the same PR; waiver with expiry |
| **Release (per platform)** | evidence bundle → signing (isolated job) → staged rollout/phased release → health gates → rollback plan | Platform checklists in each playbook; kill switch ready |
| **Dependency upgrade routine** (scheduled) | detect → admit (cooldown, no duplicate PR, capacity) → upgrade in worktree → full gate → review → canary | Release-age cooldown, SCA/SBOM, WIP cap |
| **Incident diagnosis (assist)** | read-only evidence gathering → hypotheses → proposed mitigation → human decides | No production writes; scoped read credentials; transcripts redacted |

### 6.4 Playbook maintenance graph (section 9)

`verify-sweep` (scheduled routine) → candidate edits (`playbook-curator` writes proposals) → `playbook-lint` (deterministic) → owner review → merge → changelog + manifest regeneration. **WIP cap**: at most 3 open playbook PRs; admission skips items already in flight.

---

## 7. Routing matrix by deliverable

| Deliverable | Load (in order) | Mandatory gates |
|---|---|---|
| New/changed **REST endpoint** | URLS → BACKEND (Presentation, Services) → SECURITY (Authorization, Input) → TESTS (Backend, Security) → stack playbook (JAVA_J2EE or language profile) | OpenAPI diff, authz-matrix row, IDOR/tenant sweep, contract tests |
| **Data/migration** | BACKEND (Data layer) → SECURITY (data protection) → TESTS (migration) | Expand/contract, RLS, migration tests |
| **Batch/queue/outbox** | BACKEND (Batch) → SECURITY (Batch, queue and event security) → TESTS (concurrency) | Idempotency, fencing, DLQ, per-tenant limits |
| **Realtime feature** | DESKTOP_QT §Realtime → BACKEND (Connecting slices) → client playbook (mobile §14 / CLI §7.3 / extension) | Conformance suite, resync, backpressure |
| **Web UI feature** | FRONTEND → URLS (guards) → TESTS (Frontend) | ViewModel statuses, a11y, parity |
| **RN mobile feature** | FRONTEND_MOBILE → FRONTEND | Low-tier path, push/deep-link tests, store checklist |
| **Android native** | MOBILE_ANDROID_KOTLIN → FRONTEND_MOBILE | Baseline profile, vitals, 16 KB, Android 17 checklist |
| **iOS native** | MOBILE_IOS_SWIFT → FRONTEND_MOBILE | Views in code, privacy manifest, MetricKit gates |
| **Desktop (Qt)** | DESKTOP_QT | Floor-profile perf, signing/updater suites |
| **Chrome extension** | CHROME_EXTENSION → FRONTEND | Permission diff, SW lifecycle tests |
| **CLI/TUI** | CLI | stdout/stderr + exit-code contract, PTY e2e, 3-OS matrix |
| **Java backend** | JAVA_J2EE → BACKEND → SECURITY | ArchUnit/Enforcer, Testcontainers, JFR |
| **Auth/onboarding/forgot password** | FRONTEND_MOBILE §7 (+ platform §7) → SECURITY (Authentication) → URLS | Uniform responses, single-use tokens, MFA/step-up, deletion |
| **Push notifications** | FRONTEND_MOBILE §8 (+ platform §8) → SECURITY | Payload schema, channels, token lifecycle, deep-link allowlist |
| **Payments/marketplace** | FRONTEND_MOBILE §11 → SECURITY → AUDIT (vendors, PCI scope) | Server-authoritative pricing, idempotent checkout |
| **Avatar/voice/3D** | FRONTEND_MOBILE §12–§13 → AUDIT (Privacy) → SECURITY | Consent, retention, AI disclosure, asset budgets |
| **Game/location** | FRONTEND_MOBILE §10 → AUDIT (Privacy) → SECURITY | Server authority, anti-cheat signals, battery budgets |
| **Infra/CI/CD change** | SECURITY (Infrastructure, Supply chain, Secrets) → AUDIT (Operational controls) → CLAUDE_CODE (control plane) | Human review; signing isolation |
| **Audit/evidence/compliance** | AUDIT → TESTS §10 | Control mapping, evidence retention |
| **Kit/agents/skills/hooks change** | CLAUDE_CODE → MASTER §4–§5 | Registry validation, evals, CODEOWNERS |
| **Playbook change** | MASTER §9 | `playbook-lint`, owner review, changelog |

---

## 8. Choosing platforms (ADR aid)

| Product need | Prefer | Why | Watch-outs |
|---|---|---|---|
| Broad mobile reach, shared TS code with web | **RN/Expo** (`FRONTEND_MOBILE`) | Shared ViewModels/SDK, OTA for JS, one team | Heavy 3D needs engine modules; Low-tier discipline |
| Maximum mobile performance/system integration | **Android Kotlin + iOS Swift** native | Baseline profiles, platform perf APIs, best battery/graphics | Two codebases; keep contract parity via shared artifacts |
| Old PCs, dense data UI, offline, OS integration | **Qt desktop** (`DESKTOP_QT`) | CPU raster, small footprint, enterprise deployment | C++ hardening, signing/update burden |
| In-browser workflow augmentation | **Chrome extension** | Reach into customer sites, admin policy | Permission review, SW lifecycle |
| Automation, power users, CI, agentic workflows | **CLI/TUI** | Scriptable, headless, distribution via package managers | Terminal escape safety, cross-OS testing |
| Enterprise Java shops / long-lived domain services | **Jakarta EE (Java 25)** | Standards, portability, mature ops | Runtime choice ADR; EE 12 timeline |
| Rapid iteration backends | Node/Python/Go/Rust per `BACKEND` + `SECURITY` §16 | Language fit | Per-language playbooks are a backlog item |

Never choose a platform only for the AI-generation experience: choose for runtime constraints (performance floor, offline, distribution, compliance), then apply the matching playbook.

---

## 9. Maintaining the playbook set

### 9.1 Versioning and front matter

* Semantic versions per playbook (`MAJOR` = invariant/contract change, `MINOR` = new section/practice, `PATCH` = fix/clarification); `CHANGELOG.md` entries link PRs and note affected invariants.
* Front matter on every playbook: `id, version, status, last_reviewed, review_cadence_days, owner, depends_on`.
* Section **titles are the stable anchors**; renumbering is allowed, so references use `ID §<title>` with the number as a convenience; `section-index` regenerates the title→line map in the manifest.

### 9.2 Volatility classes and review cadence

| Class | Playbooks | Cadence | Trigger events |
|---|---|---|---|
| **Fast** | MASTER, CLAUDE_CODE, FRONTEND_MOBILE, ANDROID, IOS, DESKTOP_QT, CHROME_EXTENSION, CLI | 30–60 days | New Claude Code/RN/Expo/Android/Xcode/Qt/Chrome releases; store policy changes |
| **Medium** | SECURITY, AUDIT, JAVA_J2EE, FRONTEND | 90 days | OWASP/standard revisions, regulation dates, runtime releases |
| **Slow** | URLS, BACKEND, TESTS | 180 days | Architecture decisions, extraction events |

### 9.3 `playbook-lint` (deterministic)

| Check | Rule |
|---|---|
| Cross-references | Every `PLAYBOOK_X §n` or `ID §Title` resolves to an existing section; semantic spot-checks sample the target heading |
| Front matter | Present, valid, `last_reviewed` within cadence |
| Invariant parity | Route grammar, error envelope, taxonomy, permission format, envelope field names appear **identically** wherever restated |
| Dated facts | Every claim tagged `(verify)` or in Appendix F has a register entry with due date |
| ADR expiry | No expired deviations |
| Banned patterns | Per-playbook (e.g., `javax.*` outside migration notes; hand-written paths in client snippets) |
| Manifest | Every playbook registered; `appliesTo` paths compile; anchors exist |
| Size/readability | Sections over a threshold flagged for splitting into skills or sub-docs |

*Example of the lint paying off*: validating cross-playbook section references found three wrong `SECURITY` section numbers (headers, Redis ACL guidance, language profiles); they were corrected at the source. Run this on every PR touching `playbooks/`.

### 9.4 The `(verify)` register

| Field | Meaning |
|---|---|
| ID | `V-<playbook>-<n>` |
| Claim | The dated/version-specific statement |
| Source | Primary URL (docs/spec/vendor), with retrieval date |
| Owner, due | Who re-checks and by when |
| Status | `open`, `confirmed`, `changed` (with the edit PR), `retired` |

**Source quality policy**: primary documentation and standards > engineering blogs by the vendor > reputable secondary reporting > practitioner posts > marketing pages. Treat vendor marketing and community "listicles" as leads, not proof; never present a practitioner's numbers (speedups, savings) as benchmarks.

### 9.5 Improvement loop for the set

Capture → triage → promote (`PLAYBOOK_CLAUDE_CODE` §13) applies to playbooks: corrections and review overturns that point to a missing/ambiguous rule become **proposals** against a playbook, are linted, reviewed by the owner, and merged with a version bump; recurring defects become upstream controls (tests, hooks, lint rules) rather than longer prose.

---

## 10. Adoption roadmap and maturity

| Level | Description | Exit criteria |
|---|---|---|
| **M0 Ad hoc** | Plain `claude`, no shared rules | — |
| **M1 Shared context** | `CLAUDE.md` + routing table + path-scoped rules + permissions | Playbook set vendored at a pinned version; `/context` shows expected files |
| **M2 Capabilities** | Agents, skills, registry, `playbook-lookup`, constitution check in plans | ≥ 80% of trigger evals pass; plans cite playbook sections |
| **M3 SDD + TDD enforced** | Specs precede code; TDD gate and Stop gate in warn → enforce | Violations visible; traceability AC→test→result |
| **M4 Parallel and governed** | Launcher, claims, roles, messaging etiquette, CODEOWNERS on control plane | 3+ concurrent sessions for a month without collisions |
| **M5 Graph-verified** | Feature-delivery and security-review graphs in use; sampled adjudication; metrics dashboard | Independence measured; escaped defects trending down |
| **M6 Self-improving** | Retro cadence, kit-curator/playbook-curator, verify-sweep routine, held-out evals | Proposals shipped weekly with evidence; stale `(verify)` ≈ 0 |

Suggested rollout: M1 (week 0) → M2 (weeks 1–2) → M3 in warn (weeks 3–4) → enforce and M4 (month 2) → M5 (month 3) → M6 (month 4+). Pilot with one slice and one platform; calibrate thresholds from real queues; widen only with a working integration flow and cost visibility.

---

## 11. Master checklists

### 11.1 Project bootstrap

- [ ] Playbook set vendored at a pinned version; `manifest.json` and `verify-register.md` present.
- [ ] `CLAUDE.md` (≤ 200 lines) with the routing table, the invariants digest and kit commands; path-scoped rules per platform generated from the manifest.
- [ ] Kit installed and validated (`doctor`, registry, hooks fail-closed, roles/ownership adapted to the layout).
- [ ] CODEOWNERS on control plane, `playbooks/`, release workflows, signing configuration.
- [ ] Agent identity registry: every agent/routine has an owner, scoped credentials, expiry.
- [ ] Device pool and CI matrices defined per client; evidence store configured.

### 11.2 Per feature (Claude session protocol)

- [ ] Session start: read pointers; run routing (hook/skill); load only listed anchors.
- [ ] Spec with ACs and a **filled constitution check**; ambiguity resolved before planning.
- [ ] Tasks are test-first; each AC maps to a test level and path.
- [ ] RED recorded before production code; implementer never edits tests.
- [ ] Deterministic gates green (tests, architecture, contract, lint, SAST/SCA, secrets, permission/size diffs).
- [ ] Independent review per 4.8 (fresh context, requirement + diff, reproduced findings); sampled human adjudication for high severity.
- [ ] PR includes **Playbook refs**, evidence links, ADRs for deviations.
- [ ] Corrections captured with `/learn`; repeated findings proposed upstream.

### 11.3 Per release

- [ ] Evidence bundle (builds, SBOM, test/perf/security reports, diffs, approvals) attached.
- [ ] Platform release checklist (store/signing/notarization/updates/policies) complete.
- [ ] Staged rollout, health gates, kill switch and rollback verified.
- [ ] Compliance clocks and store-policy deadlines checked (I-22).

### 11.4 Per quarter

- [ ] Verify-sweep done; register has no overdue items.
- [ ] Review overturn rate, escaped defects, cost per accepted change, queue age reviewed; thresholds recalibrated.
- [ ] Kit audit (`doctor`, `/doctor` prompt checks, skills usage), retire unused components, refresh evals.
- [ ] Permission/entitlement/vendor/dependency registers reviewed; DR/restore and access-review drills done.

---

## Appendix A — Section index of the set (titles are the stable anchors)

| Playbook | Sections |
|---|---|
| **URLS** | Enterprise template · The `{userType}` segment · Authorization rules · Multi-tenant structure · CRUD by role · Granular permissions · Frontend guards and layouts · Concrete example · Checklist |
| **BACKEND** | 1 Vertical slicing · 2 Repository layout · 3 Data layer · 4 Services layer · 5 Batch processes · 6 Presentation layer · 7 Connecting slices · 8 Deployment modes · 9 When to extract a slice · 10 Cross-cutting rules · 11 Example · 12 Checklist |
| **SECURITY** | 1 Standards · 2 Threat model · 3 Layers of defense · 4 Authentication · 5 Authorization · 6 Input handling and injection · 7 SSRF and outbound traffic · 8 Cryptography and data protection · 9 API and application hardening · 10 Batch, queue and event security · 11 Supply chain · 12 Infrastructure, network and platform · 13 Secrets management · 14 Logging, monitoring, detection and response · 15 Secure development lifecycle · 16 Language profiles · 17 Security requirements by slice · 18 Starting baseline values · 19 Verification map · 20 Example · 21 Checklist |
| **TESTS** | 1 Repository layout · 2 Test types and the pyramid · 3 Backend tests · 4 Frontend tests · 5 Security tests · 6 Non-functional tests · 7 End-to-end policy · 8 Platform-wide suites · 9 Environments, data and pipeline · 10 Compliance evidence · 11 Example · 12 Checklist |
| **AUDIT** | 1 Framework landscape · 2 Scope · 3 Governance · 4 Unified control library · 5 Risk management · 6 Policy set · 7 Compliance as code · 8 Evidence management · 9 Audit lifecycle · 10 Operational control processes · 11 Quality management (ISO 9001) · 12 Third-party risk · 13 Privacy and product compliance · 14 Other certifications and regulations · 15 Customer-facing assurance · 16 Audit-day playbook · 17 Metrics · 18 Annual calendar · 19 Example · 20 Checklist |
| **CLAUDE_CODE** | 1 Seven planes · 2 Design principles · 3 Directory structure · 4 Instruction plane · 5 Memory plane · 6 Capability plane · 7 Control plane · 8 Coordination plane · 9 SDD · 10 TDD · 11 Autodetection · 12 Switches and profiles · 13 Learning plane · 14 Security and governance of the kit · 15 CI/CD and compliance · 16 Cadences · 17 Roadmap · 18 Troubleshooting · 19 Acceptance checklist · Appendices |
| **FRONTEND** | 1 Architecture · 2 Monorepo layout · 3 The SDK · 4 MVVM conventions · 5 Adapting to the URL playbook · 6 Cross-cutting rules · 7 Testing · 8 Example · 9 Checklist |
| **FRONTEND_MOBILE** | 1 Decisions · 2 Product family · 3 Device classes and governor · 4 Architecture · 5 Monorepo and variants · 6 Navigation and deep links · 7 Onboarding/login/registration/forgot password · 8 Push · 9 Libraries · 10 Game · 11 Market · 12 Avatar · 13 Scene engines and assets · 14 Realtime and background · 15 Security and store compliance · 16 Observability · 17 Testing · 18 Build and release · 19 Governance · 20 Anti-patterns · 21 DoD |
| **MOBILE_ANDROID_KOTLIN / MOBILE_IOS_SWIFT** | Same 21-section structure as FRONTEND_MOBILE (platform-specific content in each) |
| **DESKTOP_QT** | 1 Decisions · 2 Platform and performance · 3 Architecture · 4 Layout · 5 Backend integration · 6 Navigation · 7 Authentication · 8 Realtime · 9 Local storage · 10 Platform integration · 11 Security · 12 Enterprise · 13 Observability · 14 Packaging and updates · 15 Testing · 16 CI/CD · 17 Governance · 18 Claude Code · 19 Anti-patterns · 20 DoD |
| **CHROME_EXTENSION** | 1 Decisions · 2 Platform model · 3 Architecture · 4 Directory · 5 Manifest and permissions · 6 Messaging · 7 State and migrations · 8 Service worker · 9 Content scripts · 10 UI surfaces · 11 Networking and auth · 12 Enterprise · 13 Security · 14 Privacy and store · 15 Observability · 16 Performance · 17 Testing · 18 Build and release · 19 Cross-browser · 20 Governance · 21 Claude Code · 22 Anti-patterns · 23 DoD |
| **CLI** | 1 Decisions · 2 Product surface · 3 Architecture · 4 CLI UX contract · 5 Interactive TUI · 6 Platform specifics · 7 Backend integration · 8 Configuration and state · 9 Extensibility and agentic modules · 10 Security · 11 Performance · 12 Distribution and update · 13 Observability · 14 Testing · 15 Build and release · 16 Governance · 17 Claude Code · 18 Anti-patterns · 19 DoD |
| **JAVA_J2EE** | 1 Decisions · 2 Runtime selection · 3 Architecture · 4 Layout · 5 Data layer · 6 Services layer · 7 Batch and coordination · 8 Presentation · 9 Security · 10 Observability and performance · 11 Build and deployment · 12 Testing · 13 Migration and upgrade · 14 Governance · 15 Anti-patterns · 16 DoD |

## Appendix B — Playbook template (front matter and skeleton)

```markdown
---
id: <ID>
version: 0.1.0
status: draft            # draft | active | deprecated
last_reviewed: <date>
review_cadence_days: 90
owner: <role>
depends_on: [URLS, BACKEND, SECURITY, TESTS, AUDIT]
---
# PLAYBOOK_<ID>.md — <title>
Purpose and rules that carry the whole file (≤ 10) · Verification note
1. Decisions up front (ADR table)  2. Platform/runtime model  3. Architecture (layers table, dependency rules)
4. Layout  5. Contracts (SDK, routes, errors)  6+ Domain-specific sections  N-3 Security  N-2 Testing  N-1 Build/release
N. Anti-patterns · Definition of done and checklists · Appendices (templates, snippets)
Every section states: rule, rationale, enforcement mechanism, evidence.
```

## Appendix C — Loop contract template

```markdown
# Loop: <name>   Owner: <role>   Version: 1
Goal: <verifiable condition, e.g., "tests under tests/<slice>/** pass with exit 0 and no files outside src/<slice>/** changed">
Inputs: <spec_ref, revision, allowed paths>
State (outside context): <files/DB with writers>
Actions allowed: <tools, credentials, effects>   Forbidden: <…>
Observation: <what feeds the next iteration>
Verification: <deterministic checks → independent review → human>
Budget (enforced by <controller>): <turns, time, cost; reset rules>
Stop: success=<…> failure=<…> escalate=<…>
Evidence to retain: <commands, outputs, trace IDs, versions>
```

## Appendix D — Canonical task prompts (human → Claude)

```text
FEATURE:   "Create spec for <slice>: <intent>. Load playbooks via routing. Produce spec.md with ACs and a filled constitution check; ask ≤3 blocking questions."
BUGFIX:    "Reproduce <bug> with a failing test in tests/<slice>/…; show command + output. Then minimal fix. Do not modify other slices."
REFACTOR:  "Refactor <module> with no behavior change; tests must stay green; list files touched; no contract changes."
MIGRATION: "Plan expand/contract for <change>; produce migration + tests (from scratch and N-1); no destructive step in this PR."
REVIEW:    "Review the diff for <requirement>. You get the requirement, diff and test evidence only. Each finding needs a reproduction or is downgraded."
INCIDENT:  "Read-only diagnosis of <symptom> using logs/traces <refs>. Produce hypotheses ranked with evidence; propose mitigation; make no changes."
PLAYBOOK:  "Check <claim> against primary sources; propose an edit with citation and affected invariants; do not edit control files."
```

## Appendix E — `CLAUDE.md` digest for the master (≈ 40 lines)

```markdown
## Playbooks (reference, not instructions)
Pinned set: docs/playbooks @ vX.Y.Z — read via anchors, never @-import. Entry: PLAYBOOK_MASTER.md.
Routing: run `playbook-lookup` (or read the SessionStart hint). Load ≤ 4 playbooks / ≤ 8 anchors.
Invariants (MASTER §3): one name per slice · hexagonal boundaries · `{userType}` never authorizes · permissions module.resource.action in the use case ·
one error envelope · tenant from token + RLS · idempotent mutations/jobs · outbox events · correlation ids · generated SDKs/route table ·
device tiers + floor testing · push minimal payloads · managed policy + kill switch · no secrets anywhere · supply-chain cooldown + SBOM ·
SDD + TDD · evidence bundle · control plane human-owned · deviations = ADR with expiry.
Process: spec (with constitution check) → failing test (RED recorded) → minimal code → deterministic gates → independent review (requirement + diff) → PR with "Playbook refs".
Never: edit hooks/settings/roles; relax a foundation rule without an ADR; claim done without evidence; run unattended with production credentials.
```

## Appendix F — Ecosystem snapshot used across the set (as of 2026-11-16; every item is registered in `verify-register.md`)

| Area | Fact | Where used |
|---|---|---|
| Claude Code | Docs baseline v2.1.309+ in `CLAUDE_CODE`; native per-platform binaries since v2.1.113; agent teams experimental/disabled by default; dynamic workflows, `/goal`, `/loop`, `/schedule`/routines, Code Review and agent view are current/beta features **(verify per release)** | CLAUDE_CODE, MASTER, CLI |
| Anthropic multi-agent research | Lead + parallel subagents outperformed a single-agent baseline by a large margin at ~15× tokens; early over-spawning | MASTER §4.7 |
| React Native / Expo | RN 0.88 (Oct 2026); Expo SDK 58; New Architecture only; Hermes V1 default since 0.84; SDK 56 Hermes V1 memory regression fixed in later patches | FRONTEND_MOBILE |
| Android | Android 17 (API 37) released June 2026; Play target API 36 from 2026-08-31; Compose 1.12 requires `compileSdk 37` + AGP 9.1.1; Navigation 3 1.0; AndroidX `minSdk` 24; RAM-based app memory limits in Android 17; 16 KB page-size enforcement dates **(verify)** | MOBILE_ANDROID_KOTLIN |
| Apple | Xcode 27.2 / Swift 6.4.x; iOS 27 (Sep 2026); App Store floor Xcode 26 (since 2026-04-28); SceneKit soft-deprecated; iOS 27 reportedly supports all iOS 26 devices **(verify)** | MOBILE_IOS_SWIFT |
| Qt | Qt 6.12 LTS (2026-09-30); 6.8 LTS to Oct 2029; no first-party SSE client assumed **(verify)** | DESKTOP_QT |
| Chrome | MV3 only; WXT recommended; Plasmo in maintenance mode | CHROME_EXTENSION |
| Java/Jakarta | Jakarta EE 11 current; EE 12 Core Profile target Q4 2026, Web/Platform Q1–Q2 2027; JDK 25 LTS, JDK 27 GA 2026-09-14 | JAVA_J2EE |
| CLI ecosystem | Claude Code (TS + React/Ink fork), Gemini CLI (TS + Ink), Codex CLI (Rust/ratatui), Crush (Go/Bubble Tea v2) | CLI |
| Security | OWASP Top 10:2025 (SSRF merged into Broken Access Control; Supply Chain Failures added) | SECURITY |
| Regulation/standards | EU CRA reporting from 2026-09-11, most obligations 2027-12-11; ISO 9001:2026 published 2026-09-16 with transition to 2029-09-30 **(confirm with counsel/certification bodies)** | AUDIT, all clients |
| Avatar platforms | Ready Player Me shut down 2026-01-31: no vendor lock-in for avatars | FRONTEND_MOBILE §12 |

## Appendix G — Glossary

| Term | Meaning |
|---|---|
| **Slice** | A vertical capability owning its domain, data, contracts, UI module, tests and spec folder |
| **Contract** | A published interface (API, event, route table, permission catalog) consumed by other slices/clients |
| **Control plane** | Hooks, settings, role/ownership policy, signing/update keys, release workflows: human-owned |
| **Constitution check** | The invariants table filled in every plan |
| **Loop / graph / orchestrator** | Bounded agent run / wired loops with explicit state and routing / the system that schedules and supervises many runs |
| **Node / edge / join** | A unit of work / allowed next step / merge of parallel results |
| **Static vs dynamic graph** | Topology fixed in reviewed config vs created at runtime within policy |
| **Admission control** | Limiting new work to available verification capacity |
| **Evidence bundle** | Per-release artifacts proving builds, tests, scans, approvals |
| **Floor device** | The lowest supported hardware profile used for budgets |
| **`(verify)`** | A dated or version-specific claim tracked in the register |
