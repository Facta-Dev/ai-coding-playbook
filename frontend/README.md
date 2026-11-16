# <app> Frontend Stack Kit

This is the `<app>` frontend stack kit for the ai-coding-playbook: a runnable
React 19 web SPA template (Vite, TypeScript, vitest) built on the frontend
doctrine of `PLAYBOOK_FRONTEND.md` and `PLAYBOOK_URLS.md`, plus the `.claude`
plane (agents, skills, commands) that enforces it.

The template is runnable as shipped: `npm install`, `npm run lint`,
`npm run test` and `npm run evals` all pass, and `bash scripts/verify-template.sh`
exercises the full gate on a throwaway copy. The only thing you must do before
starting a real project is rename the placeholders (see "How to apply").

## Layout

```text
src/
  core/          ports (Transport, TokenStore, Navigator, Notifier) and pure
                 types (Lead, Stage, SdkError) - imports nothing
  sdk/           the typed API client (createSdk) and the web fetch transport -
                 imports core only, never React
  viewmodels/    presentation state + commands (createLeadDetailViewModel) -
                 imports sdk and core, never React or JSX
  views/         the React hook binding and the components - imports
                 viewmodels and core, never the SDK
  App.tsx        the composition root: wires the web adapters, SDK and
                 ViewModel together (the one place allowed to touch all layers)
  main.tsx       the browser entry point
tests/
  unit/          hermetic unit tests: core routes, SDK shape and error
                 mapping, ViewModel statuses and commands, View statuses
  architecture/  dependency-direction tests (views -> viewmodels -> sdk ->
                 core), enforced per relative import
evals/           the native contract harness for the .claude layer
                 (node --test, zero dependencies) plus the frozen fixtures
scripts/         the pure-bash install, lint, leak-guard and verify machinery
.claude/         agents, skills, commands and schemas for the playbook
docs/            the numbered handbook (00-14) plus two ADRs
AGENTS.md        agent-agnostic instructions; CLAUDE.md is a symlink to it
MEMORY.md        the durable premise: layers, ports, the SDK, the gates
.env.example     the build-time VITE_ variables (shape only, no values)
PLAYBOOK_*.md    six local contracts, byte-identical to the de-branded root
```

The one feature shipped end to end is the **lead detail** screen (the
PLAYBOOK_FRONTEND section 8 example): `sdk.app.funnels.leads` mirrors
`/api/v1/app/funnels/leads`, the ViewModel exposes the `loading`, `ready`,
`forbidden`, `not-found` and `error` statuses, and the View renders all of
them.

## The kit files

- **`AGENTS.md`** is the agent-agnostic instruction file (Claude Code, Codex,
  Cursor, Aider ...): the hard rules, the layer table, the gates, the TDD
  loop and the playbook loading rules. `CLAUDE.md` is a relative symlink to
  it, exactly like the sibling kits.
- **`MEMORY.md`** is the durable premise for every session: the layers, the
  ports, the SDK namespace, the example feature, the test tiers and the
  gates.
- **`.env.example`** names the one build-time variable (`VITE_API_BASE_URL`)
  and no values. Only `VITE_`-prefixed names reach the bundle; no secret is
  baked in - the access token arrives at runtime through the `TokenStore`
  port.
- **`docs/`** is the numbered handbook: chapters 00-14 plus a README index
  and two ADRs (Vite as the build; npm and the committed lockfile). The
  extension-specific topics that do not apply to a web SPA (the service
  worker, the manifest, the message protocol, the storage layer, the admin
  policy) each state that explicitly rather than being deleted.
- **`PLAYBOOK_*.md`** are six local contracts copied byte-identical from the
  de-branded root: `PLAYBOOK_FRONTEND.md` (the class specialty),
  `PLAYBOOK_TESTS.md`, `PLAYBOOK_SECURITY.md`, `PLAYBOOK_URLS.md`,
  `PLAYBOOK_AUDIT.md` and `PLAYBOOK_CLAUDE_CODE.md`. They are restrictions,
  not suggestions, and they load on demand through path-scoped rules, never
  via `@`-import.

## The .claude plane

`.claude/agents/` ships the roster across four divisions (`core`, `client`,
`security`, `testing`), including the two core explorers and guides
(`code-explorer`, `tdd-guide`). `.claude/skills/` + `.claude/commands/` ship
the workflows 1:1: the five SDD core skills (`spec`, `plan`, `review`,
`ship`, `learn`) plus the frontend-specific ones (`add-slice`, `add-route`,
`sdk-contract`, `state-contract`, `tdd`, `claim-check`, `clean-room-rebuild`,
`corpus-retrieval`, `diagnosing-bugs`, `domain-modeling`, `grilling`,
`research`, `verified-status`, `visual-review`). Every command is a thin shim
delegating to the skill of the same slug; new slugs are discovered by walking
the tree.

## Gates

| Command | What it checks |
| --- | --- |
| `npm install` | installs dependencies and regenerates `package-lock.json` |
| `npm run typecheck` | `tsc --noEmit` over `src` and `tests` |
| `npm run lint` | ESLint 9 flat config: type-aware rules + the React-free layer walls |
| `npm run test` | vitest units + the architecture dependency-direction tests |
| `npm run evals` | the `.claude` contract suite (`node --test`) |
| `npm run build` | `vite build` bundles the SPA |
| `npm run ci` | typecheck + lint + test + build, in order |
| `bash scripts/verify-template.sh` | stages a throwaway copy, renames it, then runs every gate above on it |

`npm run lint` guards the external-module walls (the SDK, core and the
ViewModels never import React; this kit never imports `react-native`). The
relative-import direction between layers is guarded by the vitest
architecture test, which resolves each import to the layer it targets.

## How to apply

```bash
bash scripts/rename.sh myapp myorg   # substitutes <app>/<APP>/<scope>
npm install
make ci
```

`scripts/rename.sh` substitutes the three tokens textually (order
`<scope>` -> `<APP>` -> `<app>`), regenerates the lockfile via `npm install`,
and never renames directories.

## What is not included

- **CI workflows on GitHub** (`docs/00`-`14` if you follow the playbook's
  docset): this kit ships the local gates only; wire `npm run ci` and
  `bash scripts/verify-template.sh` into your CI runner.
- **The full SDK interceptor stack**: this client implements the auth header
  and the typed `SdkError` mapping; the tenant, correlation, idempotency and
  retry interceptors are left out on purpose.
- **Generated DTOs from OpenAPI**: the `Lead`/`Stage` types are hand-written
  in `src/core/types.ts`; a contract change is a typed edit here, not a
  generated model.
- **i18n**: user-visible strings are English literals in the View (the
  ViewModel exposes message keys like `lead.error.network`).
- **The mobile and extension clients**: this is the web SPA only. The
  ViewModel and SDK are platform-agnostic so they can be shared, but the
  native and extension kits are separate.

Install the `.claude` plane into a target repository with
`bash scripts/install-claude-runtime.sh --targets=claude,claude-project --dest=<repo>`,
or via the root `scripts/claude-kit/configure-repo.sh --kit=frontend`.

A capture harness ships at `scripts/shoot.py` (Playwright, headless Chrome as
fallback): desktop and mobile screenshots plus an early frame, with a JSON QA
report (console errors, failed requests, overflow, broken images, fonts, video
readiness). Adapted from the MotionSites claude-skill repository; MIT, see the
header in the file. It backs the `visual-review` skill.
