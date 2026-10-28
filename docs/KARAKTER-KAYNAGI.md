# Kullanılan karakter dosyalarının kaynağı

10 Eylül 2026: Kullanıcının ekranda seçtiği karakter ailesi web ve Android için ortak yola taşındı: `public/packs/current-cast`.

`PlayerS01.fbx`, `CustomerMan.glb`, `CustomerWoman.glb` ve `ColorPalette01.png`, projenin mevcut karakter ailesi olarak yapılandırılmıştır. Dosya adları ve kopyalanan modeller eşleşir.

Kullanıcı ortak karakterlerin kurulabilir pakete dahil edilmesini istedi. Modeller ve iskelet animasyonları `CafeCharacters.ts` ve `CafeCustomers.ts` adaptörleri üzerinden yürütülür.

Ortak paketteki `manifest.json` dosyaların SHA-256 özetlerini taşır. Derleme kontrolü dosyaların eksik veya değişmiş olması halinde durur. Karakter seçimi artık geliştirme/üretim koşuluna veya URL seçeneğine bağlı değildir.
