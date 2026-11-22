// <app> — the notes ViewModel over the shared fake CorePort.
//
// Headless presentation tests: scripted answers from
// tests/_shared/fakes/fake-core-port.ts drive the same statuses the other
// client screens bind to. No DOM, no bridge.

import { describe, expect, it } from "vitest";
import type { IpcResponse } from "@contracts/ipc";
import { err, ok, type AppError, type Result } from "@shared/index";
import { FakeCorePort } from "../_shared/fakes/fake-core-port";
import { NotesViewModel } from "../../src/features/notes/viewmodels/notes-view-model";

/** An in-flight call that never settles; the double-fire guard works against it. */
function pendingAdd(): Promise<Result<IpcResponse<"notes.add">, AppError>> {
  return new Promise<Result<IpcResponse<"notes.add">, AppError>>(() => undefined);
}

describe("NotesViewModel against the shared fake", () => {
  it("passes through a scripted list and records the call", async () => {
    const core = new FakeCorePort();
    core.script("notes.list", ok([FakeCorePort.note("1")]));
    const vm = new NotesViewModel(core);

    await vm.refresh();

    expect(vm.snapshot()).toMatchObject({ status: "ready", notes: [FakeCorePort.note("1")] });
    expect(core.calls).toEqual([{ type: "notes.list", payload: {} }]);
  });

  it("maps the shared error codes to the status set", async () => {
    const cases: [AppError["code"], string][] = [
      ["network", "offline"],
      ["policy-blocked", "policy-blocked"],
      ["forbidden", "forbidden"],
      ["internal", "error"],
    ];
    for (const [code, status] of cases) {
      const core = new FakeCorePort();
      core.script("notes.list", err({ code, message: "x" }));
      const vm = new NotesViewModel(core);
      await vm.refresh();
      expect(vm.snapshot().status, code).toBe(status);
    }
  });

  it("appends on a successful add and keeps the list on a failed one", async () => {
    const core = new FakeCorePort();
    core.script("notes.list", ok([FakeCorePort.note("1")]));
    const vm = new NotesViewModel(core);
    await vm.refresh();
    core.script("notes.add", err({ code: "rate-limited", message: "slow down" }));

    await vm.add("", "body");

    expect(vm.snapshot().notes).toHaveLength(1); // kept
    expect(vm.snapshot().errorCode).toBe("rate-limited");
    expect(vm.snapshot().isAdding).toBe(false);

    core.script("notes.add", ok(FakeCorePort.note("2")));
    await vm.add("Note 2", "body");
    expect(vm.snapshot().notes).toHaveLength(2);
    expect(core.calls).toHaveLength(3);
  });

  it("does not double-fire a command while one is in flight", async () => {
    const core = new FakeCorePort();
    core.script("notes.add", pendingAdd());
    const vm = new NotesViewModel(core);
    void vm.add("One", "");
    await vm.add("Two", "");
    expect(core.calls).toHaveLength(1);
  });

  it("notifies and releases subscribers", async () => {
    const core = new FakeCorePort();
    core.script("notes.list", ok([]), ok([]));
    const vm = new NotesViewModel(core);
    let events = 0;
    const release = vm.subscribe(() => {
      events += 1;
    });
    await vm.refresh();
    expect(events).toBe(2); // loading, then empty
    release();
    await vm.refresh();
    expect(events).toBe(2);
  });
});
