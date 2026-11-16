// io.ts — stdio adapter. The only layer that owns the process streams. Core
// never sees a stream: it returns data and this adapter writes it. stdout
// carries data only, stderr carries diagnostics (PLAYBOOK_CLI.md section 4.1).

export interface Io {
  writeStdout(text: string): void;
  writeStderr(text: string): void;
}

// nodeIo wires the real process streams; tests inject an in-memory Io so no
// test ever touches the terminal.
export function nodeIo(): Io {
  return {
    writeStdout: (text) => {
      process.stdout.write(text);
    },
    writeStderr: (text) => {
      process.stderr.write(text);
    },
  };
}
