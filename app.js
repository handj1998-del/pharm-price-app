const $=s=>document.querySelector(s),won=n=>Math.round(n).toLocaleString('ko-KR')+'원';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=[],map,layer;
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(t._h);t._h=setTimeout(()=>t.style.display='none',2200)};
const api=(u,o)=>window.localApi(u,o);
async function refresh(){data=await api('/api/purchases');renderHistory();renderCompare();renderCheap();}
// 탭
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.tab));
function show(t){document.querySelectorAll('.tab').forEach(s=>s.hidden=s.id!=='tab-'+t);
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
 if(t==='cheap'){renderCheap();setTimeout(()=>map&&map.invalidateSize(),50);}}
// 품목 편집
function addRow(it={name:'',qty:1,price:''}){const tr=document.createElement('tr');
 tr.innerHTML=`<td><input class="n" value="${esc(it.name)}"></td><td><input class="q" type="number" min="1" value="${esc(it.qty)}"></td><td><input class="p" type="number" min="0" value="${esc(it.price)}"></td><td><button type="button" class="del">✕</button></td>`;
 tr.querySelector('.del').onclick=()=>tr.remove();$('#itemTbl tbody').appendChild(tr);}
function openReview(r,raw=''){const f=$('#review');f.hidden=false;$('#phName').value=r.pharmacy||'';$('#phDate').value=r.date||new Date().toISOString().slice(0,10);
 $('#phAddr').value='';$('#phLat').value='';$('#phLng').value='';$('#itemTbl tbody').innerHTML='';
 (r.items.length?r.items:[{name:'',qty:1,price:''}]).forEach(addRow);$('#rawText').textContent=raw;f.scrollIntoView({behavior:'smooth'});}
$('#addItem').onclick=()=>addRow();
$('#manualBtn').onclick=()=>openReview({items:[]});
$('#geoBtn').onclick=()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{$('#phLat').value=p.coords.latitude.toFixed(6);$('#phLng').value=p.coords.longitude.toFixed(6)},()=>toast('위치를 가져올 수 없어요')):toast('위치 기능 미지원');
// 이전에 저장한 같은 약국 좌표 자동 채움
$('#phName').addEventListener('change',()=>{const p=data.find(x=>x.pharmacy.name===$('#phName').value.trim()&&x.pharmacy.lat!=null);
 if(p&&!$('#phLat').value){$('#phLat').value=p.pharmacy.lat;$('#phLng').value=p.pharmacy.lng;$('#phAddr').value=p.pharmacy.address||''}});
$('#file').onchange=async e=>{const f=e.target.files[0];if(!f)return;$('#preview').src=URL.createObjectURL(f);
 const st=$('#ocrStatus');st.textContent='글자 인식 준비 중… (처음엔 한글 데이터 다운로드로 시간이 걸려요)';
 try{const {data:{text}}=await Tesseract.recognize(f,'kor+eng',{logger:m=>{if(m.status==='recognizing text')st.textContent=`글자 인식 중… ${Math.round(m.progress*100)}%`}});
  window.__lastOcr=text;const r=parseReceipt(text);st.textContent=`인식 완료: 품목 ${r.items.length}개 찾음`;openReview(r,text);}
 catch(err){st.textContent='인식 실패: '+err.message+' — 직접 입력해 주세요.';openReview({items:[]});}};
$('#review').onsubmit=async e=>{e.preventDefault();
 const items=[...document.querySelectorAll('#itemTbl tbody tr')].map(tr=>({name:tr.querySelector('.n').value,qty:tr.querySelector('.q').value,price:tr.querySelector('.p').value})).filter(i=>i.name.trim()&&+i.price>0);
 if(!items.length)return toast('품목을 1개 이상 입력해 주세요');
 try{await api('/api/purchases',{method:'POST',body:JSON.stringify({pharmacy:{name:$('#phName').value,address:$('#phAddr').value,lat:$('#phLat').value,lng:$('#phLng').value},date:$('#phDate').value,items})});
  toast('저장했어요');$('#review').hidden=true;$('#preview').removeAttribute('src');$('#ocrStatus').textContent='';$('#file').value='';await refresh();show('history');}
 catch(err){toast(err.message)}};
// 구매 내역
function renderHistory(){const hasS=data.some(p=>p.sample);
 $('#sampleBar').innerHTML=hasS?`<div class="card muted">⚠️ <b>[예시]</b> 표시 항목은 화면 확인용 <b>예시 데이터</b>(가상의 약국·가격)이며 실제 가격이 아닙니다.<button class="sub" id="rmS">예시 데이터 모두 삭제</button></div>`:`<button class="sub" id="addS">예시 데이터 불러오기</button>`;
 const b=$('#rmS')||$('#addS');b.onclick=async()=>{await api('/api/sample',{method:hasS?'DELETE':'POST'});toast(hasS?'예시 데이터를 삭제했어요':'예시 데이터를 불러왔어요');refresh()};
 const list=[...data].sort((a,b)=>b.date.localeCompare(a.date)),total=data.filter(p=>!p.sample).reduce((s,p)=>s+p.items.reduce((a,i)=>a+i.price,0),0);
 $('#historyList').innerHTML=`<p class="muted">내 실제 지출 합계(예시 제외): <b>${won(total)}</b></p>`+(list.map(p=>`<div class="card"><h3>${esc(p.pharmacy.name)}${p.sample?'<span class="badge">예시 데이터</span>':''}<button class="del" data-id="${p.id}" style="float:right">삭제</button></h3>
  <div class="muted">${esc(p.date)} ${esc(p.pharmacy.address)}</div><ul>${p.items.map(i=>`<li>${esc(i.name)} ×${i.qty}<span class="price">${won(i.price)}</span></li>`).join('')}</ul>
  <div style="text-align:right">합계 <b>${won(p.items.reduce((a,i)=>a+i.price,0))}</b></div></div>`).join('')||'<p class="muted">아직 구매 내역이 없어요.</p>');
 document.querySelectorAll('#historyList .del').forEach(b=>b.onclick=async()=>{if(confirm('이 영수증을 삭제할까요?')){await api('/api/purchases/'+b.dataset.id,{method:'DELETE'});refresh()}});}
// 약별 집계: 약 이름 정규화 -> 약국별 최저 단가
const norm=s=>s.replace(/\s|\(.*?\)/g,'').toLowerCase();
function byMedicine(){const m={};for(const p of data)for(const i of p.items){const k=norm(i.name);m[k]??={name:i.name,ph:{}};
 const unit=i.price/(i.qty||1),key=p.pharmacy.name,cur=m[k].ph[key];
 if(!cur||unit<cur.unit||(unit===cur.unit&&p.date>cur.date))m[k].ph[key]={pharmacy:p.pharmacy,unit,date:p.date,sample:p.sample};}
 return Object.values(m).map(x=>({name:x.name,list:Object.values(x.ph).sort((a,b)=>a.unit-b.unit)})).sort((a,b)=>a.name.localeCompare(b.name,'ko'));}
function renderCompare(){const q=norm($('#search').value||'');const meds=byMedicine().filter(m=>norm(m.name).includes(q));
 $('#compareList').innerHTML=meds.map(m=>{const lo=m.list[0].unit,hi=m.list.at(-1).unit;
  return `<div class="card"><h3>${esc(m.name)}</h3><div class="muted">약국 ${m.list.length}곳 · 최저 ${won(lo)} · 최고 ${won(hi)}${m.list.length>1?` · 차이 ${won(hi-lo)}`:''}</div>
  <ol>${m.list.map((x,i)=>`<li class="${i===0?'best':''}">${esc(x.pharmacy.name)}${x.sample?'<span class="badge">예시</span>':''}<span class="price">${won(x.unit)}</span><div class="muted">${esc(x.date)} 기준 (1개 단가)</div></li>`).join('')}</ol></div>`}).join('')||'<p class="muted">비교할 데이터가 없어요.</p>';}
$('#search').oninput=renderCompare;
// 저렴한 약국
function renderCheap(){const meds=byMedicine(),sel=$('#cheapMed'),prev=sel.value;
 sel.innerHTML='<option value="">전체: 최저가 품목이 많은 약국 순</option>'+meds.map(m=>`<option ${norm(m.name)===prev?'selected':''} value="${esc(norm(m.name))}">${esc(m.name)}</option>`).join('');
 let rows;if(sel.value){const m=meds.find(x=>norm(x.name)===sel.value);rows=m.list.map((x,i)=>({...x,label:won(x.unit),rank:i+1}));}
 else{const c={};for(const m of meds){m.list.forEach((x,i)=>{c[x.pharmacy.name]??={...x,wins:0,cnt:0};c[x.pharmacy.name].cnt++;if(x.unit===m.list[0].unit)c[x.pharmacy.name].wins++;})}
  rows=Object.values(c).sort((a,b)=>b.wins-a.wins).map((x,i)=>({...x,label:`최저가 ${x.wins}/${x.cnt}개 품목`,rank:i+1}));}
 $('#cheapList').innerHTML=rows.map(x=>`<div class="card"><b>${x.rank}. ${esc(x.pharmacy.name)}</b>${x.sample?'<span class="badge">예시</span>':''}<span class="price">${esc(x.label)}</span><div class="muted">${esc(x.pharmacy.address)||'주소 미입력'}${x.pharmacy.lat==null?' · 좌표 없음':''}</div></div>`).join('')||'<p class="muted">데이터가 없어요.</p>';
 if(!window.L)return;if(!map){map=L.map('map').setView([37.4979,127.0276],13);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);layer=L.layerGroup().addTo(map);}
 layer.clearLayers();const pts=[];rows.filter(x=>x.pharmacy.lat!=null&&!isNaN(x.pharmacy.lat)).forEach(x=>{const ll=[x.pharmacy.lat,x.pharmacy.lng];pts.push(ll);
  L.marker(ll).bindPopup(`<b>${x.rank}. ${esc(x.pharmacy.name)}</b><br>${esc(x.label)}`).addTo(layer)});
 if(pts.length)map.fitBounds(pts,{padding:[30,30],maxZoom:15});}
$('#cheapMed').onchange=renderCheap;
refresh();
