import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('campaign-film');
const ffmpeg = resolve('.tools/video/ffmpeg/package/ffmpeg.exe');
const main = resolve(root, 'Kafe-Caddesi-Sinematik-27s.mp4');
const short = resolve(root, 'Kafe-Caddesi-Sinematik-15s.mp4');
function run(args) {
  return new Promise((ok, bad) => {
    const p = spawn(ffmpeg, ['-hide_banner', '-nostdin', '-y', ...args], {windowsHide:true});
    let stderr = ''; p.stderr.on('data', b => stderr += b);
    p.on('error', bad); p.on('exit', c => c === 0 ? ok(stderr) : bad(new Error(stderr.slice(-6000))));
  });
}
await mkdir(resolve(root, 'review'), {recursive:true});
const mux = await run(['-i', resolve(root, 'source/picture-27s.mp4'), '-i', resolve(root, 'audio/mix.wav'),
  '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
  '-t', '27', '-movflags', '+faststart', main]);
await writeFile(resolve(root, 'review/mux.log'), mux);
console.log('27-second master complete.');

const cuts = [[0,4],[6,9],[9,11],[18,20],[23,27]];
const filters = cuts.flatMap(([start,end], i) => [
  `[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${i}]`,
  `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.025,afade=t=out:st=${end-start-.045}:d=0.045[a${i}]`,
]);
filters.push(cuts.map((_,i) => `[v${i}][a${i}]`).join('') + `concat=n=${cuts.length}:v=1:a=1[v][a]`);
const shortLog = await run(['-i', main, '-filter_complex', filters.join(';'), '-map','[v]','-map','[a]',
  '-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-r','30',
  '-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709',
  '-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t','15','-movflags','+faststart',short]);
await writeFile(resolve(root, 'review/short-encode.log'), shortLog);
await run(['-ss','25.5','-i',main,'-frames:v','1','-q:v','2',resolve(root,'kapak.jpg')]);
await writeFile(resolve(root,'source/edit-decision-list.json'),JSON.stringify({
  title:'Kafe Caddesi — Kontrol sende',format:{width:1080,height:1920,fps:30},
  full:{duration:27,shots:[{start:0,end:5,source:'new animated cafe vignette'},{start:5,end:14,source:'campaign-ua/source/picture-tr.mp4',sourceStart:4,sourceEnd:13},{start:14,end:23,source:'campaign-ua/source/picture-tr.mp4',sourceStart:14,sourceEnd:23},{start:23,end:27,source:'new store endcard'}]},
  short:{duration:15,cutsFromFull:cuts},
  audio:'Original synthesized music and Foley; see audio/provenance.json',
  sourceGameUnchanged:true,published:false,
},null,2));
console.log('15-second cut and cover complete.');
