const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const gate=require('./asset-readiness-gate.cjs'),dir=__dirname,out=path.join(dir,'asset-readiness');fs.mkdirSync(out,{recursive:true});
const load=p=>JSON.parse(fs.readFileSync(path.join(dir,p),'utf8')),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,p))).digest('hex');
const base=load('catalog-expansion700/independent-catalog.json'),design=load('readiness-design.json'),geometry=load('readiness-geometry.json'),layout=load('readiness-layout.json'),existing=load('readiness-existing.json');
const lockPath=path.join(out,'baseline-lock.json'),baselineHash=hash('catalog-expansion700/independent-catalog.json');
if(fs.existsSync(lockPath))assert.equal(JSON.parse(fs.readFileSync(lockPath)).sha256,baselineHash,'baseline changes require explicit new version');
else fs.writeFileSync(lockPath,JSON.stringify({version:'CATALOG-724-FROZEN-1',count:724,sha256:baselineHash,ids:base.assets.map(a=>a.id),candidateDiscovery:'PAUSED'},null,2));
assert.equal(base.assets.length,724);assert.equal(new Set(base.assets.map(x=>x.id)).size,724);
const basisHash=hash('readiness-design.json'),core=new Map(design.core.map(x=>[x.id,x]));
const visualPath=path.join(dir,'readiness-visual-review.json'),visual=fs.existsSync(visualPath)?load('readiness-visual-review.json'):null;
const families={BUILD:'building-panels',RECEIVE:'handling-frame',STORE:'storage-frame',CONVEY:'conveyor-frame',AGV:'mobile-platform',MACHINE:'machine-enclosure',SHEET:'press-frame',CAST:'thermal-vessel',JOIN:'joining-cell',HEAT:'thermal-chamber',SURFACE:'process-skid',POLY:'molding-cell',ASSEMBLY:'workstation-frame',METROLOGY:'instrument-enclosure',PACK:'packaging-frame',ROBOT:'robot-module',POWER:'rotating-drive',AIR:'fluid-skid',HYD:'fluid-skid',PIPE:'fluid-skid',ELEC:'electrical-cabinet',NET:'control-enclosure',SENSE:'sensor-housing',UTIL:'process-skid',ENV:'process-skid',SAFE:'safety-device',MAINT:'service-tool',QUALITY:'instrument-enclosure',WORKER:'workstation-frame',TOOL:'tool-fixture',SEMI:'clean-process-chamber',BAT:'web-process-frame',FOOD:'hygienic-process-skid'};
const tests=[];const test=(name,fn)=>{fn();tests.push({name,status:'PASS'})};
const rows=base.assets.map(a=>{
 let values=[...design.profiles[a.domain]],reason='산업 사용 통계가 아니라 범용 수동 조립 기준 공장에 대한 설계 휴리스틱';
 if(/시험|분석|교정|현미경/.test(a.name)&&!core.has(a.id)){values[0]=Math.min(values[0],3);values[3]=Math.min(values[3],2);values[7]=Math.min(values[7],3);reason+='; 검사실 전용 항목은 직접 물류 기여를 낮춤';}
 if(/센서|스위치|PLC|리더|게이트웨이/.test(a.name)){values[5]=5;reason+='; 신호 연결 역할 가중';}
 if(design.overrides[a.id]){values=design.overrides[a.id];reason+='; 현재 핵심 경로의 기준/입출력 역할을 항목별 반영';}
 const score=+(values.reduce((s,v,i)=>s+v/5*design.scoreWeights[i],0)).toFixed(1),c=core.get(a.id),old=existing.rows.find(x=>x.id===a.id),g=geometry.find(x=>x.id===a.id);
 let evidence={usd:{exists:!!old?.exists,composed:!!old?.composed,sha256:old?.sha256},checks:{}};
 if(c&&g){
  const reviewed=visual?.layoutSha256===layout.layoutSha256&&visual?.basisHash===basisHash&&visual?.assetHashes?.[a.id]===g.sha256&&visual?.checkedIds.includes(a.id);
  evidence={usd:{exists:true,composed:g.checks.composition,sha256:g.sha256},verifiedSha256:g.sha256,basisHash,verifiedBasisHash:basisHash,checks:{
   type:g.checks.kindStructure&&reviewed,dimensions:g.checks.dimension,units:g.checks.unit&&g.checks.upAxis,floorOrigin:g.checks.floorOrigin,orientation:g.checks.orientation,
   workpieceIO:c.portsApplicable?g.checks.ports:{status:'NOT_APPLICABLE',reason:'건축/통로 모듈에는 작업물 투입구 대신 공간 연결 앵커 사용'},connectionPoints:g.checks.ports,hierarchy:g.checks.sensorControlHierarchy,
   process:design.instances.some(i=>i.asset===a.id),sensorMotionStructure:g.checks.sensorControlHierarchy,logistics:c.portsApplicable?layout.links.some(l=>[l.from,l.to].some(n=>design.instances.find(i=>i.name===n)?.asset===a.id)):{status:'NOT_APPLICABLE',reason:'공간 경계 모듈은 직접 물류 장비가 아니며 공장 배치 검사로 검증'},visual:!!reviewed,layout:layout.collisionPairs.length===0&&layout.sqliteRoundtrip&&layout.usdEventRoundtrip}};
 }
 const readiness=gate.evaluate(a,evidence);
 return {id:a.id,name:a.name,domain:a.domain,origin:a.origin,priority:{score,criteria:design.criteria.map((name,i)=>({name,value:values[i],weight:design.scoreWeights[i]})),reason,wave:c?'CORE':score>=80?'P1':score>=60?'P2':'P3'},
 family:c?c.family:families[a.domain],reuse:{mode:c?'IMPLEMENTED_REFERENCE_AND_VARIANT':'FAMILY_PLAN_NOT_IMPLEMENTED',parameters:['width','height','length'],variant:c?.variant||null,warning:'같은 베이스를 사용해도 공정 기능이 다른 기존 ID는 유지. 크기/도어/축 옵션은 새 카탈로그 ID를 만들지 않음.'},
 readiness,real:{state:gate.realState(null),states:['UNBOUND','BOUND','READ_VERIFIED','REAL'],legacyReadStateAlias:'READ_ONLY_VERIFIED = READ_VERIFIED',protocol:null,address:null,writeAllowed:false},
 legacyUsdPath:a.usdPath||null,currentUsdPath:g?.path||a.usdPath||null,modelScope:c?'REFERENCE_LAYOUT_NOT_AS_BUILT':a.usdPath?'LEGACY_UNQUALIFIED':'NOT_CREATED',dimensionBasis:c?design.version:null,
 dimensions:c?.dimensions||null,floorOrigin:c?[0,0,0]:null,forwardAxis:c?'+X':null,upAxis:c?'Y':null,metersPerUnit:c?1:null,
 ports:c?['/Asset/Ports/in','/Asset/Ports/out','/Asset/Ports/service']:[],parent:c?c.family:a.parentEquipment,children:c?['Geometry','Components','Ports','Sensors','Controls','Motion']:a.parts,
 processes:c?design.instances.filter(i=>i.asset===a.id).map(i=>i.name):a.connections,
 evidence,evidenceFiles:c?['geometry-evidence.json','layout-evidence.json','visual-review.json']:['existing-evidence.json'],
 nextAction:readiness.state==='ASSET_READY'?'기준 공장 재사용 가능. 현장 적용은 실측/안전/실장비 게이트 별도':readiness.state==='USD_REQUIRED'?'공통 자산군의 구조/치수 근거 확보 후 생성':'기존 USD의 종류·치수 근거·기준점·포트 검증'
 };
}).sort((a,b)=>(a.priority.wave==='CORE'?0:1)-(b.priority.wave==='CORE'?0:1)||b.priority.score-a.priority.score||a.id.localeCompare(b.id));
rows.forEach((r,i)=>r.priority.rank=i+1);
const coveragePath=path.join(dir,'usd-coverage/build-evidence.json');
if(fs.existsSync(coveragePath)){
 const coverage=JSON.parse(fs.readFileSync(coveragePath,'utf8'));
 for(const a of coverage.assets){
  const r=rows.find(r=>r.id===a.id);assert(r&&!r.legacyUsdPath);assert(Object.values(a.checks).every(Boolean));
  r.currentUsdPath=a.usdPath;r.currentUsdPrimPath=a.primPath;r.modelScope=a.scope;r.dimensions=a.size;r.dimensionBasis='P006-CONTROL-REFERENCE-1';r.floorOrigin=[0,0,0];r.forwardAxis='+Z';r.upAxis='Y';r.metersPerUnit=1;
  r.evidence={usd:{exists:true,composed:true,sha256:coverage.fileHashes['control-configurations.usda']},checks:{type:false,dimensions:true,units:true,floorOrigin:true,orientation:true,process:false,logistics:false}};
  r.readiness=gate.evaluate(r,r.evidence);r.layoutTechnicalEvidence=a;r.evidenceFiles=['../usd-coverage/build-evidence.json','../usd-coverage/control-coverage-spec.json'];
  r.nextAction='기준 외형·장착 USD 연결 완료 / 기능·핀맵·장착 실측 검증 필요. ASSET_READY 아님.';
 }
}
const bulkPath=path.join(dir,'bulk-coverage/build-evidence.json');
if(fs.existsSync(bulkPath)){
 const bulk=JSON.parse(fs.readFileSync(bulkPath,'utf8'));assert.equal(bulk.baselineHash,baselineHash);
 for(const a of bulk.assets){
  const r=rows.find(r=>r.id===a.id);assert(r&&!r.legacyUsdPath);assert(Object.values(a.checks).every(Boolean));assert(!a.assetReady&&a.real==='UNBOUND');
  r.currentUsdPath=a.usdPath;r.currentUsdPrimPath=a.primPath;r.modelScope=a.scope;r.dimensions=a.size;r.dimensionBasis='P006-BULK-REFERENCE-1: not measured';r.floorOrigin=[0,0,0];r.forwardAxis='+X';r.upAxis='Y';r.metersPerUnit=1;
  r.evidence={usd:{exists:true,composed:true,sha256:bulk.hashes['catalog-configurations.usda']},checks:{type:false,dimensions:false,units:true,floorOrigin:true,orientation:true,process:false,logistics:false}};
  r.readiness=gate.evaluate(r,r.evidence);assert.equal(r.readiness.state,'USD_CREATED');r.layoutTechnicalEvidence=a;r.evidenceFiles=['../bulk-coverage/build-evidence.json','../bulk-coverage/package-evidence.json'];
  r.nextAction='공통 구조 USD 연결 / 기준 배치 검증. 실측·기능·핀맵·물리 검증 필요. ASSET_READY 아님.';
 }
}
test('724종 ID 및 기준선 해시 고정',()=>assert.equal(rows.length,724));
test('724종 모두 8개 우선순위 기준',()=>rows.forEach(r=>assert.equal(r.priority.criteria.length,8)));
test('가중치 합 100',()=>assert.equal(design.scoreWeights.reduce((a,b)=>a+b),100));
test('파일 존재만으로 READY 불가',()=>assert.equal(gate.evaluate({}, {usd:{exists:true,composed:true,sha256:'a'.repeat(64)}}).state,'USD_CREATED'));
const sample=rows.find(x=>core.has(x.id));
test('USD 변경 시 증거 무효화',()=>{const e=structuredClone(sample.evidence);e.usd.sha256='b'.repeat(64);assert.notEqual(gate.evaluate({},e).state,'ASSET_READY')});
test('기준 설계 변경 시 증거 무효화',()=>{const e=structuredClone(sample.evidence);e.basisHash='c'.repeat(64);assert.notEqual(gate.evaluate({},e).state,'ASSET_READY')});
for(const k of gate.required)test('필수 검증 누락 차단: '+k,()=>{const e=structuredClone(sample.evidence);e.checks[k]=false;assert.notEqual(gate.evaluate({},e).state,'ASSET_READY')});
test('724종 REAL 상태 UNBOUND',()=>rows.forEach(r=>assert.equal(r.real.state,'UNBOUND')));
test('신호 없는 REAL 승격 거부',()=>assert.throws(()=>gate.realState({state:'REAL'})));
test('핵심 10종 및 13개 배치',()=>{assert.equal(core.size,10);assert.equal(design.instances.length,13)});
test('3개 경로 SQLite 및 USD 저장 복원',()=>{assert.equal(Object.keys(design.routes).length,3);assert(layout.sqliteRoundtrip&&layout.usdEventRoundtrip)});
test('작업물 19개 위치 상태 이벤트',()=>assert.equal(layout.events.length,19));
const counts=Object.fromEntries(gate.stages.map(s=>[s,rows.filter(r=>r.readiness.state===s).length]));
test('핵심 10종 기준 레이아웃 READY',()=>assert.equal(counts.ASSET_READY,10));
const data={schemaVersion:1,generatedAt:new Date().toISOString(),baseline:{count:724,sha256:baselineHash,candidateDiscovery:'PAUSED'},scope:design.scope,counts,states:gate.stages,criteria:design.criteria,rows,
 core:design.core,layout:design.instances,routes:design.routes,events:layout.events,geometry,layoutEvidence:layout,referenceSources:design.sources,
 limits:['ASSET_READY는 이번 프로젝트 기준 설계 레이아웃 범위이며 실측 장비 복제/물리 시뮬레이션/안전 인증/REAL 승격이 아님.','작업물 이동은 SIMULATED_OPERATOR_TRANSFER_KINEMATIC이다. 자동 장비 시작/완료 신호가 아니다.','기존 USD 176개를 재열었지만 파일 존재만으로 승격하지 않았다. 신규 548종 전체 제작은 하지 않았다.','문·울타리·벽은 정적 배치 모델이다. 작동 관절·안전 기능 구현/검증은 별도.'],tests,
 nextRock:'핵심 10종 동작 보강은 보류. bulk-coverage에서 528종 전체 재사용 검토와 176종 기준 구조 연결 확인. 다음은 남은 수정 103종·조합 8종의 전용 기구 공통화이며 신규 183종은 후순위, 자료 대기 58종 BLOCKED 유지.'};
fs.writeFileSync(path.join(out,'registry.json'),JSON.stringify(data,null,2));
fs.writeFileSync(path.join(out,'design-qa.md'),'# P006 724종 준비도 기준선\n\n'+JSON.stringify({baseline:data.baseline,counts,scope:design.scope},null,2)+'\n\n## 판정 경계\n\n'+data.limits.map(x=>'- '+x).join('\n')+'\n\n## 상태\n\n'+gate.stages.join(' → ')+'\n\nREAL 별도: UNBOUND → BOUND → READ_VERIFIED → REAL. 기존 실장비 게이트 READ_ONLY_VERIFIED와 표시명을 매핑하고 실제 연결은 하지 않음.\n\n## 우선순위\n\n'+design.criteria.map((x,i)=>`${i+1}. ${x}: ${design.scoreWeights[i]}%`).join('\n')+'\n\n도메인 기본값에 항목별 역할 보정을 적용한 휴리스틱. 시장 빈도 실측이 아님. 핵심 세트는 점수 순번 대신 수동 조립 공정 의존성으로 선택.\n\n## 재생성\n\nreadiness-design.json → build-readiness-usd.py → 구조/치수/바닥/공정 증거 → 시각 검수 → build-asset-readiness.cjs → registry.json/HTML. 근거 해시가 다르면 READY를 유지하지 않음.\n\n## 자동 검사\n\n'+tests.map((t,i)=>`${i+1}. ${t.status} ${t.name}`).join('\n')+'\n\n## 다음 바위\n\n'+data.nextRock+'\n');
for(const [src,dst] of [['readiness-design.json','design.json'],['readiness-geometry.json','geometry-evidence.json'],['readiness-layout.json','layout-evidence.json'],['readiness-existing.json','existing-evidence.json'],['readiness-render.json','render-evidence.json'],['readiness-factory-preview.png','factory-preview.png'],['readiness-core-detail.png','core-detail.png'],['readiness-visual-review.json','visual-review.json'],['asset-readiness-page.html','index.html']])if(fs.existsSync(path.join(dir,src)))fs.copyFileSync(path.join(dir,src),path.join(out,dst));
console.log(JSON.stringify({total:rows.length,counts,tests:tests.length,core:10,usdReopened:existing.rows.length,real:0},null,2));
