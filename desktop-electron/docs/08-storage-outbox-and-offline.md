# 08 — Storage, Outbox & Offline

## The local database is a projection

The backend is the source of truth; the desktop holds a **projection cache**.
Anything in the local SQLite can be rebuilt by re-fetching — which is why
corruption resets and re-syncs instead of becoming an incident
([§10](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## The driver decision (ADR-backed)

Storage lives in `src/infrastructure/storage/`:

| File | Role |
| --- | --- |
| `note-repository.ts` | The `NoteRepositoryPort` (defined in the slice's application layer) |
| `in-memory-note-repository.ts` | The default in tests and as the fallback |
| `sqlite-note-repository.ts` | `node:sqlite` `DatabaseSync` behind an **async factory** with the in-memory fallback |
| `migrations.ts` | Forward-only migrations tracked by `PRAGMA user_version` |

The kit chose `node:sqlite` over `better-sqlite3` to carry **zero native
modules** — no per-ABI rebuilds, nothing to unpack from ASAR, nothing extra
to sign ([ADR 0003](adr/0003-vite-multi-config-forge-fuses-and-node-sqlite.md)).

> **Known gap — (verify).** `node:sqlite` availability and stability inside
> Electron 45's bundled Node 24 is unconfirmed at the source. The adapter is
> therefore written behind an async factory: if `node:sqlite` fails to load,
> the factory resolves the in-memory repository instead of crashing the core.
> Until verified on the packaged target, treat the fallback path as the
> shipped behavior. If it turns out unavailable, the options are the WASM
> build or `better-sqlite3` with `@electron/rebuild` per ABI (then unpacked
> from ASAR and signed) — an ADR change either way.

## Migrations are forward-only

`PRAGMA user_version` tracks the schema version; `migrations.ts` holds the
ordered list; every migration is tested **from every released schema**, not
only from the previous one. Backup before migrating; integrity check after a
crash ([§10](../PLAYBOOK_DESKTOP_ELECTRON.md)). Tenant and user data are
separated (per-tenant databases or `tenant_id`-first indexes) so tenant
switch and sign-out purge cleanly.

## Offline mutations and the outbox

The design ([§6.3](../PLAYBOOK_DESKTOP_ELECTRON.md)):

1. An offline mutation goes to an **outbox** table with its `Idempotency-Key`
   and per-entity ordering.
2. A sync loop drains the outbox with retry/backoff; conflicts come back as
   typed results the ViewModel can present (a conflict is a status, not a
   popup).
3. `202 Accepted` backend operations are tracked as operation resources,
   polled with backoff or updated via realtime, and survive restarts.

> **Known gap: the outbox is specified, not implemented.** The shipped kit
> mutates through the SDK live and surfaces offline as the ViewModel's
> `offline` status (read-only list from cache). The outbox table, the idem-
> potency plumbing and the conflict surface are the next storage milestone;
> server requirements are shared with the other desktop clients
> ([§6.4](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## Renderer storage

Renderers are untrusted and reload like any web page:

* No authoritative data in `localStorage`/IndexedDB — the local DB is core's.
* Partitions are cleared on sign-out
  ([§12.2](../PLAYBOOK_DESKTOP_ELECTRON.md)); persistent caches that could
  hold sensitive content are disabled.
* Settings are small, schema-validated JSON with atomic writes in the
  user data dir; policy-locked keys are read-only in the UI
  ([11](11-enterprise-policy-and-observability.md)).

## Paths, retention, encryption

* Paths come from `app.getPath('userData'|'logs'|'temp')` — **never** next
  to the executable; machine-wide config stays separate from per-user data.
* Retention: the `DataRetentionDays` policy is enforced by a background job;
  purge on sign-out; temp files live in a private dir with restrictive
  permissions.
* Encryption: OS disk encryption is the baseline; for Restricted data,
  field-level AES-GCM wrapped by `safeStorage` — a Restricted-data decision
  with an ADR ([§10](../PLAYBOOK_DESKTOP_ELECTRON.md)).

## Do / don't

| Do | Don't |
| --- | --- |
| Test each migration from every released schema | Write a destructive migration "because it is only local data" |
| Keep the repository behind the application-layer port | Let a use case import `node:sqlite` directly |
| Present offline as a status with a path back | Block the main process on a sync loop |

## See also

- [07 — SDK, Auth & Realtime](07-sdk-auth-and-realtime.md)
- [ADR 0003 — Vite multi-config, Forge/Fuses and the node:sqlite fallback](adr/0003-vite-multi-config-forge-fuses-and-node-sqlite.md)
- [§10 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md)
