// <app> — the notes ViewModel tests: headless, a fake CorePort, no DOM.

import { describe, expect, it } from "vitest";
import { ok, err, type AppError, type Result } from "@shared/index";
import type { NoteDto } from "@contracts/notes";
import type { IpcRequest, IpcResponse, IpcType } from "@contracts/ipc";
import type { CorePort } from "../../../renderer/core-port";
import { NotesViewModel } from "./notes-view-model";

function aNote(id: string): NoteDto {
  return { id, title: `Note ${id}`, body: "", createdAt: 1, updatedAt: 1 };
}

/** A CorePort whose answers are scripted, in order, and recorded. */
class FakeCorePort implements CorePort {
  readonly calls: { type: IpcType; payload: unknown }[] = [];
  private scripted: (Result<unknown, AppError> | Promise<Result<unknown, AppError>>)[] = [];

  queue(...results: (Result<unknown, AppError> | Promise<Result<unknown, AppError>>)[]): void {
    this.scripted.push(...results);
  }

  async rpc<T extends IpcType>(
    type: T,
    payload: IpcRequest<T>,
  ): Promise<Result<IpcResponse<T>, AppError>> {
    this.calls.push({ type, payload });
    const next = this.scripted.shift();
    if (next === undefined) throw new Error(`no scripted result for ${type}`);
    return (await Promise.resolve(next)) as Result<IpcResponse<T>, AppError>;
  }
}

describe("NotesViewModel", () => {
  it("starts loading and commits a ready snapshot after list", async () => {
    const core = new FakeCorePort();
    core.queue(ok([aNote("1"), aNote("2")]));
    const vm = new NotesViewModel(core);
    expect(vm.snapshot().status).toBe("loading");

    await vm.refresh();

    expect(vm.snapshot()).toMatchObject({ status: "ready", notes: [aNote("1"), aNote("2")] });
    expect(core.calls).toEqual([{ type: "notes.list", payload: {} }]);
  });

  it("maps an empty list to the empty status", async () => {
    const core = new FakeCorePort();
    core.queue(ok([]));
    const vm = new NotesViewModel(core);
    await vm.refresh();
    expect(vm.snapshot().status).toBe("empty");
  });

  it("maps error codes to the shared status set", async () => {
    const cases: [AppError["code"], string][] = [
      ["forbidden", "forbidden"],
      ["not-found", "not-found"],
      ["network", "offline"],
      ["policy-blocked", "policy-blocked"],
      ["internal", "error"],
    ];
    for (const [code, status] of cases) {
      const core = new FakeCorePort();
      core.queue(err({ code, message: "x" }));
      const vm = new NotesViewModel(core);
      await vm.refresh();
      expect(vm.snapshot().status, code).toBe(status);
      expect(vm.snapshot().errorCode).toBe(code);
    }
  });

  it("appends an added note and clears the adding flag", async () => {
    const core = new FakeCorePort();
    core.queue(ok([aNote("1")]));
    const vm = new NotesViewModel(core);
    await vm.refresh();
    core.queue(ok(aNote("2")));

    await vm.add("Note 2", "");

    expect(core.calls[1]?.type).toBe("notes.add");
    expect(core.calls[1]?.payload).toEqual({ title: "Note 2", body: "" });
    expect(vm.snapshot().status).toBe("ready");
    expect(vm.snapshot().notes).toHaveLength(2);
    expect(vm.snapshot().isAdding).toBe(false);
  });

  it("keeps the list and reports the code when add fails", async () => {
    const core = new FakeCorePort();
    core.queue(ok([aNote("1")]));
    const vm = new NotesViewModel(core);
    await vm.refresh();
    core.queue(err({ code: "validation", message: "x" }));

    await vm.add("", "body");

    expect(vm.snapshot().status).toBe("ready");
    expect(vm.snapshot().notes).toHaveLength(1);
    expect(vm.snapshot().errorCode).toBe("validation");
    expect(vm.snapshot().isAdding).toBe(false);
  });

  it("ignores a second add while one is in flight", async () => {
    const core = new FakeCorePort();
    core.queue(new Promise<Result<unknown, AppError>>(() => undefined));
    const vm = new NotesViewModel(core);
    void vm.add("One", "");
    await vm.add("Two", "");
    expect(core.calls).toHaveLength(1);
  });

  it("drops a stale refresh: only the newest command commits", async () => {
    const core = new FakeCorePort();
    const stale = ok([aNote("stale")]);
    const fresh = ok([aNote("fresh")]);
    core.queue(stale, fresh);
    const vm = new NotesViewModel(core);

    const first = vm.refresh();
    const second = vm.refresh();
    await Promise.all([first, second]);

    expect(vm.snapshot().status).toBe("ready");
    expect(vm.snapshot().notes).toEqual([aNote("fresh")]);
  });

  it("notifies subscribers and lets them unsubscribe", async () => {
    const core = new FakeCorePort();
    core.queue(ok([]), ok([]));
    const vm = new NotesViewModel(core);
    let events = 0;
    const subscribe = vm.subscribe(() => {
      events += 1;
    });
    await vm.refresh();
    expect(events).toBe(2); // loading, then empty
    subscribe();
    await vm.refresh();
    expect(events).toBe(2);
    expect(core.calls).toHaveLength(2);
  });
});
