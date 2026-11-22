// <app> — the SSE parser, exercised directly.

import { describe, expect, it } from "vitest";
import { SseParser, type SseEvent } from "./sse-parser";

function parse(chunks: (string | Uint8Array)[]): { events: SseEvent[]; resumeId: string | undefined } {
  const events: SseEvent[] = [];
  const parser = new SseParser((event) => events.push(event));
  for (const chunk of chunks) parser.push(chunk);
  parser.end();
  return { events, resumeId: parser.resumeId };
}

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

describe("SseParser", () => {
  it("parses a simple event", () => {
    const { events } = parse(["data: hello\n\n"]);
    expect(events).toEqual([{ data: "hello" }]);
  });

  it("joins multiple data lines with \\n", () => {
    const { events } = parse(["data: a\ndata: b\n\n"]);
    expect(events).toEqual([{ data: "a\nb" }]);
  });

  it("handles CR, LF and CRLF as line endings", () => {
    expect(parse(["data: a\r\rdata: b\r\r"]).events).toEqual([{ data: "a" }, { data: "b" }]);
    expect(parse(["data: a\n\ndata: b\n\n"]).events).toEqual([{ data: "a" }, { data: "b" }]);
    expect(parse(["data: a\r\n\r\ndata: b\r\n\r\n"]).events).toEqual([
      { data: "a" },
      { data: "b" },
    ]);
  });

  it("keeps a CRLF that is split across chunks one line ending", () => {
    expect(parse(["data: a\r", "\n\n"]).events).toEqual([{ data: "a" }]);
  });

  it("splits an event across chunks, mid-line and mid-multibyte", () => {
    // The é needs two bytes; both the bytes and the line are split.
    const bytes = utf8("data: café\n\n");
    const half = bytes.length / 2;
    const { events } = parse([bytes.slice(0, half), bytes.slice(half)]);
    expect(events).toEqual([{ data: "café" }]);
  });

  it("strips exactly one leading space from a value", () => {
    const { events, resumeId } = parse(["event: add\nid: 42\nretry: 3000\ndata: x\n\n"]);
    expect(events).toEqual([{ data: "x", event: "add", id: "42", retry: 3000 }]);
    expect(resumeId).toBe("42");
    expect(parse(["data:  x\n\n"]).events).toEqual([{ data: " x" }]);
  });

  it("ignores comments and heartbeats", () => {
    const { events } = parse([": ping\n\n: ping\n\n"]);
    expect(events).toEqual([]);
  });

  it("does not dispatch an event without data, but keeps its id", () => {
    const { events, resumeId } = parse(["id: abc\n\ndata: later\n\n"]);
    expect(events).toEqual([{ data: "later" }]);
    expect(resumeId).toBe("abc");
  });

  it("ignores an id with a NUL byte and a non-numeric retry", () => {
    const { events, resumeId } = parse(["id: a\u0000b\nretry: soon\ndata: x\n\n"]);
    expect(events).toEqual([{ data: "x" }]);
    expect(resumeId).toBeUndefined();
  });

  it("drops a line over the 64 KiB cap and the event it belongs to", () => {
    const big = `data: ${"x".repeat(80 * 1024)}\n\n`;
    expect(parse([big]).events).toEqual([]);
  });

  it("drops an event over the 256 KiB cap", () => {
    const lines = Array.from({ length: 20 }, () => `data: ${"x".repeat(20 * 1024)}\n`).join("");
    expect(parse([lines + "\n"]).events).toEqual([]);
  });

  it("does not dispatch an event the stream ends mid-way (spec-strict)", () => {
    const { events, resumeId } = parse(["id: tail-id\ndata: tail"]);
    expect(events).toEqual([]);
    // The id field was still read, so the resume keeps the position.
    expect(resumeId).toBe("tail-id");
  });

  it("decodes a multibyte character whose bytes arrive at a chunk boundary", () => {
    const bytes = utf8("data: 中\n\n");
    const { events } = parse([bytes.slice(0, 9), bytes.slice(9)]);
    expect(events).toEqual([{ data: "中" }]);
  });

  it("ignores unknown fields", () => {
    const { events } = parse(["foo: bar\ndata: x\n\n"]);
    expect(events).toEqual([{ data: "x" }]);
  });
});
