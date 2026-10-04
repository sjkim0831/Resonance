"""Read-only composition of three already verified factory stages."""
import json, uuid
from pathlib import Path
from service import Fault, adminonly, validid, one

ROOT = Path('/home/sjkim/OmniverseProjects/factory-layouts')

def handle(c, actor, method, suffix, payload, params):
 adminonly(actor)
 if suffix == '/network-usd' and method == 'POST':
  if set(payload) != {'networkId'}: raise Fault(400, '저장된 networkId만 지정하세요')
  network_id = validid(payload['networkId'])
  from composer_api import get_layout
  doc = get_layout(c, network_id)
  design = doc.get('settings', {}).get('networkDesign')
  if not design or design.get('schema') != 'P006_NETWORK_V1': raise Fault(400, '생산망 설계 아님')
  factories = design['factories']
  if len(factories) != 3: raise Fault(409, '이번 Pilot은 공장 3개만 내보냅니다')
  refs = design.get('stageRefs') or {}
  if set(refs) != {f['factoryInstanceId'] for f in factories}: raise Fault(409, '공장별 Stage가 모두 필요합니다')
  lines = ['#usda 1.0', '(', '    defaultPrim = "ProductionNetwork"', '    metersPerUnit = 1', '    upAxis = "Y"', ')', '', 'def Xform "ProductionNetwork"', '{']
  manifest = []
  for index, f in enumerate(factories):
   stage_id = validid(refs[f['factoryInstanceId']])
   stage_dir = ROOT / stage_id
   stage_file = stage_dir / 'Factory.usda'
   if not stage_file.is_file() or not (stage_dir / 'verification.json').is_file(): raise Fault(409, '검증된 공장 Stage 누락')
   job = json.loads((stage_dir / 'job.json').read_text())
   current = one(c, 'select version from factory_layout where id=%s', (f['layoutId'],))
   if not current or job.get('layoutId') != f['layoutId'] or job.get('version') != f['layoutVersion'] or current['version'] != f['layoutVersion']: raise Fault(409, '공장 Stage/참조 버전 불일치')
   pos = f['mapPosition']
   if not isinstance(pos, list) or len(pos) != 3 or any(type(x) not in (float, int) or abs(x) > 100000 for x in pos): raise Fault(400, '지도 좌표 오류')
   prim = 'Factory_' + chr(65 + index)
   ref = '../' + stage_id + '/Factory.usda'
   lines.extend([f'    def Xform "{prim}" (', f'        references = @{ref}@', '    )', '    {', f'        double3 xformOp:translate = ({pos[0]}, {pos[1]}, {pos[2]})', '        uniform token[] xformOpOrder = ["xformOp:translate"]', '    }'])
   manifest.append({'factoryInstanceId': f['factoryInstanceId'], 'layoutId': f['layoutId'], 'layoutVersion': f['layoutVersion'], 'stageId': stage_id, 'primPath': '/ProductionNetwork/' + prim, 'reference': ref, 'mapPosition': pos})
  lines.append('}')
  export_id = str(uuid.uuid4()); out = ROOT / ('network-' + export_id); out.mkdir(mode=0o750)
  target = out / 'ProductionNetwork.usda'; target.write_text('\n'.join(lines) + '\n')
  (out / 'manifest.json').write_text(json.dumps({'networkId': network_id, 'networkVersion': doc['version'], 'factories': manifest, 'evidenceStatus': design['evidenceStatus']}, ensure_ascii=False, indent=2))
  return {'id': export_id, 'networkId': network_id, 'networkVersion': doc['version'], 'factoryCount': len(manifest), 'manifest': manifest, 'usdUrl': '/projects/P006/registry-api/composer/network-usd/' + export_id + '/usd', 'processExecutionVerified': False}
 parts = suffix.strip('/').split('/')
 if len(parts) == 3 and parts[0] == 'network-usd' and parts[2] in ('usd', 'manifest') and method == 'GET':
  export_id = validid(parts[1]); out = ROOT / ('network-' + export_id)
  target = out / ('ProductionNetwork.usda' if parts[2] == 'usd' else 'manifest.json')
  if not target.is_file(): raise Fault(404, '생산망 USD 없음')
  return {'_download': str(target), 'downloadName': target.name}
 raise Fault(404, '생산망 USD API 없음')
