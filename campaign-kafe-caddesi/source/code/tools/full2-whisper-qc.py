"""Independent transcript, with no supplied reference transcript or prompt."""
import os,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.environ['HF_HOME']=str(ROOT/'.tools/asr-hf-cache');os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
os.environ['HF_HUB_DISABLE_XET']='1'
from faster_whisper import WhisperModel
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=8,download_root=str(ROOT/'.tools/whisper-small'),local_files_only='--offline' in sys.argv)
rows=[]
for file in sorted((ROOT/'campaign-kafe-caddesi/audio').glob('0*-master.wav')):
 segments,info=model.transcribe(str(file),language='tr',beam_size=5,temperature=0,condition_on_previous_text=False,word_timestamps=True,vad_filter=False)
 segs=list(segments);text=' '.join(s.text.strip() for s in segs)
 row={'file':file.name,'transcript':text,'segments':[{'start':s.start,'end':s.end,'text':s.text,'avg_logprob':s.avg_logprob,'words':[{'word':w.word,'start':w.start,'end':w.end,'probability':w.probability} for w in s.words]} for s in segs]}
 print(json.dumps(row,ensure_ascii=False),flush=True);rows.append(row)
(ROOT/'campaign-kafe-caddesi/review/whisper-transcripts.json').write_text(json.dumps({'engine':'faster-whisper small multilingual CPU int8','promptSupplied':False,'results':rows,'scope':'Automatic transcript; not a human listening or subjective naturalness certification.'},ensure_ascii=False,indent=2),encoding='utf-8')
