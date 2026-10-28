// Rebuild all deliverables from actual captures, editable SVG layers and bundled OFL fonts.
// Usage from the project root: node store-assets/source/build.mjs
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('store-assets');
const brand=JSON.parse(await readFile(root+'/source/brand.json','utf8'));
const P=brand.palette;
for(const d of ['google-play/screenshots','brand','source/design','source/layers','preview','audit'])await mkdir(root+'/'+d,{recursive:true});
const fontFiles=await readdir(root+'/source/fonts');
const fredoka=await readFile(root+'/source/fonts/'+fontFiles.find(f=>f.startsWith('fredoka-')&&f.endsWith('.ttf')));
const nunito=await readFile(root+'/source/fonts/'+fontFiles.find(f=>f.startsWith('nunitosans-')&&!f.includes('Italic')&&f.endsWith('.ttf')));
const css=`@font-face{font-family:Fredoka;src:url(data:font/ttf;base64,${fredoka.toString('base64')}) format('truetype');font-weight:300 700}@font-face{font-family:Nunito;src:url(data:font/ttf;base64,${nunito.toString('base64')}) format('truetype');font-weight:200 1000}text{font-family:Nunito,sans-serif;font-weight:700}.display{font-family:Fredoka,sans-serif;font-weight:600}`;
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const wrap=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${brand.name}</title><defs><style><![CDATA[${css}]]></style></defs>${body}</svg>`;
const mark=(x,y,size,ink=P.cream,accent=P.amber)=>`<g transform="translate(${x} ${y}) scale(${size/256})" id="tray-tea-mark"><path d="M68 206Q35 196 30 176H226Q221 196 188 206Z" fill="${ink}"/><path d="M88 48H168C167 75 148 97 150 122C151 139 161 151 166 170Q128 188 90 170C95 151 105 139 106 122C108 97 89 75 88 48Z" fill="${ink}"/><path d="M104 90H152Q139 119 149 145H107Q117 119 104 90Z" fill="${accent}"/><path d="M217 21Q220 45 240 49Q220 53 217 76Q213 53 193 49Q213 45 217 21Z" fill="${accent}"/><path d="M45 147H71M37 131H62" stroke="${ink}" stroke-width="10" stroke-linecap="round"/></g>`;
const wordmark=(x,y,size,color=P.cream)=>`<text class="display" x="${x}" y="${y}" font-size="${size}" letter-spacing="-1.5" fill="${color}">Tepsilo</text>`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({deviceScaleFactor:1});
const measurements=[];
async function raster(svg,w,h,path,alpha=false){
 await page.setViewportSize({width:w,height:h});
 await page.setContent(`<html><head><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}</style></head><body>${svg}</body></html>`);
 await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>Promise.all([...document.images].map(im=>im.decode().catch(()=>{}))));
 const checks=await page.evaluate(()=>[...document.querySelectorAll('text')].map(el=>{const b=el.getBoundingClientRect();return{text:el.textContent,x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom};}));
 assert.ok(checks.every(b=>b.x>=-1&&b.y>=-1&&b.right<=w+1&&b.bottom<=h+1),`Text overflow in ${path}`);
 measurements.push({path,width:w,height:h,text:checks});
 const png=await page.screenshot({omitBackground:true});
 let pipeline=sharp(png);if(!alpha)pipeline=pipeline.flatten({background:P.petrol}).removeAlpha();
 await pipeline.png({compressionLevel:9}).toFile(root+'/'+path);
}
async function saveSvg(file,svg){await writeFile(root+'/source/design/'+file,svg);}
try{
 const logoBody=mark(22,63,310,P.petrol)+wordmark(359,305,298,P.petrol);
 const logo=wrap(1600,420,logoBody);
 await saveSvg('logo-primary.svg',logo);
 await writeFile(root+'/brand/logo-primary.svg',logo);
 await raster(logo,1600,420,'brand/logo-transparent.png',true);
 const light=wrap(1600,420,mark(22,63,310)+wordmark(359,305,298));
 await saveSvg('logo-light.svg',light);await writeFile(root+'/brand/logo-light.svg',light);
 await raster(light,1600,420,'brand/logo-light-transparent.png',true);
 const markSvg=wrap(256,256,mark(0,0,256,P.petrol));
 await writeFile(root+'/brand/brand-mark.svg',markSvg);await raster(markSvg,256,256,'brand/brand-mark.png',true);

 // Resampling is uniform; the generated art is archived unchanged.
 const art=await sharp(root+'/source/art/icon-generated.png').resize(880,880,{fit:'inside'}).png().toBuffer();
 const iconBg=Buffer.from(`<svg width="1024" height="1024"><defs><radialGradient id="g"><stop stop-color="${P.leaf}"/><stop offset="1" stop-color="${P.petrol}"/></radialGradient></defs><path fill="url(#g)" d="M0 0h1024v1024H0z"/></svg>`);
 await sharp(iconBg).composite([{input:art,left:72,top:72}]).ensureAlpha().png({compressionLevel:9}).toFile(root+'/brand/icon-master-1024.png');
 await sharp(root+'/brand/icon-master-1024.png').resize(512,512).ensureAlpha().png({compressionLevel:9}).toFile(root+'/google-play/icon-512.png');
 const master=await readFile(root+'/brand/icon-master-1024.png');
 const artUri='data:image/png;base64,'+(await readFile(root+'/source/art/icon-generated.png')).toString('base64');
 const feature=wrap(1024,500,`<g id="background"><path fill="${P.petrol}" d="M0 0h1024v500H0z"/><path d="M-70 420Q245 320 480 460T1150 430" fill="none" stroke="${P.leaf}" stroke-width="3"/></g><g id="artwork"><image href="${artUri}" x="530" y="20" width="475" height="475" preserveAspectRatio="xMidYMid meet"/></g><g id="editable-brand">${mark(50,43,85)}<text x="150" y="97" font-size="17" letter-spacing="2.6" fill="${P.copper}">TAŞI · SERVİS ET · BÜYÜT</text>${wordmark(52,255,122)}<text x="56" y="321" font-size="33" fill="${P.cream}">${xml(brand.tagline)}</text><path d="M58 357H140" stroke="${P.amber}" stroke-width="7" stroke-linecap="round"/></g>`);
 await saveSvg('feature-1024x500.svg',feature);
 await raster(feature,1024,500,'google-play/feature-1024x500.png');
 for(const [i,shot]of brand.screenshots.entries()){
   const raw=await readFile(`${root}/captures/${shot.id}.png`);
   const meta=await sharp(raw).metadata();assert.equal(meta.width,1080);assert.equal(meta.height,1640);
   const band=`<g id="background"><path fill="${P.petrol}" d="M0 0h1080v280H0z"/><path d="M885 -40Q1130 70 1010 274" fill="none" stroke="${P.leaf}" stroke-width="2"/></g><g id="editable-title-layer">${wordmark(58,77,51)}<text x="995" y="72" text-anchor="end" font-size="24" letter-spacing="3" fill="${P.copper}">0${i+1}</text><text class="display" x="56" y="181" font-size="90" letter-spacing="-1.3" fill="${P.cream}">${xml(shot.title)}</text><text x="59" y="239" font-size="30" fill="${P.cream}" opacity=".85">${xml(shot.subtitle)}</text><path d="M0 277H1080" stroke="${P.copper}" stroke-width="6"/></g>`;
   const bandSvg=wrap(1080,280,band);await writeFile(root+'/source/layers/'+shot.id+'-title.svg',bandSvg);
   const svg=wrap(1080,1920,`<g id="unaltered-game-capture"><image href="data:image/png;base64,${raw.toString('base64')}" x="0" y="280" width="1080" height="1640" preserveAspectRatio="xMidYMid meet"/></g>${band}`);
   await saveSvg(shot.id+'.svg',svg);
   await raster(svg,1080,1920,`google-play/screenshots/${shot.id}.png`);
 }
 const swatches=Object.entries(P).map(([n,c],i)=>`<rect x="${80+i*290}" y="814" width="264" height="72" rx="18" fill="${c}" stroke="${P.copper}" stroke-width="1"/><text x="${84+i*290}" y="923" font-size="24" fill="${P.petrol}">${n.toUpperCase()} ${c}</text>`).join('');
 const board=wrap(1600,1000,`<path fill="${P.cream}" d="M0 0h1600v1000H0z"/><text x="82" y="90" font-size="22" fill="${P.leaf}" letter-spacing="5">TEPSILO / GÖRSEL KİMLİK</text>${mark(62,152,220,P.petrol)}${wordmark(316,330,205,P.petrol)}<text x="87" y="447" font-size="42" fill="${P.petrol}">${xml(brand.tagline)}</text><text x="88" y="523" font-size="28" fill="${P.leaf}">Tepsi · sıcak servis · yaşayan bir kafe</text><image href="data:image/png;base64,${master.toString('base64')}" x="1120" y="139" width="394" height="394"/><path d="M82 613H1518" stroke="${P.copper}" stroke-width="2"/><text class="display" x="85" y="698" font-size="49" fill="${P.petrol}">Fredoka 600 — sıcak, güçlü başlıklar</text><text x="86" y="752" font-size="30" fill="${P.petrol}">Nunito Sans 700 — Çay, Şube, Büyüt, İşe Al, Süpür</text>${swatches}`);
 await saveSvg('brand-board.svg',board);await raster(board,1600,1000,'preview/brand-board.png');
 const thumbs=[];for(const shot of brand.screenshots)thumbs.push(await sharp(`${root}/google-play/screenshots/${shot.id}.png`).resize(300).toBuffer());
 await sharp({create:{width:2000,height:613,channels:3,background:P.cream}}).composite(thumbs.map((input,i)=>({input,left:40+i*326,top:40}))).png().toFile(root+'/preview/screenshots-contact.png');
 const sizes=[512,192,96,48];const iconPreviews=[];
 for(const s of sizes)iconPreviews.push({input:await sharp(root+'/google-play/icon-512.png').resize(s).toBuffer(),left:40+sizes.slice(0,sizes.indexOf(s)).reduce((n,x)=>n+x+42,0),top:40});
 await sharp({create:{width:1100,height:592,channels:3,background:P.cream}}).composite(iconPreviews).png().toFile(root+'/preview/icon-size-check.png');
 const lightPreview=await sharp(root+'/brand/logo-light-transparent.png').flatten({background:P.petrol}).toBuffer();
 await sharp(lightPreview).png().toFile(root+'/preview/logo-on-dark.png');
 await writeFile(root+'/audit/text-layout.json',JSON.stringify(measurements,null,2));
 await writeFile(root+'/google-play/alt-text-tr.json',JSON.stringify({icon:'Bakır kenarlı tepside ince belli çay bardağı; petrol yeşili zemin üzerinde Tepsilo simgesi.',feature:'Tepsilo logosu ve Kafenin ritmi sende sloganı; yanında stilize tepside çay bardağı.',screenshots:brand.screenshots.map(s=>({file:'screenshots/'+s.id+'.png',alt:s.alt}))},null,2));
 console.log('Created icon, transparent logos, feature graphic, six screenshots, editable SVG layers and review sheets.');
}finally{await browser.close();}
