// Read-only inventory. A source mapping is not proof of database menu/permission grants.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const src = path.join(root, 'projects/carbonet-frontend/source/src');
const families = path.join(src, 'app/routes/families');
const manifest = fs.readFileSync(path.join(src, 'platform/screen-registry/pageManifests.ts'), 'utf8');
const knownPaths = new Set([...manifest.matchAll(/routePath:\s*["']([^"']+)["']/g)].map(m => m[1]));
const rows = [];
for (const name of fs.readdirSync(families).filter(n => n.endsWith('.ts'))) {
  const file = path.join(families, name), source = fs.readFileSync(file, 'utf8');
  const loaders = new Map([...source.matchAll(/\{\s*id:\s*"([^"]+)"[^{}]*exportName:\s*"([^"]+)"[^{}]*import\("([^"]+)"\)/g)].map(m => [m[1], {exportName:m[2], importPath:m[3]}]));
  for (const match of source.matchAll(/\{\s*id:\s*"([^"]+)"[^{}]*koPath:\s*"([^"]+)"/g)) {
    const [,id,route] = match, loader = loaders.get(id);
    const base = loader && path.resolve(path.dirname(file), loader.importPath);
    const component = base && [base+'.tsx',base+'.ts',path.join(base,'index.ts'),path.join(base,'index.tsx')].find(p=>fs.existsSync(p));
    rows.push({id,route,family:name,component:component?path.relative(root,component):null,
      exportName:loader?.exportName || null,explicitPageManifest:knownPaths.has(route),
      implementationStatus:component?'SOURCE_PRESENT_NOT_EXECUTION_VERIFIED':'UNRESOLVED_IMPORT',
      menuRuntime:'UNVERIFIED',permissionRuntime:'UNVERIFIED',businessTest:'NOT_RUN'});
  }
}
const duplicates = rows.filter((row,index)=>rows.findIndex(other=>other.route===row.route)!==index);
const report = {root,scope:'literal route families only; dynamic registrations require separate inspection',
  counts:{routes:rows.length,componentResolved:rows.filter(r=>r.component).length,
    explicitPageManifest:rows.filter(r=>r.explicitPageManifest).length,
    missingExplicitPageManifest:rows.filter(r=>!r.explicitPageManifest).length,duplicateRoutes:duplicates.length},rows};
const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0) {
  const output = path.resolve(process.argv[outputIndex+1]);
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'page-delivery-audit.json'),JSON.stringify(report,null,2));
  const esc = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  fs.writeFileSync(path.join(output,'page-delivery-audit.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>화면 연결 전수 검사</title><style>body{font:16px system-ui;margin:32px;color:#142c46}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cdd7e1;padding:8px;text-align:left}th{background:#edf3fa}small{color:#536378}.gap{background:#fff1d6}</style><h1>화면 연결 전수 검사</h1><p>${esc(root)}</p><p>Route ${rows.length} · Component 경로 확인 ${report.counts.componentResolved} · 명시 Manifest 누락 ${report.counts.missingExplicitPageManifest}</p><p>소스 목록 검사입니다. 메뉴 DB·권한·저장·브라우저 실행은 미검증입니다. 동적 등록은 별도 검사 대상입니다.</p><table><thead><tr><th>Route</th><th>Component</th><th>Page Manifest</th><th>실행 검증</th></tr></thead><tbody>${rows.map(r=>`<tr class="${!r.explicitPageManifest||!r.component?'gap':''}"><td>${esc(r.route)}</td><td>${esc(r.exportName)}<br><small>${esc(r.component||'IMPORT 확인 필요')}</small></td><td>${r.explicitPageManifest?'연결 있음':'명시 연결 없음'}</td><td>미검증</td></tr>`).join('')}</tbody></table></html>`);
}
console.log(JSON.stringify(process.argv.includes('--summary')?report.counts:report,null,2));
