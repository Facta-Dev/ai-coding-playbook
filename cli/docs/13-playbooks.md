# Playbooks

Repeatable recipes for the changes you will make most. Each: the steps, the
files touched and the gate that proves it. If a change touches more files than
listed, the architecture regressed - investigate before proceeding.

## 1. Add a command (a new use case)

1. `src/core/<feature>.ts`: the use case, returning an `Envelope`. No
   `process`, no `node:`, no streams.
2. `src/core/contracts.ts`: any new exit-code mapping and output shape. The
   envelope stays one shape; a change bumps `ENVELOPE_VERSION`.
3. `src/adapters/cli.ts`: the argv handler for the new command, returning a
   `CliParse` `Result`.
4. `src/bin/main.ts`: wire the command and its exit-code mapping.

**Gate**: `make ci`, plus a use-case test (`tests/<feature>.test.ts`) and an
adapter test for the new flags.

## 2. Change a stable contract (an exit code, an output shape, a flag)

1. `src/core/contracts.ts`: the table or the envelope. A changed meaning is a
   versioned breaking change.
2. Every consumer of the surface, updated in the same change.
3. A golden fixture (or the equivalent test assertion) that asserts the new
   mapping or shape.

**Gate**: `make ci` and `npm run evals`; route the change through the
`exit-code-contract` skill.

## 3. Add an adapter (a new process concern)

1. `src/adapters/`: the new adapter, the only place that names the `node:`
   builtin it wraps.
2. The port it implements, declared in `src/core/` if the use case needs it.
3. An architecture or adapter test that the boundary still holds.

**Gate**: `make ci` - the architecture test fails if the `node:` call leaks
into `src/core/`.

## 4. Start a project from the template

1. Copy the kit and run `bash scripts/rename.sh <app-slug> <org-scope>`.
2. `npm install`, then `npm run build`.
3. `make ci` - the gates must be green before you change anything.
4. Replace the `greet` use case with your own; keep the layering.
5. `bash scripts/verify-template.sh` proves the template itself is still sound.

**Gate**: `make ci` and `bash scripts/verify-template.sh`.

## 5. Add a durable record (when the project grows one)

1. Define the record shape with a schema version.
2. Write a pure `(vN) → (vN+1)` migration and a fixture of the previous
   version.
3. One writer per store, through a serialized queue; a corrupt record is
   dropped and backed up, never thrown.

**Gate**: `make ci`; see [Storage & Migrations](08-storage-and-migrations.md).

## Do / Don't

| Do                                                              | Don't                                        |
| --------------------------------------------------------------- | -------------------------------------------- |
| Follow the recipe; a longer diff means the architecture changed | Add a shortcut "just this once"              |
| Bump the envelope version in the same change as a shape change  | Change an output shape silently              |
| Keep the `process` call in the adapters                         | Import `node:` into a use case                |
| Run `make ci` before declaring a change done                    | Run only the tests you wrote                 |

## See also

- [Layers & Ports](03-hexagonal-layers-and-mvvm.md)
- [Vertical Slicing](04-vertical-slicing.md)
- [Testing & CI](12-testing-and-ci.md)
