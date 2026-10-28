import { tr } from "../core/I18n";
export type CustomerAngerReason =
  | 'no_counter'
  | 'no_menu'
  | 'counter_closed'
  | 'counter_queue'
  | 'counter_service'
  | 'no_shelf'
  | 'table_service'
  | 'pickup_stock'
  | 'partial_order'
  | 'dirty_table';

/** Oyuncuya yalnız sorunu değil, bir sonraki doğru işi de söyler. */
export const CUSTOMER_ANGER_COPY: Record<CustomerAngerReason, { message: string; action: string }> = {
  get no_counter() { return { message: tr("Açık kasa yoktu"), action: tr("Önce kasa bölümünü aç") }; },
  get no_menu() { return { message: tr("Menüde ürün yoktu"), action: tr("Bir üretim bölümü aç") }; },
  get counter_closed() { return { message: tr("Kasa kapandı"), action: tr("Açık kasayı kontrol et") }; },
  get counter_queue() { return { message: tr("Kasada çok bekledi"), action: tr("Kasaya geçip sırayı hızlandır") }; },
  get counter_service() { return { message: tr("Siparişi alınmadı"), action: tr("Kasaya geç veya kasiyer görevlendir") }; },
  get no_shelf() { return { message: tr("Ürün rafı yoktu"), action: tr("İlgili raf bölümünü aç") }; },
  get table_service() { return { message: tr("Masaya sipariş gelmedi"), action: tr("Ürün ikonunu doğru masaya götür") }; },
  get pickup_stock() { return { message: tr("Raf boş kaldı"), action: tr("İstenen ürünü rafta hazırla") }; },
  get partial_order() { return { message: tr("Siparişi yarım kaldı"), action: tr("Balondaki kalan adedi tamamla") }; },
  get dirty_table() { return { message: tr("Temiz masa bulamadı"), action: tr("Masaları sil ve bulaşıkları topla") }; },
};
