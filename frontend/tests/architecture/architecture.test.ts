// <app> - architecture tests. These pin the dependency direction of
// PLAYBOOK_FRONTEND §1.1 by reading the source tree and resolving every
// relative import to the layer it targets: views -> viewmodels -> sdk -> core
// (and each layer may import itself). A forbidden edge fails the test.
//
// The naive regex import scanner is correct for this template's source style;
// if a future file needs a multi-line import, upgrade to a real parser.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));
const SRC = path.join(ROOT, "src");

type Layer = "core" | "sdk" | "viewmodels" | "views" | "app";

const ALLOWED: Readonly<Record<Layer, readonly Layer[]>> = {
  core: ["core"],
  sdk: ["core", "sdk"],
  viewmodels: ["core", "sdk", "viewmodels"],
  views: ["core", "viewmodels", "views"],
  app: ["core", "sdk", "viewmodels", "views", "app"],
};

function layerOf(rel: string): Layer {
  for (const layer of ["core", "sdk", "viewmodels", "views"] as const) {
    if (rel === layer || rel.startsWith(`${layer}/`)) return layer;
  }
  return "app";
}

interface Edge {
  readonly from: string;
  readonly to: string;
  readonly fromLayer: Layer;
  readonly toLayer: Layer;
}

/** Pulls every module specifier out of import/export declarations. */
function importSpecifiers(source: string): string[] {
  const out: string[] = [];
  const fromRe = /(?:import|export)\s+(?:[^'"]*?\s+)?from\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = fromRe.exec(source)) !== null) out.push(match[1] ?? "");
  const sideRe = /^\s*import\s+["']([^"']+)["']/gm;
  while ((match = sideRe.exec(source)) !== null) out.push(match[1] ?? "");
  return out;
}

function resolveRel(fromRel: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null; // external module
  const base = path.posix.dirname(fromRel);
  return path.posix.normalize(path.posix.join(base, specifier));
}

async function listSourceFiles(): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(file);
    }
  }
  await walk(SRC);
  return out.sort();
}

async function collectEdges(): Promise<Edge[]> {
  const edges: Edge[] = [];
  for (const file of await listSourceFiles()) {
    const fromRel = path.relative(SRC, file).replaceAll(path.sep, "/");
    const source = await readFile(file, "utf8");
    for (const specifier of importSpecifiers(source)) {
      const resolved = resolveRel(fromRel, specifier);
      if (resolved === null) continue;
      edges.push({
        from: fromRel,
        to: resolved,
        fromLayer: layerOf(fromRel),
        toLayer: layerOf(resolved),
      });
    }
  }
  return edges;
}

function violations(edges: Edge[]): string[] {
  const out: string[] = [];
  for (const edge of edges) {
    if (!ALLOWED[edge.fromLayer].includes(edge.toLayer)) {
      out.push(`${edge.from} (${edge.fromLayer}) imports ${edge.to} (${edge.toLayer})`);
    }
  }
  return out;
}

describe("architecture: dependency direction", () => {
  it("the four layers are present", async () => {
    const layers = new Set(
      (await listSourceFiles()).map((file) => layerOf(path.relative(SRC, file).replaceAll(path.sep, "/"))),
    );
    for (const layer of ["core", "sdk", "viewmodels", "views"] as const) {
      expect(layers.has(layer), `missing src/${layer}/`).toBe(true);
    }
  });

  it("no layer imports a forbidden layer", async () => {
    const v = violations(await collectEdges());
    expect(v).toEqual([]);
  });

  it("the checker flags a forbidden edge", () => {
    const v = violations([
      {
        from: "sdk/index.ts",
        to: "viewmodels/lead.ts",
        fromLayer: "sdk",
        toLayer: "viewmodels",
      },
    ]);
    expect(v).toHaveLength(1);
  });
});
