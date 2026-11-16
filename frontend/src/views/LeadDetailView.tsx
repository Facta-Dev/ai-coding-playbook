// <app> - the lead detail View.
//
// A View calls one ViewModel hook and renders. No fetch, no SDK import, no
// business conditions beyond showing the status (PLAYBOOK_FRONTEND §4.2). The
// user-visible strings are English literals for now; a slice with
// translations moves them to message keys resolved from the state.errorKey.
import { useEffect } from "react";
import { STAGES } from "../core/types";
import { type LeadDetailViewModel } from "../viewmodels/lead-detail-view-model";
import { useLeadDetailViewModel } from "./useLeadDetailViewModel";

const ERROR_TEXT: Record<string, string> = {
  "lead.error.unauthenticated": "Your session has expired.",
  "lead.error.forbidden": "You do not have access to this lead.",
  "lead.error.not-found": "The lead could not be found.",
  "lead.error.conflict": "The lead changed while you were editing it.",
  "lead.error.validation": "The change was rejected.",
  "lead.error.rate-limited": "Too many requests. Try again shortly.",
  "lead.error.network": "The network is unavailable.",
  "lead.error.server": "The server failed. Try again.",
  "lead.error.unknown": "Something went wrong.",
};

export interface LeadDetailViewProps {
  readonly viewModel: LeadDetailViewModel;
}

export function LeadDetailView({ viewModel }: LeadDetailViewProps) {
  const { state, load, moveToStage, openCampaign } = useLeadDetailViewModel(viewModel);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "loading") {
    return <p role="status">Loading lead...</p>;
  }
  if (state.status === "not-found") {
    return <p role="status">Lead not found.</p>;
  }
  if (state.status === "forbidden") {
    return <p role="status">You do not have access to this lead.</p>;
  }
  if (state.status === "error" || state.lead === null) {
    const text =
      state.errorKey !== null ? (ERROR_TEXT[state.errorKey] ?? "Something went wrong.") : "Something went wrong.";
    return <p role="alert">{text}</p>;
  }

  const lead = state.lead;
  return (
    <section aria-labelledby="lead-name">
      <h1 id="lead-name">{lead.name}</h1>
      <p>
        <a href={`mailto:${lead.email}`}>{lead.email}</a>
      </p>
      <p aria-live="polite">Stage: {lead.stage}</p>

      <div role="group" aria-label="Move stage">
        {STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            disabled={state.isSaving || stage === lead.stage}
            onClick={() => moveToStage(stage)}
          >
            {stage}
          </button>
        ))}
      </div>

      <button type="button" onClick={openCampaign}>
        Open campaign
      </button>
    </section>
  );
}
