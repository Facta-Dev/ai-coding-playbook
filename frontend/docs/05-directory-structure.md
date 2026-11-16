# Directory Structure & Project Skeleton

The annotated map of the kit. Everything is generic until
`scripts/rename.sh` runs: the package name and the display names are
placeholders, and the project cannot build before that.

## 1. The tree

```text
frontend/
├── package.json              # scripts: build, typecheck, lint, format, test, evals, verify, ci
├── Makefile                  # the same gates as make targets (install, ci, build, test, lint, evals, verify)
├── vite.config.ts            # the Vite build for the SPA
├── vitest.config.ts          # the vitest run
├── eslint.config.mjs         # flat config; the React-free layer walls
├── tsconfig.json             # app build; tsconfig.test.json adds tests/
├── index.html                # the single HTML entry point
├── src/
│   ├── main.tsx              # the browser entry point
│   ├── App.tsx               # the composition root: wires adapters, SDK, ViewModel
│   ├── core/                 # ports, types, result, routes - imports nothing
│   ├── sdk/                  # the typed API client + the fetch transport
│   ├── viewmodels/           # presentation state + commands, no React
│   └── views/                # the React hook binding + the components
├── tests/
│   ├── unit/{core,sdk,viewmodels,views}/   # hermetic unit tests
│   └── architecture/architecture.test.ts  # the dependency-direction test
├── evals/                    # native node --test contract evals for the .claude kit
├── scripts/                  # rename, verify, leak-guard, linters, budget
├── .claude/                  # agents, skills, commands, schemas (the kit runtime)
└── docs/                     # this set
```

## 2. `src/` holds code, `index.html` holds the entry

The Vite build reads `index.html` and `src/main.tsx` and writes `dist/`.
There is no `entrypoints/` folder and no manifest: a web SPA has one page,
one entry and one bundle. **`src/` holds code; `src/App.tsx` holds the
composition root.** A file in `src/` below the root may wire only the layers
its direction allows.

## 3. Imports are relative, not aliased

This kit uses plain relative imports (`../core/ports`) rather than path
aliases. The consequence: a layer boundary reads directly off the import
specifier, and the architecture test resolves each relative import to the
layer it targets. Do not introduce an alias scheme; the test and the editor
already agree on relative paths.

## 4. The tests mirror the code

```text
tests/
├── unit/core/routes.test.ts                  # the route builders
├── unit/sdk/sdk.test.ts                      # the SDK shape and error mapping
├── unit/viewmodels/lead-detail-view-model.test.ts  # the statuses and commands
├── unit/views/lead-detail-view.test.ts       # the rendered statuses
└── architecture/architecture.test.ts         # the dependency direction
```

There is no mocking library in the dependencies: the fakes are small
hand-written objects that implement the `core` ports. A fake that is ten
lines long is cheaper than a framework that is not installed.

## 5. The project skeleton you copy

To start a project from this template:

```sh
cp -a frontend/ my-app/               # copy, then work in the copy
cd my-app/
bash scripts/rename.sh <app-slug> <org-scope>
npm install
npm run format                        # the substitution re-aligns the markdown tables
make ci
```

`scripts/rename.sh` substitutes the placeholder tokens across every text
file (the `scripts/` folder itself and the frozen eval fixtures are
excluded), removes `package-lock.json`, and tells you to run `npm install`
once. Unlike the pnpm siblings, this kit **commits** the regenerated
`package-lock.json`.

Then replace the lead detail slice with your own feature, following
[Playbooks](13-playbooks.md).

## Do / Don't

| Do                                                    | Don't                                     |
| ----------------------------------------------------- | ----------------------------------------- |
| Keep the composition root in `src/App.tsx`            | Put a composition root in a component     |
| Use plain relative imports across the tree            | Introduce a path alias for one import     |
| Keep the tests next to the layer they cover           | Put every test in one folder              |
| Run `npm run format` after a rename                   | Commit before the lockfile is regenerated |

## See also

- [Vertical Slicing](04-vertical-slicing.md)
- [Playbooks](13-playbooks.md)
- [ADR 0001 - Vite as the build](adr/0001-vite-as-the-build.md)
