"""Local voice direction using the model's built-in stock voice, no imitation."""
import os,sys,json,random,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
os.environ['HF_HOME']=str(ROOT/'.tools/voice-hf-cache')
os.environ['TORCH_HOME']=str(ROOT/'.tools/voice-torch-cache')
os.environ['NUMBA_CACHE_DIR']=str(ROOT/'.tools/voice-numba-cache')
import numpy as np
import torch,soundfile as sf
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from chatterbox.models.tokenizers.tokenizer import ChineseCangjieConverter
# The upstream tokenizer eagerly initializes a Chinese-only segmenter. Turkish
# never calls it; disable that optional initialization to keep this job offline.
ChineseCangjieConverter._init_segmenter=lambda self: None
torch.set_num_threads(6)
root=ROOT/'campaign-kafe-caddesi/audio';root.mkdir(parents=True,exist_ok=True)
lines=[
 {'id':'01-hook','text':'Bir çayla başlar.','phase':2,'offset':.02,'untilPhase':0},
 {'id':'02-welcome','text':'Yeni misafirlere yer aç.','phase':0,'offset':.12,'untilPhase':4},
 {'id':'03-grow','text':'Kazancınla ekibini kur.','phase':4,'offset':.05,'untilPhase':6},
 {'id':'04-brand','text':'Kafe Caddesi. Sıra sende.','phase':7,'offset':.05,'untilPhase':None},
]
direction=ROOT/'campaign-kafe-caddesi/source/voice-direction.json'
if direction.exists():lines=json.loads(direction.read_text(encoding='utf-8'))
seed=int(os.environ.get('VOICE_SEED','61'));only=os.environ.get('VOICE_ONLY','')
print('Loading local multilingual v3 / stock voice',flush=True)
model=ChatterboxMultilingualTTS.from_local(ROOT/'.tools/voice-model',device='cuda',t3_model='v3')
print('Local model ready. '+torch.cuda.get_device_name(),flush=True)
report=[]
for i,line in enumerate(lines):
 if only and line['id']!=only:continue
 takeSeed=line.get('seed',seed+i);exaggeration=line.get('exaggeration',.42);cfg=line.get('cfg_weight',0.0)
 torch.manual_seed(takeSeed);np.random.seed(takeSeed);random.seed(takeSeed)
 start=time.monotonic()
 # CFG zero avoids transferring the default English voice's accent to Turkish.
 reference=str(ROOT/'campaign-kafe-caddesi'/line['reference']) if line.get('reference') else None
 wav=model.generate(line['text'],language_id='tr',exaggeration=exaggeration,cfg_weight=cfg,temperature=.65,repetition_penalty=1.3,audio_prompt_path=reference)
 audio=wav.squeeze().detach().cpu().numpy()
 sf.write(root/(line['id']+'.wav'),audio,model.sr,subtype='PCM_24')
 row={**line,'seconds':len(audio)/model.sr,'seed':takeSeed,'renderSeconds':time.monotonic()-start,'sampleRate':model.sr,'voice':'Chatterbox V3 with synthetic Turkish stock-voice conditioning; no real-person reference','settings':{'exaggeration':exaggeration,'cfg_weight':cfg,'temperature':.65}}
 report.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
 (root/(line['id']+'-render.json')).write_text(json.dumps(row,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'voice-lines.json').write_text(json.dumps(lines,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'seslendirme-metni.txt').write_text('\n\n'.join(x['text'] for x in lines)+'\n\nYönetim: sakin, sıcak, kısa ve açık; satış anlarında efektlere alan bırakılır.\nKafe Caddesi: normal Türkçe telaffuz, iki kelime.\nSes: yerelde üretilmiş standart sentez ses; insan ses sanatçısı kaydı değildir.\n',encoding='utf-8')
print('Voice files written locally.',flush=True)
