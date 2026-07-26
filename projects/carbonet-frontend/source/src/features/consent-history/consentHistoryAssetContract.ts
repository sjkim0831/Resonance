/**
 * Generated code binding for admin-system-consent-history.assets.json.
 * IDs are managed through the framework UI registries and synchronized by
 * ops/scripts/sync-screen-system-assets.sh.
 */
export const CONSENT_HISTORY_ASSETS = {
  page: "admin-system-consent-history",
  theme: "KRDS_CURRENT",
  component: {
    pageShell: "ADMIN_PAGE_SHELL",
    stateAnnouncer: "CONSENT_STATE_ANNOUNCER",
    summaryGrid: "CONSENT_SUMMARY_GRID",
    summaryCard: "CONSENT_SUMMARY_CARD",
    filterForm: "CONSENT_FILTER_FORM",
    filterInput: "CONSENT_FILTER_INPUT",
    filterSelect: "CONSENT_FILTER_SELECT",
    actionButton: "CONSENT_ACTION_BUTTON",
    dataTable: "CONSENT_DATA_TABLE",
    mobileCardList: "CONSENT_MOBILE_CARD_LIST",
    statusBadge: "CONSENT_STATUS_BADGE",
    loadingSkeleton: "CONSENT_LOADING_SKELETON",
    errorPanel: "CONSENT_ERROR_PANEL",
    emptyPanel: "CONSENT_EMPTY_PANEL"
  },
  section: {
    state: "CH_STATE_REGION",
    summary: "CH_SUMMARY_SECTION",
    filter: "CH_FILTER_SECTION",
    content: "CH_CONTENT_SECTION",
    feedback: "CH_FEEDBACK_SECTION"
  },
  classSet: {
    page: "CH_PAGE",
    summary: "CH_SUMMARY",
    filter: "CH_FILTER",
    table: "CH_TABLE",
    mobileCards: "CH_MOBILE_CARDS",
    feedback: "CH_FEEDBACK",
    status: "CH_STATUS"
  }
} as const;

export function registeredAsset(
  component: string,
  section?: string,
  classSet?: string
): Record<string, string> {
  return {
    "data-ui-component": component,
    ...(section ? { "data-ui-section": section } : {}),
    ...(classSet ? { "data-ui-class-set": classSet } : {})
  };
}
