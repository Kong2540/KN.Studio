"use strict";
/* ============================================================
   ขั้นที่ 2 น้ำหนักบรรทุก
   - น้ำหนักคงที่จากชั้นวัสดุ (กฎกระทรวง 2566 ข้อ 9) พร้อมน้ำหนักผนังกั้นห้องที่ไม่ระบุตำแหน่ง (ข้อ 10)
   - น้ำหนักจรตามประเภทการใช้งาน (ข้อ 11)
   - กระจายน้ำหนักแผ่นพื้นลงคาน: พื้นสองทางแบบสามเหลี่ยม/คางหมู (เส้นแบ่ง 45°), พื้นทางเดียวลงคานด้านยาว
   - ผนังบนคาน และแรงลมด้านข้างตามข้อ 17
   หน่วย: กก., ม.
   ============================================================ */
function defaultLoads(){return {gc:2400,
  sets:[{id:"room",name:"พื้นห้องทั่วไป",layers:[{n:"กระเบื้องปูพื้น",t:0.01,g:2000},{n:"ปูนทรายรองพื้น",t:0.04,g:2100},{n:"ฝ้าเพดานพร้อมโครง",w:15}]},
        {id:"wet",name:"พื้นห้องน้ำ",layers:[{n:"กระเบื้องปูพื้น",t:0.01,g:2000},{n:"ปูนทรายรองพื้นและปรับลาดเอียง",t:0.06,g:2100},{n:"วัสดุกันซึม",w:5},{n:"ฝ้าเพดานพร้อมโครง",w:15}]},
        {id:"roofdeck",name:"ดาดฟ้า",layers:[{n:"ปูนทรายปรับลาดเอียง",t:0.05,g:2100},{n:"วัสดุกันซึม",w:5},{n:"ฝ้าเพดานพร้อมโครง",w:15}]},
        {id:"ground",name:"พื้นชั้นล่าง (ไม่มีฝ้า)",layers:[{n:"กระเบื้องปูพื้น",t:0.01,g:2000},{n:"ปูนทรายรองพื้น",t:0.04,g:2100}]},
        {id:"bare",name:"ไม่มีวัสดุปูผิว",layers:[]}],
  walls:[{id:"brick",name:"อิฐมอญครึ่งแผ่น ฉาบสองด้าน",layers:[{n:"อิฐมอญ",t:0.07,g:1600},{n:"ปูนฉาบสองด้าน",t:0.03,g:2000}]},
         {id:"aac",name:"อิฐมวลเบา หนา 7.5 ซม. ฉาบสองด้าน",layers:[{n:"อิฐมวลเบา",t:0.075,g:650},{n:"ปูนฉาบสองด้าน",t:0.02,g:2000}]},
         {id:"block",name:"คอนกรีตบล็อก ฉาบสองด้าน",layers:[{n:"คอนกรีตบล็อก (คิดเทียบเนื้อตัน)",t:0.07,g:1300},{n:"ปูนฉาบสองด้าน",t:0.03,g:2000}]},
         {id:"glass",name:"ผนังกระจกพร้อมกรอบ",layers:[{n:"กระจกและกรอบอะลูมิเนียม",w:30}]}],
  def:{use:"8-0",sdl:"room",part:0},
  wind:{terrain:"urban",pub:false,roofH:0}};}
const layerW=l=>l.w!=null?+l.w:(+l.t)*(+l.g);
const setW=s=>s?s.layers.reduce((a,l)=>a+layerW(l),0):0;
function LLitem(key){const [i,j]=String(key||"").split("-").map(Number);const g=LL[i];if(!g||!g[2][j])return {name:"–",w:0,group:"",use:""};
  return {group:g[0],use:g[1],name:g[2][j][0],w:g[2][j][1]};}
function slabLoadProps(M,key){const sp=slabProps(M,key),d=S.loads.def;return Object.assign({use:d.use,sdl:d.sdl,part:d.part},sp);}
function slabLoads(sp){const L=S.loads,set=L.sets.find(s=>s.id===sp.sdl);const self=sp.t*L.gc,sdl=setW(set),part=+sp.part||0;
  return {self,sdl,part,D:self+sdl+part,L:LLitem(sp.use).w,set};}

/* ---------- กระจายน้ำหนักลงคาน ---------- */
function edgeProfile(pn,info,A,B){const a=Math.hypot(B.x-A.x,B.y-A.y);
  if(info.type==="two"){const h=info.S/2;return Math.abs(a-info.S)<1e-6||a<info.S?[[0,0],[a/2,Math.min(h,a/2)],[a,0]]:[[0,0],[h,h],[a-h,h],[a,0]];}
  if(info.type==="one"&&pn.rect){const vert=Math.abs(A.x-B.x)<1e-6;const loaded=info.dir==="x"?vert:!vert;const S2=Math.min(pn.lx,pn.ly);
    return loaded?[[0,S2/2],[a,S2/2]]:null;}
  let per=0;for(let i=0;i<pn.poly.length;i++){const p=pn.poly[i],q=pn.poly[(i+1)%pn.poly.length];per+=Math.hypot(q.x-p.x,q.y-p.y);}
  const f=pn.area/per;return [[0,f],[a,f]];}
function beamLoads(i){
  const M=LM(i),panels=i===S.model.cur&&WB.panels.length?WB.panels:findPanels(M),out=new Map(),tmax=new Map(),notes=[];
  M.beams.forEach(b=>{out.set(b.id,[]);tmax.set(b.id,0);});
  for(const pn of panels){const sp=slabLoadProps(M,pn.key);if(sp.kind==="none")continue;const ld=slabLoads(sp),info=slabSpan(pn,sp);
    if(info.type==="irr")notes.push(`แผ่นพื้น ${sp.name} ไม่ใช่สี่เหลี่ยม กระจายน้ำหนักเฉลี่ยตามความยาวขอบ (พื้นที่/เส้นรอบรูป)`);
    const n=pn.poly.length;
    for(let e=0;e<n;e++){const A=pn.poly[e],B=pn.poly[(e+1)%n],prof=edgeProfile(pn,info,A,B);if(!prof)continue;
      const a=Math.hypot(B.x-A.x,B.y-A.y);
      for(const b of M.beams){const L=blen(b),u={x:(b.x2-b.x1)/L,y:(b.y2-b.y1)/L};
        const off=p=>Math.abs((p.x-b.x1)*u.y-(p.y-b.y1)*u.x);if(off(A)>TOL||off(B)>TOL)continue;
        const tA=(A.x-b.x1)*u.x+(A.y-b.y1)*u.y,tB=(B.x-b.x1)*u.x+(B.y-b.y1)*u.y,sg=tB>=tA?1:-1;
        const o0=Math.max(Math.min(tA,tB),0),o1=Math.min(Math.max(tA,tB),L);if(o1-o0<TOL)continue;
        tmax.set(b.id,Math.max(tmax.get(b.id),sp.t));
        for(let k=0;k<prof.length-1;k++){const [s0,f0]=prof[k],[s1,f1]=prof[k+1];
          let t0=tA+sg*s0,t1=tA+sg*s1,g0=f0,g1=f1;if(t0>t1){[t0,t1]=[t1,t0];[g0,g1]=[g1,g0];}
          const c0=Math.max(t0,o0),c1=Math.min(t1,o1);if(c1-c0<1e-6)continue;
          const fi=t=>g0+(g1-g0)*(t-t0)/((t1-t0)||1);
          out.get(b.id).push({s0:c0,s1:c1,d0:fi(c0)*ld.D,d1:fi(c1)*ld.D,l0:fi(c0)*ld.L,l1:fi(c1)*ld.L,src:`แผ่นพื้น ${sp.name}`,shape:info.type==="two"?(prof.length===3?"สามเหลี่ยม":"คางหมู"):"แผ่สม่ำเสมอ"});}}}}
  const gc=S.loads.gc;
  for(const b of M.beams){const L=blen(b),arr=out.get(b.id),hs=Math.max(0,b.h-tmax.get(b.id)),sw=b.b*hs*gc;
    arr.push({s0:0,s1:L,d0:sw,d1:sw,l0:0,l1:0,src:"น้ำหนักคานเอง",shape:"แผ่สม่ำเสมอ",note:`${fmt(b.b,2)} × (${fmt(b.h,2)} − ${fmt(tmax.get(b.id),2)}) × ${gc}`});
    const wl=wallLoad(b,i);if(wl.w>0)arr.push({s0:0,s1:L,d0:wl.w,d1:wl.w,l0:0,l1:0,src:`ผนัง${wl.type.name}`,shape:"แผ่สม่ำเสมอ",note:`${fmt(setW(wl.type),1)} × ${fmt(wl.h,2)}${wl.open?` × (1 − ${wl.open}%)`:""}`});}
  return {out,notes};}
function wallAutoH(b,i){const m=S.model;if(i>=m.stories.length-1)return 0;const above=m.stories[i+1];
  const bm=above.beams.find(x=>{const q1=projSeg(b.x1,b.y1,P1(x),P2(x)),q2=projSeg(b.x2,b.y2,P1(x),P2(x));return Math.hypot(q1.x-b.x1,q1.y-b.y1)<0.3&&Math.hypot(q2.x-b.x2,q2.y-b.y2)<0.3;});
  return Math.max(0,above.elev-m.stories[i].elev-(bm?bm.h:m.defBeam.h));}
function wallLoad(b,i){if(!b.wall||!b.wall.type)return {w:0};const type=S.loads.walls.find(x=>x.id===b.wall.type);if(!type)return {w:0};
  const auto=b.wall.h==null||b.wall.h==="";const h=auto?wallAutoH(b,i):+b.wall.h,open=+b.wall.open||0;
  return {w:setW(type)*h*(1-open/100),h,auto,open,type};}
function exteriorBeams(M,panels){const cnt=new Map(),key=(p,q)=>{const a=Math.round(p.x*1000)+","+Math.round(p.y*1000),c=Math.round(q.x*1000)+","+Math.round(q.y*1000);return a<c?a+"|"+c:c+"|"+a;};
  const edges=[];for(const pn of panels){const n=pn.poly.length;for(let e=0;e<n;e++){const A=pn.poly[e],B=pn.poly[(e+1)%n],k=key(A,B);cnt.set(k,(cnt.get(k)||0)+1);edges.push([k,A,B]);}}
  const ext=new Set();for(const [k,A,B] of edges){if(cnt.get(k)!==1)continue;
    for(const b of M.beams){const q1=projSeg(A.x,A.y,P1(b),P2(b)),q2=projSeg(B.x,B.y,P1(b),P2(b));if(Math.hypot(q1.x-A.x,q1.y-A.y)<TOL&&Math.hypot(q2.x-B.x,q2.y-B.y)<TOL)ext.add(b.id);
      else{const m=projSeg((A.x+B.x)/2,(A.y+B.y)/2,P1(b),P2(b));if(Math.hypot(m.x-(A.x+B.x)/2,m.y-(A.y+B.y)/2)<TOL)ext.add(b.id);}}}
  return ext;}
function loadAt(arr,t,key){let s=0;for(const p of arr){if(t<p.s0-1e-9||t>p.s1+1e-9)continue;const f=(t-p.s0)/((p.s1-p.s0)||1);s+=key==="d"?p.d0+(p.d1-p.d0)*f:key==="l"?p.l0+(p.l1-p.l0)*f:(p.d0+p.l0)+((p.d1+p.l1)-(p.d0+p.l0))*f;}return s;}
const pieceW=(p,k)=>(p.s1-p.s0)*(k==="d"?(p.d0+p.d1):(p.l0+p.l1))/2;

/* ---------- แรงลม (ข้อ 17) ---------- */
function windCalc(){const m=S.model,W=S.loads.wind;let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  m.stories.forEach((st,i)=>{const e=gridExt(LM(i));x0=Math.min(x0,e.x0);x1=Math.max(x1,e.x1);y0=Math.min(y0,e.y0);y1=Math.max(y1,e.y1);});
  const Bx=x1-x0,By=y1-y0,zs=m.stories.map(s=>s.elev).filter(z=>z>=0).sort((a,b)=>a-b);if(!zs.length)return null;
  const top=zs.at(-1)+(+W.roofH||0),row=W.terrain==="open"?2:1,k=W.pub?1.15:1;
  const p=z=>(z<=10?WIND.rows[0][row]:z<=20?WIND.rows[1][row]:WIND.rows[2][row])*k;
  const integ=(a,b)=>{let s=0;const br=[a,...[10,20,40].filter(v=>v>a&&v<b),b];for(let i=0;i<br.length-1;i++)s+=p((br[i]+br[i+1])/2)*(br[i+1]-br[i]);return s;};
  const rows=zs.map((z,i)=>{const lo=i===0?Math.max(0,z):(zs[i-1]+z)/2,hi=i===zs.length-1?top:(z+zs[i+1])/2;const q=integ(lo,hi);
    return {z,lo,hi,q,Fx:q*By,Fy:q*Bx,name:(m.stories.find(s=>s.elev===z)||{}).name};});
  let vx=0,vy=0;for(let i=rows.length-1;i>=0;i--){vx+=rows[i].Fx;vy+=rows[i].Fy;rows[i].Vx=vx;rows[i].Vy=vy;}
  const least=Math.min(Bx,By);
  return {rows,Bx,By,h:top,ok40:top<=40,ok3:top<=3*least,least,k};}

/* ---------- แผงคุณสมบัติขั้นน้ำหนัก ---------- */
function useOptions(sel){return LL.map((g,i)=>`<optgroup label="${esc(g[0]+" "+g[1])}">${g[2].map((r,j)=>`<option value="${i}-${j}" ${sel===i+"-"+j?"selected":""}>${esc(r[0])} (${r[1]})</option>`).join("")}</optgroup>`).join("");}
function layerRows(lst,kind,idx){return `<div class="tablewrap"><table class="lyr"><tr><th>ชั้นวัสดุ</th><th class="n">หนา (ม.)</th><th class="n">γ (กก./ลบ.ม.)</th><th class="n">กก./ตร.ม.</th><th></th></tr>
  ${lst.layers.map((l,k)=>`<tr><td><input data-ld="${kind}.${idx}.${k}.n" value="${esc(l.n)}"></td>
    ${l.w!=null?`<td colspan="2" class="muted">คิดต่อพื้นที่</td><td><input type="number" step="any" inputmode="decimal" data-ld="${kind}.${idx}.${k}.w" value="${l.w}"></td>`:
    `<td><input type="number" step="any" inputmode="decimal" data-ld="${kind}.${idx}.${k}.t" value="${l.t}"></td><td><input type="number" step="any" inputmode="decimal" data-ld="${kind}.${idx}.${k}.g" value="${l.g}"></td><td class="n">${fmt(layerW(l),1)}</td>`}
    <td><button class="btn xs" data-ldact="delLayer" data-k="${kind}.${idx}.${k}" aria-label="ลบชั้นวัสดุ">×</button></td></tr>`).join("")}
  <tr><td colspan="3"><b>รวม</b></td><td class="n"><b>${fmt(setW(lst),1)}</b></td><td></td></tr></table></div>
  <div class="flex"><button class="btn xs" data-ldact="addLayer" data-k="${kind}.${idx}.t">+ ชั้นวัสดุ (หนา × γ)</button><button class="btn xs" data-ldact="addLayer" data-k="${kind}.${idx}.w">+ วัสดุต่อพื้นที่</button></div>`;}
function loadsPanelHTML(){const M=LM(),T=WB.topo,L=S.loads,i=S.model.cur,tog=`<button class="sheet-toggle" data-wbact="panel">${WB.panelOpen?"ซ่อนแผง":"แสดงแผง"}</button>`;
  if(WB.selSlab.size){const pns=WB.panels.filter(p=>WB.selSlab.has(p.key));if(!pns.length)return tog;const sps=pns.map(p=>slabLoadProps(M,p.key));
    const same=k=>sps.every(s=>String(s[k])===String(sps[0][k]))?sps[0][k]:"";const sp=sps[0],ld=slabLoads(sp);
    return `${tog}<h3>น้ำหนักบนแผ่นพื้น${pns.length>1?` (เลือก ${pns.length} แผ่น)`:` ${esc(sp.name)}`}</h3>
      ${sp.kind==="none"?`<p class="note">แผ่นนี้เป็นช่องเปิด ไม่มีน้ำหนักพื้น เปลี่ยนชนิดได้ในขั้นโมเดล</p>`:""}
      <div class="row wide"><label for="lsU">ประเภทการใช้งาน</label><select id="lsU" data-lds="use">${same("use")===""?'<option value="" selected>หลายค่า</option>':""}${useOptions(same("use"))}</select></div>
      <div class="row wide"><label for="lsD">วัสดุปูผิวและฝ้า</label><select id="lsD" data-lds="sdl">${same("sdl")===""?'<option value="" selected>หลายค่า</option>':""}${L.sets.map(s=>`<option value="${s.id}" ${same("sdl")===s.id?"selected":""}>${esc(s.name)} (${fmt(setW(s),0)})</option>`).join("")}</select></div>
      <div class="row"><label for="lsP">น้ำหนักผนังกั้นห้องที่ไม่ระบุตำแหน่ง</label><input id="lsP" type="number" step="any" inputmode="decimal" data-lds="part" value="${same("part")}" placeholder="หลายค่า"><span class="u">กก./ตร.ม.</span></div>
      ${pns.length===1&&sp.kind!=="none"?`<div class="tablewrap"><table><tr class="grp"><td colspan="3">น้ำหนักบรรทุกคงที่ (นค.)</td></tr>
        <tr><td>น้ำหนักพื้นเอง</td><td class="f">${fmt(sp.t,2)} × ${L.gc}</td><td class="n">${fmt(ld.self,0)}</td></tr>
        <tr><td>วัสดุปูผิวและฝ้า</td><td class="f">${esc(ld.set?ld.set.name:"–")}</td><td class="n">${fmt(ld.sdl,0)}</td></tr>
        ${ld.part?`<tr><td>ผนังกั้นห้องไม่ระบุตำแหน่ง</td><td class="f">ข้อ 10</td><td class="n">${fmt(ld.part,0)}</td></tr>`:""}
        <tr><td><b>รวม นค.</b></td><td></td><td class="n"><b>${fmt(ld.D,0)}</b></td></tr>
        <tr class="grp"><td colspan="3">น้ำหนักบรรทุกจร (นจ.) ข้อ 11</td></tr><tr><td>${esc(LLitem(sp.use).name)}</td><td class="f">${esc(LLitem(sp.use).use)}</td><td class="n">${fmt(ld.L,0)}</td></tr>
        <tr class="grp"><td colspan="3">น้ำหนักบรรทุกปรับค่า ข้อ 7</td></tr><tr><td>1.4 นค. + 1.7 นจ.</td><td class="f">1.4 × ${fmt(ld.D,0)} + 1.7 × ${fmt(ld.L,0)}</td><td class="n">${fmt(1.4*ld.D+1.7*ld.L,0)}</td></tr></table></div>
        <p class="note">หน่วย กก./ตร.ม. ${esc(slabSpan(pns[0],sp).text)}</p>`:""}
      <div class="flex"><button class="btn" data-ldact="slabAllLoads">ใช้ค่านี้กับทุกแผ่นในชั้น</button></div>`;}
  if(WB.sel.size){const bs=M.beams.filter(b=>WB.sel.has(b.id)),b=bs[0],w=b.wall||{},res=beamLoads(i),arr=res.out.get(b.id)||[],wl=wallLoad(b,i);
    const same=k=>bs.every(x=>String((x.wall||{})[k]??"")===String(w[k]??""))?(w[k]??""):"__mixed";
    const tD=arr.reduce((a,p)=>a+pieceW(p,"d"),0),tL=arr.reduce((a,p)=>a+pieceW(p,"l"),0),Lb=blen(b);
    const ty=same("type");
    return `${tog}<h3>น้ำหนักบนคาน${bs.length>1?` (เลือก ${bs.length} ช่วง)`:` ${esc(b.name)}`}</h3>
      <div class="row wide"><label for="lbW">ผนังบนคาน</label><select id="lbW" data-ldb="type">${ty==="__mixed"?'<option value="__mixed" selected>หลายค่า</option>':""}<option value="" ${ty===""?"selected":""}>ไม่มีผนัง</option>${L.walls.map(x=>`<option value="${x.id}" ${ty===x.id?"selected":""}>${esc(x.name)} (${fmt(setW(x),0)} กก./ตร.ม.)</option>`).join("")}</select></div>
      <div class="row"><label for="lbH">ความสูงผนัง</label><input id="lbH" type="number" step="any" inputmode="decimal" data-ldb="h" value="${same("h")==="__mixed"?"":(w.h??"")}" placeholder="${bs.length===1?"อัตโนมัติ "+fmt(wallAutoH(b,i),2):"อัตโนมัติ"}"><span class="u">ม.</span></div>
      <div class="row"><label for="lbO">หักช่องเปิด</label><input id="lbO" type="number" step="any" inputmode="decimal" data-ldb="open" value="${same("open")==="__mixed"?"":(w.open??0)}"><span class="u">%</span></div>
      <p class="note">เว้นความสูงว่างไว้ให้โปรแกรมคิดจากระยะถึงคานชั้นบนลบความลึกคาน ไม่หักช่องเปิดจะได้ค่าที่ปลอดภัยกว่า</p>
      ${bs.length===1?`<h3>น้ำหนักที่กระทำบนคานช่วงนี้</h3>${beamLoadSVG(arr,Lb)}<div class="tablewrap"><table><tr><th>ที่มา</th><th>รูปแบบ</th><th class="n">นค. สูงสุด</th><th class="n">นจ. สูงสุด</th></tr>
        ${arr.map(p=>`<tr><td>${esc(p.src)}${p.note?`<br><span class="muted">${p.note}</span>`:""}</td><td>${p.shape}<br><span class="muted">${fmt(p.s0,2)}–${fmt(p.s1,2)} ม.</span></td><td class="n">${fmt(Math.max(p.d0,p.d1),0)}</td><td class="n">${fmt(Math.max(p.l0,p.l1),0)}</td></tr>`).join("")}
        <tr><td colspan="2"><b>น้ำหนักรวมทั้งช่วง ${fmt(Lb,2)} ม.</b></td><td class="n"><b>${fmt(tD,0)}</b></td><td class="n"><b>${fmt(tL,0)}</b></td></tr></table></div>
        <p class="note">หน่วย กก./ม. ยกเว้นแถวรวมเป็น กก. น้ำหนักคานเองคิดเฉพาะส่วนที่อยู่ใต้พื้นเพื่อไม่ให้นับซ้ำกับน้ำหนักพื้น</p>`:""}
      <div class="flex"><button class="btn" data-ldact="wallExt">ใส่ผนังนี้ทุกคานรอบนอกของชั้น</button></div>`;}
  if(WB.selCol.size) return `${tog}<h3>เสา</h3><p class="note">น้ำหนักลงเสาจะได้จากขั้นวิเคราะห์ โดยรวมแรงปฏิกิริยาของคานทุกชั้นและลดน้ำหนักจรตามจำนวนชั้นตามข้อ 13</p>`;
  const panels=WB.panels.filter(p=>slabProps(M,p.key).kind!=="none");let A=0,D=0,LLs=0;
  panels.forEach(p=>{const sp=slabLoadProps(M,p.key),ld=slabLoads(sp);A+=p.area;D+=ld.D*p.area;LLs+=ld.L*p.area;});
  const res=beamLoads(i);let bD=0,bL=0;res.out.forEach(arr=>arr.forEach(p=>{bD+=pieceW(p,"d");bL+=pieceW(p,"l");}));
  const wnd=windCalc();
  return `${tog}<h3>น้ำหนัก${esc(curStory().name)}</h3>
    <p class="note">แตะแผ่นพื้นเพื่อกำหนดประเภทการใช้งานและวัสดุปูผิว แตะคานเพื่อใส่ผนัง</p>
    <div class="tablewrap"><table><tr><td>แผ่นพื้น</td><td class="n">${panels.length} แผ่น ${fmt(A,2)} ตร.ม.</td></tr>
     <tr><td>น้ำหนักคงที่จากพื้น</td><td class="n">${fmt(D,0)} กก.</td></tr><tr><td>น้ำหนักจรจากพื้น</td><td class="n">${fmt(LLs,0)} กก.</td></tr>
     <tr><td>น้ำหนักคงที่ลงคานทั้งหมด (รวมคานเองและผนัง)</td><td class="n">${fmt(bD,0)} กก.</td></tr><tr><td>น้ำหนักจรลงคานทั้งหมด</td><td class="n">${fmt(bL,0)} กก.</td></tr></table></div>
    <p class="note">ตรวจสมดุล: น้ำหนักจรจากพื้นต้องเท่ากับที่ลงคาน ${Math.abs(LLs-bL)<1?"✓ ตรงกัน":"✗ ต่างกัน "+fmt(LLs-bL,0)+" กก. ตรวจว่าทุกขอบแผ่นพื้นมีคานรองรับ"}</p>
    ${res.notes.map(n=>`<div class="warn">${n}</div>`).join("")}
    <h3>แรงลม (ข้อ 17)</h3>
    <div class="row wide"><label for="lwT">สภาพภูมิประเทศ</label><select id="lwT" data-ldw="terrain"><option value="urban" ${L.wind.terrain==="urban"?"selected":""}>เมืองหรือชานเมือง</option><option value="open" ${L.wind.terrain==="open"?"selected":""}>โล่งหรือชายฝั่งทะเล</option></select></div>
    <div class="row wide"><label for="lwP">อาคารสาธารณะ ≥ 1,000 ตร.ม.</label><select id="lwP" data-ldw="pub"><option value="0" ${!L.wind.pub?"selected":""}>ไม่ใช่</option><option value="1" ${L.wind.pub?"selected":""}>ใช่ (เพิ่มร้อยละ 15)</option></select></div>
    <div class="row"><label for="lwR">ความสูงหลังคาเหนือระดับบนสุด</label><input id="lwR" type="number" step="any" inputmode="decimal" data-ldw="roofH" value="${L.wind.roofH}"><span class="u">ม.</span></div>
    ${wnd?`${!wnd.ok40||!wnd.ok3?`<div class="warn">อาคารสูง ${fmt(wnd.h,2)} ม. ${!wnd.ok40?"เกิน 40 ม.":`เกิน 3 เท่าของด้านแคบ (${fmt(wnd.least,2)} ม.)`} ใช้ตารางในข้อ 17 ไม่ได้ ต้องคำนวณแรงลมตามมาตรฐานที่กรมโยธาธิการและผังเมืองกำหนด</div>`:
      `<p class="note">อาคารสูง ${fmt(wnd.h,2)} ม. ด้านแคบ ${fmt(wnd.least,2)} ม. เข้าเงื่อนไขใช้ตารางข้อ 17 ได้ (สูงไม่เกิน 40 ม. และไม่เกิน 3 เท่าของด้านแคบ)</p>`}
      <div class="tablewrap"><table><tr><th>ระดับ</th><th class="n">ช่วงความสูงรับลม (ม.)</th><th class="n">Fx (กก.)</th><th class="n">Fy (กก.)</th></tr>
      ${wnd.rows.slice().reverse().map(r=>`<tr><td>${esc(r.name||"")}<br><span class="muted">+${fmt(r.z,2)}</span></td><td class="n">${fmt(r.lo,2)}–${fmt(r.hi,2)}</td><td class="n">${fmt(r.Fx,0)}</td><td class="n">${fmt(r.Fy,0)}</td></tr>`).join("")}
      <tr><td><b>แรงเฉือนที่ฐาน</b></td><td></td><td class="n"><b>${fmt(wnd.rows[0].Vx,0)}</b></td><td class="n"><b>${fmt(wnd.rows[0].Vy,0)}</b></td></tr></table></div>
      <p class="note">Fx คือลมพัดตามแกน x กระทำบนด้านกว้าง ${fmt(wnd.By,2)} ม. Fy คือลมพัดตามแกน y กระทำบนด้านกว้าง ${fmt(wnd.Bx,2)} ม. หน่วยแรงลมคูณพื้นที่ภาพฉายของอาคารในช่วงความสูงที่แต่ละชั้นรับ แรงนี้จะใช้เป็นแรงด้านข้างที่ระดับพื้นในขั้นวิเคราะห์</p>`:""}
    <h3>แผ่นดินไหว</h3><p class="note">โปรแกรมจะตรวจว่าที่ตั้งโครงการอยู่ในพื้นที่บังคับตามกฎกระทรวง พ.ศ. 2564 หรือไม่ จากรายชื่อพื้นที่ในตัวบท ส่วนนี้ยังไม่เปิดใช้จนกว่าจะตรวจรายชื่อพื้นที่ครบ</p>
    <h3>คลังวัสดุ</h3><p class="note">น้ำหนักคงที่คิดจากความหนา × หน่วยน้ำหนักของวัสดุจริงตามข้อ 9 ค่าเริ่มต้นเป็นค่าทั่วไป ควรปรับให้ตรงกับวัสดุที่ระบุในแบบ</p>
    <div class="row"><label for="lgc">หน่วยน้ำหนักคอนกรีตเสริมเหล็ก</label><input id="lgc" type="number" step="any" inputmode="decimal" data-ld="gc" value="${L.gc}"><span class="u">กก./ลบ.ม.</span></div>
    ${L.sets.map((s,k)=>`<details><summary>${esc(s.name)}: ${fmt(setW(s),1)} กก./ตร.ม.</summary><div class="row wide"><label>ชื่อชุด</label><input data-ld="sets.${k}.name" value="${esc(s.name)}"></div>${layerRows(s,"sets",k)}</details>`).join("")}
    <div class="flex"><button class="btn xs" data-ldact="addSet">+ ชุดวัสดุปูผิว</button></div>
    ${L.walls.map((s,k)=>`<details><summary>ผนัง${esc(s.name)}: ${fmt(setW(s),1)} กก./ตร.ม.</summary><div class="row wide"><label>ชื่อผนัง</label><input data-ld="walls.${k}.name" value="${esc(s.name)}"></div>${layerRows(s,"walls",k)}</details>`).join("")}
    <div class="flex"><button class="btn xs" data-ldact="addWall">+ ชนิดผนัง</button></div>`;}
function beamLoadSVG(arr,L){const W=290,H=70,pad=12,sc=(W-2*pad)/L;const br=new Set([0,L]);arr.forEach(p=>{br.add(p.s0);br.add(p.s1);});const xs=[...br].sort((a,b)=>a-b);
  let mx=0;xs.forEach(t=>{mx=Math.max(mx,loadAt(arr,t,"t"),loadAt(arr,t-1e-6,"t"),loadAt(arr,t+1e-6,"t"));});if(mx<=0)return "";
  const y=v=>H-14-v/mx*(H-26);let dD="M"+pad+" "+y(0),dT="M"+pad+" "+y(0);
  xs.forEach(t=>{const x=pad+t*sc;for(const e of [-1e-6,1e-6]){const tt=clamp(t+e,0,L);dD+=`L${x} ${y(loadAt(arr,tt,"d"))}`;dT+=`L${x} ${y(loadAt(arr,tt,"t"))}`;}});
  dD+=`L${pad+L*sc} ${y(0)}Z`;dT+=`L${pad+L*sc} ${y(0)}Z`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="แผนภาพน้ำหนักบนคาน"><path d="${dT}" class="lq-l"/><path d="${dD}" class="lq-d"/><line x1="${pad}" y1="${H-14}" x2="${W-pad}" y2="${H-14}" class="cb-line"/>
    <text class="cb-txt" x="${W-pad}" y="10" text-anchor="end">สูงสุด ${fmt(mx,0)} กก./ม.</text><text class="cb-txt" x="${pad}" y="${H-2}">นค. (เข้ม) + นจ. (อ่อน)</text></svg>`;}
function loadsOverlay(){if(!WB.showLoad)return "";const i=S.model.cur,M=LM(i),res=beamLoads(i);let mx=0;
  res.out.forEach(arr=>{arr.forEach(p=>{mx=Math.max(mx,p.d0+p.l0,p.d1+p.l1);});});if(mx<=0)return "";
  let s="";const hpx=26;
  for(const b of M.beams){const arr=res.out.get(b.id),L=blen(b),a=toS(P1(b)),c=toS(P2(b)),Ls=Math.hypot(c.x-a.x,c.y-a.y)||1,nx=(c.y-a.y)/Ls,ny=-(c.x-a.x)/Ls;
    const br=new Set([0,L]);arr.forEach(p=>{br.add(p.s0);br.add(p.s1);});const ts=[...br].sort((x,y)=>x-y);
    let d=`M${a.x} ${a.y}`;ts.forEach(t=>{for(const e of [-1e-6,1e-6]){const tt=clamp(t+e,0,L),v=loadAt(arr,tt,"t")/mx*hpx,px=a.x+(c.x-a.x)*tt/L,py=a.y+(c.y-a.y)*tt/L;d+=`L${px+nx*v} ${py+ny*v}`;}});
    d+=`L${c.x} ${c.y}Z`;s+=`<path class="ldp" d="${d}"/>`;}
  return s;}
function wallsOverlay(){const i=S.model.cur,M=LM(i);let s="";
  for(const b of M.beams){if(!b.wall||!b.wall.type)continue;const a=toS(P1(b)),c=toS(P2(b));s+=`<line class="wl" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}"/>`;}return s;}

/* ---------- เหตุการณ์ของขั้นน้ำหนัก ---------- */
function loadsChange(el){const L=S.loads,st=curStory();
  if(el.dataset.lds){const k=el.dataset.lds;let v=el.value;if(k==="part"){v=parseFloat(v);if(isNaN(v)||v<0)return;}else if(!v)return;
    pushHist();WB.selSlab.forEach(key=>{st.slabs[key]=Object.assign(st.slabs[key]||{},{[k]:v});});
    if(k!=="part")L.def[k]=v;changed();return true;}
  if(el.dataset.ldb){const k=el.dataset.ldb;let v=el.value;if(v==="__mixed")return;if(k!=="type"){v=v===""?(k==="h"?null:0):parseFloat(v);if(v!=null&&(isNaN(v)||v<0))return;}
    pushHist();st.beams.forEach(b=>{if(!WB.sel.has(b.id))return;b.wall=Object.assign({type:"",h:null,open:0},b.wall||{});b.wall[k]=v;});changed();return true;}
  if(el.dataset.ldw){const k=el.dataset.ldw;let v=el.value;if(k==="pub")v=v==="1";else if(k==="roofH"){v=parseFloat(v);if(isNaN(v)||v<0)return;}L.wind[k]=v;save();renderPanel();return true;}
  if(el.dataset.ld){const path=el.dataset.ld.split(".");let v=el.value;
    if(path[0]==="gc"){v=parseFloat(v);if(!(v>0))return;L.gc=v;save();changed();return true;}
    const obj=path.length===3?L[path[0]][+path[1]]:L[path[0]][+path[1]].layers[+path[2]],key=path.at(-1);
    if(key==="n"||key==="name"){v=v.trim();if(!v)return;}else{v=parseFloat(v);if(isNaN(v)||v<0)return;}
    obj[key]=v;save();changed();return true;}
  return false;}
function loadsAct(a){const L=S.loads,act=a.dataset.ldact,st=curStory();
  if(act==="addLayer"){const [kind,idx,t]=a.dataset.k.split(".");L[kind][+idx].layers.push(t==="w"?{n:"วัสดุใหม่",w:10}:{n:"วัสดุใหม่",t:0.01,g:2000});save();renderPanel();return true;}
  if(act==="delLayer"){const [kind,idx,k]=a.dataset.k.split(".");L[kind][+idx].layers.splice(+k,1);save();changed();return true;}
  if(act==="addSet"){L.sets.push({id:"set"+Date.now().toString(36),name:"ชุดวัสดุใหม่",layers:[{n:"ปูนทราย",t:0.04,g:2100}]});save();renderPanel();return true;}
  if(act==="addWall"){L.walls.push({id:"wall"+Date.now().toString(36),name:"ผนังใหม่",layers:[{n:"วัสดุผนัง",t:0.1,g:1000}]});save();renderPanel();return true;}
  if(act==="slabAllLoads"){const key=[...WB.selSlab][0],src=slabLoadProps(LM(),key);pushHist();
    WB.panels.forEach(p=>{st.slabs[p.key]=Object.assign(st.slabs[p.key]||{},{use:src.use,sdl:src.sdl,part:src.part});});changed();return true;}
  if(act==="wallExt"){const b0=st.beams.find(b=>WB.sel.has(b.id));if(!b0||!b0.wall||!b0.wall.type){alert("เลือกชนิดผนังของคานที่เลือกก่อน แล้วกดปุ่มนี้อีกครั้ง");return true;}
    const ext=exteriorBeams(LM(),WB.panels);if(!ext.size){alert("ยังหาคานรอบนอกไม่ได้ ต้องมีแผ่นพื้นที่คานล้อมครบก่อน");return true;}
    pushHist();st.beams.forEach(b=>{if(ext.has(b.id))b.wall=Object.assign({},b0.wall);});clearSel();ext.forEach(id=>WB.sel.add(id));changed();return true;}
  return false;}
