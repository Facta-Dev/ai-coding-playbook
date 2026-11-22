// <app> — the core worker entry.
//
// Runs only as an Electron `utilityProcess` child: main forks
// dist/core/index.cjs and this module listens on `process.parentPort`.
// `parentPort` is not a typed `process` member, so the surface stays a
// narrow local interface (no `any`): if it is absent, the process is not a
// utility child and must not run.

import { createCoreContainer } from "./container";
import { startRpcServer, type CoreParentPort } from "./rpc-server";

interface UtilityProcess {
  readonly parentPort?: CoreParentPort;
}

/** The storage file the main process passes as one `--storage=` fork arg. */
function storagePathFromArgv(argv: readonly string[]): string | undefined {
  for (const arg of argv) {
    if (arg.startsWith("--storage=")) return arg.slice("--storage=".length);
  }
  return undefined;
}

function main(): void {
  const { parentPort } = process as unknown as UtilityProcess;
  if (!parentPort) {
    console.error("the core must run as an Electron utilityProcess child.");
    process.exitCode = 1;
    return;
  }

  // Boot with the real wiring; rpc messages that land before the container
  // resolves are lost — main forks the core before the first window and the
  // first call, so the window is zero by the time a caller can speak.
  void createCoreContainer({ storagePath: storagePathFromArgv(process.argv) }).then((handlers) => {
    startRpcServer(parentPort, handlers);
  });
}

main();
