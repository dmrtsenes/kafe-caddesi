"""Render alternative short readings and independently check their words."""
import os,json,random,subprocess,re,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.environ['HF_HOME']=str(ROOT/'.tools/asr-hf-cache');os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
os.environ['NUMBA_CACHE_DIR']=str(ROOT/'.tools/voice-numba-cache')
import torch,numpy as np,soundfile as sf
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from chatterbox.models.tokenizers.tokenizer import ChineseCangjieConverter
from faster_whisper import WhisperModel
ChineseCangjieConverter._init_segmenter=lambda self:None
torch.set_num_threads(6)
tts=ChatterboxMultilingualTTS.from_local(ROOT/'.tools/voice-model',device='cuda',t3_model='v3')
asr=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=6,download_root=str(ROOT/'.tools/whisper-small'),local_files_only=True)
useReference=os.environ.get('VOICE_REFERENCE')=='1'
out=ROOT/('campaign-kafe-caddesi/review/voice-takes-tr' if useReference else 'campaign-kafe-caddesi/review/voice-takes');out.mkdir(parents=True,exist_ok=True)
cases=[
 ('hook-a','Her şey bir çayla başlar.',101,.25,.3),
 ('hook-b','Bir çayla başlar.',102,.30,.3),
 ('hook-c','Her şey bir çayla başlar.',103,.20,.0),
 ('hook-d','Bir çayla başlar.',104,.30,.5),
 ('brand-a','Kafe Caddesi. Sıra sende.',111,.25,.3),
 ('brand-b','Kafe caddesi, sıra sende.',112,.30,.0),
 ('brand-c','Kafe Caddesi. Sıra sende.',113,.20,.5),
 ('brand-d','Kafe Caddesi, sıra sende.',114,.30,.2),
]
if useReference:cases=[
 ('hook-tr','Her şey bir çayla başlar.',121,.3,.5),
 ('welcome-tr','Yeni misafirlere yer aç.',122,.3,.5),
 ('grow-tr','Kazancınla ekibini kur.',123,.3,.5),
 ('brand-tr','Kafe Caddesi. Sıra sende.',124,.3,.5),
 ('brand-tr-b','Kafe Caddesi. Sıra sende.',125,.25,.3),
 ('brand-tr-c','Kafe Caddesi, şimdi sıra sende.',126,.25,.5),
]
results=[]
for name,text,seed,exag,cfg in cases:
 torch.manual_seed(seed);np.random.seed(seed);random.seed(seed)
 wav=tts.generate(text,language_id='tr',exaggeration=exag,cfg_weight=cfg,temperature=.65,repetition_penalty=1.3,audio_prompt_path=str(ROOT/'campaign-kafe-caddesi/audio/turkce-yonlendirme.wav') if useReference else None)
 raw=out/(name+'-raw.wav');master=out/(name+'.wav');sf.write(raw,wav.squeeze().numpy(),tts.sr,subtype='PCM_24')
 subprocess.run([str(ROOT/'.tools/video/ffmpeg/package/ffmpeg.exe'),'-y','-v','error','-i',str(raw),'-af','silenceremove=start_periods=1:start_duration=0.015:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB,areverse','-ar','48000',str(master)],check=True)
 segs,_=asr.transcribe(str(master),language='tr',beam_size=5,temperature=0,condition_on_previous_text=False,word_timestamps=True,vad_filter=False);segs=list(segs)
 row={'name':name,'text':text,'seed':seed,'exaggeration':exag,'cfg_weight':cfg,'seconds':sf.info(master).duration,'transcript':' '.join(s.text.strip() for s in segs),'meanWordProbability':float(np.mean([w.probability for s in segs for w in s.words]))}
 print(json.dumps(row,ensure_ascii=False),flush=True);results.append(row)
 (out/'takes.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
