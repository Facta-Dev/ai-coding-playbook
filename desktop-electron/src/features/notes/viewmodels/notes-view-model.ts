// <app> — the notes ViewModel.
//
// A plain TypeScript class with no React and no DOM (docs/03-layers-and-mvvm):
// presentation state, commands and the shared status set, tested headless
// against a fake `CorePort`. The view sees state and commands only — no IPC,
// no SDK, no business rules. The same status union every client screen uses:
//
//   loading | ready | empty | forbidden | not-found | offline | error | policy-blocked

import { useEffect, useState } from "react";
import type { NoteDto } from "@contracts/notes";
import type { AppError, AppErrorCode } from "@shared/index";
import type { CorePort } from "../../../renderer/core-port";

export type NotesStatus =
  | "loading"
  | "ready"
  | "empty"
  | "forbidden"
  | "not-found"
  | "offline"
  | "error"
  | "policy-blocked";

export interface NotesState {
  readonly status: NotesStatus;
  readonly notes: readonly NoteDto[];
  /** A command is in flight; the view disables the form on it. */
  readonly isAdding: boolean;
  /** The error code of the last failed command, cleared on the next one. */
  readonly errorCode: AppErrorCode | null;
}

/** Map a failed call to the one status that says what happened. */
function statusFromError(error: AppError): NotesStatus {
  switch (error.code) {
    case "forbidden":
      return "forbidden";
    case "not-found":
      return "not-found";
    case "network":
      return "offline";
    case "policy-blocked":
      return "policy-blocked";
    default:
      return "error";
  }
}

const INITIAL: NotesState = { status: "loading", notes: [], isAdding: false, errorCode: null };

export class NotesViewModel {
  private readonly core: CorePort;
  private state: NotesState = INITIAL;
  private readonly listeners = new Set<() => void>();
  /** Stale guard: only the newest in-flight command may commit state. */
  private generation = 0;

  constructor(core: CorePort) {
    this.core = core;
  }

  snapshot(): NotesState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async refresh(): Promise<void> {
    const generation = this.claimGeneration();
    this.commit({ status: "loading", errorCode: null });
    const result = await this.core.rpc("notes.list", {});
    if (generation !== this.generation) return;
    if (!result.ok) {
      this.commit({ status: statusFromError(result.error), errorCode: result.error.code, notes: [] });
      return;
    }
    this.commit({
      status: result.value.length === 0 ? "empty" : "ready",
      notes: result.value,
    });
  }

  async add(title: string, body: string): Promise<void> {
    if (this.state.isAdding) return;
    this.commit({ isAdding: true, errorCode: null });
    const generation = this.claimGeneration();
    const result = await this.core.rpc("notes.add", { title, body });
    if (generation !== this.generation || !this.state.isAdding) return;
    if (!result.ok) {
      // Keep the list on screen; the code tells the view what went wrong.
      this.commit({ isAdding: false, errorCode: result.error.code });
      return;
    }
    this.commit({
      status: "ready",
      notes: [...this.state.notes, result.value],
      isAdding: false,
    });
  }

  private claimGeneration(): number {
    this.generation += 1;
    return this.generation;
  }

  private commit(patch: Partial<NotesState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

/** The thin React binding: subscribe on mount, render state. */
export function useNotesViewModel(viewModel: NotesViewModel): NotesState {
  const [state, setState] = useState<NotesState>(() => viewModel.snapshot());
  useEffect(
    () => viewModel.subscribe(() => setState(viewModel.snapshot())),
    [viewModel],
  );
  return state;
}
