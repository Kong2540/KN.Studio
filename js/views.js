"use strict";
/* ============================================================
   UI
   ============================================================ */
let cur=0, tab="trace";
function setPath(path,val){const ks=path.split(".");let o=S;for(let i=0;i<ks.length-1;i++)o=o[ks[i]];o[ks.at(-1)]=val;}
function getPath(path){return path.split(".").reduce((o,k)=>o[k],S);}
function num(path,label,unit,step="any"){return `<div class="row"><label for="f_${path}">${label}</label><input id="f_${path}" type="number" inputmode="decimal" step="${step}" data-path="${path}" value="${getPath(path)}"><span class="u">${unit}</span></div>`;}
function txt(path,label){return `<div class="row" style="grid-template-columns:150px 1fr"><label for="f_${path}">${label}</label><input id="f_${path}" data-path="${path}" data-type="text" value="${esc(getPath(path))}"></div>`;}
function sel(path,label,opts,unit=""){return `<div class="row"><label for="f_${path}">${label}</label><select id="f_${path}" data-path="${path}" data-type="text">${opts.map(([v,t])=>`<option value="${v}" ${String(getPath(path))===String(v)?"selected":""}>${t}</option>`).join("")}</select><span class="u">${unit}</span></div>`;}
function barRow(path,label){const ly=getPath(path);return `<div class="bars"><span>${label}</span><input type="number" min="0" step="1" data-path="${path}.n" value="${ly.n}" aria-label="${label} จำนวนเส้น"><span class="x">DB</span><select data-path="${path}.d" aria-label="${label} ขนาด">${DIAS.filter(d=>d>=10).map(d=>`<option ${d==ly.d?"selected":""}>${d}</option>`).join("")}</select></div>`;}

function viewProject(){
  const p=S.project;
  return `<h1>ข้อมูลโครงการ</h1><p class="lead">ข้อมูลนี้ใช้เป็นหัวกระดาษทุกหน้าของรายการคำนวณ และวัสดุใช้ร่วมกันทุกองค์อาคาร</p>
  <div class="grid2"><div class="panel">
   <fieldset><legend>โครงการ</legend>${txt("project.name","ประเภทองค์อาคาร")}${txt("project.owner","เจ้าของโครงการ")}${txt("project.location","สถานที่ก่อสร้าง")}${txt("project.engineer","วิศวกรผู้ออกแบบ")}${txt("project.license","เลขใบอนุญาต")}</fieldset>
  </div><div class="panel">
   <fieldset><legend>วัสดุ</legend>${num("mat.fc","กำลังอัดคอนกรีต fc′ (ทรงกระบอก 28 วัน)","ksc")}${num("mat.fy","กำลังครากเหล็กหลัก fy (SD40)","ksc")}${num("mat.fvy","กำลังครากเหล็กปลอก fvy (SR24)","ksc")}${num("mat.Es","โมดูลัสยืดหยุ่นเหล็ก Es","ksc")}${num("mat.agg","ขนาดมวลรวมโตสุด","มม.")}</fieldset>
   <fieldset><legend>ตัวคูณลดกำลัง (กฎกระทรวง 2566 ข้อ 8)</legend>
    ${sel("phiCase","กรณี",[["unspecified","ไม่ระบุมาตรฐานงานก่อสร้าง"],["specified","ระบุมาตรฐานงานก่อสร้างอย่างดี"]])}
    <p class="note">ถ้าเลือก “ระบุมาตรฐาน” ต้องระบุในแบบก่อสร้างว่ามีมาตรฐานงานก่อสร้างและการควบคุมคุณภาพวัสดุเป็นอย่างดี</p></fieldset>
  </div></div>
  <h2>ข้อมูลโครงการ (JSON)</h2><div class="flex"><button class="btn" data-act="export">คัดลอกข้อมูลโครงการ</button><button class="btn" data-act="import">วางข้อมูลโครงการ</button></div>`;
}

function viewRules(){
  const st=s=>`<span class="tag ${s}">${{verified:"ตรวจกับตัวบทแล้ว",pending:"รอเทียบเล่มมาตรฐาน",legacy:"สมมติฐานไฟล์เดิม"}[s]}</span>`;
  return `<h1>มาตรฐานและกฎ</h1><p class="lead">ทุกค่าในโปรแกรมผูกกับแหล่งอ้างอิงนี้ และพิมพ์ลงรายงานอัตโนมัติ ค่าจากกฎกระทรวง 2566 ตรวจกับตัวบทฉบับราชกิจจานุเบกษา เล่ม 140 ตอนที่ 54 ก แล้ว</p>
  <h2>ตัวคูณลดกำลัง ɸ — ข้อ 8 ${st("verified")}</h2><div class="panel tablewrap"><table><tr><th>ประเภทแรง</th><th class="n">ระบุมาตรฐานงานก่อสร้าง</th><th class="n">ไม่ระบุ</th></tr>
   ${PHI_ROWS.map(([k,t])=>`<tr><td>${t}</td><td class="n ${S.phiCase==="specified"?"sel":""}">${PHI.specified[k]}</td><td class="n ${S.phiCase==="unspecified"?"sel":""}">${PHI.unspecified[k]}</td></tr>`).join("")}</table>
   <p class="note">คอลัมน์ที่ไฮไลต์คือกรณีที่โครงการนี้ใช้</p></div>
  <h2>ชุดตัวคูณน้ำหนักบรรทุก — ข้อ 7 ${st("verified")}</h2><div class="panel tablewrap"><table><tr><th>กรณี</th><th>นป.</th></tr>${COMBOS.map(c=>`<tr><td>${c.case}</td><td>${c.eq.join("<br>")}</td></tr>`).join("")}</table></div>
  <h2>น้ำหนักบรรทุกจรขั้นต่ำ — ข้อ 11 ${st("verified")}</h2><div class="panel"><details><summary>แสดงตาราง (กก./ตร.ม.)</summary><div class="tablewrap"><table><tr><th>กลุ่ม / ประเภทการใช้</th><th>ส่วนของอาคาร</th><th class="n">กก./ตร.ม.</th></tr>
   ${LL.map(([g,u,rows])=>`<tr class="grp"><td colspan="3">${g} — ${u}</td></tr>`+rows.map(([t,v])=>`<tr><td></td><td>${t}</td><td class="n">${v}</td></tr>`).join("")).join("")}</table></div></details></div>
  <h2>การลดน้ำหนักบรรทุกจรเพื่อคำนวณเสาและฐานราก — ข้อ 13–14 ${st("verified")}</h2><div class="panel tablewrap"><table><tr><th>ชั้น</th><th class="n">ลดได้ (ร้อยละ)</th></tr>${LL_RED.map(r=>`<tr><td>${r[0]}</td><td class="n">${r[1]}</td></tr>`).join("")}</table>
   <p class="note">ห้ามลดสำหรับโรงมหรสพ ห้องประชุม หอสมุด พิพิธภัณฑ์ อัฒจันทร์ คลังสินค้า โรงงาน สถานศึกษา สถานพยาบาล ที่จอดรถ และพื้นที่ LL เกิน 500 กก./ตร.ม.</p></div>
  <h2>แรงกระแทก — ข้อ 16 ${st("verified")}</h2><div class="panel tablewrap"><table><tr><th>โครงสร้าง</th><th class="n">เพิ่มขั้นต่ำ (ร้อยละ)</th></tr>${IMPACT.map(r=>`<tr><td>${r[0]}</td><td class="n">${r[1]}</td></tr>`).join("")}</table></div>
  <h2>หน่วยแรงลม — ข้อ 17 ${st("verified")}</h2><div class="panel tablewrap"><table><tr><th>ส่วนของอาคาร</th><th class="n">เมือง/ชานเมือง</th><th class="n">โล่ง/ชายฝั่ง</th></tr>${WIND.rows.map(r=>`<tr><td>${r[0]}</td><td class="n">${r[1]}</td><td class="n">${r[2]}</td></tr>`).join("")}</table><p class="note">ใช้ได้เมื่อ: ${WIND.cond}</p></div>
  <h2>เกณฑ์การออกแบบองค์อาคาร</h2><div class="panel tablewrap"><table><tr><th>รหัส</th><th>รายการ</th><th>สถานะ</th></tr>${Object.entries(REFS).filter(([k])=>!k.startsWith("MR66")).map(([k,r])=>`<tr><td>${k}</td><td>${r.t}</td><td>${st(r.s)}</td></tr>`).join("")}</table>
   <p class="note">รายการ “รอเทียบเล่มมาตรฐาน” ใช้สูตรตามไฟล์เดิมและหลักการ ACI 318 ไปก่อน เมื่อได้เนื้อหา วสท. 011008-21 จะปรับค่าและเปลี่ยนสถานะ</p></div>
  <p class="note">แหล่งตัวบท: <a href="https://download.asa.or.th/03media/04law/fubr/a10.3_bcmr70h-66.pdf" target="_blank" rel="noopener">กฎกระทรวงฯ พ.ศ. 2566 (สมาคมสถาปนิกสยามฯ เผยแพร่)</a></p>`;
}

function checksHTML(R){return `<ul class="checks">${R.T.checks.map(c=>`<li><span class="${c.ok?"ic-ok":"ic-ng"}">${c.ok?"✓":"✗"}</span><span>${c.label}<br><span class="muted">${c.detail}</span></span><span class="tag ${REFS[c.ref]?.s||"legacy"}">${c.ref}</span></li>`).join("")}</ul>`;}
function traceHTML(R){return `<div class="tablewrap"><table><tr><th>รายการ</th><th>สูตร / แทนค่า</th><th class="n">ผล</th><th>หน่วย</th><th>อ้างอิง</th></tr>${R.T.rows.map(r=>r.grp?`<tr class="grp"><td colspan="5">${r.grp}</td></tr>`:
  `<tr><td>${r.label}</td><td class="f">${r.formula}${r.subst?`<br>= ${r.subst}`:""}</td><td class="n">${fmt(r.value,r.dp)}</td><td>${r.unit}</td><td>${r.ref?`<span class="tag ${REFS[r.ref].s}">${r.ref}</span>`:""}</td></tr>`).join("")}</table></div>`;}

function viewBeam(){
  if(!S.beams.length) S.beams.push(newBeam("B1"));
  cur=Math.min(cur,S.beams.length-1);
  const p=`beams.${cur}`, bm=S.beams[cur];
  const tabs=S.beams.map((x,i)=>{const r=designBeam(x,S.mat,S.phiCase);return `<button class="tab" data-beam="${i}" aria-pressed="${i===cur}"><span class="dot" style="background:var(${r.ok?"--ok":"--ng"})"></span>${esc(x.name)}</button>`;}).join("");
  return `<h1>ออกแบบคาน ค.ส.ล.</h1><p class="lead">ออกแบบโดยวิธีกำลัง เสริมเหล็กรับแรงดึงอย่างเดียว ผลคำนวณอัปเดตทันทีที่แก้ค่า ตอนนี้ป้อนแรงเอง เมื่อขั้นวิเคราะห์พร้อม แรงจะมาจากโมเดลอัตโนมัติ</p>
  <div class="tabs">${tabs}<button class="btn" data-act="addBeam">+ เพิ่มคาน</button><button class="btn" data-act="dupBeam">ทำสำเนา</button><button class="btn" data-act="delBeam">ลบ</button></div>
  <div class="grid2"><div class="panel" id="beamForm">
   <fieldset><legend>ชื่อและช่วงคาน</legend>${txt(p+".name","ชื่อคาน")}${num(p+".L","ความยาวช่วง L","ม.")}
    ${sel(p+".support","สภาพรองรับ",[["simple","ช่วงเดียวธรรมดา"],["one","ต่อเนื่องด้านเดียว"],["both","ต่อเนื่องสองด้าน"],["cantilever","คานยื่น"]])}</fieldset>
   <fieldset><legend>หน้าตัด</legend>${num(p+".b","ความกว้าง b","ม.")}${num(p+".h","ความลึก h","ม.")}${num(p+".cover","ระยะหุ้ม (ถึงผิวเหล็กปลอก)","ม.")}${num(p+".clear","ระยะช่องว่างระหว่างชั้นเหล็ก","ม.")}</fieldset>
   <fieldset><legend>แรงกระทำ</legend>${sel(p+".loadMode","วิธีป้อน",[["direct","ป้อน Mu, Vu"],["udl","คำนวณจากน้ำหนัก"]])}
    ${sel(p+".sign","โมเมนต์",[["+","บวก (ดึงล่าง)"],["-","ลบ (ดึงบน)"]])}
    ${bm.loadMode==="direct"? num(p+".Mu","Mu","กก.-ม.")+num(p+".Vu","Vu","กก.") :
      num(p+".wD","น้ำหนักบรรทุกคงที่แผ่ wD","กก./ม.")+num(p+".wL","น้ำหนักบรรทุกจรแผ่ wL","กก./ม.")+num(p+".pD","น้ำหนักจุด PD","กก.")+num(p+".pL","น้ำหนักจุด PL","กก.")+
      sel(p+".selfWt","รวมน้ำหนักคานเอง",[["true","รวม"],["false","ไม่รวม"]])}</fieldset>
   <fieldset><legend>เหล็กเสริมหลัก (ชั้นที่ 1 คือชั้นนอก)</legend>${barRow(p+".bot.0","ล่าง ชั้น 1")}${barRow(p+".bot.1","ล่าง ชั้น 2")}${barRow(p+".top.0","บน ชั้น 1")}${barRow(p+".top.1","บน ชั้น 2")}</fieldset>
   <fieldset><legend>เหล็กปลอก</legend>${sel(p+".stType","ชนิด",[["RB","RB (SR24)"],["DB","DB (SD40)"]])}${sel(p+".stDia","ขนาด",DIAS.filter(d=>d<=12).map(d=>[d,d]),"มม.")}${num(p+".legs","จำนวนขา","ขา","1")}${num(p+".s","ระยะเรียง s","ซม.")}</fieldset>
  </div><div id="beamOut"></div></div>`;
}
function renderBeamOut(){
  const box=document.getElementById("beamOut"); if(!box) return;
  const bm=S.beams[cur], R=designBeam(bm,S.mat,S.phiCase);
  box.innerHTML=`<div class="verdict ${R.ok?"ok":"ng"}"><b>${R.ok?"ผ่าน":"ไม่ผ่าน"}</b><span>${esc(bm.name)} ${fmt(bm.b,2)}×${fmt(bm.h,2)} ม. · ล่าง ${barsText(bm.bot)} · บน ${barsText(bm.top)} · ${bm.stType}${bm.stDia} @${bm.s} ซม.</span></div>
   <div class="panel" style="margin-bottom:14px"><div class="svgbox">${sectionSVG(bm)}</div>
    <div class="tablewrap"><table><tr><th>Mu</th><th>ɸMn</th><th>Vu</th><th>ɸVc + ɸVs</th><th>d</th></tr><tr><td class="n">${fmt(R.Mu,0)}</td><td class="n">${fmt(R.phiMn,0)}</td><td class="n">${fmt(R.Vu,0)}</td><td class="n">${fmt(R.phVc+R.phVs,0)}</td><td class="n">${fmt(R.d,2)} ซม.</td></tr></table></div></div>
   <div class="panel" style="margin-bottom:14px"><h3 style="margin-top:0">รายการตรวจสอบ</h3>${checksHTML(R)}</div>
   <div class="panel"><h3 style="margin-top:0">ขั้นตอนการคำนวณ</h3>${traceHTML(R)}</div>`;
  document.querySelectorAll("[data-beam]").forEach(btn=>{const i=+btn.dataset.beam;const r=designBeam(S.beams[i],S.mat,S.phiCase);btn.querySelector(".dot").style.background=`var(${r.ok?"--ok":"--ng"})`;btn.lastChild.textContent=S.beams[i].name;});
}

function sheetHeader(page){const p=S.project;const d=new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"});
  return `<div class="hd"><div>Project : ${esc(p.name)}</div><div>Date : ${d}</div><div>Owner : ${esc(p.owner)}</div><div>Engineer : ${esc(p.engineer)} ${esc(p.license)}</div><div>Location : ${esc(p.location)}</div><div>หน้า ${page}</div></div>`;}
function viewReport(){
  const pages=S.beams.map((bm,i)=>{const R=designBeam(bm,S.mat,S.phiCase);const used=[...new Set(R.T.rows.filter(r=>r.ref).map(r=>r.ref).concat(R.T.checks.map(c=>c.ref)))];
    return `<section class="sheet">${sheetHeader(i+1)}
     <h4>ออกแบบคานคอนกรีตเสริมเหล็ก ${esc(bm.name)} โดยวิธีกำลัง</h4>
     <div style="display:grid;grid-template-columns:1fr 170px;gap:10px;align-items:start">
      <div>คอนกรีต fc′ = ${S.mat.fc} ksc · เหล็กหลัก fy = ${S.mat.fy} ksc · เหล็กปลอก fvy = ${S.mat.fvy} ksc<br>
       ตัวคูณลดกำลัง: ${PHI[S.phiCase].label} (ɸb = ${PHI[S.phiCase].flex}, ɸv = ${PHI[S.phiCase].shear})<br>
       ขนาด ${fmt(bm.b,2)} × ${fmt(bm.h,2)} ม. ยาว ${bm.L} ม. · ล่าง ${barsText(bm.bot)} · บน ${barsText(bm.top)} · ${bm.stType}${bm.stDia} @${bm.s} ซม.</div>
      <div>${sectionSVG(bm)}</div></div>
     ${traceHTML(R)}
     <h4>สรุปผลการตรวจสอบ</h4><table>${R.T.checks.map(c=>`<tr><td>${c.label}</td><td>${c.detail}</td><td class="res ${c.ok?"ok":"ng"}">${c.ok?"OK":"ไม่ผ่าน"}</td></tr>`).join("")}</table>
     <div class="refs"><b>อ้างอิง</b><br>${used.map(k=>`${k}: ${REFS[k].t}${REFS[k].s==="pending"?" (รอเทียบเล่มมาตรฐาน)":""}`).join("<br>")}</div>
     <div class="foot"><span>KN-Studio</span><span>ลงชื่อ ........................................ วิศวกรผู้ออกแบบ</span></div></section>`;}).join("");
  return `<div class="noprint"><h1>รายงานรายการคำนวณ</h1><p class="lead">หน้ากระดาษ A4 หนึ่งหน้าต่อคาน พร้อมหัวกระดาษโครงการและแหล่งอ้างอิง</p><div class="flex" style="margin-bottom:16px"><button class="btn primary" data-act="print">พิมพ์ / บันทึกเป็น PDF</button></div></div>${pages}`;
}

/* ---------- ทดสอบเทียบไฟล์เดิม B1 ---------- */
const GOLD_B1 = {input:{name:"B1",L:4,b:0.2,h:0.6,cover:0.025,clear:0.03,support:"simple",sign:"+",loadMode:"direct",Mu:14500,Vu:11000,selfWt:false,
  top:[{n:2,d:16},{n:0,d:16}],bot:[{n:3,d:16},{n:2,d:16}],stType:"RB",stDia:9,legs:2,s:15},
  mat:{fc:240,fy:3900,fvy:2350,Es:2040000,agg:19},
  expect:[["d (ม.)","D20",0.558,r=>r.d/100],["ρb","L19",0.02715614924,r=>r.rb],["ρmax","F22",0.02037,r=>r.rmax],["ρmin","F23",0.00359,r=>r.rmin],
   ["ρ ที่ใช้","F24",0.00901,r=>r.rho],["a (ซม.)","F25",9.60949,r=>r.a],["ɸMn (กก.-ม.)","F26",14995.16748,r=>r.phiMn],["Rn","L29",31.046,r=>r.Rn],
   ["ρ ที่ต้องการ","L30",0.00868,r=>r.rreq],["ɸVc (กก.)","E32",6414.218131,r=>r.phVc],["Vs (กก.)","E33",6551.116956,r=>r.Vs],
   ["1.1√fc′bd (กก.)","E34",19017.89742,r=>r.lim1],["2.1√fc′bd (กก.)","E35",36306.89508,r=>r.lim2],["Av (ซม.²)","L34",1.272345025,r=>r.Av],
   ["ɸVs ที่ใช้ (กก.)","E37",7785.99,r=>r.phVs],["S1 = Av·fy/(3.5b) (ซม.)","E39",42.71,r=>r.sMinAv],["S4 = d/2 (ซม.)","E42",27.9,r=>r.sMax]]};
function viewTest(){
  const R=designBeam(GOLD_B1.input,GOLD_B1.mat,"unspecified",{legacy:true});
  const rows=GOLD_B1.expect.map(([t,cell,ex,fn])=>{const v=fn(R),diff=(v-ex)/ex*100,ok=Math.abs(diff)<=0.5;
    return {t,cell,ex,v,diff,ok};});
  const pass=rows.filter(r=>r.ok).length;
  const C=designBeam(GOLD_B1.input,GOLD_B1.mat,"unspecified");
  return `<h1>ทดสอบเทียบไฟล์เดิม</h1><p class="lead">คำนวณแผ่น B1 ของ P2160_ST.xlsx ซ้ำด้วยสมมติฐานเดียวกับไฟล์ แล้วเทียบทุกค่า เกณฑ์ผ่านคือต่างกันไม่เกิน 0.5% (ไฟล์ปัดเศษบางค่า)</p>
  <div class="verdict ${pass===rows.length?"ok":"ng"}"><b>${pass}/${rows.length} ค่าตรงกัน</b><span>โปรแกรมคำนวณได้ตรงกับแผ่น B1 เมื่อใช้สมมติฐานเดิม</span></div>
  <div class="panel tablewrap"><table><tr><th>รายการ</th><th>เซลล์</th><th class="n">ไฟล์ B1</th><th class="n">โปรแกรม</th><th class="n">ต่าง (%)</th><th></th></tr>
   ${rows.map(r=>`<tr><td>${r.t}</td><td>${r.cell}</td><td class="n">${fmt(r.ex,5)}</td><td class="n">${fmt(r.v,5)}</td><td class="n">${fmt(r.diff,3)}</td><td class="${r.ok?"ic-ok":"ic-ng"}">${r.ok?"✓":"✗"}</td></tr>`).join("")}</table></div>
  <h2>ผลต่างเมื่อคำนวณตามหลักที่ถูกต้อง</h2>
  <div class="panel tablewrap"><table><tr><th>รายการ</th><th class="n">ไฟล์เดิม</th><th class="n">โปรแกรม</th><th>เหตุผล</th></tr>
   <tr><td>d (ซม.)</td><td class="n">55.80</td><td class="n">${fmt(C.d)}</td><td>เหล็กดึง 2 ชั้น (3+2 DB16) ต้องใช้ระยะถึงศูนย์ถ่วงของเหล็กทั้งหมด ไม่ใช่ชั้นที่ 1</td></tr>
   <tr><td>ɸMn (กก.-ม.)</td><td class="n">14,995</td><td class="n">${fmt(C.phiMn,0)}</td><td>ผลจาก d ที่ลดลง เทียบ Mu = 14,500 → ${C.phiMn>=14500?"ยังผ่าน":"ไม่ผ่าน"}</td></tr>
   <tr><td>ระยะเรียงจากกำลัง (ซม.)</td><td class="n">19.00</td><td class="n">${fmt(C.sStr)}</td><td>ไฟล์ใช้ ɸb = 0.75 แทน ɸv = 0.70 และใช้ d เดิม สูตรที่ถูกคือ Av·fyv·d/Vs</td></tr>
   <tr><td>S2 = bw</td><td class="n">20.00</td><td class="n">ไม่ใช้</td><td>ไม่ใช่เกณฑ์ในมาตรฐาน แทนด้วยระยะเรียงสูงสุด d/2 ≤ 60 ซม.</td></tr></table></div>
  ${C.phiMn<14500?`<div class="callout ng">คาน B1 ตามแบบเดิม (3+2 DB16) รับโมเมนต์ได้ ${fmt(C.phiMn,0)} กก.-ม. น้อยกว่า Mu ที่ป้อน 14,500 กก.-ม. อยู่ ${fmt((14500-C.phiMn)/14500*100,1)}% แต่ Mu สูงสุดจากแผ่นคำนวนโหลดแถว B1 คือ 14,384 กก.-ม. ซึ่งยังผ่าน ควรใช้ค่าที่ต่อจากแผ่นโหลดโดยตรงแทนการป้อนเอง (จะทำใน Step 6)</div>`:""}`;
}

