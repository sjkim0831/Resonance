(() => {
  const API = '/projects/P006/registry-api/assets';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let mode = 'all', debounce, cursor = '', busy = false, pendingReset = false, queryToken = 0, importedSignature = '', importedHost = null, total = null, catalogError = '';
  const nvidiaPallet = {id:'nvidia-industrial-pallet-a1',name:'산업용 팔레트 A1',provider:'NVIDIA Omniverse',format:'GLB',path:'/projects/P006/assets/nvidia-library/industrial/Pallet_A1.glb',url:'/projects/P006/assets/nvidia-library/industrial/Pallet_A1.glb',thumbnail:'/projects/P006/assets/nvidia-library/industrial/Pallet_A1.png',sourceUri:'https://docs.omniverse.nvidia.com/usd/latest/usd_content_samples/downloadable_packs.html'};
  const state = () => { const detail = {}; document.dispatchEvent(new CustomEvent('p006:studio-library-state', {detail})); return detail; };
  const image = (src, alt) => src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" style="width:48px;height:44px;object-fit:contain;background:#eef3f5;border-radius:5px">` : '<span class="thumb" style="width:48px;height:44px">3D</span>';
  function setup() {
    const input = document.querySelector('#asset-search'), list = document.querySelector('.studio .asset-list');
    if (!input || !list || input.dataset.unified === '1') return;
    input.dataset.unified = '1';
    const hideStyle = document.createElement('style'); hideStyle.id = 'unified-asset-hidden-style'; hideStyle.textContent = '.studio .asset-card[hidden],#unified-registry-results[hidden],#unified-asset-detail[hidden],#unified-more[hidden],[data-imported-card] button[hidden]{display:none!important}#unified-asset-controls,#unified-registry-results{box-sizing:border-box;width:100%;min-width:0;max-width:100%}#unified-registry-results{max-height:440px;overflow:auto}#unified-registry-results .catalog-row{box-sizing:border-box;display:grid!important;grid-template-columns:48px minmax(0,1fr)!important;gap:8px!important;width:100%!important;min-width:0!important;max-width:100%;overflow:hidden}#unified-registry-results .catalog-row>img{width:48px;height:44px;max-width:48px;flex:none;grid-column:1;grid-row:1}#unified-registry-results .catalog-row>[data-catalog-select]{box-sizing:border-box;display:block!important;grid-column:2;grid-row:1;width:100%;min-width:0;max-width:100%;padding:0!important;text-align:left;white-space:normal!important;overflow-wrap:anywhere;word-break:keep-all;line-height:1.4}#unified-registry-results .catalog-row>[data-catalog-select] small{max-width:100%;white-space:normal;overflow-wrap:anywhere;word-break:keep-all;line-height:1.4}#unified-registry-results .catalog-row>.catalog-actions{grid-column:1/-1;display:flex;justify-content:flex-end;flex-wrap:wrap;gap:5px;min-width:0}#unified-registry-results .catalog-row>.catalog-actions button{width:auto;max-width:100%;white-space:normal;overflow-wrap:anywhere}#unified-asset-controls [data-scope]{white-space:normal;padding:5px 3px;font-size:11px;min-height:32px}#unified-asset-detail{box-sizing:border-box;width:100%;min-width:0;font-size:11px;max-height:180px;overflow:auto;overflow-wrap:anywhere}'; document.head.append(hideStyle);
    input.placeholder = '이름·코드·제조사·자산 ID 검색';
    const tools = document.createElement('div'); tools.id = 'unified-asset-controls';
    tools.innerHTML = `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin:8px 0"><button type="button" data-scope="all" class="primary" aria-pressed="true">전체</button><button type="button" data-scope="plan" aria-pressed="false">현재 계획</button><button type="button" data-scope="registry" aria-pressed="false">공통 카탈로그</button><button type="button" data-scope="imported" aria-pressed="false">가져온 자산</button></div><small id="unified-asset-count" class="muted" aria-live="polite"></small><div id="unified-asset-detail" class="notice" hidden style="margin:8px 0"></div><div id="unified-registry-results"></div><button id="unified-more" type="button" hidden style="width:100%;margin:6px 0">더 보기</button>`;
    input.insertAdjacentElement('afterend', tools);
    input.addEventListener('input', () => {
      clearTimeout(debounce); filterLocal(input.value.trim());
      if (mode === 'all' || mode === 'registry') { total = null; debounce = setTimeout(() => search(true), input.value.trim() ? 280 : 0); }
      updateCounts();
    });
    tools.addEventListener('click', event => {
      const scope = event.target.closest('[data-scope]');
      if (scope) {
        mode = scope.dataset.scope; total = null; cursor = '';
        tools.querySelectorAll('[data-scope]').forEach(button => { button.classList.toggle('primary', button === scope); button.setAttribute('aria-pressed', button === scope ? 'true' : 'false'); });
        filterLocal(input.value.trim());
        document.querySelector('#unified-registry-results').hidden = mode !== 'all' && mode !== 'registry';
        document.querySelector('#unified-asset-detail').hidden = true;
        if (mode === 'all' || mode === 'registry') search(true); else { document.querySelector('#unified-registry-results').innerHTML = ''; updateCounts(); }
        return;
      }
      const more = event.target.closest('#unified-more'); if (more) { search(false); return; }
      const importNvidia = event.target.closest('[data-import-nvidia]');
      if (importNvidia) { event.preventDefault(); event.stopPropagation(); document.dispatchEvent(new CustomEvent('p006:studio-import-nvidia')); return; }
      const view = event.target.closest('[data-catalog-view], [data-catalog-select]');
      if (view) { const asset = window.__unifiedAssets?.[Number(view.dataset.catalogSelect ?? view.dataset.catalogView)]; if (asset) showDetails(asset); return; }
      const add = event.target.closest('[data-catalog-add]');
      if (add) { const asset = window.__unifiedAssets?.[Number(add.dataset.catalogAdd)]; if (asset) document.dispatchEvent(new CustomEvent('p006:studio-catalog-add', {detail:{asset}})); }
    });
    document.querySelector('#unified-registry-results').hidden = false;
    renderImported(); updateCounts(); search(true);
  }
  function filterLocal(value='') {
    const q = value.toLowerCase();
    document.querySelectorAll('.studio .asset-card:not([data-imported-card])').forEach(card => card.hidden = (mode !== 'all' && mode !== 'plan') || !card.textContent.toLowerCase().includes(q));
    document.querySelectorAll('[data-imported-card]').forEach(card => card.hidden = (mode !== 'all' && mode !== 'imported') || !card.textContent.toLowerCase().includes(q));
    document.querySelectorAll('[data-imported-heading]').forEach(el => el.hidden = mode !== 'all' && mode !== 'imported');
  }
  function renderImported() {
    const list = document.querySelector('.studio .asset-list'); if (!list) return;
    const assets = [...(state().externalAssets || [])]; if (!assets.some(a => a.id === nvidiaPallet.id)) assets.push({...nvidiaPallet, libraryOnly:true});
    const signature = JSON.stringify(assets.map(a => [a.id,a.name,a.thumbnail,a.path,a.url,!!a.libraryOnly])); if (list === importedHost && signature === importedSignature) return;
    importedHost = list; importedSignature = signature; list.querySelectorAll('[data-imported-card], [data-imported-heading]').forEach(node => node.remove()); if (!assets.length) return;
    const heading = document.createElement('p'); heading.dataset.importedHeading = '1'; heading.className = 'eyebrow'; heading.style.cssText = 'margin:14px 0 6px'; heading.textContent = `가져온 자산 · ${assets.length}`; list.append(heading);
    for (const asset of assets) {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'asset-card'; card.dataset.importedCard = '1';
      card.innerHTML = `${image(asset.thumbnail || asset.thumb, asset.name)}<span style="min-width:0;flex:1"><b>${esc(asset.name)}</b><small>${esc(asset.id)} · ${esc(asset.provider || asset.format || '가져온 자산')}</small><small>${asset.libraryOnly?'라이브러리 보유 · 계획 미포함':'현재 계획 후보 · 공정 미연결'}</small><button type="button" data-import-nvidia="${esc(asset.id)}" ${asset.libraryOnly?'':'hidden'}>현재 계획에 추가</button></span>`;
      card.addEventListener('click', event => { if (event.target.closest('[data-import-nvidia]')) { event.preventDefault(); event.stopPropagation(); document.dispatchEvent(new CustomEvent('p006:studio-import-nvidia')); } else showDetails(asset); }); list.append(card);
    }
    filterLocal(document.querySelector('#asset-search')?.value.trim() || '');
  }
  function updateCounts() {
    const plan = document.querySelectorAll('.studio .asset-card:not([data-imported-card])').length, imported = document.querySelectorAll('[data-imported-card]').length, fetched = window.__unifiedAssets?.length || 0;
    const node = document.querySelector('#unified-asset-count'); if (node) node.textContent = catalogError ? `현재 계획 ${plan} · 가져온 자산 ${imported} · 공통 카탈로그 조회 필요` : total === null ? `현재 계획 ${plan} · 가져온 자산 ${imported} · 공통 카탈로그 불러오는 중…` : `현재 계획 ${plan} · 가져온 자산 ${imported} · 공통 카탈로그 ${total.toLocaleString()}개 · ${fetched.toLocaleString()}개 조회`;
  }
  function usage(asset) {
    const s = state(), planned = (s.equipment || []).some(row => row.asset === asset.id || row.assetRef?.assetId === asset.id || row.externalAssetId === asset.id), imported = (s.externalAssets || []).some(row => row.assetRef?.assetId === asset.id || row.id === `registry-${asset.id}`);
    return [planned ? '현재 계획 사용 중' : '', imported ? '가져온 자산' : ''].filter(Boolean);
  }
  async function search(reset) {
    const host = document.querySelector('#unified-registry-results'), input = document.querySelector('#asset-search'); if (!host || !input) return;
    if (busy) { if (reset) { pendingReset = true; queryToken++; } return; }
    if (mode !== 'all' && mode !== 'registry') return;
    const q = input.value.trim(); if (reset) { cursor = ''; total = null; catalogError = ''; window.__unifiedAssets = []; host.innerHTML = '<div class="notice">공통 카탈로그를 불러오는 중…</div>'; updateCounts(); }
    busy = true; const token = ++queryToken;
    try {
      const params = new URLSearchParams({limit:'50'}); if (q) params.set('q',q); if (cursor && !reset) params.set('after',cursor);
      const response = await fetch(`${API}?${params}`, {credentials:'same-origin',headers:{Accept:'application/json'}}), result = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(response.status === 401 ? '로그인 후 공통 카탈로그를 조회할 수 있습니다.' : result.error || `서버 응답 ${response.status}`);
      if (token !== queryToken || q !== input.value.trim()) return;
      const rows = result.items || []; catalogError = ''; window.__unifiedAssets = reset ? rows : [...(window.__unifiedAssets || []), ...rows]; total = Number(result.total ?? total ?? 0);
      if (reset) host.innerHTML = ''; const offset = reset ? 0 : host.querySelectorAll('[data-catalog-row]').length;
      rows.forEach((asset,index) => {
        const absolute = offset + index, status = usage(asset); if (mode === 'all' && status.length) return; const row = document.createElement('article'); row.dataset.catalogRow = '1'; row.dataset.catalogAssetId = asset.id; row.className = 'asset-card catalog-row'; row.style.cssText = 'box-sizing:border-box;display:grid;grid-template-columns:48px minmax(0,1fr);gap:8px;align-items:center;text-align:left;margin:6px 0;padding:8px;width:100%;min-width:0;max-width:100%;white-space:normal';
        row.innerHTML = `${image(asset.image,asset.name)}<button type="button" data-catalog-select="${absolute}" style="grid-column:2;grid-row:1;display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box;text-align:left;white-space:normal;overflow-wrap:anywhere;word-break:keep-all;line-height:1.4;border:0;padding:0;background:transparent"><b>${esc(asset.name)}</b><small>${esc(asset.id)} · ${esc(asset.manufacturer_name || '제조사 미연결')} · ${esc(asset.category || '분류 미기록')}</small><small>${esc(asset.english_name || '')} · ${esc(asset.current_version_id ? `v${asset.current_version_no} ${asset.current_version_status}` : asset.entry_usd ? 'USD 연결 · 승인 버전 없음' : 'USD 경로 없음')}</small><small>${status.length ? esc(status.join(' · ')) : '계획 미사용'}</small></button><span class="catalog-actions"><button type="button" data-catalog-view="${absolute}">상세</button>${asset.entry_usd ? `<button type="button" data-catalog-add="${absolute}">${status.includes('현재 계획 사용 중') ? '이미 계획 사용' : '계획 후보 추가'}</button>` : ''}</span>`;
        host.append(row);
      });
      cursor = result.nextAfter || ''; const more = document.querySelector('#unified-more'); more.hidden = !result.hasMore; more.textContent = `더 보기 · ${Math.max(0,total - window.__unifiedAssets.length).toLocaleString()}개 남음`;
      if (!window.__unifiedAssets.length) host.innerHTML = '<div class="empty">공통 카탈로그에 일치하는 자산이 없습니다.</div>';
      updateCounts();
    } catch (error) { if (token === queryToken) { catalogError = error.message; host.innerHTML = `<div class="notice warn">공통 카탈로그 조회 실패 · ${esc(error.message)}</div>`; total = null; updateCounts(); } }
    finally { busy = false; if (pendingReset) { pendingReset = false; search(true); } else if (input.value.trim() !== q) search(true); }
  }
  async function showDetails(asset) {
    if (!asset) return; const box = document.querySelector('#unified-asset-detail'); if (!box) return;
    const imagePath = asset.image || asset.thumbnail || asset.thumb, statuses = usage(asset), selected = document.querySelector('#unified-registry-results [data-catalog-asset-id="'+CSS.escape(asset.id)+'"]');
    document.querySelectorAll('#unified-registry-results [data-catalog-row]').forEach(row => row.classList.toggle('active',row===selected));
    box.hidden = false; box.innerHTML = `${image(imagePath,asset.name)} <b>${esc(asset.name)} · ${esc(asset.id)}</b><br><small>${esc(asset.manufacturer_name || asset.provider || '제조사 미연결')} · ${esc(asset.category || '분류 미기록')}</small><br><small>${esc(asset.entry_usd || 'USD 경로 미등록')} · ${esc(statuses.join(' · ') || '계획 미사용')}</small><br><small>선택만으로 계획이나 공정 배정은 변경되지 않습니다.</small><div id="catalog-preview-status" style="margin-top:6px">3D 미리보기를 준비합니다…</div>`;
    document.dispatchEvent(new CustomEvent('p006:studio-catalog-preview',{detail:{asset}}));
  }
  const observer = new MutationObserver(() => { setup(); renderImported(); }); observer.observe(document.body,{childList:true,subtree:true}); setup();
})();
