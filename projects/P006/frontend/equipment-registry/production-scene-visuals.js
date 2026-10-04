// Rendering-only infrastructure. Never changes the saved production plan.
export async function previewCandidates(plan) {
  const map={'body-form':'N076','body-weld':'E148','body-paint':'N088','drive-make':'E121','drive-check':'E053','chassis-check':'E123','systems-join':'A195','final-check':'E053','chassis-make':'E121','body-join':'E148','chassis-join':'A042','trim-join':'E032','finish-join':'A203'};
  const missing=plan.processes.filter(p=>!p.equipmentModel?.glbPath&&map[p.id]);
  if(!missing.length)return [];
  const response=await fetch('/projects/P006/assets/3d-derived/manifest.json',{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('후보 목록 HTTP '+response.status);
  const data=await response.json(),assets=new Map(data.assets.map(a=>[a.assetId,a]));
  const result=[];
  for(const p of missing){const id=p.equipmentModel?.assetId||map[p.id],asset=assets.get(id);if(!asset?.glbPath)continue;p.equipmentModel={...p.equipmentModel,assetId:id,glbPath:asset.glbPath,previewOnly:true};result.push(p.name+' · '+id);}
  return result;
}
export function upgradeLighting(T,renderer,scene,light){
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
  scene.children.filter(o=>o.isHemisphereLight).forEach(o=>o.intensity=.85);
  light.intensity=2;light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.bias=-.0005;light.shadow.normalBias=.08;
  scene.background=new T.Color('#dbe5ee');
}
export function decorate(T,root,sites,factories,vehicles,light){
  const mat=new Map();const material=c=>{if(!mat.has(c))mat.set(c,new T.MeshStandardMaterial({color:c,roughness:.78}));return mat.get(c);};
  function block(x,y,z,w,h,d,c){const m=new T.Mesh(new T.BoxGeometry(w,h,d),material(c));m.position.set(x,y,z);m.castShadow=h>.2;m.receiveShadow=true;root.add(m);return m;}
  function tree(x,z){block(x,.9,z,.22,1.8,.22,'#786148');const crown=new T.Mesh(new T.IcosahedronGeometry(1.05,1),material('#4a7959'));crown.position.set(x,2.1,z);crown.castShadow=true;root.add(crown);}
  for(const s of sites){const a=s.bounds.min,b=s.bounds.max,w=b.x-a.x,d=b.z-a.z;
    block((a.x+b.x)/2,-.28,(a.z+b.z)/2,w,.2,d,'#b9c4b6');
    // Perimeter road and thin curb: does not cover equipment floor.
    for(const z of [a.z+1.5,b.z-1.5]){block((a.x+b.x)/2,-.1,z,w-2,.08,2,'#737e83');for(let x=a.x+2;x<b.x-2;x+=4)block(x,-.04,z,1.7,.02,.06,'#e8e5d3');}
    for(const x of [a.x+1,b.x-1]){block(x,-.1,(a.z+b.z)/2,1.2,.08,d-3,'#788387');for(let z=a.z+3;z<b.z-2;z+=4){block(x,.9,z,.13,1.8,.13,'#287e83');block(x,.5,z+1.7,.06,.07,3.4,'#4b9898');block(x,1.4,z+1.7,.06,.07,3.4,'#4b9898');}}
    for(let x=a.x+4;x<b.x-3;x+=8){tree(x,a.z+4);tree(x,b.z-4);}
    block(a.x+4,1,b.z-7,2,2,2,'#e1e7e8');block(a.x+4,2.1,b.z-7,2.5,.2,2.5,'#294b60');block(a.x+5.05,1.3,b.z-7,.03,.65,1.4,'#7197aa');
  }
  for(const f of factories.values()){const a=f.bounds.min,b=f.bounds.max,left=a.x+3,right=b.x-3,z=f.z;
    // Back and side walls, intentionally open front/roof for equipment visibility.
    block((left+right)/2,2.15,z-8.5,right-left,4.3,.35,'#d9e0e3');
    for(const x of [left,right]){block(x,1.7,z-3,.35,3.4,11,'#dde3e6');block(x,3.5,z-3,.6,.2,11.5,'#8195a2');}
    for(let x=left+2;x<right-1;x+=5){block(x,2.8,z-8.25,2.2,1,.06,'#6691a6');block(x,2.8,z-8.18,.07,1,.08,'#dbe6ec');block(x,2.1,z-8.05,.22,4.2,.25,'#9eadb5');}
    block((left+right)/2,.035,z+5,right-left-1,.025,.13,'#e4af37');
    for(let x=left+4;x<right-3;x+=4){block(x,.045,f.logisticsZ??z+12,.07,.025,4.6,'#fff2b6');}
    for(const pos of [f.receive,f.ship]){for(const dx of [-2.7,2.7])block(pos.x+dx,.06,pos.z,.07,.03,4.6,'#f5f8ed');}
    // Warehouse packing props are decorative, not production inventory.
    for(let i=0;i<3;i++){block(right-2-i*1.2,.18,z-6,1,.3,1,'#8b7152');block(right-2-i*1.2,.75,z-6,.85,.85,.85,'#b89b6b');}
  }
  for(const v of vehicles){const g=v.group;g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});const body=new T.Mesh(new T.BoxGeometry(1.15,.9,.82),material('#e0e5e7'));body.position.set(.4,1,0);body.castShadow=true;g.add(body);for(let i=0;i<7;i++){const rib=new T.Mesh(new T.BoxGeometry(.025,.85,.85),material('#aab9c3'));rib.position.set(-.12+i*.16,1,0);g.add(rib);}}
  const b=new T.Box3();sites.forEach(s=>b.union(s.bounds));const center=b.getCenter(new T.Vector3()),size=b.getSize(new T.Vector3()),span=Math.max(size.x,size.z)+20;
  light.position.set(center.x-40,100,center.z+30);light.target.position.copy(center);root.add(light.target);Object.assign(light.shadow.camera,{left:-span/2,right:span/2,top:span/2,bottom:-span/2,near:1,far:400});light.shadow.camera.updateProjectionMatrix();
  root.traverse(o=>{if(o.isMesh)o.receiveShadow=true;});
}
