"use strict";
/* ============================================================
   โครงแอป: หน้าโครงการ, แถบ 6 ขั้นตอน, เมนู, ติดตั้งแอป, ออฟไลน์
   ============================================================ */
let view="home";
const main=document.getElementById("main");
const IN_FRAME=(()=>{try{return window.self!==window.top;}catch(e){return true;}})();
const IS_IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const isStandalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
let installEvt=null;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;if(view==="home")render();});
addEventListener("appinstalled",()=>{installEvt=null;if(view==="home")render();});

const STEP_IC={model:'<path d="M4 20V8l8-4 8 4v12"/><path d="M4 12h16M12 4v16"/>',loads:'<path d="M12 3v10M8 9l4 4 4-4"/><path d="M4 17h16v3H4z"/>',
  analyze:'<path d="M3 17c3-8 6-8 9 0s6 8 9 0"/><path d="M3 12h18" stroke-dasharray="2 3"/>',design:'<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M8 15l3-3 2 2 4-5"/>',
  detail:'<path d="M3 9h18M3 15h18"/><circle cx="7" cy="9" r="1.6"/><circle cx="17" cy="9" r="1.6"/><circle cx="7" cy="15" r="1.6"/><circle cx="17" cy="15" r="1.6"/>',
  report:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>'};
const STEPS=[["model","โมเดล"],["loads","น้ำหนัก"],["analyze","วิเคราะห์"],["design","ออกแบบ"],["detail","เหล็กเสริม"],["report","รายงาน"]];
function stepStatus(k){if(!S)return "";
  if(k==="model"){const m=S.model;if(!m.stories.some(s=>s.beams.length))return "empty";return m.stories.some((s,i)=>analyzeModel(LM(i)).chains.some(c=>c.warnings.length))?"warn":"ok";}
  if(k==="design"){const r=S.beams.map(b=>designBeam(b,S.mat,S.phiCase).ok);return r.every(Boolean)?"ok":"ng";}
  if(k==="loads"){return S.model.stories.some(s=>s.beams.length)?"ok":"empty";}
  if(k==="report") return "ok";
  return "soon";}
function renderHeader(){const open=!!S&&view!=="home";
  document.getElementById("hdrProj").textContent=open?S.project.name:"KN-Studio";
  document.getElementById("hdrSub").textContent=open?{saving:"กำลังบันทึก…",saved:"บันทึกในเครื่องแล้ว",error:"บันทึกไม่สำเร็จ ส่งออกไฟล์เพื่อสำรองข้อมูล"}[Store.state]:"รายการคำนวณโครงสร้างอาคาร";
  const nav=document.getElementById("steps");nav.hidden=!open;
  if(open) nav.innerHTML=STEPS.map(([k,t],i)=>{const st=stepStatus(k);
    return `<button class="step st-${st}" data-go="${k}" ${view===k?'aria-current="step"':""}><span class="sn">${i+1}</span><svg viewBox="0 0 24 24" aria-hidden="true">${STEP_IC[k]}</svg><span class="sl">${t}</span>${st==="soon"?'<span class="sb">เร็ว ๆ นี้</span>':st&&st!=="empty"?`<span class="sd" title="${{ok:"เรียบร้อย",warn:"มีจุดที่ต้องตรวจ",ng:"มีองค์อาคารไม่ผ่าน"}[st]}"></span>`:""}</button>`;}).join("");
  const a=nav.querySelector('[aria-current="step"]');if(a&&a.scrollIntoView)a.scrollIntoView({block:"nearest",inline:"nearest"});}
function go(v,push=true){if(v!=="home"&&!S)v="home";if((view==="model"||view==="loads")&&v!==view){flush();WB.start=null;clearSel();}view=v;if(push)try{history.pushState({v},"");}catch(e){}render();window.scrollTo(0,0);}
addEventListener("popstate",e=>{const v=e.state&&e.state.v||"home";if(document.getElementById("dlg").open){document.getElementById("dlg").close();}go(v,false);});
function render(){renderHeader();
  const wbm=view==="model"||view==="loads";main.classList.toggle("wbmode",wbm);document.body.classList.toggle("wbmode",wbm);
  const V={home:viewHome,model:()=>{WB.mode="model";return viewWorkbench();},loads:()=>{WB.mode="loads";WB.tool="select";return viewWorkbench();},analyze:()=>viewSoon("analyze"),design:viewBeam,detail:()=>viewSoon("detail"),
    report:viewReport,project:viewProject,rules:viewRules,test:viewTest};
  main.innerHTML=(V[view]||viewHome)();
  if(view==="design") renderBeamOut();
  if(wbm) initWorkbench();}

/* ---------- หน้าโครงการของฉัน ---------- */
let homeList=[];
function dateTH(t){return new Date(t).toLocaleString("th-TH",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}
function installCard(){if(isStandalone())return "";
  let body;
  if(IN_FRAME) body=`หน้านี้เป็นตัวอย่างที่เปิดใน Claude ติดตั้งเป็นแอปได้เมื่อเปิดจากเว็บไซต์ที่อัปโหลดชุดไฟล์ KN-Studio ไว้ ดูวิธีในไฟล์ README ที่มากับชุดไฟล์`;
  else if(installEvt) body=`ติดตั้งแล้วจะมีไอคอนบนหน้าจอเหมือนแอปทั่วไป เปิดได้แม้ไม่มีอินเทอร์เน็ต<div class="flex" style="margin-top:8px"><button class="btn primary" data-act="install">ติดตั้งแอป</button></div>`;
  else if(IS_IOS) body=`บน iPhone และ iPad: เปิดหน้านี้ด้วย Safari แตะปุ่มแชร์ <b>⎙</b> แล้วเลือก <b>“เพิ่มไปยังหน้าจอโฮม”</b>`;
  else body=`บน Android และ Samsung: แตะเมนู <b>⋮</b> ของเบราว์เซอร์ แล้วเลือก <b>“ติดตั้งแอป”</b> หรือ <b>“เพิ่มลงในหน้าจอหลัก”</b>`;
  return `<div class="card install"><h3>ติดตั้งลงเครื่อง</h3><p class="note">${body}</p></div>`;}
function viewHome(){
  const list=homeList.slice().sort((a,b)=>b.updated-a.updated);
  const cards=list.map(r=>`<article class="card proj" data-open="${r.id}" tabindex="0">
     <h3>${esc(r.name||"ไม่มีชื่อ")}</h3><p class="note">${esc(r.location||"")}</p>
     <p class="meta">${r.stats?.n?r.stats.n+" ชั้น ":""}เสา ${r.stats?.c??0} ต้น คาน ${r.stats?.b??0} ช่วง<br>แก้ไขล่าสุด ${dateTH(r.updated)}</p>
     <div class="flex"><button class="btn primary" data-open="${r.id}">เปิด</button><button class="btn" data-act="dupProj" data-id="${r.id}">ทำสำเนา</button>
      <button class="btn" data-act="expProj" data-id="${r.id}">ส่งออกไฟล์</button><button class="btn danger" data-act="delProj" data-id="${r.id}">ลบ</button></div></article>`).join("");
  return `<section class="home"><div class="home-head"><div><h1>โครงการของฉัน</h1><p class="lead">ออกแบบโครงสร้างบ้านทั้งหลังตั้งแต่วาดแปลนจนได้รายการคำนวณ ข้อมูลทั้งหมดเก็บในเครื่องนี้</p></div>
    <div class="flex"><button class="btn primary big" data-act="newProj">โครงการใหม่</button><button class="btn big" data-act="exProj">เปิดตัวอย่าง</button><button class="btn big" data-act="impProj">นำเข้าไฟล์</button></div></div>
    ${list.length?`<div class="proj-grid">${cards}</div>`:`<div class="card empty"><h3>ยังไม่มีโครงการ</h3><p class="note">กด “โครงการใหม่” เพื่อเริ่มจากแปลนว่าง หรือ “เปิดตัวอย่าง” เพื่อดูบ้าน ค.ส.ล. 2 ชั้นที่วาดไว้แล้ว</p></div>`}
    ${installCard()}
    <p class="note">${Store.db?"ข้อมูลเก็บในเครื่องนี้เท่านั้น ส่งออกไฟล์ .kns เพื่อสำรองหรือย้ายไปเครื่องอื่น":"เบราว์เซอร์นี้ไม่อนุญาตให้ใช้ที่เก็บถาวร ข้อมูลอาจหายเมื่อปิดหน้า ส่งออกไฟล์ .kns เพื่อเก็บงาน"}</p>
    <input type="file" id="fileIn" accept=".kns,.json,application/json" hidden></section>`;}
async function showHome(push=true){homeList=await dbAll().catch(()=>[]);go("home",push);}
function newProjectDialog(){const d=document.getElementById("dlg");
  d.innerHTML=`<h3 style="margin-top:0">โครงการใหม่</h3>
   <div class="row" style="grid-template-columns:110px 1fr"><label for="npName">ชื่อโครงการ</label><input id="npName" value="บ้านพักอาศัย ค.ส.ล. 2 ชั้น"></div>
   <fieldset style="margin-top:10px"><legend>เริ่มจาก</legend>
    <label class="choice"><input type="radio" name="npK" value="blank" checked> <span><b>แปลนว่าง</b><br><span class="note">มีกริดเริ่มต้น 3×3 ช่วง แก้ระยะได้ทันที</span></span></label>
    <label class="choice"><input type="radio" name="npK" value="example"> <span><b>ตัวอย่างบ้าน 2 ชั้น</b><br><span class="note">มีเสา คาน คานซอย และคานยื่นวาดไว้แล้ว</span></span></label></fieldset>
   <div class="flex" style="margin-top:12px"><button class="btn primary" id="npGo">สร้างโครงการ</button><button class="btn" id="npX">ยกเลิก</button></div>`;
  d.showModal();d.querySelector("#npX").onclick=()=>d.close();
  d.querySelector("#npGo").onclick=async()=>{const k=d.querySelector('input[name=npK]:checked').value,n=d.querySelector("#npName").value.trim();
    d.close();await createProject(k,n||null);go("model");};}
async function shareOrDownload(name,text){
  const blob=new Blob([text],{type:"application/json"});
  try{const f=new File([blob],name,{type:"application/json"});if(navigator.canShare&&navigator.canShare({files:[f]})&&!IN_FRAME){await navigator.share({files:[f],title:name});return;}}catch(e){if(e&&e.name==="AbortError")return;}
  if(IN_FRAME){openJSON("export");return;}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},800);}
const fileName=n=>(n||"project").replace(/[\\/:*?"<>|]+/g," ").trim().slice(0,60)+".kns";

/* ---------- ขั้นตอนที่กำลังสร้าง ---------- */
const SOON={
  loads:{t:"น้ำหนักบรรทุก",d:"กำหนดน้ำหนักทั้งหมดที่กระทำกับอาคาร โปรแกรมจะคำนวณและกระจายลงองค์อาคารให้เอง",
    items:["เลือกประเภทการใช้งานของแต่ละแผงพื้น แล้วได้น้ำหนักบรรทุกจรตามกฎกระทรวง 2566 ข้อ 11","หาแผงพื้นจากวงคานที่ปิดล้อม และกระจายน้ำหนักลงคานแบบสามเหลี่ยมหรือคางหมู","ใส่ผนังบนคานทีละเส้นหรือทุกคานรอบนอกในคำสั่งเดียว","แรงลมตามข้อ 17 และแผ่นดินไหวเมื่ออยู่ในเขตบังคับ"],next:"model"},
  analyze:{t:"วิเคราะห์โครงสร้าง",d:"กดปุ่มเดียวเพื่อวิเคราะห์ทั้งอาคารแบบโครงข้อแข็ง 3 มิติ แบบเดียวกับ ETABS",
    items:["Stiffness method 6 ดีกรีอิสระต่อจุด พื้นทำงานเป็นแผ่นแข็งในระนาบ","จัดน้ำหนักจรสลับช่วงเพื่อหาแรงสูงสุดจริง","รวมทุกชุดตัวคูณน้ำหนักตามกฎกระทรวง ข้อ 7 อัตโนมัติ","แผนภาพโมเมนต์ แรงเฉือน และการเสียรูปบนแปลนและภาพ 3D","ชุดทดสอบเทียบผลกับ ETABS และการคำนวณด้วยมือ"],next:"design"},
  detail:{t:"รายละเอียดเหล็กเสริม",d:"แบบเหล็กเสริมตามหลักการเขียนแบบ สร้างจากผลออกแบบโดยตรง",
    items:["รูปด้านตามแนวคาน: ป้ายเหล็ก ระยะตัด ระยะฝัง และตำแหน่งต่อทาบ","รูปตัดของแต่ละโซน: หัวเสาและกลางคาน","ภาพ 3D เหล็กเสริมทุกเส้น แตะเพื่อดูป้ายและความยาว","ตารางตัดเหล็กสำหรับ RebarCut Pro"],next:"design"}};
function viewSoon(k){const s=SOON[k];return `<section class="soon-view"><div class="card"><span class="tag pending">กำลังสร้าง</span><h1 style="margin-top:8px">${s.t}</h1><p class="lead">${s.d}</p>
  <h3>สิ่งที่ขั้นตอนนี้จะทำ</h3><ul>${s.items.map(i=>`<li>${i}</li>`).join("")}</ul>
  <div class="flex" style="margin-top:14px"><button class="btn primary" data-go="${s.next}">ไปที่ขั้น${STEPS.find(x=>x[0]===s.next)[1]}</button></div></div></section>`;}

/* ---------- เมนู ---------- */
function applyTheme(){let t="auto";try{t=localStorage.getItem("knstudio.theme")||"auto";}catch(e){}
  if(t==="auto")document.documentElement.removeAttribute("data-theme");else document.documentElement.setAttribute("data-theme",t);
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",getComputedStyle(document.documentElement).getPropertyValue("--panel").trim()||"#ffffff");}
function openMenu(){const d=document.getElementById("dlg");let t="auto";try{t=localStorage.getItem("knstudio.theme")||"auto";}catch(e){}
  const item=(act,label,sub)=>`<button class="menu-item" data-m="${act}"><b>${label}</b>${sub?`<span>${sub}</span>`:""}</button>`;
  d.innerHTML=`<div class="menu"><h3 style="margin-top:0">เมนู</h3>
   ${item("home","โครงการของฉัน","สร้าง เปิด ทำสำเนา และส่งออกไฟล์")}
   ${S?item("project","ข้อมูลโครงการและวัสดุ","หัวกระดาษรายงาน fc′ fy และตัวคูณลดกำลัง"):""}
   ${item("rules","มาตรฐานและกฎ","ค่าจากกฎกระทรวง 2566 พร้อมแหล่งอ้างอิง")}
   ${S?item("test","ทดสอบเทียบไฟล์เดิม","ตรวจความถูกต้องของเครื่องคำนวณ"):""}
   ${item("help","คู่มือแปลนชั้น","วิธีวาดด้วยเมาส์และนิ้ว")}
   <div class="seg" role="radiogroup" aria-label="ธีม"><span>ธีม</span>${[["auto","ตามเครื่อง"],["light","สว่าง"],["dark","มืด"]].map(([v,l])=>`<button data-theme-set="${v}" aria-pressed="${t===v}">${l}</button>`).join("")}</div>
   <div class="flex" style="margin-top:12px"><button class="btn" id="mX">ปิด</button></div></div>`;
  d.showModal();d.querySelector("#mX").onclick=()=>d.close();
  d.onclick=e=>{const m=e.target.closest("[data-m]");const th=e.target.closest("[data-theme-set]");
    if(th){try{localStorage.setItem("knstudio.theme",th.dataset.themeSet);}catch(x){}applyTheme();d.querySelectorAll("[data-theme-set]").forEach(b=>b.setAttribute("aria-pressed",b===th));if(view==="model"&&WB.show3d)render3D();return;}
    if(!m)return;d.close();d.onclick=null;const a=m.dataset.m;
    if(a==="home")showHome();else if(a==="help")openHelp();else go(a);};}

/* ---------- เหตุการณ์ ---------- */
document.getElementById("btnHome").addEventListener("click",()=>{flush();showHome();});
document.getElementById("btnMenu").addEventListener("click",openMenu);
document.getElementById("steps").addEventListener("click",e=>{const b=e.target.closest("[data-go]");if(b)go(b.dataset.go);});
main.addEventListener("input",e=>{const el=e.target.closest("[data-path]");if(!el)return;
  let v=el.value; if(el.dataset.type!=="text"&&el.tagName!=="SELECT") v=parseFloat(v);
  if(el.tagName==="SELECT"){ if(v==="true")v=true; else if(v==="false")v=false; else if(/^-?\d+(\.\d+)?$/.test(v)) v=+v; }
  if(typeof v==="number"&&isNaN(v)) return;
  setPath(el.dataset.path,v); save();
  if(view==="design"){ if(el.dataset.path.endsWith("loadMode")){render();return;} renderBeamOut(); renderHeader(); }
  if(el.dataset.path==="project.name") document.getElementById("hdrProj").textContent=S.project.name;
});
main.addEventListener("click",async e=>{
  const g=e.target.closest("[data-go]"); if(g&&!g.closest("#steps")){go(g.dataset.go);return;}
  const bt=e.target.closest("[data-beam]"); if(bt){cur=+bt.dataset.beam;render();return;}
  const a=e.target.closest("[data-act]");
  const op=e.target.closest("[data-open]");
  if(!a&&op){if(await openProject(op.dataset.open))go("model");return;}
  if(!a) return;
  const act=a.dataset.act, id=a.dataset.id;
  if(act==="addBeam"){S.beams.push(newBeam("B"+(S.beams.length+1)));cur=S.beams.length-1;save();render();}
  else if(act==="dupBeam"){const c=JSON.parse(JSON.stringify(S.beams[cur]));c.name+="-1";S.beams.splice(cur+1,0,c);cur++;save();render();}
  else if(act==="delBeam"){if(S.beams.length>1&&confirm(`ลบคาน ${S.beams[cur].name}?`)){S.beams.splice(cur,1);cur=Math.max(0,cur-1);save();render();}}
  else if(act==="print") window.print();
  else if(act==="export") shareOrDownload(fileName(S.project.name),projectFileText(S));
  else if(act==="import") openJSON("import");
  else if(act==="newProj") newProjectDialog();
  else if(act==="exProj"){await createProject("example");go("model");}
  else if(act==="impProj") document.getElementById("fileIn").click();
  else if(act==="dupProj"){await duplicateProject(id);showHome(false);}
  else if(act==="expProj"){const r=await dbGet(id);if(r)shareOrDownload(fileName(r.name),projectFileText(r.data));}
  else if(act==="delProj"){const r=homeList.find(x=>x.id===id);if(confirm(`ลบโครงการ “${r?r.name:""}” ออกจากเครื่องนี้? ลบแล้วกู้คืนไม่ได้ ถ้ายังไม่ได้ส่งออกไฟล์ ให้ส่งออกก่อน`)){await deleteProject(id);showHome(false);}}
  else if(act==="install"&&installEvt){installEvt.prompt();try{await installEvt.userChoice;}catch(x){}installEvt=null;render();}
});
main.addEventListener("keydown",async e=>{if(e.key==="Enter"&&e.target.matches(".proj[data-open]")){if(await openProject(e.target.dataset.open))go("model");}});
main.addEventListener("change",async e=>{if(e.target.id!=="fileIn")return;const f=e.target.files[0];if(!f)return;
  try{const d=parseProjectFile(await f.text());await createProject("blank",null,d);go("model");}
  catch(x){alert("ไฟล์นี้ไม่ใช่ไฟล์โครงการ KN-Studio (.kns) เลือกไฟล์ที่ส่งออกจากโปรแกรมนี้");}
  e.target.value="";});
function openJSON(mode){const d=document.getElementById("dlg");
  d.innerHTML=`<h3 style="margin-top:0">${mode==="export"?"คัดลอกข้อมูลโครงการ":"วางข้อมูลโครงการ"}</h3>
   <textarea id="jsonBox" spellcheck="false">${mode==="export"?esc(projectFileText(S)):""}</textarea>
   <p class="note" id="jsonMsg">${mode==="export"?"ข้อความนี้คือข้อมูลโครงการทั้งหมด เก็บไว้หรือวางในเครื่องอื่นเพื่อเปิดต่อ":"วางข้อความโครงการที่คัดลอกไว้ แล้วกดนำเข้า ข้อมูลโครงการปัจจุบันจะถูกแทนที่"}</p>
   <div class="flex">${mode==="export"?`<button class="btn primary" id="jsonGo">คัดลอก</button>`:`<button class="btn primary" id="jsonGo">นำเข้า</button>`}<button class="btn" id="jsonClose">ปิด</button></div>`;
  d.showModal();
  d.querySelector("#jsonClose").onclick=()=>d.close();
  d.querySelector("#jsonGo").onclick=async()=>{const box=d.querySelector("#jsonBox"),msg=d.querySelector("#jsonMsg");
    if(mode==="export"){try{await navigator.clipboard.writeText(box.value);msg.textContent="คัดลอกแล้ว";}catch(e){box.select();msg.textContent="เลือกข้อความแล้ว กดคัดลอกด้วยตนเอง";}}
    else{try{const o=normalize(parseProjectFile(box.value));S=o;Store.cur.data=S;save();resetSession();d.close();render();}catch(e){msg.textContent="ข้อความไม่ใช่ข้อมูลโครงการ KN-Studio ตรวจว่าคัดลอกมาครบทั้งหมด";}}};
}

/* ---------- เริ่มทำงาน ---------- */
function registerSW(){if(IN_FRAME||!("serviceWorker" in navigator))return;
  if(location.protocol!=="https:"&&location.hostname!=="localhost"&&location.hostname!=="127.0.0.1")return;
  navigator.serviceWorker.register("sw.js").catch(()=>{});}
async function boot(){applyTheme();memLoad();
  try{Store.db=await idbOpen();}catch(e){Store.db=null;}
  await migrateLocal();
  let ok=false;try{const last=localStorage.getItem("knstudio.last");if(last)ok=await openProject(last);}catch(e){}
  homeList=await dbAll().catch(()=>[]);
  try{history.replaceState({v:ok?"model":"home"},"");}catch(e){}
  go(ok?"model":"home",false);registerSW();}
boot();
