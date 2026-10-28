"""Independent offline recognition and waveform checks; never uploads audio."""
import sys, json, wave, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'.tools/audioqa'))
from vosk import Model, KaldiRecognizer, SetLogLevel
import numpy as np
SetLogLevel(-1)
model=Model(str(root/'.tools/audioqa/vosk-model-small-tr-0.3'))
ffmpeg=root/'.tools/video/ffmpeg/package/ffmpeg.exe'
rows=[]
for p in sorted((root/'campaign-demlio/audio').glob('0*-master.wav')):
    pcm=subprocess.check_output([str(ffmpeg),'-v','error','-i',str(p),'-f','s16le','-ar','16000','-ac','1','pipe:1'])
    rec=KaldiRecognizer(model,16000);rec.SetWords(True);parts=[]
    for i in range(0,len(pcm),8000):
        if rec.AcceptWaveform(pcm[i:i+8000]):parts.append(json.loads(rec.Result()))
    parts.append(json.loads(rec.FinalResult()))
    data=np.frombuffer(pcm,dtype='<i2').astype(float)/32768
    row={'file':p.name,'recognition':' '.join(x.get('text','') for x in parts),'words':[w for x in parts for w in x.get('result',[])], 'seconds':len(data)/16000,'peak_dbfs':float(20*np.log10(np.max(np.abs(data))+1e-12)), 'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(data*data))+1e-12))}
    rows.append(row)
out=root/'campaign-demlio/review/voice-recognition.json'
out.write_text(json.dumps({'engine':'Vosk Turkish small 0.3; independent unrestricted recognition, no supplied transcript grammar','results':rows,'limitation':'ASR is not human listening or professional voice-artist certification; coined brand may be out of vocabulary.'},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(rows,ensure_ascii=False))
