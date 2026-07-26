(function () {
  "use strict";

  var TARGET_ROUTE = "/admin/system/consent-history";
  var observer;
  var queued = false;

  function mark(element, component, section, classSet) {
    if (!element) return;
    element.dataset.uiComponent = component;
    if (section) element.dataset.uiSection = section;
    if (classSet) element.dataset.uiClassSet = classSet;
  }

  function applyConsentHistoryAssets() {
    queued = false;
    if (window.location.pathname !== TARGET_ROUTE) return;

    var root = document.getElementById("root");
    if (!root) return;
    root.dataset.uiPage = "admin-system-consent-history";
    root.dataset.uiTheme = "KRDS_CURRENT";
    mark(root, "ADMIN_PAGE_SHELL", "CH_STATE_REGION", "CH_PAGE");

    mark(root.querySelector('[role="status"][aria-live]'), "CONSENT_STATE_ANNOUNCER", "CH_STATE_REGION");

    var summary = root.querySelector('[data-help-id="consent-history-summary"]');
    mark(summary, "CONSENT_SUMMARY_GRID", "CH_SUMMARY_SECTION", "CH_SUMMARY");
    if (summary) {
      Array.prototype.forEach.call(summary.children, function (card) {
        mark(card, "CONSENT_SUMMARY_CARD", "CH_SUMMARY_SECTION");
      });
    }

    var form = root.querySelector("form");
    mark(form, "CONSENT_FILTER_FORM", "CH_FILTER_SECTION", "CH_FILTER");
    if (form) {
      mark(form.querySelector("input"), "CONSENT_FILTER_INPUT", "CH_FILTER_SECTION");
      Array.prototype.forEach.call(form.querySelectorAll("select"), function (select) {
        mark(select, "CONSENT_FILTER_SELECT", "CH_FILTER_SECTION");
      });
      Array.prototype.forEach.call(form.querySelectorAll("button"), function (button) {
        mark(button, "CONSENT_ACTION_BUTTON", "CH_FILTER_SECTION");
      });
    }

    var table = root.querySelector("table");
    mark(table && table.parentElement && table.parentElement.parentElement, "CONSENT_DATA_TABLE", "CH_CONTENT_SECTION", "CH_TABLE");

    var mobileList = root.querySelector('[role="list"]');
    mark(mobileList, "CONSENT_MOBILE_CARD_LIST", "CH_CONTENT_SECTION", "CH_MOBILE_CARDS");

    Array.prototype.forEach.call(root.querySelectorAll('span[aria-label*="status"], span[aria-label*="상태"]'), function (badge) {
      mark(badge, "CONSENT_STATUS_BADGE", "CH_CONTENT_SECTION", "CH_STATUS");
    });

    mark(root.querySelector('[aria-busy="true"]'), "CONSENT_LOADING_SKELETON", "CH_FEEDBACK_SECTION", "CH_FEEDBACK");
    mark(root.querySelector('[role="alert"]'), "CONSENT_ERROR_PANEL", "CH_FEEDBACK_SECTION", "CH_FEEDBACK");

    var emptyText = Array.prototype.find.call(root.querySelectorAll("p"), function (item) {
      return /No consent evidence found|조회된 동의 증적이 없습니다/.test(item.textContent || "");
    });
    mark(emptyText && emptyText.parentElement, "CONSENT_EMPTY_PANEL", "CH_FEEDBACK_SECTION", "CH_FEEDBACK");
  }

  function schedule() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(applyConsentHistoryAssets);
  }

  function start() {
    schedule();
    observer = new MutationObserver(schedule);
    observer.observe(document.getElementById("root") || document.body, {
      childList: true,
      subtree: true
    });
    window.addEventListener("popstate", schedule);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
