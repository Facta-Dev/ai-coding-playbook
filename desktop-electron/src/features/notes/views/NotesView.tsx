// <app> — the notes view.
//
// The only file in the slice that knows about the DOM (docs/03-layers-and-mvvm):
// it renders the ViewModel state through the ui-kit and forwards the commands.
// No SDK, no IPC, no business rules — the add-form bounds are the contract's
// (title 1..120, body 0..10000), enforced by the input attributes and
// re-checked at the boundary.

import { useEffect, type FormEvent } from "react";
import type { NoteDto } from "@contracts/notes";
import { NOTE_BODY_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from "@contracts/notes";
import { Button, StatusView } from "../../../ui-kit";
import "./NotesView.css";
import {
  useNotesViewModel,
  type NotesState,
  type NotesStatus,
  type NotesViewModel,
} from "../viewmodels/notes-view-model";

export interface NotesViewProps {
  readonly viewModel: NotesViewModel;
}

/** The statuses where notes may be on screen. */
const LIST_STATUSES: ReadonlySet<NotesStatus> = new Set(["ready", "empty"]);

const STATUS_MESSAGES: Record<NotesStatus, string> = {
  loading: "Loading your notes...",
  ready: "Notes are up to date.",
  empty: "No notes yet — add the first one below.",
  forbidden: "You do not have permission to read notes here.",
  "not-found": "The notes store could not be found.",
  offline: "You are offline — notes will come back with the connection.",
  error: "Notes could not be loaded. Try again in a moment.",
  "policy-blocked": "Notes are blocked by your organization's policy.",
};

export function NotesView({ viewModel }: NotesViewProps) {
  const state = useNotesViewModel(viewModel);
  const listVisible = LIST_STATUSES.has(state.status);

  useEffect(() => {
    void viewModel.refresh();
  }, [viewModel]);

  return (
    <section className="notes-view" aria-labelledby="notes-heading">
      <h1 id="notes-heading">Notes</h1>
      {listVisible ? null : (
        <StatusView status={state.status} message={STATUS_MESSAGES[state.status]} />
      )}
      {listVisible ? <NotesList notes={state.notes} /> : null}
      <NotesForm state={state} viewModel={viewModel} />
    </section>
  );
}

function NotesList({ notes }: { notes: readonly NoteDto[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="notes-view__list" aria-label="Saved notes">
      {notes.map((note) => (
        <li key={note.id} className="notes-view__item">
          <h2 className="notes-view__item-title">{note.title}</h2>
          {note.body.length > 0 ? <p className="notes-view__item-body">{note.body}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** A form field, as text: files cannot be a note's title or body. */
function readField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

function NotesForm({ state, viewModel }: { state: NotesState; viewModel: NotesViewModel }) {
  const busy = state.isAdding;

  const onAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = readField(data, "title");
    const body = readField(data, "body");
    void viewModel.add(title, body).then(() => form.reset());
  };

  return (
    <form className="notes-view__form" onSubmit={onAdd}>
      <label className="notes-view__label" htmlFor="note-title">
        Title
      </label>
      <input
        id="note-title"
        name="title"
        className="notes-view__input"
        required
        minLength={1}
        maxLength={NOTE_TITLE_MAX_LENGTH}
        disabled={busy}
      />
      <label className="notes-view__label" htmlFor="note-body">
        Body
      </label>
      <textarea
        id="note-body"
        name="body"
        className="notes-view__input notes-view__input--body"
        rows={3}
        maxLength={NOTE_BODY_MAX_LENGTH}
        disabled={busy}
      />
      {state.errorCode !== null ? (
        <p className="notes-view__error" data-code={state.errorCode} role="alert">
          The note was not saved (code: {state.errorCode}).
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {state.isAdding ? "Adding..." : "Add note"}
      </Button>
    </form>
  );
}
