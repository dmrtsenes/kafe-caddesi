"""Download public model files only. No project/text/audio upload or account."""
import os,time,urllib.request,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
dest=ROOT/'.tools/voice-model';dest.mkdir(parents=True,exist_ok=True)
names=['ve.pt','t3_mtl23ls_v3.safetensors','s3gen.pt','grapheme_mtl_merged_expanded_v1.json','conds.pt','Cangjie5_TC.json']
rows=[]
for name in names:
    path=dest/name
    if not path.exists():
        for attempt in range(3):
            try:
                print('Downloading '+name,flush=True)
                with urllib.request.urlopen('https://huggingface.co/ResembleAI/chatterbox/resolve/main/'+name+'?download=true',timeout=30) as r,open(str(path)+'.part','wb') as f:
                    total=int(r.headers.get('Content-Length','0'));n=0;last=time.monotonic()
                    while b:=r.read(1024*1024):
                        f.write(b);n+=len(b)
                        if time.monotonic()-last>20:print(f'{name}: {n//1048576} MB / {total//1048576} MB',flush=True);last=time.monotonic()
                os.replace(str(path)+'.part',path);break
            except Exception as e:
                if attempt==2:raise
                print(str(e),flush=True);time.sleep(2)
    rows.append({'file':name,'bytes':path.stat().st_size,'sha256':hashlib.file_digest(open(path,'rb'),'sha256').hexdigest()})
    print('Ready '+name,flush=True)
(ROOT/'campaign-kafe-caddesi/review/voice-model-files.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
