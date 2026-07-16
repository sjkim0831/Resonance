param(
  [string]$HostName = "172.16.1.232",
  [string]$UserName = "sjkim",
  [string]$ReferenceRoot = "/opt/reference",
  [string]$OutputPath = "docs/architecture/executable-webapp/generated/reference-inventory.jsonl"
)

$ErrorActionPreference = "Stop"
$password = $env:RESONANCE_SSH_PASSWORD
if ([string]::IsNullOrWhiteSpace($password)) {
  throw "Set RESONANCE_SSH_PASSWORD for this invocation. Credentials are never stored in source."
}

$remote = @'
import hashlib,json,mimetypes,os,sys
root=sys.argv[1]
text_ext={'.txt','.md','.html','.htm','.json','.jsonl','.yaml','.yml','.xml','.csv','.tsv','.sql','.properties','.groovy','.java','.js','.ts','.tsx','.css'}
for base,dirs,files in os.walk(root):
    dirs.sort(); files.sort()
    for name in files:
        if name.endswith(':Zone.Identifier'): continue
        path=os.path.join(base,name)
        try:
            stat=os.stat(path); digest=hashlib.sha256()
            with open(path,'rb') as fh:
                for chunk in iter(lambda:fh.read(1024*1024),b''): digest.update(chunk)
            ext=os.path.splitext(name)[1].lower()
            extraction='TEXT_EXTRACTABLE' if ext in text_ext else ('OFFICE_OR_PDF_EXTRACTOR_REQUIRED' if ext in {'.pdf','.docx','.xlsx','.pptx','.hwp','.hwpx','.xls'} else 'BINARY_METADATA_ONLY')
            print(json.dumps({'sourcePath':path,'sourceName':name,'extension':ext,'size':stat.st_size,'modifiedAt':int(stat.st_mtime),'sha256':digest.hexdigest(),'mime':mimetypes.guess_type(path)[0] or 'application/octet-stream','extractionStatus':extraction},ensure_ascii=False))
        except Exception as exc:
            print(json.dumps({'sourcePath':path,'sourceName':name,'extractionStatus':'INVENTORY_ERROR','error':str(exc)},ensure_ascii=False))
'@

$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remote))
$target = Join-Path (Get-Location) $OutputPath
New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
& sshpass -p $password ssh -o StrictHostKeyChecking=no "$UserName@$HostName" "echo '$encoded' | base64 -d | python3 - '$ReferenceRoot'" | Set-Content -Encoding utf8 $target
if ($LASTEXITCODE -ne 0) { throw "Reference inventory collection failed: $LASTEXITCODE" }
Write-Output $target
