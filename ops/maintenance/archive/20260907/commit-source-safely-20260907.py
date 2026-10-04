import pathlib,json,re,subprocess,os
r=pathlib.Path('/opt/Resonance');e=r/'docs/operations/git-cleanup-20260907';p=json.loads((e/'selection.json').read_text())
def git(*a,**kw):return subprocess.run(['git','-C',str(r),*a],check=True,**kw)
selected=[];extra=[]
for name in p['selected']:
    f=r/name
    if f.is_file():
        text=f.read_text(errors='replace')
        hits=re.findall(r'''(?i)(?:password|api[_-]?key|api[_-]?secret|client[_-]?secret|access[_-]?token)\s*[:=]\s*["']([^"'\r\n]{4,})["']''',text)
        risky=[v for v in hits if re.fullmatch(r'[A-Za-z0-9_+/=.!@#$%-]+',v) and v.lower() not in ('password','changeme','example','undefined','placeholder','null','true','false','required','optional')]
        if risky:extra.append(name);continue
    selected.append(name)
(e/'secret-excluded.json').write_text(json.dumps(extra,indent=2))
payload=b'\0'.join(x.encode() for x in selected)+b'\0'
git('add','--pathspec-from-file=-','--pathspec-file-nul',input=payload,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print(json.dumps({'staged':len(selected),'additional_secret_suspects_excluded':len(extra)}),flush=True)
git('commit','-m','chore: preserve current CCUS source and opt migration documentation',stdout=(e/'commit.log').open('w'),stderr=subprocess.STDOUT)
sha=subprocess.check_output(['git','-C',str(r),'rev-parse','HEAD'],text=True).strip()
branch='backup/ccus-opt-cleanup-20260907'
git('push','origin','HEAD:refs/heads/'+branch,stdout=(e/'push.log').open('w'),stderr=subprocess.STDOUT)
remote=subprocess.check_output(['git','-C',str(r),'ls-remote','origin','refs/heads/'+branch],text=True).split()[0]
assert remote==sha
(e/'result.json').write_text(json.dumps({'commit':sha,'remote_branch':branch,'remote_matches':True,'staged_selection':len(selected),'secret_suspects_excluded':extra},indent=2))
print(json.dumps({'commit':sha,'remote_branch':branch,'remote_matches':True}),flush=True)
