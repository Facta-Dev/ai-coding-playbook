# Testing & CI

The gates are the contract. A change is finished when `make ci` is green and
the template verification passes; a change to the kit's own agent runtime is
finished when the evals pass.

## 1. The test tiers

| Tier         | Tool           | What it covers                                              | Command                  |
| ------------ | -------------- | ----------------------------------------------------------- | ------------------------ |
| Unit         | Vitest         | The use case over injected ports (a fake clock)             | `npm run test`           |
| Adapter      | Vitest         | The argv parser (parse → Result, never throw)              | `npm run test`           |
| Architecture | Vitest (static) | No `process`/`node:` outside `src/adapters`, no bin import from adapters | `npm run test` |
| Evals        | `node --test`  | The `.claude` kit: agents, skills, commands, placeholder leaks | `npm run evals`       |
| Template     | bash           | The whole template, renamed in a temp dir                   | `bash scripts/verify-template.sh` |

## 2. The layout

```text
tests/
├── architecture.test.ts      # the layer walls, asserted as a test
├── cli.test.ts               # the argv parser
└── greet.test.ts             # the example use case, over an injected clock
```

The tests mirror the code: `tests/<feature>.test.ts` for a use case,
`tests/architecture.test.ts` for the boundaries.

## 3. Fakes, not mocks

There is no mocking library in the dependencies. A test passes a frozen clock
(`{ now: () => 0 }`) or an in-memory `Io` that implements the port. A fake
that is five lines long is cheaper than a framework, and it makes the port
boundary visible: if a fake gets awkward, the port is wrong.

## 4. The architecture test is static

`tests/architecture.test.ts` reads the source of each layer and fails when a
forbidden import appears. It is not a lint opinion; it is a test, so it runs
in `npm run test` and not only in `npm run lint`.

The same rules are enforced twice on purpose:

| Rule                                          | ESLint                            | Static test                |
| --------------------------------------------- | --------------------------------- | -------------------------- |
| No `process`/`node:` in `src/core/`           | `no-restricted-globals` / `no-restricted-imports` | `architecture.test.ts` |
| Adapters never import the bin entry           | `no-restricted-imports`           | `architecture.test.ts`     |
| Bin wires core and adapters                   | -                                 | `architecture.test.ts`     |

## 5. The commands

| Command                             | What it runs                                            |
| ----------------------------------- | ------------------------------------------------------- |
| `npm run build`                     | `tsc -p tsconfig.json` - the compiled CLI in `dist/`    |
| `npm run lint`                      | `eslint .` - the layer walls                             |
| `npm run test`                      | `vitest run` - unit + adapter + architecture            |
| `npm run evals`                     | `node --test evals/contracts.test.mjs`                  |
| `npm run ci`                        | lint → test → evals → build                             |

The `Makefile` exposes the same gates as `make install`, `make build`,
`make lint`, `make test`, `make evals`, `make ci` and `make verify`.

## 6. The template verification

`bash scripts/verify-template.sh` is the gate for the _template_, not for a
project. It stages a throwaway copy of the tree in a temp directory, renames
it with `scripts/rename.sh`, and runs every gate on the instantiated copy:

```text
rename · leak-guard (placeholders) · lint-agents · lint-skills ·
lint-commands · instruction-budget · bash -n · npm install · lint ·
test · build · evals · run-live no-op guard
```

Each stage prints one `PASS` or `FAIL` line and the script exits non-zero if
any stage failed. The working tree is never mutated.

## 7. A red test before the code

The loop is the same as in the other kits: write the failing test, watch it
fail for the right reason, then write the smallest change that makes it pass.
`npx vitest run tests/greet.test.ts` runs one file.

## Do / Don't

| Do                                              | Don't                                |
| ----------------------------------------------- | ------------------------------------ |
| Test the use case over an injected port         | Read a real clock or a real terminal |
| Put the test next to the feature it covers      | Collect every test in one folder     |
| Run `make ci` before declaring a change done    | Run only the tests you wrote         |
| Keep the fake in the test file                  | Add a mocking library for one test   |

## See also

- [Playbooks](13-playbooks.md)
- [ADR 0001 - TypeScript + Node stdlib, no bundler](adr/0001-typescript-and-node-stdlib-no-bundler.md)
- The agent guide: [`AGENTS.md`](../AGENTS.md)
