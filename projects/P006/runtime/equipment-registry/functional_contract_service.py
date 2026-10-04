"""Executable Production contract adapter. Uses the existing service DB helpers."""
import json

CONNECTION_STATUSES = {'FUNCTIONAL_SIMULATION_AUTHORED', 'NOT_CONNECTABLE'}
DIRECTIONS = {'INPUT', 'OUTPUT', 'BIDIRECTIONAL'}

def _asset_exists(c, asset_id):
    return one(c, 'select id from asset where id=%s', (asset_id,)) is not None

def validate_connection(c, payload, asset_id):
    if payload.get('assetId') != asset_id: raise ValueError('ASSET_ID_MISMATCH')
    if not _asset_exists(c, asset_id): raise LookupError('ASSET_NOT_FOUND')
    if payload.get('connectionStatus') not in CONNECTION_STATUSES: raise ValueError('CONNECTION_STATUS')
    if payload.get('contractSource') != 'FUNCTIONAL_SIMULATION': raise ValueError('CONTRACT_SOURCE')
    if payload.get('manufacturerVerified') is not False or payload.get('physicalPortVerified') is not False: raise ValueError('PROVENANCE')
    ports = payload.get('logicalPorts'); rules = payload.get('relatedAssetRules')
    if not isinstance(ports, list) or not isinstance(rules, list): raise ValueError('ARRAY_REQUIRED')
    ids = [p.get('portId') for p in ports]
    if any(not x for x in ids) or len(ids) != len(set(ids)): raise ValueError('PORT_ID_UNIQUE')
    if any(p.get('direction') not in DIRECTIONS for p in ports): raise ValueError('DIRECTION')

def validate_motion(c, payload, asset_id):
    if payload.get('assetId') != asset_id: raise ValueError('ASSET_ID_MISMATCH')
    if not _asset_exists(c, asset_id): raise LookupError('ASSET_NOT_FOUND')
    if payload.get('motionSource') != 'FUNCTIONAL_SIMULATION' or payload.get('kinematicsVerified') is not False: raise ValueError('PROVENANCE')
    if not isinstance(payload.get('motionReady'), bool): raise ValueError('MOTION_READY')

def get_connection(c, asset_id):
    return one(c, 'select asset_id "assetId",connection_status "connectionStatus",logical_ports "logicalPorts",related_asset_rules "relatedAssetRules",contract_source "contractSource",manufacturer_verified "manufacturerVerified",physical_port_verified "physicalPortVerified",version,updated_at "updatedAt" from p006_functional_connection_contract where asset_id=%s', (asset_id,))

def get_motion(c, asset_id):
    return one(c, 'select asset_id "assetId",motion_type "motionType",target_node "targetNode",motion_source "motionSource",motion_ready "motionReady",kinematics_verified "kinematicsVerified",version,updated_at "updatedAt" from p006_functional_motion_contract where asset_id=%s', (asset_id,))

def upsert_connection(c, payload, expected_version):
    aid = payload['assetId']; validate_connection(c, payload, aid)
    old = one(c, 'select version from p006_functional_connection_contract where asset_id=%s for update', (aid,))
    if (old is None and expected_version is not None) or (old is not None and old['version'] != expected_version): raise RuntimeError('VERSION_CONFLICT')
    version = 1 if old is None else old['version'] + 1
    rows(c, """insert into p006_functional_connection_contract(asset_id,connection_status,logical_ports,related_asset_rules,contract_source,manufacturer_verified,physical_port_verified,version,updated_at)
      values(%s,%s,%s::jsonb,%s::jsonb,'FUNCTIONAL_SIMULATION',false,false,%s,now())
      on conflict(asset_id) do update set connection_status=excluded.connection_status,logical_ports=excluded.logical_ports,related_asset_rules=excluded.related_asset_rules,version=excluded.version,updated_at=now()""", (aid,payload['connectionStatus'],Json(payload['logicalPorts']),Json(payload['relatedAssetRules']),version))
    return get_connection(c, aid)

def upsert_motion(c, payload, expected_version):
    aid = payload['assetId']; validate_motion(c, payload, aid)
    old = one(c, 'select version from p006_functional_motion_contract where asset_id=%s for update', (aid,))
    if (old is None and expected_version is not None) or (old is not None and old['version'] != expected_version): raise RuntimeError('VERSION_CONFLICT')
    version = 1 if old is None else old['version'] + 1
    rows(c, """insert into p006_functional_motion_contract(asset_id,motion_type,target_node,motion_source,motion_ready,kinematics_verified,version,updated_at)
      values(%s,%s,%s,'FUNCTIONAL_SIMULATION',%s,false,%s,now())
      on conflict(asset_id) do update set motion_type=excluded.motion_type,target_node=excluded.target_node,motion_ready=excluded.motion_ready,version=excluded.version,updated_at=now()""", (aid,payload['motionType'],payload.get('targetNode'),payload['motionReady'],version))
    return get_motion(c, aid)

def one(c, sql, args=()):
    from service import one as db_one
    return db_one(c, sql, args)
def rows(c, sql, args=()):
    from service import rows as db_rows
    return db_rows(c, sql, args)
from service import Json
