/**
 * MAĞAZA METNİ UZUNLUK ÖLÇER.
 *
 * `docs/magaza-metinleri.md` içindeki kod bloklarını okur ve mağaza
 * sınırlarına göre denetler. Gözle sayma yok: "28 karakter" yazan bir
 * satır 31 karakterse App Store onu SESSİZCE kırpar.
 *
 *   node tools/metin-olc.mjs
 *
 * Not: JavaScript'te `'ğ'.length === 1` — ama emoji ve bazı işaretler
 * iki kod birimidir. Mağazalar KARAKTER sayar, kod birimi değil; bu
 * yüzden ölçüm `[...metin].length` ile yapılır.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const md = readFileSync(resolve(process.cwd(), 'docs', 'magaza-metinleri.md'), 'utf8');

/** Başlıkla eşleşen ilk kod bloğunu döndürür. */
function blok(basliktanSonra, sira = 0) {
  const i = md.indexOf(basliktanSonra);
  if (i < 0) return null;
  const kalan = md.slice(i);
  const bloklar = [...kalan.matchAll(/```\n([\s\S]*?)```/g)];
  return bloklar[sira] ? bloklar[sira][1].replace(/\n$/, '') : null;
}

const DENETIM = [
  { ad: 'Uygulama adı (TR)', metin: blok('## 1. Uygulama adı', 0), sinir: 30 },
  { ad: 'Uygulama adı (EN)', metin: blok('İleride EN listelemesi', 0), sinir: 30 },
  { ad: 'App Store alt başlık (TR)', metin: blok('## 2. App Store alt başlığı', 0), sinir: 30 },
  { ad: 'App Store alt başlık (EN)', metin: blok('## 2. App Store alt başlığı', 1), sinir: 30 },
  { ad: 'Kısa açıklama (TR)', metin: blok('## 3. Kısa açıklama', 0), sinir: 80 },
  { ad: 'Kısa açıklama (EN)', metin: blok('## 3. Kısa açıklama', 1), sinir: 80 },
  { ad: 'Uzun açıklama (TR)', metin: blok('## 4. Uzun açıklama', 0), sinir: 4000 },
  { ad: 'Uzun açıklama (EN)', metin: blok('## 4. Uzun açıklama', 1), sinir: 4000 },
  { ad: 'App Store anahtar kelimeler', metin: blok('## 5. App Store anahtar', 0), sinir: 100 },
  { ad: 'Sürüm notu (TR)', metin: blok('## 6. Sürüm notu', 0), sinir: 500 },
  { ad: 'Sürüm notu (EN)', metin: blok('## 6. Sürüm notu', 1), sinir: 500 },
];

let hata = 0;
for (const d of DENETIM) {
  if (d.metin == null) {
    console.log(`?? ${d.ad}: BLOK BULUNAMADI`);
    hata++;
    continue;
  }
  const n = [...d.metin].length;
  const ok = n <= d.sinir;
  if (!ok) hata++;
  console.log(`${ok ? 'OK ' : 'TASMA'} ${d.ad}: ${n}/${d.sinir}`);
}

/*
 * Türkçe büyük harf tuzağı: markanın büyük hâli "FİNCAN" (noktalı İ).
 * Kontrol YALNIZCA kod bloklarında yapılır — belgenin açıklama metni bu
 * hatayı örnek olarak GÖSTERDİĞİ için tüm dosyayı taramak kendi uyarısını
 * tetikliyordu.
 */
const kodBloklari = [...md.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
if (/FINCAN/.test(kodBloklari)) {
  console.log('UYARI: yapistirilacak metinde noktasiz I ile "FINCAN" gecti — dogrusu "FİNCAN"');
  hata++;
}

console.log(hata === 0 ? '\nHepsi sinirlar icinde.' : `\n${hata} sorun var.`);
process.exit(hata === 0 ? 0 : 1);
