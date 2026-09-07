#!/usr/bin/env python3
import datetime,json,math,pathlib
root=pathlib.Path(__file__).parent/'catalog'
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
names={'casting_machine':'주조기','holding_furnace':'보온로','turntable_furnace':'턴테이블로','trimming_machine':'트리밍','cooling_unit':'냉각장비','robot_panel':'로봇 제어반','spray_ladler':'스프레이 로봇·래들','release_agent':'이형제 장치','main_panel':'전체 제어반','vacuum_unit':'진공장치','casting_filter':'주조기 필터','melting_furnace':'용해로','takeout_robot':'취출 로봇','punching_press':'펀칭 프레스','ladler':'래들러','mold_cooling':'금형 고압냉각장비'}
groups={}
for asset in manifest['assets']:
 if asset.get('placeable') and asset.get('assetCode') in names:groups.setdefault(asset['assetCode'],[]).append({'assetId':asset['id']})
presets=[];placements=[]
codes=list(names)
for group_index,code in enumerate(codes):
 assets=groups.get(code,[]);zone_col=group_index%4;zone_row=group_index//4;origin_x=2+zone_col*24.5;origin_y=2+zone_row*24.5;cols=max(1,math.ceil(math.sqrt(len(assets))));step=min(4.0,20/max(cols,1))
 group_placements=[]
 for index,asset in enumerate(assets):
  item={'sequence':len(placements)+1,'assetId':asset['assetId'],'assetCode':f"catalog_{asset['assetId'].lower()}",'equipmentCode':code,'x':round(origin_x+(index%cols)*step,2),'y':round(origin_y+(index//cols)*step,2),'rotationY':90 if index%2 else 0,'footprintPct':round(step*.72,2)}
  placements.append(item);group_placements.append(item)
 presets.append({'equipmentCode':code,'equipmentName':names.get(code,code),'count':len(assets),'zone':group_index+1,'origin':[origin_x,origin_y],'placements':group_placements})
collisions=[]
for index,left in enumerate(placements):
 for right in placements[index+1:]:
  if abs(left['x']-right['x'])<max(left['footprintPct'],right['footprintPct']) and abs(left['y']-right['y'])<max(left['footprintPct'],right['footprintPct']):collisions.append([left['assetId'],right['assetId']])
plan={'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'PASS' if len(presets)==16 and all(p['count'] for p in presets) and not collisions else 'FAIL','policy':'16 equipment zones, non-destructive upsert, collision-free proxy footprints','equipmentGroups':len(presets),'activeGroups':sum(bool(p['count']) for p in presets),'assetCount':len(placements),'collisionCount':len(collisions),'factoryGrid':[4,4],'presets':presets,'placements':placements,'collisions':collisions,'workflow':['PREVIEW','COLLISION_CHECK','UPSERT_LAYER','SYNC_USD']}
(root/'classified-assembly-presets.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':plan['status'],'equipmentGroups':len(presets),'assetCount':len(placements),'collisionCount':len(collisions),'counts':{p['equipmentCode']:p['count'] for p in presets}},ensure_ascii=False))
