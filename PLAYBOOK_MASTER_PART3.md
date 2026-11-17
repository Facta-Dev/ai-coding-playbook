---
id: MASTER_PART3
version: 1.0.0
status: active
last_reviewed: 2026-11-16
review_cadence_days: 30
owner: architecture + engineering-productivity
depends_on: [MASTER]
---

# PLAYBOOK_MASTER_PART3 — Master playbook: the constitution of the playbook set and the Claude Code operating model (part 3)

> Part 3 of 3. Main entry: [`PLAYBOOK_MASTER.md`](PLAYBOOK_MASTER.md). Covers: 6. Standard graphs (recipes) … Appendix G — Glossary.

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

The `tdd_loop` node is itself a loop (`PLAYBOOK_CLAUDE_CODE_PART2` §10): test-writer → RED (recorded) → implementer → GREEN → refactor, with a budget and the Stop gate.

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
| **Realtime feature** | DESKTOP_QT_PART2 §8 → BACKEND (Connecting slices) → client playbook (mobile §14 / CLI §7.3 / extension) | Conformance suite, resync, backpressure |
| **Web UI feature** | FRONTEND → URLS (guards) → TESTS (Frontend) | ViewModel statuses, a11y, parity |
| **RN mobile feature** | FRONTEND_MOBILE → FRONTEND | Low-tier path, push/deep-link tests, store checklist |
| **Android native** | MOBILE_ANDROID_KOTLIN → FRONTEND_MOBILE | Baseline profile, vitals, 16 KB, Android 17 checklist |
| **iOS native** | MOBILE_IOS_SWIFT → FRONTEND_MOBILE | Views in code, privacy manifest, MetricKit gates |
| **Desktop (Qt)** | DESKTOP_QT | Floor-profile perf, signing/updater suites |
| **Chrome extension** | CHROME_EXTENSION → FRONTEND | Permission diff, SW lifecycle tests |
| **CLI/TUI** | CLI | stdout/stderr + exit-code contract, PTY e2e, 3-OS matrix |
| **Java backend** | JAVA_J2EE → BACKEND → SECURITY | ArchUnit/Enforcer, Testcontainers, JFR |
| **Auth/onboarding/forgot password** | FRONTEND_MOBILE §7 (+ platform §7) → SECURITY (Authentication) → URLS | Uniform responses, single-use tokens, MFA/step-up, deletion |
| **Push notifications** | FRONTEND_MOBILE_PART2 §8 (+ platform §8) → SECURITY | Payload schema, channels, token lifecycle, deep-link allowlist |
| **Payments/marketplace** | FRONTEND_MOBILE_PART2 §11 → SECURITY → AUDIT (vendors, PCI scope) | Server-authoritative pricing, idempotent checkout |
| **Avatar/voice/3D** | FRONTEND_MOBILE_PART2 §12–§13 → AUDIT (Privacy) → SECURITY | Consent, retention, AI disclosure, asset budgets |
| **Game/location** | FRONTEND_MOBILE_PART2 §10 → AUDIT (Privacy) → SECURITY | Server authority, anti-cheat signals, battery budgets |
| **Infra/CI/CD change** | SECURITY (Infrastructure, Supply chain, Secrets) → AUDIT (Operational controls) → CLAUDE_CODE (control plane) | Human review; signing isolation |
| **Audit/evidence/compliance** | AUDIT → TESTS §10 | Control mapping, evidence retention |
| **Kit/agents/skills/hooks change** | CLAUDE_CODE → MASTER_PART2 §4–§5 | Registry validation, evals, CODEOWNERS |
| **Playbook change** | MASTER_PART3 §9 | `playbook-lint`, owner review, changelog |

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

Capture → triage → promote (`PLAYBOOK_CLAUDE_CODE_PART2` §13) applies to playbooks: corrections and review overturns that point to a missing/ambiguous rule become **proposals** against a playbook, are linted, reviewed by the owner, and merged with a version bump; recurring defects become upstream controls (tests, hooks, lint rules) rather than longer prose.

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
| Anthropic multi-agent research | Lead + parallel subagents outperformed a single-agent baseline by a large margin at ~15× tokens; early over-spawning | MASTER_PART2 §4.7 |
| React Native / Expo | RN 0.88 (Oct 2026); Expo SDK 58; New Architecture only; Hermes V1 default since 0.84; SDK 56 Hermes V1 memory regression fixed in later patches | FRONTEND_MOBILE |
| Android | Android 17 (API 37) released June 2026; Play target API 36 from 2026-08-31; Compose 1.12 requires `compileSdk 37` + AGP 9.1.1; Navigation 3 1.0; AndroidX `minSdk` 24; RAM-based app memory limits in Android 17; 16 KB page-size enforcement dates **(verify)** | MOBILE_ANDROID_KOTLIN |
| Apple | Xcode 27.2 / Swift 6.4.x; iOS 27 (Sep 2026); App Store floor Xcode 26 (since 2026-04-28); SceneKit soft-deprecated; iOS 27 reportedly supports all iOS 26 devices **(verify)** | MOBILE_IOS_SWIFT |
| Qt | Qt 6.12 LTS (2026-09-30); 6.8 LTS to Oct 2029; no first-party SSE client assumed **(verify)** | DESKTOP_QT |
| Chrome | MV3 only; WXT recommended; Plasmo in maintenance mode | CHROME_EXTENSION |
| Java/Jakarta | Jakarta EE 11 current; EE 12 Core Profile target Q4 2026, Web/Platform Q1–Q2 2027; JDK 25 LTS, JDK 27 GA 2026-09-14 | JAVA_J2EE |
| CLI ecosystem | Claude Code (TS + React/Ink fork), Gemini CLI (TS + Ink), Codex CLI (Rust/ratatui), Crush (Go/Bubble Tea v2) | CLI |
| Security | OWASP Top 10:2025 (SSRF merged into Broken Access Control; Supply Chain Failures added) | SECURITY |
| Regulation/standards | EU CRA reporting from 2026-09-11, most obligations 2027-12-11; ISO 9001:2026 published 2026-09-16 with transition to 2029-09-30 **(confirm with counsel/certification bodies)** | AUDIT, all clients |
| Avatar platforms | Ready Player Me shut down 2026-01-31: no vendor lock-in for avatars | FRONTEND_MOBILE_PART2 §12 |

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
