// architecture.test.ts — the layer walls of PLAYBOOK_CLI.md section 3.1,
// asserted as a test (in addition to the ESLint no-restricted-imports rules).
//
// The allowed direction is core -> adapters -> bin:
//   - core is pure: it imports nothing from adapters, bin, or the node:
//     builtin namespace;
//   - adapters own argv/stdio and never import the bin entry;
//   - bin is the composition root and wires the other two layers.
//
// The test reads the source tree and fails on any forbidden import edge, so
// a regression is caught even if the ESLint rule is bypassed. Hermetic: no
// network, no process execution.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...tsFiles(p));
    } else if (entry.name.endsWith(".ts")) {
      out.push(p);
    }
  }
  return out;
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const re = /import[^'"]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g;
  const specs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    specs.push(m[1] ?? m[2]!);
  }
  return specs;
}

const rel = (f: string): string => path.relative(ROOT, f);

const coreFiles = tsFiles(path.join(ROOT, "src", "core"));
const adapterFiles = tsFiles(path.join(ROOT, "src", "adapters"));
const binFiles = tsFiles(path.join(ROOT, "src", "bin"));

describe("layer walls", () => {
  it("every layer ships at least one file", () => {
    expect(coreFiles.length).toBeGreaterThan(0);
    expect(adapterFiles.length).toBeGreaterThan(0);
    expect(binFiles.length).toBeGreaterThan(0);
  });

  it("core never imports adapters, bin or a node: builtin", () => {
    for (const file of coreFiles) {
      for (const spec of importsOf(file)) {
        expect(spec.startsWith("../adapters/"), `${rel(file)} imports '${spec}'`).toBe(false);
        expect(spec.startsWith("../bin/"), `${rel(file)} imports '${spec}'`).toBe(false);
        expect(spec.startsWith("node:"), `${rel(file)} imports '${spec}'`).toBe(false);
      }
    }
  });

  it("adapters never import the bin entry", () => {
    for (const file of adapterFiles) {
      for (const spec of importsOf(file)) {
        expect(spec.startsWith("../bin/"), `${rel(file)} imports '${spec}'`).toBe(false);
      }
    }
  });

  it("bin wires core and adapters together", () => {
    const specs = binFiles.flatMap(importsOf);
    expect(specs.some((s) => s.startsWith("../core/"))).toBe(true);
    expect(specs.some((s) => s.startsWith("../adapters/"))).toBe(true);
  });
});
