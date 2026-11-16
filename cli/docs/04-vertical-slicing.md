# Vertical Slicing

A **slice** is one feature, cut end to end: its use case, its contract, its
argv handler and its tests. Slices are the unit of work, of review and of
ownership. The template ships exactly one, `greet`, as the reference.

## 1. The template's reduced form

The fuller slice shape is `src/features/<slice>/` with
`domain/ application/ adapters/{in,out}/ contracts/ viewmodels/ views/`
(`PLAYBOOK_CLI.md` section 3.4). The template demonstrates the same idea with
one use case spread across the three layers:

| Asset        | Owner of the `greet` slice                                   |
| ------------ | ------------------------------------------------------------ |
| Use case     | `src/core/greet.ts` (`greet`, `GreetPorts`)                 |
| Contracts    | `src/core/contracts.ts` (the envelope, the exit-code table) |
| Inbound      | `src/adapters/cli.ts` (the `greet` argv handler)            |
| Wiring       | `src/bin/main.ts` (maps the envelope to stdout/stderr + exit code) |

Two slices never share an exit code's meaning, never share an output schema
and never import each other. The ESLint rule `no-restricted-imports` blocks
the adapters from reaching the bin entry, and blocks the core from reaching
anything but the stdlib; `tests/architecture.test.ts` asserts the same walls.

## 2. The anatomy of a slice

In the fuller shape (`PLAYBOOK_CLI.md` section 3.4) a slice is sealed behind
a barrel the composition root imports from. In the template, the "barrel" is
the core module itself: `src/bin/main.ts` imports `greet` and the contracts
from `src/core/`, never from a layer inside it.

## 3. Where the shared code goes

| Need                       | Home                                   |
| -------------------------- | -------------------------------------- |
| A shape scripts must agree on | `src/core/contracts.ts` (the envelope) |
| A stable exit code         | `src/core/contracts.ts` (`ExitCode`)   |
| A use case                 | `src/core/<feature>.ts`                |
| An argv/stdio concern      | `src/adapters/`                        |
| A rule two features share  | Extract it into `src/core/` - never across slices |

The kit does not ship a "shared features" folder on purpose: the moment two
slices need the same code, that code was not slice code.

## 4. Adding a slice

The `add-command` skill (`.claude/skills/add-command/SKILL.md`) and the
`/add-command` command carry the full recipe. The short version, for the
template's reduced form:

1. Write the use case in `src/core/<feature>.ts`, returning an `Envelope`.
2. Add its exit-code mapping and output schema to `src/core/contracts.ts`.
3. Add the argv handler in `src/adapters/cli.ts` (or a sibling file).
4. Wire the command in `src/bin/main.ts`.
5. Write the tests under `tests/`.

**Gate**: `make ci`.

## 5. Worked example

The `greet` slice is reached from one end:

```ts
// src/bin/main.ts
import { parseArgv } from "../adapters/cli.js";
import { greet } from "../core/greet.js";
import { ExitCode } from "../core/contracts.js";
```

The composition root shares the slice's types but never its internals, and it
is the only place the layers meet.

## Do / Don't

| Do                                              | Don't                                                        |
| ----------------------------------------------- | ------------------------------------------------------------ |
| Give every feature its own use case module      | Fold two features into one use case                          |
| Import a slice through its module               | Import a layer from another slice's internals                |
| Put a shared contract in `src/core/contracts.ts` | Duplicate the envelope shape in a handler                   |
| Add a slice with its own tests                  | Extend the `greet` slice with an unrelated feature            |

## See also

- [Layers & Ports](03-hexagonal-layers-and-mvvm.md)
- [Directory Structure](05-directory-structure.md)
- [Playbooks](13-playbooks.md)
