// <app> — the ui-kit status view.
//
// Every screen state that is not data renders through this one component, so
// a status is announced the same way everywhere: a polite live region for the
// waiting and empty states, an `role="alert"` for the failure states. The
// view passes the ViewModel status; the kit owns the presentation.

import type { ReactNode } from "react";

/** The failure statuses, announced as alerts; everything else is polite. */
const ALERT_STATUSES = new Set(["forbidden", "not-found", "offline", "error", "policy-blocked"]);

export interface StatusViewProps {
  /** The ViewModel status this screen sits in. */
  readonly status: string;
  /** What happened, for the reader and for assistive tech. */
  readonly message: ReactNode;
}

export function StatusView({ status, message }: StatusViewProps) {
  const isAlert = ALERT_STATUSES.has(status);
  return (
    <div
      className="ui-kit-status"
      data-status={status}
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
    >
      {message}
    </div>
  );
}
