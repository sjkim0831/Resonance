(function () {
  "use strict";

  var TARGET_ROUTE = "/admin/system/consent-history";
  var observer;
  var queued = false;
  var nativeFetch = window.fetch.bind(window);
  var BUILD_HASH_KEY = "resonance-active-build-hash";
  var ROUTE_RELOAD_KEY = "resonance-route-reload";
  var ROUTE_FINGERPRINTS = {
    "/admin/system/page-development-master": {
      expected: "1천 화면을 하나의 계약과 네 가지 관점으로 관리합니다."
    }
  };

  function normalizeLegacyLoginRequest(input) {
    var raw = typeof input === "string" || input instanceof URL ? String(input) : input && input.url;
    if (!raw) return input;
    var url;
    try {
      url = new URL(raw, window.location.origin);
    } catch (_) {
      return input;
    }
    if (url.origin !== window.location.origin) return input;
    var normalized = url.pathname
      .replace(/^\/home\/signin\/actionLogin$/, "/signin/actionLogin")
      .replace(/^\/en\/home\/signin\/actionLogin$/, "/en/signin/actionLogin");
    if (normalized === url.pathname) return input;
    url.pathname = normalized;
    console.warn("[runtime-self-heal] normalized legacy login endpoint", normalized);
    return input instanceof Request ? new Request(url.toString(), input) : url.toString();
  }

  window.fetch = function (input, init) {
    return nativeFetch(normalizeLegacyLoginRequest(input), init);
  };

  function hardReload(reason, token) {
    var url = new URL(window.location.href);
    url.searchParams.set("__runtime", token || Date.now().toString(36));
    console.warn("[runtime-self-heal] reload", reason);
    window.location.replace(url.toString());
  }

  function verifyRouteFingerprint() {
    var contract = ROUTE_FINGERPRINTS[window.location.pathname];
    if (!contract) return;
    var body = document.body ? document.body.innerText : "";
    if (body.indexOf(contract.expected) >= 0) {
      sessionStorage.removeItem(ROUTE_RELOAD_KEY);
      return;
    }
    var attempt = Number(sessionStorage.getItem(ROUTE_RELOAD_KEY) || "0");
    if (attempt >= 1) return;
    sessionStorage.setItem(ROUTE_RELOAD_KEY, String(attempt + 1));
    hardReload("route-fingerprint", Date.now().toString(36));
  }

  async function verifyBuildVersion() {
    try {
      var response = await fetch("/assets/react/.resonance-build.json?ts=" + Date.now(), { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) return;
      var build = await response.json();
      // A backend-only release can change verification semantics while the
      // frontend source hash remains identical. Bind the live SPA session to
      // the release commit first so stale verification state cannot survive it.
      var hash = build && (build.sourceCommit || build.sourceHash);
      if (!hash) return;
      var active = sessionStorage.getItem(BUILD_HASH_KEY);
      if (!active) {
        sessionStorage.setItem(BUILD_HASH_KEY, hash);
        return;
      }
      if (active !== hash) {
        sessionStorage.setItem(BUILD_HASH_KEY, hash);
        hardReload("build-version", hash.slice(0, 12));
      }
    } catch (_) {
      // The server-side route guard remains authoritative during outages.
    }
  }

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
    window.setTimeout(verifyRouteFingerprint, 2500);
    window.setInterval(verifyRouteFingerprint, 15000);
    void verifyBuildVersion();
    window.setInterval(verifyBuildVersion, 60000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
