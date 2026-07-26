#!/usr/bin/env python3
import json,sys
from pathlib import Path
data=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
valid=invalid=0
for row in data.get("candidates",[]):
    c=row.get("candidate")
    ok=isinstance(c,dict) and isinstance(row.get("taskId"),str)
    if ok:
        forbidden={"sql","sourceCode","newTable","newApi"} & set(c)
        ok=not forbidden
    row["deterministicValidation"]="VALID" if ok else "INVALID"
    valid+=int(ok);invalid+=int(not ok)
data["validCount"]=valid;data["invalidCount"]=invalid
Path(sys.argv[2]).write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"success":invalid==0,"valid":valid,"invalid":invalid}))
