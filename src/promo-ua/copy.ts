export type AdLang = 'tr' | 'en';

export interface AdCopy {
  hook1: string; hook2: string; hygiene: string;
  clean: string; cleanBar: string; cleanDone: string;
  serve: string; combo: string;
  cash: string; upgrade: string; speed: string; tray: string; buy: string; level: string; levelUp: string;
  expand: string; unlocked: string; staff: string;
  before: string; after: string; grow: string;
  tagline: string; cta: string; stores: string;
  logo: string; googlePlay: string; appStore: string;
  locale: string;
}

const tr: AdCopy = {
  hook1: 'KAFEN BATIYOR!', hook2: 'KURTARABİLİR MİSİN?', hygiene: 'HİJYEN',
  clean: 'TEMİZLE!', cleanBar: 'TEMİZLİK', cleanDone: 'PIRIL PIRIL!',
  serve: 'SERVİS ET!', combo: 'KOMBO',
  cash: 'PARAYI TOPLA!', upgrade: 'GELİŞTİR!', speed: 'HIZ', tray: 'TEPSİ', buy: 'YÜKSELT', level: 'SV.', levelUp: 'SEVİYE ATLADI!',
  expand: 'YENİ SALON AÇ!', unlocked: 'AÇILDI!', staff: 'EKİBİNİ KUR!',
  before: 'ÖNCE', after: 'SONRA', grow: 'KAFENİ BÜYÜT!',
  tagline: 'SERVİS ET. KAZAN. BÜYÜT.', cta: 'ÜCRETSİZ OYNA', stores: "GOOGLE PLAY VE APP STORE'DA",
  logo: '/campaign-ua/brand/logo-tr.png', googlePlay: '/campaign-ua/brand/badges/googleplay-tr.png',
  appStore: '/campaign-ua/brand/badges/appstore-en.svg', locale: 'tr-TR',
};

const en: AdCopy = {
  hook1: 'YOUR CAFE IS FAILING!', hook2: 'CAN YOU SAVE IT?', hygiene: 'HYGIENE',
  clean: 'CLEAN IT UP!', cleanBar: 'CLEAN', cleanDone: 'SPOTLESS!',
  serve: 'SERVE FAST!', combo: 'COMBO',
  cash: 'COLLECT CASH!', upgrade: 'UPGRADE!', speed: 'SPEED', tray: 'TRAY', buy: 'UPGRADE', level: 'LV.', levelUp: 'LEVEL UP!',
  expand: 'OPEN A NEW ROOM!', unlocked: 'UNLOCKED!', staff: 'HIRE YOUR TEAM!',
  before: 'BEFORE', after: 'AFTER', grow: 'GROW YOUR CAFE!',
  tagline: 'SERVE. EARN. GROW.', cta: 'PLAY FREE', stores: 'ON GOOGLE PLAY & APP STORE',
  logo: '/campaign-ua/brand/logo-en.png', googlePlay: '/campaign-ua/brand/badges/googleplay-en.png',
  appStore: '/campaign-ua/brand/badges/appstore-en.svg', locale: 'en-US',
};

export const COPY: Record<AdLang, AdCopy> = { tr, en };
