import {spawn} from 'node:child_process';
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createScore} from './full2-score.mjs';
const root=resolve('campaign-kafe-caddesi'),ffmpeg=resolve('.tools/video/ffmpeg/package/ffmpeg.exe'),ffprobe=resolve('.tools/video/ffprobe/package/ffprobe.exe');
function run(exe,args){return new Promise((ok,bad)=>{const p=spawn(exe,args,{windowsHide:true});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',bad);p.on('exit',c=>c===0?ok({stdout,stderr}):bad(new Error(stderr.slice(-5000))));});}
const report=JSON.parse(await readFile(resolve(root,'review/capture.json'),'utf8')),duration=report.frame/30;
const lines=JSON.parse(await readFile(resolve(root,'audio/voice-lines.json'),'utf8'));
const placements=[];const format=t=>{const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
for(const line of lines){
 const start=(report.events.find(e=>e.kind==='cut'&&e.data.phase===line.phase)?.time??0)+line.offset;
 const out=resolve(root,'audio',line.id+'-master.wav');
 await run(ffmpeg,['-y','-v','error','-i',resolve(root,'audio',line.id+'.wav'),'-af','silenceremove=start_periods=1:start_duration=0.015:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB,areverse,highpass=f=75,lowpass=f=10500,acompressor=threshold=0.08:ratio=2.2:attack=12:release=95,loudnorm=I=-18:TP=-3:LRA=7,afade=t=in:d=0.006','-ar','48000','-ac','1',out]);
 const length=+(await run(ffprobe,['-v','error','-show_entries','format=duration','-of','csv=p=0',out])).stdout.trim();
 assert.ok(start+length<duration-.08,'Voice exceeds finished action timeline; shorten text instead of padding.');
 const nextCut=line.untilPhase==null?duration-.1:report.events.find(e=>e.kind==='cut'&&e.data.phase===line.untilPhase).time;
 assert.ok(start+length<=nextCut,`${line.id}: narration (${length.toFixed(2)}s) exceeds its action group (${(nextCut-start).toFixed(2)}s); shorten and re-record`);
 placements.push({...line,start,length,end:start+length,file:out});
}
const args=['-y','-v','error'];for(const p of placements)args.push('-i',p.file);
const filters=placements.map((p,i)=>`[${i}:a]adelay=${Math.round(p.start*1000)},apad,atrim=duration=${duration}[v${i}]`);filters.push(placements.map((_,i)=>`[v${i}]`).join('')+`amix=inputs=${placements.length}:dropout_transition=0,volume=${placements.length},atrim=duration=${duration}[voice]`);
args.push('-filter_complex',filters.join(';'),'-map','[voice]','-ar','48000','-ac','2',resolve(root,'audio/seslendirme.wav'));await run(ffmpeg,args);
await writeFile(resolve(root,'audio/seslendirme.srt'),placements.map((p,i)=>`${i+1}\n${format(p.start)} --> ${format(p.end)}\n${p.text}\n`).join('\n'));
const assTime=t=>{const cs=Math.round(t*100);return `${Math.floor(cs/360000)}:${String(Math.floor(cs/6000)%60).padStart(2,'0')}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;};
const ass=`[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Barlow Condensed,52,&H00D7F3FF,&H00D7F3FF,&H00322D08,&H80322D08,-1,0,0,0,100,100,0,0,3,9,0,2,80,80,260,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`+placements.map(p=>`Dialogue: 0,${assTime(p.start)},${assTime(p.end)},Default,,0,0,0,,{\\an2\\pos(540,${p.phase===7?1380:1660})\\fad(40,70)}${p.text}`).join('\n');
await writeFile(resolve(root,'audio/seslendirme.ass'),ass);
await writeFile(resolve(root,'source/timeline.json'),JSON.stringify({duration,fps:30,cuts:report.events.filter(e=>e.kind==='cut'),voice:placements.map(({file,...p})=>p),events:report.events},null,2));
const music=resolve(root,'audio/muzik.wav'),sfx=resolve(root,'audio/efektler.wav');await createScore(report.events,music,duration,'music');await createScore(report.events,sfx,duration,'sfx');
// Sidechain ducking follows the real speech waveform, preserving music in pauses.
const mixed=resolve(root,'audio/final-mix.wav');
const mix=await run(ffmpeg,['-y','-hide_banner','-i',resolve(root,'audio/seslendirme.wav'),'-i',music,'-i',sfx,'-filter_complex','[0:a]asplit=2[vo][key];[1:a][key]sidechaincompress=threshold=0.012:ratio=8:attack=12:release=180:makeup=1[duck];[vo][duck][2:a]amix=inputs=3:dropout_transition=0,volume=3,loudnorm=I=-16:TP=-1.5:LRA=7,afade=t=out:st='+Math.max(0,duration-.18)+':d=0.18[a]','-map','[a]','-ar','48000','-ac','2',mixed]);await writeFile(resolve(root,'review/mix.log'),mix.stderr);
const final=resolve(root,'reklam-full2.mp4');await run(ffmpeg,['-y','-v','error','-i',resolve(root,'source/picture.mp4'),'-i',mixed,'-map','0:v:0','-map','1:a:0','-vf','ass=campaign-kafe-caddesi/audio/seslendirme.ass:fontsdir=campaign-kafe-caddesi/source/fonts','-c:v','libx264','-crf','17','-preset','medium','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t',String(duration),'-movflags','+faststart',final]);
const probe=JSON.parse((await run(ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',final])).stdout);const v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');
assert.equal(v.codec_name,'h264');assert.equal(v.width,1080);assert.equal(v.height,1920);assert.equal(v.avg_frame_rate,'30/1');assert.equal(v.pix_fmt,'yuv420p');assert.equal(+v.nb_read_frames,report.frame);assert.equal(a.codec_name,'aac');assert.equal(+a.sample_rate,48000);assert.equal(a.channels,2);
const decoded=await run(ffmpeg,['-v','error','-i',final,'-f','null','-']);assert.equal(decoded.stderr.trim(),'');
const qc=await run(ffmpeg,['-hide_banner','-i',final,'-vf','blackdetect=d=0.032:pix_th=0.05:pic_th=0.98,freezedetect=n=0.00001:d=0.8','-af','ebur128=peak=true','-f','null','-']);await writeFile(resolve(root,'review/technical-qc.log'),qc.stderr);assert.ok(!qc.stderr.includes('black_start:'));assert.ok(!qc.stderr.includes('freeze_start:'));
await writeFile(resolve(root,'review/video-verification.json'),JSON.stringify({passed:true,duration,frames:report.frame,probe,voice:placements,storageUnchanged:report.storageUnchanged,decodeErrors:[],blackFrames:false,frozenFrames:false,voiceReview:'Local synthesized speech; technical and optional ASR checks, no human listening certification.'},null,2));
await copyFile(final,resolve('reklam-full2.mp4'));
console.log(`Delivered H.264/AAC master: ${duration.toFixed(3)}s, ${report.frame} frames.`);

