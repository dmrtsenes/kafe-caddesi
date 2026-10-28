import {chromium} from 'playwright';
import sharp from 'sharp';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve('store-assets/global-v2');
const palette={ink:'#103D40',deep:'#082D32',teal:'#128D80',mint:'#9FE9C5',cream:'#FFF3D7',gold:'#FFC44A',copper:'#BB7037'};
const copy={
 tr:{brand:'Kafe Caddesi',logo:['KAFE','CADDESİ'],tag:'SERVİS ET. KAZAN. BÜYÜT.',screens:[['KENDİ KAFENİ','YÖNET'],['HAZIRLA','SERVİSE TAŞI'],['TEMİZLİK','SENDE'],['KAZANCINI','TOPLA'],['EKİBİNİ','GELİŞTİR'],['KAFENE','YER AÇ']]},
 en:{brand:'Cafe Avenue',logo:['CAFE','AVENUE'],tag:'SERVE. EARN. EXPAND.',screens:[['RUN YOUR','OWN CAFÉ'],['BREW IT','SERVE IT'],['MAKE IT','SHINE'],['COLLECT','YOUR EARNINGS'],['BUILD','YOUR TEAM'],['MAKE ROOM','FOR MORE']]}
};
const shots=['01-serve','02-production','03-clean','04-cash','05-staff','06-growth'];
for(const p of ['final/shared','final/tr/screenshots','final/en/screenshots','source/svg/tr','source/svg/en','previews','research'])await mkdir(root+'/'+p,{recursive:true});
await writeFile(root+'/source/design.json',JSON.stringify({palette,copy,shots,canvas:{width:1080,height:1920},headlineBandHeight:352,method:'Opaque vector headline layer over unmodified full-resolution gameplay. No rescale, camera change, new scene objects, or scene retouching.'},null,2));
const font=(await readFile(root+'/source/fonts/paytoneone-PaytoneOne-Regular.ttf')).toString('base64');
const condensed=(await readFile(root+'/source/fonts/barlowcondensed-BarlowCondensed-Bold.ttf')).toString('base64');
const styles=`@font-face{font-family:Paytone One;src:url(data:font/ttf;base64,${font})} @font-face{font-family:Barlow Condensed;src:url(data:font/ttf;base64,${condensed})}text{font-family:Paytone One;paint-order:stroke fill;stroke-linejoin:round}`;
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const svg=(w,h,content)=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${styles}</style>${content}</svg>`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
const audit=[];
async function render(source,file,w,h,transparent=false){
 await writeFile(file+'.svg',source);await page.setViewportSize({width:w,height:h});
 await page.goto(pathToFileURL(file+'.svg').href);await page.evaluate(()=>document.fonts.ready);
 const boxes=await page.locator('text').evaluateAll(es=>es.filter(e=>e.dataset.qa).map(e=>{const b=e.getBBox();return{text:e.textContent,x:b.x,y:b.y,width:b.width,height:b.height};}));
 for(const b of boxes){assert(b.x>=16 && b.x+b.width<=w-16,`Headline overflow ${b.text}: ${JSON.stringify(b)}`);assert(b.y>=0&&b.y+b.height<=h,`Vertical overflow ${b.text}`);}
 const bytes=await page.screenshot({omitBackground:transparent});
 await sharp(bytes).toColourspace('srgb')[transparent?'ensureAlpha':'removeAlpha']().png({compressionLevel:9}).toFile(file+'.png');
 audit.push({file:file.replace(root+'/',''),width:w,height:h,textBounds:boxes});return file+'.png';
}
function logo(lang){
 const [one,two]=copy[lang].logo;
 const text=(dy,stroke,sw,fill1,fill2)=>`<g transform="translate(0 ${dy})"><text data-qa="logo" x="600" y="306" font-size="220" text-anchor="middle" fill="${fill1}" stroke="${stroke}" stroke-width="${sw}">${one}</text><text data-qa="logo" x="600" y="548" font-size="${lang==='tr'?195:212}" text-anchor="middle" fill="${fill2}" stroke="${stroke}" stroke-width="${sw}">${two}</text></g>`;
 const awning=Array.from({length:8},(_,i)=>`<path d="M${308+i*73} 42h73v48q-36.5 43-73 0Z" fill="${i%2?palette.mint:palette.cream}"/>`).join('');
 return svg(1200,680,`<g id="awning" stroke="${palette.deep}" stroke-width="12" stroke-linejoin="round">${awning}</g><g id="extrusion">${text(19,palette.deep,38,palette.deep,palette.deep)}</g><g id="lettering">${text(0,palette.deep,28,palette.cream,palette.gold)}</g><path id="avenue-underline" d="M285 608 Q600 641 915 608" fill="none" stroke="${palette.deep}" stroke-width="36" stroke-linecap="round"/><path d="M292 602 Q600 628 908 602" fill="none" stroke="${palette.mint}" stroke-width="17" stroke-linecap="round"/>`);
}
function headline(lang,i){
 const [a,b]=copy[lang].screens[i];const bottom=i===1;const y=bottom?1568:0;
 const bg=[palette.mint,palette.gold,palette.teal,palette.cream,palette.mint,palette.deep][i];
 const first=i===2||i===5?palette.cream:palette.ink;
 const second=i===2||i===5?palette.gold:palette.ink;
 // Small alternating awning edge is the common brand device, not an in-game object.
 const stripes=Array.from({length:18},(_,j)=>`<rect x="${j*60}" y="${bottom?0:336}" width="60" height="16" fill="${j%2?palette.cream:palette.teal}"/>`).join('');
 const sz1=a.length>12?105:113,sz2=b.length>12?104:120;
 return `<defs><clipPath id="headline-clip"><rect width="1080" height="352"/></clipPath></defs><g id="headline-layer" transform="translate(0 ${y})" clip-path="url(#headline-clip)"><rect width="1080" height="352" fill="${bg}"/><path d="M900 -80L1180 200M967 -80L1237 200" fill="none" stroke="${first}" stroke-opacity=".05" stroke-width="37"/><text x="540" y="62" text-anchor="middle" font-family="Barlow Condensed" style="font-family:Barlow Condensed" font-size="31" letter-spacing="5" fill="${first}" opacity=".83" data-qa="brand">${copy[lang].brand.toLocaleUpperCase(lang==='tr'?'tr-TR':'en-GB')}</text><text data-qa="headline" x="540" y="180" text-anchor="middle" font-size="${sz1}" fill="${first}">${a}</text><text data-qa="headline" x="540" y="301" text-anchor="middle" font-size="${sz2}" fill="${second}">${b}</text>${stripes}</g>`;
}
try{
 // Icon has no language-dependent text and no exterior mask or drop shadow.
 await sharp(root+'/source/art/icon-generated.png').resize(1024,1024).ensureAlpha().png({compressionLevel:9}).toFile(root+'/final/shared/icon-master-1024.png');
 await sharp(root+'/source/art/icon-generated.png').resize(512,512).ensureAlpha().png({compressionLevel:9}).toFile(root+'/final/shared/icon-google-play-512.png');
 assert((await stat(root+'/final/shared/icon-google-play-512.png')).size<1024*1024);
 const icon=(await readFile(root+'/final/shared/icon-master-1024.png')).toString('base64');
 for(const lang of ['tr','en']){
  const logoFile=await render(logo(lang),root+`/source/svg/${lang}/logo`,1200,680,true);
  await writeFile(root+`/final/${lang}/logo-transparent.png`,await readFile(logoFile));
  await writeFile(root+`/final/${lang}/logo.svg`,logo(lang));
  const logoData=(await readFile(logoFile)).toString('base64');
  const cover=(await sharp(root+'/source/art/feature-generated.png').resize(1024,500,{fit:'cover',position:'centre'}).png().toBuffer()).toString('base64');
  const feature=svg(1024,500,`<g id="stylized-cover-art"><image width="1024" height="500" href="data:image/png;base64,${cover}"/></g><g id="brand-logo"><image x="0" y="87" width="470" height="266.333" href="data:image/png;base64,${logoData}"/></g><text data-qa="tagline" x="232" y="389" text-anchor="middle" font-size="24" fill="${palette.deep}">${esc(copy[lang].tag)}</text>`);
  const ff=await render(feature,root+`/source/svg/${lang}/feature-graphic`,1024,500);
  await writeFile(root+`/final/${lang}/feature-graphic-1024x500.png`,await readFile(ff));
  for(let i=0;i<shots.length;i++){
   const raw=(await readFile(root+`/captures/${lang}/${shots[i]}.png`)).toString('base64');
   const composition=svg(1080,1920,`<g id="actual-gameplay"><image x="0" y="0" width="1080" height="1920" href="data:image/png;base64,${raw}"/></g>${headline(lang,i)}`);
   const file=await render(composition,root+`/source/svg/${lang}/${shots[i]}`,1080,1920);
   await writeFile(root+`/final/${lang}/screenshots/${shots[i]}.png`,await readFile(file));
   // Lossless screenshot pixels outside the marketing headline must survive unchanged.
   const top=i===1?0:352,height=1568;
   const original=await sharp(root+`/captures/${lang}/${shots[i]}.png`).extract({left:0,top,width:1080,height}).removeAlpha().raw().toBuffer();
   const actual=await sharp(file).extract({left:0,top,width:1080,height}).removeAlpha().raw().toBuffer();
   assert(original.equals(actual),`Gameplay pixels changed: ${lang}/${shots[i]}`);
  }
 }
 await writeFile(root+'/research/render-audit.json',JSON.stringify({palette,headlineBandRatio:352/1920,gameplayUnmodifiedAreaRatio:1568/1920,pixelIdentityVerified:true,files:audit},null,2));
 // Review sheets are not store upload assets.
 for(const lang of ['tr','en']){
  const thumbs=await Promise.all(shots.map(s=>sharp(root+`/final/${lang}/screenshots/${s}.png`).resize(270,480).toBuffer()));
  await sharp({create:{width:1710,height:540,channels:3,background:palette.deep}}).composite(thumbs.map((input,i)=>({input,left:30+i*276,top:30}))).png().toFile(root+`/previews/screenshots-${lang}.png`);
 }
 const sizes=[512,192,96,48];let left=30;const icons=[];for(const size of sizes){icons.push({input:await sharp(root+'/final/shared/icon-google-play-512.png').resize(size,size).toBuffer(),left,top:30});left+=size+30;}
 await sharp({create:{width:left,height:572,channels:3,background:palette.cream}}).composite(icons).png().toFile(root+'/previews/icon-sizes.png');
 console.log('Built two logos, two feature graphics, twelve real-game compositions, one shared icon. All gameplay pixel identity checks passed.');
}finally{await browser.close();}


