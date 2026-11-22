# <app> — Electron desktop build and verification targets.
#
# pnpm is the package manager; the lockfile is never committed (the first
# install happens on the renamed copy, after scripts/rename.sh).
#
# Gates, in CI order: typecheck, lint, test, build, evals. `make verify` runs
# the template factory on a staged renamed copy and is the authoritative gate.

PNPM ?= pnpm

.DEFAULT_GOAL := help
.PHONY: help ci typecheck lint test build evals package fuses e2e verify format format-check

help: ## Show targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "};{printf "  %-12s %s\n",$$1,$$2}'

typecheck: ## Typecheck the five surfaces (main, core, preload, renderer, tests)
	$(PNPM) typecheck

lint: ## ESLint + dependency-cruiser architecture rules
	$(PNPM) lint

test: ## Unit tests (vitest, Node environment)
	$(PNPM) test

build: ## Bundle the four surfaces into dist/ (main, preload, core, renderer)
	$(PNPM) build

package: ## Package with Electron Forge (requires the downloaded Electron binary)
	$(PNPM) package

fuses: ## Read the fuse table from a packaged app (APP=out/<name>)
	@test -n "$(APP)" || { echo "fuses: set APP=out/<packaged-app>"; exit 1; }
	npx --no-install @electron/fuses read --app "$(APP)"

evals: ## Native contract tests for the .claude layer (node --test, offline)
	$(PNPM) evals

format: ## Format the tree with prettier
	$(PNPM) format

format-check: ## Fail on unformatted files (prettier = gofmt analog)
	$(PNPM) format:check

verify: ## Template verification script (staged renamed copy, all gates)
	bash scripts/verify-template.sh

e2e: ## Optional Playwright E2E against the packaged app (skips without a display)
	@if [ ! -d tests/e2e ]; then echo "tests/e2e missing — nothing to run"; exit 1; fi; \
	if [ -z "$(DISPLAY)" ] && [ -z "$(WAYLAND_DISPLAY)" ]; then \
	  echo "e2e SKIP: no display (set DISPLAY or WAYLAND_DISPLAY and install Electron)"; exit 0; \
	fi; \
	cd tests/e2e && \
	(command -v electron >/dev/null 2>&1 || pnpm exec playwright --version >/dev/null 2>&1) || { \
	  echo "e2e SKIP: install first with 'cd tests/e2e && pnpm install' (adds @playwright/test and electron as test-only deps)"; exit 0; \
	}; \
	pnpm exec playwright test

ci: ## The gate: typecheck + lint + test + build + evals
	$(PNPM) run ci
