async function mountAssetLayoutPlan() {
  const plan = await fetch('/projects/P006/assets/catalog/asset-layout-plan.json', { cache: 'no-store' }).then((r) => r.json());
  const mount = () => {
    const tabs = document.querySelector('.catalog-tabs');
    if (!tabs || document.querySelector('.asset-layout-plan')) return;
    const box = document.createElement('section');
    box.className = `asset-layout-plan ${plan.status === 'PASS' ? 'pass' : 'fail'}`;
    box.innerHTML = `<header><div><b>128개 안전배치 계획</b><span>충돌 ${plan.collisionCount} · 경계위반 ${plan.boundaryViolationCount} · 검토 ${plan.reviewRequiredCount}</span></div><button type="button" class="btn" data-plan-preview>배치도 보기</button><button type="button" class="btn primary" data-plan-apply ${plan.status !== 'PASS' ? 'disabled' : ''}>128개 계획 적용</button></header><div class="asset-plan-map" hidden></div><p aria-live="polite"></p>`;
    tabs.before(box);
    const map = box.querySelector('.asset-plan-map');
    const status = box.querySelector('p');
    map.innerHTML = plan.placements.map((x) => `<i title="${x.assetId} · ${x.variantCode}" style="left:${x.xMm / plan.factoryWidthMm * 100}%;top:${x.yMm / plan.factoryHeightMm * 100}%;width:${Math.max(.35, x.widthMm / plan.factoryWidthMm * 100)}%;height:${Math.max(.7, x.depthMm / plan.factoryHeightMm * 100)}%"></i>`).join('');
    box.querySelector('[data-plan-preview]').onclick = (event) => { map.hidden = !map.hidden; event.target.textContent = map.hidden ? '배치도 보기' : '배치도 닫기'; };
    box.querySelector('[data-plan-apply]').onclick = async (event) => {
      if (!confirm('검증된 128개 자산 배치를 현재 장면에 적용하시겠습니까? 같은 자산은 새로 만들지 않고 위치만 갱신합니다.')) return;
      event.target.disabled = true;
      try {
        const sceneUrl = '/r/P006/actuator/p006/factory-scenes/default';
        const scene = await fetch(sceneUrl, { credentials: 'include', cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(`장면 조회 HTTP ${r.status}`); return r.json(); });
        const existing = new Map();
        for (const object of scene.objects || []) if (!existing.has(object.assetCode)) existing.set(object.assetCode, object);
        let saved = 0, created = 0, updated = 0;
        for (let start = 0; start < plan.placements.length; start += 8) {
          await Promise.all(plan.placements.slice(start, start + 8).map(async (x) => {
            const prior = existing.get(x.assetCode);
            const response = await fetch(`${sceneUrl}/objects`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ objectId: prior?.objectId || null, assetCode: x.assetCode, x: +(x.xMm / plan.factoryWidthMm * 100).toFixed(2), y: +(x.yMm / plan.factoryHeightMm * 100).toFixed(2), rotationY: x.rotationY }) });
            if (!response.ok) throw new Error(`저장 HTTP ${response.status}`);
            saved += 1; prior ? updated += 1 : created += 1;
          }));
          status.textContent = `안전 배치 저장 ${saved}/128`;
        }
        const refreshed = await fetch(sceneUrl, { credentials: 'include', cache: 'no-store' }).then((r) => r.json());
        const usd = await fetch('/projects/P006/sync-usd', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(refreshed) }).then((r) => { if (!r.ok) throw new Error(`USD 동기화 HTTP ${r.status}`); return r.json(); });
        document.querySelector('#reload')?.click();
        status.textContent = `128개 계획 적용 완료 · 생성 ${created} · 갱신 ${updated} · USD 3D ${usd.catalog3dObjects ?? 128}`;
      } catch (error) { status.textContent = `적용 실패: ${error.message}`; }
      finally { event.target.disabled = false; }
    };
  };
  mount();
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; mount(); }); }).observe(document.documentElement, { childList: true, subtree: true });
}
mountAssetLayoutPlan().catch(console.error);
