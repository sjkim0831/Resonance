const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const root='/opt/Resonance';
const source=path.join(root,'projects/carbonet-frontend/source');
const errors=[];
if(![root,source].includes(fs.realpathSync(process.cwd())))errors.push('Run from canonical /opt/Resonance source');
const cwd=cp.execFileSync('systemctl',['show','carbonet-frontend-fast-dev','--property=WorkingDirectory','--value'],{encoding:'utf8'}).trim();
if(cwd!==source)errors.push('Running frontend source mismatch: '+cwd);
const proxyCwd=cp.execFileSync('systemctl',['show','carbonet-dev-proxy','--property=WorkingDirectory','--value'],{encoding:'utf8'}).trim();
if(proxyCwd!==root+'/ops/runtime')errors.push('Proxy source mismatch: '+proxyCwd);
const oldSync=cp.spawnSync('systemctl',['is-enabled','carbonet-dev-design-sync.timer'],{encoding:'utf8'}).stdout.trim();
const oldSyncActive=cp.spawnSync('systemctl',['is-active','carbonet-dev-design-sync.timer'],{encoding:'utf8'}).stdout.trim();
if(!['disabled','masked','not-found'].includes(oldSync)||!['inactive','failed','unknown'].includes(oldSyncActive))errors.push('Legacy automatic sync must be disabled or absent and inactive: '+oldSync+'/'+oldSyncActive);
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.cache','target','build','dist'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isSymbolicLink())continue;if(e.isDirectory())walk(p);else if(e.isFile()&&!p.includes('/public/qa/'))files.push(p);}}
walk(path.join(source,'src'));walk(path.join(source,'public'));
for(const name of ['index.html','package.json','package-lock.json','vite.config.ts','tsconfig.app.json'])if(fs.existsSync(path.join(source,name)))files.push(path.join(source,name));
const h=crypto.createHash('sha256');
for(const p of files.sort()){h.update(path.relative(root,p)+'\0');h.update(fs.readFileSync(p));}
const result={canonicalRoot:root,frontendSource:source,systemdWorkingDirectory:cwd,proxyWorkingDirectory:proxyCwd,legacySync:oldSync,fileCount:files.length,sourceHash:h.digest('hex'),checkedAt:new Date().toISOString(),errors};
console.log(JSON.stringify(result,null,2));
process.exitCode=errors.length?1:0;
