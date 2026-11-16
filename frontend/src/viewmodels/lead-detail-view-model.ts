// <app> - ViewModel: presentation state and commands for the lead detail
// screen, with no React, no DOM and no JSX (PLAYBOOK_FRONTEND §4.1).
//
// A ViewModel returns plain state and commands. The React hook binding lives
// in src/views/useLeadDetailViewModel.ts; this module stays framework-free so
// it can be shared verbatim by the web, native and extension clients and
// tested without a DOM. Side effects (navigation, notifications) go through
// the ports injected at construction.

import { type Navigator, type Notifier } from "../core/ports";
import { routes } from "../core/routes";
import { type Lead, type LeadId, type SdkError, type Stage } from "../core/types";
import { type AppSdk } from "../sdk";

export type LeadDetailStatus = "loading" | "ready" | "forbidden" | "not-found" | "error";

export interface LeadDetailState {
  readonly status: LeadDetailStatus;
  readonly lead: Lead | null;
  readonly isSaving: boolean;
  /** A message key, never a literal string (PLAYBOOK_FRONTEND §6.6). */
  readonly errorKey: string | null;
}

export interface LeadDetailViewModel {
  readonly getState: () => LeadDetailState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly load: () => Promise<void>;
  readonly moveToStage: (stage: Stage) => Promise<void>;
  readonly openCampaign: () => void;
}

export interface LeadDetailDeps {
  readonly sdk: AppSdk;
  readonly leadId: LeadId;
  readonly navigator: Navigator;
  readonly notifier: Notifier;
}

function statusFromSdkError(error: SdkError): LeadDetailStatus {
  switch (error.kind) {
    case "forbidden":
      return "forbidden";
    case "not-found":
      return "not-found";
    default:
      return "error";
  }
}

function messageKeyFromSdkError(error: SdkError): string {
  switch (error.kind) {
    case "unauthenticated":
      return "lead.error.unauthenticated";
    case "forbidden":
      return "lead.error.forbidden";
    case "not-found":
      return "lead.error.not-found";
    case "conflict":
      return "lead.error.conflict";
    case "validation":
      return "lead.error.validation";
    case "rate-limited":
      return "lead.error.rate-limited";
    case "network":
      return "lead.error.network";
    case "server":
      return "lead.error.server";
  }
}

const INITIAL: LeadDetailState = { status: "loading", lead: null, isSaving: false, errorKey: null };

export function createLeadDetailViewModel(deps: LeadDetailDeps): LeadDetailViewModel {
  const { sdk, leadId, navigator, notifier } = deps;
  let state: LeadDetailState = INITIAL;
  const listeners = new Set<() => void>();

  const set = (patch: Partial<LeadDetailState>): void => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    load: async () => {
      set({ status: "loading", errorKey: null });
      const result = await sdk.app.funnels.leads.get(leadId);
      if (!result.ok) {
        set({
          status: statusFromSdkError(result.error),
          errorKey: messageKeyFromSdkError(result.error),
          lead: null,
        });
        return;
      }
      set({ status: "ready", lead: result.value, errorKey: null });
    },

    moveToStage: async (stage) => {
      if (state.isSaving) return;
      set({ isSaving: true, errorKey: null });
      const result = await sdk.app.funnels.leads.update(leadId, { stage });
      if (!result.ok) {
        set({ isSaving: false, errorKey: messageKeyFromSdkError(result.error) });
        return;
      }
      set({ lead: result.value, status: "ready", isSaving: false });
      notifier.success("lead.moved");
    },

    openCampaign: () => {
      const lead = state.lead;
      if (lead !== null) navigator.go(routes.app.campaign(lead.campaignId));
    },
  };
}
