// <app> — the shared fake of the renderer's CorePort.
//
// Every headless test of the client layers injects this object instead of
// the preload bridge: the test scripts the answers per rpc type, calls are
// recorded, and a default failure answers anything unscripted. No DOM, no
// Electron — the port is only an interface
// (src/renderer/core-port.ts).

import type { NoteDto } from "@contracts/notes";
import type { IpcRequest, IpcResponse, IpcType } from "@contracts/ipc";
import { type AppError, type Result, err } from "@shared/index";
import type { CorePort } from "../../../src/renderer/core-port";

/** One scripted answer, or a promise of one (for in-flight/stale tests). */
type Scripted<T extends IpcType> = Result<IpcResponse<T>, AppError> | Promise<Result<IpcResponse<T>, AppError>>;

export class FakeCorePort implements CorePort {
  /** Every call, in order: the type and the payload exactly as passed. */
  readonly calls: { readonly type: IpcType; readonly payload: unknown }[] = [];
  /** Scripted answers, one queue per rpc type. */
  private readonly scripted = new Map<IpcType, Scripted<IpcType>[]>();
  /** The answer of an unscripted type, or throws when none was set. */
  private unscripted: AppError | undefined;

  /** Scripts the answers of one rpc type, consumed in FIFO order. */
  script<T extends IpcType>(type: T, ...answers: Scripted<T>[]): void {
    const queue = this.scripted.get(type) ?? [];
    queue.push(...(answers as Scripted<IpcType>[]));
    this.scripted.set(type, queue);
  }

  /** Answers every unscripted call with this failure instead of throwing. */
  answerUnscriptedWith(error: AppError): void {
    this.unscripted = error;
  }

  /** A scripted note DTO for a response queue. */
  static note(id: string): NoteDto {
    return { id, title: `Note ${id}`, body: "", createdAt: 1, updatedAt: 1 };
  }

  async rpc<T extends IpcType>(
    type: T,
    payload: IpcRequest<T>,
  ): Promise<Result<IpcResponse<T>, AppError>> {
    this.calls.push({ type, payload });
    const queue = this.scripted.get(type);
    const next = queue?.shift();
    if (next !== undefined) return (await Promise.resolve(next)) as Awaited<Result<IpcResponse<T>, AppError>>;
    if (this.unscripted !== undefined) {
      return err(this.unscripted);
    }
    throw new Error(`FakeCorePort has no scripted answer for rpc type "${type}".`);
  }
}
