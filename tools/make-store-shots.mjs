/**
 * MAĞAZA EKRAN GÖRÜNTÜSÜ BESTECİSİ.
 *
 * Girdi: `.devshots/` altındaki HAM 3B kareler (1080×1920). Bunlar
 * tarayıcıda `canvas.toDataURL` ile alınıp `/__shot` uç noktasına
 * POST edilir — Browser bölmesi kareleri birleştirmediği için sayfa
 * ekran görüntüsü ALINAMIYOR, render elle tetiklenir.
 *
 * Çıktı: `cikti/magaza/ss-N-*.png` — üstünde marka bandı ve Türkçe
 * başlık olan, Play'e yüklenmeye hazır kareler.
 *
 * NEDEN HUD YOK: HUD DOM katmanıdır ve 3B tuvalin dışındadır. `foreignObject`
 * ile rasterleştirilebiliyor ama Chrome bu görüntüyü tuvale çizince tuvali
 * KİRLETİYOR (tainted) ve `toDataURL` güvenlik hatası veriyor. Bu yüzden
 * kareler oynanış renderı + tasarlanmış yazı bandı olarak kuruluyor;
 * HUD'ı elle yeniden çizmek "sahte arayüz" olurdu.
 *
 *   node tools/make-store-shots.mjs
 *
 * PLAY ŞARTNAMESİ: telefon karesi en az 2 adet (4-8 önerilir), her kenar
 * 320-3840 px, uzun kenar kısa kenarın 2 katını AŞAMAZ. 1080×1920 (9:16)
 * hem şartı karşılar hem Play'in tanıtım uygunluk eşiğini tutturur.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const CREAM = '#f5efe2';
const GOLD = '#ffc84a';

const W = 1080;
const H = 1920;
const SRC = resolve(process.cwd(), '.devshots');
const OUT = resolve(process.cwd(), 'cikti', 'magaza');

/**
 * Kareler mağaza sırasına göre. İlk kare en önemlisi: oyuncu mağaza
 * kartında onu ~2 saniye görüyor, o yüzden başa ana döngü konur —
 * "büyümüş kafe" değil, OYNANIŞ.
 *
 * Yazılar v5 SELF-SERVİS döngüsüne göre: müşteri ürününü rafından kendi
 * alır, masasına kendi oturur. "Masaya servis et" ARTIK YANLIŞ.
 */
const KARELER = [
  { kaynak: 'ss-1-bar.png', hedef: 'ss-1-siparis.png', yazi: 'Sipariş al, kasayı işlet' },
  { kaynak: 'ss-3-mutfak.png', hedef: 'ss-2-raf.png', yazi: 'Rafları dolu tut' },
  { kaynak: 'ss-4-genel.png', hedef: 'ss-3-buyu.png', yazi: 'Kafeni oda oda büyüt' },
  { kaynak: 'ss-5-giris.png', hedef: 'ss-4-temizlik.png', yazi: 'Temizlik para kazandırır' },
  { kaynak: 'ss-2-salon.png', hedef: 'ss-5-ekip.png', yazi: 'Ekibini kur' },
];

/**
 * Üst yazı katmanı.
 *
 * Sert bant yerine SOLMA perdesi: oynanışın üstünü kapatmadan yazıyı
 * okunur kılıyor. Yazı iki satıra taşarsa Play kartında kırpılır, bu
 * yüzden tek satır ve 24 karakter sınırında tutuldu.
 */
function yaziKatmani(yazi) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="perde" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0f1f19" stop-opacity="0.94"/>
        <stop offset="0.62" stop-color="#0f1f19" stop-opacity="0.72"/>
        <stop offset="1" stop-color="#0f1f19" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="380" fill="url(#perde)"/>
    <rect x="72" y="118" width="104" height="8" rx="4" fill="${GOLD}"/>
    <text x="72" y="228" font-family="Segoe UI, Arial, Helvetica, sans-serif"
          font-size="66" font-weight="700" fill="${CREAM}">${yazi}</text>
  </svg>`);
}

mkdirSync(OUT, { recursive: true });

const rapor = [];
for (const k of KARELER) {
  const yol = resolve(OUT, k.hedef);
  await sharp(resolve(SRC, k.kaynak))
    .resize(W, H, { fit: 'cover' })
    .composite([{ input: yaziKatmani(k.yazi), top: 0, left: 0 }])
    /*
     * Play ekran görüntüsü de ALPHA'sız ister (JPEG veya 24-bit PNG).
     * `flatten` tek başına yetmiyor: composite'ten sonra sharp kanalı
     * koruyup 4 kanallı PNG yazıyordu (ölçüldü: kanal:4, alpha:true),
     * bu yüzden alfa AÇIKÇA sökülüyor.
     */
    .flatten({ background: '#0f1f19' })
    .removeAlpha()
    .png()
    .toFile(yol);
  const m = await sharp(yol).metadata();
  rapor.push(`${k.hedef}  ${m.width}x${m.height}  kanal:${m.channels}  alpha:${m.hasAlpha}`);
}

/* Kişisel kontrol için tek sayfalık kontakt föyü — 5 kare yan yana. */
const kucukler = await Promise.all(
  KARELER.map((k) => sharp(resolve(OUT, k.hedef)).resize(300).toBuffer()),
);
await sharp({ create: { width: 300 * 5 + 40 * 6, height: 533 + 80, channels: 3, background: '#1a1a1a' } })
  .composite(kucukler.map((input, i) => ({ input, top: 40, left: 40 + i * (300 + 40) })))
  .png()
  .toFile(resolve(OUT, '_kontakt-foy.png'));

console.log(rapor.join('\n'));
console.log('kontakt foy: cikti/magaza/_kontakt-foy.png');
