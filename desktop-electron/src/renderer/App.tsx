// <app> — the renderer composition root.
//
// The one file that touches every layer: it builds the bridge-backed
// `CorePort`, instantiates the notes ViewModel and hands it to the view.
// It contains no rules of its own — commands and state live in the
// ViewModel, presentation in the view and the ui-kit.

import { useMemo } from "react";
import { NotesView } from "@features/notes/views/NotesView";
import { NotesViewModel } from "@features/notes/viewmodels/notes-view-model";
import { createBridgeCorePort } from "./core-port";

export default function App() {
  const corePort = useMemo(createBridgeCorePort, []);
  const notesViewModel = useMemo(() => new NotesViewModel(corePort), [corePort]);

  return (
    <main className="app-shell">
      <NotesView viewModel={notesViewModel} />
    </main>
  );
}
