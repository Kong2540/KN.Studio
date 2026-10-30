"use strict";
/* ============================================================
   STEP 1 — แกนกลาง: state, หน่วย, ตัวบันทึกการคำนวณ (calc trace)
   หน่วยภายใน: กก., ซม., กก./ตร.ซม. (ksc); รับค่าความยาวเป็นเมตรแบบไฟล์เดิม
   ============================================================ */
const DIAS=[6,9,10,12,16,20,25,28,32];
function newBeam(name){return {name, L:4, b:0.2, h:0.4, cover:0.025, clear:0.025, support:"simple", sign:"+",
  loadMode:"direct", Mu:3000, Vu:3000, wD:0, wL:0, pD:0, pL:0, selfWt:true,
  top:[{n:2,d:12},{n:0,d:12}], bot:[{n:2,d:12},{n:0,d:12}], stType:"RB", stDia:6, legs:2, s:15};}
function projectTemplate(kind){
  const base={v:1,
    project:{name:"โครงการใหม่",owner:"",location:"",engineer:"",license:""},
    mat:{fc:240, fy:3900, fvy:2350, Es:2040000, agg:19},
    phiCase:"unspecified", beams:[newBeam("B1")], model:defaultModel(), loads:defaultLoads()};
  if(kind!=="example") return base;
  base.project={name:"บ้านพักอาศัย ค.ส.ล. 2 ชั้น จำนวน 1 หลัง", owner:"นายไพศาล ทัศศิริ",
    location:"ตำบลโพสังโฆ อำเภอค่ายบางระจัน จังหวัดสิงห์บุรี", engineer:"ภัทรชัย เหมัษฐิติ", license:"ภย.82095"};
  base.beams=[Object.assign(newBeam("B1"),{L:4,b:0.2,h:0.6,cover:0.025,clear:0.03,Mu:14500,Vu:11000,
    top:[{n:2,d:16},{n:0,d:16}], bot:[{n:3,d:16},{n:2,d:16}], stType:"RB", stDia:9, legs:2, s:15})];
  base.model=exampleModel();
  return base;
}
function newStory(name,elev){return {id:"s"+Math.random().toString(36).slice(2,8),name,elev,columns:[],beams:[],slabs:{},over:{}};}
function defaultModel(){const xs=[0,4,7.5,11], ys=[0,4,8,12];
  return {grid:{x:xs.map((p,i)=>({n:String.fromCharCode(65+i),p})), y:ys.map((p,i)=>({n:String(i+1),p}))},
    stories:[newStory("ชั้นล่าง (คานคอดิน)",0),newStory("ชั้น 2",3)], cur:0, found:-1.0,
    defCol:{b:0.25,h:0.25}, defBeam:{b:0.2,h:0.4}, defSlab:{name:"S1",t:0.10,kind:"cast"}, seq:0};}
/* แปลงข้อมูลแปลนแบบชั้นเดียวของรุ่นก่อนให้เป็นหลายชั้น */
function migrateModel(m){if(!m)return defaultModel();
  if(!m.stories){const old=m;const nm=defaultModel();nm.grid=old.grid||nm.grid;nm.seq=old.seq||0;nm.defCol=old.defCol||nm.defCol;nm.defBeam=old.defBeam||nm.defBeam;
    nm.stories[1].elev=old.storyH||3;nm.stories[1].columns=old.columns||[];nm.stories[1].beams=old.beams||[];nm.cur=1;return nm;}
  m.defSlab=m.defSlab||{name:"S1",t:0.10,kind:"cast"};if(m.found==null)m.found=-1.0;
  m.stories.forEach(st=>{st.columns=st.columns||[];st.beams=st.beams||[];st.slabs=st.slabs||{};st.over=st.over||{};});
  m.cur=Math.max(0,Math.min(m.cur|0,m.stories.length-1));return m;}
const A = d=>Math.PI*(d/10)**2/4;           // พื้นที่เหล็ก 1 เส้น (ซม.²) จาก d (มม.)
function fmt(v,dp=2){if(v===Infinity)return "∞"; if(v==null||isNaN(v))return "–";
  return Number(v).toLocaleString("th-TH",{minimumFractionDigits:dp,maximumFractionDigits:dp});}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

class Trace{
  constructor(){this.rows=[];this.checks=[];}
  group(t){this.rows.push({grp:t});}
  add(label,formula,subst,value,unit,ref,dp=2){this.rows.push({label,formula,subst,value,unit,ref,dp});return value;}
  check(label,ok,detail,ref){this.checks.push({label,ok:!!ok,detail,ref});return ok;}
}

