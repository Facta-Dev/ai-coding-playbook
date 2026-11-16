# ADR 0002 - npm and the committed lockfile

- **Status**: Accepted
- **Date**: 2026
- **Scope**: the package manager of the frontend template

## Context

The sibling kits in this repository use pnpm and deliberately never commit a
lockfile: the first install happens on the renamed copy, after
`scripts/rename.sh`. This kit needed to choose a package manager, and the
choice has real consequences for how the template is instantiated and how the
verification gate runs.

The template has to:

- install reproducibly in `scripts/verify-template.sh`, which stages a
  throwaway copy, renames it and runs `npm install` as a gate;
- keep the dependency versions pinned, so a gate that passes today passes
  tomorrow;
- work on the user's machine with the tool already on `PATH`.

## Decision

**Use npm, and commit `package-lock.json`.** The `Makefile` and
`package.json` name `npm`, not `pnpm`:

```text
install: ## Install dependencies (npm install)
	$(NPM) install
```

The lockfile is committed, unlike the pnpm siblings. `scripts/rename.sh`
removes it before the first install and `npm install` regenerates it, so the
committed lockfile is always the one a real install would produce.

## Alternatives considered

| Option               | Why not                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| pnpm, no lockfile    | The sibling convention; but `verify-template.sh` already runs `npm install`, and a committed lockfile makes the verification deterministic. |
| pnpm, committed lock | Would split the toolchain from the gate; the kit keeps one package manager end to end.              |
| yarn                 | A third toolchain for the same output; npm is already on `PATH` and in the verification gate.        |
| no lockfile at all   | The verification gate would drift with the registry; a committed lockfile pins the versions the gate proves. |

## Consequences

- The committed `package-lock.json` is the source of truth for the
  dependency versions the gates exercise; a drift between the lockfile and
  the gate is a bug.
- `.gitignore` keeps `.env` and `.env.*` ignored but keeps `.env.example`,
  and it ignores `node_modules/`, `dist/` and `coverage/` - the lockfile is
  deliberately not ignored.
- `scripts/rename.sh` removes the lockfile before the first install, and
  `verify-template.sh` regenerates it on the staged copy, so the template
  never ships a lockfile that a rename left stale.

## See also

- [ADR 0001 - Vite as the build](0001-vite-as-the-build.md)
- [Directory Structure & Project Skeleton](../05-directory-structure.md)
- [Testing & CI](../12-testing-and-ci.md)
