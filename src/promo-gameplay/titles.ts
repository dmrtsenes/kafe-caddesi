/** Editing overlay only; every background pixel is the unmodified game renderer. */
interface FilmState {time:number;phase:number;badge:string;badgeAt:number;served:number;money:number;hired:boolean;}
const cream='#fff8ea',green='#173f35',gold='#ffda89';
const captions=[['Yoğun saat başladı!','Müşteriler seni bekliyor.'],['Temizle, misafir gelsin.','Her masa yeni bir başlangıç.'],
  ['Çaylar hazır!','Hazırla, tepsine al.'],['Sıra sende!','Sıcacık servis, mutlu müşteriler.'],
  ['Emek kazanca dönüşür.','Kasadakileri topla.'],['Birlikte daha fazlası.','İlk çalışanını işe al.'],
  ['İşler büyüyor!','Hazırlık artık ekibinde.']];
function round(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){c.beginPath();c.roundRect(x,y,w,h,r);}
export function composeGameplayFrame(c:CanvasRenderingContext2D,canvas:HTMLCanvasElement,s:FilmState){
  c.globalAlpha=1;c.drawImage(canvas,0,0,1080,1920);
  const top=c.createLinearGradient(0,0,0,430);top.addColorStop(0,'rgba(18,46,37,.82)');top.addColorStop(1,'rgba(18,46,37,0)');
  c.fillStyle=top;c.fillRect(0,0,1080,430);
  c.textAlign='center';c.textBaseline='middle';
  if(s.phase<7){
    c.font="600 28px 'Segoe UI',sans-serif";c.fillStyle=gold;c.fillText('KAFE CADDESİ',540,91);
    c.font="750 65px 'Segoe UI',sans-serif";c.fillStyle=cream;c.fillText(captions[s.phase][0],540,177);
    c.font="500 32px 'Segoe UI',sans-serif";c.fillStyle=cream;c.fillText(captions[s.phase][1],540,247);
    const age=s.time-s.badgeAt;
    if(age>=0&&age<1.5){
      c.globalAlpha=Math.min(1,age/.12,(1.5-age)/.2);c.font="700 40px 'Segoe UI',sans-serif";
      const w=c.measureText(s.badge).width+86;
      c.fillStyle=green;round(c,540-w/2,1475,w,88,44);c.fill();c.fillStyle=gold;c.fillText(s.badge,540,1519);c.globalAlpha=1;
    }
  }else{
    const a=Math.min(1,(s.time-22)/.28);c.globalAlpha=a;
    c.fillStyle='rgba(19,52,41,.40)';c.fillRect(0,0,1080,1920);
    c.fillStyle=gold;c.font="600 28px 'Segoe UI',sans-serif";c.fillText('SOKAĞIN EN SICAK KAFESİ',540,144);
    c.fillStyle=cream;c.font="800 103px 'Segoe UI',sans-serif";c.fillText('KAFE',540,290);c.fillText('CADDESİ',540,407);
    c.fillStyle=gold;round(c,115,1515,850,132,66);c.fill();
    c.fillStyle=green;c.font="750 53px 'Segoe UI',sans-serif";c.fillText('Kendi kafeni yönet!',540,1581);
    c.fillStyle=cream;c.font="500 31px 'Segoe UI',sans-serif";c.fillText('Bir fincanla başla. Kafeni büyüt.',540,1710);
    c.globalAlpha=1;
  }
}
