# 04 — Vertical Slicing

## One slice per capability, end to end

A slice is the full path of one capability through the four processes:
contract → use case → adapter → ViewModel → view, plus its tests. Slices
mirror backend slices one-to-one, keyed by the shared route and permission
tables ([§3.6](../PLAYBOOK_DESKTOP_ELECTRON.md), [PLAYBOOK_BACKEND.md]).

The kit ships exactly one slice so the path is complete and visible:
`src/features/notes/`.

## The `notes` slice

| Part | File | Process | What it is |
| --- | --- | --- | --- |
| Domain | `features/notes/domain/note.ts` | core | The entity, its rule (title 1..120, body 0..10000 at the contract level) |
| Ports | `features/notes/application/ports.ts` | core | `NoteRepositoryPort` — consumer-defined, no Electron types |
| Use cases | `features/notes/application/list-notes.ts`, `add-notes.ts` | core | Async, returning `Result<NoteDto[]>` / `Result<NoteDto>` |
| Out adapters | `features/notes/adapters/sdk-note-repository.ts`, `container.ts` | core | Implements the repository port against the SDK |
| Contract | `src/contracts/notes.ts` | shared | zod `NoteDtoSchema` (`id`, `title`, `body`, `createdAt`, `updatedAt`) |
| IPC contract | `src/contracts/ipc.ts` | shared | `notes.list` (res = array), `notes.add` (req = title 1..120, body 0..10000), `session.get` |
| ViewModel | `features/notes/viewmodels/notes-view-model.ts` | renderer | Plain class: `Status` union, `refresh()`, `add(title, body)`, `snapshot()`, `subscribe(cb)` — no React, no DOM |
| View | `features/notes/views/NotesView.tsx` | renderer | JSX over a `useNotesViewModel` hook |

Cross-slice access only through `src/contracts/`; a slice never imports
another slice's internals.

## The flow of one add

```text
NotesView (click) → NotesViewModel.add(title, body)
  → CorePort.rpc('notes.add', …) → preload bridge → ipcRenderer.invoke('rpc', envelope)
  → MAIN PEP (origin, top-frame, unknown-type, window capability, schema)
  → core (use case) → SDK → Result<NoteDto> → back through the same hops
  → ViewModel status: ready | error (the typed AppError, not a thrown bridge)
```

Every hop is testable in isolation: the ViewModel against `tests/_shared/
fakes/fake-core-port.ts`, the PEP pure in `tests/main/ipc-policy.test.ts`,
the use case against the in-memory repository fake
([12](12-testing-and-ci.md)).

## How to add a slice

Commands: `add-slice` (`.claude/commands/`), or by hand:

1. Contract first: DTO schema in `contracts/`, then its entries in
   `contracts/ipc.ts` with request `.strict()`, response, and the
   window capability list.
2. Domain entity + rules.
3. Port in `application/ports.ts`; use cases against the port and the fake.
4. Out adapter (SDK-backed).
5. ViewModel (plain class, tested with the fake `CorePort`).
6. View + thin hook.
7. Wire into `core/container.ts` and `main/core-supervisor.ts`.
8. Architecture test extended if a new wall is needed.

## What a slice is not

* Not a feature flag, a folder of misc components or a "module" of one file.
* Not allowed to fork the error taxonomy: new failure modes extend
  `AppErrorCode` once, in `contracts/`.
* Not allowed to talk to the backend outside the generated SDK
  ([07](07-sdk-auth-and-realtime.md)).

## Realtime mapping

A realtime topic prefix belongs to the slice (`notes.` for the notes slice),
is authorized server-side, and is applied in the slice's application layer.
The transport and the reconnect state machine are kit-level, not per-slice
([07](07-sdk-auth-and-realtime.md)).

## See also

- [03 — Layers & MVVM](03-layers-and-mvvm.md)
- [06 — IPC & Preload](06-ipc-and-preload.md)
- [§3.6 of PLAYBOOK_DESKTOP_ELECTRON](../PLAYBOOK_DESKTOP_ELECTRON.md)
