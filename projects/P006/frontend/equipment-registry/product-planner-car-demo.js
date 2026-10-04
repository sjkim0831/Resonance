(() => {
  'use strict';
  const PARTS = [
    ['body','차체·도어 패널 세트','#397b9b'],['drive','구동 모터·감속기 모듈','#d48b32'],
    ['battery','배터리 팩','#548d65'],['chassis','서스펜션·조향·제동 모듈','#687584'],
    ['thermal','열관리 모듈','#4f9eaa'],['electric','배선·전력전자 모듈','#8b6ba5'],
    ['interior','시트·내장 세트','#b17963'],['cockpit','대시보드·제어기 모듈','#4f627a'],
    ['glass','유리 세트','#78b9c8'],['exterior','범퍼·외장 세트','#8999a7'],
    ['lights','등화 모듈 세트','#e5c956'],['wheels','휠·타이어 조립체','#39434b']
  ];
  const isCarPlan = p => p?.evidence === 'FUNCTIONAL_DEMO' && /자동차|전기차/.test(p.productName || '') && PARTS.filter(([id]) => p.parts?.some(x => x.id === id)).length >= 10;
  const color = (T, value, opts={}) => new T.MeshStandardMaterial({color:value,roughness:.64,metalness:.12,...opts});
  function supports(plan){ return isCarPlan(plan); }
  function stationLayout(plan,schedule,unit){
    const pitch=Math.max(10,(unit||4)*1.6),laneGap=Math.max(14,(unit||4)*2.4),factoryIndex=new Map(plan.factories.map((f,i)=>[f.id,i])),rank=new Map(),points=new Map();
    const tasks=(schedule?.tasks||[]).filter(t=>t.processId&&plan.processes.find(p=>p.id===t.processId)?.kind!=='DISPATCH').sort((a,b)=>a.start-b.start||a.end-b.end);
    for(const task of tasks){const index=rank.get(task.factoryId)||0;rank.set(task.factoryId,index+1);points.set(task.processId,{x:index*pitch,z:(factoryIndex.get(task.factoryId)||0)*laneGap,factoryId:task.factoryId,index,pitch,laneGap});}
    return {points,pitch,laneGap,factoryIndex};
  }
  function create(T, scene, plan){
    if(!supports(plan)) return [];
    const entries=[];
    const box=(g,m,x,y,z,sx,sy,sz)=>{const o=new T.Mesh(new T.BoxGeometry(sx,sy,sz),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
    const cylinder=(g,m,x,y,z,r1,r2,h,axis='y',segments=16)=>{const o=new T.Mesh(new T.CylinderGeometry(r1,r2,h,segments),m);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
    const tube=(g,m,points,r=.035)=>{const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const o=new T.Mesh(new T.TubeGeometry(curve,16,r,6,false),m);g.add(o);return o;};
    for(const [id,name,hex] of PARTS){
      const part=plan.parts.find(x=>x.id===id); if(!part) continue;
      const group=new T.Group();group.name=`FUNCTIONAL_DEMO_${id}`;group.userData={partId:id,label:name,evidence:'FUNCTIONAL_DEMO'};
      const main=color(T,hex),dark=color(T,'#303b43'),metal=color(T,'#9aaab4',{metalness:.55,roughness:.38}),glass=color(T,hex,{transparent:true,opacity:.48,metalness:.05,roughness:.18,side:T.DoubleSide}),light=color(T,'#f5d86f',{emissive:'#8b6413',emissiveIntensity:.28});
      if(id==='body'){
        box(group,main,0,.72,0,3.45,.72,1.55);box(group,main,-.12,1.2,0,1.8,.78,1.4);
        box(group,main,1.08,1.12,0,.75,.52,1.36);box(group,metal,0,.32,0,3.55,.16,1.62);
      } else if(id==='drive'){
        box(group,main,0,.48,0,1.05,.58,.72);cylinder(group,metal,-.62,.48,0,.13,.13,.32,'x');cylinder(group,metal,.62,.48,0,.13,.13,.32,'x');
        for(let i=-2;i<=2;i++)box(group,metal,i*.15,.79,0,.055,.12,.65);
      } else if(id==='battery'){
        box(group,main,0,.28,0,2.15,.34,1.12);for(let i=-4;i<=4;i++)box(group,metal,i*.22,.48,0,.045,.08,1.0);
      } else if(id==='chassis'){
        for(const z of [-.62,.62])box(group,main,0,.34,z,3.2,.18,.13);
        for(const x of [-1.18,-.38,.48,1.18])box(group,metal,x,.31,0,.14,.15,1.3);
        for(const x of [-1.2,1.2])for(const z of [-.82,.82]){cylinder(group,dark,x,.38,z,.12,.12,.34,'z');cylinder(group,metal,x,.52,z,.05,.05,.48,'y');}
      } else if(id==='thermal'){
        box(group,main,0,.42,0,.78,.65,.22);for(let i=-4;i<=4;i++)box(group,metal,i*.075,.42,.13,.025,.52,.025);
        tube(group,metal,[[-.48,.75,0],[-.62,.88,0],[-.35,.94,0],[.38,.94,0],[.55,.82,0]]);
      } else if(id==='electric'){
        box(group,main,0,.5,0,.8,.42,.65);box(group,metal,0,.74,0,.62,.08,.48);
        tube(group,dark,[[-.38,.48,0],[-.62,.32,.12],[-.72,.25,.38]]);tube(group,light,[[.38,.48,0],[.6,.33,-.1],[.72,.24,-.34]]);
      } else if(id==='interior'){
        for(const x of [-.65,.55])for(const z of [-.38,.38]){box(group,main,x,.62,z,.47,.18,.4);box(group,main,x-.14,.96,z,.16,.58,.4);}
        box(group,metal,0,.34,0,1.75,.08,1.15);
      } else if(id==='cockpit'){
        box(group,main,-.35,.92,0,1.18,.2,1.3);box(group,metal,.15,.8,0,.25,.32,.78);
        const wheel=new T.Mesh(new T.TorusGeometry(.19,.035,8,24),dark);wheel.position.set(.34,.98,.36);wheel.rotation.y=Math.PI/2;group.add(wheel);
      } else if(id==='glass'){
        const windshield=new T.Mesh(new T.BoxGeometry(.12,.58,1.26),glass);windshield.position.set(.8,1.25,0);windshield.rotation.z=-.35;group.add(windshield);
        const rear=new T.Mesh(new T.BoxGeometry(.12,.52,1.18),glass);rear.position.set(-.88,1.23,0);rear.rotation.z=.35;group.add(rear);
        for(const z of [-.71,.71]){const side=new T.Mesh(new T.BoxGeometry(1.28,.42,.045),glass);side.position.set(-.04,1.36,z);group.add(side);}
      } else if(id==='exterior'){
        box(group,main,1.72,.62,0,.3,.33,1.62);box(group,main,-1.72,.62,0,.3,.33,1.62);
        box(group,metal,1.82,.49,0,.08,.1,1.25);box(group,metal,-1.82,.49,0,.08,.1,1.25);
      } else if(id==='lights'){
        for(const x of [-1.45,1.45])for(const z of [-.62,.62]){const o=new T.Mesh(new T.BoxGeometry(.16,.16,.2),light);o.position.set(x,.83,z);group.add(o);}
      } else if(id==='wheels'){
        for(const x of [-1.25,1.25])for(const z of [-.88,.88]){const tire=new T.Mesh(new T.CylinderGeometry(.39,.39,.22,24),dark);tire.rotation.x=Math.PI/2;tire.position.set(x,.4,z);tire.castShadow=true;group.add(tire);const rim=new T.Mesh(new T.CylinderGeometry(.23,.23,.235,16),metal);rim.rotation.x=Math.PI/2;rim.position.copy(tire.position);group.add(rim);}
      }
      group.visible=false;scene.add(group);entries.push({id,name,group,factoryId:part.factoryId,factoryIds:[part.factoryId],part});
    }
    return entries;
  }
  function update(entries, viewer, time, done, plan, schedule, layout){
    if(!entries?.length)return {ready:0,transit:0,assembled:0,total:0};
    const T=viewer.T,unit=viewer.unit||4,stations=layout||stationLayout(plan,schedule,unit),tasks=schedule?.tasks||[],procById=new Map(plan.processes.map(p=>[p.id,p])),factoryZ=id=>(stations.factoryIndex.get(id)||0)*stations.laneGap,workLaneOffset=Math.min(4,Math.max(1.8,stations.pitch*.12)),joinPoint=part=>stations.points.get(part.joinProcessId)||{x:0,z:factoryZ(part.factoryId),factoryId:part.factoryId,pitch:stations.pitch};
    const workPoint=(task,longitudinal=0)=>{const point=task&&stations.points.get(task.processId);if(!point)return null;const yaw=(point.yaw||0)*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw);return {x:point.x+c*longitudinal+s*workLaneOffset,z:point.z-s*longitudinal+c*workLaneOffset};};
    const midpoint=(a,b)=>a&&b?{x:(a.x+b.x)/2,z:(a.z+b.z)/2}:a||b;
    const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
    let ready=0,transitCount=0,assembled=0,activePasses=0;
    for(const e of entries){
      const p=e.part,chain=tasks.filter(t=>t.processId&&procById.get(t.processId)?.partId===p.id&&t.processId!==p.joinProcessId).sort((a,b)=>a.start-b.start),acquire=tasks.find(t=>t.type==='ACQUIRE'&&t.partId===p.id),transport=tasks.find(t=>t.type==='TRANSPORT'&&t.partId===p.id),join=tasks.find(t=>t.processId===p.joinProcessId),joinPos=joinPoint(p),pitch=joinPos.pitch||stations.pitch,receive=join?workPoint(join,-pitch*.8):{x:joinPos.x-pitch*.8,z:joinPos.z+workLaneOffset},firstPos=chain.length?stations.points.get(chain[0].processId):null,last=chain[chain.length-1],lastPos=last?stations.points.get(last.processId):null;
      let x=receive.x,z=receive.z,visible=false,factoryIds=[p.factoryId],y=.06;
      if(chain.length){const first=chain[0],firstStation=stations.points.get(first.processId);visible=time>=first.start;factoryIds=[first.factoryId];if(visible)ready++;
        let current=null;for(const task of chain)if(time>=task.start)current=task;
        if(current){const point=stations.points.get(current.processId)||firstStation,progress=Math.max(0,Math.min(1,(time-current.start)/Math.max(.001,current.duration||current.end-current.start))),currentIndex=chain.indexOf(current),center=workPoint(current),entry=workPoint(current,-pitch*.34),exit=workPoint(current,pitch*.34),previousExit=currentIndex>0?workPoint(chain[currentIndex-1],pitch*.34):null,nextEntry=currentIndex+1<chain.length?workPoint(chain[currentIndex+1],-pitch*.34):null,incoming=previousExit?midpoint(previousExit,entry):entry,outgoing=nextEntry?midpoint(exit,nextEntry):workPoint(current,pitch*.72),position=progress<.2?mix(incoming,center,progress/.2):progress<.78?mix(center,exit,(progress-.2)/.58):mix(exit,outgoing,(progress-.78)/.22);
          x=position.x;z=position.z;factoryIds=[current.factoryId];
          if(time<current.end){activePasses++;e.flowLabel=`${procById.get(current.processId)?.name||current.name} 시연 작업점 진행`;}
          else e.flowLabel=`${procById.get(current.processId)?.name||current.name} 완료 · 다음 공정 대기`;
        }else{x=firstStation.x-pitch*.72;z=firstStation.z+workLaneOffset;}
      }else if(acquire&&time>=acquire.end){visible=true;ready++;x=receive.x;z=receive.z;e.flowLabel=`${acquire.name} · 입고 대기`;}
      if(visible&&transport){
        const source=last?workPoint(last,pitch*.72):{x:receive.x,z:receive.z};
        if(time>=transport.start&&time<transport.end){const r=Math.min(1,Math.max(0,(time-transport.start)/Math.max(.001,transport.duration)));x=source.x+(receive.x-source.x)*r;z=source.z+(receive.z-source.z)*r;factoryIds=[transport.fromFactoryId,transport.factoryId];transitCount++;e.flowLabel='운송 중 · 도착 공장 입고점으로 이동';}
        else if(time>=transport.end){x=receive.x;z=receive.z;factoryIds=[transport.factoryId];e.flowLabel='입고 완료 · 조립 공정 대기';}
      }else if(visible&&chain.length&&last&&time>=last.end){
        const from=workPoint(last,pitch*.72),start=transport?.start??last.end,end=join?.start??start;
        if(time>=start&&end>start){const r=Math.max(0,Math.min(1,(time-start)/(end-start)));x=from.x+(receive.x-from.x)*r;z=from.z+(receive.z-from.z)*r;e.flowLabel='공장 내 다음 조립 공정으로 이동';}
        else if(!transport){x=receive.x;z=receive.z;e.flowLabel='조립 공정 앞 대기';}
      }
      const lastJoin=tasks.filter(t=>t.type==='ASSEMBLE').sort((a,b)=>b.end-a.end)[0],fullyAssembled=!!lastJoin&&time>=lastJoin.end;
      if(fullyAssembled){const slot={body:[0,.05,0],drive:[1.08,.42,0],battery:[-.12,.12,0],chassis:[0,.06,0],thermal:[1.35,.38,0],electric:[-.68,.56,0],interior:[-.15,.28,0],cockpit:[.45,.5,0],glass:[0,.64,0],exterior:[0,.03,0],lights:[0,.22,0],wheels:[0,-.02,0]}[p.id]||[0,0,0];const product=stations.points.get(lastJoin.processId)||{x:0,z:factoryZ(lastJoin.factoryId)};x=product.x+slot[0];z=product.z+workLaneOffset+slot[2];e.group.position.y=y+slot[1];visible=true;factoryIds=[lastJoin.factoryId];e.flowLabel='완제품 조립체 · FUNCTIONAL_DEMO';assembled++;}
      else {const joinStarted=join&&time>=join.start,joinEnded=join&&done.has(join.id+':end');
      if(joinStarted){const progress=joinEnded?1:Math.min(1,Math.max(0,(time-join.start)/Math.max(.001,join.duration)));const slot={body:[0,.05,0],drive:[1.08,.42,0],battery:[-.12,.12,0],chassis:[0,.06,0],thermal:[1.35,.38,0],electric:[-.68,.56,0],interior:[-.15,.28,0],cockpit:[.45,.5,0],glass:[0,.64,0],exterior:[0,.03,0],lights:[0,.22,0],wheels:[0,-.02,0]}[p.id]||[0,0,0];
        const finalX=joinPos.x+slot[0];x=x+(finalX-x)*progress;z=z+(joinPos.z+workLaneOffset+slot[2]-z)*progress;e.group.position.y=y+slot[1]*progress;factoryIds=[join.factoryId];e.flowLabel=joinEnded?'조립 완료 · FUNCTIONAL_DEMO 모듈 배치':`조립 작업점 도착 · ${join.name}`;if(joinEnded)assembled++;
      }else e.group.position.y=y;}
      e.group.position.x=x;e.group.position.z=z;e.group.visible=visible;e.factoryId=factoryIds[0];e.factoryIds=factoryIds;
    }
    return {ready,transit:transitCount,assembled,total:entries.length,activePasses};
  }
  function createInfrastructure(T,scene,plan,layout){
    const root=new T.Group();root.name='FUNCTIONAL_DEMO_SITE_FACTORY_INFRASTRUCTURE';scene.add(root);const mats={site:new T.MeshStandardMaterial({color:'#d9e4e9',roughness:.95}),building:new T.MeshStandardMaterial({color:'#8799a3',roughness:.82}),roof:new T.MeshStandardMaterial({color:'#435761',roughness:.8}),road:new T.MeshStandardMaterial({color:'#59656c',roughness:.9}),line:new T.MeshStandardMaterial({color:'#efc35d',roughness:.7})};
    const slab=(parent,mat,x,y,z,w,h,d)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;};
    const bySite=new Map();for(const f of plan.factories){const z=(layout.factoryIndex.get(f.id)||0)*layout.laneGap;if(!bySite.has(f.siteId))bySite.set(f.siteId,[]);bySite.get(f.siteId).push({f,z});}
    const makeTag=(parent,label,x,y,z,color='#14354b')=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(255,255,255,.94)';ctx.strokeStyle='#008895';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(4,4,632,120,18);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,320,64,600);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.position.set(x,y,z);sprite.scale.set(7.5,1.5,1);parent.add(sprite);};
    for(const [siteId,items] of bySite){const site=new T.Group();site.name='가상 부지 '+(plan.sites.find(s=>s.id===siteId)?.name||siteId);const maxX=Math.max(layout.pitch*2,...items.map(x=>((layout.points.get(plan.processes.find(p=>p.factoryId===x.f.id)?.id)?.x)||0)+layout.pitch)),minZ=Math.min(...items.map(x=>x.z))-5,maxZ=Math.max(...items.map(x=>x.z))+5,siteName=plan.sites.find(s=>s.id===siteId)?.name||'가상 부지';slab(site,mats.site,maxX/2,-.26,(minZ+maxZ)/2,maxX+layout.pitch,.45,maxZ-minZ+10);makeTag(site,'부지 · '+siteName,maxX/2,4,minZ+1);for(const item of items){const proc=plan.processes.find(p=>p.factoryId===item.f.id),point=layout.points.get(proc?.id),x=(point?.x||layout.pitch*.4)-layout.pitch*.45,z=item.z-4;slab(site,mats.building,x,1.35,z,layout.pitch*.67,3,5);slab(site,mats.roof,x,2.95,z,layout.pitch*.72,.25,5.2);slab(site,mats.road,x,0,item.z+layout.laneGap*.24,layout.pitch*.76,.06,1.1);slab(site,mats.line,x,0.04,item.z+layout.laneGap*.24,layout.pitch*.58,.02,.05);makeTag(site,'공장 · '+item.f.name,x,4.2,z);}root.add(site);}
    root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});return root;
  }
  function createTransportVehicles(T,scene,schedule,mode='truck'){const vehicles=[];for(const task of schedule?.tasks||[]){if(task.type!=='TRANSPORT')continue;const group=new T.Group();group.name='운송 시연 '+task.name;const sizes={truck:[1.7,.45,.9],agv:[1.2,.28,.82],forklift:[.9,.4,.72],conveyor:[2.1,.2,.7]},size=sizes[mode]||sizes.truck,body=new T.Mesh(new T.BoxGeometry(...size),new T.MeshStandardMaterial({color:mode==='truck'?'#e29b31':mode==='agv'?'#35a5a1':mode==='forklift'?'#db7b32':'#7085a0',roughness:.6}));body.position.y=.48;group.add(body);if(mode==='truck'||mode==='forklift'){const cab=new T.Mesh(new T.BoxGeometry(.55,.65,.72),new T.MeshStandardMaterial({color:'#42677b',roughness:.4,transparent:true,opacity:.78}));cab.position.set(-.35,.98,0);group.add(cab);}if(mode==='forklift'){const mast=new T.Mesh(new T.BoxGeometry(.08,.9,.08),new T.MeshStandardMaterial({color:'#394d57'}));mast.position.set(.62,.92,0);group.add(mast);const fork=new T.Mesh(new T.BoxGeometry(.48,.06,.12),new T.MeshStandardMaterial({color:'#394d57'}));fork.position.set(.83,.27,0);group.add(fork);}for(const x of [-.55,.5])for(const z of [-.42,.42]){const w=new T.Mesh(new T.CylinderGeometry(.15,.15,.12,14),new T.MeshStandardMaterial({color:'#26333a'}));w.rotation.x=Math.PI/2;w.position.set(x,.2,z);group.add(w);}group.visible=false;scene.add(group);vehicles.push({task,group});}return vehicles;}
  function updateVehicles(vehicles,viewer,time,plan,schedule,layout){let waiting=0,moving=0;for(const v of vehicles||[]){const t=v.task,windowStart=Math.max(0,t.start-5),show=time>=windowStart&&time<=t.end+2;v.group.visible=show;if(!show)continue;const from=(layout.factoryIndex.get(t.fromFactoryId)||0)*layout.laneGap,to=(layout.factoryIndex.get(t.factoryId)||0)*layout.laneGap,progress=time<t.start?0:Math.min(1,(time-t.start)/Math.max(.01,t.end-t.start));v.group.position.set(-viewer.unit*1.1,.04,from+(to-from)*progress);if(time<t.start)waiting++;else if(time<t.end)moving++;}return {waiting,moving};}
  window.ProductPlannerCarDemo={supports,create,update,stationLayout,createInfrastructure,createTransportVehicles,updateVehicles};
})();
