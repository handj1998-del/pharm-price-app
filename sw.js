// 앱 셸 캐시: HTML은 네트워크 우선(업데이트 반영), 같은 출처 정적 파일은 캐시 후 백그라운드 갱신. 외부(CDN/지도)는 건드리지 않음.
const CACHE='pharm-shell-v1';
const SHELL=['./','index.html','style.css','app.js','parse.js','store.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','favicon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
 if(r.method!=='GET'||u.origin!==location.origin)return;
 if(r.mode==='navigate'||r.destination==='document'){
  e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c));return res}).catch(()=>caches.match(r).then(m=>m||caches.match('./'))));return;}
 e.respondWith(caches.match(r).then(m=>{const net=fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c))}return res});return m||net}));
});
