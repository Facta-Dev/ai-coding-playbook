# Storage & Migrations

This chapter **does not apply to this stack** in its reference form. The
reference client kit is a Chrome extension with three storage areas
(`chrome.storage.local/session/managed`) and a versioned notes record. The
shipped CLI template has no storage: the `greet` use case keeps nothing between
invocations, and there is no durable record to migrate.

## The analog that does apply

A real CLI product does keep state - config, a session transcript, cached
credentials - and the fuller contract specifies the rules
(`PLAYBOOK_CLI.md` section 8):

- **Config layers and precedence.** Managed over flags over env over project
  over user over defaults, resolved by a pure resolver (see
  [Policy](09-policy-admin-over-user.md)).
- **Versioned records.** A durable shape carries a schema version, and a
  change ships a pure `(vN) → (vN+1)` migration plus a fixture of the previous
  version.
- **Single-writer.** One writer per store, through a serialized
  read-modify-write queue, so two overlapping writes cannot interleave.
- **Fail-closed reads.** A record that cannot be parsed is dropped and backed
  up, never thrown at the process.

The template ships none of this machinery. When the project grows a durable
record, follow `PLAYBOOK_CLI.md` section 8 and route the change through the
`exit-code-contract` skill for the schema discipline.

## What the template does instead

The only "state" the template handles is the versioned envelope and the
exit-code table, and both are treated as migration-prone contracts:

- `ENVELOPE_VERSION` is **1**; a shape change bumps it and updates every
  consumer in the same change.
- The `ExitCode` table is the migration surface for scripts: a code's meaning
  changes only with a version bump and a golden fixture.

## See also

- [Service Worker Lifetime](02-service-worker-lifetime.md)
- [Policy: Administrator Over User](09-policy-admin-over-user.md)
- [Playbooks](13-playbooks.md)
