# <app> — build and verification targets.
# The build/test/fmt tasks live in justfile (the Rust task runner); this
# Makefile exposes the two entry points the kit scripts and CI call by name.

.DEFAULT_GOAL := help
.PHONY: help ci verify

help: ## Show targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "};{printf "  %-12s %s\n",$$1,$$2}'

ci: ## The gate: fmt + lint + check + tests + contract evals (just ci)
	just ci

verify: ## Staged renamed copy + full factory smoke
	bash scripts/verify-template.sh
