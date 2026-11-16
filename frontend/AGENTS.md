# `<app>` - agent instructions

Operating instructions for any coding agent working in this repository
(Claude Code, Codex, Cursor, Aider, Gemini ...). `<app>` is a React 19 web
SPA skeleton: Vite + TypeScript, MVVM with a shared SDK, layer walls enforced
by ESLint and a vitest architecture test, and a single example feature (the
lead detail screen) you replace with your own.

`CLAUDE.md` is a symlink to this file. Keep one source of truth.

## Hard rules

- **English only** in code, comments, UI copy, docs, test names and tool
  descriptions. No Spanish anywhere in the repo.
- **`make ci` green before you declare a change complete.** Plausibility is
  not correctness: read the output.
- **Never fabricate** paths, API names, env vars, test results or commit
  hashes. Read the file or run the command.
- **Touch only what the request needs.** No drive-by refactors.
- **Never use an em dash.** ASCII hyphens only, everywhere.

## Never

- **No React outside the View and the hook binding.** `src/core/`,
  `src/sdk/` and `src/viewmodels/` never import `react`, `react-dom` or
  `react-native`; ESLint fails the build when they do. The relative-import
  direction (views -> viewmodels -> sdk -> core) is pinned by the vitest
  architecture test.
- **No hand-written path strings.** A route is built in exactly one place,
  `src/core/routes.ts`; the SDK namespace mirrors the URL playbook. Views and
  ViewModels never concatenate a URL by hand.
- **No raw HTTP outside the SDK.** A ViewModel never sees a status code or a
  fetch: it reads the typed `SdkError` half of a `Result`.
- **No secrets.** Nothing sensitive in the bundle, the logs or the `.env`.
  The SPA is a public client: the access token arrives at runtime through the
  `TokenStore` port, never baked into the build.
- **No remote code.** No `eval`, no `new Function`, no script fetched from a
  URL.

## Layout

```
<app>/
├── src/
│   ├── core/                     # ports + pure types: imports nothing
│   │   ├── ports.ts              #   Transport, TokenStore, Navigator, Notifier
│   │   ├── types.ts              #   Lead, Stage, SdkError, LeadId
│   │   ├── result.ts             #   Result<T, E>
│   │   └── routes.ts             #   the one place that builds a path
│   ├── sdk/                      # the typed API client: imports core only, never React
│   │   ├── index.ts              #   createSdk, the typed SdkError mapping
│   │   └── fetch-transport.ts    #   the web Transport adapter (fetch)
│   ├── viewmodels/               # presentation state + commands: no React, no JSX
│   │   └── lead-detail-view-model.ts
│   ├── views/                    # the React hook binding + the components
│   │   ├── useLeadDetailViewModel.ts
│   │   └── LeadDetailView.tsx
│   ├── App.tsx                   # the composition root: the one place that wires all layers
│   ├── main.tsx                  # the browser entry point
│   └── styles.css
├── tests/
│   ├── unit/{core,sdk,viewmodels,views}/   # hermetic unit tests, fakes only
│   └── architecture/architecture.test.ts  # the dependency-direction test
├── evals/                        # native contract tests (node --test) + frozen fixtures
├── scripts/                      # rename · verify-template · lint-* · leak-guard
│                                 # · instruction-budget · install-claude-runtime
│                                 # · hooks/guard-bash.sh
├── .claude/                      # agents · skills · commands · schemas · settings · manifest
├── PLAYBOOK_*.md                 # six local contracts - read on demand
├── AGENTS.md                     # agent instructions; CLAUDE.md is a symlink to it
├── MEMORY.md                     # durable premise: layers, ports, the SDK, the gates
├── Makefile                      # install · ci · build · typecheck · lint · test · evals · verify
└── package.json · vite.config.ts · vitest.config.ts · tsconfig*.json
```

## The layers and their rules

| Layer              | May import              | Must not import                     |
| ------------------ | ----------------------- | ----------------------------------- |
| `src/core/`        | nothing but itself      | React, the SDK, the ViewModels      |
| `src/sdk/`         | `core`                  | React, the ViewModels, the Views    |
| `src/viewmodels/`  | `core`, `sdk`           | React, `react-dom`, the Views       |
| `src/views/`       | `core`, `viewmodels`    | the SDK                             |
| `src/App.tsx`      | every layer             | nothing (it is the composition root) |

Three invariants make the walls hold, and each one has a machine check:

1. **`core`, `sdk` and `viewmodels` are React-free.** ESLint
   (`no-restricted-imports`) forbids `react`, `react-dom` and `react-native`
   in those folders; `src/views/` is additionally forbidden `react-native`.
2. **Dependencies point inward.** The vitest architecture test resolves every
   relative import to the layer it targets and fails on a forbidden edge:
   `views -> viewmodels -> sdk -> core`.
3. **The SDK is the only thing that talks to the backend.** Every backend
   call crosses `src/sdk/`; a View or ViewModel that reaches for `fetch`
   directly breaks the trust model.

## Gates

```sh
make ci                  # npm typecheck + lint + test + build
npm run typecheck        # tsc -p tsconfig.json + tsconfig.test.json, no emit
npm run lint             # eslint . (type-aware rules + the React-free walls)
npm run test             # vitest run (unit + architecture)
npm run build            # vite build -> dist/
npm run evals            # node --test evals/contracts.test.mjs (native, zero deps)
npm run format           # prettier --write .   (npm run format:check to verify)
bash scripts/verify-template.sh   # stages a renamed copy and runs every gate on it
```

`npm install` regenerates `package-lock.json`, which is committed in this kit
(unlike the pnpm siblings). Run `make install` or `npm install` from the
renamed copy, never in the template root before `scripts/rename.sh`.

## The TDD loop

Spec -> plan -> red -> green -> refactor:

1. `/spec` writes `docs/specs/<slug>.md` (behaviour, acceptance criteria,
   non-goals, open questions); `/plan` writes `docs/plans/<slug>.md`
   (problem, constraints, design, files, risks, tests, steps).
2. `/add-slice` or `/add-route` scaffolds the shape (a View, a ViewModel, an
   SDK resource, a route).
3. Write the failing test first (`/tdd-guide`, `test-author`): a ViewModel
   test against a fake SDK and fake ports, or an SDK contract test against
   the request shape. Watch it fail for the right reason - a missing symbol,
   not a typo.
4. Implement the minimum that makes it pass, then refactor with the suite as
   the safety net.
5. `/review` for the pre-landing checklist; `make ci` before declaring done.

Every SDK resource ships with a contract test that asserts the request URL,
method and headers, and the typed `SdkError` mapping. Every ViewModel status
(`loading`, `ready`, `forbidden`, `not-found`, `error`) is covered by a test.

## Who edits what

| Area                                                                             | Owner                                        |
| -------------------------------------------------------------------------------- | -------------------------------------------- |
| `docs/plans/`, `docs/specs/`                                                     | `planner`, `architect`                       |
| `tests/**`                                                                       | `test-author`                                |
| `src/views/**`, `src/viewmodels/**`, `src/sdk/**`                                | implementers (`build-resolver`, `tdd-guide`) |
| `src/core/**`, `src/App.tsx`, `package.json`, `vite.config.ts`, `eslint.config.mjs` | shared - integrator role                 |
| `.claude/settings.json`, `.claude/manifest.json`, `.claude/schemas/**`, `scripts/**` | human only; an agent writes a proposal under `.claude/proposals/` |

## Multi-session rules

- One worktree per (feature, spec); name sessions `<feature>:<spec-id>`.
- Do not edit a feature claimed by another session - message its owner
  instead.
- Changing a shared shape (a `core` type, a port, the SDK namespace)?
  Message the dependents and tell the integrator.
- Never force-push a shared branch.

## Native `.claude` layer

`.claude/agents/` ships the roster across four divisions (`core`, `client`,
`security`, `testing`). `.claude/skills/` + `.claude/commands/` ship
reusable workflows; every command is a thin shim delegating 1:1 to the skill
of the same slug. New slugs are discovered by walking the tree - no registry
edit. `scripts/lint-agents.sh`, `lint-skills.sh` and `lint-commands.sh`
validate the tree against `.claude/schemas/`.

Skills: **`/spec`** (file the spec), **`/plan`** (write the plan),
**`/review`** (the pre-landing checklist), **`/ship`** (release PR;
user-invoked only), **`/learn`** (append a lesson), **`/add-slice`**
(scaffold a feature), **`/add-route`** (a route + its guard), **`/tdd`**
(the red-green loop), **`/sdk-contract`** (a typed SDK resource),
**`/state-contract`** (the ViewModel state machine).

## Playbooks

Six local contracts ship next to this file: `PLAYBOOK_FRONTEND.md`
(architecture, MVVM, the SDK, the route contract), `PLAYBOOK_TESTS.md`,
`PLAYBOOK_SECURITY.md`, `PLAYBOOK_URLS.md`, `PLAYBOOK_AUDIT.md` and
`PLAYBOOK_CLAUDE_CODE.md`.

They are **restrictions, not suggestions**: a change that contradicts one is
wrong until the playbook changes in the same pull request. They load **on
demand only**: adopt one by adding a rule under `.claude/rules/` whose
`paths:` frontmatter names the files it guards and whose body names the
playbook - then read that playbook before editing those files. Never
`@`-import a playbook: the always-on set (this file plus the path-less rules)
must stay inside the harness budget, and `scripts/instruction-budget.sh`
fails the build when it does not.

## Learnings

`.claude/learnings.jsonl` is an append-only, project-local log of pitfalls,
patterns and preferences discovered while working on `<app>` (created on the
first `/learn`). Grep it by `kind` before repeating work that resembles a
logged pitfall.

## Conventions

- Errors are values (`Result<T, SdkError>`), never exceptions thrown across a
  layer boundary; the envelope lives in `src/core/types.ts`.
- `crypto.randomUUID()`, never `Math.random`, for anything that must be
  unique.
- The composition root (`src/App.tsx`) is the only file that touches every
  layer; it contains no rules of its own.
- This project was instantiated from a template: the three substitution
  tokens documented in `scripts/rename.sh` were replaced at instantiation
  time. If one survives verbatim outside the frozen fixtures, it is a bug,
  not a template artifact.
