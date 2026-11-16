// <app> - core: route builders (PLAYBOOK_FRONTEND §5.1).
//
// A path is built in exactly one place. Views and ViewModels never concatenate
// URLs by hand; they call these builders, which mirror the frontend half of
// PLAYBOOK_URLS.md.

export const routes = {
  app: {
    /** The lead detail screen: /app/funnels/leads/:leadId */
    lead: (leadId: string): string => `/app/funnels/leads/${leadId}`,
    /** The campaign screen: /app/projects/:campaignId */
    campaign: (campaignId: string): string => `/app/projects/${campaignId}`,
  },
};
