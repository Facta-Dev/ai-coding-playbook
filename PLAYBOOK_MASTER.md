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

## Parts

This playbook is split so each file stays navigable. Sections keep
their original numbers; a reference to a section not in this file lives in a
sibling part.

| Part | File | Covers |
|---|---|---|
| 1 | [`PLAYBOOK_MASTER.md`](PLAYBOOK_MASTER.md) | 1. The playbook set … 3. Cross-playbook invariants (the constitution) |
| 2 | [`PLAYBOOK_MASTER_PART2.md`](PLAYBOOK_MASTER_PART2.md) | 4. The Claude Code operating model … 5. Applying the kit to the playbook set |
| 3 | [`PLAYBOOK_MASTER_PART3.md`](PLAYBOOK_MASTER_PART3.md) | 6. Standard graphs (recipes) … Appendix G — Glossary |

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

A large playbook continues in `PLAYBOOK_<ID>_PART<n>.md`; the main entry opens
with a Parts index and keeps the original section numbers. The manifest has one
entry per part.
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
| I-10 | **Events**: transactional outbox; at-least-once; consumers idempotent; versioned envelopes; **realtime** is optional and degradable (`auto|websocket|sse|polling|off`), snapshot + stream, resume, resync | BACKEND §5/§7, DESKTOP_QT_PART2 §8 | realtime conformance suite |
| I-11 | **Client contract parity**: generated SDKs/DTOs from OpenAPI; generated route builders from the shared route table; shared permission catalog; shared i18n keys; hand-written paths/DTOs forbidden | FRONTEND §3, each client | parity tests |
| I-12 | **Device tiers and budgets**: `low|mid|high`, measured not assumed, runtime quality governor, floor-device testing; budgets calibrated per product | FRONTEND_MOBILE §3, DESKTOP_QT §2, CLI_PART2 §11 | device-pool perf gates |
| I-13 | **Push is a channel, not a data path**: minimal payloads, categories/channels, validated deep links, fetch after tap, reconcile on foreground | FRONTEND_MOBILE_PART2 §8 (+ Android/iOS §8) | push suite |
| I-14 | **Managed policy + kill switch + diagnostics bundle** on every shipped client (extension, desktop, CLI, mobile via remote config) | CHROME_EXTENSION_PART2 §12, DESKTOP_QT_PART2 §12, CLI_PART2 §8 | policy suites |
| I-15 | **Secrets and keys**: never in code, images, logs, bundles; OS keystore on clients; envelope encryption for tenant provider keys (write-only everywhere) | SECURITY §8, §13 | secrets scans; log-redaction tests |
| I-16 | **Supply chain**: lockfiles, frozen installs, cooldown for fresh versions, SCA/SBOM, signed artifacts, pinned CI actions, provenance | SECURITY §11 | CI gates |
| I-17 | **Sensitive data classes**: location, microphone/voice, camera/face-derived, tenant lead data, provider keys are *Restricted*: consent, minimization, retention, deletion cascade | AUDIT §13, SECURITY §8 | privacy suite |
| I-18 | **SDD + TDD**: spec with acceptance criteria and a constitution check before code; a failing test before production code; implementer cannot edit tests | CLAUDE_CODE_PART2 §9–§10 | hooks + CI |
| I-19 | **Evidence by default**: every release produces a bundle (builds, SBOM, test/perf/security reports, approvals, permission/entitlement diffs) | TESTS §10, AUDIT §8 | release gate |
| I-20 | **Control plane is human-owned**: hooks, settings, role/ownership policy, signing/update keys, CI release workflows; agents propose, humans apply | CLAUDE_CODE_PART2 §7, §14 | CODEOWNERS + guard hook |
| I-21 | **Every deviation is an ADR with an expiry** | MASTER §2 | `playbook-lint` |
| I-22 | **Compliance clocks are tracked**: EU CRA reporting obligations from 2026-09-11, most other obligations from 2027-12-11 (applicability confirmed with counsel); ISO 9001:2026 transition; store-policy deadlines | AUDIT §1, §14 | compliance calendar |

---

---

> Continues in [`PLAYBOOK_MASTER_PART2.md`](PLAYBOOK_MASTER_PART2.md).
