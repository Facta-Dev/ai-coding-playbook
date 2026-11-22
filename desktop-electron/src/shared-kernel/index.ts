// <app> — the shared kernel, re-exported.
//
// Pure and dependency-free: every layer imports from here and from nowhere
// else inside `shared-kernel`.

export * from "./errors";
export * from "./ids";
export * from "./result";
export * from "./time";
