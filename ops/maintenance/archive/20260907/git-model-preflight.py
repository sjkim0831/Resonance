import subprocess,pathlib,collections,json,re,urllib.parse
r=pathlib.Path('/opt/Resonance')
def git(*a):return subprocess.check_output(['git','-C',str(r),*a])
files=git('status','--porcelain=v1','-z','--untracked-files=all').decode().split('\0')
c=collections.Counter();samples={}
for row in files:
    if not row:continue
    p=row[3:];parts=p.split('/');k='/'.join(parts[:2]);c[k]+=1;samples.setdefault(k,[])
    if len(samples[k])<3:samples[k].append(p)
print(json.dumps({'groups':c.most_common(25),'samples':{k:samples[k] for k,_ in c.most_common(15)}},indent=2))
url=git('remote','get-url','origin').decode().strip()
if '://' in url:
    u=urllib.parse.urlsplit(url);url=urllib.parse.urlunsplit((u.scheme,u.hostname or '',u.path,'',''))
print('REMOTE',url)
for p in [r/'ops/bots/qwen40_improvement_bot.py',pathlib.Path('/opt/Resonance/runtime/tools/ai/exl2/tabbyAPI/config.yml')]:
    if not p.is_file():continue
    text=p.read_text(errors='replace')
    paths=set(re.findall(r'/opt/[\w./-]*(?:40b|40B|exl3)[\w./-]*',text))
    models=set(re.findall(r'(?:qwen|Qwen)[\w./-]*40[bB][\w./-]*',text))
    print('MODEL_REFERENCE',p,json.dumps({'paths':sorted(paths),'models':sorted(models)}))
