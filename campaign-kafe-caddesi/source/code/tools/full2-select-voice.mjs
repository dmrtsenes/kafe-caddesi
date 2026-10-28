import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve('campaign-kafe-caddesi');
const takes=JSON.parse(await readFile(resolve(root,'review/voice-takes-tr/takes.json'),'utf8'));
const picks=[['01-hook','hook-tr',2,.02,0],['02-welcome','welcome-tr',0,.12,4],['03-grow','grow-tr',4,.05,6],['04-brand','brand-tr-c',7,.05,null]];
const lines=[];
for(const[id,name,phase,offset,untilPhase]of picks){
 const take=takes.find(x=>x.name===name);
 const line={id,text:take.text,phase,offset,untilPhase,seed:take.seed,exaggeration:take.exaggeration,cfg_weight:take.cfg_weight,reference:'audio/turkce-yonlendirme.wav'};
 lines.push(line);await copyFile(resolve(root,'review/voice-takes-tr',name+'-raw.wav'),resolve(root,'audio',id+'.wav'));
 await writeFile(resolve(root,'audio',id+'-render.json'),JSON.stringify({...take,id,voice:'Chatterbox V3 conditioned with synthesized Piper stock Turkish accent reference; no real-person sample'},null,2));
}
for(const path of ['audio/voice-lines.json','source/voice-direction.json'])await writeFile(resolve(root,path),JSON.stringify(lines,null,2));
await writeFile(resolve(root,'audio/seslendirme-metni.txt'),lines.map(x=>x.text).join('\n\n')+'\n\nOkunuş: Kafe Caddesi, doğal Türkçe iki kelime.\nYönetim: sıcak ve sakin; abartısız, kısa cümleler, efektlere alan.\nÜretim: yerel Chatterbox V3, standart sentetik Türkçe vurgu örneği. İnsan stüdyo kaydı veya kişiye özel ses taklidi değildir.\n');
await writeFile(resolve(root,'review/voice-selection.json'),JSON.stringify({selected:picks.map(x=>x[1]),takes,reason:'Opening and complete brand name match in independent recognition; consistent synthetic Turkish speaker; no real-person reference'},null,2));
console.log('Four verified Turkish readings selected.');
