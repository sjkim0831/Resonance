import json,time,hashlib,shutil,collections,math
from pathlib import Path
from PIL import Image,ImageStat,ImageChops,ImageDraw
root=Path('/home/sjkim/OmniverseProjects/p006-visual666-v1');start=time.time()
def read(p):return json.loads(Path(p).read_text(encoding='utf8'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p,d):Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf8')
render=read(root/'render-evidence.json');assert len(render['assets'])==666 and not render['failures']
assert all(r.get('imageSha256') for r in render['assets']),'Render finalization incomplete'
resolver=read(root/'resolver.json');live=Path('/opt/Resonance/projects/P006/frontend/coverage666/resolver.json');assert read(live)==resolver
catalog={r['id']:r for r in read(root/'independent-catalog.json')['assets']};audit=read('/home/sjkim/OmniverseProjects/p006-base204-quality-v3/usd-audit.json');ar={r['id']:r for r in audit['rows']};bm={b['key']:b for b in audit['bases']};quality={r['id']:r for r in read('/opt/Resonance/projects/P006/frontend/base204-quality-v3/all666.json')}
eng=dict(line.split('\t',1) for line in (root/'visual666-english.tsv').read_text(encoding='utf8').splitlines() if line)
domains=dict(zip('AGV AIR ASSEMBLY BAT BUILD CAST CONVEY ELEC ENV FOOD HEAT HYD JOIN MACHINE MAINT METROLOGY NET PACK PIPE POLY POWER QUALITY RECEIVE ROBOT SAFE SEMI SENSE SHEET STORE SURFACE TOOL UTIL WORKER'.split(),'AGV·AMR|공압|조립 자동화|배터리 제조|건축·인프라|주조·단조|컨베이어·물류|전기·제어|환경·집진|식품·제약|열처리|유압|용접·접합|기계 가공|유지보수|검사·계측|PLC·산업 네트워크|포장|배관|플라스틱·고무|동력전달|품질|입고·출하|로봇·EOAT|안전|반도체·전자|센서·비전·RFID|판금·성형|창고·보관|표면처리|금형·공구|유틸리티|작업자 지원'.split('|')))
assets=[];qa=[];seen=set();sourceHashes={};dupes=collections.defaultdict(list)
for e in render['assets']:
 aid=e['id'];assert aid not in seen;seen.add(aid);c=catalog[aid];r=ar[aid];path=root/e['image']
 assert e['path']==r['path'] and e['primPath']==r['primPath'] and r['primPath']!='/Catalog'
 assert sha(path)==e['imageSha256'];sourceHashes.update(e['dependencies'])
 with Image.open(path) as im:
  im.load();assert im.size==(640,480);rgb=im.convert('RGB');stats=ImageStat.Stat(rgb);spread=max(stats.stddev);assert spread>1,(aid,'flat image',spread)
  background=Image.new('RGB',rgb.size,rgb.getpixel((0,0)));difference=ImageChops.difference(rgb,background).convert('L');mask=difference.point(lambda v:255 if v>3 else 0);occupancy=sum(mask.histogram()[128:])/(640*480)
  assert occupancy>.002,(aid,'nearly blank',occupancy)
  bounds=mask.getbbox();margin=min(bounds[0],bounds[1],640-bounds[2],480-bounds[3]);assert margin>=4,(aid,'clipped framing',margin)
 qa.append({'id':aid,'decoded':True,'width':640,'height':480,'spread':spread,'nonBackgroundFraction':round(occupancy,4),'framingMarginPixels':margin,'bytes':path.stat().st_size,'sha256':e['imageSha256']});dupes[e['imageSha256']].append(aid)
 base=bm[r['baseKey']];shared=bool(e['selection']) or len(base['members'])>1
 english=c.get('englishName') or eng.get(aid);assert english,(aid,'English name missing')
 assets.append({'id':aid,'name':c['name'],'englishName':english,'englishNameSource':'EXISTING_CATALOG' if c.get('englishName') else 'DESCRIPTIVE_TRANSLATION_NOT_OFFICIAL_MODEL_NAME','domain':c['domain'],'category':domains[c['domain']],'kind':c['kind'],'usdConnected':True,'usdPath':e['path'],'primPath':e['primPath'],'image':e['image'],'imageStatus':'USD_RENDER_SOURCE_UNVERIFIED' if aid in ['E001','E002','E003','E004','E005','E006'] else 'REFERENCE_RENDER','renderer':e['renderer'],'method':'BASE_VARIANT' if shared else 'INDIVIDUAL_USD','imageMethod':e['method'],'sourceSha256':e['sourceSha256'],'imageSha256':e['imageSha256'],'basePath':base['path'],'baseMembers':len(base['members']),'variant':e['selection'],'variantLabel':', '.join(k+'='+v for k,v in e['selection'].items()) or '개별 구성 · '+aid,'dimensions':e['boundsMeters'],'geometryState':quality[aid]['geometryState'],'timestamp':e['timestamp']})
assert len(assets)==666 and len(seen)==666
order={aid:i for i,aid in enumerate(catalog)};assets.sort(key=lambda a:order[a['id']])
for p,h in sourceHashes.items():assert sha(p)==h,(p,'Source mutated')
renderEnvironment={p:h for p,h in sourceHashes.items() if p not in audit['sourceHashes']}
assert all('omni.kit.viewport.menubar.lighting-' in p and p.endswith('/data/usd/Default.usda') for p in renderEnvironment),'Unknown render dependency'
assert all(audit['sourceHashes'].get(p)==h for p,h in sourceHashes.items() if p not in renderEnvironment),'Source dependency inventory drift'
assert all(sha(p)==h for p,h in audit['sourceHashes'].items()),'Baseline source inventory changed'
m=collections.Counter(r['method'] for r in assets);metrics={'total':666,'previewAvailable':666,'actualUsdRenders':666,'individualUsdRenders':m['INDIVIDUAL_USD'],'baseVariantRenders':m['BASE_VARIANT'],'noPreview':0,'referenceRender':sum(r['imageStatus']=='REFERENCE_RENDER' for r in assets),'uniqueImageHashes':len(dupes),'note':'actualUsdRenders = individualUsdRenders + baseVariantRenders. Counts are asset coverage, not distinct verified equipment.'}
assert metrics['individualUsdRenders']+metrics['baseVariantRenders']==666
write(root/'catalog.json',{'version':'P006-VISUAL666-1','metrics':metrics,'categories':{k:v for k,v in domains.items() if any(r['domain']==k for r in assets)},'assets':assets,'renderSeconds':render['seconds']})
write(root/'image-qa.json',{'count':len(qa),'decodePass':len(qa),'nonblankPass':len(qa),'images':qa,'identicalPixelGroups':[v for v in dupes.values() if len(v)>1],'limits':'Automated nonblank check and contact-sheet visual inspection are not asset geometry qualification.'})
write(root/'preservation.json',{'sourceHashes':audit['sourceHashes'],'renderEnvironmentHashes':renderEnvironment,'resolverSha256':sha(live),'usdModified':0,'resolverModified':0,'qualityPromotions':0,'deviceWrites':0,'otherEquipmentPhotoSubstitutions':0})
# Contact sheets: inspection artifacts only, thumbnails remain original RTX captures.
for i in range(0,len(assets),80):
 page=Image.new('RGB',(1280,1440),'#eef3f7');draw=ImageDraw.Draw(page)
 for j,r in enumerate(assets[i:i+80]):
  x=(j%8)*160;y=(j//8)*144
  with Image.open(root/r['image']) as im:page.paste(im.convert('RGB').resize((160,120)),(x,y))
  draw.text((x+5,y+122),r['id']+' '+r['method'][:4],fill='#12324f')
 page.save(root/('contact-%02d.jpg'%(i//80+1)),quality=90)
out=Path('/opt/Resonance/projects/P006/frontend/visual-catalog');out.mkdir(exist_ok=True);(out/'images').mkdir(exist_ok=True)
for r in assets:shutil.copy2(root/r['image'],out/r['image'])
for name in ['catalog.json','image-qa.json','render-evidence.json','preservation.json','render-visual666.py','build-visual666.py']:
 shutil.copy2(root/name,out/name)
for p in root.glob('contact-*.jpg'):shutil.copy2(p,out/p.name)
shutil.copy2(root/'visual666-page.html',out/'index.html')
(out/'design-qa.md').write_text('''# P006 666종 이미지 카탈로그

원씽: 연결 목록이 아닌 모든 연결 자산의 실제 USD 렌더 이미지 제공.
입력: 현재 666종 resolver의 개별 USD/prim. /Catalog 전체 참조 금지.
처리: 독립 Omniverse Kit RTX 프로세스, 자산마다 새 Stage, 정확한 prim 참조, bbox 기준 카메라, 640x480 PNG. 기존 라이브 Stage 및 원본 수정 없음.
출력: 카드 이미지/한글명/영문명/ID/분류/USD 연결 여부/이미지 출처/생성 방식/Variant/모델 치수.
부족 영문명은 설명용 번역. 제조사 공식 명칭 또는 모델명으로 간주하지 않는다.
REFERENCE_RENDER는 참고 설계 자산. USD_RENDER_SOURCE_UNVERIFIED는 원본 출처 자산 렌더이며 실제 장비 검증 완료를 의미하지 않는다.
실제 USD 렌더 합계 = 개별 USD + 공통 베이스/Variant. 3개 숫자를 서로 더하지 않는다.
공통 형상이 같더라도 자산별 정확한 prim과 Variant를 각각 렌더했고 카드에서 ID/형상 구성을 구별한다.

## 페이지 검증
정적 페이지, 사용 계정 없음. 검색→분류→렌더종류→페이지 전환→확대→닫기/Escape. 666개 전체 보기 지원, 기본 48개 페이지와 lazy loading으로 초기 로딩 최소화.
이미지 666개 디코딩/해시/크기/비단색 검사. 실제 HTTP 이미지 MIME 및 브라우저 디코딩 검사. 데스크톱/모바일 스크린샷 검수.
원본/종속 USD 226개 및 resolver 해시 보존. 검증 상태 승격 0, 장비 쓰기 0.

## 다음 업무
이미지로 필요한 자산을 선택한다. 형상 유사성을 제품 완성도와 혼동하지 않고 별도 geometry 품질 장부로 확인한다. 배치나 연결 제어는 이번 화면의 범위가 아니다.
''',encoding='utf8')
result={**metrics,'renderSeconds':round(render['seconds'],2),'publishValidationSeconds':round(time.time()-start,2),'bytes':sum(p.stat().st_size for p in out.rglob('*') if p.is_file())};write(out/'deployment.json',result);print(json.dumps(result,indent=2))
