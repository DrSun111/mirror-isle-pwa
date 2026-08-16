export type ScenicKind = 'auth'|'meet'|'recommend'|'record'|'growth'|'world'|'mine'|'drift'|'bottle'

const cache = new Map<ScenicKind,string>()

type RGB = [number,number,number]

function rgb(c:RGB,a=1){return `rgba(${c[0]},${c[1]},${c[2]},${a})`}

function makeCanvas(width:number,height:number){
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d')
  if(!ctx) throw new Error('Canvas unavailable')
  return {canvas,ctx}
}

function verticalGradient(ctx:CanvasRenderingContext2D,w:number,h:number,top:RGB,bottom:RGB){
  const g=ctx.createLinearGradient(0,0,0,h)
  g.addColorStop(0,rgb(top));g.addColorStop(1,rgb(bottom))
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h)
}

function glow(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,color:RGB,alpha=.35){
  ctx.save();ctx.filter=`blur(${Math.max(18,Math.round(r*.18))}px)`
  const g=ctx.createRadialGradient(x,y,0,x,y,r)
  g.addColorStop(0,rgb(color,alpha));g.addColorStop(.55,rgb(color,alpha*.35));g.addColorStop(1,rgb(color,0))
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore()
}

function mountainLayer(ctx:CanvasRenderingContext2D,w:number,h:number,baseY:number,color:RGB,seed:number,amp:number){
  let s=seed>>>0
  const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}
  ctx.beginPath();ctx.moveTo(0,h)
  let x=-40;ctx.lineTo(x,baseY)
  while(x<w+80){x+=110+rnd()*180;ctx.lineTo(x,baseY-rnd()*amp)}
  ctx.lineTo(w,h);ctx.closePath();ctx.fillStyle=rgb(color);ctx.fill()
}

function tree(ctx:CanvasRenderingContext2D,x:number,base:number,height:number,color:RGB){
  ctx.fillStyle=rgb(color,.94);ctx.fillRect(x-5,base-height*.16,10,height*.18)
  for(let i=0;i<4;i++){
    const cy=base-height+i*height*.18;const spread=height*(.13+i*.025)
    ctx.beginPath();ctx.moveTo(x,cy-height*.08);ctx.lineTo(x-spread,cy+height*.17);ctx.lineTo(x+spread,cy+height*.17);ctx.closePath();ctx.fill()
  }
}

function roundedRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(r,w/2,h/2))}

function vignette(ctx:CanvasRenderingContext2D,w:number,h:number,alpha=.16){
  const g=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.18,w/2,h/2,Math.max(w,h)*.72)
  g.addColorStop(0,'rgba(20,24,22,0)');g.addColorStop(1,`rgba(20,24,22,${alpha})`)
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h)
}

function grain(ctx:CanvasRenderingContext2D,w:number,h:number,seed=1,count=2600){
  let s=seed>>>0;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}
  ctx.save();ctx.globalAlpha=.025
  for(let i=0;i<count;i++){const v=180+Math.floor(rnd()*75);ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(rnd()*w,rnd()*h,1+rnd()*1.5,1+rnd()*1.5)}
  ctx.restore()
}

function drawMeet(ctx:CanvasRenderingContext2D,w:number,h:number){
  verticalGradient(ctx,w,h,[241,248,246],[202,224,219]);glow(ctx,w*.78,h*.12,w*.34,[255,244,211],.5)
  mountainLayer(ctx,w,h,h*.46,[206,221,217],4,h*.16);mountainLayer(ctx,w,h,h*.53,[186,208,201],8,h*.14);mountainLayer(ctx,w,h,h*.60,[161,191,183],12,h*.12)
  ctx.fillStyle='rgba(198,221,216,.97)';ctx.fillRect(0,h*.61,w,h*.39)
  for(let y=h*.66;y<h*.93;y+=44){ctx.fillStyle='rgba(248,252,250,.38)';roundedRect(ctx,w*.05,y,w*.9,6,4);ctx.fill()}
  ctx.fillStyle='rgb(170,198,189)';ctx.beginPath();ctx.moveTo(0,h*.76);ctx.bezierCurveTo(w*.24,h*.68,w*.34,h*.78,w*.55,h*.73);ctx.bezierCurveTo(w*.76,h*.68,w*.85,h*.78,w,h*.72);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill()
  ;[.06,.11,.76,.81,.88,.93].forEach((p,i)=>tree(ctx,w*p,h*.74,h*(.19+(i%3)*.03),[82,119,105]))
  ctx.fillStyle='rgba(59,72,69,.94)';ctx.beginPath();ctx.arc(w*.47,h*.67,h*.022,0,Math.PI*2);ctx.fill();roundedRect(ctx,w*.448,h*.685,w*.045,h*.10,h*.015);ctx.fill()
  ctx.fillStyle='rgba(78,88,84,.92)';ctx.beginPath();ctx.arc(w*.515,h*.675,h*.019,0,Math.PI*2);ctx.fill();roundedRect(ctx,w*.497,h*.692,w*.039,h*.093,h*.014);ctx.fill();vignette(ctx,w,h,.08);grain(ctx,w,h,9)
}

function drawRecommend(ctx:CanvasRenderingContext2D,w:number,h:number){
  verticalGradient(ctx,w,h,[247,243,235],[221,231,225]);glow(ctx,w*.82,h*.15,w*.36,[255,234,195],.42)
  ctx.fillStyle='rgb(221,211,196)';roundedRect(ctx,w*.05,h*.12,w*.34,h*.68,28);ctx.fill();[.25,.40,.55,.70].forEach(y=>{ctx.fillStyle='rgb(199,187,170)';ctx.fillRect(w*.07,h*y,w*.30,14)})
  const cols=['#8da395','#b09a7c','#c58e76','#d8c6aa','#7a8981'];let x=w*.08;for(let i=0;i<42;i++){const row=i%4,bw=16+(i*17%20),bh=45+(i*23%55),yy=h*(.235+row*.15);ctx.fillStyle=cols[i%cols.length];roundedRect(ctx,x,yy-bh,bw,bh,4);ctx.fill();x+=bw+8;if(x>w*.36)x=w*.08}
  ctx.fillStyle='rgb(221,235,232)';roundedRect(ctx,w*.48,h*.07,w*.46,h*.58,34);ctx.fill();ctx.strokeStyle='rgba(247,250,248,.96)';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(w*.71,h*.08);ctx.lineTo(w*.71,h*.64);ctx.moveTo(w*.49,h*.36);ctx.lineTo(w*.93,h*.36);ctx.stroke()
  ctx.fillStyle='rgb(196,179,156)';ctx.beginPath();ctx.ellipse(w*.72,h*.75,w*.28,h*.11,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(84,91,88,.95)';ctx.beginPath();ctx.arc(w*.43,h*.43,h*.05,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(105,116,111,.95)';roundedRect(ctx,w*.39,h*.48,w*.11,h*.25,38);ctx.fill();ctx.fillStyle='rgb(248,246,239)';roundedRect(ctx,w*.65,h*.61,w*.10,h*.12,22);ctx.fill();vignette(ctx,w,h,.1);grain(ctx,w,h,7)
}

function drawRecord(ctx:CanvasRenderingContext2D,w:number,h:number){
  verticalGradient(ctx,w,h,[247,245,238],[222,232,226]);glow(ctx,w*.82,h*.17,w*.32,[255,239,203],.4)
  ctx.fillStyle='rgb(213,231,229)';roundedRect(ctx,w*.58,h*.07,w*.37,h*.55,30);ctx.fill();ctx.strokeStyle='rgba(248,249,246,.98)';ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(w*.765,h*.08);ctx.lineTo(w*.765,h*.61);ctx.moveTo(w*.59,h*.35);ctx.lineTo(w*.94,h*.35);ctx.stroke()
  ctx.fillStyle='rgb(201,185,160)';ctx.beginPath();ctx.moveTo(0,h*.62);ctx.lineTo(w,h*.57);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();ctx.fillStyle='rgb(254,250,241)';ctx.beginPath();ctx.moveTo(w*.24,h*.57);ctx.lineTo(w*.52,h*.56);ctx.lineTo(w*.55,h*.85);ctx.lineTo(w*.25,h*.86);ctx.closePath();ctx.fill();ctx.strokeStyle='rgb(216,207,194)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w*.395,h*.58);ctx.lineTo(w*.405,h*.84);ctx.stroke();ctx.strokeStyle='rgb(199,211,204)';ctx.lineWidth=3;[.65,.71,.77].forEach(p=>{ctx.beginPath();ctx.moveTo(w*.27,h*p);ctx.lineTo(w*.38,h*(p-.005));ctx.moveTo(w*.42,h*(p-.005));ctx.lineTo(w*.52,h*(p-.01));ctx.stroke()})
  ctx.fillStyle='rgb(104,133,123)';roundedRect(ctx,w*.49,h*.59,w*.018,h*.21,10);ctx.fill();ctx.fillStyle='rgb(249,247,240)';roundedRect(ctx,w*.67,h*.66,w*.10,h*.15,28);ctx.fill();ctx.fillStyle='rgb(196,181,158)';roundedRect(ctx,w*.07,h*.43,w*.10,h*.22,24);ctx.fill();ctx.fillStyle='rgba(112,153,132,.94)';[[.08,.40],[.14,.36],[.10,.31],[.18,.30],[.055,.34]].forEach(([px,py])=>{ctx.beginPath();ctx.ellipse(w*px,h*py,w*.055,h*.03,-.3,0,Math.PI*2);ctx.fill()});vignette(ctx,w,h,.08);grain(ctx,w,h,13)
}

function drawGrowth(ctx:CanvasRenderingContext2D,w:number,h:number){
  verticalGradient(ctx,w,h,[247,245,240],[222,232,224]);glow(ctx,w*.72,h*.13,w*.32,[255,235,197],.35)
  ;[.05,.28,.73].forEach((p,idx)=>{ctx.fillStyle='rgb(222,211,195)';roundedRect(ctx,w*p,h*.10,w*.19,h*.70,24);ctx.fill();[.23,.38,.53,.68].forEach(y=>{ctx.fillStyle='rgb(199,186,166)';ctx.fillRect(w*(p+.015),h*y,w*.16,12)});const cols=['#7f998a','#ad9577','#bc806f','#c9b794','#747f79'];let x=w*(p+.02);for(let i=0;i<28;i++){const row=i%4,bw=13+(i*11%18),bh=40+(i*19%42),yy=h*(.215+row*.15);ctx.fillStyle=cols[(i+idx)%cols.length];roundedRect(ctx,x,yy-bh,bw,bh,3);ctx.fill();x+=bw+6;if(x>w*(p+.17))x=w*(p+.02)}})
  ctx.fillStyle='rgb(177,194,181)';roundedRect(ctx,w*.42,h*.48,w*.20,h*.32,60);ctx.fill();ctx.fillStyle='rgba(78,87,83,.95)';ctx.beginPath();ctx.arc(w*.49,h*.35,h*.06,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(98,111,105,.95)';roundedRect(ctx,w*.45,h*.42,w*.13,h*.24,50);ctx.fill();ctx.fillStyle='rgb(249,244,230)';ctx.beginPath();ctx.moveTo(w*.47,h*.58);ctx.lineTo(w*.56,h*.56);ctx.lineTo(w*.60,h*.63);ctx.lineTo(w*.51,h*.66);ctx.closePath();ctx.fill();vignette(ctx,w,h,.1);grain(ctx,w,h,23)
}

function drawWorld(ctx:CanvasRenderingContext2D,w:number,h:number){
  verticalGradient(ctx,w,h,[62,84,92],[19,39,50]);glow(ctx,w*.77,h*.16,w*.16,[238,238,216],.55);ctx.fillStyle='rgba(241,239,217,.92)';ctx.beginPath();ctx.arc(w*.78,h*.17,h*.09,0,Math.PI*2);ctx.fill();mountainLayer(ctx,w,h,h*.58,[37,62,68],21,h*.18);ctx.fillStyle='rgb(29,59,53)';for(let x=20;x<w;x+=68)tree(ctx,x,h*.82,h*(.18+(x%5)*.012),[27,67,58]);ctx.fillStyle='rgba(105,123,111,.58)';ctx.beginPath();ctx.moveTo(w*.38,h);ctx.lineTo(w*.62,h);ctx.lineTo(w*.56,h*.76);ctx.lineTo(w*.47,h*.76);ctx.closePath();ctx.fill();[[.27,.44],[.35,.58],[.64,.48],[.74,.61],[.47,.36],[.83,.47]].forEach(([px,py])=>{glow(ctx,w*px,h*py,18,[232,244,195],.55);ctx.fillStyle='rgba(248,251,217,.9)';ctx.beginPath();ctx.arc(w*px,h*py,3,0,Math.PI*2);ctx.fill()});vignette(ctx,w,h,.18);grain(ctx,w,h,19)
}

function drawMine(ctx:CanvasRenderingContext2D,w:number,h:number){
  verticalGradient(ctx,w,h,[249,245,238],[226,236,230]);glow(ctx,w*.78,h*.10,w*.34,[255,233,192],.4);ctx.fillStyle='rgb(239,234,223)';roundedRect(ctx,w*.11,h*.15,w*.24,h*.37,28);ctx.fill();ctx.fillStyle='rgb(210,224,216)';ctx.fillRect(w*.145,h*.20,w*.17,h*.27);ctx.fillStyle='rgb(199,212,202)';roundedRect(ctx,w*.34,h*.51,w*.44,h*.29,70);ctx.fill();ctx.fillStyle='rgb(211,221,214)';roundedRect(ctx,w*.38,h*.46,w*.18,h*.17,50);ctx.fill();ctx.fillStyle='rgb(195,178,151)';ctx.beginPath();ctx.ellipse(w*.82,h*.68,w*.10,h*.055,0,0,Math.PI*2);ctx.fill();ctx.fillRect(w*.817,h*.69,22,h*.19);ctx.fillStyle='rgb(195,177,152)';roundedRect(ctx,w*.055,h*.55,w*.11,h*.23,28);ctx.fill();ctx.fillStyle='rgba(117,155,132,.94)';[[.08,.52],[.15,.48],[.11,.43],[.05,.45],[.17,.40]].forEach(([px,py])=>{ctx.beginPath();ctx.ellipse(w*px,h*py,w*.055,h*.032,-.25,0,Math.PI*2);ctx.fill()});ctx.fillStyle='rgb(216,203,183)';ctx.fillRect(0,h*.80,w,h*.20);vignette(ctx,w,h,.08);grain(ctx,w,h,31)
}

function drawDrift(ctx:CanvasRenderingContext2D,w:number,h:number){
  verticalGradient(ctx,w,h,[218,239,239],[83,133,145]);glow(ctx,w*.77,h*.08,w*.33,[255,205,164],.5);ctx.fillStyle='rgb(104,151,148)';ctx.beginPath();ctx.moveTo(0,h*.59);ctx.bezierCurveTo(w*.18,h*.49,w*.27,h*.59,w*.43,h*.54);ctx.bezierCurveTo(w*.58,h*.49,w*.73,h*.61,w,h*.52);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();ctx.fillStyle='rgb(77,130,141)';ctx.fillRect(0,h*.63,w,h*.37);for(let y=h*.67;y<h*.94;y+=34){for(let x=-40+((y|0)%90);x<w;x+=220){ctx.fillStyle='rgba(219,240,238,.36)';roundedRect(ctx,x,y,120,5,3);ctx.fill()}}vignette(ctx,w,h,.12);grain(ctx,w,h,11)
}

function drawAuth(ctx:CanvasRenderingContext2D,w:number,h:number){
  verticalGradient(ctx,w,h,[249,246,239],[207,226,222]);glow(ctx,w*.73,h*.08,w*.34,[255,240,201],.52);mountainLayer(ctx,w,h,h*.43,[211,224,219],43,h*.15);mountainLayer(ctx,w,h,h*.50,[190,211,204],44,h*.14);mountainLayer(ctx,w,h,h*.57,[170,198,189],45,h*.12);ctx.fillStyle='rgb(197,219,214)';ctx.fillRect(0,h*.60,w,h*.40);for(let y=h*.65;y<h*.94;y+=54){ctx.fillStyle='rgba(245,250,247,.35)';roundedRect(ctx,w*.08,y,w*.84,6,3);ctx.fill()}ctx.fillStyle='rgb(171,200,191)';ctx.beginPath();ctx.moveTo(0,h*.74);ctx.bezierCurveTo(w*.22,h*.66,w*.34,h*.76,w*.52,h*.70);ctx.bezierCurveTo(w*.68,h*.66,w*.82,h*.78,w,h*.72);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(78,111,102,.88)';ctx.fillRect(w*.78,h*.55,10,h*.18);ctx.lineWidth=8;ctx.strokeStyle='rgba(78,111,102,.88)';ctx.beginPath();ctx.moveTo(w*.71,h*.60);ctx.lineTo(w*.78,h*.55);ctx.lineTo(w*.85,h*.60);ctx.stroke();ctx.strokeRect(w*.735,h*.60,w*.09,h*.10);vignette(ctx,w,h,.07);grain(ctx,w,h,37)
}

function drawBottle(ctx:CanvasRenderingContext2D,w:number,h:number){
  ctx.clearRect(0,0,w,h);ctx.save();ctx.shadowColor='rgba(45,77,79,.18)';ctx.shadowBlur=28;ctx.shadowOffsetY=12;ctx.fillStyle='rgba(232,247,245,.58)';ctx.strokeStyle='rgba(198,228,226,.95)';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(w*.38,h*.28);ctx.lineTo(w*.62,h*.28);ctx.lineTo(w*.65,h*.39);ctx.lineTo(w*.73,h*.47);ctx.lineTo(w*.70,h*.78);ctx.quadraticCurveTo(w*.68,h*.88,w*.58,h*.89);ctx.lineTo(w*.42,h*.89);ctx.quadraticCurveTo(w*.32,h*.88,w*.30,h*.78);ctx.lineTo(w*.27,h*.47);ctx.lineTo(w*.35,h*.39);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();ctx.fillStyle='rgb(172,190,176)';roundedRect(ctx,w*.41,h*.17,w*.18,h*.12,14);ctx.fill();ctx.fillStyle='rgb(207,226,216)';roundedRect(ctx,w*.43,h*.23,w*.14,h*.08,12);ctx.fill();ctx.fillStyle='rgba(250,243,218,.95)';ctx.beginPath();ctx.moveTo(w*.37,h*.55);ctx.lineTo(w*.64,h*.51);ctx.lineTo(w*.67,h*.67);ctx.lineTo(w*.40,h*.71);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(183,166,133,.55)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(w*.41,h*.59);ctx.lineTo(w*.61,h*.56);ctx.moveTo(w*.42,h*.64);ctx.lineTo(w*.59,h*.61);ctx.stroke()
}

function render(kind:ScenicKind){
  const isBottle=kind==='bottle';const width=isBottle?500:1600;const height=isBottle?500:kind==='auth'?1200:900
  const {canvas,ctx}=makeCanvas(width,height)
  if(kind==='meet')drawMeet(ctx,width,height);else if(kind==='recommend')drawRecommend(ctx,width,height);else if(kind==='record')drawRecord(ctx,width,height);else if(kind==='growth')drawGrowth(ctx,width,height);else if(kind==='world')drawWorld(ctx,width,height);else if(kind==='mine')drawMine(ctx,width,height);else if(kind==='drift')drawDrift(ctx,width,height);else if(kind==='auth')drawAuth(ctx,width,height);else drawBottle(ctx,width,height)
  const webp=canvas.toDataURL('image/webp',.88)
  return webp.startsWith('data:image/webp')?webp:canvas.toDataURL('image/png')
}

export function getScenicWebp(kind:ScenicKind){const existing=cache.get(kind);if(existing)return existing;const value=render(kind);cache.set(kind,value);return value}
