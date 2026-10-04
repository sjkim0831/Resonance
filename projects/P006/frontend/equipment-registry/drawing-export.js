(function () {
  'use strict';
  function number(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function drawingItems(layout) {
    return (layout && Array.isArray(layout.instances) ? layout.instances : []).map((item, index) => {
      const p = Array.isArray(item.position) ? item.position : [0, 0, 0];
      const q = item.parameters || {};
      const type = String(item.templateId || item.type || 'equipment').toLowerCase();
      const defaultSize = type === 'wall' ? 0.3 : (type === 'zone' || type === 'floor' || type === 'building' ? 6 : 1.2);
      const width = Math.max(0.3, number(q.width || q.w || q.length, defaultSize));
      const length = Math.max(0.3, number(q.length || q.depth || q.height, type === 'wall' ? 6 : defaultSize));
      return { item, index, type, x: number(p[0], 0), z: number(p[2], 0), width, length, rotation: number(Array.isArray(item.rotation) ? item.rotation[1] : item.rotation, 0) };
    });
  }
  function colorFor(type) {
    if (type === 'floor') return '#dceff2';
    if (type === 'wall') return '#64748b';
    if (type === 'aisle') return '#f4d35e';
    if (type === 'zone') return '#72b7b2';
    if (type === 'building') return '#94a3b8';
    return '#5b8def';
  }
  function labelFor(entry) {
    const i = entry.item;
    return String(i.label || i.name || i.equipmentCode || i.templateId || ('객체 ' + (entry.index + 1))).slice(0, 28);
  }
  function downloadDrawing() {
    const layout = typeof window.P006_GET_LAYOUT === 'function' ? window.P006_GET_LAYOUT() : null;
    if (!layout) return;
    const entries = drawingItems(layout);
    const W = 1600, H = 1100, pad = 90;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 28px sans-serif'; ctx.fillText('P006 Factory Layout · 2D Drawing', pad, 48);
    ctx.font = '16px sans-serif'; ctx.fillStyle = '#475569'; ctx.fillText('Layout: ' + String(layout.name || layout.id || 'current'), pad, 74);
    const bounds = entries.reduce((b, e) => ({ minX: Math.min(b.minX, e.x - e.width / 2), maxX: Math.max(b.maxX, e.x + e.width / 2), minZ: Math.min(b.minZ, e.z - e.length / 2), maxZ: Math.max(b.maxZ, e.z + e.length / 2) }), { minX: 0, maxX: 1, minZ: 0, maxZ: 1 });
    const spanX = Math.max(1, bounds.maxX - bounds.minX), spanZ = Math.max(1, bounds.maxZ - bounds.minZ);
    const scale = Math.min((W - pad * 2) / spanX, (H - 190) / spanZ);
    const sx = x => pad + (x - bounds.minX) * scale;
    const sz = z => 110 + (z - bounds.minZ) * scale;
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
    for (let x = Math.ceil(bounds.minX); x <= bounds.maxX && x < bounds.minX + 200; x++) { ctx.beginPath(); ctx.moveTo(sx(x), 100); ctx.lineTo(sx(x), H - 80); ctx.stroke(); }
    for (let z = Math.ceil(bounds.minZ); z <= bounds.maxZ && z < bounds.minZ + 200; z++) { ctx.beginPath(); ctx.moveTo(pad, sz(z)); ctx.lineTo(W - pad, sz(z)); ctx.stroke(); }
    entries.forEach(e => {
      const x = sx(e.x), z = sz(e.z), w = e.width * scale, h = e.length * scale;
      ctx.save(); ctx.translate(x, z); ctx.rotate(-e.rotation * Math.PI / 180); ctx.fillStyle = colorFor(e.type); ctx.globalAlpha = e.type === 'floor' ? 0.38 : 0.78; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.globalAlpha = 1; ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.restore();
      ctx.fillStyle = '#0f172a'; ctx.font = '12px sans-serif'; ctx.fillText(labelFor(e), x - Math.min(w / 2, 70), z + Math.min(h / 2 + 15, 30));
    });
    ctx.fillStyle = '#334155'; ctx.font = '14px sans-serif'; ctx.fillText('Objects: ' + entries.length + ' · Scale: ' + scale.toFixed(1) + ' px/m', pad, H - 38);
    const legend = [['Floor', '#dceff2'], ['Wall', '#64748b'], ['Aisle', '#f4d35e'], ['Zone', '#72b7b2'], ['Equipment', '#5b8def']];
    legend.forEach((l, i) => { const x = W - 430 + i * 78; ctx.fillStyle = l[1]; ctx.fillRect(x, H - 58, 14, 14); ctx.fillStyle = '#334155'; ctx.fillText(l[0], x + 18, H - 46); });
    canvas.toBlob(blob => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'factory-drawing-' + String(layout.id || 'layout') + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }, 'image/png');
  }
  function bind() { const button = document.getElementById('exportDrawing'); if (button) button.addEventListener('click', downloadDrawing); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  window.P006_DOWNLOAD_CURRENT_DRAWING = downloadDrawing;
})();
