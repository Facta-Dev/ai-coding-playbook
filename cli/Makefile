# <app> — build and verification targets.
#
# npm is the package manager; package-lock.json ships with the template
# (rename.sh removes it before substitution, then npm install regenerates it
# on the renamed copy).

NPM ?= npm

.DEFAULT_GOAL := help
.PHONY: help install build lint test evals ci verify

help: ## Show targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "};{printf "  %-12s %s\n",$$1,$$2}'

install: ## Install dependencies (generates/updates package-lock.json)
	$(NPM) install

build: ## Compile TypeScript to dist/
	$(NPM) run build

lint: ## ESLint with the layer walls
	$(NPM) run lint

test: ## Unit + architecture tests (vitest)
	$(NPM) run test

evals: ## Native contract evals over the .claude layer (node --test)
	$(NPM) run evals

ci: ## The gate: lint + test + evals + build
	$(NPM) run ci

verify: ## Template verification script (stages a renamed copy)
	bash scripts/verify-template.sh
