#!/usr/bin/env python3
from pathlib import Path
import sys,shutil,hashlib,zipfile,json,html
design=Path(sys.argv[1]); recovery=Path(sys.argv[2]); out=Path(sys.argv[3]); shutil.rmtree(out,ignore_errors=True)
shutil.copytree(design,out/'01_process_designs'); shutil.copytree(recovery,out/'02_selective_recovery')
manifest=json.loads((design/'manifest.json').read_text())
links=''.join(f'<li><a href="01_process_designs/{html.escape(x["file"])}">{x["order"]:02}. {html.escape(x["name"])}</a> ({html.escape(x["code"])})</li>' for x in manifest['documents'])
(out/'00_먼저읽기.html').write_text(f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>회원 프로세스 설계·복구 자동 패키지</title><style>body{{font-family:Arial,"Malgun Gothic";max-width:1100px;margin:40px auto;line-height:1.65}}h1,h2{{color:#07366c}}section{{border:1px solid #ccd8e5;padding:22px;margin:18px 0}}.ok{{border-left:5px solid #087f5b;background:#e9fff6;padding:14px}}</style><h1>회원 프로세스 설계·선택복구 자동 패키지</h1><section><h2>구성</h2><p class="ok">프로세스별 상세설계 {len(manifest['documents'])}개와 해당 process_code만 복구하는 SQL·롤백·검증·소스 증거를 동일 기준시점으로 생성했습니다.</p></section><section><h2>복구 절차</h2><ol><li>대상 프로세스 코드와 기준 버전을 확인</li><li>01_backup_target_rows.sql 실행</li><li>격리 DB에서 02_restore_only_member_processes.sql 검증</li><li>승인 후 운영 적용</li><li>04_verify_target_rows.sql 및 계정 릴레이 검증</li><li>실패 시 03_rollback_target_rows.sql 실행</li></ol></section><section><h2>프로세스 설계</h2><ol>{links}</ol></section></html>''')
sums=[]
for p in sorted(out.rglob('*')):
 if p.is_file() and p.name!='SHA256SUMS.txt': sums.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(out).as_posix())
(out/'SHA256SUMS.txt').write_text('\n'.join(sums)+'\n')
z=out.with_suffix('.zip')
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED) as f:
 for p in out.rglob('*'):
  if p.is_file(): f.write(p,p.relative_to(out.parent))
with zipfile.ZipFile(z) as f: assert f.testzip() is None
print(json.dumps({'processes':len(manifest['documents']),'zip':str(z),'bytes':z.stat().st_size,'sha256':hashlib.sha256(z.read_bytes()).hexdigest()}))
