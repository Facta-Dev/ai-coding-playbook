# Glossary

Every term used in this set, defined once. Where a term has a web meaning and
a kit meaning, the kit meaning is the one that counts here.

**Adapter** - An implementation of a port that talks to the outside world.
`src/sdk/fetch-transport.ts` implements `Transport` over `fetch`.

**Architecture test** - The static dependency-direction test in
`tests/architecture/architecture.test.ts`. It resolves every relative import
to the layer it targets and fails on a forbidden edge.

**Barrel** - Not used in this kit. The reference extension kit wraps a slice
in an `index.ts` barrel; this kit reaches each layer by its top-level folder
instead.

**Binding** - The React hook that connects a ViewModel to a component:
`src/views/useLeadDetailViewModel.ts`, using `useSyncExternalStore`.

**Composition root** - The file that knows everything and wires it together:
`src/App.tsx`. It contains no rules.

**Contract** - The typed shape two layers agree on: the SDK namespace, the
DTOs in `src/core/types.ts` and the `SdkError` envelope. The contract bounds
what may travel; the domain bounds what may exist.

**Core** - `src/core/`: the ports, the pure types, `Result` and the route
builders. Imports nothing.

**Domain** - The rules of a feature: entities, invariants and their errors.
In this kit the domain types live in `src/core/types.ts`.

**Domain rule vs contract bound** - The contract says "a status maps to a
typed error" (what may cross the SDK boundary); the domain says "a stage is
one of the five `STAGES`" (what may be a lead). Both exist on purpose.

**Error key** - A message id (`lead.error.network`), never a literal string,
held by the ViewModel and rendered by the View.

**Fail closed** - When a response cannot be read, the app refuses instead of
rendering partial data. An unknown status becomes `error`, never `ready`.

**Feature flag** - Not shipped in this kit; a backend concern when needed.

**Guard** - A route-level permission check. Not implemented here because the
template ships one route; see [Permissions & Guards](09-policy-admin-over-user.md).

**Hook binding** - See **Binding**.

**Layer** - One of `core`, `sdk`, `viewmodels`, `views` or the composition
root. The dependency direction is `views -> viewmodels -> sdk -> core`.

**Lead** - The example entity of the shipped feature: an id, a name, an email,
a stage and two timestamps.

**Message key** - See **Error key**.

**MVVM** - Model-View-ViewModel: the View renders, the ViewModel holds state
and commands, the Model is the `core` types plus the backend.

**Navigator** - A `core` port that routes without a router library, so a
ViewModel can navigate without importing a platform global.

**Notifier** - A `core` port for user-visible messages, keyed by message id.

**Port** - An interface in `src/core/ports.ts` that the consuming layer
declares, so the SDK and the ViewModels depend on the abstraction and not on
the platform.

**Public client** - A client that ships to every user's browser and therefore
can hold no secret: no client secret, no token at rest.

**Result** - A value-typed outcome: `{ ok: true, value }` or
`{ ok: false, error }`. Expected failures are values, not exceptions.

**Route builder** - A function in `src/core/routes.ts` that builds a path in
exactly one place, mirroring the URL playbook.

**SDK** - `src/sdk/`: the typed API client and the fetch transport. The only
layer that talks to the backend, and the only layer that names `fetch`.

**SdkError** - The typed error envelope in `src/core/types.ts`:
`unauthenticated`, `forbidden`, `not-found`, `conflict`, `validation`,
`rate-limited`, `network`, `server`.

**Slice** - A feature, cut end to end: its `core` types, its SDK resource, its
ViewModel and its View. Sealed: a slice never imports another slice.

**Stage** - One of the five `STAGES` a lead moves through: `new`,
`contacted`, `qualified`, `won`, `lost`.

**Status** - A ViewModel's presentation state: `loading`, `ready`,
`forbidden`, `not-found`, `error`.

**TokenStore** - A `core` port that supplies the access token (never the
refresh token) per call.

**Transport** - A `core` port for an HTTP-like request shape; the web adapter
is `src/sdk/fetch-transport.ts`.

**Trust boundary** - A point where data that is not trusted crosses into code
that is. This kit has one: backend -> SDK.

**View** - The React surface. A pure function of the ViewModel state; no
fetch, no SDK import.

**ViewModel** - The presentation state and the commands that change it. No
React, no DOM, no browser.

**Vertical slicing** - Cutting the code by feature instead of by technical
layer, so one feature is one set of layers.

## See also

- [Overview & Principles](00-overview-and-principles.md)
- [Playbooks](13-playbooks.md)
