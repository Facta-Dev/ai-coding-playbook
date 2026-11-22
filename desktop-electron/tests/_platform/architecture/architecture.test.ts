// <app> — the architecture suite: the walls, read from the source text.
//
// The same walls dependency-cruiser guards at the import graph (see
// dependency-cruiser.config.cjs) are pinned here as text, so the suite runs
// without loading the sources and so a wall broken by a *global* — not an
// import — is still caught:
//
//   - electron imports live in src/main and src/preload only;
//   - node: built-ins never enter the feature domain/application, the
//     renderer or the ui-kit;
//   - `process.platform` is read in src/platform only;
//   - ipcRenderer appears in the preload bridge only (never in the renderer);
//   - the renderer never imports the SDK — it ships to the core over the
//     typed rpc (PLAYBOOK_DESKTOP_ELECTRON §7);
//   - features are sealed: no cross-feature imports, no `@features/*` alias
//     inside a slice, and the domain/application never reach adapters or
//     views.
//
// Comments are stripped before matching so prose naming a module is not a
// false positive.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../../../src");

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else if (/\.(ts|tsx|mts|cts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Code text without comment-only lines, so prose naming a module never matches. */
function codeText(file: string): string {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

const IMPORT_RE = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;
/** An electron module specifier: `electron`, `electron/main`, `commonjs electron`. */
const ELECTRON_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']electron(?:\.[a-z-]+)?["']/;
/** A node built-in specifier, or the require/process globals a renderer must not use. */
const NODE_GLOBAL_RE = /\b(?:require\s*\(|process\s*\.)/;

function importsOf(code: string): string[] {
  const specs: string[] = [];
  for (const match of code.matchAll(IMPORT_RE)) {
    const spec = match[1];
    if (spec !== undefined) specs.push(spec);
  }
  return specs;
}

describe("architecture — the trust-zone walls", () => {
  const files = listFiles(SRC);
  const rel = (file: string): string => path.relative(SRC, file).split(path.sep).join("/");
  const codeCache = new Map<string, string>();
  const code = (file: string): string => {
    const cached = codeCache.get(file);
    if (cached !== undefined) return cached;
    const value = codeText(file);
    codeCache.set(file, value);
    return value;
  };

  it("scans the whole source tree", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("keeps electron imports in src/main and src/preload only", () => {
    const offenders = files.filter((file) => ELECTRON_RE.test(code(file)));
    const legal = offenders.every((file) => {
      const name = rel(file);
      return name.startsWith("main/") || name.startsWith("preload/");
    });
    expect(legal, `electron found in: ${offenders.map(rel).join(", ")}`).toBe(true);
  });

  it("keeps node: built-ins out of the pure and browser surfaces", () => {
    const pureSurface = (file: string): boolean => {
      const name = rel(file);
      return (
        /^features\/[^/]+\/(domain|application)\//.test(name) ||
        name.startsWith("renderer/") ||
        name.startsWith("ui-kit/")
      );
    };
    const offenders = files
      .filter(pureSurface)
      .filter((file) => importsOf(code(file)).some((spec) => spec.startsWith("node:")));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("keeps the require/process globals out of the renderer and ui-kit", () => {
    const offenders = files.filter((file) => {
      const name = rel(file);
      return (
        (name.startsWith("renderer/") || name.startsWith("ui-kit/")) &&
        NODE_GLOBAL_RE.test(code(file))
      );
    });
    expect(offenders.map(rel)).toEqual([]);
  });

  it("reads process.platform in src/platform only", () => {
    const offenders = files
      .filter((file) => /\bprocess\.platform\b/.test(code(file)))
      .filter((file) => !rel(file).startsWith("platform/"));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("keeps ipcRenderer in the preload bridge only", () => {
    const offenders = files
      .filter((file) => /\bipcRenderer\b/.test(code(file)))
      .filter((file) => !rel(file).startsWith("preload/"));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("never imports the SDK from the renderer or the ui-kit", () => {
    const SDK_RE = /(?:^|\/|@)sdk(?:$|\/)/; // @/sdk, @hmd/sdk, packages/sdk names
    const forbidden = (spec: string): boolean =>
      spec.startsWith("packages/sdk") || /@hmd\/sdk/.test(spec) || /^sdk$/.test(spec);
    const offenders = files.filter((file) => {
      const name = rel(file);
      if (!(name.startsWith("renderer/") || name.startsWith("ui-kit/"))) return false;
      return importsOf(code(file)).some((spec) => forbidden(spec) || SDK_RE.test(spec));
    });
    expect(offenders.map(rel)).toEqual([]);
  });

  it("seals the features: no cross-feature imports, no @features alias inside a slice", () => {
    const offenders: string[] = [];
    for (const file of files.filter((file) => rel(file).startsWith("features/"))) {
      const name = rel(file);
      const ownFeature = name.split("/")[1];
      for (const spec of importsOf(code(file))) {
        if (spec.startsWith("@features/")) {
          offenders.push(`${name}: ${spec}`);
          continue;
        }
        if (!spec.startsWith(".")) continue; // packages and aliases are external
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), ...spec.split("/")));
        if (!target.startsWith("features/")) continue; // leaving the features is fine
        const other = target.split("/")[1];
        if (other !== ownFeature) offenders.push(`${name}: ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the domain and application free of electron and node", () => {
    const offenders = files
      .filter((file) => /^features\/[^/]+\/(domain|application)\//.test(rel(file)))
      .filter((file) => {
        const codeValue = code(file);
        return (
          ELECTRON_RE.test(codeValue) ||
          importsOf(codeValue).some((spec) => spec.startsWith("node:")) ||
          NODE_GLOBAL_RE.test(codeValue)
        );
      });
    expect(offenders.map(rel)).toEqual([]);
  });

  it("does not let the application reach the adapters and the views", () => {
    const offenders: string[] = [];
    for (const file of files.filter((file) => /^features\/[^/]+\/application\//.test(rel(file)))) {
      const name = rel(file);
      for (const spec of importsOf(code(file))) {
        if (!spec.startsWith(".")) continue;
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), ...spec.split("/")));
        if (!target.startsWith("features/")) continue;
        if (/(^|\/)(adapters|views)\//.test(target)) offenders.push(`${name}: ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
