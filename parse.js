// 영수증 OCR 결과 -> {pharmacy, date, items:[{name,qty,price,conf,low,orig}]}
(function(G){
const DICT=(typeof DRUG_DICT!=='undefined'?DRUG_DICT:(typeof require!=='undefined'?require('./drugdict.js').DRUG_DICT:[]));
// 한글 자모 분해 Levenshtein (OCR 오인식은 자모 단위로 일어나는 경우가 많음)
const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ',JUNG='ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ',JONG=' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
function jamo(s){const o=[];for(const ch of s){const c=ch.charCodeAt(0)-0xAC00;if(c>=0&&c<11172){o.push(CHO[c/588|0],JUNG[(c%588)/28|0]);if(c%28)o.push(JONG[c%28])}else o.push(ch.toLowerCase())}return o}
function lev(a,b){const m=a.length,n=b.length;let p=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i++){const q=[i];for(let j=1;j<=n;j++)q[j]=Math.min(p[j]+1,q[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=q}return p[n]}
const DJ=DICT.map(d=>({d,j:jamo(d)}));
const UNIT=/(\d+(?:\.\d+)?)\s*(mg|g|ml|mL|정|캡슐|포|매|개)$/i;
function normDose(name){// 단위 오인식 보정: 500rng/500mq/5000(=500mg) 등
 return name.replace(/(\d)\s*(?:rng|rnq|mq|nng|ng|m9|rn9)$/i,'$1mg').replace(/(\d)\s*(?:rnl|mi|m1)$/i,'$1ml').replace(/(\s\d{1,3})[9q]$/,'$1g').replace(/(\s\d{2})0$/,'$1g')}
function fuzzyName(raw){
 let name=normDose(raw).replace(/\s+/g,''),best=null;
 const cands=[name];const m=name.match(/^(.*?\D)(\d+)0$/);if(m)cands.push(m[1]+m[2]+'mg');// "5000" 끝 → "500mg" 가능성
 const u=name.match(UNIT);const base=u?name.slice(0,u.index):name;if(u&&base.length>=2)cands.push(base);
 for(const c of cands){const cj=jamo(c);for(const e of DJ){const d=lev(cj,e.j),r=d/Math.max(cj.length,e.j.length);
   if(d&&e.d.startsWith(c))continue;// 짧게 쓴 이름은 늘리지 않음
   if(!best||r<best.r)best={r,d,e:e.d,c}}}
 if(best&&best.d<=7&&(best.r<=0.25||best.r<=0.34&&best.c.length>=5)){let fixed=best.e;
  if(best.c===base&&u&&!UNIT.test(best.e))fixed=best.e+u[0];// 사전엔 용량 없음 → 원래 용량 유지
  return {name:fixed,orig:fixed!==raw.replace(/\s+/g,'')?raw:null}}
 return {name,orig:name!==raw.replace(/\s+/g,'')?raw:null}}
// 숫자처럼 보이는 토큰의 문자 오인식 보정
function fixNum(t){const s=t.replace(/원$/,'');if(!s)return t;
 if(!/^\/?[\dOo°DlIi|!SsBZ,.]+$/.test(s)||!/[\d,.]/.test(s)||!/\d/.test(s)&&!/[,.]\S{3}$/.test(s))return t;
 return s.replace(/[Oo°D]/g,'0').replace(/^\//,'7').replace(/[lI|i!]/g,'1').replace(/[Ss]/g,'5').replace(/B/g,'8').replace(/Z/g,'2')+(t.endsWith('원')?'원':'')}
const SKIP=/(합\s*계|총\s*액|금\s*액|결\s*제|카\s*드|현\s*금|부가|과세|면세|공급|받을|거스름|사업자|시업자|대표|전화|TEL|주소|승인|일시|영수증|품명|항\s*목|단\s*가|수\s*량|감사|할인|할부|조제|판매|거래|매입|번호|전표|매출|합|포인트|잔액|봉투|[번빈변반][호오모]|[압합힙함헙][계게개]|청구|비급여)/i;
const isNum=t=>/^[\d,.]+원?$/.test(t);
function parseReceipt(text,ocrLines,opts={}){
 // ocrLines: tesseract lines [{text,confidence,words:[{text,confidence}]}] (선택)
 let L=(ocrLines&&ocrLines.length?ocrLines.map(l=>({text:l.text,conf:l.confidence,words:(l.words||[]).map(w=>({t:w.text,c:w.confidence}))})):text.split(/\n/).map(t=>({text:t,conf:100,words:[]})));
 const clean=t=>t.replace(/([\d\/])\s*([,.])\s+(\d{3})(?!\d)/g,'$1$2$3').replace(/(^|\s)[|!\[\]{}()]+(?=\s|$)/g,' ').replace(/(\d)[!|]+(?=\s|$)/g,'$1').replace(/\s+/g,' ').trim();
 L=L.map(l=>({...l,text:clean(l.text)})).filter(l=>l.text);
 L.forEach(l=>l.toks=l.text.split(' ').map(fixNum));
 let pharmacy='',date='',items=[];
 for(const l of L){const t=l.text;
  if(!pharmacy){const t2=t.replace(/^.{0,4}[약악][국극]\s*명\s*[:;.]?/,'').replace(/약국\s*명/g,'');
   const m=t2.match(/([가-힣A-Za-z0-9]{1,15}\s?약국)/)||t2.match(/([가-힣]{2,12})\s?[악역익]\s?[국극곡]/);if(m)pharmacy=(m[1].endsWith('약국')?m[1]:m[1]+'약국').replace(/\s/g,'');}
  if(!date){const m=l.toks.join(' ').match(/(20\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/);if(m&&+m[2]<=12&&+m[3]<=31)date=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;}}
 for(let k=0;k<L.length;k++){const l=L[k];
  if(SKIP.test(l.text.replace(/\s/g,''))||/약국/.test(l.text)||/\d\s?-\s?\d/.test(l.text))continue;
  let toks=[...l.toks];const nums=[];
  while(toks.length&&isNum(toks.at(-1)))nums.unshift(toks.pop().replace(/[,.원]/g,''));
  // 이름만 있는 줄 + 다음 줄이 숫자만 → 합치기 (2줄 품목)
  if(!nums.length&&k+1<L.length&&L[k+1].toks.every(isNum)&&L[k+1].toks.length>=2){L[k+1].toks.forEach(t=>nums.push(t.replace(/[,.원]/g,'')));k++;}
  if(!nums.length)continue;
  if(nums.length>=2&&/^\d{5}$/.test(nums.at(-1))&&/^\d{2}$/.test(nums.at(-2))&&(/\d{3}$/.test(toks.join(''))||/^\d{3}$/.test(nums.at(-3)||'')))continue;// 사업자번호
  while(nums.length>3||(nums.length===3&&+nums[0]>=100)){toks.push(nums.shift())}// 용량 숫자 등은 이름으로
  let name=toks.join(' ').replace(/[|*#:;'"`~_=<>\[\]{}()]/g,'').replace(/^[^가-힣A-Za-z]+/,'').replace(/[\sㄱ-ㅣ』」』\]|!.,、]+$/,'').trim();
  if(!/[가-힣]{2}|[A-Za-z]{3}/.test(name))continue;
  let price=+nums.at(-1),qty=1;
  if(nums.length>=3){qty=+nums[nums.length-3];const u=+nums[nums.length-2];if(u&&qty&&u*qty!==price&&price%u===0&&price/u<100)qty=price/u;}
  else if(nums.length===2){const u=nums[0],a=nums.at(-1);
   if(u.length>a.length&&u.endsWith(a)&&+u.slice(0,-a.length)<100)qty=+u.slice(0,-a.length);
   else if(+u>0&&+u<100&&+a>=100)qty=+u; // "수량 금액"
   else if(+u>0&&price%+u===0&&price/+u<100){qty=price/+u;
    if(name.endsWith(String(qty))&&/\d$/.test(name.slice(0,-String(qty).length)))name=name.slice(0,-String(qty).length);}}
  if(!(qty>0&&qty<100))qty=1;
  if(name.length<2||price<100||price>1000000||price%10)continue;
  if(/^[가카키][드느]$|^[가카키][드느][:;]?$/.test(name))continue;
  const f=opts.dict===false?{name:name.replace(/\s+/g,''),orig:null}:fuzzyName(name);
  const low=l.words.filter(w=>w.c<65&&w.t.trim()).map(w=>w.t);
  items.push({name:f.name,qty,price,orig:f.orig,conf:Math.round(l.conf),low});
 }
 // 합계 줄이 품목으로 잡힌 경우 제거: 가격이 나머지 품목 합과 같으면 삭제
 if(items.length>=3){const tot=items.reduce((a,i)=>a+i.price,0);items=items.filter(i=>i.price*2!==tot)}
 // 이전에 저장한 약국명과 비슷하면 보정
 if(pharmacy&&opts.knownPharmacies&&opts.knownPharmacies.length){const pj=jamo(pharmacy);let b=null;
  for(const k of opts.knownPharmacies){const d=lev(pj,jamo(k)),r=d/Math.max(pj.length,jamo(k).length);if(!b||r<b.r)b={r,k}}
  if(b&&b.r>0&&b.r<=0.2)pharmacy=b.k}
 return {pharmacy,date,items};}
G.parseReceipt=parseReceipt;G.fuzzyName=fuzzyName;
if(typeof module!=='undefined')module.exports={parseReceipt,fuzzyName};
})(typeof window!=='undefined'?window:globalThis);
