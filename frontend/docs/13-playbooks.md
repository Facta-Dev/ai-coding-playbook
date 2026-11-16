# Playbooks

Repeatable recipes for the changes you will make most. Each: the steps, the
files touched and the gate that proves it. If a change touches more files
than listed, the architecture regressed - investigate before proceeding.

## 1. Add a slice (a new feature)

1. `src/core/types.ts`: the entity, its invariants, its `SdkError` cases. No
   React, no fetch, no DOM.
2. `src/sdk/index.ts`: the SDK resource. The namespace mirrors the URL
   playbook; every method returns `Result` and accepts an `AbortSignal`.
3. `src/viewmodels/`: the state and the commands, with the ports injected.
4. `src/views/`: the View and the `useSyncExternalStore` hook binding.
5. `src/App.tsx`: wire the layers in the composition root.
6. `tests/unit/<layer>/`: one folder per layer touched.

**Gate**: `make ci`.

## 2. Add an SDK resource

1. `src/sdk/index.ts`: the namespace (`sdk.app.funnels.leads`), the methods
   (`list`, `get`, `create`, `update`, `delete`), the typed `SdkError`
   mapping.
2. `src/core/types.ts`: the DTO type if it does not exist.
3. The client: call it from a ViewModel, never from a View.

**Gate**: `make ci` plus a contract test that asserts the request URL, method,
headers and the error mapping.

## 3. Add a route

1. `src/core/routes.ts`: the builder (e.g. `routes.app.lead(id)`).
2. The ViewModel or the View that navigates, through the `Navigator` port.
3. When the route tree grows: one layout and one guard per `{userType}`.

**Gate**: `make ci` and a test that asserts the builder output.

## 4. Add a ViewModel status

1. `src/viewmodels/`: the new status in the status union, and the mapping
   from `SdkError` to the status and message key.
2. `src/views/`: the render branch for the new status.
3. `tests/unit/viewmodels/`: a test for the new status, red first.

**Gate**: `make ci`; every status is covered by a test.

## 5. Add a port

1. `src/core/ports.ts`: the interface the shared layers need.
2. The adapter in the composition root (or `src/sdk/` for a transport).
3. The fakes in the tests that inject it.

**Gate**: `make ci`; a port change that breaks the fake is a visible signal
that the port is wrong.

## 6. Start a project from the template

1. Copy the kit and run `bash scripts/rename.sh <app-slug> <org-scope>`.
2. `npm install`, then `npm run format` (the substitution re-aligns the
   markdown tables).
3. `make ci` - the gates must be green before you change anything.
4. Replace the lead detail slice with your own; keep the layering.
5. `npm run verify` proves the template itself is still sound.

**Gate**: `make ci` and `npm run verify`.

## Do / Don't

| Do                                                              | Don't                                        |
| --------------------------------------------------------------- | -------------------------------------------- |
| Follow the recipe; a longer diff means the architecture changed | Add a shortcut "just this once"              |
| Update the `core` type in the same change                       | Change a shared shape without its tests      |
| Write the test with the fake port                               | Reach for the real network in a unit test    |
| Keep the SDK as the only writer of a backend call               | Let a View reach for `fetch`                 |

## See also

- [Layers & MVVM](03-hexagonal-layers-and-mvvm.md)
- [Vertical Slicing](04-vertical-slicing.md)
- [Testing & CI](12-testing-and-ci.md)
