# Testing & CI

The gates are the contract. A change is finished when `make ci` is green and
the template verification passes; a change to the kit's own agent runtime is
finished when the evals pass.

## 1. The test tiers

| Tier         | Tool            | What it covers                                                    | Command                          |
| ------------ | --------------- | ----------------------------------------------------------------- | -------------------------------- |
| Unit         | Vitest          | Pure `core` functions, the SDK shape and error mapping, the ViewModel statuses, the View statuses | `npm test`                       |
| Architecture | Vitest (static) | The dependency direction `views -> viewmodels -> sdk -> core`      | `npm test`                       |
| Evals        | `node --test`   | The `.claude` kit: agents, skills, commands, SDK posture           | `npm run evals`                  |
| Template     | bash            | The whole template, renamed in a temp dir                          | `npm run verify`                 |

## 2. The layout

```text
tests/
├── unit/core/routes.test.ts
├── unit/sdk/sdk.test.ts
├── unit/viewmodels/lead-detail-view-model.test.ts
├── unit/views/lead-detail-view.test.ts
└── architecture/architecture.test.ts
```

The tests mirror the code: `tests/unit/<layer>/` for each layer,
`tests/architecture/` for the boundary rules.

## 3. Fakes, not mocks

There is no mocking library in the dependencies. The tests inject hand-written
fakes that implement the `core` ports (`Transport`, `TokenStore`,
`Navigator`, `Notifier`). A fake that is ten lines long is cheaper than a
framework, and it makes the port boundary visible: if a fake gets awkward,
the port is wrong.

The SDK is tested through a fake `Transport`, so the test never opens a
network: the fake returns a chosen status and body and lets the test assert
the mapped `SdkError`.

## 4. The architecture test is static

`tests/architecture/architecture.test.ts` walks the source tree, resolves
every relative import to the layer it targets, and fails on a forbidden edge.
It is not a lint opinion; it is a test, so it runs in `npm test`.

The same rules are enforced twice on purpose:

| Rule                                        | ESLint                  | Static test                  |
| ------------------------------------------- | ----------------------- | ---------------------------- |
| No `react` in `core`, `sdk`, `viewmodels`   | `no-restricted-imports` | -                            |
| No `react-native` in `views`                | `no-restricted-imports` | -                            |
| No `views -> sdk` edge                      | -                       | `architecture.test.ts`       |
| No `sdk -> viewmodels` edge                 | -                       | `architecture.test.ts`       |
| No `viewmodels -> views` edge               | -                       | `architecture.test.ts`       |

## 5. The commands

| Command                                     | What it runs                                                         |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `npm run build`                             | `vite build` - the SPA bundle in `dist/`                            |
| `npm run typecheck`                         | `tsc` over the app and the test projects                             |
| `npm run lint`                              | `eslint .` - the type-aware rules and the React-free walls           |
| `npm run format` / `npm run format:check`   | Prettier, write / check                                              |
| `npm test`                                  | Vitest, all the tests                                                |
| `npm run evals`                             | `node --test evals/contracts.test.mjs`                              |
| `npm run verify`                            | `bash scripts/verify-template.sh`                                   |
| `npm run ci`                                | typecheck -> lint -> test -> build                                   |

The `Makefile` exposes the same gates as `make install`, `make ci`,
`make build`, `make typecheck`, `make lint`, `make test`, `make evals`,
`make format`, `make format-check` and `make verify`.

## 6. The template verification

`npm run verify` is the gate for the _template_, not for a project. It
stages a throwaway copy of the tree in a temp directory, renames it with
`scripts/rename.sh`, and runs every gate on the instantiated copy:

```text
rename - leak-guard (placeholders) - lint-agents - lint-skills -
lint-commands - instruction-budget - bash -n - npm install - typecheck -
lint - test - build - evals - run-live no-op guard
```

Each stage prints one `PASS` or `FAIL` line and the script exits non-zero if
any stage failed. The working tree is never mutated.

## 7. A red test before the code

The loop is the same as in the backend kits: write the failing test, watch it
fail for the right reason, then write the smallest change that makes it
pass. `npx vitest run <file>` runs one file.

## Do / Don't

| Do                                             | Don't                              |
| ---------------------------------------------- | ---------------------------------- |
| Test the layers and the ports, not the browser | Mock `fetch` globally              |
| Put the test next to the layer it covers       | Collect every test in one folder   |
| Run `make ci` before declaring a change done   | Run only the tests you wrote       |
| Keep the fake in the test that uses it         | Add a mocking library for one test |

## See also

- [Playbooks](13-playbooks.md)
- [ADR 0001 - Vite as the build](adr/0001-vite-as-the-build.md)
- The agent guide: [`AGENTS.md`](../AGENTS.md)
