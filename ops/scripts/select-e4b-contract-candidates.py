#!/usr/bin/env python3
import argparse,json,urllib.request
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("candidates",type=Path);p.add_argument("--out",type=Path,required=True);p.add_argument("--batch",type=int,default=20)
a=p.parse_args();rows=json.loads(a.candidates.read_text(encoding="utf-8")).get("candidates",[])
valid=[{"taskId":x["taskId"],"candidate":x["candidate"]} for x in rows if x.get("deterministicValidation")=="VALID"]
selections=[]
for pos in range(0,len(valid),a.batch):
    batch=valid[pos:pos+a.batch]
    prompt=("등록된 계약 복구 후보를 선택하는 E4B 검증기다. ID를 만들거나 코드를 작성하지 않는다. "
      "각 후보가 기존 문제를 보수적으로 해결하면 SELECT, 불확실하면 REVIEW, 위반하면 REJECT한다. "
      "입력 taskId를 그대로 복사하고 JSON 객체만 반환한다: "
      "{\"selections\":[{\"taskId\":\"...\",\"decision\":\"SELECT|REVIEW|REJECT\","
      "\"confidence\":0.0,\"reason\":\"한국어 근거\"}]} INPUT="+json.dumps(batch,ensure_ascii=False))
    body=json.dumps({"model":"gemma4-e4b-gpu-shadow","temperature":0,"max_tokens":4096,
      "messages":[{"role":"system","content":"Strict JSON contract selector."},{"role":"user","content":prompt}]}).encode()
    req=urllib.request.Request("http://127.0.0.1:24451/v1/chat/completions",data=body,
      headers={"Content-Type":"application/json"},method="POST")
    with urllib.request.urlopen(req,timeout=120) as response:
        content=json.loads(response.read())["choices"][0]["message"]["content"]
    left,right=content.find("{"),content.rfind("}")
    result=json.loads(content[left:right+1])
    allowed={x["taskId"] for x in batch}
    selections.extend(x for x in result.get("selections",[]) if x.get("taskId") in allowed)
out={"schemaVersion":"1.0.0","model":"gemma4-e4b-gpu-shadow","selections":selections}
a.out.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"success":len(selections)==len(valid),"selected":len(selections),"expected":len(valid)}))
