// cli.ts — argv adapter. The only layer that parses the process argument
// vector into the typed invocation the core understands. Parsing errors are
// returned as a Result (never thrown across the layer boundary); bin maps a
// failed parse onto ExitCode.Usage.

import { parseArgs } from "node:util";

export type Invocation =
  | { kind: "version" }
  | { kind: "help" }
  | { kind: "greet"; name: string; json: boolean };

export type CliParse =
  | { ok: true; invocation: Invocation }
  | { ok: false; message: string };

export function parseArgv(argv: string[]): CliParse {
  const first = argv[0];

  if (first === "--version" || first === "-v" || first === "version") {
    return { ok: true, invocation: { kind: "version" } };
  }
  if (first === "--help" || first === "-h" || first === "help") {
    return { ok: true, invocation: { kind: "help" } };
  }
  if (first !== "greet") {
    return {
      ok: false,
      message: `unknown command '${first ?? ""}' (try 'greet' or '--help')`,
    };
  }

  try {
    const { values } = parseArgs({
      args: argv.slice(1),
      options: {
        name: { type: "string" },
        json: { type: "boolean", default: false },
      },
      allowPositionals: false,
    });
    return {
      ok: true,
      invocation: {
        kind: "greet",
        name: values.name ?? "world",
        json: values.json ?? false,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}
