import * as THREE from 'three';

/**
 * KARAKTER MATERYALLERİ — tüm karakterlerin paylaştığı iki materyal.
 *
 * Neden ikisi yetiyor: rig'in hiç özel materyal parametresi yok
 * (doğrulandı — saydamlık, roughness, metalness, emissive, side hiçbir
 * yerde geçmiyor). Palet renkleri vertex özniteliğine taşındığı için
 * karakter başına ~23 materyal ikiye iniyor ve bu ikisi GLOBAL olabiliyor.
 *
 * Ayrım korunuyor: yüz ışıksız kalır. Bu bilinçli bir okunaklılık kararı
 * (v5.0: göz boyu ve BROW_Y ayarı "göz + kaş tek koyu leke olmasın" diye
 * yapıldı); ışıklı shader'a alınırsa o karar bozulur. Karakter başına iki
 * çizim çağrısının ikincisi tam olarak bu.
 *
 * İSTİSNA KALMADI (Task 7). Kafa gövde mesh'i Task 6'ya kadar dışarıdaydı:
 * öfke tintlemesi (CharacterAnimator) karaktere özel bir materyal klonunu
 * mutasyona uğratıyordu ve bu iki materyal GLOBAL/paylaşımlı — biri mutasyona
 * uğrasa hepsi renk değiştirirdi. Tint artık kafa vertex aralığına yazılıyor
 * (CharacterRig `setHeadTint`), kafa da bu ikiliye katıldı.
 */

let lit: THREE.MeshStandardMaterial | null = null;
let unlit: THREE.MeshBasicMaterial | null = null;

/** Gövde, kafa, uzuvlar, saç, şapka, üstlük, ayakkabı. */
export function charLitMaterial(): THREE.MeshStandardMaterial {
  if (!lit) {
    lit = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
    });
  }
  return lit;
}

/** Göz, kaş, ağız, bıyık, allık — keskin okunsun diye ışıksız. */
export function charUnlitMaterial(): THREE.MeshBasicMaterial {
  if (!unlit) {
    unlit = new THREE.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false,
    });
  }
  return unlit;
}

const _c = new THREE.Color();

/**
 * Hex rengi three'nin ÇALIŞMA UZAYINA (doğrusal) çevirir.
 *
 * PAYLAŞIMLI `_c` DÖNER — çağıran `.r`/`.g`/`.b`'yi ANINDA okumalı, bir
 * sonraki çağrı üzerine yazar (dosyanın tek scratch nesnesi; her karede
 * yüzlerce kez çağrıldığı için tahsis yapmıyor).
 *
 * ROL TARİHÇESİ (Task 9b). Task 5-9 arası bu iş `paintGeometry(geo, color)`
 * idi: geometriyi KLONLAYIP klonun `color` özniteliğine yazıyordu. Fix
 * round 1 (Adım A) klonlamayı kaldırdı, geriye "verilen (zaten klon)
 * geometriye yaz" kaldı. Fix round 1 (Adım B) ara klonun kendisini de
 * kaldırdı: `CharacterSkin.buildSkin` artık birleşik vertex renk tamponuna
 * DOĞRUDAN yazıyor, yazacak bir `BufferGeometry` bile yok — geriye yalnız
 * "hex'i doğrusala çevir" kısmı kaldı, bu fonksiyon o.
 *
 * Doğrusal uzaya çevrilmesi şart: `MeshStandardMaterial` vertex rengini
 * doğrusal kabul eder, palet renkleri ise sRGB hex.
 *
 * TEK ÇEVRİM — ÖLÇÜLDÜ. Bu depoda `THREE.ColorManagement.enabled === true`
 * (three r169): `setHex(color, THREE.SRGBColorSpace)` ColorManagement
 * sayesinde sRGB→doğrusal çevrimi KENDİSİ yapıyor ve `mat()`/`basic()`'in
 * `new THREE.Color(hex)` yoluyla ürettiğiyle bit bit AYNI r/g/b veriyor
 * (doğrulandı: rig-identity.js renk kolu ilk koşuda `colorMismatches`
 * 1.176.882/1.247.602 verdi — "beklenen" ve "bulunan" arasındaki fark tam
 * `sRGBToLinear(beklenen)` formülüne eşitti). Ardından ayrıca
 * `.convertSRGBToLinear()` çağırmak bu çevrimi İKİNCİ KEZ uygular ve
 * karakterleri koyulaştırır — kapının yakaladığı gerçek hata buydu.
 */
export function linearColor(color: number): THREE.Color {
  return _c.setHex(color, THREE.SRGBColorSpace);
}
