#!/usr/bin/env python3
import argparse, json, os, tempfile, time
from pathlib import Path

def write_atomic(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(content); stream.flush(); os.fsync(stream.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

def main():
    p=argparse.ArgumentParser(); p.add_argument("snapshot"); p.add_argument("--root",required=True)
    a=p.parse_args(); start=time.perf_counter()
    rows=json.loads(Path(a.snapshot).read_text(encoding="utf-8")).get("artifacts",[])
    root=Path(a.root).resolve(); artifacts=[]; changed=unchanged=failed=0
    for row in rows:
        target=(root/row["sourcePath"]).resolve()
        if root not in target.parents:
            artifacts.append({"sourceArtifactId":row["sourceArtifactId"],"sourceHash":row["sourceHash"],"status":"FAILED"})
            failed+=1; continue
        content=row["sourceContent"]; status="UNCHANGED"
        if not target.exists() or target.read_text(encoding="utf-8") != content:
            write_atomic(target,content); status="GENERATED"; changed+=1
        else: unchanged+=1
        artifacts.append({"sourceArtifactId":row["sourceArtifactId"],"sourceHash":row["sourceHash"],"status":status})
    print(json.dumps({"success":failed==0,"requested":len(rows),"generated":changed,
      "unchanged":unchanged,"failed":failed,"elapsedMillis":round((time.perf_counter()-start)*1000),
      "artifacts":artifacts},ensure_ascii=False,separators=(",",":")))
    raise SystemExit(1 if failed else 0)
if __name__=="__main__": main()
