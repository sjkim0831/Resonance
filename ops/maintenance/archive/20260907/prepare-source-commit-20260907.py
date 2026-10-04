import pathlib,subprocess,re,json,collections
r=pathlib.Path('/opt/Resonance');e=r/'docs/operations/git-cleanup-20260907';e.mkdir(exist_ok=True)
def git(*a):return subprocess.check_output(['git','-C',str(r),*a])
assert not git('diff','--cached','--name-only').strip(),'Existing staged changes require review'
paths=set(x.decode() for x in git('diff','--name-only','-z').split(b'\0') if x)
paths.update(x.decode() for x in git('ls-files','--others','--exclude-standard','-z').split(b'\0') if x)
selected=[];excluded=[];blocked=[]
exts={'.java','.kt','.kts','.ts','.tsx','.js','.jsx','.mjs','.cjs','.py','.sh','.groovy','.xml','.yml','.yaml','.properties','.json','.md','.sql','.css','.scss','.html','.txt','.toml'}
for p in sorted(paths):
    f=r/p;parts=pathlib.PurePosixPath(p).parts
    allow=p in ('.gitignore','AGENTS.md') or p.startswith(('apps/','modules/','common/','ai-builder/scripts/','ops/scripts/','ops/runtime/','ops/diagnostics/','ops/tests/','projects/carbonet-frontend/source/','projects/P006/')) or (p.startswith('docs/operations/') and len(parts)==3 and f.suffix=='.md')
    if not allow or any(x in parts for x in ('build','target','dist','node_modules','.cache','.git','logs','backups')) or 'src/main/resources/static/react-app/' in p or f.suffix not in exts and p not in ('.gitignore',):excluded.append(p);continue
    if f.is_symlink() or (f.exists() and f.stat().st_size>2*1024**2):excluded.append(p);continue
    if any(x in p.lower() for x in ('.env','credentials','secret','storage-state','auth-state')):blocked.append(p);continue
    if f.is_file():
        text=f.read_text(errors='replace')
        patterns=[r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',r'\b(?:nvapi-|sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{16,}',r'(?i)(?:password|api[_-]?key|api[_-]?secret|client[_-]?secret)\s*[:=]\s*[\"\x27]([A-Za-z0-9_+/=-]{20,})[\"\x27]']
        if any(re.search(x,text) for x in patterns):blocked.append(p);continue
    selected.append(p)
(e/'selection.json').write_text(json.dumps({'selected':selected,'excluded':excluded,'blocked':blocked},indent=2))
print(json.dumps({'selected':len(selected),'excluded':len(excluded),'blocked':blocked[:30],'blocked_count':len(blocked)},indent=2))
