---
name: "new-policy-key"
description: "Adds one enterprise policy key to the <app> policy schema: the zod schema, the resolver default, the renderer status it can produce, the docs and the tests, with the registry/plist parity the enterprise story requires."
division: core
---

# `<app>` new-policy-key skill

> Reusable workflow for adding one managed-configuration key to the `<app>`
> policy schema. An agent invokes this skill; the requester supplies the
> control, the skill supplies the schema, the default and the tests.

## When to Activate

Activate this skill when an administrator needs to control a new behaviour of
`<app>`: a new feature flag, a new limit, a new toggle the operator can pin
from the registry (Windows), a plist (macOS) or the policy file (Linux).

Do NOT activate this skill when:

- The change is a runtime feature toggle only the user controls — that is a
  setting, not a policy key.
- The key only makes sense as a build or packaging value — that is config, not
  managed configuration.
- The request is to change an existing key's semantics — rewrite the key with
  an ADR instead of mutating it silently.

## Core Principles

- **Schema first, everything derived.** The key exists because
  `src/contracts/policy.ts` declares it; the resolver, the reader and the UI
  all consume the schema, never a parallel constant.
- **Fail closed with a named status.** A policy-blocked behaviour is surfaced
  as a status the user can see (`PolicyBlocked`), not as a silent disable.
- **Default = the unset behaviour.** The resolver default must be what the app
  does today with no policy installed; a key that changes behaviour when
  absent is a breaking change.
- **Same keys, all transports.** The registry/plist/file forms carry the same
  key names as the schema; `additionalProperties: false` is kept so unknown
  keys are rejected, not ignored.
- **The docs and the tests are part of the key.** A key without its schema
  test, resolver test and docs entry is half a key.

## Rules

- `src/contracts/policy.ts` gains the key with its type enum (mirroring the
  existing `RealtimeMode`, `HardwareAcceleration` and `TelemetryLevel`
  style); booleans become `DevToolsEnabled`-/`KillSwitch`-style keys only when
  the existing shape has one.
- `src/infrastructure/policy/` gains the resolver default and, where needed,
  the reader logic; no policy decision is made outside this layer.
- The behaviour the key guards checks the resolved value through its port; the
  renderer receives the outcome as status, never reads policy directly.
- The schema test in `tests/infrastructure/policy-resolver.test.ts` covers
  absent, valid and invalid forms, including `additionalProperties` rejection.
- The docs (`docs/admin-guide.md`, `permissions-register.md` where relevant)
  are updated in the same change; no fabricated claim about an OS transport —
  mark anything unconfirmed `(verify)`.
- No step is "done" until `pnpm typecheck`, `pnpm lint`, `pnpm test` and
  `pnpm evals` are green; run them and report the real output.

## Research References

| Claim | Source | Year | Link |
|-------|--------|------|------|
| Managed configuration: schema, transports and resolution order | `PLAYBOOK_DESKTOP_ELECTRON.md` §13.1, Appendix H | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| Kill switch, flags and diagnostics rules | `PLAYBOOK_DESKTOP_ELECTRON.md` §13.3 | - | `PLAYBOOK_DESKTOP_ELECTRON.md` |
| The policy contract to extend | `src/contracts/policy.ts` | - | `src/contracts/policy.ts` |
| The resolver and reader to extend | `src/infrastructure/policy/` | - | `src/infrastructure/policy/resolver.ts` |

## Output Format

```
Key: <name> — type: <enum values> — default: <value>
Schema: src/contracts/policy.ts — <delta, additionalProperties kept>
Resolution: src/infrastructure/policy/ — default, source order, invalid behaviour
Behaviour: <what guards on it, which renderer status appears>
Tests: <schema, resolver, behaviour cases — counts>
Docs: <admin-guide/permissions-register entries>
Gates: pnpm test → <result>, pnpm evals → <result>
(verify): <transport or OS claims needing source confirmation, or none>
```
