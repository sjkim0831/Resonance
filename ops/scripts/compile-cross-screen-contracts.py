#!/usr/bin/env python3
import hashlib,json,sys,time
from collections import defaultdict
from pathlib import Path

start=time.perf_counter()
data=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
db={(x["table"].lower(),x["column"].lower()):x for x in data["databaseColumns"]}
endpoints={(x["method"].upper(),x["path"].split("?")[0]) for x in data["registeredEndpoints"]}
canon={}; bindings=[]; issues=[]; issue_keys=set(); screens=defaultdict(list)

def issue(code,severity,resource,field,message,evidence=None):
    signature=(code,severity,resource,field or "")
    if signature in issue_keys:return
    issue_keys.add(signature)
    issues.append({"issueCode":code,"severity":severity,"resourceKey":resource,
      "fieldKey":field or "","message":message,"evidence":evidence or {}})
def family(value):
    value=value.upper()
    if value in {"STRING","TEXT","CODE","UUID","YEAR"}:return "TEXT"
    if value in {"INTEGER","LONG","DECIMAL","NUMBER","FLOAT","DOUBLE"}:return "NUMBER"
    if value in {"DATE","DATETIME","TIMESTAMP"}:return "TEMPORAL"
    if value in {"BOOLEAN","BOOL"}:return "BOOLEAN"
    return value
def key_for(f):
    table=f.get("sourceTable"); column=f.get("sourceColumn")
    if table and column:return f"db:{table.lower()}.{column.lower()}"
    prop=f.get("apiProperty") or f.get("fieldCode")
    return f"api:{str(prop).strip().lower()}"
def parse_api(value):
    if isinstance(value,str):
        parts=value.strip().split(maxsplit=1)
        return (parts[0].upper(),parts[1].split("?")[0]) if len(parts)==2 else None
    if isinstance(value,dict):
        return (str(value.get("method","GET")).upper(),str(value.get("path") or value.get("routePath","")).split("?")[0])

for c in data["contracts"]:
    resource=f'{c["processCode"]}:{c["stepCode"]}:{c["audience"]}:{c["routePath"]}'
    fields=c.get("fields") if isinstance(c.get("fields"),list) else []
    screens[(c["processCode"],c["audience"])].append(c)
    seen=set()
    for pos,f in enumerate(fields):
        if not isinstance(f,dict):continue
        code=str(f.get("fieldCode") or f.get("apiProperty") or f"FIELD_{pos+1}")
        ck=key_for(f); dtype=str(f.get("dataType","STRING")).upper()
        privacy=str(f.get("privacyClass","INTERNAL")).upper()
        unit=str((f.get("validation") or {}).get("unitDimension") or f.get("unitDimension") or "")
        descriptor={"canonicalKey":ck,"fieldName":str(f.get("fieldName") or code),
          "dataType":dtype,"unitDimension":unit,"privacyClass":privacy,
          "sourceTable":str(f.get("sourceTable") or ""),"sourceColumn":str(f.get("sourceColumn") or ""),
          "apiProperty":str(f.get("apiProperty") or code)}
        descriptor["contractHash"]=hashlib.sha256(json.dumps(descriptor,sort_keys=True).encode()).hexdigest()
        old=canon.get(ck)
        if old and (family(old["dataType"]),old["unitDimension"],old["privacyClass"]) != (family(dtype),unit,privacy):
            issue("CANONICAL_FIELD_CONFLICT","BLOCKING",resource,ck,
              "동일 필드의 타입·단위·보안 등급이 화면 간 일치하지 않습니다.",
              {"existing":old,"incoming":descriptor})
        else:canon.setdefault(ck,descriptor)
        if code in seen:
            issue("DUPLICATE_FIELD_CODE","BLOCKING",resource,code,"화면 내 필드 코드가 중복됩니다.")
            continue
        seen.add(code)
        table,column=f.get("sourceTable"),f.get("sourceColumn")
        if table and column and (str(table).lower(),str(column).lower()) not in db:
            issue("DB_COLUMN_NOT_FOUND","BLOCKING",resource,ck,"설계의 DB 컬럼이 실제 스키마에 없습니다.",
              {"table":table,"column":column})
        bindings.append({"contractId":c["contractId"],"fieldCode":code,"canonicalKey":ck,
          "routePath":c["routePath"],"processCode":c["processCode"],"stepCode":c["stepCode"],
          "audience":c["audience"],"required":bool(f.get("required")),"editable":bool(f.get("editable")),
          "controlType":str(f.get("controlType") or ""),"mappingStatus":str(f.get("mappingStatus") or ""),
          "fieldOrder":int(f.get("fieldOrder") or pos+1)})
    for raw in c.get("apis",[]) if isinstance(c.get("apis"),list) else []:
        api=parse_api(raw)
        if api and api not in endpoints:
            issue("API_ENDPOINT_NOT_REGISTERED","BLOCKING",resource,"",
              f"등록되지 않은 API 계약입니다: {api[0]} {api[1]}",{"method":api[0],"path":api[1]})

lineage=[]
core={"api:tenantid","api:projectid","api:recordid","api:rowversion"}
by_contract=defaultdict(set)
for b in bindings:by_contract[b["contractId"]].add(b["canonicalKey"])
for (process,audience),contracts in screens.items():
    ordered=sorted(contracts,key=lambda x:(x["stepOrder"],x["contractId"]))
    # one representative contract per process step and audience
    steps=[]; seen_steps=set()
    for c in ordered:
        if c["stepCode"] not in seen_steps:steps.append(c);seen_steps.add(c["stepCode"])
    for left,right in zip(steps,steps[1:]):
        lset,rset=by_contract[left["contractId"]],by_contract[right["contractId"]]
        for ck in sorted(lset&rset):
            lineage.append({"processCode":process,"audience":audience,
              "fromStepCode":left["stepCode"],"toStepCode":right["stepCode"],
              "canonicalKey":ck,"lineageType":"CARRY_FORWARD","compatibilityStatus":"COMPATIBLE"})
        for ck in sorted((core&rset)-lset):
            issue("CORE_FIELD_LINEAGE_MISSING","BLOCKING",
              f'{process}:{left["stepCode"]}->{right["stepCode"]}:{audience}',ck,
              "다음 단계의 핵심 필드가 이전 단계에서 전달되지 않습니다.")

payload_for_hash={"fields":list(canon.values()),"bindings":bindings,"lineage":lineage}
contract_hash=hashlib.sha256(json.dumps(payload_for_hash,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
blocking=sum(x["severity"]=="BLOCKING" for x in issues); warnings=len(issues)-blocking
result={"schemaVersion":"1.0.0","contractHash":contract_hash,
  "status":"PASSED" if blocking==0 else "BLOCKED","screenCount":len(data["contracts"]),
  "fieldCount":len(bindings),"canonicalFieldCount":len(canon),"lineageCount":len(lineage),
  "blockingCount":blocking,"warningCount":warnings,
  "elapsedMillis":round((time.perf_counter()-start)*1000),
  "canonicalFields":list(canon.values()),"bindings":bindings,"lineage":lineage,"issues":issues}
print(json.dumps(result,ensure_ascii=False,separators=(",",":")))
