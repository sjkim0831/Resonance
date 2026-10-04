let rtxPreviewQueued = false,
  rtxSelectedEquipmentCode = "",
  rtxSelectedEquipmentName = "",
  rtxWorkspaceCount = 0,
  rtxExplicitSelection = false,
  rtxLastAssemblyObjects = [],
  rtxLeaseHeartbeat = 0,
  rtxLeaseSlot = 1,
  rtxObjectLockHeartbeat = 0,
  rtxLockedObjectIds = [],
  rtxReverseSyncTimer = 0,
  rtxReverseSyncSignature = "",
  rtxReverseSyncBusy = false;
const rtxUuid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `p006-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
const rtxLeaseClientId = rtxUuid();
sessionStorage.setItem("p006-rtx-client-id", rtxLeaseClientId);
async function rtxLeaseAction(action, keepalive = false) {
  const response = await fetch(
      `/projects/P006/digital-twin/api/rtx-session/${action}`,
      {
        method: "POST",
        credentials: "include",
        keepalive,
        headers: { "content-type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ clientId: rtxLeaseClientId }),
      },
    ),
    body = await response.json();
  if (!response.ok)
    throw new Error(body.message || `RTX 세션 HTTP ${response.status}`);
  return body;
}
async function acquireRtxLease(status, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const lease = await rtxLeaseAction("acquire");
    document.documentElement.dataset.rtxLease = lease.status;
    document.documentElement.dataset.rtxQueuePosition = String(
      lease.position || 0,
    );
    if (lease.status === "ACQUIRED") {
      rtxLeaseSlot = Number(lease.slot) || 1;
      clearInterval(rtxLeaseHeartbeat);
      rtxLeaseHeartbeat = setInterval(
        async () => {
          try {
            const renewed = await rtxLeaseAction("heartbeat");
            document.documentElement.dataset.rtxLease = renewed.status;
            if (renewed.status === "ACQUIRED")
              rtxLeaseSlot = Number(renewed.slot) || rtxLeaseSlot;
          } catch (_) {}
        },
        10000,
      );
      if (status) status.textContent = "RTX 세션 확보 · 선택 Stage 생성 중";
      return lease;
    }
    if (status)
      status.textContent = `RTX 사용 대기 ${lease.position}번 · 현재 사용자 종료 시 자동 연결`;
    const proxyStatus = document.querySelector(
      ".rtx-instant-proxy [data-proxy-status]",
    );
    if (proxyStatus)
      proxyStatus.textContent = `선택 배치를 표시 중입니다. RTX 대기열 ${lease.position}번입니다.`;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("RTX 대기시간 60초 초과");
}
async function releaseRtxLease() {
  await releaseRtxObjectLocks();
  clearInterval(rtxLeaseHeartbeat);
  rtxLeaseHeartbeat = 0;
  try {
    await rtxLeaseAction("release", true);
  } catch (_) {}
  document.documentElement.dataset.rtxLease = "RELEASED";
}
function rtxEditorLabel() {
  return (
    document.querySelector(".header .actions span")?.textContent?.trim() ||
    `RTX 사용자 슬롯 ${rtxLeaseSlot}`
  );
}
async function rtxObjectLockAction(action, objectIds = rtxLockedObjectIds) {
  const response = await fetch(
      `/r/P006/actuator/p006/object-locks/${action}`,
      {
        method: "POST",
        credentials: "include",
        signal: AbortSignal.timeout(5000),
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: rtxLeaseClientId,
          objectIds,
          editorLabel: rtxEditorLabel(),
          slot: rtxLeaseSlot,
        }),
      },
    ),
    body = await response.json();
  if (!response.ok) {
    const owner = body.conflicts?.[0]?.editorLabel;
    throw new Error(
      body.status === "LOCKED"
        ? `${owner || "다른 사용자"}가 이 설비를 편집 중입니다.`
        : body.message || `잠금 HTTP ${response.status}`,
    );
  }
  return body;
}
async function acquireRtxObjectLocks(objects) {
  const ids = objects.map((item) => item.objectId).filter(Boolean);
  if (!ids.length) return;
  try {
    await rtxObjectLockAction("acquire", ids);
  } catch (error) {
    if (error?.name === "TimeoutError" || /timed out/i.test(error?.message || "")) {
      document.documentElement.dataset.rtxObjectLocks = "DEGRADED_TIMEOUT";
      return;
    }
    throw error;
  }
  rtxLockedObjectIds = ids;
  clearInterval(rtxObjectLockHeartbeat);
  rtxObjectLockHeartbeat = setInterval(
    () => rtxObjectLockAction("heartbeat").catch(() => {}),
    10000,
  );
  document.documentElement.dataset.rtxObjectLocks = String(ids.length);
}
async function releaseRtxObjectLocks() {
  clearInterval(rtxObjectLockHeartbeat);
  rtxObjectLockHeartbeat = 0;
  const ids = rtxLockedObjectIds;
  rtxLockedObjectIds = [];
  if (!ids.length) return;
  try {
    await rtxObjectLockAction("release", ids);
  } catch (_) {}
  document.documentElement.dataset.rtxObjectLocks = "0";
}
function removeInstantRtxProxy() {
  document.querySelector(".rtx-instant-proxy")?.remove();
}
function cleanupRtxPreviewArtifacts(viewer, frame) {
  clearInterval(rtxReadinessTimer);
  rtxReadinessTimer = 0;
  viewer?.querySelectorAll(
    ".rtx-static-fallback,.rtx-readiness,.rtx-preview-header,.rtx-version-actions,iframe,video,canvas",
  ).forEach((node) => {
    if (node instanceof HTMLMediaElement) {
      node.pause();
      node.removeAttribute("src");
      node.load();
    }
    if (node instanceof HTMLIFrameElement) node.src = "about:blank";
    node.remove();
  });
  if (frame?.isConnected) {
    frame.src = "about:blank";
    frame.remove();
  }
  removeInstantRtxProxy();
  viewer?.classList.remove("rtx-preview-modal");
  document.documentElement.classList.remove("rtx-preview-open");
  [
    "rtxPreviewPhase",
    "rtxVideo",
    "rtxVideoError",
    "rtxAssemblyRequest",
    "rtxFirstVisualMs",
  ].forEach((key) => delete document.documentElement.dataset[key]);
}
function equipmentProxyImage(label) {
  const safe = String(label || "설비").replace(/[<>&"']/g, "").slice(0, 18),
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="136" viewBox="0 0 240 136"><defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#187e91"/><stop offset="1" stop-color="#063b5c"/></linearGradient></defs><rect width="240" height="136" rx="12" fill="#eaf0f4"/><path d="M35 102h170M47 98V57h36v41m8 0V38h69v60m9 0V65h25v33" fill="url(#m)" stroke="#062f45" stroke-width="4"/><path d="M102 54h47v18h-47zM55 65h19v18H55zM177 73h9v17h-9z" fill="#ffca28"/><circle cx="66" cy="103" r="9" fill="#243746"/><circle cx="141" cy="103" r="9" fill="#243746"/><text x="120" y="126" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#063b5c">${safe}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
function showInstantRtxProxy(objects) {
  removeInstantRtxProxy();
  const proxy = document.createElement("section"),
    header = document.createElement("header"),
    floor = document.createElement("div");
  proxy.className = "rtx-instant-proxy";
  proxy.setAttribute("role", "status");
  proxy.style.cssText =
    "position:fixed;inset:0;z-index:2147483000;background:#eef2f6;color:#123;display:grid;grid-template-rows:72px 1fr;font-family:Arial,sans-serif";
  header.style.cssText =
    "display:flex;align-items:center;gap:16px;padding:12px 24px;background:#07516b;color:white;box-shadow:0 2px 8px #0003";
  header.innerHTML = `<strong style="font-size:20px">선택 설비 ${objects.length}개 즉시 미리보기</strong><span data-proxy-status>1단계 · 선택 배치를 표시했습니다. RTX 화면을 준비 중입니다.</span>`;
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "닫기";
  close.style.cssText =
    "margin-left:auto;padding:10px 18px;border:0;border-radius:8px;background:white;color:#07516b;font-weight:700";
  close.onclick = removeInstantRtxProxy;
  header.append(close);
  floor.style.cssText =
    "position:relative;margin:28px;overflow:hidden;border:1px solid #9aa8b5;border-radius:14px;background:linear-gradient(135deg,#cad2da,#f8fafc);box-shadow:inset 0 0 80px #51627326";
  for (const [index, object] of objects.entries()) {
    const source =
        document.querySelector(
          `.p006-library-card[data-asset="${CSS.escape(object.assetCode)}"] img`,
        ) ||
        document.querySelector(
          `.asset-card[data-asset="${CSS.escape(object.assetCode)}"] img`,
        ),
      item = document.createElement("article"),
      image = document.createElement("img"),
      label = document.createElement("b");
    item.style.cssText = `position:absolute;left:${Math.max(3, Math.min(91, object.x))}%;top:${Math.max(4, Math.min(86, object.y))}%;width:120px;min-height:96px;transform:translate(-50%,-50%) rotate(${object.rotationY || 0}deg) scale(${Math.max(.55, Math.min(1.6, object.scale || 1))});padding:7px;border:2px solid #00a0af;border-radius:10px;background:#fff;box-shadow:0 8px 20px #20304040;text-align:center`;
    image.alt = object.assetCode;
    image.src =
      object.preview ||
      source?.currentSrc ||
      source?.src ||
      equipmentProxyImage(object.label || object.assetCode);
    image.onerror = () => {
      image.onerror = null;
      image.src = equipmentProxyImage(object.label || object.assetCode);
    };
    image.style.cssText =
      "display:block;width:100%;height:68px;object-fit:contain;background:#f5f7f9";
    label.textContent =
      object.label || source?.alt || object.assetCode || `설비 ${index + 1}`;
    label.style.cssText =
      "display:block;overflow:hidden;margin-top:5px;font-size:11px;white-space:nowrap;text-overflow:ellipsis";
    if (image.src) item.append(image);
    item.append(label);
    floor.append(item);
  }
  proxy.append(header, floor);
  document.body.append(proxy);
  document.documentElement.dataset.rtxFirstVisualMs = "0";
  document.documentElement.dataset.rtxPreviewPhase = "INSTANT_PROXY";
  return proxy;
}
function showRtxFallback(frame, status) {
  const viewer = frame?.closest("#viewer");
  if (!viewer || viewer.querySelector(".rtx-static-fallback")) return;
  const image = document.createElement("img");
  image.className = "rtx-static-fallback";
  image.alt = "선택 설비 RTX 정적 미리보기";
  image.src = `/projects/P006/digital-twin/api/rtx-preview-image?t=${Date.now()}`;
  image.style.cssText =
    "position:absolute;inset:100px 0 0;width:100%;height:calc(100% - 100px);object-fit:contain;background:#eef1f4;z-index:2";
  frame.hidden = true;
  viewer.append(image);
  removeInstantRtxProxy();
  document.documentElement.dataset.rtxVideo = "STATIC_FALLBACK";
  document.documentElement.dataset.rtxPreviewPhase = "STATIC_RTX";
  finishRtxReadiness();
  releaseRtxLease();
  if (status) status.textContent = "실시간 연결 지연 · 최신 RTX 렌더를 표시합니다.";
}
async function recoverRtxStream(frame, status, attempt = 1) {
  document.documentElement.dataset.rtxVideo = "RELOADING";
  if (status) status.textContent = "RTX 영상 연결 교체 중 (1/2)";
  try {
    if (rtxLastAssemblyObjects.length)
      await requestRtxStage({
        equipmentCode: rtxLastAssemblyObjects[0].assetCode,
        objects: rtxLastAssemblyObjects,
        structure: rtxExplicitSelection ? null : window.p006BlueprintPlan || null,
        previewFresh: true,
      });
    const url = new URL(frame.src, location.href);
    url.searchParams.set("recover", Date.now());
    if (status) status.textContent = "RTX 영상 다시 연결 중 (2/2)";
    frame.src = url.href;
    rtxReadinessRetries = Math.max(rtxReadinessRetries, attempt);
    watchRtxVideo(frame, status, attempt);
  } catch (error) {
    document.documentElement.dataset.rtxVideo = "RECOVERY_FAILED";
    document.documentElement.dataset.rtxVideoError = error.message;
    if (status) status.textContent = `RTX 자동복구 실패 · ${error.message}`;
  }
}
function watchRtxVideo(frame, status, attempt = 0) {
  const started = Date.now();
  mountRtxReadiness(frame);
  const timer = setInterval(() => {
    if (!frame?.isConnected) return clearInterval(timer);
    let ready = 0;
    try {
      ready = frame.contentDocument?.querySelector("#remote-video")?.readyState || 0;
    } catch (_) {}
    if (ready >= 2) {
      document.documentElement.dataset.rtxVideo = "READY";
      frame.hidden = false;
      frame.closest("#viewer")?.querySelector(".rtx-static-fallback")?.remove();
      removeInstantRtxProxy();
      document.documentElement.dataset.rtxPreviewPhase = "LIVE_RTX";
      if (status) status.textContent = "RTX 영상 연결 완료";
      finishRtxReadiness();
      return clearInterval(timer);
    }
    const elapsed = Date.now() - started;
    if (elapsed >= 10000) {
      document.documentElement.dataset.rtxVideo = "TIMEOUT";
      clearInterval(timer);
      if (attempt < 2) recoverRtxStream(frame, status, attempt + 1);
      else showRtxFallback(frame, status);
    }
  }, 500);
}
let rtxReadinessTimer = 0,
  rtxReadinessStarted = 0,
  rtxReadinessRetries = 0;
function currentRtxReadinessPhase(frame) {
  let videoReady = 0;
  try {
    videoReady = frame?.contentDocument?.querySelector("#remote-video")?.readyState || 0;
  } catch (_) {}
  if (videoReady >= 2) return 4;
  if (frame && frame.src !== "about:blank") return 3;
  if (document.documentElement.dataset.rtxAssemblyRequest === "ACCEPTED") return 2;
  if (document.documentElement.dataset.rtxPreviewPhase === "LIGHT_STAGE_READY") return 1;
  return 0;
}
function renderRtxReadiness(frame) {
  const overlay = document.querySelector("#viewer .rtx-readiness");
  if (!overlay) return;
  const elapsed = Math.max(0, Math.floor((Date.now() - rtxReadinessStarted) / 1000));
  const phase = currentRtxReadinessPhase(frame);
  const labels = ["GPU 워밍업", "선택 자산 Stage", "카메라 맞춤", "WebRTC 영상"];
  overlay.querySelectorAll("[data-ready-step]").forEach((item, index) => {
    item.dataset.state = index < phase ? "done" : index === phase ? "active" : "waiting";
    item.querySelector("b").textContent = index < phase ? "완료" : index === phase ? "진행 중" : "대기";
  });
  overlay.querySelector("[data-ready-elapsed]").textContent = `${elapsed}초`;
  overlay.querySelector("[data-ready-eta]").textContent = elapsed < 30 ? `약 ${Math.max(1, 30 - elapsed)}초 이내` : "지연 진단 중";
  overlay.querySelector("[data-ready-retries]").textContent = `${rtxReadinessRetries}회`;
  const diagnosis = overlay.querySelector("[data-ready-diagnosis]");
  diagnosis.hidden = elapsed < 30;
  if (elapsed >= 30) diagnosis.textContent = `${labels[Math.min(phase, 3)]} 단계가 지연되고 있습니다. 세션 자동 복구를 확인하거나 재연결을 실행하세요.`;
}
function mountRtxReadiness(frame) {
  const viewer = frame?.closest("#viewer");
  if (!viewer) return;
  if (viewer.querySelector(".rtx-readiness")) {
    renderRtxReadiness(frame);
    return;
  }
  const overlay = document.createElement("section");
  overlay.className = "rtx-readiness";
  overlay.setAttribute("role", "status");
  overlay.innerHTML = `<div class="rtx-readiness-card"><span class="rtx-ready-eyebrow">P006 RTX LIVE</span><h2>선택한 설비를 준비하고 있습니다</h2><p>기존 USD 장면이 아니라 현재 캔버스의 선택 자산을 새 Stage로 구성합니다.</p><ol>${["GPU 워밍업", "선택 자산 Stage", "카메라 맞춤", "WebRTC 영상"].map((label, index) => `<li data-ready-step="${index}" data-state="waiting"><i>${index + 1}</i><span>${label}<b>대기</b></span></li>`).join("")}</ol><dl><div><dt>경과</dt><dd data-ready-elapsed>0초</dd></div><div><dt>예상</dt><dd data-ready-eta>약 30초 이내</dd></div><div><dt>자동 재연결</dt><dd data-ready-retries>0회</dd></div></dl><p class="rtx-ready-diagnosis" data-ready-diagnosis hidden></p><button type="button" data-ready-reconnect>지금 다시 연결</button></div>`;
  viewer.append(overlay);
  overlay.querySelector("[data-ready-reconnect]").onclick = () => viewer.querySelector("[data-rtx-reconnect]")?.click();
  rtxReadinessStarted = Date.now();
  clearInterval(rtxReadinessTimer);
  renderRtxReadiness(frame);
  rtxReadinessTimer = setInterval(() => renderRtxReadiness(viewer.querySelector("iframe")), 500);
}
function finishRtxReadiness() {
  clearInterval(rtxReadinessTimer);
  const overlay = document.querySelector("#viewer .rtx-readiness");
  if (!overlay) return;
  overlay.classList.add("is-ready");
  setTimeout(() => overlay.remove(), 450);
}
document.documentElement.dataset.rtxPreviewModule = "v9";
function prepareRtxButton() {
  const selected=[...document.querySelectorAll("#workspace .object[data-asset]")],
    first = selected[0];
  // The primary preview is a canvas preview. A lingering editor selection must
  // never collapse a 180-object canvas into a one-object RTX stage.
  rtxExplicitSelection=false;
  if (first) {
    rtxSelectedEquipmentCode = first.dataset.asset || "";
    rtxSelectedEquipmentName =
      first.querySelector("span,strong")?.textContent?.trim() ||
      first.title ||
      rtxSelectedEquipmentCode;
  }
  rtxWorkspaceCount = selected.length;
  const button = document.querySelector("#rtx"),
    toolbar = document.querySelector("[data-workbench-toolbar]");
  if (!button) return;
  if (toolbar && button.parentElement !== toolbar) {
    button.classList.remove("preview");
    toolbar.append(button);
  }
  button.disabled = !rtxWorkspaceCount;
  button.textContent = rtxWorkspaceCount
    ? `${rtxExplicitSelection?'선택 설비':'캔버스 전체'} ${rtxWorkspaceCount}개 RTX 미리보기`
    : "설비를 배치한 후 RTX 보기";
  button.title = rtxWorkspaceCount
    ? rtxExplicitSelection?"현재 선택한 설비만 빈 Stage에 생성합니다.":"현재 캔버스의 전체 설비를 새 Stage에 생성합니다."
    : "캔버스에 설비를 먼저 배치하세요.";
  if (!button.dataset.selectedRtxBound) {
    button.dataset.selectedRtxBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      prepareRtxButton();
      openSelectedEquipmentRtx(button);
    });
  }
}
async function requestRtxStage(payload) {
  const url = `/r/P006/actuator/p006/stage-focus`,
    response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ ...payload, rtxSlot: rtxLeaseSlot }),
    }),
    body = await response.json();
  if (!response.ok)
    throw new Error(body.message || `Stage HTTP ${response.status}`);
  return body;
}
async function openSelectedEquipmentRtx(button) {
  const viewer = document.querySelector("#viewer"),
    status =
      document.querySelector("#progress") || document.querySelector("#status"),
    root = document.documentElement,
    connectedFrame = viewer?.querySelector("iframe");
  root.dataset.rtxOpenStage = "CLICKED";
  if (!rtxWorkspaceCount) {
    root.dataset.rtxOpenStage = "NO_OBJECTS";
    if (status) status.textContent = "RTX로 볼 설비를 캔버스에 먼저 배치하세요.";
    return;
  }
  button.disabled = true;
  button.textContent = `${rtxExplicitSelection?'선택 설비':'캔버스 전체'} ${rtxWorkspaceCount}개 생성 중`;
  try {
    root.dataset.rtxOpenStage = "SELECTION_SERIALIZE";
    const targets=[...document.querySelectorAll("#workspace .object[data-asset]")],objects=targets.map((item) => {
      const rotate = /rotate\((-?[\d.]+)deg\)/.exec(item.style.transform || ""),
        scale = /scale\(([\d.]+)\)/.exec(item.style.transform || "");
      return {
        objectId:
          item.dataset.id || item.dataset.objectId || rtxUuid(),
        assetCode: item.dataset.asset,
        x: parseFloat(item.style.left) || 50,
        y: parseFloat(item.style.top) || 50,
        rotationY: Number(rotate?.[1] || 0),
        scale: Number(scale?.[1] || 1),
        preview: (() => {
          const image = item.querySelector("img");
          return image?.complete && image?.naturalWidth
            ? image.currentSrc || image.src
            : "";
        })(),
        label:
          item.querySelector("span,strong")?.textContent?.trim() ||
          item.dataset.asset,
      };
    });
    if (!objects.length) throw new Error("선택된 설비가 없습니다.");
    rtxLastAssemblyObjects = objects;
    const instantStarted = performance.now(),
      instantProxy = showInstantRtxProxy(objects);
    root.dataset.rtxFirstVisualMs = String(
      Math.max(0, Math.round(performance.now() - instantStarted)),
    );
    root.dataset.rtxOpenStage = "ASSEMBLY_STAGE";
    await acquireRtxLease(status);
    await acquireRtxObjectLocks(objects);
    button.textContent = `선택 설비 ${objects.length}개 RTX 준비 중`;
    if (status)
      status.textContent = "연결된 RTX 화면에 선택 설비를 반영하고 있습니다.";
    const started = performance.now(),
      stage = await requestRtxStage({
        equipmentCode: objects[0].assetCode,
        objects,
        structure: rtxExplicitSelection ? null : window.p006BlueprintPlan || null,
        previewFresh: true,
      });
    root.dataset.rtxAssemblyRequestMs = String(
      Math.round(performance.now() - started),
    );
    root.dataset.rtxAssemblyRequest = "ACCEPTED";
    root.dataset.rtxAssemblyObjectCount = String(objects.length);
    root.dataset.rtxStageRequestedObjects = String(
      stage.requestedObjects ?? objects.length,
    );
    root.dataset.rtxStagePlacedObjects = String(
      stage.placedObjects ?? objects.length,
    );
    if (
      Number(stage.requestedObjects ?? objects.length) !== objects.length ||
      Number(stage.placedObjects ?? objects.length) !== objects.length
    ) {
      throw new Error(
        `RTX Stage 개수 불일치 · 요청 ${objects.length} / 생성 ${stage.placedObjects ?? 0}`,
      );
    }
    root.dataset.rtxAssemblyStage = stage.stagePath || stage.stage || "READY";
    instantProxy.querySelector("[data-proxy-status]").textContent =
      "2단계 · 경량 Stage 준비 완료. 실시간 RTX 영상으로 전환 중입니다.";
    root.dataset.rtxPreviewPhase = "LIGHT_STAGE_READY";
    root.dataset.rtxOpenStage = "FRAME";
    viewer.dataset.equipmentName = `선택 설비 ${objects.length}개`;
    viewer.dataset.objectCount = String(objects.length);
    const streamUrl = `/admin/digital-twin/woosu-factory/?view=viewport&assembly=1&selected=${rtxExplicitSelection ? 1 : 0}&signalingPort=${49100 + rtxLeaseSlot}&mediaPort=${47997 + rtxLeaseSlot}`;
    if (connectedFrame) {
      connectedFrame.title = `${rtxExplicitSelection ? "선택 설비" : "캔버스 전체"} RTX 미리보기`;
      if (connectedFrame.getAttribute("src") !== streamUrl)
        connectedFrame.setAttribute("src", streamUrl);
      connectedFrame.classList.remove("rtx-preconnect-frame");
      connectedFrame.removeAttribute("style");
      mountRtxPreviewModal();
    } else {
      viewer.innerHTML = `<iframe title="${rtxExplicitSelection ? "선택 설비" : "캔버스 전체"} RTX 미리보기" src="${streamUrl}"></iframe>`;
    }
    requestAnimationFrame(() =>
      watchRtxVideo(viewer.querySelector("iframe"), status),
    );
    if (status)
      status.textContent = `선택 설비 ${objects.length}개 반영 요청 완료`;
    button.textContent = `선택 설비 ${objects.length}개 RTX 열림`;
  } catch (error) {
    await releaseRtxObjectLocks();
    root.dataset.rtxOpenStage = "ERROR";
    root.dataset.rtxOpenError = error.message;
    if (status) status.textContent = `선택 설비 RTX 실패 · ${error.message}`;
    const proxyStatus = document.querySelector(
      ".rtx-instant-proxy [data-proxy-status]",
    );
    if (proxyStatus)
      proxyStatus.textContent = `선택 배치는 유지합니다. RTX 연결 실패 · ${error.message}`;
    button.textContent = "선택 설비 RTX 재시도";
  } finally {
    button.disabled = false;
  }
}

const versionEnvironment = {
  camera: "overview",
  lighting: "neutral",
  floor: "epoxy",
};
async function versionRequest(path, body) {
  const response = await fetch(
      `/projects/P006/digital-twin/api/factory-versions${path}`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {}),
      },
    ),
    result = await response.json();
  if (!response.ok)
    throw new Error(result.message || `버전 HTTP ${response.status}`);
  return result;
}
async function saveRtxVersion(label, sourceAction) {
  return versionRequest("", {
    versionName: `${label} ${new Date().toLocaleString("ko-KR")}`,
    environment: versionEnvironment,
    sourceAction,
  });
}
async function refreshVersionedScene() {
  const scene = await fetch("/r/P006/actuator/p006/factory-scenes/default", {
      credentials: "include",
      cache: "no-store",
    }).then((r) => r.json()),
    sync = await fetch("/projects/P006/digital-twin/api/sync-usd", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(scene),
    });
  if (!sync.ok) throw new Error(`USD 동기화 HTTP ${sync.status}`);
  document.querySelector("#reload")?.click();
}
async function runVersionAction(button, action) {
  const original = button.textContent;
  button.disabled = true;
  try {
    button.textContent = "처리 중";
    let path = `/${action}`;
    if (action === "approve") {
      const versions = await fetch(
          "/projects/P006/digital-twin/api/factory-versions",
          { credentials: "include", cache: "no-store" },
        ).then((r) => r.json()),
        id = versions.cursor?.current_version_id;
      if (!id) throw new Error("승인할 현재 버전이 없습니다.");
      path = `/${id}/approve`;
    }
    if (action === "rollback") {
      const versions = await fetch(
          "/projects/P006/digital-twin/api/factory-versions",
          { credentials: "include", cache: "no-store" },
        ).then((r) => r.json()),
        approved = (versions.versions || []).find(
          (v) => v.version_status === "APPROVED",
        );
      if (!approved) throw new Error("승인된 버전이 없습니다.");
      path = `/${approved.version_id}/rollback`;
    }
    const result = await versionRequest(path);
    if (action !== "approve") await refreshVersionedScene();
    button.textContent = `완료 · #${result.versionId}`;
    document.documentElement.dataset.rtxVersionStatus = action.toUpperCase();
  } catch (error) {
    button.textContent = `실패 · ${error.message}`;
    document.documentElement.dataset.rtxVersionStatus = "FAIL";
  } finally {
    button.disabled = false;
    setTimeout(() => {
      if (button.isConnected) button.textContent = original;
    }, 3500);
  }
}
async function importRtxAssembly(button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "가져오기 전 자동 백업";
  try {
    await saveRtxVersion("RTX 가져오기 전", "RTX_PRE_IMPORT");
    const url = `/projects/P006/stage-assembly-layout?slot=${rtxLeaseSlot}`,
      response = await fetch(url, {
        credentials: "include",
        cache: "no-store",
      }),
      state = await response.json();
    if (!response.ok)
      throw new Error(state.message || `상태 HTTP ${response.status}`);
    const objects = (state.objects || []).filter((item) => item.objectId);
    for (let index = 0; index < objects.length; index += 8) {
      await Promise.all(
        objects.slice(index, index + 8).map(async (item) => {
          const saved = await fetch(
            "/projects/P006/digital-twin/api/factory-scenes/default/objects",
            {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                objectId: item.objectId,
                assetCode: item.assetCode,
                x: item.x,
                y: item.y,
                rotationY: item.rotationY,
                scale: item.scale,
              }),
            },
          );
          if (!saved.ok) throw new Error(`DB 저장 HTTP ${saved.status}`);
        }),
      );
      button.textContent = `DB 저장 ${Math.min(index + 8, objects.length)}/${objects.length}`;
    }
    await refreshVersionedScene();
    const version = await saveRtxVersion("RTX 배치", "RTX_IMPORT");
    button.textContent = `RTX 배치 ${objects.length}개 · 버전 #${version.versionId}`;
    document.documentElement.dataset.rtxImportStatus = "PASS";
  } catch (error) {
    button.textContent = `가져오기 실패 · ${error.message}`;
    document.documentElement.dataset.rtxImportStatus = "FAIL";
    document.documentElement.dataset.rtxImportError = error.message;
  } finally {
    button.disabled = false;
    setTimeout(() => {
      if (button.isConnected) button.textContent = original;
    }, 4000);
  }
}
function applyRtxObjectToCanvas(item) {
  const object = [...document.querySelectorAll("#workspace .object[data-asset]")].find(
    (node) => (node.dataset.id || node.dataset.objectId) === item.objectId,
  );
  if (!object) return false;
  object.style.left = `${item.x}%`;
  object.style.top = `${item.y}%`;
  object.style.transform = `translate(-50%, -50%) rotate(${item.rotationY}deg) scale(${item.scale})`;
  return true;
}
function connectRtxReverseSyncEvents() {
  if (window.__p006ReverseSyncEvents) return;
  const events = new EventSource(
    "/projects/P006/digital-twin/api/rtx-reverse-sync-events",
    { withCredentials: true },
  );
  window.__p006ReverseSyncEvents = events;
  events.addEventListener("ready", () => {
    document.documentElement.dataset.rtxReverseSyncChannel = "CONNECTED";
  });
  events.addEventListener("transform", (event) => {
    try {
      const result = JSON.parse(event.data),
        changed = (result.objects || []).reduce(
          (count, item) => count + Number(applyRtxObjectToCanvas(item)),
          0,
        );
      for (const editor of result.lastEditors || []) {
        const object = [...document.querySelectorAll("#workspace .object[data-asset]")].find(
          (node) => (node.dataset.id || node.dataset.objectId) === editor.objectId,
        );
        if (!object) continue;
        object.dataset.lastEditor = editor.editorLabel || "RTX 사용자";
        object.dataset.lastEditedAt = editor.updatedAt || result.updatedAt || "";
        let badge = object.querySelector(".rtx-last-editor");
        if (!badge) {
          badge = document.createElement("small");
          badge.className = "rtx-last-editor";
          badge.style.cssText = "position:absolute;left:4px;bottom:4px;padding:2px 5px;border-radius:4px;background:#123b52;color:white;font-size:10px;z-index:4";
          object.append(badge);
        }
        badge.textContent = `수정: ${editor.editorLabel || "RTX 사용자"}`;
      }
      document.documentElement.dataset.rtxReverseSync = result.status;
      document.documentElement.dataset.rtxReverseSyncCount = String(changed);
      document.querySelector(".rtx-version-actions [data-rtx-reverse-sync]")?.replaceChildren(
        `실시간 역반영 완료 · ${changed}개 · ${new Date().toLocaleTimeString("ko-KR")}`,
      );
    } catch (error) {
      document.documentElement.dataset.rtxReverseSync = "EVENT_ERROR";
    }
  });
  events.addEventListener("lock", (event) => {
    try {
      const result = JSON.parse(event.data),
        locks = new Map((result.locks || []).map((lock) => [lock.objectId, lock]));
      for (const object of document.querySelectorAll("#workspace .object[data-asset]")) {
        const id = object.dataset.id || object.dataset.objectId,
          lock = locks.get(id),
          mine = lock?.clientId === rtxLeaseClientId;
        object.classList.toggle("rtx-locked-by-other", Boolean(lock && !mine));
        object.dataset.lockOwner = lock?.editorLabel || "";
        if (lock && !mine) {
          object.title = `${lock.editorLabel} 편집 중`;
          object.style.outline = "3px solid #d63b2f";
          object.style.cursor = "not-allowed";
        } else {
          object.style.removeProperty("outline");
          object.style.removeProperty("cursor");
        }
      }
      document.documentElement.dataset.rtxLockCount = String(locks.size);
    } catch (_) {}
  });
  events.onerror = () => {
    document.documentElement.dataset.rtxReverseSyncChannel = "RECONNECTING";
  };
}
async function persistRtxEditState(state, indicator) {
  const objects = (state.objects || []).filter((item) => item.objectId);
  for (let index = 0; index < objects.length; index += 8) {
    await Promise.all(
      objects.slice(index, index + 8).map(async (item) => {
        const response = await fetch(
          "/projects/P006/digital-twin/api/factory-scenes/default/objects",
          {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(item),
          },
        );
        if (!response.ok) throw new Error(`DB 저장 HTTP ${response.status}`);
        applyRtxObjectToCanvas(item);
      }),
    );
  }
  rtxLastAssemblyObjects = objects;
  document.documentElement.dataset.rtxReverseSync = "SAVED";
  document.documentElement.dataset.rtxReverseSyncCount = String(objects.length);
  if (indicator)
    indicator.textContent = `자동 역반영 완료 · ${objects.length}개 · ${new Date().toLocaleTimeString("ko-KR")}`;
}
function stopRtxReverseSync() {
  clearInterval(rtxReverseSyncTimer);
  rtxReverseSyncTimer = 0;
  rtxReverseSyncSignature = "";
  rtxReverseSyncBusy = false;
}
function startRtxReverseSync(indicator) {
  stopRtxReverseSync();
  let initialized = false;
  const poll = async () => {
    if (rtxReverseSyncBusy || !document.documentElement.classList.contains("rtx-preview-open")) return;
    rtxReverseSyncBusy = true;
    try {
      const response = await fetch(
        `/projects/P006/stage-assembly-layout?slot=${rtxLeaseSlot}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) throw new Error(`편집 상태 조회 HTTP ${response.status} · slot=${rtxLeaseSlot}`);
      const state = await response.json(),
        signature = JSON.stringify(state.objects || []);
      if (!initialized) {
        initialized = true;
        rtxReverseSyncSignature = signature;
        if (indicator) indicator.textContent = "Omniverse 변경 자동 저장 대기 중";
      } else if (signature !== rtxReverseSyncSignature) {
        rtxReverseSyncSignature = signature;
        if (indicator) indicator.textContent = "Omniverse 변경 감지 · DB 저장 중";
        await persistRtxEditState(state, indicator);
      }
    } catch (error) {
      document.documentElement.dataset.rtxReverseSync = "ERROR";
      document.documentElement.dataset.rtxReverseSyncError = error.message;
      if (indicator) indicator.textContent = `자동 역반영 실패 · /projects/P006/stage-assembly-layout?slot=${rtxLeaseSlot} · ${error.message}`;
    } finally {
      rtxReverseSyncBusy = false;
    }
  };
  poll();
  rtxReverseSyncTimer = setInterval(poll, 1000);
}
function mountRtxPreviewModal() {
  if (!location.pathname.endsWith("/factory-studio")) return;
  prepareRtxButton();
  const viewer = document.querySelector("#viewer"),
    frame = viewer?.querySelector("iframe");
  if (
    !viewer ||
    !frame ||
    frame.classList.contains("rtx-preconnect-frame") ||
    viewer.classList.contains("rtx-preview-modal")
  )
    return;
  viewer.classList.add("rtx-preview-modal");
  document.documentElement.classList.add("rtx-preview-open");
  const header = document.createElement("header");
  header.className = "rtx-preview-header";
  header.innerHTML = `<strong>새 USD 도화지 · ${viewer.dataset.equipmentName || "작업공간 조립"} RTX</strong><span>현재 배치 전체 표시 · 좌클릭 회전 · 우클릭 이동 · 휠 확대</span><button type="button" data-rtx-reconnect>뷰어 재연결</button><button type="button" data-rtx-close>닫기</button>`;
  const actions = document.createElement("nav");
  actions.className = "rtx-version-actions";
  actions.innerHTML =
    '<strong>배치 이력</strong><button type="button" data-version="undo">실행 취소</button><button type="button" data-version="redo">다시 실행</button><button type="button" data-rtx-import>RTX 배치 가져오기</button><button type="button" data-version="approve">현재 버전 승인</button><button type="button" data-version="rollback">승인 버전 롤백</button><span data-rtx-reverse-sync>Omniverse 변경 자동 저장 준비 중</span>';
  viewer.prepend(header);
  header.after(actions);
  actions.querySelector("[data-rtx-import]").onclick = (event) =>
    importRtxAssembly(event.currentTarget);
  actions
    .querySelectorAll("[data-version]")
    .forEach(
      (button) =>
        (button.onclick = (event) =>
          runVersionAction(
            event.currentTarget,
            event.currentTarget.dataset.version,
          )),
    );
  startRtxReverseSync(actions.querySelector("[data-rtx-reverse-sync]"));
  header.querySelector("[data-rtx-close]").onclick = async () => {
    stopRtxReverseSync();
    cleanupRtxPreviewArtifacts(viewer, frame);
    await releaseRtxLease();
    try {
      rtxReadinessRetries += 1;
      await requestRtxStage({ action: "restore" });
    } catch (error) {
      document.documentElement.dataset.rtxRestoreError = error.message;
    }
    prepareRtxButton();
    document.querySelector("#rtx")?.focus();
  };
  header.querySelector("[data-rtx-reconnect]").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const url = new URL(frame.src, location.href),
      resetUrl = new URL("api/reset", url);
    url.searchParams.set("reconnect", Date.now());
    frame.src = "about:blank";
    button.textContent = "기존 세션 정리 중";
    try {
      const response = await fetch(resetUrl, {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      button.textContent = "RTX 영상 연결 중";
      frame.src = url.href;
      watchRtxVideo(frame, actions.querySelector("[data-rtx-reverse-sync]"));
      setTimeout(() => {
        button.disabled = false;
        button.textContent = "뷰어 재연결";
      }, 5000);
    } catch (error) {
      button.disabled = false;
      button.textContent = "재연결 다시 시도";
      document.documentElement.dataset.rtxReconnectError = error.message;
    }
  };
  frame.focus();
}
function preconnectRtxPreview() {
  if (!location.pathname.endsWith("/factory-studio")) return;
  // Kit Direct WebRTC accepts one browser owner. A hidden eager iframe used
  // to reserve that slot on every studio tab and made the visible preview
  // wait or stay white. Connect only after the explicit preview action.
  document.documentElement.dataset.rtxPreconnect = "ON_DEMAND_SINGLE_OWNER";
}
function scheduleRtxPreviewModal() {
  if (rtxPreviewQueued) return;
  rtxPreviewQueued = true;
  requestAnimationFrame(() => {
    rtxPreviewQueued = false;
    preconnectRtxPreview();
    mountRtxPreviewModal();
  });
}
document.addEventListener(
  "click",
  (event) => {
    const equipment = event.target.closest(
      "#workspace .object[data-asset],.asset-card[data-asset]",
    );
    if (equipment) {
      rtxSelectedEquipmentCode = equipment.dataset.asset || "";
      rtxSelectedEquipmentName =
        equipment.querySelector("span,strong")?.textContent?.trim() ||
        equipment.title ||
        rtxSelectedEquipmentCode;
      document.documentElement.dataset.rtxSelected = rtxSelectedEquipmentCode;
      setTimeout(prepareRtxButton, 50);
      setTimeout(prepareRtxButton, 300);
      setTimeout(prepareRtxButton, 1000);
    }
  },
  true,
);
new MutationObserver(scheduleRtxPreviewModal).observe(
  document.documentElement,
  {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "disabled"],
  },
);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape")
    document
      .querySelector("#viewer.rtx-preview-modal [data-rtx-close]")
      ?.click();
});
scheduleRtxPreviewModal();
requestAnimationFrame(preconnectRtxPreview);
connectRtxReverseSyncEvents();
window.addEventListener("pagehide", () => {
  if (document.documentElement.dataset.rtxLease === "ACQUIRED") {
    const body = JSON.stringify({ clientId: rtxLeaseClientId });
    navigator.sendBeacon(
      `/projects/P006/digital-twin/api/rtx-session/release`,
      new Blob([body], { type: "text/plain;charset=UTF-8" }),
    );
  }
});
document.addEventListener(
  "click",
  async (event) => {
    const button = event.target.closest("[data-rtx-reconnect]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const viewer = button.closest("#viewer"),
      oldFrame = viewer?.querySelector("iframe");
    if (!viewer || !oldFrame) return;
    button.disabled = true;
    button.textContent = "기존 세션 정리 중";
    const url = new URL(oldFrame.src, location.href);
    url.searchParams.delete("fresh");
    url.searchParams.delete("reconnect");
    url.searchParams.set("session", Date.now());
    const placeholder = document.createElement("iframe");
    placeholder.title = oldFrame.title;
    placeholder.src = "about:blank";
    oldFrame.replaceWith(placeholder);
    try {
      const response = await fetch(
        "/admin/digital-twin/woosu-factory/api/reset",
        { method: "POST", cache: "no-store" },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (rtxLastAssemblyObjects.length)
        await requestRtxStage({
          equipmentCode: rtxLastAssemblyObjects[0].assetCode,
          objects: rtxLastAssemblyObjects,
          previewFresh: true,
        });
      const next = document.createElement("iframe");
      next.title = placeholder.title;
      next.src = url.href;
      placeholder.replaceWith(next);
      rtxReadinessRetries += 1;
      watchRtxVideo(next, viewer.querySelector("[data-rtx-reverse-sync]"));
      button.textContent = "선택 설비 다시 연결 중";
      setTimeout(() => {
        button.disabled = false;
        button.textContent = "뷰어 재연결";
      }, 5000);
    } catch (error) {
      button.disabled = false;
      button.textContent = "재연결 다시 시도";
      document.documentElement.dataset.rtxReconnectError = error.message;
    }
  },
  true,
);
