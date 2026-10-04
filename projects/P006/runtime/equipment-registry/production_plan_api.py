"""Account-private, revision-checked persistence for integrated P006 plans."""
import hashlib
import json
import os
import re
import threading
import time
import uuid
from pathlib import Path

from service import DATA, Fault

LOCK = threading.RLock()
ROOT = DATA / 'production-plans'
MAX_PLAN_BYTES = 2 * 1024 * 1024
PLAN_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$')


def account_dir(account_id):
    digest = hashlib.sha256(str(account_id).encode()).hexdigest()
    folder = ROOT / digest
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def read_json(path, fallback):
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        raise Fault(500, '저장된 계획 파일을 읽지 못했습니다. 관리자에게 복구를 요청하세요')


def atomic_json(path, data):
    temp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(',', ':')), encoding='utf-8')
    os.replace(temp, path)


def handle(a, method, path, payload):
    parts = path.strip('/').split('/')
    folder = account_dir(a['accountId'])
    index_path = folder / 'index.json'
    audit_path = folder / 'audit.jsonl'
    with LOCK:
        index = read_json(index_path, {})
        if not isinstance(index, dict):
            raise Fault(500, '계획 목록 저장소 형식 오류')
        if method == 'GET' and len(parts) == 1:
            return {'items': sorted(index.values(), key=lambda x: x.get('updatedAt', ''), reverse=True)}
        if len(parts) == 1 and method == 'POST':
            plan = payload.get('plan')
            base_version = payload.get('baseVersion')
            if not isinstance(plan, dict) or base_version != 0:
                raise Fault(400, '신규 계획은 plan 객체와 baseVersion=0이 필요합니다')
            plan_id = str(plan.get('id') or '')
            if not PLAN_ID.fullmatch(plan_id):
                raise Fault(400, '계획 ID 형식 오류')
            current = index.get(plan_id)
            if current:
                raise Fault(409, '이미 같은 ID의 서버 계획이 있습니다. 서버 목록을 새로고침하세요')
            return save_plan(a, folder, index, index_path, audit_path, plan, plan_id, 0)
        if len(parts) != 2 or not PLAN_ID.fullmatch(parts[1]):
            raise Fault(404, '계획 경로를 찾을 수 없습니다')
        plan_id = parts[1]
        if method == 'GET':
            row = index.get(plan_id)
            if not row:
                raise Fault(404, '서버에서 계획을 찾을 수 없습니다')
            plan = read_json(folder / (plan_id + '.json'), None)
            if not isinstance(plan, dict):
                raise Fault(500, '계획 원본이 손상되었거나 없습니다')
            return {'plan': plan, 'version': row['version'], 'updatedAt': row['updatedAt']}
        if method == 'POST':
            plan = payload.get('plan')
            base_version = payload.get('baseVersion')
            if not isinstance(plan, dict) or str(plan.get('id') or '') != plan_id:
                raise Fault(400, '저장할 계획 ID가 경로와 일치하지 않습니다')
            if isinstance(base_version, bool) or not isinstance(base_version, int) or base_version < 0:
                raise Fault(400, 'baseVersion은 0 이상의 정수여야 합니다')
            current = index.get(plan_id)
            actual = current['version'] if current else 0
            if actual != base_version:
                raise Fault(409, json.dumps({'message': '다른 기기/탭에서 서버 계획이 먼저 변경되었습니다. 덮어쓰기를 막았습니다.', 'serverVersion': actual}, ensure_ascii=False))
            return save_plan(a, folder, index, index_path, audit_path, plan, plan_id, base_version)
        raise Fault(405, '허용되지 않은 계획 요청')


def save_plan(actor, folder, index, index_path, audit_path, plan, plan_id, base_version):
    try:
        encoded = json.dumps(plan, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
    except (TypeError, ValueError):
        raise Fault(400, '계획 JSON에 지원되지 않는 값이 있습니다')
    if len(encoded.encode('utf-8')) > MAX_PLAN_BYTES:
        raise Fault(413, '계획은 2MiB 이하로 저장하세요. 큰 원본 파일은 자료함에 별도 등록하세요')
    for key, maximum in [('sites', 200), ('factories', 1000), ('zones', 3000), ('cells', 10000), ('equipment', 5000), ('processes', 5000), ('parts', 10000), ('transports', 5000)]:
        value = plan.get(key, [])
        if not isinstance(value, list) or len(value) > maximum:
            raise Fault(400, f'{key} 배열 형식 또는 개수 제한 오류')
    version = base_version + 1
    now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    plan_path = folder / (plan_id + '.json')
    atomic_json(plan_path, plan)
    row = {'id': plan_id, 'name': str(plan.get('name') or '이름 없는 계획')[:250], 'code': str(plan.get('code') or '')[:100], 'revision': plan.get('revision', 1), 'version': version, 'updatedAt': now}
    index[plan_id] = row
    atomic_json(index_path, index)
    audit = {'at': now, 'account': hashlib.sha256(str(actor['accountId']).encode()).hexdigest(), 'action': 'PLAN_CREATE' if base_version == 0 else 'PLAN_UPDATE', 'planId': plan_id, 'version': version, 'bytes': len(encoded.encode('utf-8'))}
    with audit_path.open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(audit, ensure_ascii=False, separators=(',', ':')) + '\n')
    return {'planId': plan_id, 'version': version, 'updatedAt': now, 'status': 'SAVED'}
