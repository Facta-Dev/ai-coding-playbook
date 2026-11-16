# ADR 0002 - Generated code and specs

- **Status**: Accepted
- **Date**: 2026
- **Scope**: the generated code and the spec sources of the Go backend template

## Context

The template's persistence and wire-format types are machine-generated, and
the acceptance behaviour is specified before it is coded. The template needed
a decision on:

1. where generated code lives and whether it is committed;
2. what the source of truth for each generator is, so regeneration is a
   command and not a ritual;
3. how CI proves the committed artifacts match the sources, without running a
   generator inside the build loop.

The alternative — hand-writing SQL rows and request/response structs — drifts
from the migrations and the OpenAPI contract the moment either changes.

## Decision

**Generate `internal/gen/db` (sqlc) and `internal/gen/api` (oapi-codegen)
from `migrations/`, the per-slice `queries.sql` files and `specs/openapi.yaml`;
commit the output and gate it with `make gen-check`.**

The two generators:

- **sqlc** reads `sqlc.yaml` (`schema: migrations`, one `queries.sql` per
  slice, `sql_package: pgx/v5`) and emits typed queries into
  `internal/gen/db` (package `db`). The `postgres.go` adapter is the only
  consumer.
- **oapi-codegen/v2** reads `specs/openapi.yaml` with `specs/api.gen.yaml`
  and emits models only into `internal/gen/api` (package `api`); the `http.go`
  adapters share those wire-format types.

Regeneration and the gate:

```make
generate: ## sqlc (internal/gen/db) + oapi-codegen models (internal/gen/api)
	$(GO) tool sqlc generate
	$(GO) tool oapi-codegen -config specs/api.gen.yaml specs/openapi.yaml

gen-check: ## Fail if committed generated code is stale
	@rm -rf /tmp/<app>-gencheck
	@cp -R internal/gen /tmp/<app>-gencheck
	@$(MAKE) --no-print-directory generate
	@diff -ru /tmp/<app>-gencheck internal/gen || { \
	  echo "generated code stale — run make generate and commit"; exit 1; }
```

`make ci` runs `gen-check` after fmt/vet/lint, so a schema or OpenAPI change
without a matching regeneration fails the gate. The `sqlc`, `oapi-codegen`,
`goose` and `govulncheck` tool pins live in `go.mod`'s `tool` block, so no
generator is installed outside the module.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Generate in CI, never commit `gen/` | Every build then needs the generator in the loop and the toolchain installed; committing the output keeps builds deterministic. |
| Hand-written queries and structs | Hand-written rows and wire types drift from `migrations/` and `openapi.yaml`; generated code makes the drift a red gate instead of a review note. |
| One generator for both | sqlc targets the database, oapi-codegen targets the wire format; a single tool would own neither well. |

## Consequences

- `internal/gen/**` is committed and never hand-edited; edits land in
  `migrations/`, a slice's `queries.sql`, or `specs/openapi.yaml`.
- `make generate` is the only way to produce `gen/`; `make gen-check` proves
  the committed copy is current.
- Adding a slice means adding its `queries.sql` to `sqlc.yaml` and its
  `.feature` to `specs/features/`, then re-running `make generate`.

## See also

- [ADR 0001 - Module and layer layout](0001-module-and-layer-layout.md)
- [Persistence & Migrations](../08-persistence-and-migrations.md)
- [Testing & CI](../11-testing-and-ci.md)
- [Project Skeleton](../13-project-skeleton.md)
