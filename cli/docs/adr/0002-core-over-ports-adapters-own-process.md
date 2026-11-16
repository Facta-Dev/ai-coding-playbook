# ADR 0002 - Core over ports, adapters own the process

- **Status**: Accepted
- **Date**: 2026
- **Scope**: the layer boundary of the CLI template

## Context

A scriptable CLI has two kinds of code that change for different reasons: the
product rules (what a command does) and the mechanism (how it talks to the
process). If the two are mixed, a use case reaches for `process.stdout`
directly, a test needs a real terminal, and a change to the streams or the
exit codes leaks into the product rules.

The template's core has to:

- keep every use case a pure function over consumer-owned ports, so a test
  injects a fake clock and never touches the process;
- keep every `process` and `node:` call in one layer, so the boundary is
  checkable statically;
- keep a single file that wires the layers, so the composition root is the
  only place the mechanism and the rules meet.

## Decision

**Split the source into `src/core/` (pure), `src/adapters/` (the process
boundary) and `src/bin/` (the composition root), and enforce the direction
with ESLint plus a static architecture test.**

```text
src/core/       # pure: contracts.ts (envelope, exit codes), greet.ts (use case)
src/adapters/   # cli.ts (argv), io.ts (stdio) - the only process/node: owner
src/bin/        # main.ts - wires argv -> core -> io -> exit code
```

`src/bin/main.ts` supplies the real clock (`Date.now`) and the real streams
(`nodeIo()`); a test supplies frozen ones. `eslint.config.mjs` forbids `node:`
and `process` inside `src/core/` and forbids the adapters from importing the
bin entry; `tests/architecture.test.ts` asserts the same walls so they fail as
a test, not only as a lint opinion.

## Alternatives considered

| Option                                          | Why not                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| One flat `src/` with no layer rules             | A use case reaches the process directly; a test needs a terminal; the boundary is unenforceable |
| The full playbook layers (domain/application/adapters/platform) | More folders than the template needs; the playbook is the target a real product grows into |
| `process` allowed everywhere, guarded by review  | Review is not a gate; the rule must fail the build to hold                                    |
| A mocking library for the streams                | A five-line fake implements the port; a framework is a dependency for no gain                 |

## Consequences

- A use case (`greet`) is testable with a frozen clock and an in-memory `Io`.
- The boundary is mechanical: a new `node:` import in `src/core/` fails both
  `npm run lint` and `npm run test`.
- The composition root is the single source of truth for what is wired; a new
  command is added there and nowhere else.
- The template is a reduced form of `PLAYBOOK_CLI.md` section 3; a project
  that outgrows three folders adopts the full layers without changing the
  discipline.

## See also

- [ADR 0001 - TypeScript + Node stdlib, no bundler](0001-typescript-and-node-stdlib-no-bundler.md)
- [Layers & Ports](../03-hexagonal-layers-and-mvvm.md)
- [Messaging & the Stream Contract](../07-messaging-and-sender-validation.md)
