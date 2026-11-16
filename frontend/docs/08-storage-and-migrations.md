# Client Storage & Migrations

**This kit ships no client storage layer.** The reference extension kit
ships three `chrome.storage` areas, a typed store and a migration chain. A
web SPA has no `chrome.storage`, and this template deliberately ships no
`localStorage`, no IndexedDB and no cache: the backend is the single source of
truth, and the session state lives in the ViewModel.

## 1. What the topic meant in the reference

The extension kept durable records locally, so it needed a versioned store: a
schema version per record, ordered pure migrations, a corrupt-record policy
and serialised writes. Those problems belong to code that owns local durable
state.

## 2. What this kit has instead

| Concern              | The reference                 | This kit                                  |
| -------------------- | ----------------------------- | ----------------------------------------- |
| Durable state        | `chrome.storage.local`        | The backend, through the SDK              |
| Volatile state       | `chrome.storage.session`      | The ViewModel state                       |
| A schema version     | per-record constant           | None - nothing is persisted locally       |
| A migration chain    | pure `(vN) -> (vN+1)` steps   | None - nothing is migrated                |
| A corrupt record     | dropped and backed up         | Not applicable                           |

The token is the one value that could tempt a cache: it is not persisted. The
`TokenStore` port supplies it at runtime, and the composition root may back it
with a memory-only store or an HTTP-only cookie - never `localStorage`, which
a public client must not trust for credentials.

## 3. When a cache appears

A project that adds client-side persistence re-adds every one of the
reference's concerns with a reason:

1. **Where does this value live after a reload?** If the answer is a local
   store, it needs a schema version.
2. **What happens when the shape changes?** A migration, with the previous
   version as a fixture.
3. **What happens when the record cannot be read?** Drop it and back it up,
   never throw and take the screen down.
4. **Who writes it?** One writer, or the writes interleave.

Until then, the absence is deliberate: no local store, no migration, nothing
to drift from the backend contract.

## 4. Worked example

The SDK reads the token per call and keeps no local copy:

```ts
const token = await config.tokenStore.getAccessToken();
if (token !== null) headers["authorization"] = `Bearer ${token}`;
```

The token lives in the `TokenStore`, wherever the composition root points it;
the SDK holds no cached value that could go stale.

## Do / Don't

| Do                                             | Don't                                       |
| ---------------------------------------------- | ------------------------------------------- |
| Treat the backend as the single source of truth | Persist a duplicate of the backend locally  |
| Read the token through the `TokenStore`         | Put the token in `localStorage`            |
| Version any store you later add                 | Add a cache without a schema version        |

## See also

- [Service Worker Lifetime](02-service-worker-lifetime.md)
- [The SDK Request Boundary](07-messaging-and-sender-validation.md)
- [Security & CSP](10-security-and-csp.md)
