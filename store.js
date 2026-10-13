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
 throw new Error('unknown '+m+' '+u);};
})();
