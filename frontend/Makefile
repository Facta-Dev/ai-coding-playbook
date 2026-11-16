# <app> - build and verification targets.
#
# npm is the package manager; package-lock.json is committed (unlike the pnpm
# sibling kits), so `make install` is a plain npm install.

NPM ?= npm

.DEFAULT_GOAL := help
.PHONY: help install build typecheck lint test evals format format-check verify ci

help: ## Show targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "};{printf "  %-14s %s\n",$$1,$$2}'

install: ## Install dependencies (npm install)
	$(NPM) install

build: ## Bundle the SPA into dist/
	$(NPM) run build

typecheck: ## Type-check without emitting (tsc --noEmit)
	$(NPM) run typecheck

lint: ## ESLint + the React-free layer walls
	$(NPM) run lint

test: ## Unit + architecture tests (vitest)
	$(NPM) run test

evals: ## .claude contract evals (node --test)
	$(NPM) run evals

format: ## Format the tree with prettier
	$(NPM) run format

format-check: ## Fail on unformatted files
	$(NPM) run format:check

verify: ## Template verification script
	$(NPM) run verify

ci: ## The gate: typecheck + lint + test + build
	$(NPM) run ci
