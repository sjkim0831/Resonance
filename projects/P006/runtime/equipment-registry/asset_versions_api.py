"""Immutable, approval-gated version history for shared P006 USD/GLB assets."""
import hashlib
import json
import re
from pathlib import Path


def _file_record(path_value, kind):
    from service import Fault, text

    value = text(path_value, kind == 'USD', 2000)
    if not value:
        return None
    if kind == 'USD':
        root = Path('/home/sjkim/OmniverseProjects').resolve()
        candidate = Path(value).resolve()
        if not candidate.is_relative_to(root) or candidate.suffix.lower() not in {'.usd', '.usda', '.usdc', '.usdz'}:
            raise Fault(400, 'USD는 프로젝트 카탈로그 안의 USD 경로여야 합니다')
    else:
        prefix = '/projects/P006/'
        if not value.startswith(prefix) or value.startswith('//') or '\\' in value:
            raise Fault(400, '웹 GLB는 /projects/P006/ 내부 경로여야 합니다')
        root = Path('/opt/Resonance/projects/P006').resolve()
        candidate = (root / value[len(prefix):]).resolve()
        if not candidate.is_relative_to(root) or candidate.suffix.lower() != '.glb':
            raise Fault(400, '웹 모델은 프로젝트 내부 GLB 경로여야 합니다')
    if not candidate.is_file():
        raise Fault(400, f'{kind} 파일을 서버에서 찾을 수 없습니다')
    digest = hashlib.sha256()
    size = 0
    with candidate.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            size += len(chunk)
            digest.update(chunk)
    return {'role': kind, 'path': value, 'sha256': digest.hexdigest(), 'bytes': size}


def _manifest(usd_paths, glb_path):
    records = []
    for role, path in usd_paths:
        record = _file_record(path, 'USD')
        if record:
            record['role'] = role
            records.append(record)
    if not any(x['role'] == 'ENTRY_USD' for x in records):
        from service import Fault
        raise Fault(400, '대표 USD 파일이 필요합니다')
    glb = _file_record(glb_path, 'GLB')
    if glb:
        records.append(glb)
    return records


def _same_files(manifest):
    for expected in manifest:
        current = _file_record(expected['path'], 'GLB' if expected['role'] == 'GLB' else 'USD')
        if not current or current['sha256'] != expected['sha256'] or current['bytes'] != expected['bytes']:
            return False
    return True


def handle(c, a, method, path, payload):
    from service import Fault, admin, adminonly, audit, rows, one, text, validid

    parts = path.strip('/').split('/')
    if len(parts) < 2 or parts[0] != 'asset-versions':
        raise Fault(404, '자산 버전 API 경로 오류')
    asset_id = text(parts[1], True, 100)
    asset = one(c, 'select * from asset where id=%s', (asset_id,))
    if not asset:
        raise Fault(404, '공통 자산 없음')
    if method != 'GET':
        rows(c, 'select id from asset where id=%s for update', (asset_id,))

    if len(parts) == 2 and method == 'GET':
        versions = rows(c, 'select id,asset_id,version_no,entry_usd,base_usd,web_glb_path,files_manifest,status,is_current,previous_version_id,change_note,created_by,created_at,reviewed_by,reviewed_at,review_note from asset_version where asset_id=%s order by version_no desc', (asset_id,))
        return {'assetId': asset_id, 'current': next((v for v in versions if v['is_current']), None), 'versions': versions,
                'canManage': admin(a), 'canApprove': admin(a) and 'RESULT_APPROVE' in (a.get('permissions') or [])}

    if len(parts) == 2 and method == 'POST':
        adminonly(a)
        entry = text(payload.get('entryUsd') or asset.get('entry_usd'), True, 2000)
        base = text(payload.get('baseUsd') or asset.get('base_usd'), False, 2000)
        glb = text(payload.get('webGlbPath'), False, 2000)
        if glb:
            # The versioned preview must use the same asset identity unless a future migration
            # explicitly records a separate derivative identity.
            if glb != '/projects/P006/assets/3d-derived/' + asset_id + '.glb':
                raise Fault(400, '현재는 /projects/P006/assets/3d-derived/{자산ID}.glb 경로만 버전으로 연결할 수 있습니다')
        manifest = _manifest([('ENTRY_USD', entry), ('BASE_USD', base)], glb)
        note = text(payload.get('changeNote'), True, 2000)
        latest = one(c, 'select id,version_no from asset_version where asset_id=%s order by version_no desc limit 1 for update', (asset_id,))
        number = (latest['version_no'] if latest else 0) + 1
        previous = latest['id'] if latest else None
        version_id = str(__import__('uuid').uuid4())
        rows(c, 'insert into asset_version(id,asset_id,version_no,entry_usd,base_usd,web_glb_path,files_manifest,status,is_current,previous_version_id,source_seed_hash,change_note,created_by) values(%s,%s,%s,%s,%s,%s,%s,\'DRAFT\',false,%s,%s,%s,%s)',
             (version_id, asset_id, number, entry, base, glb, json.dumps(manifest), previous, asset.get('seed_hash'), note, a['accountId']))
        audit(c, a, 'ASSET_VERSION_CREATE', version_id, {'assetId': asset_id, 'version': number, 'files': manifest, 'changeNote': note})
        return {'id': version_id, 'assetId': asset_id, 'version': number, 'status': 'DRAFT', 'files': manifest}

    if len(parts) == 4 and parts[3] == 'review' and method == 'POST':
        adminonly(a)
        if 'RESULT_APPROVE' not in (a.get('permissions') or []):
            raise Fault(403, 'RESULT_APPROVE 권한이 필요합니다')
        version_id = validid(parts[2])
        version = one(c, 'select * from asset_version where id=%s and asset_id=%s for update', (version_id, asset_id))
        if not version:
            raise Fault(404, '자산 버전을 찾을 수 없습니다')
        if version['status'] != 'DRAFT':
            raise Fault(409, '검토 가능한 초안 버전이 아닙니다')
        status = payload.get('status')
        note = text(payload.get('reviewNote'), True, 2000)
        if status not in ('APPROVED', 'REJECTED'):
            raise Fault(400, '검토 결과는 APPROVED 또는 REJECTED여야 합니다')
        if status == 'APPROVED':
            if not _same_files(version['files_manifest']):
                raise Fault(409, '초안 등록 이후 USD/GLB 파일이 변경되었습니다. 새 버전을 등록하세요')
            rows(c, 'update asset_version set is_current=false where asset_id=%s and is_current=true', (asset_id,))
            rows(c, 'update asset_version set status=\'SUPERSEDED\' where asset_id=%s and is_current=false and status=\'APPROVED\'', (asset_id,))
            rows(c, 'update asset_version set status=\'APPROVED\',is_current=true,reviewed_by=%s,reviewed_at=now(),review_note=%s where id=%s', (a['accountId'], note, version_id))
        else:
            rows(c, 'update asset_version set status=\'REJECTED\',reviewed_by=%s,reviewed_at=now(),review_note=%s where id=%s', (a['accountId'], note, version_id))
        audit(c, a, 'ASSET_VERSION_REVIEW', version_id, {'assetId': asset_id, 'status': status, 'note': note})
        return {'id': version_id, 'status': status, 'isCurrent': status == 'APPROVED'}

    if len(parts) == 4 and parts[3] == 'restore' and method == 'POST':
        adminonly(a)
        if 'RESULT_APPROVE' not in (a.get('permissions') or []):
            raise Fault(403, 'RESULT_APPROVE 권한이 필요합니다')
        version_id = validid(parts[2])
        version = one(c, 'select * from asset_version where id=%s and asset_id=%s for update', (version_id, asset_id))
        if not version or version['status'] not in ('APPROVED', 'SUPERSEDED'):
            raise Fault(404, '복원 가능한 승인 버전이 없습니다')
        if not _same_files(version['files_manifest']):
            raise Fault(409, '원본 파일이 변경되었거나 없어 이 버전을 복원할 수 없습니다')
        current = one(c, 'select id from asset_version where asset_id=%s and is_current=true for update', (asset_id,))
        rows(c, 'update asset_version set is_current=false,status=case when status=\'APPROVED\' then \'SUPERSEDED\' else status end where asset_id=%s and is_current=true', (asset_id,))
        rows(c, 'update asset_version set status=\'APPROVED\',is_current=true where id=%s', (version_id,))
        audit(c, a, 'ASSET_VERSION_RESTORE', version_id, {'assetId': asset_id, 'previousCurrentVersionId': current['id'] if current else None})
        return {'id': version_id, 'status': 'APPROVED', 'isCurrent': True, 'previousCurrentVersionId': current['id'] if current else None}

    raise Fault(404, '자산 버전 API 경로 또는 메서드 오류')
