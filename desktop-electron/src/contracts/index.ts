// <app> — the contracts, re-exported.
//
// One import surface: zod schemas and the types they infer, shared by the
// main process, the preload bridge, the renderer and the tests. Nothing else
// imports `contracts` by file.

export * from "./ipc";
export * from "./notes";
export * from "./policy";
