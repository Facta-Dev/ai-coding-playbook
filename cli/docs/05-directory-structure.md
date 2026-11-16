# Directory Structure & Project Skeleton

The annotated map of the kit. Everything is generic until
`scripts/rename.sh` runs: the package name and the display name are
placeholders, and the project cannot build before that.

## 1. The tree

```text
cli/
├── package.json              # scripts: build, lint, test, evals, ci
├── Makefile                  # the same gates as make targets (install, build, lint, test, evals, ci, verify)
├── tsconfig.json             # app build (tsc -> dist/); tsconfig.test.json adds tests/
├── eslint.config.mjs         # flat config; the layer walls (core pure, adapters no bin)
├── vitest.config.ts          # include: tests/**/*.test.ts
├── src/
│   ├── core/                 # contracts.ts (envelope, exit codes), greet.ts (use case)
│   ├── adapters/             # cli.ts (argv), io.ts (stdio) - the only process/node: owner
│   └── bin/main.ts           # the composition root
├── tests/                    # architecture.test.ts, cli.test.ts, greet.test.ts
├── evals/                    # native node --test contract evals for the .claude kit
├── scripts/                  # rename, verify-template, lint-*, leak-guard, budget, runtime
├── .claude/                  # agents, skills, commands, schemas (the kit runtime)
├── docs/                     # this set
├── PLAYBOOK_*.md             # six local contracts - read on demand
├── AGENTS.md                 # agent instructions; CLAUDE.md is a symlink to it
└── MEMORY.md                 # the durable premise
```

## 2. `src/` holds code, `src/bin/` holds the wiring

`src/core/` holds pure code, `src/adapters/` holds the process boundary, and
`src/bin/main.ts` is the composition root: the one file allowed to wire the
adapters to the core and to the process. A file in `src/bin/` may touch
`node:`; a file in `src/core/` may not, and a file in `src/adapters/` may
touch `node:` but never the bin entry.

## 3. There are no path aliases

The template uses relative imports on purpose: three folders, one level deep.
`eslint.config.mjs` scopes the layer rules by directory (`src/core/**`,
`src/adapters/**`), so a new file can be added without touching the config.

## 4. The tests mirror the code

```text
tests/
├── architecture.test.ts      # static check: core pure, adapters no bin, bin wires
├── cli.test.ts               # the argv parser (parse -> Result, never throw)
└── greet.test.ts             # the example use case, over an injected clock
```

There is no mocking library in the dependencies: the fakes are small
hand-written objects (`{ now: () => 0 }`, an in-memory `Io`) that implement
the ports. A fake that is five lines long is cheaper than a framework.

## 5. The project skeleton you copy

To start a project from this template:

```sh
cp -a cli/ my-cli/          # copy, then work in the copy
cd my-cli/
bash scripts/rename.sh <app-slug> <org-scope>
npm install
npm run build               # tsc -> dist/
make ci
```

`scripts/rename.sh` substitutes the placeholder tokens across every text file
(the `scripts/` folder itself and the frozen eval fixtures are excluded),
removes the lockfile, and tells you to run the gates once. The lockfile is
regenerated on the renamed copy, never edited in the template.

Then replace the `greet` use case with your own feature, following
[Playbooks](13-playbooks.md).

## Do / Don't

| Do                                                     | Don't                                    |
| ------------------------------------------------------ | ---------------------------------------- |
| Put a composition root in `src/bin/`                   | Put wiring in `src/core/`                |
| Keep the layer rules scoped by directory               | Add a per-file lint override             |
| Keep the tests next to the feature they cover          | Put every test in one folder             |
| Run the gates after a rename                           | Edit the lockfile in the template        |

## See also

- [Vertical Slicing](04-vertical-slicing.md)
- [Playbooks](13-playbooks.md)
- [ADR 0001 - TypeScript + Node stdlib, no bundler](adr/0001-typescript-and-node-stdlib-no-bundler.md)
