// <app> — the ui-kit, re-exported.
//
// The shared surface the views compose: the button, the status view and the
// theme tokens. Views import from "../..../ui-kit" (relative), never from a
// component's file, so the kit can change shape under its own contract.

export * from "./Button";
export * from "./StatusView";
