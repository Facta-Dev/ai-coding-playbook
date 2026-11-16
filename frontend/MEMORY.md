# MEMORY.md - `<app>` premise

Durable, versioned premise for every session. Keep it under ~100 lines: facts
an agent cannot derive quickly from the code, not a copy of the code.

## Product

`<app>` is a React 19 web SPA (Vite + TypeScript) that talks to a backend
through `src/sdk/`. It is a **public client**: no client secret, no token at
rest - the access token arrives at runtime through the `TokenStore` port. The
MVVM split is strict: a View renders and forwards events, a ViewModel holds
presentation state and commands, the SDK is the only thing that talks to the
backend.

## Layers

| Layer            | Owns                                                        | Notes                              |
| ---------------- | ----------------------------------------------------------- | ---------------------------------- |
| `src/core/`      | ports + pure types                                          | imports nothing                    |
| `src/sdk/`       | the typed API client + the web fetch transport              | imports core only, never React     |
| `src/viewmodels/`| presentation state + commands                               | imports sdk + core, never React    |
| `src/views/`     | the React hook binding + the components                     | imports viewmodels + core, not sdk |
| `src/App.tsx`    | the composition root                                        | the one place allowed to touch all |

The dependency direction is `views -> viewmodels -> sdk -> core`, pinned by
the vitest architecture test in `tests/architecture/architecture.test.ts`.
ESLint forbids `react` / `react-dom` / `react-native` in `core`, `sdk` and
`viewmodels`, and `react-native` in `views`.

## Ports

`src/core/ports.ts` declares the four platform ports the shared layers depend
on: `Transport` (the HTTP-like adapter, `src/sdk/fetch-transport.ts` on web),
`TokenStore` (the access token, never the refresh token), `Navigator`
(routing without a router library) and `Notifier` (user-visible messages,
keyed by message id). The composition root supplies the web adapters; tests
inject fakes.

## The SDK

`createSdk` in `src/sdk/index.ts` maps `sdk.app.funnels.leads` to
`/api/v1/app/funnels/leads`. Every call returns `Result<T, SdkError>`, never
throws for an expected failure. The typed `SdkError` envelope (in
`src/core/types.ts`) is `unauthenticated`, `forbidden`, `not-found`,
`conflict`, `validation`, `rate-limited`, `network`, `server`. A ViewModel
maps it to a status and a message key and never inspects raw HTTP.

## The example feature

The one feature shipped end to end is the **lead detail** screen. The
ViewModel exposes the `loading`, `ready`, `forbidden`, `not-found` and
`error` statuses plus `moveToStage` and `openCampaign`; the View renders all
of them. Replace it with your own domain, keeping the layering.

## Routes

`src/core/routes.ts` builds every path: `routes.app.lead(leadId)` and
`routes.app.campaign(campaignId)`. Views and ViewModels never concatenate a
URL by hand. The web route tree and the SDK namespace both mirror
`PLAYBOOK_URLS.md`.

## Test tiers

| Tier         | Where                                  | Scope                                            |
| ------------ | -------------------------------------- | ------------------------------------------------ |
| unit         | `tests/unit/{core,sdk,viewmodels,views}/` | pure functions, SDK shape, ViewModel statuses, View statuses, against fakes |
| architecture | `tests/architecture/`                  | the dependency-direction rules                    |

No test touches the network or a real browser. Every SDK resource ships a
contract test (request URL, method, headers, error mapping); every ViewModel
status is covered.

## Stack

Node **>= 24** - TypeScript **5.9** - React **19.3** - Vite **7.3** - Vitest
**5.1** - ESLint **9.39** + typescript-eslint **8.72** - Prettier **3.10** -
npm (with a committed `package-lock.json`). Runtime dependencies are exactly
`react` and `react-dom`.

## Gates

`make ci` (typecheck + lint + test + build) - `npm run evals`
(`node --test evals/contracts.test.mjs`) - `scripts/verify-template.sh`
(template factory only: it stages a renamed copy and runs every gate on it).

## Where the contracts live

`PLAYBOOK_FRONTEND.md` (architecture, MVVM, the SDK, the route contract) -
`PLAYBOOK_TESTS.md` - `PLAYBOOK_SECURITY.md` - `PLAYBOOK_URLS.md` -
`PLAYBOOK_AUDIT.md` - `PLAYBOOK_CLAUDE_CODE.md` - `AGENTS.md` (agent
workflow).

## Lessons

`.claude/learnings.jsonl` (created on the first `/learn`) records pitfalls,
patterns and preferences; grep it by `kind` before repeating similar work.
