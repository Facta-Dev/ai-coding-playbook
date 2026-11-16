// <app> - the React binding of the lead detail ViewModel.
//
// The ViewModel is framework-agnostic (src/viewmodels); this hook is the only
// place where React enters the feature, and it lives in the views layer.
import { useCallback, useSyncExternalStore } from "react";
import { type Stage } from "../core/types";
import { type LeadDetailState, type LeadDetailViewModel } from "../viewmodels/lead-detail-view-model";

export interface LeadDetailViewModelBinding {
  readonly state: LeadDetailState;
  readonly load: () => void;
  readonly moveToStage: (stage: Stage) => void;
  readonly openCampaign: () => void;
}

export function useLeadDetailViewModel(viewModel: LeadDetailViewModel): LeadDetailViewModelBinding {
  const state = useSyncExternalStore(viewModel.subscribe, viewModel.getState, viewModel.getState);

  const load = useCallback(() => {
    void viewModel.load();
  }, [viewModel]);

  const moveToStage = useCallback(
    (stage: Stage) => {
      void viewModel.moveToStage(stage);
    },
    [viewModel],
  );

  const openCampaign = useCallback(() => {
    viewModel.openCampaign();
  }, [viewModel]);

  return { state, load, moveToStage, openCampaign };
}
