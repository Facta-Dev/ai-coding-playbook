// bin/main.ts — composition root: argv -> adapter -> core -> adapter -> io.
//
// It is the one place allowed to wire the adapters to the core and to the
// process. stdout carries data only, stderr carries diagnostics, and the exit
// code comes from the versioned contract table (src/core/contracts.ts).

import { parseArgv } from "../adapters/cli.js";
import { nodeIo } from "../adapters/io.js";
import { greet } from "../core/greet.js";
import { ExitCode } from "../core/contracts.js";

const VERSION = "0.1.0";

const HELP = `<app> — cross-platform Node CLI

Usage:
  <app> greet [--name <name>] [--json]
  <app> --version
  <app> --help

stdout carries data only; stderr carries diagnostics. Exit codes:
  0 success | 1 general error | 2 usage | 7 validation
`;

function main(argv: string[]): number {
  const io = nodeIo();
  const parsed = parseArgv(argv);

  if (!parsed.ok) {
    io.writeStderr(`error: ${parsed.message}\n`);
    return ExitCode.Usage;
  }

  const invocation = parsed.invocation;
  if (invocation.kind === "version") {
    io.writeStdout(`${VERSION}\n`);
    return ExitCode.Ok;
  }
  if (invocation.kind === "help") {
    io.writeStdout(HELP);
    return ExitCode.Ok;
  }

  const envelope = greet({ name: invocation.name }, { now: Date.now });

  if (invocation.json) {
    // The envelope is versioned and self-describing: data and errors share
    // one shape on stdout, so a pipeline never has to parse stderr.
    io.writeStdout(`${JSON.stringify(envelope)}\n`);
    if (!envelope.ok) {
      io.writeStderr(`error: ${envelope.error.message}\n`);
    }
    return envelope.ok ? ExitCode.Ok : ExitCode.Validation;
  }

  if (!envelope.ok) {
    io.writeStderr(`error: ${envelope.error.message}\n`);
    return ExitCode.Validation;
  }
  io.writeStdout(`${envelope.data.greeting}\n`);
  return ExitCode.Ok;
}

process.exitCode = main(process.argv.slice(2));
