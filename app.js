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
 const low=(it.conf!=null&&it.conf<70)||(it.low&&it.low.length)||it.orig;if(low)tr.classList.add('low');
 const hint=[it.orig?`자동 보정 (원문: ${it.orig})`:'',it.conf!=null&&it.conf<70?`신뢰도 ${it.conf}%`:'',it.low&&it.low.length?`불확실: ${it.low.join(' ')}`:''].filter(Boolean).join(' · ');
 tr.innerHTML=`<td><input class="n" value="${esc(it.name)}">${hint?`<div class="hint">${esc(hint)}</div>`:''}</td><td><input class="q" type="number" min="1" value="${esc(it.qty)}"></td><td><input class="p" type="number" min="0" value="${esc(it.price)}"></td><td><button type="button" class="del">✕</button></td>`;
 tr.querySelector('.del').onclick=()=>tr.remove();tr.querySelectorAll('input').forEach(i=>i.addEventListener('input',()=>tr.classList.remove('low'),{once:true}));$('#itemTbl tbody').appendChild(tr);}
function openReview(r,raw=''){const f=$('#review');f.hidden=false;$('#phName').value=r.pharmacy||'';$('#phDate').value=r.date||new Date().toISOString().slice(0,10);
 $('#phName').classList.toggle('low',!!raw&&!r.pharmacy);$('#phDate').classList.toggle('low',!!raw&&!r.date);
 $('#phAddr').value='';$('#phLat').value='';$('#phLng').value='';$('#itemTbl tbody').innerHTML='';
 (r.items.length?r.items:[{name:'',qty:1,price:''}]).forEach(addRow);$('#rawText').textContent=raw;
 $('#lowNote').hidden=!f.querySelector('tr.low,input.low');
 if(r.pharmacy)$('#phName').dispatchEvent(new Event('change'));f.scrollIntoView({behavior:'smooth'});}
$('#addItem').onclick=()=>addRow();
$('#manualBtn').onclick=()=>openReview({items:[]});
$('#geoBtn').onclick=()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{$('#phLat').value=p.coords.latitude.toFixed(6);$('#phLng').value=p.coords.longitude.toFixed(6)},()=>toast('위치를 가져올 수 없어요')):toast('위치 기능 미지원');
// 이전에 저장한 같은 약국 좌표 자동 채움
$('#phName').addEventListener('change',()=>{const p=data.find(x=>x.pharmacy.name===$('#phName').value.trim()&&x.pharmacy.lat!=null);
 if(p&&!$('#phLat').value){$('#phLat').value=p.pharmacy.lat;$('#phLng').value=p.pharmacy.lng;$('#phAddr').value=p.pharmacy.address||''}});
// 사진 선택 → 자르기 화면 → 인식
const scan={file:null,bmp:null,rot:0,sel:null};
function drawCrop(){const cv=$('#cropCv'),b=scan.bmp;if(!b)return;const r=scan.rot%180,W=r?b.height:b.width,H=r?b.width:b.height,s=Math.min(1,900/Math.max(W,H));
 cv.width=W*s;cv.height=H*s;const x=cv.getContext('2d');x.save();x.translate(cv.width/2,cv.height/2);x.rotate(scan.rot*Math.PI/180);x.drawImage(b,-b.width*s/2,-b.height*s/2,b.width*s,b.height*s);x.restore();
 if(scan.sel){const q=scan.sel;x.fillStyle='rgba(0,0,0,.45)';x.beginPath();x.rect(0,0,cv.width,cv.height);x.rect(q.x*cv.width,q.y*cv.height,q.w*cv.width,q.h*cv.height);x.fill('evenodd');
  x.strokeStyle='#1976d2';x.lineWidth=3;x.strokeRect(q.x*cv.width,q.y*cv.height,q.w*cv.width,q.h*cv.height)}}
(()=>{const cv=$('#cropCv');let st=null;const pos=e=>{const r=cv.getBoundingClientRect();return[Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))]};
 cv.addEventListener('pointerdown',e=>{st=pos(e);cv.setPointerCapture(e.pointerId)});
 cv.addEventListener('pointermove',e=>{if(!st)return;const p=pos(e);scan.sel={x:Math.min(st[0],p[0]),y:Math.min(st[1],p[1]),w:Math.abs(p[0]-st[0]),h:Math.abs(p[1]-st[1])};drawCrop()});
 cv.addEventListener('pointerup',()=>{st=null;if(scan.sel&&(scan.sel.w<0.1||scan.sel.h<0.1))scan.sel=null;drawCrop()});})();
$('#rotBtn').onclick=()=>{scan.rot=(scan.rot+90)%360;scan.sel=null;drawCrop()};
$('#resetCrop').onclick=()=>{scan.sel=null;drawCrop()};
$('#fileCam').onchange=e=>$('#file').onchange(e);
$('#file').onchange=async e=>{const f=e.target.files[0];if(!f)return;scan.file=f;scan.rot=0;scan.sel=null;$('#review').hidden=true;$('#procBox').hidden=true;
 OCR.getWorker().catch(()=>{});// 고르는 동안 OCR 엔진·한글 데이터 미리 받기
 try{scan.bmp=await Preproc.loadBitmap(f);$('#cropBox').hidden=false;drawCrop();$('#ocrStatus').textContent='';$('#cropBox').scrollIntoView({behavior:'smooth'})}
 catch(err){$('#ocrStatus').textContent='이미지를 열 수 없어요: '+err.message}};
$('#ocrBtn').onclick=async()=>{const st=$('#ocrStatus');$('#ocrBtn').disabled=true;st.textContent='이미지 보정 중… (처음엔 한글 인식 데이터를 받느라 시간이 걸려요)';
 try{const r=await OCR.recognize(scan.file,{rotate:scan.rot,crop:scan.sel,parse:{knownPharmacies:[...new Set(data.filter(p=>!p.sample).map(p=>p.pharmacy.name))]},
   onProgress:m=>{if(m.status==='recognizing text')st.textContent=`글자 인식 중… ${Math.round(m.progress*100)}%`;else if(/load/.test(m.status))st.textContent='인식 엔진 준비 중…'}});
  window.__lastOcr=r.text;$('#procImg').src=r.canvas.toDataURL('image/jpeg',0.7);$('#procBox').hidden=false;$('#cropBox').hidden=true;
  st.textContent=`인식 완료 (${(r.ms/1000).toFixed(1)}초): 품목 ${r.parsed.items.length}개 찾음`;window.__ocrPharm=r.parsed.pharmacy||'';const fx=await api('/api/fixes');if(fx[r.parsed.pharmacy])r.parsed.pharmacy=fx[r.parsed.pharmacy];openReview(r.parsed,r.text);}
 catch(err){st.textContent='인식 실패: '+err.message+' — 직접 입력해 주세요.';openReview({items:[]});}
 finally{$('#ocrBtn').disabled=false}};
$('#review').onsubmit=async e=>{e.preventDefault();
 if(window.__ocrPharm&&$('#phName').value.trim()&&window.__ocrPharm!==$('#phName').value.trim())api('/api/fixes',{method:'POST',body:JSON.stringify({from:window.__ocrPharm,to:$('#phName').value.trim()})});window.__ocrPharm='';
 const items=[...document.querySelectorAll('#itemTbl tbody tr')].map(tr=>({name:tr.querySelector('.n').value,qty:tr.querySelector('.q').value,price:tr.querySelector('.p').value})).filter(i=>i.name.trim()&&+i.price>0);
 if(!items.length)return toast('품목을 1개 이상 입력해 주세요');
 try{await api('/api/purchases',{method:'POST',body:JSON.stringify({pharmacy:{name:$('#phName').value,address:$('#phAddr').value,lat:$('#phLat').value,lng:$('#phLng').value},date:$('#phDate').value,items})});
  toast('저장했어요');$('#review').hidden=true;$('#procBox').hidden=true;$('#cropBox').hidden=true;$('#ocrStatus').textContent='';$('#file').value='';$('#fileCam').value='';await refresh();show('history');}
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

// 백업 내보내기/불러오기
$('#exportBtn').onclick=async()=>{try{const b=await api('/api/backup');const d=new Date(),ymd=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
 const name=`약값비교_백업_${ymd}.json`,blob=new Blob([JSON.stringify(b,null,1)],{type:'application/json'});
 const file=typeof File==='function'?new File([blob],name,{type:'application/json'}):null;
 if(file&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:name});toast(`영수증 ${b.purchases.length}건을 백업했어요`);return}catch(e){if(e.name==='AbortError')return}}
 const url=URL.createObjectURL(blob),el=document.createElement('a');el.href=url;el.download=name;document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 toast(`영수증 ${b.purchases.length}건을 백업 파일로 저장했어요`)}catch(e){toast('백업을 만들지 못했어요: '+e.message)}};
$('#importBtn').onclick=()=>$('#importFile').click();
$('#importFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
 try{if(f.size>20e6)throw new Error('파일이 너무 커요. 약값비교 백업 파일이 맞는지 확인해 주세요.');
  let b;try{b=JSON.parse(await f.text())}catch{throw new Error('파일을 읽을 수 없어요. 손상되었거나 JSON 형식이 아니에요.')}
  if(!b||b.app!=='약값비교'||!Array.isArray(b.purchases))throw new Error('약값비교 백업 파일이 아니에요. 「백업 내보내기」로 만든 .json 파일을 골라 주세요.');
  const cur=(await api('/api/purchases')).length;const choice=await importModal(b.purchases.length,cur);if(!choice)return;const replace=choice==='replace';
  const r=await api('/api/backup',{method:'POST',body:JSON.stringify({backup:b,mode:replace?'replace':'merge'})});
  await refresh();toast(`${replace?'바꾸기':'합치기'} 완료: ${r.added}건 추가${r.dup?`, 중복 ${r.dup}건 건너뜀`:''}${r.skipped?`, 잘못된 ${r.skipped}건 제외`:''} (총 ${r.total}건)`)}
 catch(err){toast(err.message)}};

function importModal(n,cur){return new Promise(res=>{const m=document.createElement('div');m.className='modal-bg';m.id='importModal';
 m.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="imTitle"><h3 id="imTitle">백업 불러오기</h3>
 <p>백업 파일 영수증 <b>${n}건</b> · 현재 저장된 영수증 <b>${cur}건</b></p>
 <button id="imMerge">합치기</button><div class="muted small">현재 기록에 더해요. 중복은 건너뛰어요.</div>
 <button id="imReplace" class="danger">바꾸기</button><div class="warn small">⚠️ 현재 기록 ${cur}건이 삭제되고 백업으로 바뀌어요.</div>
 <button id="imCancel" class="sub">취소</button></div>`;
 const done=v=>{m.remove();document.removeEventListener('keydown',esc);res(v)};const esc=e=>{if(e.key==='Escape')done(null)};
 document.addEventListener('keydown',esc);m.onclick=e=>{if(e.target===m)done(null)};
 document.body.appendChild(m);m.querySelector('#imMerge').onclick=()=>done('merge');m.querySelector('#imReplace').onclick=()=>done('replace');m.querySelector('#imCancel').onclick=()=>done(null);m.querySelector('#imMerge').focus();});}
