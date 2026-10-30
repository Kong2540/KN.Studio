"use strict";
/* ============================================================
   ที่เก็บโครงการ: IndexedDB (หลายโครงการต่อเครื่อง) พร้อมสำรองแบบ localStorage
   ============================================================ */
const DB_NAME="knstudio", DB_STORE="projects", FILE_FORMAT="kn-studio";
const Store={db:null, cur:null, mem:new Map(), t:null, state:"saved"};
let S=null;

function idbOpen(){return new Promise((res,rej)=>{
  if(!("indexedDB" in window)) return rej(new Error("no-idb"));
  let r; try{r=indexedDB.open(DB_NAME,1);}catch(e){return rej(e);}
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(DB_STORE)) r.result.createObjectStore(DB_STORE,{keyPath:"id"});};
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); r.onblocked=()=>rej(new Error("blocked"));});}
function idbReq(mode,fn){return new Promise((res,rej)=>{const t=Store.db.transaction(DB_STORE,mode),req=fn(t.objectStore(DB_STORE));
  t.oncomplete=()=>res(req?req.result:undefined); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error);});}
function memPersist(){try{localStorage.setItem("knstudio.fallback",JSON.stringify([...Store.mem.values()]));}catch(e){}}
function memLoad(){try{const a=JSON.parse(localStorage.getItem("knstudio.fallback")||"[]");a.forEach(r=>Store.mem.set(r.id,r));}catch(e){}}
async function dbAll(){if(!Store.db) return [...Store.mem.values()]; return idbReq("readonly",s=>s.getAll());}
async function dbGet(id){if(!Store.db) return Store.mem.get(id); return idbReq("readonly",s=>s.get(id));}
async function dbPut(r){if(!Store.db){Store.mem.set(r.id,JSON.parse(JSON.stringify(r)));memPersist();return;} return idbReq("readwrite",s=>s.put(JSON.parse(JSON.stringify(r))));}
async function dbDel(id){if(!Store.db){Store.mem.delete(id);memPersist();return;} return idbReq("readwrite",s=>s.delete(id));}

const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function normalize(d){
  d.v=1; d.project=Object.assign({name:"โครงการใหม่",owner:"",location:"",engineer:"",license:""},d.project||{});
  d.mat=Object.assign({fc:240,fy:3900,fvy:2350,Es:2040000,agg:19},d.mat||{});
  if(!d.phiCase) d.phiCase="unspecified";
  if(!Array.isArray(d.beams)||!d.beams.length) d.beams=[newBeam("B1")];
  d.model=migrateModel(d.model);
  d.loads=Object.assign(defaultLoads(),d.loads||{});d.loads.wind=Object.assign(defaultLoads().wind,d.loads.wind||{});d.loads.def=Object.assign(defaultLoads().def,d.loads.def||{});
  return d;}
function setSaveState(st){Store.state=st;const el=document.getElementById("hdrSub");
  if(el&&S&&typeof view!=="undefined"&&view!=="home") el.textContent={saving:"กำลังบันทึก…",saved:"บันทึกในเครื่องแล้ว",error:"บันทึกไม่สำเร็จ ส่งออกไฟล์เพื่อสำรองข้อมูล"}[st];}
function save(){setSaveState("saving");clearTimeout(Store.t);Store.t=setTimeout(flush,350);}
async function flush(){clearTimeout(Store.t);if(!Store.cur||!S)return;const r=Store.cur;
  Object.assign(r,{data:S,name:S.project.name,location:S.project.location,updated:Date.now(),stats:{c:S.model.stories.reduce((a,s)=>a+s.columns.length,0),b:S.model.stories.reduce((a,s)=>a+s.beams.length,0),n:S.model.stories.length}});
  try{await dbPut(r);setSaveState("saved");}catch(e){setSaveState("error");}}
function rememberLast(id){try{id?localStorage.setItem("knstudio.last",id):localStorage.removeItem("knstudio.last");}catch(e){}}
async function openProject(id){const r=await dbGet(id).catch(()=>null);if(!r)return false;Store.cur=r;S=normalize(r.data);rememberLast(id);resetSession();return true;}
async function createProject(kind,name,data){const d=normalize(data||projectTemplate(kind));if(name)d.project.name=name;
  const r={id:uid(),created:Date.now(),updated:Date.now(),data:d};Store.cur=r;S=d;await flush();rememberLast(r.id);resetSession();return r.id;}
async function duplicateProject(id){const r=await dbGet(id);if(!r)return;const c=JSON.parse(JSON.stringify(r));c.id=uid();c.created=c.updated=Date.now();
  c.data.project.name+=" (สำเนา)";c.name=c.data.project.name;await dbPut(c);}
async function deleteProject(id){await dbDel(id);if(Store.cur&&Store.cur.id===id){Store.cur=null;S=null;rememberLast(null);}}
function projectFileText(d){return JSON.stringify({format:FILE_FORMAT,version:1,saved:new Date().toISOString(),data:d},null,1);}
function parseProjectFile(text){const o=JSON.parse(text);const d=o&&o.format===FILE_FORMAT?o.data:o;
  if(!d||d.v!==1||!d.project) throw new Error("not-kn");return d;}
async function migrateLocal(){try{if(localStorage.getItem("knstudio.migrated"))return;const raw=localStorage.getItem("knstudio.v1");
  if(raw){const d=JSON.parse(raw);if(d&&d.v===1){const keep={cur:Store.cur,S};await createProject("blank",null,d);Store.cur=keep.cur;S=keep.S;}}
  localStorage.setItem("knstudio.migrated","1");}catch(e){}}
function resetSession(){if(typeof WB!=="undefined"){WB.v=null;WB.sel.clear();WB.selCol.clear();WB.hist=[];WB.fut=[];WB.start=null;WB.cur=null;WB.tool="select";}
  if(typeof cur!=="undefined") cur=0;}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flush();});
addEventListener("pagehide",()=>flush());
