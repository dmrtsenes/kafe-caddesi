# Avlu lavaboları

Paket ürün alan müşteri daha önce `afterService` üzerinden tuvalete yöneliyor, kabinin önünde genel çalışma animasyonuna geçiyordu. Müşteri modelinde bu animasyon oturarak yemek yeme klibini kullandığı için ürün tepsisiyle havada oturuyordu.

## Müşteri akışı

- Paket müşterisi ürününü taşıyarak çıkışa gider. Ürünleri elinden silerek tuvalete sokma yapılmaz.
- Masada yemeği biten müşteri ürünlerini tüketir; yalnız eli boş, yemeğini tamamlamış misafir lavabo kullanabilir.
- Müşteri kabinin açık önünden içeri yürür ve porselen oturakla ortak tanımlanan oturma noktasına geçer. `sit` animasyonu kullanılır; kıyafet veya vücut parçaları gizlenmez.
- Oturan müşteri yürüyüş ve kalabalık itişinden ayrılır. Kullanım sonunda kabinin önündeki erişilebilir noktaya kalkar ve çıkışa yürür.
- Yol bekleyişi iptal olduğunda rezervasyon bırakılır; ücret ve sarf tüketimi oluşmaz. Kirli veya sarfsız kabin yeni müşteri almaz.

## Yerleşim ve görünüm

Sağ avlunun kuzey bölümü ayrı girişli lavabo odasıdır. Güneydeki iki havuz, bitkiler ve avlu paket servisi korunur. Lavabo girişi, avlu yan işinin kilidinden bağımsızdır; mevcut `a6` açılımına bağlıdır.

İki bitişik kabinde açık taş döşeme, şişe yeşili arka paneller, ceviz dolap, pirinç çerçeve ve bataryalar, aydınlatılmış ayna, açık porselen oturak ve sarf göstergeleri kullanılır. Yakın taraftaki bölmeler alçak tutularak müşterilerin kıyafetleri görünür kalır. Oda adı doğrudan zemine yazılır.

Peçete/kâğıt depoları odanın içine taşınır. Kabin duvarları, lavabo dolabı ve klozet gerçek çarpışma parçalarıdır; kabinin içinin tamamı kapalı bir kutu değildir. Yeni girişin yanında rahat boşluk bırakmak için waffle ve frappe makineleri sırasıyla 0,19 ve 0,41 birim sola hizalanır.

`k_wc_1`, `k_wc_2`, `k_pecete`, `k_kagit` ve `a6` kimlikleri korunur. Mevcut satın alımlar, yükseltmeler ve sarf stokları yeni konumlarında devam eder.

## Ek gelir

Temiz ve sarfı olan kabinde tamamlanan her kullanım bir kez ek ücret kazandırır. Ücret, ortalama menü değerinin %30'u üzerinden satış çarpanı ve kabinin temizliğiyle hesaplanır; kabinde güncel tutar görünür. Kullanım başına iki sarftan da 0,5 birim tüketilir. Yarım kalan kullanım para vermez; kullanım ücreti ürün satışı sayacını artırmaz.

Oyuncu kabinin önünden sarf doldurabilir ve temizleyebilir. Son küçük kir kalıntısı sıfırlanır; temizlik ödülü yalnız tamamlandığında bir kez verilir.

## Kontroller

- `npm test`: mevcut testler.
- `npm run test:restroom`: iki şubenin bütün açılım aşamalarında yerleşim; gerçek masa bitirme akışı; iki müşteri modeliyle klozete yürüyüş, kıyafet ve oturak hizası; paket ürünlerin korunması; kullanım ücreti, sarf tüketimi, iptal, oyuncu doldurma/temizlik ve tek seferlik ödül kontrolleri.
- Masaüstü ve telefon görüntüleri ile sonuçlar `.devshots/restrooms/` altında. Bunlar tarayıcı kontrolleridir; fiziksel telefon ölçümü değildir.
