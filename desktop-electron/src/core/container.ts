// <app> — the core's container, the process-level composition root.
//
// It builds the real dependencies (the backend SDK, the local projection,
// the notes slice) and answers the handler map the rpc server dispatches to.
// The renderer-side composition (src/renderer) holds nothing; this is where
// a use case gets wired (docs/04, step 7).

import { POLICY_DEFAULTS } from "../contracts/policy";
import { ok, type Result } from "../shared-kernel";
import { createSdk, type SdkFetch } from "../infrastructure/sdk/client";
import { createNotesApi } from "../infrastructure/sdk/notes-api";
import {
  createInMemoryNoteRepository,
  createSqliteNoteRepository,
} from "../infrastructure/storage/note-repository";
import { createNotesSlice } from "../features/notes/adapters/container";
import { createSdkNoteRepository } from "../features/notes/adapters/sdk-note-repository";
import type { CoreHandlers } from "./rpc-server";

/** The options the boot wires: the storage file and the backend transport. */
export type CoreContainerOptions = {
  /** The notes projection file; without it the projection stays in memory. */
  readonly storagePath?: string | undefined;
  /** The fetch the SDK talks through; defaults to the Node global fetch. */
  readonly fetch?: SdkFetch | undefined;
};

/**
 * The core's handler map.
 *
 * The backend transport: the injected `SdkFetch` defaults to the Node global
 * fetch of the utility process. The playbook asks for `net.fetch` inside the
 * core, and `net` needs the electron module, which the core's dependency
 * walls forbid — so the sandboxed template talks the platform stack over the
 * global fetch and the swap is one injected argument, in main's
 * `startCore`, once the transport handshake lands.
 * #ponytail: swap the default fetch for the handshaken `net.fetch` when the
 * main-to-core transport handshake is wired.
 */
export async function createCoreContainer(
  options: CoreContainerOptions = {},
): Promise<CoreHandlers> {
  const sdk = createSdk({
    fetch: options.fetch ?? ((input, init) => fetch(input, init)),
    // The tenant URL comes from the policy resolver; until that slice lands
    // the safe default applies (empty = no backend, calls fail as values).
    baseUrl: POLICY_DEFAULTS.tenantUrl,
  });
  const api = createNotesApi(sdk);

  const projection = options.storagePath
    ? await createSqliteNoteRepository(options.storagePath)
    : createInMemoryNoteRepository();
  const notes = createNotesSlice({
    repository: createSdkNoteRepository(api, projection),
  });

  return {
    "notes.list": async () => {
      const answer = await notes.listNotes.execute();
      return answer.ok
        ? ok(answer.value.map((note) => note.toDto()))
        : { ok: false, error: answer.error };
    },
    "notes.add": async (payload) => {
      const answer = await notes.addNote.execute({ title: payload.title, body: payload.body });
      return answer.ok ? ok(answer.value.toDto()) : { ok: false, error: answer.error };
    },
    "session.get": (): Promise<Result<unknown>> =>
      Promise.resolve(ok({ permissions: [] as string[] })),
  };
}
