# Service Worker Lifetime

**This topic does not apply to this kit.** The reference extension kit ships
a Manifest V3 service worker - an event-driven background context that is
killed after ~30 seconds of idle and restarted cold. This frontend kit is a
React 19 web SPA and ships no service worker, no background context and no
`chrome.*` API.

## 1. What the topic meant in the reference

The extension's service worker is the only context that can hold a lock and
the only one that dies without warning, so every design decision there
follows from restart safety: register listeners at the top level, keep no
state in module globals, persist anything that must survive, and use alarms
for periodic work.

## 2. What this kit has instead

A web SPA has the opposite lifetime shape. The page stays alive as long as
the tab, and the closest analogue to "restart" is a **full page reload**,
which resets every module global. The kit handles that with one rule:

- **The ViewModel holds the session state.** A module global in `src/` must
  never be load-bearing: the composition root rebuilds the SDK and the
  ViewModel on every entry, and any value that must survive a reload belongs
  to the backend, not to a variable.
- **Nothing is registered lazily.** `src/main.tsx` mounts the App
  synchronously; there is no listener that can miss an event.

## 3. The reload-safety checklist

Ask these two questions of any new module-level code:

1. **Where does this value live after a reload?** If the answer is "in a
   variable", it is either a cached value that must be safe to recompute, or
   a bug.
2. **What happens if the fetch fails halfway?** The SDK returns a typed
   `SdkError`; the ViewModel maps it to a status. A partial response is not a
   state the app renders.

## 4. Worked example

The SDK does not memoise a token or a response across reloads: every call
asks the `TokenStore` port for the access token, so a reload with a fresh
session re-reads it instead of serving a stale value.

## Do / Don't

| Do                                               | Don't                                  |
| ------------------------------------------------ | -------------------------------------- |
| Rebuild the SDK and the ViewModel on entry       | Keep a module global that must survive |
| Read the token per call through the `TokenStore` | Cache the token in a module global     |
| Map a failed fetch to a status                   | Assume an in-flight call completed     |

## See also

- [Platform Model & Execution Contexts](01-platform-model-and-execution-contexts.md)
- [The SDK Request Boundary](07-messaging-and-sender-validation.md)
