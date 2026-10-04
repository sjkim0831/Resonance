(function () {
  "use strict";

  var TARGET_ROUTE = "/admin/system/consent-history";
  var observer;
  var queued = false;
  var BUILD_HASH_KEY = "resonance-active-build-hash";
  var ROUTE_RELOAD_KEY = "resonance-route-reload";
  var ROUTE_FINGERPRINTS = {
    "/admin/system/page-development-master": {
      expected: "1천 화면을 하나의 계약과 네 가지 관점으로 관리합니다."
    }
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
      var hash = build && build.sourceHash;
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

  function applyEvidenceProjectPicker() {
    if (!/^\/(en\/)?emission\/evidence\/?$/.test(window.location.pathname)) return;
    var root = document.getElementById("root");
    if (!root || new URLSearchParams(window.location.search).has("projectId")) return;
    var prompt = Array.prototype.find.call(root.querySelectorAll('[role="alert"]'), function (item) {
      return /프로젝트 목록에서 대상을 먼저 선택|Select a project from the project list/.test(item.textContent || "");
    });
    if (!prompt || root.querySelector("[data-evidence-project-picker]")) return;

    var en = window.location.pathname.indexOf("/en/") === 0;
    var panel = document.createElement("section");
    panel.dataset.evidenceProjectPicker = "true";
    panel.className = "my-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
    var title = document.createElement("h2");
    title.className = "text-xl font-black text-[#052b57]";
    title.textContent = en ? "Select a project for evidence" : "증빙을 관리할 프로젝트 선택";
    var description = document.createElement("p");
    description.className = "mt-2 text-sm text-slate-600";
    description.textContent = en
      ? "Only projects available to your account are shown. Select one to view its activity data and evidence files."
      : "계정에 접근 권한이 있는 프로젝트만 표시됩니다. 프로젝트를 선택하면 해당 활동자료와 증빙 파일을 확인할 수 있습니다.";
    var form = document.createElement("form");
    form.className = "mt-4 grid gap-3 sm:grid-cols-[1fr_auto]";
    var input = document.createElement("input");
    input.className = "krds-control min-h-11 rounded-lg border border-slate-300 px-3";
    input.type = "search";
    input.placeholder = en ? "Project, site, or owner" : "프로젝트명·사업장·담당자 검색";
    input.setAttribute("aria-label", input.placeholder);
    var submit = document.createElement("button");
    submit.className = "krds-button min-h-11 rounded-lg bg-[#003675] px-5 font-bold text-white";
    submit.type = "submit";
    submit.textContent = en ? "Search" : "검색";
    form.append(input, submit);
    var status = document.createElement("p");
    status.className = "mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700";
    status.setAttribute("role", "status");
    status.textContent = en ? "Loading accessible projects…" : "접근 가능한 프로젝트를 불러오는 중입니다…";
    var tableWrap = document.createElement("div");
    tableWrap.className = "mt-3 overflow-x-auto";
    panel.append(title, description, form, status, tableWrap);
    prompt.insertAdjacentElement("afterend", panel);
    prompt.hidden = true;

    function renderProjects(items) {
      tableWrap.replaceChildren();
      if (!items.length) {
        status.textContent = en ? "No accessible projects were found." : "접근 가능한 프로젝트가 없습니다.";
        return;
      }
      status.textContent = (en ? "Projects found: " : "조회된 프로젝트: ") + items.length;
      var table = document.createElement("table");
      table.className = "w-full min-w-[680px] overflow-hidden rounded-lg border border-slate-200 text-left text-sm";
      var head = document.createElement("thead");
      head.className = "bg-slate-100 text-slate-800";
      var headerRow = document.createElement("tr");
      (en ? ["Project", "Sites", "Period", "Status", "Action"] : ["프로젝트", "사업장", "산정 기간", "상태", "선택"]).forEach(function (label) {
        var th = document.createElement("th");
        th.className = "p-3";
        th.textContent = label;
        headerRow.appendChild(th);
      });
      head.appendChild(headerRow);
      var body = document.createElement("tbody");
      items.forEach(function (project) {
        var row = document.createElement("tr");
        row.className = "border-t border-slate-200";
        var name = document.createElement("td");
        name.className = "p-3 font-bold text-[#052b57]";
        name.textContent = project.name || project.id || "—";
        var sites = document.createElement("td");
        sites.className = "p-3";
        sites.textContent = (project.sites || []).map(function (site) { return site.name; }).filter(Boolean).join(", ") || project.site || "—";
        var period = document.createElement("td");
        period.className = "p-3";
        period.textContent = project.periodStart && project.periodEnd ? project.periodStart + " ~ " + project.periodEnd : project.legacyPeriod || "—";
        var state = document.createElement("td");
        state.className = "p-3";
        state.textContent = project.status || "—";
        var action = document.createElement("td");
        action.className = "p-3";
        var choose = document.createElement("button");
        choose.type = "button";
        choose.className = "krds-button min-h-10 rounded-lg bg-[#246beb] px-4 font-bold text-white";
        choose.textContent = en ? "Select" : "선택";
        choose.addEventListener("click", function () {
          var target = new URL(window.location.href);
          target.searchParams.set("projectId", project.id);
          window.location.assign(target.toString());
        });
        action.appendChild(choose);
        row.append(name, sites, period, state, action);
        body.appendChild(row);
      });
      table.append(head, body);
      tableWrap.appendChild(table);
    }

    async function loadProjects(keyword) {
      status.textContent = en ? "Loading accessible projects…" : "접근 가능한 프로젝트를 불러오는 중입니다…";
      tableWrap.replaceChildren();
      var endpoint = (en ? "/en/home/api/emission-projects" : "/home/api/emission-projects") + "?keyword=" + encodeURIComponent(keyword || "") + "&page=1&size=100";
      try {
        var response = await fetch(endpoint, { credentials: "include", headers: { Accept: "application/json" } });
        if (response.status === 401) {
          var returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.assign((en ? "/en" : "") + "/signin/loginView?returnUrl=" + returnUrl);
          return;
        }
        var payload = await response.json();
        if (!response.ok) throw new Error(payload.message || (en ? "Project search failed." : "프로젝트 조회에 실패했습니다."));
        renderProjects(Array.isArray(payload.items) ? payload.items : []);
      } catch (error) {
        status.textContent = (error && error.message) || (en ? "Project search failed." : "프로젝트 조회에 실패했습니다.");
        status.setAttribute("role", "alert");
      }
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      status.setAttribute("role", "status");
      void loadProjects(input.value.trim());
    });
    void loadProjects("");
  }

  function applyConsentHistoryAssets() {
    queued = false;
    applyEvidenceProjectPicker();
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
