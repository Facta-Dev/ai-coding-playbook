# ADR 0001 - Module and layer layout

- **Status**: Accepted
- **Date**: 2026
- **Scope**: the layout of the Go backend template

## Context

A Go backend template needed a project shape that makes the dependency rule
cheap to follow and hard to break, and that a renamed copy can build without
rearranging. The requirements were:

1. one Go module so `go test ./...`, the `go tool` pins (sqlc, goose,
   oapi-codegen, govulncheck) and CI stay a single command;
2. a `cmd/` / `internal/` split so the composition roots are the only
   packages with a `main`, and everything else is unimportable from outside
   the module;
3. layer walls that a linter enforces rather than a code-review convention,
   so a forbidden import turns the build red.

The sibling backend kits split concerns differently (the Rust kit is a
crate-per-concern workspace); this kit is one module, many packages.

## Decision

**A single module `github.com/<scope>/<app>` (a placeholder until
`scripts/rename.sh` runs), with `cmd/` as the composition roots,
`internal/features/` as vertical slices, `internal/platform/` as transversal
infra, `internal/shared/` as the kernel, and `internal/gen/` as committed
generated code — the walls enforced by depguard in `.golangci.yml`.**

```text
cmd/api/main.go         # root: config → pgxpool → adapters → Register → ListenAndServe
cmd/worker/main.go      # root: config → pool → email outbox loop + janitor loop
cmd/migrate/main.go     # goose migration entrypoint
internal/features/<x>/  # domain.go ports.go usecase.go http.go postgres.go module.go
internal/platform/      # authx · oauthx · email · realtime · config · httpx · pgx
internal/shared/        # apperr · rolex · authz · clockx · idgen (stdlib only)
internal/gen/           # db (sqlc) · api (oapi-codegen) — committed, never hand-edited
```

The depguard rules that make the shape a law, not a preference:

```yaml
# .golangci.yml (abridged)
domain-pure:
  files: ["**/internal/features/**/domain.go"]
  deny:
    - pkg: net/http                 # domain stays transport-agnostic
    - pkg: database/sql             # persistence is a port
    - pkg: github.com/jackc/pgx/v5  # domain must not touch pgx
    - pkg: github.com/<scope>/<app>/internal/gen
    - pkg: github.com/<scope>/<app>/internal/platform
    - pkg: github.com/<scope>/<app>/internal/features
slice-isolation:
  files: ["**/internal/features/**"]
  deny:
    - pkg: github.com/<scope>/<app>/internal/features  # slices never depend on slices
```

## Alternatives considered

| Option | Why not |
| --- | --- |
| A multi-module workspace | Two modules or a workspace would buy nothing but version skew between `shared/` copies; Go packages are the unit of isolation and cycles are impossible inside one module. |
| Layers over slices (`internal/domain`, `internal/usecase`, …) | A layer-per-folder layout spreads one feature across folders and makes "where does X live?" a grep; vertical slices keep one feature in one package. |
| Review-only dependency discipline | A documented rule is reviewable, not enforced; depguard makes a forbidden import fail `make lint` deterministically. |

## Consequences

- The composition roots (`cmd/*`) are the only `main` packages; nobody
  imports them, they import everything.
- Every slice has the same six files, so the answer to "where does X live?"
  is a file kind, never a grep.
- `shared/` may import only the stdlib; anything that grows a dependency
  beyond that moves to `platform/`.
- `make ci` fails on any domain impurity or feature-to-feature import, so the
  walls survive a rename untouched.

## See also

- [ADR 0002 - Generated code and specs](0002-generated-code-and-specs.md)
- [Package Topology](../03-package-topology.md)
- [Dependency Rules](../04-dependency-rules.md)
- [Project Skeleton](../13-project-skeleton.md)
