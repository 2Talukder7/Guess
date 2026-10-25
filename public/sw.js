/* Guess service worker: makes the game installable and playable offline.
   Stale-while-revalidate: serves the cached copy instantly and refreshes it in the background. */
const K='guess-v3',A=['./','index.html','css/style.css','js/game.js','data/words.js','assets/bg-night.jpg','assets/bg-day.jpg','manifest.webmanifest','extra-words.txt','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(K).then(c=>c.addAll(A)));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==K).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
e.respondWith(caches.open(K).then(c=>c.match(e.request).then(r=>{const n=fetch(e.request).then(x=>{if(x.ok)c.put(e.request,x.clone());return x}).catch(()=>r);return r||n})))});
