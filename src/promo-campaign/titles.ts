/** Only the editorial layer. The full-bleed background is the shipped game. */
export interface FilmState {time:number;phase:number;phaseAt:number;badge:string;badgeAt:number;served:number;money:number;hired:boolean;}
export const PALETTE={ink:'#123b39',teal:'#157f73',cream:'#fff3d8',gold:'#ffce78',copper:'#cb7849'};
const titles:Record<number,string[]>={0:['Şu masaya bak.','Yeni misafire yer aç.'],8:['Topla. Ferahla.','Sonra küçük bir dokunuş.'],1:['Pırıl pırıl.','Yeni bir başlangıç.'],2:['Sıcak bir başlangıç.','Çayını hazırla.'],3:['Bir servis daha.','Küçük işler, büyüyen kafe.'],4:['Emeğinin karşılığı.','Kasadaki kazancı topla.'],5:['Artık bir ekipsiniz.','Kazancını işine yatır.'],6:['İşler yoluna giriyor.','Rafları ekibin doldursun.']};
export function composeGameplayFrame(c:CanvasRenderingContext2D,canvas:HTMLCanvasElement,s:FilmState){
 c.globalAlpha=1;c.drawImage(canvas,0,0,1080,1920);c.textAlign='center';c.textBaseline='middle';
 const top=c.createLinearGradient(0,0,0,410);top.addColorStop(0,'rgba(18,59,57,.95)');top.addColorStop(1,'rgba(18,59,57,0)');c.fillStyle=top;c.fillRect(0,0,1080,410);
 const bottom=c.createLinearGradient(0,1570,0,1920);bottom.addColorStop(0,'rgba(18,59,57,0)');bottom.addColorStop(1,'rgba(18,59,57,.7)');c.fillStyle=bottom;c.fillRect(0,1570,1080,350);
 c.fillStyle=PALETTE.gold;c.font='30px Paytone';c.fillText('demlio',540,94);
 if(s.phase!==7){
  c.fillStyle=PALETTE.cream;c.font='57px Paytone';c.fillText(titles[s.phase][0],540,201);
  c.font='700 36px Barlow';c.fillText(titles[s.phase][1],540,280);
  const age=s.time-s.badgeAt;
  if(age>=0&&age<.85){c.globalAlpha=Math.min(1,age/.06,(.85-age)/.15);c.font='700 39px Barlow';const w=c.measureText(s.badge).width+66;c.fillStyle=PALETTE.ink;c.beginPath();c.roundRect(540-w/2,1470,w,77,38);c.fill();c.fillStyle=PALETTE.gold;c.fillText(s.badge,540,1508);c.globalAlpha=1;}
  const labels=['TEMİZLE','HAZIRLA','SERVİS','KAZAN','EKİP'];c.font='700 25px Barlow';
  labels.forEach((label,i)=>{c.fillStyle=i<Math.min(s.phase===8||s.phase===0?1:s.phase,5)?PALETTE.gold:'rgba(255,243,216,.45)';c.fillText(label,170+i*185,1750);c.fillRect(91+i*185,1790,158,5);});
 }else{
  c.fillStyle='rgba(18,59,57,.48)';c.fillRect(0,0,1080,1920);
  c.fillStyle=PALETTE.cream;c.font='132px Paytone';c.fillText('demlio',540,373);
  c.strokeStyle=PALETTE.gold;c.lineWidth=12;c.lineCap='round';c.beginPath();c.moveTo(288,472);c.quadraticCurveTo(540,526,792,472);c.stroke();
  c.fillStyle=PALETTE.gold;c.font='700 44px Barlow';c.fillText('KÜÇÜK BİR MASADAN KENDİ KAFENE',540,569);
  c.fillStyle=PALETTE.cream;c.font='700 55px Barlow';c.fillText('Kafenin hikâyesini yaz.',540,1480);
  c.fillStyle=PALETTE.gold;c.beginPath();c.roundRect(290,1575,500,110,55);c.fill();c.fillStyle=PALETTE.ink;c.font='700 48px Barlow';c.fillText('Gelişmeleri takip et',540,1630);
 }
}
