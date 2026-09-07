const P006_SCENE_API = "/r/P006/actuator/p006/factory-scenes/default";
const P006_CATALOG_API = "/projects/P006/assets/catalog/manifest.json";
let p006BatchSelection = new Set();
let p006BatchBusy = false;

async function p006BatchRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
  return body;
}

function p006PlacementCode(card) {
  return card?.dataset.asset || "";
}

function p006RefreshBatchUi() {
  document.querySelectorAll(".composer-asset[data-asset]").forEach((card) => {
    const selected = p006BatchSelection.has(p006PlacementCode(card));
    card.classList.toggle("batch-selected", selected);
    card.setAttribute("aria-selected", String(selected));
  });
  const count = p006BatchSelection.size;
  const countNode = document.querySelector("[data-batch-selection-count]");
  const placeButton = document.querySelector("[data-batch-place]");
  if (countNode) countNode.textContent = `선택 ${count.toLocaleString()}개`;
  if (placeButton) {
    placeButton.disabled = !count || p006BatchBusy;
    placeButton.textContent = count
      ? `선택 ${count.toLocaleString()}개 자동배치`
      : "자산을 선택하세요";
  }
  document.documentElement.dataset.p006BatchSelected = String(count);
}

function p006GridPosition(index, total) {
  const columns = Math.max(4, Math.ceil(Math.sqrt(total * 1.55)));
  const rows = Math.max(1, Math.ceil(total / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);
  return {
    x: +(5 + (column * 90) / Math.max(1, columns - 1)).toFixed(2),
    y: +(7 + (row * 86) / Math.max(1, rows - 1)).toFixed(2),
    rotationY: 0,
    scale: total > 120 ? 0.55 : total > 60 ? 0.7 : 1,
  };
}

async function p006RunLimited(items, limit, worker, progress) {
  let next = 0;
  let completed = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
      completed += 1;
      progress?.(completed, items.length);
    }
  });
  await Promise.all(runners);
}

async function p006SyncBatchUsd() {
  const scene = await p006BatchRequest(
    "/projects/P006/digital-twin/api/factory-scenes/default",
    { cache: "no-store" },
  );
  const response = await fetch("/projects/P006/sync-usd", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(scene),
  });
  if (!response.ok) throw new Error(`USD HTTP ${response.status}`);
}

async function p006PlaceAssets(assetCodes, anchor = { x: 50, y: 50 }) {
  const codes = [...new Set(assetCodes.filter(Boolean))];
  if (!codes.length || p006BatchBusy) return;
  p006BatchBusy = true;
  p006RefreshBatchUi();
  const status = document.querySelector("#status");
  try {
    await p006RunLimited(
      codes,
      8,
      (assetCode, index) => {
        const position = p006GridPosition(index, codes.length);
        if (codes.length === 1) Object.assign(position, anchor);
        return p006BatchRequest(P006_SCENE_API + "/objects", {
          method: "POST",
          body: JSON.stringify({ assetCode, ...position }),
        });
      },
      (done, total) => {
        if (status) status.textContent = `다중 자산 DB 생성 ${done}/${total}`;
      },
    );
    await p006SyncBatchUsd();
    document.documentElement.dataset.p006BatchPlaced = String(codes.length);
    if (status) status.textContent = `다중 자산 ${codes.length}개 자동배치 완료 · DB·USD 동기화`;
    document.querySelector("#reload")?.click();
  } finally {
    p006BatchBusy = false;
    p006BatchSelection.clear();
    p006RefreshBatchUi();
  }
}

async function p006SelectAllPlaceable(button) {
  button.disabled = true;
  button.textContent = "드래그 가능 자산 계산 중";
  try {
    const manifest = await fetch(P006_CATALOG_API, { cache: "no-store" }).then((r) => r.json());
    p006BatchSelection = new Set(
      (manifest.assets || [])
        .filter((item) => ["PLACEABLE", "PROMOTED_MODULE"].includes(item.compositionStatus))
        .map((item) => `catalog_${String(item.id).toLowerCase()}`),
    );
    p006RefreshBatchUi();
  } finally {
    button.disabled = false;
    button.textContent = "드래그 가능 전체 선택";
  }
}

function p006MountBatchToolbar() {
  const composer = document.querySelector("[data-factory-composer]");
  if (!composer || composer.querySelector("[data-batch-toolbar]")) return;
  const toolbar = document.createElement("div");
  toolbar.dataset.batchToolbar = "true";
  toolbar.className = "composer-batch-toolbar";
  toolbar.innerHTML = '<strong data-batch-selection-count>선택 0개</strong><button type="button" data-batch-select-all>드래그 가능 전체 선택</button><button type="button" data-batch-clear>선택 해제</button><button type="button" data-batch-place disabled>자산을 선택하세요</button><small>클릭 다중 선택 → 한 번에 드롭 또는 자동배치</small>';
  composer.querySelector("header")?.after(toolbar);
  toolbar.querySelector("[data-batch-select-all]").onclick = (event) =>
    p006SelectAllPlaceable(event.currentTarget);
  toolbar.querySelector("[data-batch-clear]").onclick = () => {
    p006BatchSelection.clear();
    p006RefreshBatchUi();
  };
  toolbar.querySelector("[data-batch-place]").onclick = () =>
    p006PlaceAssets([...p006BatchSelection]);
  p006RefreshBatchUi();
}

document.addEventListener("click", (event) => {
  const card = event.target.closest(".composer-asset[data-asset]");
  if (!card || event.target.closest("button,a,input,select")) return;
  const code = p006PlacementCode(card);
  if (p006BatchSelection.has(code)) p006BatchSelection.delete(code);
  else p006BatchSelection.add(code);
  p006RefreshBatchUi();
});

document.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".composer-asset[data-asset],.p006-library-card[data-asset],.asset-card[data-asset]");
  if (!card) return;
  const code = p006PlacementCode(card);
  const assetCodes = p006BatchSelection.has(code)
    ? [...p006BatchSelection]
    : [code];
  event.dataTransfer.setData("application/json", JSON.stringify({ assetCode: code, assetCodes }));
}, false);

document.addEventListener("drop", (event) => {
  const workspace = event.target.closest("#workspace");
  if (!workspace) return;
  let payload;
  try { payload = JSON.parse(event.dataTransfer.getData("application/json")); }
  catch (_) { return; }
  if (!Array.isArray(payload.assetCodes) || payload.assetCodes.length < 2) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const bounds = workspace.getBoundingClientRect();
  p006PlaceAssets(payload.assetCodes, {
    x: +(((event.clientX - bounds.left) / bounds.width) * 100).toFixed(2),
    y: +(((event.clientY - bounds.top) / bounds.height) * 100).toFixed(2),
  }).catch((error) => {
    document.documentElement.dataset.p006BatchError = error.message;
  });
}, true);

const p006BatchObserver = new MutationObserver(() => {
  p006MountBatchToolbar();
  p006RefreshBatchUi();
});
p006BatchObserver.observe(document.documentElement, { childList: true, subtree: true });
p006MountBatchToolbar();

