// <app> — the notes DTO.
//
// The shape a note travels with — over the IPC bridge, through the core and
// to and from the backend. Validated on the way in and on the way out, so a
// half-written record can never reach a surface.

import { z } from "zod";

/** The wire bounds of a note; the `notes.add` request reuses them. */
export const NOTE_TITLE_MAX_LENGTH = 120;
export const NOTE_BODY_MAX_LENGTH = 10_000;

export const NoteDtoSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1).max(NOTE_TITLE_MAX_LENGTH),
  body: z.string().max(NOTE_BODY_MAX_LENGTH),
  /** Epoch milliseconds, UTC. */
  createdAt: z.number().int().nonnegative(),
  /** Epoch milliseconds, UTC. */
  updatedAt: z.number().int().nonnegative(),
});

export type NoteDto = z.infer<typeof NoteDtoSchema>;
