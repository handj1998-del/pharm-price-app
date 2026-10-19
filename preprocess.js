// 영수증 이미지 전처리 (브라우저 canvas). EXIF 회전 → 자르기 → 영수증 영역 자동 검출 → 크기 맞춤 →
// 흑백 → 그림자(조명) 보정 → 대비 정규화 → (선택) 이진화 → 기울기 보정
const Preproc=(()=>{
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c};
async function loadBitmap(file){
 try{return await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){}
 const url=URL.createObjectURL(file);const img=new Image();img.src=url;await img.decode();URL.revokeObjectURL(url);return img;}
function toGray(ctx,w,h){const d=ctx.getImageData(0,0,w,h).data,g=new Float32Array(w*h);
 for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=0.299*d[j]+0.587*d[j+1]+0.114*d[j+2];return g}
function grayToCanvas(g,w,h){const c=mk(w,h),x=c.getContext('2d'),im=x.createImageData(w,h),d=im.data;
 for(let i=0,j=0;i<g.length;i++,j+=4){const v=g[i]<0?0:g[i]>255?255:g[i];d[j]=d[j+1]=d[j+2]=v;d[j+3]=255}x.putImageData(im,0,0);return c}
function otsu(g,step=1){const h=new Float64Array(256);let n=0;for(let i=0;i<g.length;i+=step){h[Math.max(0,Math.min(255,g[i]|0))]++;n++}
 let sum=0;for(let i=0;i<256;i++)sum+=i*h[i];let sB=0,wB=0,best=0,t=127;
 for(let i=0;i<256;i++){wB+=h[i];if(!wB)continue;const wF=n-wB;if(!wF)break;sB+=i*h[i];const mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)**2;if(v>best){best=v;t=i}}return t}
function boxBlur(a,w,h,r){// 분리형 박스 블러
 const t=new Float32Array(a.length),o=new Float32Array(a.length);
 for(let y=0;y<h;y++){let s=0,row=y*w;for(let x=-r;x<=r;x++)s+=a[row+Math.min(w-1,Math.max(0,x))];
  for(let x=0;x<w;x++){t[row+x]=s/(2*r+1);s+=a[row+Math.min(w-1,x+r+1)]-a[row+Math.max(0,x-r)]}}
 for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[Math.min(h-1,Math.max(0,y))*w+x];
  for(let y=0;y<h;y++){o[y*w+x]=s/(2*r+1);s+=t[Math.min(h-1,y+r+1)*w+x]-t[Math.max(0,y-r)*w+x]}}return o}
function maxFilter(a,w,h,r){const t=new Float32Array(a.length),o=new Float32Array(a.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let m=0;for(let k=Math.max(0,x-r);k<=Math.min(w-1,x+r);k++)if(a[y*w+k]>m)m=a[y*w+k];t[y*w+x]=m}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let m=0;for(let k=Math.max(0,y-r);k<=Math.min(h-1,y+r);k++)if(t[k*w+x]>m)m=t[k*w+x];o[y*w+x]=m}return o}
// 영수증(종이) 영역 검출: 밝고 매끈한(국소 표준편차 작은) 픽셀 → 최대 연결영역 → 최소 면적 회전 사각형
function findPaper(g,w,h){
 const m=boxBlur(g,w,h,2),g2=new Float32Array(g.length);for(let i=0;i<g.length;i++)g2[i]=g[i]*g[i];
 const m2=boxBlur(g2,w,h,2),sd=new Float32Array(g.length);for(let i=0;i<g.length;i++)sd[i]=Math.sqrt(Math.max(0,m2[i]-m[i]*m[i]));
 const pct=(a,p)=>{const s=Float32Array.from(a).sort();return s[Math.min(s.length-1,Math.floor(s.length*p))]};
 const tsd=Math.max(6,pct(sd,0.5)),tb=0.55*pct(m,0.95);
 let mk0=new Float32Array(g.length);for(let i=0;i<g.length;i++)mk0[i]=sd[i]<tsd&&m[i]>tb?1:0;
 mk0=boxBlur(mk0,w,h,6);const M=new Uint8Array(g.length);for(let i=0;i<g.length;i++)M[i]=mk0[i]>0.45?1:0;
 // 최대 연결영역
 const lab=new Int32Array(g.length);let best=0,bestN=0,cur=0;const st=new Int32Array(g.length);
 for(let i=0;i<g.length;i++){if(!M[i]||lab[i])continue;cur++;let sp=0,n=0;st[sp++]=i;lab[i]=cur;
  while(sp){const p=st[--sp];n++;const x=p%w,y=(p/w)|0;
   for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&M[q]&&!lab[q]){lab[q]=cur;st[sp++]=q}}
  if(n>bestN){bestN=n;best=cur}}
 if(bestN<w*h*0.12)return null;
 // 행별 좌우 끝점 → 볼록 껍질
 const P=[];for(let y=0;y<h;y++){let l=-1,r=-1;for(let x=0;x<w;x++)if(lab[y*w+x]===best){if(l<0)l=x;r=x}if(l>=0){P.push([l,y],[r+1,y])}}
 P.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const lo=[],up=[];for(const p of P){while(lo.length>=2&&cr(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p)}
 for(let i=P.length-1;i>=0;i--){const p=P[i];while(up.length>=2&&cr(up.at(-2),up.at(-1),p)<=0)up.pop();up.push(p)}
 const H=lo.slice(0,-1).concat(up.slice(0,-1));
 // 회전 캘리퍼스: 껍질 각 변 방향 기준 최소 면적 사각형
 let bestR=null;for(let i=0;i<H.length;i++){const a=H[i],b=H[(i+1)%H.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!L)continue;
  const ux=(b[0]-a[0])/L,uy=(b[1]-a[1])/L;let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9;
  for(const p of H){const s=p[0]*ux+p[1]*uy,t=-p[0]*uy+p[1]*ux;a0=Math.min(a0,s);a1=Math.max(a1,s);b0=Math.min(b0,t);b1=Math.max(b1,t)}
  const ar=(a1-a0)*(b1-b0);if(!bestR||ar<bestR.ar)bestR={ar,ux,uy,a0,a1,b0,b1}}
 const R=bestR,pt=(s,t)=>[(s*R.ux-t*R.uy)/w,(s*R.uy+t*R.ux)/h];
 const quad=[pt(R.a0,R.b0),pt(R.a1,R.b0),pt(R.a1,R.b1),pt(R.a0,R.b1)];
 const frac=R.ar/(w*h);if(frac<0.12||frac>0.97)return null;return quad}
// 기울기 추정: 어두운 픽셀 좌표를 회전시켜 행 히스토그램 분산 최대화
function estimateSkew(bin,w,h,maxDeg=15){const pts=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(bin[y*w+x])pts.push(x-w/2,y-h/2);
 if(pts.length<200)return 0;const D=Math.ceil(Math.hypot(w,h))+2;
 const score=a=>{const r=a*Math.PI/180,s=Math.sin(r),c=Math.cos(r),hist=new Float32Array(D);
  for(let i=0;i<pts.length;i+=2){const yy=(pts[i+1]*c-pts[i]*s+D/2)|0;if(yy>=0&&yy<D)hist[yy]++}let v=0;for(const q of hist)v+=q*q;return v};
 let best=0,bs=-1;for(let a=-maxDeg;a<=maxDeg;a+=1){const v=score(a);if(v>bs){bs=v;best=a}}
 let b2=best;for(let a=best-1;a<=best+1;a+=0.2){const v=score(a);if(v>bs){bs=v;b2=a}}return b2}
async function run(src,o={}){
 o={targetW:1800,autoCrop:true,normalize:true,binarize:false,deskew:true,rotate:0,crop:null,...o};
 const bmp=src instanceof Blob?await loadBitmap(src):src;let W=bmp.width,H=bmp.height,info={};
 // 수동 회전(90도 단위)
 let base=mk(o.rotate%180?H:W,o.rotate%180?W:H);{const x=base.getContext('2d');x.translate(base.width/2,base.height/2);x.rotate(o.rotate*Math.PI/180);x.drawImage(bmp,-W/2,-H/2)}
 W=base.width;H=base.height;let crop=o.crop||{x:0,y:0,w:1,h:1};
 let quad=null;
 if(!o.crop&&o.autoCrop){const s=Math.min(1,400/Math.max(W,H)),sm=mk(W*s,H*s),sx=sm.getContext('2d');sx.drawImage(base,0,0,sm.width,sm.height);
  quad=findPaper(toGray(sx,sm.width,sm.height),sm.width,sm.height);
  if(quad){const xs=quad.map(p=>p[0]),ys=quad.map(p=>p[1]),pad=0.01,x0=Math.max(0,Math.min(...xs)-pad),y0=Math.max(0,Math.min(...ys)-pad),
   x1=Math.min(1,Math.max(...xs)+pad),y1=Math.min(1,Math.max(...ys)+pad);crop={x:x0,y:y0,w:x1-x0,h:y1-y0};info.autoCrop=crop;info.quad=quad}}
 const cw=crop.w*W,ch=crop.h*H,scale=Math.min(3,o.targetW/cw),w=Math.round(cw*scale),h=Math.round(ch*scale);
 const c=mk(w,h),ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(base,crop.x*W,crop.y*H,cw,ch,0,0,w,h);
 let g=toGray(ctx,w,h);
 if(o.normalize){// 배경(종이 밝기) 추정 → 나눗셈으로 그림자 제거
  const f=8,sw=Math.ceil(w/f),sh=Math.ceil(h/f),sm=mk(sw,sh),sx=sm.getContext('2d');sx.drawImage(grayToCanvas(g,w,h),0,0,sw,sh);
  let bg=toGray(sx,sw,sh);bg=boxBlur(maxFilter(bg,sw,sh,3),sw,sh,4);
  const bc=grayToCanvas(bg,sw,sh),big=mk(w,h),bx=big.getContext('2d');bx.imageSmoothingQuality='high';bx.drawImage(bc,0,0,w,h);const B=toGray(bx,w,h);
  for(let i=0;i<g.length;i++)g[i]=Math.min(255,g[i]/Math.max(30,B[i])*255);
  // 대비: 어두운 1% → 0, 밝은 쪽 → 255
  const hist=new Uint32Array(256);for(let i=0;i<g.length;i+=3)hist[g[i]|0]++;let n=0,lo=0,tot=Math.ceil(g.length/3);for(let i=0;i<256;i++){n+=hist[i];if(n>tot*0.01){lo=i;break}}
  const hi=Math.max(lo+40,235);for(let i=0;i<g.length;i++)g[i]=(g[i]-lo)*255/(hi-lo);}
 if(o.binarize){const t=otsu(g,3);for(let i=0;i<g.length;i++)g[i]=g[i]>t?255:0}
 let out=grayToCanvas(g,w,h);
 if(quad){const x=out.getContext('2d');x.fillStyle='#fff';x.beginPath();x.rect(0,0,w,h);
  quad.forEach((p,i)=>{const px=(p[0]-crop.x)/crop.w*w,py=(p[1]-crop.y)/crop.h*h;i?x.lineTo(px,py):x.moveTo(px,py)});x.closePath();x.fill('evenodd')}
 if(o.deskew){const s=Math.min(1,700/w),sw=Math.round(w*s),sh=Math.round(h*s),sm=mk(sw,sh),sx=sm.getContext('2d');sx.drawImage(out,0,0,sw,sh);
  const sg=toGray(sx,sw,sh),t=otsu(sg,1),bin=new Uint8Array(sw*sh);for(let i=0;i<sg.length;i++)bin[i]=sg[i]<t*0.85?1:0;
  const a=estimateSkew(bin,sw,sh);info.skew=a;
  if(Math.abs(a)>=0.4){const r=-a*Math.PI/180,nw=Math.ceil(Math.abs(w*Math.cos(r))+Math.abs(h*Math.sin(r))),nh=Math.ceil(Math.abs(w*Math.sin(r))+Math.abs(h*Math.cos(r)));
   const rc=mk(nw,nh),rx=rc.getContext('2d');rx.fillStyle='#fff';rx.fillRect(0,0,nw,nh);rx.translate(nw/2,nh/2);rx.rotate(r);rx.drawImage(out,-w/2,-h/2);out=rc}}
 info.w=out.width;info.h=out.height;return {canvas:out,info};}
return {run,loadBitmap};})();
