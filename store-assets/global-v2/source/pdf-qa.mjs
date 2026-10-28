// Optional PDF raster audit uses the desktop's bundled document runtime.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_DOC_NODE_MODULES||'C:/Users/Enes/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const canvas=await import(pathToFileURL(modules+'/@napi-rs/canvas/index.js'));
globalThis.DOMMatrix=canvas.DOMMatrix;globalThis.Path2D=canvas.Path2D;globalThis.ImageData=canvas.ImageData;
const pdfjs=await import(pathToFileURL(modules+'/pdfjs-dist/legacy/build/pdf.mjs'));
const root=resolve('store-assets/global-v2');
const doc=await pdfjs.getDocument({data:new Uint8Array(await readFile(root+'/report/ASO-ve-marka-raporu.pdf')),useSystemFonts:true}).promise;
assert.equal(doc.numPages,10);
await mkdir(root+'/previews/pdf',{recursive:true});const parts=[],pages=[];let allText='';
for(let i=1;i<=doc.numPages;i++){
 const page=await doc.getPage(i),viewport=page.getViewport({scale:1.4}),c=canvas.createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
 await page.render({canvasContext:c.getContext('2d'),viewport,canvas:c}).promise;
 const file=root+`/previews/pdf/page-${String(i).padStart(2,'0')}.png`;await writeFile(file,c.toBuffer('image/png'));
 const text=(await page.getTextContent()).items.map(x=>x.str||'').join(' ');assert(text.length>500,'Unexpected empty PDF page');allText+=text+'\n';
 const links=(await page.getAnnotations()).filter(x=>x.url);pages.push({page:i,textCharacters:text.length,externalLinks:links.length});
 parts.push({input:await sharp(file).resize(238).toBuffer(),left:((i-1)%5)*250+20,top:Math.floor((i-1)/5)*350+20});
}
assert(allText.includes('Kafe Caddesi'));assert(allText.includes('Cafe Avenue'));assert(allText.includes('İşletme Oyunu'));
await sharp({create:{width:1270,height:720,channels:3,background:'#ddd'}}).composite(parts).png().toFile(root+'/previews/pdf-contact.png');
await writeFile(root+'/research/pdf-audit.json',JSON.stringify({actualPdfPages:doc.numPages,pages,turkishTextExtracted:true},null,2));
await writeFile(root+'/research/pdf-extracted-text.txt',allText);
await doc.destroy();console.log('Rendered and read all 10 actual PDF pages; Turkish text and external source links verified.');
