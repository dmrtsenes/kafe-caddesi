import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve('campaign-demlio/audio');await mkdir(root,{recursive:true});
// This model runs entirely on the local computer. No text or audio is uploaded.
const lines=[
 {id:'01-hook',text:'Şu masaya bak.',spoken:'Şu masaya bak.',phase:0,offset:.04},
 {id:'02-start',text:'Küçük bir başlangıç.',spoken:'Küçük bir başlangıç.',phase:2,offset:.12},
 {id:'03-service',text:'Bir adım daha.',spoken:'Bir adım daha.',phase:3,offset:.34},
 {id:'04-team',text:'Birlikte daha fazlası.',spoken:'Birlikte daha fazlası.',phase:5,offset:.50},
 {id:'05-brand',text:'Demlio. Sıra sende.',spoken:'Demliyo. Sıra sende.',phase:7,offset:.04}
];
for(const line of lines){
 await new Promise((ok,bad)=>{const p=spawn(resolve('.tools/piper/runtime/piper/piper.exe'),['--model',resolve('.tools/piper/tr_TR-fahrettin-medium.onnx'),'--output_file',resolve(root,line.id+'.wav'),'--length_scale',line.phase===0?'1.0':'1.10','--noise_scale','0.42','--noise_w','0.65','--sentence_silence','0.12'],{windowsHide:true,stdio:['pipe','pipe','pipe']});let err='';p.stderr.on('data',b=>err+=b);p.on('error',bad);p.on('exit',c=>c===0?ok():bad(new Error(err)));p.stdin.end(line.spoken+'\n','utf8');});console.log(line.id+' rendered locally');
}
await writeFile(resolve(root,'voice-lines.json'),JSON.stringify(lines,null,2));
await writeFile(resolve(root,'seslendirme-metni.txt'),lines.map(x=>x.text).join('\n\n')+'\n\nOkunuş: Demlio = dem-li-yo.\nSes: Piper tr_TR-fahrettin-medium; yerel, standart ses; kişisel ses taklidi yok.\n');
