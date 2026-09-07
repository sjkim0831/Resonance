function syncBlueprintLegend() {
  const workspace = document.querySelector('#workspace[data-blueprint-scene="READY"]');
  if (!workspace || workspace.querySelector('.bp-legend')) return;
  const legend = document.createElement('aside');
  legend.className = 'bp-legend';
  legend.setAttribute('aria-label', '공장 배치도 범례');
  legend.innerHTML = '<strong>배치도 범례</strong><span><i class="building"></i>공장 건물</span><span><i class="zone"></i>공정 구역</span><span><i class="aisle"></i>물류·작업 통로</span>';
  workspace.append(legend);
}
new MutationObserver(syncBlueprintLegend).observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['data-blueprint-scene']});
syncBlueprintLegend();
