/** Editorial graphics only; gameplay is rendered unchanged by the shipped World. */
export interface FilmState {time:number;phase:number;phaseAt:number;badge:string;badgeAt:number;served:number;money:number;hired:boolean;}
export const PALETTE={ink:'#103D40',deep:'#082D32',teal:'#128D80',mint:'#9FE9C5',cream:'#FFF3D7',gold:'#FFC44A'};
const logo=new Image();
logo.src='/store-assets/global-v2/final/tr/logo-transparent.png';
export const assetsReady=logo.decode();
const titles:Record<number,string[]>={2:['BİR ÇAYLA','BAŞLAR.'],3:['MASALAR','CANLANIR.'],0:['YENİ MİSAFİRE','YER AÇ.'],8:['YENİ MİSAFİRE','YER AÇ.'],1:['YENİ MİSAFİRE','YER AÇ.'],4:['EMEĞİN','KAZANCA DÖNÜŞÜR.'],5:['ŞİMDİ BİR','EKİPSİNİZ.'],6:['ŞİMDİ BİR','EKİPSİNİZ.']};
const ease=(x:number)=>1-(1-Math.max(0,Math.min(1,x)))**3;
export function composeGameplayFrame(c:CanvasRenderingContext2D,canvas:HTMLCanvasElement,s:FilmState){
 c.globalAlpha=1;c.drawImage(canvas,0,0,1080,1920);c.textAlign='left';c.textBaseline='alphabetic';
 const top=c.createLinearGradient(0,0,0,525);top.addColorStop(0,'rgba(8,45,50,.96)');top.addColorStop(.55,'rgba(8,45,50,.69)');top.addColorStop(1,'rgba(8,45,50,0)');c.fillStyle=top;c.fillRect(0,0,1080,525);
 const bottom=c.createLinearGradient(0,1480,0,1920);bottom.addColorStop(0,'rgba(8,45,50,0)');bottom.addColorStop(1,'rgba(8,45,50,.62)');c.fillStyle=bottom;c.fillRect(0,1480,1080,440);
 if(s.phase!==7){
  c.fillStyle=PALETTE.mint;c.font='700 29px Barlow';c.fillText('KAFE CADDESİ',82,103);
  c.fillStyle=PALETTE.gold;c.fillRect(82,129,55,5);
  const age=s.time-s.phaseAt;const entry=s.time<.3?1:ease(age/.22);
  c.save();c.translate(0,12*(1-entry));c.globalAlpha=.7+.3*entry;
  for(let i=0;i<2;i++){const text=titles[s.phase][i];let size=80;c.font=`${size}px Paytone`;while(c.measureText(text).width>910)c.font=`${--size}px Paytone`;c.fillStyle=i===0?PALETTE.cream:PALETTE.gold;c.fillText(text,78,235+i*100);}
  c.restore();
  const badgeAge=s.time-s.badgeAt;
  if(badgeAge>=0&&badgeAge<.85&&s.phase!==3){c.globalAlpha=Math.min(1,badgeAge/.06,(.85-badgeAge)/.15);c.font='700 42px Barlow';const w=c.measureText(s.badge).width+66;c.fillStyle=PALETTE.deep;c.beginPath();c.roundRect(540-w/2,1410,w,76,38);c.fill();c.textAlign='center';c.fillStyle=PALETTE.gold;c.fillText(s.badge,540,1462);c.globalAlpha=1;}
 }else{
  c.fillStyle='rgba(8,45,50,.48)';c.fillRect(0,0,1080,1920);
  const a=ease((s.time-s.phaseAt)/.24);c.save();c.translate(540,430);c.scale(.97+.03*a,.97+.03*a);c.drawImage(logo,-415,-235,830,470);c.restore();
  c.textAlign='center';c.fillStyle=PALETTE.cream;c.font='700 50px Barlow';c.fillText('KÜÇÜK BAŞLA. BİRLİKTE BÜYÜT.',540,770);
  c.fillStyle=PALETTE.gold;c.beginPath();c.roundRect(244,1515,592,108,54);c.fill();c.fillStyle=PALETTE.deep;c.font='700 44px Barlow';c.fillText('Gelişmeleri takip et',540,1584);
 }
}
