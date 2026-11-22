// <app> — the incremental, spec-compliant SSE parser.
//
// What follows `text/event-stream` (docs/07): UTF-8 (the leading partial of
// a multibyte character split across chunks is kept for the next chunk),
// CR/LF/CRLF all end a line, a leading `:` is a comment or a heartbeat, a
// field name ends at the first `:`, an optional single leading space is
// stripped from the value, `data:`/`event:`/`id:`/`retry:` are read and an
// empty line dispatches. An `event:`/`id:`-only event is not dispatched but
// its id is still remembered (the spec answers `Last-Event-ID` with it).
//
// Two caps keep a hostile or broken stream from growing the memory of the
// core without bound: a line longer than 64 KiB aborts that line, an event
// bigger than 256 KiB is dropped instead of emitted.

import { TextDecoder, TextEncoder } from "node:util";

const MAX_LINE_BYTES = 64 * 1024;
const MAX_EVENT_BYTES = 256 * 1024;
/** One dispatched event, as the spec builds it. */
export interface SseEvent {
  /** The accumulated `data:` lines, joined with `\n`. */
  data: string;
  /** The `event:` field, when the event names one (the default is `message`). */
  event?: string;
  /** The `id:` field of this event, when it carried one. */
  id?: string;
  /** The `retry:` field, in milliseconds. */
  retry?: number;
}

export class SseParser {
  private readonly decoder = new TextDecoder("utf-8");
  private readonly encoder = new TextEncoder();
  /** The raw, already line-terminated text not yet processed. */
  private buffer = "";
  /** A trailing carriage return whose meaning needs the next chunk. */
  private pendingCr = false;
  private dataLines: string[] = [];
  private eventName?: string | undefined;
  private eventId?: string | undefined;
  private retryMs?: number | undefined;
  /** The most recent `id:` of the stream, for the `Last-Event-ID` resume. */
  private lastEventId?: string | undefined;
  private eventBytes = 0;

  constructor(private readonly emit: (event: SseEvent) => void) {}

  /** The id to send as `Last-Event-ID` on a resume. */
  get resumeId(): string | undefined {
    return this.lastEventId;
  }

  /**
   * Feeds one chunk: a string, or the bytes of one (UTF-8; a multibyte
   * character split across chunks decodes correctly).
   */
  push(chunk: string | Uint8Array): void {
    this.append(
      typeof chunk === "string"
        ? chunk
        : this.decoder.decode(chunk, { stream: true }),
    );
    this.scan();
  }

  /** Signals the end of the stream: flushes the decoder and the last line. */
  end(): void {
    if (this.pendingCr) {
      this.pendingCr = false;
      this.append("\n");
    }
    const rest = this.decoder.decode();
    if (rest !== "") this.append(rest);
    this.scan();
    if (this.buffer !== "") {
      const line = this.buffer;
      this.buffer = "";
      this.handleLine(line);
    }
  }

  /** Appends text to the buffer, normalizing CR and CRLF into LF. */
  private append(text: string): void {
    if (text === "") return;
    if (this.pendingCr) {
      // The previous chunk ended with \r: it ends a line; a following \n is
      // the second half of a CRLF and is consumed.
      this.pendingCr = false;
      this.buffer += "\n";
      if (text.startsWith("\n")) text = text.slice(1);
    }
    const trailing = text.endsWith("\r");
    const withoutTrailingCr = trailing ? text.slice(0, -1) : text;
    this.buffer += withoutTrailingCr.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
    this.pendingCr = trailing;
  }

  /** Emits every complete line in the buffer. */
  private scan(): void {
    for (;;) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) return;
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    if (this.encoder.encode(line).length > MAX_LINE_BYTES) {
      // Oversize line: abort it and the event it belongs to.
      this.resetEvent();
      return;
    }
    this.eventBytes += this.encoder.encode(line).length + 1;

    if (line === "") {
      this.dispatch();
      return;
    }
    if (line.startsWith(":")) return; // comment / heartbeat

    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    switch (field) {
      case "data":
        this.dataLines.push(value);
        return;
      case "event":
        this.eventName = value;
        return;
      case "id":
        // An id with a NUL byte is ignored, per spec.
        if (!value.includes("\u0000")) {
          this.eventId = value;
          this.lastEventId = value;
        }
        return;
      case "retry":
        if (/^\d+$/.test(value)) this.retryMs = Number(value);
        return;
      default:
        return; // unknown field, ignored per spec
    }
  }

  private dispatch(): void {
    const data = this.dataLines.join("\n");
    const oversized = this.eventBytes > MAX_EVENT_BYTES;
    const { eventName, eventId, retryMs } = this;
    this.resetEvent();
    if (data === "" || oversized) return;

    const event: SseEvent = { data };
    if (eventName !== undefined) event.event = eventName;
    if (eventId !== undefined) event.id = eventId;
    if (retryMs !== undefined) event.retry = retryMs;
    this.emit(event);
  }

  private resetEvent(): void {
    this.dataLines = [];
    this.eventName = undefined;
    this.eventId = undefined;
    this.retryMs = undefined;
    this.eventBytes = 0;
  }
}
