# Changelog

All notable changes to the playbook set. The format follows Keep a Changelog;
the set uses semantic versioning per playbook and a dated entry per change.

## 2026-11-17 — 1.0.0

### Added
- `PLAYBOOK_MASTER.md` promoted from draft: catalog, precedence, invariants,
  Claude Code operating model, maintenance loop and maturity ladder.
- `manifest.json`: machine-readable catalog with routing paths and keywords.
- `verify-register.md`: dated claims with owner and re-check date.
- `scripts/playbook-lint.py`: deterministic front-matter, cross-reference,
  manifest and size checks.
- `scripts/claude-kit/check-playbook-copies.sh`: fails when a kit copy drifts
  from the root playbook.
- `scripts/claude-kit/generate-playbook-rules.py`: generates the path-scoped
  `.claude/rules/playbooks.md` in every kit.
- `docs/adr/0001-playbook-copies-are-mirrors.md`: the copy policy.

### Changed
- Every kit now ships byte-identical copies of the shared contracts plus its
  stack playbook; backend kit copies are no longer hand-specialized.
- The canonical error envelope is nested `{error:{code,message,
  requiredPermission?,correlationId?}}`; Go, Node.js, Python, Rust, Java and
  the frontend SDK agree.
- The root frontend playbook uses framework-free ViewModels; React bindings
  live in the view layer.
- The extension playbook describes the shipped message-protocol SDK and the
  worker-side HTTP adapter.
- Tenant isolation is scoped to the multi-tenant profile; the outbox section
  separates the at-least-once target from weaker shipped baselines.
- Deny lists include `Bash(rm -rf *)` and the user credential paths.

### Fixed
- `install-user-kit.sh` no longer crashes on a fresh install (`$FRAGMENTS`).
- `make evals` is a real target in Go, Node.js, Extension and Rust.
- `make gen-check` in Go and Node.js no longer expands `<app>` into a shell
  redirection.
- The Java kit no longer ships Go-specialized playbooks.
