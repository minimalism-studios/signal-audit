export const state = {
  signals: [],
  historySignals: [],
  historyPagination: null,
  integrations: [],
  environments: [],
  selectedEnvironmentId: null,
  liveSignalsFilters: {
    source: "",
    environment: "",
    state: "",
    severity: "",
  },

  selectedSignalId: null,
  selectedSignalDetail: null,

  investigations: [],
  activeInvestigationView: "overview",
  selectedInvestigationId: null,

  integrationDetails: {},
  integrationDetailLoadingId: null,
  dashboard: null,

  activeDetailView: "overview",
  activeWorkspace: "live-signals",

  historyFilters: {
    query: "",
    source: "",
    environment: "",
    severity: "",
    state: "",
    startDate: "",
    endDate: "",
    page: 1,
    pageSize: 20,
  },
};
