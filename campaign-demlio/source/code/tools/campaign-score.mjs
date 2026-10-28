import {writeFile} from 'node:fs/promises';
/** Original procedural music and Foley. No third-party music samples. */
export async function createScore(events,path,duration,layer='music'){
 const sr=48000,N=Math.ceil(duration*sr),L=new Float32Array(N),R=new Float32Array(N);let seed=917;
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
 function sound(at,d,fn,amp=.1,pan=0){const start=Math.round(at*sr),n=Math.round(d*sr),gl=Math.sqrt((1-pan)/2),gr=Math.sqrt((1+pan)/2);for(let i=0;i<n;i++){const j=start+i;if(j<0||j>=N)continue;const t=i/sr,v=fn(t,i/n)*amp;L[j]+=v*gl;R[j]+=v*gr;}}
 const freq=n=>440*2**((n-69)/12);
 function key(at,m,amp=.1,pan=0,d=.7){const f=freq(m);sound(at,d,(t,p)=>Math.min(1,t/.006)*Math.min(1,(1-p)*15)*Math.exp(-t*5)*(Math.sin(2*Math.PI*f*t)+.22*Math.sin(4*Math.PI*f*t)*Math.exp(-t*5)),amp,pan);}
 const end=events.find(e=>e.kind==='cut'&&e.data.phase===7)?.time??duration-3.2;
 if(layer==='music'){
  const beat=60/112,chords=[[57,60,64,67],[53,57,60,64],[60,64,67,71],[55,59,62,67]];
  for(let b=0;b*beat<end;b++){
   const at=b*beat,ch=chords[Math.floor(b/8)%4];
   sound(at,.24,t=>Math.sin(2*Math.PI*(48*t+5*(1-Math.exp(-t*38))))*Math.exp(-t*24),.075);
   if(b%2) sound(at,.1,t=>noise()*Math.exp(-t*45),.025,.2);
   for(let h=0;h<2;h++)sound(at+h*beat/2,.055,t=>noise()*Math.exp(-t*100),.012,h?-.25:.25);
   key(at,ch[0]-12,.10,0,.8);key(at+.04,ch[(b+1)%4]+12,.04,-.25);key(at+beat*.52,ch[(b+2)%4]+12,.03,.25);
   if(b%4===0)for(let i=1;i<4;i++)key(at+i*.018,ch[i],.034,(i-2)*.22,1.1);
  }
  [60,64,67,72].forEach((n,i)=>key(end+i*.11,n,.065,(i-1.5)*.18,2.5));
 }else{
  let lastStep=-1,lastCoin=-1;
  for(const e of events){const id=e.data?.id;
   if(e.kind==='sfx'&&id==='step'&&e.time-lastStep>.18){sound(e.time,.06,t=>noise()*Math.exp(-t*75),.022);lastStep=e.time;}
   if(e.kind==='sfx'&&['pickup','drop','stock'].includes(id)){key(e.time,id==='pickup'?84:79,.12,-.1,.2);sound(e.time,.04,t=>noise()*Math.exp(-t*100),.04);}
   if(e.kind==='collected'&&e.time-lastCoin>.12){key(e.time,91,.13,.15,.45);key(e.time+.04,96,.09,-.1,.35);lastCoin=e.time;}
   if(e.kind==='served'){[84,88,91].forEach((n,i)=>key(e.time+i*.05,n,.09,(i-1)*.15,.38));}
   if(e.kind==='cleaned'){[79,84,88,91].forEach((n,i)=>key(e.time+i*.05,n,.10,(i-1.5)*.12,.5));}
   if(e.kind==='hired'){[72,79,84,88].forEach((n,i)=>key(e.time+i*.07,n,.11,(i-1.5)*.12,.7));}
   if(e.kind==='produced'&&e.data.stationId==='k_semaver'){sound(e.time,.18,(t,p)=>noise()*Math.sin(Math.PI*p)*.4,.03,-.2);}
   if(e.kind==='action'&&e.data.kind==='wipe'){
    const stop=events.find(x=>x.time>e.time&&x.kind==='action')?.time??e.time+1;
    sound(e.time,stop-e.time,(t,p)=>noise()*(.2+.8*Math.sin(t*14)**2)*Math.sin(Math.PI*p)**.35,.04,-.15);
   }
   if(e.kind==='cut'&&e.time>0)sound(e.time-.055,.16,(t,p)=>noise()*Math.sin(Math.PI*p)**2,.015);
  }
  // Opening contact is audible immediately; real pickup follows its hand event.
  sound(.006,.07,t=>noise()*Math.exp(-t*75),.03);
 }
 const delay=Math.round(sr*.147);for(let i=N-1;i>=delay;i--){L[i]+=R[i-delay]*.09;R[i]+=L[i-delay]*.08;}
 const pcm=Buffer.alloc(N*4);let peak=0;
 for(let i=0;i<N;i++){const fade=Math.min(1,i/(sr*.004),(N-i)/(sr*.30));const a=Math.tanh(L[i])*fade,b=Math.tanh(R[i])*fade;peak=Math.max(peak,Math.abs(a),Math.abs(b));pcm.writeInt16LE(Math.round(a*30000),i*4);pcm.writeInt16LE(Math.round(b*30000),i*4+2);}
 const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+pcm.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(sr,24);h.writeUInt32LE(sr*4,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);await writeFile(path,Buffer.concat([h,pcm]));return{layer,peak,sr,duration,original:true};
}
