// <app> - the composition root. This is the one place that wires the layers:
// it supplies the web adapters for the ports, builds the SDK, builds the
// ViewModel, and hands it to the View.
import { asLeadId } from "./core/types";
import { createSdk } from "./sdk";
import { fetchTransport } from "./sdk/fetch-transport";
import { createLeadDetailViewModel } from "./viewmodels/lead-detail-view-model";
import { LeadDetailView } from "./views/LeadDetailView";

const sdk = createSdk({
  // Same-origin API; set to the API origin when the backend lives elsewhere.
  // The /api/v1 version lives in the resource definition, not here.
  baseUrl: "",
  transport: fetchTransport,
  tokenStore: { getAccessToken: () => Promise.resolve(null) },
});

const navigator = {
  go: (route: string): void => {
    window.location.assign(route);
  },
};

const notifier = {
  success: (): void => {},
  error: (): void => {},
};

const viewModel = createLeadDetailViewModel({
  sdk,
  leadId: asLeadId("demo-lead"),
  navigator,
  notifier,
});

export function App() {
  return <LeadDetailView viewModel={viewModel} />;
}
