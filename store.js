// 정적 버전 저장소: 서버 대신 브라우저 localStorage 사용 (이 기기에만 저장됨)
(function(){
const KEY='pharm-price-app:v1';
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
// 예시 데이터: 가상의 약국/가격. 실제 가격이 아님.
function SAMPLE(){const P=[
 {name:'[예시] 하늘약국',address:'서울 강남구 (예시 주소)',lat:37.4979,lng:127.0276},
 {name:'[예시] 바다약국',address:'서울 강남구 (예시 주소)',lat:37.5006,lng:127.0364},
 {name:'[예시] 숲속약국',address:'서울 서초구 (예시 주소)',lat:37.4916,lng:127.0079}];
 const rows=[[0,'2026-10-01',[['타이레놀정500mg',1,3000],['베아제정',1,4000]]],
  [1,'2026-10-05',[['타이레놀정500mg',1,2500],['판콜에이내복액',1,3500]]],
  [2,'2026-10-08',[['타이레놀정500mg',1,3200],['베아제정',1,3600],['판콜에이내복액',1,3000]]]];
 return rows.map(([p,d,it])=>({id:uid(),sample:true,pharmacy:P[p],date:d,items:it.map(([name,qty,price])=>({name,qty,price}))}));}
const save=d=>localStorage.setItem(KEY,JSON.stringify(d));
function load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&Array.isArray(d.purchases))return d}catch{}const d={purchases:SAMPLE()};save(d);return d;}
const num=v=>v===''||v==null||isNaN(+v)?null:+v;
window.localApi=async function(u,o={}){const m=(o.method||'GET').toUpperCase(),d=load();let r;
 if(u==='/api/purchases'&&m==='GET')return d.purchases;
 if(u==='/api/purchases'&&m==='POST'){const b=JSON.parse(o.body);
  if(!b.pharmacy?.name?.trim())throw new Error('약국명이 필요합니다');
  const items=(b.items||[]).map(i=>({name:String(i.name).trim(),qty:+i.qty||1,price:Math.round(+i.price)})).filter(i=>i.name&&i.price>0);
  if(!items.length)throw new Error('유효한 품목이 없습니다');
  r={id:uid(),sample:false,pharmacy:{name:b.pharmacy.name.trim(),address:b.pharmacy.address||'',lat:num(b.pharmacy.lat),lng:num(b.pharmacy.lng)},date:b.date||new Date().toISOString().slice(0,10),items};
  d.purchases.push(r);save(d);return r;}
 if((r=u.match(/^\/api\/purchases\/(.+)$/))&&m==='DELETE'){d.purchases=d.purchases.filter(x=>x.id!==r[1]);save(d);return{ok:true};}
 if(u==='/api/sample'){d.purchases=d.purchases.filter(x=>!x.sample);if(m==='POST')d.purchases=d.purchases.concat(SAMPLE());save(d);return{ok:true};}
 if(u==='/api/fixes'&&m==='GET')return d.pharmacyFixes||{};
 if(u==='/api/fixes'&&m==='POST'){const b=JSON.parse(o.body);if(b.from&&b.to&&b.from!==b.to){d.pharmacyFixes={...(d.pharmacyFixes||{}),[b.from]:b.to};save(d)}return{ok:true};}
 if(u==='/api/backup'&&m==='GET')return {app:'약값비교',version:1,exportedAt:new Date().toISOString(),purchases:d.purchases,pharmacyFixes:d.pharmacyFixes||{}};
 if(u==='/api/backup'&&m==='POST'){const {backup:b,mode}=JSON.parse(o.body);const v=validateBackup(b);
  const key=p=>JSON.stringify([p.pharmacy.name,p.date,p.items.map(i=>[i.name,i.qty,i.price])]);
  let base=mode==='replace'?[]:d.purchases.slice();const ids=new Set(base.map(p=>p.id)),keys=new Set(base.map(key));let added=0,dup=0;
  for(const p of v.purchases){if(ids.has(p.id)||keys.has(key(p))){dup++;continue}base.push(p);ids.add(p.id);keys.add(key(p));added++}
  d.purchases=base;d.pharmacyFixes=mode==='replace'?v.pharmacyFixes:{...(d.pharmacyFixes||{}),...v.pharmacyFixes};save(d);
  return {added,dup,skipped:v.skipped,total:base.length,fixes:Object.keys(v.pharmacyFixes).length};}
 throw new Error('unknown '+m+' '+u);};
function validateBackup(b){
 if(!b||typeof b!=='object'||b.app!=='약값비교'||!Array.isArray(b.purchases))throw new Error('약값비교 백업 파일이 아니에요. 「백업 내보내기」로 만든 .json 파일을 골라 주세요.');
 if(typeof b.version!=='number'||b.version>1)throw new Error('이 앱보다 새 버전에서 만든 백업이에요. 앱을 새로고침한 뒤 다시 시도해 주세요.');
 let skipped=0;const purchases=[];
 for(const p of b.purchases){const name=p&&p.pharmacy&&String(p.pharmacy.name||'').trim();
  const items=Array.isArray(p&&p.items)?p.items.map(i=>({name:String(i&&i.name||'').trim(),qty:+(i&&i.qty)||1,price:Math.round(+(i&&i.price))})).filter(i=>i.name&&i.price>0):[];
  if(!name||!items.length||!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date||''))){skipped++;continue}
  purchases.push({id:String(p.id||uid()),sample:!!p.sample,pharmacy:{name,address:String(p.pharmacy.address||''),lat:num(p.pharmacy.lat),lng:num(p.pharmacy.lng)},date:p.date,items})}
 const pharmacyFixes={};if(b.pharmacyFixes&&typeof b.pharmacyFixes==='object')for(const[k,v]of Object.entries(b.pharmacyFixes))if(typeof v==='string'&&v.trim())pharmacyFixes[k]=v.trim();
 return {purchases,pharmacyFixes,skipped};}
})();
