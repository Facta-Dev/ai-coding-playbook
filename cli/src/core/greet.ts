// greet is the example use case: a command as a pure function over
// consumer-owned ports. It touches no Node API and no I/O — callers supply
// the clock, so tests can freeze time and the function stays a plain input
// to plain output.
//
// The layer contract it demonstrates end to end: core returns data (never
// writes a stream), adapters own argv/stdio, and bin maps the returned
// envelope onto stdout/stderr plus a versioned exit code.

import type { Envelope } from "./contracts.js";
import { ENVELOPE_VERSION } from "./contracts.js";

export interface GreetPorts {
  now(): number;
}

export interface GreetInput {
  name: string;
}

export interface Greeting {
  greeting: string;
  at: number;
}

export function greet(input: GreetInput, ports: GreetPorts): Envelope<Greeting> {
  const name = input.name.trim();
  if (name === "") {
    return {
      v: ENVELOPE_VERSION,
      ok: false,
      error: { code: "validation_failed", message: "name must not be empty" },
    };
  }
  return {
    v: ENVELOPE_VERSION,
    ok: true,
    data: { greeting: `Hello, ${name}!`, at: ports.now() },
  };
}
