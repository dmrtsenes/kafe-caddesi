import {metadata,sources,competitors,candidates,keywords,pages} from './content.mjs';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve('store-assets/global-v2');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const csv=(header,rows)=>'\uFEFF'+[header,...rows].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
for(const d of ['metadata','report','previews/report'])await mkdir(root+'/'+d,{recursive:true});
const alt={
 tr:['Tepsideki sipariş masadaki müşterilere götürülüyor.','Çay ve kahve istasyonlarından tepsiye ürün alınıyor.','Elektrikli süpürgeyle müşterilerin çevresindeki zemin temizleniyor.','Servis tezgâhında biriken oyun parası toplanıyor.','Personel panelinde tezgâhtar, kasiyer ve komi için işe alma ve seviye seçenekleri.','Açılan salon odasında masalar ve yeni masa satın alma alanı.'],
 en:['An order is carried on a tray to guests at a table.','A drink is picked up at the tea and coffee production stations.','A powered vacuum cleans the floor near seated customers.','In-game earnings are collected at the service counter.','The staff panel shows hiring and level options for shelf assistants, cashiers and bussers.','An unlocked dining room shows tables and a new table purchase area.']
};
const metadataAudit=[];
for(const lang of ['tr','en']){
 const m=metadata[lang],lengths={title:[...m.title].length,short:[...m.short].length,full:[...m.full].length};
 assert(lengths.title<=30&&lengths.short<=80&&lengths.full<=4000);
 assert(alt[lang].every(x=>[...x].length<=140));
 const extra={...m,lengths,alternateTitle:lang==='tr'?'Kafe Caddesi: Kafe Oyunu':'Cafe Avenue: Coffee Tycoon',assetAlt:{icon:lang==='tr'?'Kahve makinesi, servis tepsisi ve fincanın stilize çizimi.':'Stylised coffee machine, serving tray and cup.',feature:lang==='tr'?'Kafe Caddesi logosu; çay, kahve ve tost üretim tezgâhının stilize kapak çizimi.':'Cafe Avenue logo beside a stylised tea, coffee and toast preparation counter.',screenshots:alt[lang]}};
 await writeFile(root+`/metadata/google-play-${lang}.json`,JSON.stringify(extra,null,2));
 await writeFile(root+`/metadata/google-play-${lang}.txt`,`${lang==='tr'?'BAŞLIK':'TITLE'} (${lengths.title}/30)\n${m.title}\n\n${lang==='tr'?'KISA AÇIKLAMA':'SHORT DESCRIPTION'} (${lengths.short}/80)\n${m.short}\n\n${lang==='tr'?'TAM AÇIKLAMA':'FULL DESCRIPTION'} (${lengths.full}/4000)\n${m.full}\n`);
 metadataAudit.push({lang,...lengths});
}
await writeFile(root+'/research/metadata-audit.json',JSON.stringify(metadataAudit,null,2));
await writeFile(root+'/research/competitors.csv',csv(['Oyun','Yakınlık','Ana deneyim','Bu proje için değerlendirme','Kaynak'],competitors.map(x=>[...x.slice(0,4),sources[x[4]-1][2]])));
await writeFile(root+'/research/naming-matrix.csv',csv(['Türkçe','İngilizce','Karar','Güç','Çakışma / sınır','Kaynak'],candidates.map(x=>[...x.slice(0,5),x[5]?sources[x[5]-1][2]||sources[x[5]-1][3]:'Detaylı kapsamlı kontrol yapılmadı / nitel değerlendirme'])));
await writeFile(root+'/research/keyword-intent.csv',csv(['Dil / bölge','İfade','Niyet','Yerleşim','Kanıt sınırı'],keywords));
await writeFile(root+'/research/sources.csv',csv(['No','Yayıncı','Başlık','URL','Tarih ve kapsam'],sources.map((x,i)=>[i+1,...x])));
await writeFile(root+'/research/search-scope.md',`# İsim taraması kapsamı\n\n13 Eylül 2026. İngilizce ve Türkçe adlar için genel web, Google Play, App Store ve belirgin oyun kayıtları tarandı. Örnek sorgular: “Cafe Avenue”, “Cafe Avenue: Idle Tycoon”, “Kafe Caddesi”, “Kafe Caddesi oyun”, “Cafe Tempo”, “Cafe Circuit”, “Cafe Crew”, “Cafe Shift”, “Serve Rush”, “Cafe Bloom”.\n\nCafe Avenue ve Kafe Caddesi için belirgin aynı adlı oyun görülmedi. Bazı sorgular tam eşleşme sunmadı veya ilgisiz sonuç döndürdü; bunlar adın boş olduğu kanıtı değildir. Cafe Avenue şarkı ve gerçek işletmelerde de kullanılır. Cafe Tempo gerçek işletmelerde kullanılır; resmi sicil taraması yapılmadı. Cafe Circuit LLC için oyun dışı işletme kaydı var. Diğer doğrudan çakışma bağlantıları naming-matrix.csv ve sources.csv içindedir.\n\nGoogle Play dil sayfaları ülke sıralaması değildir: web kopyasının ülke alt bilgisi görüntüleme konumuna göre değişebilir. Almanca Coffee Break kopyası yaklaşık beş aylık; Fransızca kopya yaklaşık iki haftalıktı. Güncel mağaza kuralları resmi yardım sayfalarından üretim öncesinde doğrulandı.\n\nPlay Console, ücretli ASO verisi, eksiksiz mağaza kataloğu, marka sicili, alan adı ve sosyal hesap kullanılabilirliği erişimi/kontrolü yok. Aday seçimi kullanım veya tescil hakkı garantisi değildir.\n`);

function footnotes(body){const ids=[...new Set([...body.matchAll(/href="#source-(\d+)"/g)].map(x=>+x[1]))];return `<div class="footnotes">${ids.map(id=>{const s=sources[id-1];return `<p>${id}. ${escape(s[0])}, ${s[2]?`<a href="${escape(s[2])}">${escape(s[1])}</a>`:escape(s[1])}.</p>`;}).join('')}</div>`;}
const contentPages=pages.map((p,i)=>`<section class="page"><h${i?2:1}>${p.title}</h${i?2:1}>${p.body}${footnotes(p.body)}</section>`);
for(let start=0;start<sources.length;start+=16){contentPages.push(`<section class="page source-page"><h2>Kaynaklar${start?' — devam':''}</h2><p>Çevrimiçi kaynaklar ilgili yayıncıların sayfalarıdır. Yerel kaynaklar çalışma kopyasındaki kayıtları belirtir.</p><ol start="${start+1}">${sources.slice(start,start+16).map((s,i)=>`<li id="source-${start+i+1}"><strong>${escape(s[0])}.</strong> ${s[2]?`<a href="${escape(s[2])}">${escape(s[1])}</a>`:escape(s[1])}. ${escape(s[3])}</li>`).join('')}</ol></section>`);}
const report=`<!doctype html><html lang="tr"><meta charset="utf-8"><title>Kafe Caddesi / Cafe Avenue ASO ve marka kararı</title><style>*{box-sizing:border-box}body{margin:0;background:#ddd;color:#202326;font:10.2pt/1.43 Arial,sans-serif}.page{width:210mm;min-height:297mm;padding:18mm 20mm;background:white;margin:12px auto;break-after:page}h1{font-size:23pt;line-height:1.13;margin:0 0 20px}h2{font-size:19pt;line-height:1.2;margin:0 0 19px}p{margin:0 0 12px}strong{font-weight:700}table{border-collapse:collapse;width:100%;font-size:8.8pt;line-height:1.32;margin:14px 0 16px}th,td{text-align:left;vertical-align:top;padding:7px;border-bottom:1px solid #ccc}th{background:#eee;border-top:1px solid #333}tr{break-inside:avoid}a{color:#253b42;text-decoration:underline;text-underline-offset:2px}sup{font-size:7.5pt;margin-left:2px}.footnotes{font-size:7.1pt;line-height:1.26;border-top:1px solid #bbb;margin-top:17px;padding-top:6px}.footnotes p{margin:0 0 3px}.source-page{font-size:9pt;line-height:1.45}.page:nth-child(3) table,.page:nth-child(4) table{font-size:8.3pt}.page:nth-child(3) td,.page:nth-child(3) th,.page:nth-child(4) td,.page:nth-child(4) th{padding:5px}.source-page li{padding-left:5px;margin-bottom:12px}.source-page ol{padding-left:20px}@page{size:A4;margin:0}@media print{body{background:white}.page{margin:0;min-height:297mm}.page:last-child{break-after:auto}}</style><main>${contentPages.join('')}</main></html>`;
await writeFile(root+'/report/ASO-ve-marka-raporu.html',report);
await writeFile(root+'/source/report-content.json',JSON.stringify(pages,null,2));

const design=JSON.parse(await readFile(root+'/source/design.json','utf8'));
const gallery=`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kafe Caddesi · Cafe Avenue — Store kit</title><style>@font-face{font-family:Paytone;src:url(source/fonts/paytoneone-PaytoneOne-Regular.ttf)}*{box-sizing:border-box}body{margin:0;background:#f5f1e7;color:#103d40;font:16px/1.6 system-ui,sans-serif}main{max-width:1360px;margin:auto;padding:40px 5vw}h1,h2{font-family:Paytone;font-weight:400;line-height:1.15}h1{font-size:clamp(32px,5vw,64px);margin:18px 0}h2{margin:40px 0 20px;font-size:28px}.intro{max-width:770px}a{color:inherit}nav{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}nav a,.languages button{padding:12px 20px;background:#103d40;color:#fff3d7;border:0;border-radius:8px;text-decoration:none;font:inherit;cursor:pointer}.languages button[aria-pressed=true]{background:#ffc44a;color:#103d40}header{display:grid;grid-template-columns:1fr 160px;gap:28px;align-items:center}header img{width:160px;height:160px;border-radius:26%}.feature{display:block;width:100%;max-width:1024px;border-radius:8px}.screens{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.screens img{display:block;width:100%;border-radius:8px}.screens a{text-decoration:none}.screens strong{display:block;margin:8px 0 3px}.logo-row{display:flex;align-items:center;gap:30px;flex-wrap:wrap}.logo-row img{width:min(460px,100%)}.logo-row .logo{background:#d2e6dd;border-radius:12px;padding:25px}.muted{color:#536a67}.notice{border-left:4px solid #bb7037;padding-left:20px;max-width:850px}.meta{font-size:20px;font-weight:600}.palette{display:flex;gap:12px;flex-wrap:wrap}.swatch{height:60px;width:120px;border-radius:8px;margin-bottom:6px}footer{border-top:1px solid #b5c8be;margin-top:40px;padding-top:20px}.lang[hidden]{display:none}@media(max-width:720px){main{padding:22px}.screens{grid-template-columns:repeat(2,1fr);gap:16px}header{grid-template-columns:1fr 80px;gap:14px}header img{width:80px;height:80px}nav a{padding:10px 14px}.meta{font-size:17px}}</style><main><header><div><p>AVRUPA + TÜRKİYE · GOOGLE PLAY</p><h1>Kafe Caddesi<br>Cafe Avenue</h1><p class="intro">Aktif servis, temizlik ve işletme büyütme. İki dil, tek görsel kimlik. Gerçek oyundan altışar ekran, ayrı kapak çizimi ve ortak uygulama ikonu.</p></div><img src="final/shared/icon-google-play-512.png" alt="Ortak uygulama ikonu"></header><nav><a href="cafe-avenue-kafe-caddesi-store-kit.zip" download>ZIP paketini indir</a><a href="report/ASO-ve-marka-raporu.pdf">ASO raporunu aç</a><a href="BRAND-GUIDE.md">Marka kılavuzu</a></nav><div class="languages"><button data-lang="tr" aria-pressed="true">Türkçe</button> <button data-lang="en" aria-pressed="false">English</button></div>${['tr','en'].map(lang=>`<section class="lang" data-panel="${lang}" ${lang==='en'?'hidden':''}><h2>${lang==='tr'?'Türkçe mağaza seti':'English store set'}</h2><p class="meta">${escape(metadata[lang].title)}</p><p>${escape(metadata[lang].short)}</p><p><a href="metadata/google-play-${lang}.txt">${lang==='tr'?'Mağaza metinleri':'Listing copy'}</a> · <a href="metadata/google-play-${lang}.json">JSON + alt text</a></p><a href="final/${lang}/feature-graphic-1024x500.png" download><img class="feature" src="final/${lang}/feature-graphic-1024x500.png" alt="${lang==='tr'?'Stilize tanıtım kapağı':'Stylised feature graphic'}"></a><p class="muted">${lang==='tr'?'1024 × 500 · Tanıtım çizimi; oynanış ekranı değildir.':'1024 × 500 · Cover illustration, not a gameplay screenshot.'}</p><h2>${lang==='tr'?'Altı gerçek oynanış anı':'Six moments of real gameplay'}</h2><div class="screens">${design.shots.map((s,i)=>`<a href="final/${lang}/screenshots/${s}.png" download><img src="final/${lang}/screenshots/${s}.png" alt="${escape(alt[lang][i])}" loading="lazy"><strong>${i+1}. ${design.copy[lang].screens[i].join(' ')}</strong><span class="muted">1080 × 1920 PNG</span></a>`).join('')}</div><h2>${lang==='tr'?'Logo':'Wordmark'}</h2><div class="logo-row"><a class="logo" href="final/${lang}/logo-transparent.png" download><img src="final/${lang}/logo-transparent.png" alt="${metadata[lang].brand} logo"></a><div><a href="final/${lang}/logo.svg">${lang==='tr'?'Düzenlenebilir SVG':'Editable SVG'}</a><br><a href="final/${lang}/logo-transparent.png">${lang==='tr'?'Şeffaf PNG':'Transparent PNG'}</a></div></div></section>`).join('')}<h2>Ortak ikon ve renkler</h2><p><a href="final/shared/icon-google-play-512.png" download>Google Play ikonu · 512 × 512</a> · <a href="final/shared/icon-master-1024.png">1024 px ana dosya</a> · <a href="previews/icon-sizes.png">Küçük boyut kontrolü</a></p><div class="palette">${Object.entries(design.palette).map(([n,c])=>`<div><div class="swatch" style="background:${c}"></div>${c}</div>`).join('')}</div><h2>Değerlendirme notları</h2><p class="intro">14 isim çifti ve 10 rakip incelendi. Cafe Avenue / Kafe Caddesi, ürün uyumu ve anlaşılır kategori ifadesi için seçildi. Arama hacmi ve gerçek mağaza dönüşümü ölçülmedi; ASO sonucu veya marka hakkı garantisi değildir.</p><p class="notice">Mevcut karakterlerin dağıtım lisansı proje kaydında doğrulanmamış durumda. Gerçek ekranlar bu karakterleri içerir. Teknik olarak hazırlanan bu dosyaların yayımlanması için hak durumunun çözülmesi gerekir.</p><footer><a href="README.md">Teslim içeriği ve kullanım</a> · <a href="research/verification.json">Teknik doğrulama</a> · <a href="research/naming-matrix.csv">İsim karşılaştırması</a><p class="muted">Yeni adlar mağaza/marka taslağında kullanıldı. Oyunun kaynak kodu, paket kimliği, kayıt anahtarları ve mevcut adı değiştirilmedi.</p></footer></main><script>document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{const lang=b.dataset.lang;document.documentElement.lang=lang;document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==lang);document.querySelectorAll('[data-lang]').forEach(x=>x.setAttribute('aria-pressed',x===b));}));</script></html>`;
await writeFile(root+'/index.html',gallery);
const guide=`# Kafe Caddesi / Cafe Avenue — marka kılavuzu

Türkiye: **Kafe Caddesi**. İngilizce: **Cafe Avenue**. Mağaza başlıkları metadata/ altında. Avrupa için en-GB ortak İngilizce seti; Türkçe tr-TR. Bunlar aynı ürünün dil sürümleridir. Mevcut oyun adı bu çalışma kapsamında değiştirilmedi.

## Görsel sistem

Tente, iki satırlı ağır yazı ve tepsi kenarını çağrıştıran kavisli alt çizgi ortak işarettir. Üst sözcük krem, alt sözcük sıcak sarıdır. Şeffaf logonun çevresinde en az üst satır harf yüksekliğinin dörtte biri kadar boşluk bırakın. Dijitalde önerilen en küçük tam logo genişliği 180 px; daha küçük yerlerde yazısız ikonu kullanın. Logoyu esnetmeyin, gölgesini büyütmeyin veya renklerini bağımsız değiştirmeyin.

Renkler: ${Object.entries(design.palette).map(([n,c])=>n+' '+c).join('; ')}.

Paytone One: logo ve ana başlıklar. Barlow Condensed Bold: küçük marka satırı. İki aile SIL Open Font License ile birlikte source/fonts/ klasöründe bulunur. Türkçe büyük harf dönüşümünde tr-TR kullanılmalıdır: Caddesi → CADDESİ, ekibini → EKİBİNİ. İlk denemedeki Lilita One dosyaları yalnız önceki tasarım kaydıdır; final SVG’lerde kullanılmaz.

## Nesne ve görüntü dili

İkon yazısızdır, iki dilde aynı kullanılır. Kapak; gerçek çay/kahve/tost ekipmanını stilize eden ayrı bir çizimdir. Bunları gerçek oynanış ekranı diye sunmayın. Yeni karakter veya rakip marka işareti kapak çizimlerinde yoktur. Çekimler gerçek oyunun varsayılan kamerasını ve mevcut grafiklerini gösterir.

Altı kare sırası: servis, üretim, temizlik, kazanç, personel, salon genişlemesi. Başlıklar kısa ve eylem odaklıdır. Başlık katmanı yüksekliğin %18,33’üdür; kalan alan değişmeden korunur. İkinci kare alt başlık, diğerleri üst başlık kullanır. Oyun görüntülerine yeniden çizilmiş para, eşya, karakter veya UI eklenmez.

## Ses ve dil

TR: doğrudan, kısa ve sıcak. “Hazırla”, “servis yap”, “kafeni büyüt”. EN: açık eylem cümleleri; “Serve”, “earn”, “expand”. “En iyi”, “#1”, “milyonlar oynuyor”, “uyurken para kazan” gibi ölçülmemiş veya yanlış vaatlerden kaçının. Idle, kısmi otomasyon ve aktif arcade bağlamında açıklanır.

## Google Play telefon dosyaları

| Kullanım | Dosya | Teknik özellik |
|---|---|---|
| Uygulama ikonu | final/shared/icon-google-play-512.png | 512 × 512, RGBA PNG, 1024 KB altında |
| Tanıtım kapağı | final/tr veya en/feature-graphic-1024x500.png | 1024 × 500, RGB PNG |
| Telefon görselleri | final/tr veya en/screenshots/ | Dil başına 6, 1080 × 1920, RGB PNG |
| Logo | final/tr veya en/logo-transparent.png | 1200 × 680, gerçek alfa |

Teknik dayanaklar: [Play görselleri](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en), [ikon kılavuzu](https://developer.android.com/distribute/google-play/resources/icon-design-specifications). 13 Eylül 2026’da kontrol edildi. İkona dış maske eklenmez; Play kendi köşe maskesini uygular. Bu paket telefon içindir; tablet/iOS için ayrı uygun çekimler gerekir.

## Yayın durumu

Ekran görüntülerindeki mevcut karakterlerin dağıtım lisansı docs/KARAKTER-KAYNAGI.md kaydına göre doğrulanmamıştır. Bu hak konusu çözülmeden “yayın hakkı temiz” kabul edilmemelidir. İsim taraması tescil kontrolü değildir. Mağazaya yükleme veya yayın yapılmadı.
`;
await writeFile(root+'/BRAND-GUIDE.md',guide);
await writeFile(root+'/README.md',`# Kafe Caddesi / Cafe Avenue — Google Play paketi

Öncelik: Türkiye ve Avrupa. Final öneri: **Kafe Caddesi: İşletme Oyunu** / **Cafe Avenue: Idle Tycoon**. Google Play hedefi proje yayın belgelerinde mevcut.

**Görseller üretildi ve teknik kontrolleri yapıldı. Yayın hakkı açısından koşul var:** mevcut karakterlerin Clean It XAPK’sından geldiği ve dağıtım lisansının doğrulanmadığı docs/KARAKTER-KAYNAGI.md içinde kayıtlı. Gerçek ekranlar bu karakterleri içerir. Yeni ikon ve kapaklar karakter içermez. Teknik dosya hazırlığı, mağaza kabulü veya karakter/isim kullanım hakkı onayı değildir.

- index.html: Türkçe/İngilizce önizleme ve indirme galerisi.
- final/shared: yazısız ortak 512 px ikon ve 1024 px ana dosya.
- final/tr ve final/en: şeffaf logo, SVG logo, tanıtım kapağı ve altışar telefon ekranı.
- metadata: başlık, kısa/tam açıklama ve alt metinler; UTF-8 TXT/JSON.
- report: kaynaklı 10 sayfalık ASO kararı, PDF ve düzenlenebilir HTML.
- research: 14 isim, 10 rakip, anahtar kelime niyetleri, kaynaklar, oynanış ve doğrulama kayıtları.
- captures: uygulamanın kendi Türkçe ve İngilizce arayüzünden 12 ham çekim.
- source: bağımsız SVG katmanları, orijinal raster çizimler, gerçek üretim istemleri, yazı tipleri ve üretim kodu.
- BRAND-GUIDE.md: kısa marka kılavuzu.

## Yeniden üretim

Depo kökünde mevcut Node.js, Playwright, Sharp ve Chrome kullanılır. Paket oyun kaynaklarını değiştirmez. Gerekli bağımlılıklar package.json sürüm kaydında zaten vardır; paket için oyun bağımlılıkları düzenlenmedi.

1. Oyun sunucusu: node store-assets/global-v2/source/serve.mjs
2. Yeni gerçek çekimler gerekiyorsa: node store-assets/global-v2/source/capture.mjs
3. Görseller: node store-assets/global-v2/source/build.mjs
4. Metinler, galeri ve rapor: node store-assets/global-v2/source/publish.mjs
5. Kontrol: node store-assets/global-v2/source/verify.mjs
6. ZIP: node store-assets/global-v2/source/package.mjs

Çekim aracı ayrı geçici profilde normal oyunu hızlandırır; gerçek kazanımlarla ilerler. Sabit varsayılan kamera ve mevcut modeller kullanılır. Kullanıcının kayıt profiline yazılmaz. Hızlandırılmış çekimler insan oyuncu performans ölçümü değildir. İki dil ayrı seans olduğundan aynı saniyeyi veya aynı ekonomik durumu temsil etmek zorunda değildir.

SVG’lerde başlık yazıları ve gerçek oynanış görüntüsü ayrı katmanlardır; fontlar ve görüntüler gömülüdür. SVG’yi editörde açarken aynı fontları kurun veya paketteki PNG çıktısını referans alın. İkon ve kapak çizimleri raster ana kaynaklardır; model/nesne katmanlarına ayrılmış 3D dosyalar değildir. Metin ve yerleşim katmanları düzenlenebilir. Görsel üretim istemleri saklanmıştır; aynı istemin tekrar çalıştırılması birebir aynı çizimi garanti etmez.

**Sınırlar:** Kaynak kodu, paket kimliği, kayıt anahtarları, oyun adı ve oyun içi tabelalar değiştirilmedi. İngilizce oyunda bazı sahne etiketleri Türkçe ve para birimi lira olarak kalır. Avrupa için İngilizce set tamamlandı; Almanca/Fransızca görseller bu teslimde yoktur. Ücretli ASO ve canlı Console verisi olmadan arama hacmi veya maksimum dönüşüm iddiası yapılmaz.
`);
await copyFile(resolve('store-assets/source/serve.mjs'),root+'/source/serve.mjs');

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:1200},deviceScaleFactor:1});
 await page.goto(pathToFileURL(root+'/report/ASO-ve-marka-raporu.html').href);await page.evaluate(()=>document.fonts.ready);
 const metrics=await page.locator('.page').evaluateAll(es=>es.map((e,i)=>({page:i+1,height:e.getBoundingClientRect().height,expectedHeight:297*96/25.4,textLength:e.innerText.length})));
 for(const m of metrics)assert(m.height<=1123,`Report page ${m.page} overflows (${m.height})`);
 await page.pdf({path:root+'/report/ASO-ve-marka-raporu.pdf',printBackground:true,preferCSSPageSize:true});
 const parts=[];for(let i=0;i<metrics.length;i++){const file=root+`/previews/report/page-${String(i+1).padStart(2,'0')}.png`;await page.locator('.page').nth(i).screenshot({path:file});parts.push({input:await sharp(file).resize(238).png().toBuffer(),left:(i%5)*250+20,top:Math.floor(i/5)*350+20});}
 await sharp({create:{width:1270,height:720,channels:3,background:'#ddd'}}).composite(parts).png().toFile(root+'/previews/report-contact.png');
 await writeFile(root+'/research/report-audit.json',JSON.stringify({pages:metrics,metadata:metadataAudit},null,2));
 console.log(JSON.stringify({reportPages:metrics.length,metadata:metadataAudit}));
}finally{await browser.close();}



