import json
from pathlib import Path
from service import Fault
R=Path(__file__).resolve().parent
def handle(c,a,method,path,p,params):
 if method!='GET':raise Fault(405,'읽기 전용 보고서')
 files={'/scale/report':'scale-report.json','/scale/candidate':'scale-candidate.json'}
 f=files.get(path)
 if not f or not (R/f).is_file():raise Fault(404,'규모 검증 보고서 생성 전')
 return json.loads((R/f).read_text())
