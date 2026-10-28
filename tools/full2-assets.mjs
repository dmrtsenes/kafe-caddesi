import {chromium} from 'playwright';
import sharp from 'sharp';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve('campaign-kafe-caddesi');
for(const p of ['store/screenshots','brand','source/design','source/art'])await mkdir(resolve(root,p),{recursive:true});
const capture=JSON.parse(await readFile(resolve(root,'review/capture.json'),'utf8'));
const cut=p=>capture.events.find(e=>e.kind==='cut'&&e.data.phase===p).time;
const selections=[
 ['01-servis',3,1.25,'KENDİ KAFENİ','YÖNET','Oyuncu gerçek çay siparişlerini masadaki iki misafire servis ediyor.'],
 ['02-hazirla',2,1.1,'SICACIK HAZIR','SERVİSE TAŞI','Semaverin ürettiği çaylar oyuncunun gerçek tepsisine alınıyor.'],
 ['03-temizlik',1,.9,'YENİ MİSAFİRE','YER AÇ','Bulaşığı alınmış masa oyuncunun silme hareketiyle yeniden kullanılabilir hale geliyor.'],
 ['04-kazanc',4,.8,'EMEĞİNİ','KAZANCA ÇEVİR','Gösterilen servislerin kazancı gerçek kasadan toplanıyor.'],
 ['05-ekip',5,1.4,'KAZANCINLA','EKİBİNİ KUR','Oyuncu mevcut işe alma alanına ödeme yapıyor.'],
 ['06-raflar',6,1.8,'RAFLARINI','EKİBİN DOLDURSUN','İşe alınan tezgâhtar çayları gerçek paket rafına yerleştiriyor.'],
];
const font=(await readFile(resolve(root,'source/fonts/paytoneone-PaytoneOne-Regular.ttf'))).toString('base64');
const condensed=(await readFile(resolve(root,'source/fonts/barlowcondensed-BarlowCondensed-Bold.ttf'))).toString('base64');
const style=`@font-face{font-family:Paytone;src:url(data:font/ttf;base64,${font})}@font-face{font-family:Barlow;src:url(data:font/ttf;base64,${condensed})}text{font-family:Paytone}`;
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${style}</style>${body}</svg>`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({deviceScaleFactor:1});const checks=[];const selectionsOut=[];
async function render(xml,name,w,h){
 const source=resolve(root,'source/design',name+'.svg');await writeFile(source,xml);
 await page.setViewportSize({width:w,height:h});await page.goto(pathToFileURL(source).href);await page.evaluate(()=>document.fonts.ready);
 const boxes=await page.locator('text').evaluateAll(xs=>xs.map(x=>{const b=x.getBBox();return{text:x.textContent,x:b.x,y:b.y,w:b.width,h:b.height};}));
 for(const b of boxes)assert.ok(b.x>=20&&b.x+b.w<=w-20&&b.y>=0&&b.y+b.h<=h,JSON.stringify(b));
 const bytes=await page.screenshot();await sharp(bytes).removeAlpha().png({compressionLevel:9}).toFile(resolve(root,name==='feature-1024x500'?'store/'+name+'.png':'store/screenshots/'+name+'.png'));
 checks.push({name,width:w,height:h,boxes});
}
try{
 for(const [id,phase,offset,a,b,alt]of selections){
  const at=cut(phase)+offset;const sample=capture.samples.filter(x=>x.phase===phase).sort((x,y)=>Math.abs(x.time-at)-Math.abs(y.time-at))[0];
  const file=`phase-${phase}-${String(sample.frame).padStart(4,'0')}.png`;
  const raw=await readFile(resolve(root,'captures',file));await writeFile(resolve(root,'source/art',id+'.png'),raw);
  const pic=raw.toString('base64');const palette=['#9FE9C5','#FFC44A','#128D80','#FFF3D7','#9FE9C5','#082D32'];const index=selections.findIndex(x=>x[0]===id),bg=palette[index],light=[2,5].includes(index),ink=light?'#FFF3D7':'#103D40',accent=light?'#FFC44A':'#103D40';
  const stripes=Array.from({length:18},(_,i)=>`<rect x="${i*60}" y="332" width="60" height="16" fill="${i%2?'#FFF3D7':'#128D80'}"/>`).join('');
  await render(svg(1080,1920,`<image width="1080" height="1920" href="data:image/png;base64,${pic}"/><g id="editorial-headline"><rect width="1080" height="348" fill="${bg}"/><text x="76" y="76" fill="${ink}" font-size="32" style="font-family:Barlow" letter-spacing="3">KAFE CADDESİ</text><text x="72" y="183" fill="${ink}" font-size="${a.length>12?76:86}">${a}</text><text x="72" y="291" fill="${accent}" font-size="${b.length>16?70:b.length>12?78:92}">${b}</text>${stripes}</g>`),id,1080,1920);
  selectionsOut.push({file:id+'.png',phase,time:sample.time,source:file,title:a+' '+b,alt,method:'Actual game frame with separate SVG headline; no object retouching or UI replacement.'});
 }
 const logo=await readFile(resolve('store-assets/global-v2/final/tr/logo-transparent.png'));
 await copyFile(resolve('store-assets/global-v2/final/tr/logo.svg'),resolve(root,'brand/logo.svg'));
 await writeFile(resolve(root,'brand/logo-transparent.png'),logo);
 await copyFile(resolve('store-assets/global-v2/final/en/logo-transparent.png'),resolve(root,'brand/logo-en-transparent.png'));
 await copyFile(resolve('store-assets/global-v2/final/en/logo.svg'),resolve(root,'brand/logo-en.svg'));
 await copyFile(resolve('store-assets/global-v2/final/shared/icon-google-play-512.png'),resolve(root,'store/icon-512.png'));
 await copyFile(resolve('store-assets/global-v2/final/shared/icon-master-1024.png'),resolve(root,'brand/icon-master-1024.png'));
 const service=await sharp(resolve(root,'source/art/01-servis.png')).extract({left:30,top:360,width:1020,height:1080}).resize(566,600).png().toBuffer();
 await render(svg(1024,500,`<defs><linearGradient id="fade"><stop stop-color="#082D32"/><stop offset="1" stop-color="#082D32" stop-opacity="0"/></linearGradient></defs><rect width="1024" height="500" fill="#082D32"/><image x="458" y="-43" width="566" height="600" href="data:image/png;base64,${service.toString('base64')}"/><rect x="430" width="180" height="500" fill="url(#fade)"/><image x="42" y="73" width="432" height="245" href="data:image/png;base64,${logo.toString('base64')}"/><text x="258" y="377" text-anchor="middle" fill="#FFF3D7" font-size="28" style="font-family:Barlow">SERVİS ET. KAZAN. BİRLİKTE BÜYÜT.</text>`),'feature-1024x500',1024,500);
 const panels=[];for(let i=0;i<selections.length;i++)panels.push({input:await sharp(resolve(root,'store/screenshots',selections[i][0]+'.png')).resize(270,480).png().toBuffer(),left:(i%3)*270,top:Math.floor(i/3)*480});
 await sharp({create:{width:810,height:960,channels:3,background:'#082D32'}}).composite(panels).png().toFile(resolve(root,'review/store-contact.png'));
 await writeFile(resolve(root,'store/alt-metinler.json'),JSON.stringify(selectionsOut,null,2));
 await writeFile(resolve(root,'review/store-layout.json'),JSON.stringify({passed:true,checks,selections:selectionsOut},null,2));
 console.log('Six new gameplay compositions, real gameplay feature, original selected logos and icon ready.');
}finally{await browser.close();}
