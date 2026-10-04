(function(root) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const Zip = node ? require('./package-tools/node_modules/jszip') : root.JSZip;
  const sha = node ? require('./package-tools/node_modules/js-sha256').sha256 : root.sha256;
  const VERSION = 'p006-factory-package-1';
  const LIMIT = 200 * 1024 * 1024;
  const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', {fatal:true});
  const paths = ['analysis/result.json','coordinate.json','analysis/review.json','layout/layout.json','equipment/registry.json'];
  function fail(message) { throw Error(message); }
  function safe(p) { return typeof p === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(p) && !p.split('/').some(v=>!v || v==='..' || v==='.'); }
  function json(value) { return encoder.encode(JSON.stringify(value, null, 2)); }
  async function build(input) {
    if (!input.layout || !Array.isArray(input.layout.instances)) fail('LAYOUT_REQUIRED');
    const entries = new Map(), missing = [...(input.missing || [])];
    entries.set(paths[0], json(input.analysis ?? null));
    entries.set(paths[1], json(input.analysis?.coordinate ?? null));
    entries.set(paths[2], json(input.review ?? []));
    entries.set(paths[3], json(input.layout));
    entries.set(paths[4], json(input.equipment ?? []));
    if (!input.analysis) missing.push({kind:'analysis',reason:'NOT_AVAILABLE'});
    let image = null;
    if (input.image) {
      const bytes = new Uint8Array(input.image.bytes);
      const png = bytes.length>8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
      const jpg = bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
      if (!png && !jpg) fail('INVALID_IMAGE_SIGNATURE');
      image = {path:'drawing/original.'+(png?'png':'jpg'),filename:input.image.name,mimeType:png?'image/png':'image/jpeg'};
      entries.set(image.path,bytes);
    } else missing.push({kind:'image',reason:'NOT_AVAILABLE'});
    const resources=[];
    for (const resource of input.resources || []) {
      const bytes=new Uint8Array(resource.bytes), hash=sha(bytes), path='assets/'+hash+'.bin';
      entries.set(path,bytes); resources.push({source:resource.source,path,sha256:hash});
    }
    let total=0; const files=[];
    for (const [path,bytes] of entries) { total+=bytes.length; files.push({path,byteSize:bytes.length,sha256:sha(bytes)}); }
    if (total>LIMIT) fail('PACKAGE_TOO_LARGE');
    const manifest={format:VERSION,createdAt:new Date().toISOString(),image,files,resources,missingResources:missing,complete:missing.length===0};
    const zip=new Zip(); for(const [path,bytes] of entries) zip.file(path,bytes);
    zip.file('manifest.json',json(manifest));
    return {bytes:await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}),manifest};
  }
  async function inspect(bytes) {
    if(bytes.byteLength>LIMIT) fail('PACKAGE_TOO_LARGE');
    const zip=await Zip.loadAsync(bytes,{checkCRC32:false,createFolders:false});
    let total=0,count=0;
    for(const [name,file] of Object.entries(zip.files)) {
      if(file.dir) continue;
      if(!safe(name) || (file.unsafeOriginalName && file.unsafeOriginalName!==name)) fail('UNSAFE_PATH');
      if(++count>2048) fail('TOO_MANY_FILES');
      total+=file._data?.uncompressedSize || 0; if(total>LIMIT) fail('EXPANDED_PACKAGE_TOO_LARGE');
    }
    if(!zip.file('manifest.json')) fail('MANIFEST_MISSING');
    const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
    if(manifest.format!==VERSION) fail('UNSUPPORTED_VERSION');
    if(!Array.isArray(manifest.files)||!Array.isArray(manifest.resources)||!Array.isArray(manifest.missingResources)) fail('INVALID_MANIFEST');
    const entries=new Map();
    for(const item of manifest.files){
      if(!safe(item.path)||item.path==='manifest.json'||entries.has(item.path)) fail('INVALID_FILE_REFERENCE');
      const f=zip.file(item.path);if(!f) fail('FILE_MISSING: '+item.path);
      const data=await f.async('uint8array');
      if(data.length!==item.byteSize || sha(data)!==item.sha256) fail('HASH_MISMATCH: '+item.path);
      entries.set(item.path,data);
    }
    for(const [name,f] of Object.entries(zip.files)) if(!f.dir&&name!=='manifest.json'&&!entries.has(name)) fail('UNLISTED_FILE');
    for(const p of paths) if(!entries.has(p)) fail('REQUIRED_FILE_MISSING: '+p);
    for(const r of manifest.resources) if(!entries.has(r.path)||sha(entries.get(r.path))!==r.sha256) fail('RESOURCE_REFERENCE_INVALID');
    if(manifest.image&&!entries.has(manifest.image.path)) fail('IMAGE_REFERENCE_INVALID');
    const parsed=paths.map(p=>JSON.parse(decoder.decode(entries.get(p))));
    if(!parsed[3]||!Array.isArray(parsed[3].instances)||!Array.isArray(parsed[4])||!Array.isArray(parsed[2])) fail('INVALID_DATA_SHAPE');
    if(JSON.stringify(parsed[0]?.coordinate??null)!==JSON.stringify(parsed[1])) fail('COORDINATE_MISMATCH');
    return {manifest,entries,analysis:parsed[0],coordinate:parsed[1],review:parsed[2],layout:parsed[3],equipment:parsed[4]};
  }
  const api={build,inspect,version:VERSION};
  if(node){module.exports=api;return;} root.P006_FACTORY_PACKAGE=api;
  const host=document.querySelector('.documentbar'); if(!host)return;
  const dialog=document.createElement('dialog'); dialog.style.cssText='width:min(850px,90vw);max-height:85vh;overflow:auto';
  dialog.innerHTML='<h2>공장 패키지 · ZIP</h2><p>원본 이미지·분석·축척·검토·배치·설비 목록을 함께 보관합니다. 불러오기는 검증 Preview이며 현재 배치를 바꾸지 않습니다.</p><button data-export>현재 공장 ZIP 다운로드</button> <label>ZIP 불러오기 <input type="file" accept=".zip" data-import></label><p role="status" data-status></p><img data-image alt="패키지 원본 구조도" hidden style="max-width:100%;max-height:250px"><pre data-result style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><button data-repack disabled>검증한 ZIP 다시 다운로드</button> <button data-close>닫기</button>';
  dialog.querySelector('[data-result]').style.maxHeight='230px';dialog.querySelector('[data-result]').style.overflow='auto';
  document.body.append(dialog);const button=document.createElement('button');button.textContent='공장 패키지 ZIP';host.append(button);button.onclick=()=>{if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.open=true;dialog.removeAttribute('hidden');}};const closeDialog=event=>{event?.preventDefault();event?.stopPropagation();try{if(typeof dialog.close==='function' && dialog.open)dialog.close();}catch(_e){}finally{dialog.open=false;dialog.setAttribute('hidden','');dialog.style.display='none';}};const closeButton=dialog.querySelector('[data-close]');closeButton.type='button';closeButton.addEventListener('click',closeDialog);closeButton.onclick=closeDialog;document.addEventListener('click',e=>{if(e.target&&e.target.matches&&e.target.matches('[data-close]'))closeDialog(e)},true);
  let imageFile=null, importedBytes=null, previewURL=null;
  document.addEventListener('change',event=>{if(event.target.type==='file'&&event.target.closest('#structureImagePanel')===null&&event.target.accept?.includes('.png')) imageFile=event.target.files?.[0]||null;},true);
  const message=t=>dialog.querySelector('[data-status]').textContent=t;
  const download=bytes=>{const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));const a=document.createElement('a');a.href=url;a.download='p006-factory-package.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  async function collect(){
    const layout=JSON.parse(JSON.stringify(root.P006_GET_LAYOUT?.()??null));if(!layout)fail('공장 Layout을 먼저 불러오세요.');
    const analysis=JSON.parse(JSON.stringify(root.P006_STRUCTURE_IMAGE_ANALYSIS?.getState()?.result??null));
    const missing=[],resources=[];let equipment=[],items=[];
    try{const response=await fetch('/projects/P006/registry-api/composer/catalog',{credentials:'same-origin'});if(!response.ok)throw Error('HTTP '+response.status);const catalog=await response.json();equipment=catalog.equipment||[];items=catalog.items||[];}catch(e){missing.push({kind:'equipment/catalog',reason:String(e.message)});}
    const urls=new Set();
    for(const instance of layout.instances){const asset=items.find(a=>a.id===instance.assetId);if(instance.assetId&&!asset)missing.push({kind:'asset',id:instance.assetId,reason:'CATALOG_ENTRY_UNAVAILABLE'});for(const data of [instance,asset])if(data)for(const key of ['entryUsd','entry_usd','modelUrl','model_url','glbUrl','glb_url','thumbnail','thumbnail_url'])if(typeof data[key]==='string')urls.add(data[key]);}
    for(const source of urls){try{const url=new URL(source,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/projects/P006/assets/'))throw Error('OUTSIDE_ALLOWED_ASSET_ROOT');const r=await fetch(url,{credentials:'same-origin'});if(!r.ok||/text\/html/.test(r.headers.get('content-type')||''))throw Error('RESOURCE_UNAVAILABLE');const bytes=new Uint8Array(await r.arrayBuffer());resources.push({source,bytes});if(/\.(gltf|usd|usda)$/i.test(url.pathname))missing.push({kind:'dependency',source,reason:'TRANSITIVE_DEPENDENCIES_NOT_VERIFIED'});}catch(e){missing.push({kind:'resource',source,reason:e.message});}}
    const review=[];for(const field of ['detectedRegions','walls','aisles','equipmentDetections'])for(const c of analysis?.[field]||[])review.push({candidateId:c.candidateId,type:c.type,reviewStatus:c.reviewStatus});
    const image=imageFile?{name:imageFile.name,bytes:await imageFile.arrayBuffer()}:null;
    if(image&&analysis?.image?.filename!==image.name)fail('분석 이미지와 선택 파일이 다릅니다. 다시 분석하세요.');
    return {layout,analysis,review,equipment,resources,missing,image};
  }
  function show(result){dialog.querySelector('[data-result]').textContent=JSON.stringify({format:result.manifest.format,files:result.manifest.files.length,layoutInstances:result.layout?.instances.length,sha256:'ALL VERIFIED',missingResources:result.manifest.missingResources,analysis:result.analysis,review:result.review},null,2);}
  dialog.querySelector('[data-export]').onclick=async()=>{try{message('패키지 생성·검증 중…');const out=await build(await collect());const checked=await inspect(out.bytes);show(checked);download(out.bytes);message('ZIP 다운로드 완료 · 누락 '+out.manifest.missingResources.length+'건');}catch(e){message('내보내기 실패: '+e.message);}};
  dialog.querySelector('[data-import]').onchange=async event=>{importedBytes=null;dialog.querySelector('[data-repack]').disabled=true;dialog.querySelector('[data-image]').hidden=true;try{const file=event.target.files[0];if(!file)return;message('ZIP 검증 중…');const bytes=new Uint8Array(await file.arrayBuffer());const result=await inspect(bytes);show(result);importedBytes=bytes;dialog.querySelector('[data-repack]').disabled=false;if(result.manifest.image){if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(new Blob([result.entries.get(result.manifest.image.path)],{type:result.manifest.image.mimeType}));const im=dialog.querySelector('[data-image]');im.src=previewURL;im.hidden=false;}message('Import Preview 완료 · 현재 Layout 변경 없음 · 누락 '+result.manifest.missingResources.length+'건');}catch(e){dialog.querySelector('[data-result]').textContent='';message('ZIP 거부: '+e.message);}};
  dialog.querySelector('[data-repack]').onclick=()=>{if(importedBytes)download(importedBytes);};
})(typeof window==='undefined'?globalThis:window);
