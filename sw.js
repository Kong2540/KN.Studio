/* KN-Studio service worker: เก็บไฟล์แอปไว้ในเครื่องเพื่อใช้งานออฟไลน์ */
const CACHE="kn-studio-v4";
const ASSETS=["./",
  "./css/app.css",
  "./css/fonts.css",
  "./fonts/ibm-plex-sans-thai-latin-400-normal.woff2",
  "./fonts/ibm-plex-sans-thai-latin-500-normal.woff2",
  "./fonts/ibm-plex-sans-thai-latin-600-normal.woff2",
  "./fonts/ibm-plex-sans-thai-thai-400-normal.woff2",
  "./fonts/ibm-plex-sans-thai-thai-500-normal.woff2",
  "./fonts/ibm-plex-sans-thai-thai-600-normal.woff2",
  "./fonts/sarabun-latin-400-normal.woff2",
  "./fonts/sarabun-latin-600-normal.woff2",
  "./fonts/sarabun-thai-400-normal.woff2",
  "./fonts/sarabun-thai-600-normal.woff2",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./index.html",
  "./js/app.js",
  "./js/beam.js",
  "./js/core.js",
  "./js/loads.js",
  "./js/rules.js",
  "./js/store.js",
  "./js/views.js",
  "./js/workbench.js",
  "./manifest.webmanifest",
  "./vendor/three.min.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  const url=new URL(e.request.url); if(url.origin!==location.origin) return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));} return res;}).catch(()=>caches.match("./index.html"))));
});
