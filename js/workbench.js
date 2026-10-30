"use strict";
/* ============================================================
   STEP 1 (Workbench) — แปลนชั้น: กริด เสา คาน และการจัดคานต่อเนื่องอัตโนมัติ
   พิกัดโลกเป็นเมตร แกน x ไปทางขวา แกน y ลงล่าง (แกน 1 อยู่บน)
   ============================================================ */
const TOL=1e-3;
function curStory(){const m=S.model;m.cur=Math.max(0,Math.min(m.cur|0,m.stories.length-1));return m.stories[m.cur];}
function LM(i){const m=S.model,st=i==null?curStory():m.stories[i];return {grid:m.grid,defCol:m.defCol,defBeam:m.defBeam,defSlab:m.defSlab,
  get seq(){return m.seq;},set seq(v){m.seq=v;},columns:st.columns,beams:st.beams,slabs:st.slabs,over:st.over,story:st};}
const colBottom=i=>i>0?S.model.stories[i-1].elev:S.model.found;
const $=sel=>document.querySelector(sel);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const WB={v:null, tool:"select", sel:new Set(), selCol:new Set(), selSlab:new Set(), panels:[], mode:"model", showLoad:true, start:null, cur:null, curS:null,
  ptype:(matchMedia("(pointer:coarse)").matches?"touch":"mouse"), pointers:new Map(), gest:null, down:null, moved:false, panBase:null,
  pinch:null, lpTimer:null, ortho:true, hist:[], fut:[], topo:null, show3d:false, aim:false, multi:false, panelOpen:false, hintMin:innerWidth<600, cands:[], lines:[]};

/* ---------- เรขาคณิต ---------- */
function segInter(a,b,c,d){const r={x:b.x-a.x,y:b.y-a.y},q={x:d.x-c.x,y:d.y-c.y},den=r.x*q.y-r.y*q.x;
  if(Math.abs(den)<1e-12) return null;
  const t=((c.x-a.x)*q.y-(c.y-a.y)*q.x)/den, s=((c.x-a.x)*r.y-(c.y-a.y)*r.x)/den;
  return {t,s,x:a.x+t*r.x,y:a.y+t*r.y};}
function projSeg(px,py,a,b){const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy;let t=L2?((px-a.x)*dx+(py-a.y)*dy)/L2:0;t=clamp(t,0,1);return {x:a.x+t*dx,y:a.y+t*dy,t};}
const P1=b=>({x:b.x1,y:b.y1}), P2=b=>({x:b.x2,y:b.y2});
const blen=b=>Math.hypot(b.x2-b.x1,b.y2-b.y1);
function gridName(M,x,y){const gx=M.grid.x.find(g=>Math.abs(g.p-x)<TOL),gy=M.grid.y.find(g=>Math.abs(g.p-y)<TOL);return gx&&gy?gx.n+"-"+gy.n:null;}
function gridExt(M){const xs=M.grid.x.map(g=>g.p),ys=M.grid.y.map(g=>g.p);
  let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  for(const b of M.beams){x0=Math.min(x0,b.x1,b.x2);x1=Math.max(x1,b.x1,b.x2);y0=Math.min(y0,b.y1,b.y2);y1=Math.max(y1,b.y1,b.y2);}
  for(const c of M.columns){x0=Math.min(x0,c.x);x1=Math.max(x1,c.x);y0=Math.min(y0,c.y);y1=Math.max(y1,c.y);}
  return {x0,x1,y0,y1};}

/* ---------- จัดคานต่อเนื่องและจุดรองรับอัตโนมัติ ----------
   กฎ: (1) คานแนวเดียวกันที่ต่อปลายกันรวมเป็นคานต่อเนื่องเส้นเดียว
       (2) มีเสาที่จุดใด → จุดรองรับแบบเสา
       (3) ปลายคานหนึ่งไปชนกลางอีกคาน → คานที่ปลายชนวางบนคานนั้น (คานฝากคาน)
       (4) คานตัดกันกลางช่วงทั้งคู่ → คานลึกกว่ารับคานตื้นกว่า ถ้าลึกเท่ากันคานที่วาดก่อนเป็นคานรับ
       (5) ปลายคานสองเส้นชนกันโดยไม่มีเสา → แจ้งเตือน */
function analyzeModel(M){
  const B=M.beams, n=B.length, par=[...Array(n).keys()];
  const find=i=>par[i]===i?i:(par[i]=find(par[i]));
  const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<TOL;
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=B[i],b=B[j];
    const ra={x:a.x2-a.x1,y:a.y2-a.y1},rb={x:b.x2-b.x1,y:b.y2-b.y1};
    if(Math.abs(ra.x*rb.y-ra.y*rb.x)/(blen(a)*blen(b))>1e-6) continue;
    const share=near(P1(a),P1(b))||near(P1(a),P2(b))||near(P2(a),P1(b))||near(P2(a),P2(b));
    if(share) par[find(i)]=find(j);}
  const groups=new Map();
  for(let i=0;i<n;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
  const chains=[], beamChain=new Map();
  for(const idx of groups.values()){
    idx.sort((a,b)=>a-b);
    const m0=B[idx[0]], L0=blen(m0), u={x:(m0.x2-m0.x1)/L0,y:(m0.y2-m0.y1)/L0}, o={x:m0.x1,y:m0.y1};
    const tOf=p=>(p.x-o.x)*u.x+(p.y-o.y)*u.y;
    let t0=Infinity,t1=-Infinity;
    for(const i of idx){const b=B[i];for(const p of [P1(b),P2(b)]){const t=tOf(p);t0=Math.min(t0,t);t1=Math.max(t1,t);}}
    const at=t=>({x:o.x+u.x*t,y:o.y+u.y*t}), A0=at(t0), A1=at(t1), len=t1-t0;
    const name=m0.name, hCh=Math.max(...idx.map(i=>B[i].h));
    const pts=new Map();
    const put=(t,p)=>{const k=Math.round(t*1000);const old=pts.get(k);const rank={col:3,beam:2,load:1,corner:0};
      if(!old||rank[p.type]>rank[old.type]) pts.set(k,Object.assign({t},p));};
    for(const c of M.columns){const t=tOf(c), q=at(t);
      if(Math.hypot(q.x-c.x,q.y-c.y)<TOL && t>t0-TOL && t<t1+TOL) put(t,{type:"col",ref:c.id,label:c.name});}
    const inSet=new Set(idx);
    for(let k=0;k<n;k++){ if(inSet.has(k)) continue; const b=B[k];
      const it=segInter(A0,A1,P1(b),P2(b)); if(!it) continue;
      const lk=blen(b), et=TOL/len, es=TOL/lk;
      if(it.t<-et||it.t>1+et||it.s<-es||it.s>1+es) continue;
      const chEnd=it.t<et||it.t>1-et, kEnd=it.s<es||it.s>1-es, t=t0+clamp(it.t,0,1)*len;
      if(kEnd&&!chEnd) put(t,{type:"load",ref:b.id,label:b.name});
      else if(!kEnd&&chEnd) put(t,{type:"beam",ref:b.id,label:b.name});
      else if(!kEnd&&!chEnd){
        const mi=idx.find(i=>{const q=projSeg(it.x,it.y,P1(B[i]),P2(B[i]));return Math.hypot(q.x-it.x,q.y-it.y)<TOL;});
        const mine=B[mi!=null?mi:idx[0]].id, key=[b.id,mine].sort().join("|"), ov=M.over&&M.over[key];
        const kDeeper=ov?ov===b.id:(b.h>hCh+1e-9||(Math.abs(b.h-hCh)<1e-9&&k<idx[0]));
        put(t,Object.assign(kDeeper?{type:"beam",ref:b.id,label:b.name}:{type:"load",ref:b.id,label:b.name},{cross:key,mine,manual:!!ov}));}
      else put(t,{type:"corner",ref:b.id,label:b.name});
    }
    const list=[...pts.values()].sort((a,b)=>a.t-b.t);
    const sup=list.filter(p=>p.type==="col"||p.type==="beam");
    const spans=[]; for(let i=0;i<sup.length-1;i++) spans.push({t0:sup[i].t,t1:sup[i+1].t,L:sup[i+1].t-sup[i].t});
    const cantL=sup.length?sup[0].t-t0:0, cantR=sup.length?t1-sup.at(-1).t:0;
    const warnings=[];
    if(sup.length===0) warnings.push("ไม่มีจุดรองรับเลย คานนี้ลอยอยู่ ให้วางเสาหรือต่อปลายคานเข้ากับคานอื่น");
    else if(sup.length===1) warnings.push("มีจุดรองรับเพียงจุดเดียว คานจะหมุนรอบจุดนั้นได้ ต้องมีอย่างน้อย 2 จุด");
    for(const p of list) if(p.type==="corner") warnings.push(`ปลายคานชนกับปลายคาน ${p.label} โดยไม่มีเสา จุดนี้ไม่มีอะไรรองรับ`);
    const sizes=new Set(idx.map(i=>B[i].b+"×"+B[i].h));
    if(sizes.size>1) warnings.push("ช่วงคานในแนวเดียวกันมีขนาดต่างกัน ตรวจว่าตั้งใจหรือไม่");
    const ci=chains.length;
    chains.push({members:idx.map(i=>B[i].id), idxs:idx, name, u, o, t0, t1, len, pts:list, sup, spans, cantL, cantR, warnings, A0, A1});
    for(const i of idx) beamChain.set(B[i].id,ci);
  }
  // ตรวจคานที่รองรับกันและกันเป็นวง
  const byId=new Map(B.map(b=>[b.id,b]));
  chains.forEach((ch,i)=>ch.sup.filter(p=>p.type==="beam").forEach(p=>{const j=beamChain.get(p.ref);
    if(j!=null&&chains[j].sup.some(q=>q.type==="beam"&&beamChain.get(q.ref)===i)) ch.warnings.push(`คานนี้และ ${chains[j].name} รองรับกันและกัน ต้องมีเสาอย่างน้อยหนึ่งจุด`);}));
  chains.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  beamChain.clear(); chains.forEach((ch,i)=>ch.members.forEach(id=>beamChain.set(id,i)));
  return {chains, beamChain, byId};
}

/* ---------- แผงพื้นอัตโนมัติจากวงคานที่ปิดล้อม ---------- */
function findPanels(M){const B=M.beams,nodes=[];
  const nid=(x,y)=>{for(let i=0;i<nodes.length;i++)if(Math.hypot(nodes[i].x-x,nodes[i].y-y)<TOL)return i;nodes.push({x,y});return nodes.length-1;};
  for(const b of B){nid(b.x1,b.y1);nid(b.x2,b.y2);}
  for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++){const r=segInter(P1(B[i]),P2(B[i]),P1(B[j]),P2(B[j]));if(r&&r.t>-1e-6&&r.t<1+1e-6&&r.s>-1e-6&&r.s<1+1e-6)nid(r.x,r.y);}
  const E=new Set(),adj=nodes.map(()=>[]);
  for(const b of B){const on=[];nodes.forEach((n,i)=>{const q=projSeg(n.x,n.y,P1(b),P2(b));if(Math.hypot(q.x-n.x,q.y-n.y)<TOL)on.push([q.t,i]);});on.sort((a,c)=>a[0]-c[0]);
    for(let k=0;k<on.length-1;k++){const a=on[k][1],c=on[k+1][1];if(a===c)continue;const key=a<c?a+"-"+c:c+"-"+a;if(E.has(key))continue;E.add(key);adj[a].push(c);adj[c].push(a);}}
  const ang=(a,c)=>Math.atan2(nodes[c].y-nodes[a].y,nodes[c].x-nodes[a].x);adj.forEach((l,i)=>l.sort((p,q)=>ang(i,p)-ang(i,q)));
  const used=new Set(),out=[];
  for(let u=0;u<nodes.length;u++)for(const v of adj[u]){if(used.has(u+">"+v))continue;const f=[];let a=u,c=v,g=0;
    while(!used.has(a+">"+c)&&g++<4000){used.add(a+">"+c);f.push(a);const l=adj[c],i=l.indexOf(a);const nx=l[(i-1+l.length)%l.length];a=c;c=nx;}
    let ar=0,cx=0,cy=0;for(let i=0;i<f.length;i++){const p=nodes[f[i]],q=nodes[f[(i+1)%f.length]],cr=p.x*q.y-q.x*p.y;ar+=cr;cx+=(p.x+q.x)*cr;cy+=(p.y+q.y)*cr;}
    ar/=2;if(ar<=0.01)continue;cx/=6*ar;cy/=6*ar;
    let poly=f.map(i=>nodes[i]);poly=poly.filter((p,i)=>{const a2=poly[(i-1+poly.length)%poly.length],b2=poly[(i+1)%poly.length];return Math.abs((p.x-a2.x)*(b2.y-p.y)-(p.y-a2.y)*(b2.x-p.x))>1e-6;});
    const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y),bw=Math.max(...xs)-Math.min(...xs),bh=Math.max(...ys)-Math.min(...ys);
    const rect=poly.length===4&&Math.abs(bw*bh-ar)<1e-4;
    out.push({key:Math.round(cx*100)+","+Math.round(cy*100),poly,area:ar,cx,cy,rect,lx:bw,ly:bh});}
  return out;}
function slabProps(M,key){return Object.assign({},M.defSlab,M.slabs[key]||{});}
function slabSpan(pn,sp){if(sp.kind==="none")return {type:"none",text:"ช่องเปิด ไม่มีพื้น"};
  if(sp.kind==="plank")return {type:"one",text:"แผ่นพื้นสำเร็จรูป พาดช่วงสั้น (ทางเดียว)",dir:pn.lx<=pn.ly?"x":"y"};
  if(!pn.rect)return {type:"irr",text:"รูปทรงไม่ใช่สี่เหลี่ยม จะแยกตรวจในขั้นออกแบบ"};
  const S2=Math.min(pn.lx,pn.ly),L2=Math.max(pn.lx,pn.ly),m=S2/L2;
  return m<0.5?{type:"one",m,S:S2,L:L2,dir:pn.lx<=pn.ly?"x":"y",text:`m = S/L = ${fmt(S2,2)}/${fmt(L2,2)} = ${fmt(m,2)} < 0.5 จึงเป็นพื้นทางเดียว ถ่ายน้ำหนักลงคานด้านยาวสองด้าน`}
    :{type:"two",m,S:S2,L:L2,text:`m = S/L = ${fmt(S2,2)}/${fmt(L2,2)} = ${fmt(m,2)} ≥ 0.5 จึงเป็นพื้นสองทาง ถ่ายน้ำหนักลงคานทั้งสี่ด้าน`};}
function inPoly(x,y,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)c=!c;}return c;}
function clearSel(){WB.sel.clear();WB.selCol.clear();WB.selSlab.clear();}

/* ---------- การดูดจุด ---------- */
function refreshSnap(){const M=LM(),P=[],L=[];
  for(const gx of M.grid.x)for(const gy of M.grid.y)P.push({x:gx.p,y:gy.p,k:"grid",lab:gx.n+"-"+gy.n});
  for(const c of M.columns)P.push({x:c.x,y:c.y,k:"col",lab:c.name});
  for(const b of M.beams){P.push({x:b.x1,y:b.y1,k:"end",lab:b.name},{x:b.x2,y:b.y2,k:"end",lab:b.name},{x:(b.x1+b.x2)/2,y:(b.y1+b.y2)/2,k:"mid",lab:b.name});
    L.push({a:P1(b),b:P2(b),k:"onbeam",lab:b.name});}
  for(let i=0;i<M.beams.length;i++)for(let j=i+1;j<M.beams.length;j++){const a=M.beams[i],b=M.beams[j];
    const r=segInter(P1(a),P2(a),P1(b),P2(b)); if(r&&r.t>1e-6&&r.t<1-1e-6&&r.s>1e-6&&r.s<1-1e-6)P.push({x:r.x,y:r.y,k:"int",lab:a.name+"/"+b.name});}
  const e=gridExt(M),m=1.5;
  for(const gx of M.grid.x)L.push({a:{x:gx.p,y:e.y0-m},b:{x:gx.p,y:e.y1+m},k:"ongrid",lab:gx.n});
  for(const gy of M.grid.y)L.push({a:{x:e.x0-m,y:gy.p},b:{x:e.x1+m,y:gy.p},k:"ongrid",lab:gy.n});
  WB.cands=P; WB.lines=L;}
const SNAPNAME={grid:"จุดตัดกริด",col:"ศูนย์กลางเสา",end:"ปลายคาน",mid:"กึ่งกลางคาน",int:"จุดตัดคาน",onbeam:"บนคาน",ongrid:"บนแนวกริด",free:"ตำแหน่งอิสระ"};
function doSnap(wx,wy){
  const r=(WB.ptype==="touch"?24:10)/WB.v.s, st=WB.tool==="beam"?WB.start:null;
  let px=wx,py=wy,axis=null;
  if(WB.ortho&&st){ if(Math.abs(wx-st.x)>=Math.abs(wy-st.y)){py=st.y;axis="h";} else {px=st.x;axis="v";} }
  let best=null,bd=Infinity;
  for(const c of WB.cands){
    if(axis==="h"&&Math.abs(c.y-st.y)>TOL)continue; if(axis==="v"&&Math.abs(c.x-st.x)>TOL)continue;
    const d=Math.hypot(c.x-px,c.y-py); const sc=d+((c.k==="mid"||c.k==="int")?r*.3:0);
    if(d<=r&&sc<bd){bd=sc;best=c;}}
  if(best) return {x:best.x,y:best.y,k:best.k,lab:best.lab};
  let lb=null; bd=Infinity;
  for(const L of WB.lines){let q;
    if(axis){const o={x:st.x,y:st.y},d2=axis==="h"?{x:st.x+1,y:st.y}:{x:st.x,y:st.y+1};const it=segInter(o,d2,L.a,L.b);
      if(!it||it.s<-1e-6||it.s>1+1e-6)continue; q={x:it.x,y:it.y};}
    else q=projSeg(px,py,L.a,L.b);
    const dd=Math.hypot(q.x-px,q.y-py); if(dd<=r&&dd<bd){bd=dd;lb={x:q.x,y:q.y,k:L.k,lab:L.lab};}}
  if(lb) return lb;
  return {x:Math.round(px*100)/100,y:Math.round(py*100)/100,k:"free"};
}

/* ---------- แก้ไขโมเดล ---------- */
function pushHist(){WB.hist.push(JSON.stringify(S.model));if(WB.hist.length>100)WB.hist.shift();WB.fut=[];}
function changed(){save();WB.topo=analyzeModel(LM());WB.panels=findPanels(LM());renderStories();refreshSnap();drawAll();renderPanel();build3D();updateTools();}
function undo(){if(!WB.hist.length)return;WB.fut.push(JSON.stringify(S.model));S.model=JSON.parse(WB.hist.pop());clearSel();changed();}
function redo(){if(!WB.fut.length)return;WB.hist.push(JSON.stringify(S.model));S.model=JSON.parse(WB.fut.pop());clearSel();changed();}
function nextBeamName(){const M=LM(),pre=S.model.cur===0?"GB":"B";let k=1;const used=new Set(M.beams.map(b=>b.name));while(used.has(pre+k))k++;return pre+k;}
function addColumn(p){const M=LM();if(M.columns.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<TOL))return false;
  const id="c"+(++M.seq);M.columns.push({id,name:gridName(M,p.x,p.y)||("C"+M.seq),x:p.x,y:p.y,b:M.defCol.b,h:M.defCol.h});return true;}
function addBeam(a,b){const M=LM();if(Math.hypot(a.x-b.x,a.y-b.y)<0.01)return false;
  if(M.beams.some(x=>(Math.hypot(x.x1-a.x,x.y1-a.y)<TOL&&Math.hypot(x.x2-b.x,x.y2-b.y)<TOL)||(Math.hypot(x.x1-b.x,x.y1-b.y)<TOL&&Math.hypot(x.x2-a.x,x.y2-a.y)<TOL)))return false;
  const d={x:b.x-a.x,y:b.y-a.y};
  const prev=M.beams.find(x=>{const r={x:x.x2-x.x1,y:x.y2-x.y1};return Math.abs(r.x*d.y-r.y*d.x)/(Math.hypot(r.x,r.y)*Math.hypot(d.x,d.y))<1e-6&&(Math.hypot(x.x1-a.x,x.y1-a.y)<TOL||Math.hypot(x.x2-a.x,x.y2-a.y)<TOL);});
  const id="b"+(++M.seq);
  M.beams.push({id,name:prev?prev.name:nextBeamName(),x1:a.x,y1:a.y,x2:b.x,y2:b.y,b:prev?prev.b:M.defBeam.b,h:prev?prev.h:M.defBeam.h});return true;}
function deleteSel(){const st=curStory();if(!WB.sel.size&&!WB.selCol.size&&!WB.selSlab.size)return;pushHist();
  st.beams=st.beams.filter(b=>!WB.sel.has(b.id));st.columns=st.columns.filter(c=>!WB.selCol.has(c.id));
  WB.selSlab.forEach(k=>{st.slabs[k]=Object.assign(st.slabs[k]||{},{kind:"none"});});clearSel();changed();}
function place(){const p=WB.cur;if(!p)return;
  if(WB.tool==="column"){pushHist();if(addColumn(p))changed();else WB.hist.pop();}
  else if(WB.tool==="beam"){
    if(!WB.start){WB.start={x:p.x,y:p.y};refreshHint();drawDyn();return;}
    if(Math.hypot(p.x-WB.start.x,p.y-WB.start.y)<0.01){endChain();return;}
    pushHist();if(addBeam(WB.start,p)){WB.start={x:p.x,y:p.y};changed();}else{WB.hist.pop();WB.start={x:p.x,y:p.y};drawDyn();}
    refreshHint();}
}
function endChain(){WB.start=null;hideLen();refreshHint();drawDyn();}
function selectHit(h,add){
  if(!add)clearSel();
  if(h){const set=h.t==="beam"?WB.sel:h.t==="col"?WB.selCol:WB.selSlab;if(add&&set.has(h.id))set.delete(h.id);else set.add(h.id);}
  if(h) WB.panelOpen=WB.panelOpen||WB.ptype!=="touch"; 
  drawAll();renderPanel();build3D();}
function hit(wx,wy){const r=(WB.ptype==="touch"?16:7)/WB.v.s,M=LM();
  for(let i=M.columns.length-1;i>=0;i--){const c=M.columns[i];if(Math.abs(wx-c.x)<=c.b/2+r&&Math.abs(wy-c.y)<=c.h/2+r)return {t:"col",id:c.id};}
  let best=null,bd=Infinity;
  for(const b of M.beams){const q=projSeg(wx,wy,P1(b),P2(b)),d=Math.hypot(q.x-wx,q.y-wy);if(d<=Math.max(r,b.b/2)&&d<bd){bd=d;best={t:"beam",id:b.id};}}
  if(best)return best;
  for(const pn of WB.panels) if(inPoly(wx,wy,pn.poly)) return {t:"slab",id:pn.key};
  return null;}

/* ---------- มุมมอง ---------- */
const toS=p=>({x:p.x*WB.v.s+WB.v.tx,y:p.y*WB.v.s+WB.v.ty});
const toW=p=>({x:(p.x-WB.v.tx)/WB.v.s,y:(p.y-WB.v.ty)/WB.v.s});
function fitView(){const svg=$("#wbSvg");if(!svg)return;const r=svg.getBoundingClientRect(),e=gridExt(LM());
  const W=Math.max(r.width,200),H=Math.max(r.height,200),padT=(WB.hintMin?52:104)+66,padB=24,padL=50,padR=24;
  const s=clamp(Math.min((W-padL-padR)/(e.x1-e.x0+3),(H-padT-padB)/(e.y1-e.y0+3)),6,300);
  const cw=(e.x1-e.x0+3)*s, chh=(e.y1-e.y0+3)*s;
  WB.v={s,tx:padL+(W-padL-padR-cw)/2-(e.x0-1.5)*s,ty:padT+(H-padT-padB-chh)/2-(e.y0-1.5)*s};drawAll();}
/* ---------- วาดแปลน ---------- */
function drawAll(){const g=$("#wbStatic");if(!g)return;g.innerHTML=drawStatic();drawDyn();}
function rectPath(b,minPx){const a=toS(P1(b)),c=toS(P2(b)),L=Math.hypot(c.x-a.x,c.y-a.y)||1,w=Math.max(b.b*WB.v.s,minPx)/2,nx=-(c.y-a.y)/L*w,ny=(c.x-a.x)/L*w;
  return `M${a.x+nx} ${a.y+ny}L${c.x+nx} ${c.y+ny}L${c.x-nx} ${c.y-ny}L${a.x-nx} ${a.y-ny}Z`;}
function drawStatic(){const M=LM(),v=WB.v,e=gridExt(M),m=1.5,T=WB.topo;let s="";
  const gy0=toS({x:0,y:e.y0-m}).y, gx0=toS({x:e.x0-m,y:0}).x, gy1=toS({x:0,y:e.y1+m}).y, gx1=toS({x:e.x1+m,y:0}).x;
  for(const g of M.grid.x){const x=toS({x:g.p,y:0}).x;s+=`<line class="gl" x1="${x}" y1="${gy0}" x2="${x}" y2="${gy1}"/><circle class="gb" cx="${x}" cy="${gy0-12}" r="12"/><text class="gt" x="${x}" y="${gy0-12}">${esc(g.n)}</text>`;}
  for(const g of M.grid.y){const y=toS({x:0,y:g.p}).y;s+=`<line class="gl" x1="${gx0}" y1="${y}" x2="${gx1}" y2="${y}"/><circle class="gb" cx="${gx0-12}" cy="${y}" r="12"/><text class="gt" x="${gx0-12}" y="${y}">${esc(g.n)}</text>`;}
  // มิติระยะกริด
  const xs=M.grid.x.map(g=>g.p).sort((a,b)=>a-b), ys=M.grid.y.map(g=>g.p).sort((a,b)=>a-b);
  const dy=gy0-32; for(let i=0;i<xs.length-1;i++){const a=toS({x:xs[i],y:0}).x,b=toS({x:xs[i+1],y:0}).x;
    s+=`<line class="gdl" x1="${a}" y1="${dy}" x2="${b}" y2="${dy}"/><line class="gdl" x1="${a}" y1="${dy-4}" x2="${a}" y2="${dy+4}"/><line class="gdl" x1="${b}" y1="${dy-4}" x2="${b}" y2="${dy+4}"/>`;
    if(b-a>34) s+=`<text class="gd" x="${(a+b)/2}" y="${dy-4}">${fmt(xs[i+1]-xs[i],2)}</text>`;}
  const dx=gx0-32; for(let i=0;i<ys.length-1;i++){const a=toS({x:0,y:ys[i]}).y,b=toS({x:0,y:ys[i+1]}).y;
    s+=`<line class="gdl" x1="${dx}" y1="${a}" x2="${dx}" y2="${b}"/><line class="gdl" x1="${dx-4}" y1="${a}" x2="${dx+4}" y2="${a}"/><line class="gdl" x1="${dx-4}" y1="${b}" x2="${dx+4}" y2="${b}"/>`;
    if(b-a>34) s+=`<text class="gd" transform="translate(${dx-5} ${(a+b)/2}) rotate(-90)">${fmt(ys[i+1]-ys[i],2)}</text>`;}
  // ชั้นล่างถัดลงไป (เส้นจาง) ช่วยวางให้ตรงกัน
  if(S.model.cur>0){const G=LM(S.model.cur-1);
    for(const b of G.beams)s+=`<path class="gh" d="${rectPath(b,3)}"/>`;
    for(const c of G.columns){const p=toS(c),w2=Math.max(c.b*v.s,6),h2=Math.max(c.h*v.s,6);s+=`<rect class="gh" x="${p.x-w2/2}" y="${p.y-h2/2}" width="${w2}" height="${h2}"/>`;}}
  // แผ่นพื้น
  for(const pn of WB.panels){const sp=slabProps(M,pn.key),info=slabSpan(pn,sp),d="M"+pn.poly.map(q=>{const a=toS(q);return a.x+" "+a.y;}).join("L")+"Z";
    const sel=WB.selSlab.has(pn.key);s+=`<path class="sl ${sp.kind==="none"?"none":""} ${sel?"sel":""}" d="${d}"/>`;
    const c=toS({x:pn.cx,y:pn.cy});
    if(sp.kind==="none"){const bb=pn.poly.map(toS);const xs=bb.map(q=>q.x),ys=bb.map(q=>q.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
      if(pn.rect)s+=`<path class="slx" d="M${x0} ${y0}L${x1} ${y1}M${x1} ${y0}L${x0} ${y1}"/>`;}
    else if(v.s>=18){const a=Math.min(pn.lx,pn.ly)*v.s*0.28;
      if(info.type==="two")s+=`<path class="sar" d="M${c.x-a} ${c.y}H${c.x+a}M${c.x} ${c.y-a}V${c.y+a}M${c.x-a+5} ${c.y-4}L${c.x-a} ${c.y}L${c.x-a+5} ${c.y+4}M${c.x+a-5} ${c.y-4}L${c.x+a} ${c.y}L${c.x+a-5} ${c.y+4}M${c.x-4} ${c.y-a+5}L${c.x} ${c.y-a}L${c.x+4} ${c.y-a+5}M${c.x-4} ${c.y+a-5}L${c.x} ${c.y+a}L${c.x+4} ${c.y+a-5}"/>`;
      else if(info.type==="one"){if(info.dir==="x")s+=`<path class="sar" d="M${c.x-a} ${c.y}H${c.x+a}M${c.x-a+5} ${c.y-4}L${c.x-a} ${c.y}L${c.x-a+5} ${c.y+4}M${c.x+a-5} ${c.y-4}L${c.x+a} ${c.y}L${c.x+a-5} ${c.y+4}"/>`;
        else s+=`<path class="sar" d="M${c.x} ${c.y-a}V${c.y+a}M${c.x-4} ${c.y-a+5}L${c.x} ${c.y-a}L${c.x+4} ${c.y-a+5}M${c.x-4} ${c.y+a-5}L${c.x} ${c.y+a}L${c.x+4} ${c.y+a-5}"/>`;}
      if(WB.mode==="loads"){const lp=slabLoadProps(M,pn.key),ld=slabLoads(lp);s+=`<text class="slt" x="${c.x+6}" y="${c.y-6}">${esc(sp.name)}</text><text class="slt2" x="${c.x+6}" y="${c.y+10}">นจ. ${fmt(ld.L,0)}</text><text class="slt2" x="${c.x+6}" y="${c.y+23}">นค. ${fmt(ld.D,0)}</text>`;}
      else s+=`<text class="slt" x="${c.x+6}" y="${c.y-6}">${esc(sp.name)}</text><text class="slt2" x="${c.x+6}" y="${c.y+14}">t=${fmt(sp.t,2)}</text>`;}}
  // คาน
  let selChain=null; if(WB.sel.size===1&&T){const id=[...WB.sel][0];selChain=T.chains[T.beamChain.get(id)];}
  const chMem=new Set(selChain?selChain.members:[]);
  const bad=new Set();if(T)T.chains.forEach(ch=>{if(ch.warnings.length)ch.members.forEach(id=>bad.add(id));});
  for(const b of M.beams){const cls=WB.sel.has(b.id)?"sel":chMem.has(b.id)?"ch":"";s+=`<path class="bm ${cls} ${bad.has(b.id)?"bad":""}" d="${rectPath(b,4)}"/>`;}
  if(WB.mode==="loads") s+=wallsOverlay()+loadsOverlay();
  // เสา
  for(const c of M.columns){const p=toS(c),w=Math.max(c.b*v.s,6),h=Math.max(c.h*v.s,6);s+=`<rect class="co ${WB.selCol.has(c.id)?"sel":""}" x="${p.x-w/2}" y="${p.y-h/2}" width="${w}" height="${h}"/>`;}
  // ป้ายชื่อคาน (หนึ่งป้ายต่อช่วงคานที่วาด) เมื่อซูมพอ
  if(v.s>=22&&T){const shown=new Set();
    for(const ch of T.chains){ch.idxs.forEach((i,k)=>{const b=M.beams[i];const a=toS(P1(b)),c=toS(P2(b));if(Math.hypot(c.x-a.x,c.y-a.y)<60)return;
      const mx=(a.x+c.x)/2,my=(a.y+c.y)/2,ang=Math.atan2(c.y-a.y,c.x-a.x)*180/Math.PI,rot=(ang>90||ang<-90)?ang+180:ang;
      const off=Math.max(b.b*v.s,4)/2+9;
      s+=`<text class="bl" transform="translate(${mx} ${my}) rotate(${rot}) translate(0 ${-off})">${esc(b.name)} ${fmt(b.b,2)}×${fmt(b.h,2)}</text>`;});}
    for(const c of M.columns){const p=toS(c);s+=`<text class="cl" x="${p.x+Math.max(c.b*v.s,6)/2+3}" y="${p.y+Math.max(c.h*v.s,6)/2+11}">${esc(c.name)}</text>`;}}
  // สัญลักษณ์จุดรองรับของคานต่อเนื่องที่เลือก
  if(selChain){for(const p of selChain.pts){const q=toS({x:selChain.o.x+selChain.u.x*p.t,y:selChain.o.y+selChain.u.y*p.t});
    if(p.type==="col") s+=`<path class="sup" d="M${q.x} ${q.y+5}l-8 13h16z"/>`;
    else if(p.type==="beam") s+=`<circle class="bsup" cx="${q.x}" cy="${q.y}" r="7"/>`;
    else if(p.type==="load") s+=`<path class="ld" d="M${q.x} ${q.y-26}v18m-5 -6l5 6 5-6"/>`;}}
  // เครื่องหมายเตือน
  if(T) for(const ch of T.chains){ if(!ch.warnings.length) continue; const q=toS({x:(ch.A0.x+ch.A1.x)/2,y:(ch.A0.y+ch.A1.y)/2});
    s+=`<circle class="wn" cx="${q.x}" cy="${q.y}" r="9"/><text class="wnt" x="${q.x}" y="${q.y}">!</text>`;}
  return s;}
function marker(p,k){const x=p.x,y=p.y,r=7;
  switch(k){case "grid":return `<rect class="mk" x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}"/>`;
    case "col":return `<circle class="mk" cx="${x}" cy="${y}" r="${r+1}"/>`;
    case "end":return `<rect class="mkf" x="${x-5}" y="${y-5}" width="10" height="10"/>`;
    case "mid":return `<path class="mk" d="M${x} ${y-r-1}L${x+r+1} ${y+r}L${x-r-1} ${y+r}Z"/>`;
    case "int":return `<path class="mk" d="M${x-r} ${y-r}L${x+r} ${y+r}M${x+r} ${y-r}L${x-r} ${y+r}"/>`;
    case "onbeam":return `<path class="mk" d="M${x} ${y-r}L${x+r} ${y}L${x} ${y+r}L${x-r} ${y}Z"/>`;
    case "ongrid":return `<path class="mk" stroke-dasharray="3 2" d="M${x} ${y-r}L${x+r} ${y}L${x} ${y+r}L${x-r} ${y}Z"/>`;
    default:return `<path class="mk" d="M${x-5} ${y}H${x+5}M${x} ${y-5}V${y+5}"/>`;}}
function drawDyn(){const g=$("#wbDyn"),o=$("#wbOver");if(!g)return;let s="",ov="";
  const drawing=WB.tool==="column"||WB.tool==="beam";
  if(drawing&&WB.cur&&(WB.ptype==="mouse"||WB.aim)){
    const c=toS(WB.cur);
    if(WB.tool==="beam"&&WB.start){const a=toS(WB.start),L=Math.hypot(WB.cur.x-WB.start.x,WB.cur.y-WB.start.y);
      s+=`<line class="pv" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}"/>`;
      if(L>0.01) s+=`<text class="pt" x="${(a.x+c.x)/2+8}" y="${(a.y+c.y)/2-8}">${fmt(L,2)} ม.</text>`;}
    if(WB.ortho&&WB.tool==="beam"&&WB.start){const a=toS(WB.start);s+=`<line class="og" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}"/>`;}
    s+=marker(c,WB.cur.k);
    s+=`<text class="pt" x="${c.x+12}" y="${c.y+22}">${SNAPNAME[WB.cur.k]}${WB.cur.lab&&WB.cur.k!=="free"?" "+esc(WB.cur.lab):""}</text>`;
  }
  if(WB.tool==="beam"&&WB.start){const a=toS(WB.start);s+=`<circle class="mkf" cx="${a.x}" cy="${a.y}" r="4"/>`;}
  g.innerHTML=s;
  // แว่นขยายสำหรับนิ้ว
  if(WB.aim&&WB.curS){const svg=$("#wbSvg").getBoundingClientRect(),f=WB.curS,R=62,z=2.2;
    let lx=f.x,ly=f.y-R-48; if(ly<R+4) ly=f.y+R+48; lx=clamp(lx,R+4,svg.width-R-4);
    ov=`<clipPath id="lpc"><circle cx="${lx}" cy="${ly}" r="${R}"/></clipPath><g clip-path="url(#lpc)"><rect class="lpbg" x="${lx-R}" y="${ly-R}" width="${2*R}" height="${2*R}"/>
      <use href="#wbScene" transform="translate(${lx} ${ly}) scale(${z}) translate(${-f.x} ${-f.y})"/></g>
      <circle class="lp" cx="${lx}" cy="${ly}" r="${R}"/><path class="og" d="M${lx-R} ${ly}H${lx+R}M${lx} ${ly-R}V${ly+R}"/>`;}
  o.innerHTML=ov;}

/* ---------- คำแนะนำตามขั้นตอน ---------- */
function hintData(){const t=WB.ptype==="touch",M=LM();
  if(WB.mode==="loads"){if(!M.beams.length)return ["ชั้นนี้ยังไม่มีคาน","กลับไปขั้นโมเดลเพื่อวาดคานก่อน หรือสลับไปชั้นอื่นที่ปุ่มมุมซ้ายล่าง"];
    return [t?"แตะแผ่นพื้นหรือคานเพื่อกำหนดน้ำหนัก":"คลิกแผ่นพื้นหรือคานเพื่อกำหนดน้ำหนัก","แผ่นพื้น: เลือกประเภทการใช้งานและวัสดุปูผิว คาน: ใส่ผนัง แผนภาพสีบนคานคือน้ำหนักที่กระจายลงมาจริง ซ่อนได้ด้วยปุ่ม “แผนภาพ”"];}
  if(WB.tool==="select"){
    if(!M.columns.length&&!M.beams.length) return ["เริ่มต้น: ตรวจระยะกริดในแผง “แปลนชั้น” แล้ววางเสา","กดปุ่ม “วางเสาทุกจุดตัดกริด” ในแผง หรือเลือกเครื่องมือ “เสา” เพื่อวางทีละต้น จากนั้นใช้เครื่องมือ “คาน” วาดคานระหว่างเสา"];
    return t?["แตะคาน เสา หรือช่องพื้นเพื่อเลือก","กดค้างเพื่อเปิดคุณสมบัติ ลากนิ้วเดียวเพื่อเลื่อนแปลน ถ่างสองนิ้วเพื่อซูม เปิด “เลือกหลายรายการ” เพื่อเลือกทีละหลายเส้น"]
            :["คลิกคาน เสา หรือช่องพื้นเพื่อเลือก","กด Shift ค้างแล้วคลิกเพื่อเลือกเพิ่ม ลากบนพื้นที่ว่างเพื่อเลื่อนแปลน หมุนล้อเมาส์เพื่อซูม กด Delete เพื่อลบ"];}
  if(WB.tool==="column") return t?["แตะค้างแล้วเลื่อนนิ้ว ดูจุดในแว่นขยาย แล้วยกนิ้วเพื่อวางเสา","จุดตัดกริดดูดให้อัตโนมัติ (สัญลักษณ์ □) เสาที่วางบนจุดตัดกริดจะได้ชื่อตามกริด เช่น B-2"]
                                  :["คลิกที่จุดตัดกริดเพื่อวางเสา","เลื่อนเมาส์ใกล้จุดตัดกริดจะเห็นสัญลักษณ์ □ แปลว่ากำลังดูดเข้าจุดนั้น เสาจะได้ชื่อตามกริด เช่น B-2"];
  if(!WB.start) return t?["ขั้นที่ 1 จาก 2: แตะค้างที่จุดเริ่มคาน แล้วยกนิ้ว","ปกติเริ่มที่ศูนย์กลางเสา (สัญลักษณ์ ○) ถ้าเป็นคานซอย ให้เริ่มบนคานหลัก (สัญลักษณ์ ◇)"]
                        :["ขั้นที่ 1 จาก 2: คลิกจุดเริ่มคาน","ปกติเริ่มที่ศูนย์กลางเสา (สัญลักษณ์ ○) ถ้าเป็นคานซอย ให้เริ่มบนคานหลัก (สัญลักษณ์ ◇)"];
  return t?["ขั้นที่ 2 จาก 2: แตะค้างที่ปลายคาน แล้วยกนิ้ว","วาดต่อเป็นช่วงถัดไปได้ทันที แตะจุดเดิมซ้ำหรือกด “จบเส้น” เพื่อหยุด กด “ป้อนระยะ” เพื่อกำหนดความยาว"]
          :["ขั้นที่ 2 จาก 2: คลิกปลายคาน หรือพิมพ์ตัวเลขระยะแล้วกด Enter","คลิกต่อเพื่อวาดช่วงถัดไป กด Esc หรือคลิกขวาเพื่อจบเส้น โหมดตั้งฉากเปิดอยู่: เส้นจะล็อกแนวนอนหรือแนวตั้ง"];}
function refreshHint(){const h=$("#wbHint");if(!h)return;const [a,b]=hintData();
  const btns=[];
  if(WB.tool==="beam"&&WB.start){btns.push(`<button class="btn" data-wbact="endChain">จบเส้น</button>`,`<button class="btn" data-wbact="lenBox">ป้อนระยะ</button>`);}
  if(WB.tool==="select"&&WB.ptype==="touch") btns.push(`<button class="btn" data-wbact="multi" aria-pressed="${WB.multi}">${WB.multi?"✓ ":""}เลือกหลายรายการ</button>`);
  btns.push(`<button class="btn" data-wbact="hintMin">${WB.hintMin?"แสดงคำแนะนำ":"ย่อ"}</button>`);
  h.className="wb-hint"+(WB.hintMin?" min":"");
  h.innerHTML=`<b>${a}</b><span>${b}</span><div class="flex">${btns.join("")}</div>`;
  if(WB.hintMin) h.innerHTML=`<div class="flex" style="margin:0;justify-content:space-between"><b style="display:inline">${a}</b>${btns.join("")}</div>`;}

/* ---------- ป้อนระยะ ---------- */
function showLen(first){const b=$("#wbLen");if(!b||!WB.start)return;b.hidden=false;const i=$("#wbLenIn");i.value=first||"";i.focus();}
function hideLen(){const b=$("#wbLen");if(b)b.hidden=true;}
function placeLen(dir){const v=parseFloat($("#wbLenIn").value);if(!(v>0)||!WB.start)return;
  let d=dir;
  if(!d){const c=WB.cur||{x:WB.start.x+1,y:WB.start.y};let dx=c.x-WB.start.x,dy=c.y-WB.start.y;
    if(Math.hypot(dx,dy)<1e-6){dx=1;dy=0;} if(WB.ortho){if(Math.abs(dx)>=Math.abs(dy)){dy=0;dx=Math.sign(dx)||1;}else{dx=0;dy=Math.sign(dy);}}
    const L=Math.hypot(dx,dy);d={x:dx/L,y:dy/L};}
  WB.cur={x:Math.round((WB.start.x+d.x*v)*1000)/1000,y:Math.round((WB.start.y+d.y*v)*1000)/1000,k:"free"};
  place();$("#wbLenIn").value="";$("#wbLenIn").focus();}

/* ---------- ชั้น ---------- */
function setStory(i){const m=S.model;if(i<0||i>=m.stories.length||i===m.cur)return;m.cur=i;WB.start=null;clearSel();save();changed();}
function renderStories(){const el=$("#wbStories");if(!el)return;const m=S.model;
  el.innerHTML=m.stories.map((x,i)=>`<button data-story="${i}" aria-pressed="${i===m.cur}" title="${esc(x.name)} ระดับ ${fmt(x.elev,2)} ม.">${esc(x.name)}</button>`).reverse().join("");}
function copyStoryDialog(){const m=S.model,d=$("#dlg"),others=m.stories.map((x,i)=>[x,i]).filter(([,i])=>i!==m.cur);
  if(!others.length){alert("ยังไม่มีชั้นอื่นให้คัดลอก กด “เพิ่มชั้นด้านบน” ก่อน");return;}
  d.innerHTML=`<h3 style="margin-top:0">คัดลอกมาที่ ${esc(curStory().name)}</h3>
    <div class="row wide"><label for="cpFrom">จากชั้น</label><select id="cpFrom">${others.map(([x,i])=>`<option value="${i}">${esc(x.name)}</option>`).join("")}</select></div>
    <fieldset style="margin-top:8px"><legend>สิ่งที่คัดลอก</legend>
     <label class="choice"><input type="checkbox" id="cpC" checked> <span>เสา</span></label><label class="choice"><input type="checkbox" id="cpB" checked> <span>คาน</span></label><label class="choice"><input type="checkbox" id="cpS" checked> <span>ข้อมูลแผ่นพื้น</span></label></fieldset>
    <p class="note">ของเดิมในชั้นนี้ที่เลือกคัดลอกจะถูกแทนที่ กดย้อนกลับได้</p>
    <div class="flex"><button class="btn primary" id="cpGo">คัดลอก</button><button class="btn" id="cpX">ยกเลิก</button></div>`;
  d.showModal();d.querySelector("#cpX").onclick=()=>d.close();
  d.querySelector("#cpGo").onclick=()=>{const src=m.stories[+d.querySelector("#cpFrom").value],dst=curStory(),map={};pushHist();
    if(d.querySelector("#cpC").checked)dst.columns=src.columns.map(c=>Object.assign({},c,{id:"c"+(++m.seq)}));
    if(d.querySelector("#cpB").checked){dst.beams=src.beams.map(b=>{const id="b"+(++m.seq);map[b.id]=id;
      const nm=m.cur===0?b.name.replace(/^B/,"GB"):b.name.replace(/^GB/,"B");return Object.assign({},b,{id,name:nm});});
      dst.over={};for(const [k,v2] of Object.entries(src.over||{})){const [a,b]=k.split("|");if(map[a]&&map[b])dst.over[[map[a],map[b]].sort().join("|")]=map[v2];}}
    if(d.querySelector("#cpS").checked)dst.slabs=JSON.parse(JSON.stringify(src.slabs||{}));
    d.close();clearSel();changed();};}

/* ---------- แผงคุณสมบัติ ---------- */
function chainSVG(ch){const W=290,pad=18,L=Math.max(ch.len,0.01),sc=(W-2*pad)/L,X=t=>pad+(t-ch.t0)*sc;
  let s=`<svg viewBox="0 0 ${W} 74" width="100%" role="img" aria-label="แผนภาพคานต่อเนื่อง ${esc(ch.name)}"><line class="cb-line" x1="${X(ch.t0)}" y1="30" x2="${X(ch.t1)}" y2="30"/>`;
  for(const p of ch.pts){const x=X(p.t);
    if(p.type==="col") s+=`<path class="cb-sup" d="M${x} 32l-7 12h14z"/>`;
    else if(p.type==="beam") s+=`<circle class="cb-bsup" cx="${x}" cy="38" r="5"/>`;
    else if(p.type==="load") s+=`<path class="cb-load" d="M${x} 8v16m-4 -5l4 5 4-5"/>`;}
  const seg=[];if(ch.cantL>TOL)seg.push([ch.t0,ch.t0+ch.cantL]);ch.spans.forEach(sp=>seg.push([sp.t0,sp.t1]));if(ch.cantR>TOL)seg.push([ch.t1-ch.cantR,ch.t1]);
  for(const [a,b] of seg) s+=`<text class="cb-txt" x="${(X(a)+X(b))/2}" y="64" text-anchor="middle">${fmt(b-a,2)}</text>`;
  return s+`</svg>`;}
function swapBtn(p){if(!p.cross)return "";const sup=p.type==="beam"?p.mine:p.ref;
  return `<br><span class="muted">คานตัดกันกลางช่วง${p.manual?" (กำหนดเอง)":" (โปรแกรมเลือกจากความลึก)"}</span> <button class="btn" data-swap="${p.cross}" data-sup="${sup}">สลับคานรับ</button>`;}
function ptText(p,ch){
  if(p.type==="col") return `<b>เสา ${esc(p.label)}</b>: จุดรองรับ`;
  if(p.type==="beam") return `<b>วางบนคาน ${esc(p.label)}</b>: จุดรองรับแบบคานฝากคาน แรงปฏิกิริยาที่จุดนี้จะเป็นน้ำหนักจุดบน ${esc(p.label)}`+swapBtn(p);
  if(p.type==="load") return `<b>รับคาน ${esc(p.label)}</b>: ${esc(p.label)} มาวางบนคานนี้ จึงเป็นน้ำหนักจุดของคานนี้`+swapBtn(p);
  return `<b>ชนปลายคาน ${esc(p.label)}</b>: ไม่มีเสารองรับ`;}
function panelHTML(){if(WB.mode==="loads")return loadsPanelHTML();const M=LM(),T=WB.topo;
  const tog=`<button class="sheet-toggle" data-wbact="panel">${WB.panelOpen?"ซ่อนแผง":"แสดงแผง"}</button>`;
  if(WB.sel.size){const bs=M.beams.filter(b=>WB.sel.has(b.id));const same=k=>bs.every(b=>b[k]===bs[0][k])?bs[0][k]:"";
    const ch=T.chains[T.beamChain.get(bs[0].id)];
    let h=`${tog}<h3>คาน${bs.length>1?` (เลือก ${bs.length} ช่วง)`:` ${esc(bs[0].name)}`}</h3>
      <div class="row wide"><label for="wbN">ชื่อคาน</label><input id="wbN" data-wb="name" value="${esc(same("name"))}" placeholder="หลายค่า"></div>
      <div class="row"><label for="wbB">ความกว้าง b</label><input id="wbB" type="number" step="any" inputmode="decimal" data-wb="b" value="${same("b")}" placeholder="หลายค่า"><span class="u">ม.</span></div>
      <div class="row"><label for="wbH">ความลึก h</label><input id="wbH" type="number" step="any" inputmode="decimal" data-wb="h" value="${same("h")}" placeholder="หลายค่า"><span class="u">ม.</span></div>
      <p class="note">ค่าที่แก้จะใช้กับทุกช่วงที่เลือก ใช้ปุ่มด้านล่างเพื่อเลือกทั้งแนวก่อนเปลี่ยนชื่อหรือขนาด</p>
      <div class="flex"><button class="btn" data-wbact="selChain">เลือกทั้งคานต่อเนื่อง</button><button class="btn" data-wbact="del">ลบ</button></div>`;
    if(ch){h+=`<h3>คานต่อเนื่อง ${esc(ch.name)}</h3>${chainSVG(ch)}
      <p class="note">ยาวรวม ${fmt(ch.len,2)} ม. มี ${ch.spans.length} ช่วง${ch.cantL>TOL||ch.cantR>TOL?" และมีคานยื่น":""} (▲ เสา ○ วางบนคาน ↓ รับคานอื่น)</p>
      ${ch.warnings.map(w=>`<div class="warn">${w}</div>`).join("")}
      <ul class="pt-list">${ch.pts.map(p=>`<li>ระยะ ${fmt(p.t-ch.t0,2)} ม. ${ptText(p,ch)}</li>`).join("")}
      ${ch.cantL>TOL?`<li><b>ปลายซ้ายยื่น</b> ${fmt(ch.cantL,2)} ม.: ไม่มีที่รองรับปลาย (คานยื่น)</li>`:""}${ch.cantR>TOL?`<li><b>ปลายขวายื่น</b> ${fmt(ch.cantR,2)} ม.: ไม่มีที่รองรับปลาย (คานยื่น)</li>`:""}</ul>
      <p class="note">ขั้นถัดไป (Step 2) โปรแกรมจะกระจายน้ำหนักพื้นลงคานนี้และวิเคราะห์โมเมนต์ทุกช่วงให้</p>`;}
    return h;}
  if(WB.selSlab.size){const keys=[...WB.selSlab],pns=WB.panels.filter(p=>WB.selSlab.has(p.key)),sps=pns.map(p=>slabProps(M,p.key));
    const same=k=>sps.every(s=>s[k]===sps[0][k])?sps[0][k]:"";const pn=pns[0];if(!pn)return tog;const info=slabSpan(pn,sps[0]);
    return `${tog}<h3>แผ่นพื้น${pns.length>1?` (เลือก ${pns.length} แผ่น)`:` ${esc(sps[0].name)}`}</h3>
      <div class="row wide"><label for="wsN">ชื่อแผ่นพื้น</label><input id="wsN" data-wbs="name" value="${esc(same("name"))}" placeholder="หลายค่า"></div>
      <div class="row wide"><label for="wsK">ชนิด</label><select id="wsK" data-wbs="kind">${[["cast","พื้นหล่อในที่"],["plank","แผ่นพื้นสำเร็จรูป"],["none","ช่องเปิด / ไม่มีพื้น"]].map(([v2,l])=>`<option value="${v2}" ${same("kind")===v2?"selected":""}>${l}</option>`).join("")}${same("kind")===""?'<option value="" selected>หลายค่า</option>':""}</select></div>
      <div class="row"><label for="wsT">ความหนา t</label><input id="wsT" type="number" step="any" inputmode="decimal" data-wbs="t" value="${same("t")}" placeholder="หลายค่า"><span class="u">ม.</span></div>
      ${pns.length===1?`<p class="note">ขนาด ${fmt(pn.lx,2)} × ${fmt(pn.ly,2)} ม. พื้นที่ ${fmt(pn.area,2)} ตร.ม.<br>${info.text}</p>`:""}
      <p class="note">ลูกศรบนแปลนบอกทิศถ่ายน้ำหนัก ลูกศรสองทิศคือพื้นสองทาง ลูกศรทิศเดียวคือพื้นทางเดียวพาดช่วงสั้น</p>
      <div class="flex"><button class="btn" data-wbact="slabAll">ใช้ค่านี้กับทุกแผ่นในชั้น</button></div>`;}
  if(WB.selCol.size){const cs=M.columns.filter(c=>WB.selCol.has(c.id));const same=k=>cs.every(c=>c[k]===cs[0][k])?cs[0][k]:"";
    return `${tog}<h3>เสา${cs.length>1?` (เลือก ${cs.length} ต้น)`:` ${esc(cs[0].name)}`}</h3>
      <div class="row wide"><label for="wcN">ชื่อเสา</label><input id="wcN" data-wbc="name" value="${esc(same("name"))}" placeholder="หลายค่า"></div>
      <div class="row"><label for="wcB">ด้าน x (b)</label><input id="wcB" type="number" step="any" inputmode="decimal" data-wbc="b" value="${same("b")}" placeholder="หลายค่า"><span class="u">ม.</span></div>
      <div class="row"><label for="wcH">ด้าน y (h)</label><input id="wcH" type="number" step="any" inputmode="decimal" data-wbc="h" value="${same("h")}" placeholder="หลายค่า"><span class="u">ม.</span></div>
      <div class="flex"><button class="btn" data-wbact="del">ลบ</button></div>`;}
  const sp=a=>{const p=a.map(g=>g.p).sort((x,y)=>x-y);return p.slice(1).map((v,i)=>+(v-p[i]).toFixed(3)).join(", ");};
  const nb=M.beams.length,nc=M.columns.length,chs=T?T.chains:[];
  const m=S.model,st=curStory(),np=WB.panels.filter(p=>slabProps(M,p.key).kind!=="none").length;
  const stRows=m.stories.map((x,i)=>`<tr class="click ${i===m.cur?"cur":""}" data-story="${i}"><td>${i===m.cur?"● ":""}${esc(x.name)}</td><td class="n">${x.elev>=0?"+":""}${fmt(x.elev,2)}</td><td class="n">${x.columns.length}/${x.beams.length}</td></tr>`).reverse().join("");
  return `${tog}<h3>ชั้น</h3><div class="tablewrap"><table><tr><th>ชั้น</th><th class="n">ระดับ (ม.)</th><th class="n">เสา/คาน</th></tr>${stRows}
    <tr><td class="muted">หลังฐานราก</td><td class="n">${fmt(m.found,2)}</td><td></td></tr></table></div>
   <p class="note">แตะชื่อชั้นเพื่อสลับไปวาดชั้นนั้น เสาของแต่ละชั้นยาวจากระดับชั้นนั้นลงไปถึงชั้นที่อยู่ถัดลงไป เสาชั้นล่างสุดคือตอม่อ ยาวลงถึงหลังฐานราก</p>
   <div class="row wide"><label for="wtN">ชื่อชั้นนี้</label><input id="wtN" data-wst="name" value="${esc(st.name)}"></div>
   <div class="row"><label for="wtE">ระดับชั้นนี้</label><input id="wtE" type="number" step="any" inputmode="decimal" data-wst="elev" value="${st.elev}"><span class="u">ม.</span></div>
   <div class="row"><label for="wtF">ระดับหลังฐานราก</label><input id="wtF" type="number" step="any" inputmode="decimal" data-wst="found" value="${m.found}"><span class="u">ม.</span></div>
   <div class="flex"><button class="btn" data-wbact="addStory">เพิ่มชั้นด้านบน</button><button class="btn" data-wbact="copyStory">คัดลอกจากชั้นอื่น</button><button class="btn danger" data-wbact="delStory">ลบชั้นนี้</button></div>
   <h3>${esc(st.name)}</h3><p class="note">เสา ${nc} ต้น คาน ${nb} ช่วง รวมเป็นคานต่อเนื่อง ${chs.length} เส้น แผ่นพื้น ${np} แผ่น</p>
   <h3>กริด</h3>
   <div class="row wide"><label for="wgX">ระยะแกน A, B, C… (ม.)</label><input id="wgX" data-wbg="x" value="${sp(M.grid.x)}"></div>
   <div class="row wide"><label for="wgY">ระยะแกน 1, 2, 3… (ม.)</label><input id="wgY" data-wbg="y" value="${sp(M.grid.y)}"></div>
   <p class="note">พิมพ์ระยะระหว่างแกนทีละช่วง คั่นด้วยจุลภาค เช่น 4, 3.5, 3.5 แล้วกด Enter เสาและคานที่วางไว้แล้วจะไม่ย้ายตาม</p>
   <h3>ค่าเริ่มต้น</h3>
   <div class="row"><label for="wdC">ขนาดเสาใหม่</label><input id="wdC" type="number" step="any" inputmode="decimal" data-wbd="col" value="${M.defCol.b}"><span class="u">ม.</span></div>
   <div class="row"><label for="wdB">ความกว้างคานใหม่</label><input id="wdB" type="number" step="any" inputmode="decimal" data-wbd="bb" value="${M.defBeam.b}"><span class="u">ม.</span></div>
   <div class="row"><label for="wdH">ความลึกคานใหม่</label><input id="wdH" type="number" step="any" inputmode="decimal" data-wbd="bh" value="${M.defBeam.h}"><span class="u">ม.</span></div>
   <div class="row"><label for="wdT">ความหนาพื้นใหม่</label><input id="wdT" type="number" step="any" inputmode="decimal" data-wbd="st" value="${M.defSlab.t}"><span class="u">ม.</span></div>
   <div class="flex" style="margin-top:8px"><button class="btn primary" data-wbact="allCols">วางเสาทุกจุดตัดกริด</button><button class="btn" data-wbact="example">โหลดตัวอย่าง</button><button class="btn" data-wbact="clear">ล้างแปลน</button></div>
   ${chs.length?`<h3>คานต่อเนื่องทั้งหมด</h3><div class="tablewrap"><table><tr><th>คาน</th><th>ช่วง (ม.)</th><th></th></tr>
   ${chs.map((ch,i)=>`<tr class="click" data-chain="${i}"><td>${esc(ch.name)}</td><td>${[ch.cantL>TOL?fmt(ch.cantL,2)+"*":null,...ch.spans.map(s=>fmt(s.L,2)),ch.cantR>TOL?fmt(ch.cantR,2)+"*":null].filter(Boolean).join(" + ")||"–"}</td><td class="${ch.warnings.length?"ic-ng":"ic-ok"}">${ch.warnings.length?"!":"✓"}</td></tr>`).join("")}</table></div><p class="note">* คือคานยื่น แตะแถวเพื่อเลือกคานนั้นบนแปลน</p>`:""}`;}
function renderPanel(){const p=$("#wbPanel");if(!p)return;const top=p.scrollTop;p.innerHTML=panelHTML();p.classList.toggle("open",WB.panelOpen);p.scrollTop=top;refreshHint();}

/* ---------- แถบเครื่องมือ ---------- */
const IC={select:'<path d="M5 3l14 8-6 2-2 6z"/>',column:'<rect x="6" y="6" width="12" height="12"/><path d="M6 6l12 12M18 6L6 18" stroke-width="1"/>',
  beam:'<path d="M3 15h18M3 9h18"/><rect x="2" y="7" width="3" height="10"/><rect x="19" y="7" width="3" height="10"/>',
  ortho:'<path d="M5 19V5M5 19h14"/><path d="M5 9h4v10" stroke-width="1"/>',del:'<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
  fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',d3:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>',load:'<path d="M3 18h18"/><path d="M3 18l4-6h10l4 6" opacity=".6"/><path d="M8 4v6M12 4v6M16 4v6M6.5 8.5L8 10l1.5-1.5M10.5 8.5L12 10l1.5-1.5M14.5 8.5L16 10l1.5-1.5"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 2-2.5 2-2.5 4"/><path d="M12 17.5v.5"/>'};
function toolsHTML(){const b=(id,label,tip,extra="")=>`<button data-wbtool="${id}" title="${tip}" aria-label="${label}" ${extra}><svg viewBox="0 0 24 24">${IC[id]}</svg>${label}</button>`;
  if(WB.mode==="loads") return b("select","เลือก","เลือกแผ่นพื้นหรือคานเพื่อกำหนดน้ำหนัก")+b("load","แผนภาพ","แสดงหรือซ่อนแผนภาพน้ำหนักลงคาน")+`<div class="sep"></div>`+
    b("undo","ย้อน","ย้อนกลับ (Ctrl+Z)")+b("redo","ทำซ้ำ","ทำซ้ำ (Ctrl+Y)")+`<div class="sep"></div>`+b("fit","พอดีจอ","ปรับมุมมองให้เห็นทั้งแปลน (คีย์ลัด F)")+b("d3","3D","แสดงภาพ 3 มิติ")+b("panel","แผง","แสดงหรือซ่อนแผงคุณสมบัติ")+b("help","คู่มือ","อ่านวิธีใช้งาน");
  return b("select","เลือก","เลือกคานหรือเสาเพื่อแก้ไข (คีย์ลัด V)")+b("column","เสา","วางเสาที่จุดตัดกริด (คีย์ลัด C)")+b("beam","คาน","วาดคานจากจุดหนึ่งไปอีกจุด (คีย์ลัด B)")+
   `<div class="sep"></div>`+b("ortho","ตั้งฉาก","ล็อกเส้นให้เป็นแนวนอนหรือแนวตั้ง (คีย์ลัด O)")+b("del","ลบ","ลบรายการที่เลือก (Delete)")+b("undo","ย้อน","ย้อนกลับ (Ctrl+Z)")+b("redo","ทำซ้ำ","ทำซ้ำ (Ctrl+Y)")+
   `<div class="sep"></div>`+b("fit","พอดีจอ","ปรับมุมมองให้เห็นทั้งแปลน (คีย์ลัด F)")+b("d3","3D","แสดงภาพ 3 มิติ")+b("panel","แผง","แสดงหรือซ่อนแผงคุณสมบัติ")+b("help","คู่มือ","อ่านวิธีใช้งานทีละขั้นตอน (คีย์ลัด ?)");}
function updateTools(){document.querySelectorAll("[data-wbtool]").forEach(btn=>{const id=btn.dataset.wbtool;
  if(["select","column","beam"].includes(id)) btn.setAttribute("aria-pressed",WB.tool===id);
  if(id==="ortho") btn.setAttribute("aria-pressed",WB.ortho);
  if(id==="d3") btn.setAttribute("aria-pressed",WB.show3d);
  if(id==="load") btn.setAttribute("aria-pressed",WB.showLoad);
  if(id==="panel") btn.setAttribute("aria-pressed",WB.panelOpen);
  if(id==="undo") btn.disabled=!WB.hist.length; if(id==="redo") btn.disabled=!WB.fut.length;
  if(id==="del") btn.disabled=!(WB.sel.size||WB.selCol.size);});}
function setTool(t){if(WB.mode==="loads")t="select";WB.tool=t;WB.start=null;WB.cur=null;hideLen();updateTools();refreshHint();drawDyn();}

/* ---------- คู่มือ ---------- */
function helpHTML(){const sym=k=>{const m={grid:'<rect x="3" y="3" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"/>',col:'<circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" stroke-width="2"/>',
  end:'<rect x="4" y="4" width="10" height="10" fill="currentColor"/>',mid:'<path d="M9 2L16 15H2Z" fill="none" stroke="currentColor" stroke-width="2"/>',int:'<path d="M3 3L15 15M15 3L3 15" stroke="currentColor" stroke-width="2"/>',
  onbeam:'<path d="M9 2L16 9L9 16L2 9Z" fill="none" stroke="currentColor" stroke-width="2"/>',ongrid:'<path d="M9 2L16 9L9 16L2 9Z" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/>'};
  return `<span class="sym" style="color:var(--accent)"><svg viewBox="0 0 18 18">${m[k]}</svg></span>`;};
  return `<div class="help"><h2 style="margin-top:0">วิธีใช้งานแปลนชั้น</h2>
  <p class="note">แปลนชั้นคือที่วาดโครงสร้างแบบเดียวกับโปรแกรม Prota วาดครั้งเดียว โปรแกรมจะหาช่วงคาน จุดรองรับ และคานฝากคานให้เอง</p>
  <h3>ขั้นตอนการทำงาน</h3><ol>
   <li><b>ตั้งกริด</b> ในแผง “แปลนชั้น” พิมพ์ระยะระหว่างแกน เช่น 4, 3.5, 3.5 แล้วกด Enter</li>
   <li><b>วางเสา</b> กด “วางเสาทุกจุดตัดกริด” หรือเลือกเครื่องมือ “เสา” แล้ววางทีละต้น</li>
   <li><b>วาดคาน</b> เลือกเครื่องมือ “คาน” กำหนดจุดเริ่มและจุดปลาย วาดยาวผ่านเสาหลายต้นได้ในเส้นเดียว โปรแกรมจะแบ่งช่วงที่เสาให้เอง</li>
   <li><b>ตรวจคานต่อเนื่อง</b> เลือกคานหนึ่งช่วง แผงจะแสดงทั้งแนว ช่วงคาน และจุดรองรับ (▲ เสา ○ วางบนคาน ↓ รับคานอื่น) คานที่มีปัญหาจะมีเครื่องหมาย ! สีแดง</li>
   <li><b>กำหนดชื่อและขนาด</b> กด “เลือกทั้งคานต่อเนื่อง” แล้วแก้ชื่อ b และ h ในแผง</li></ol>
  <h3>ใช้งานด้วยเมาส์</h3><ul>
   <li>เลื่อนเมาส์จะเห็นเส้นพรีวิวและสัญลักษณ์จุดดูดก่อนคลิก</li>
   <li>คลิกจุดเริ่ม คลิกจุดปลาย และคลิกต่อเพื่อวาดช่วงถัดไป กด <kbd>Esc</kbd> หรือคลิกขวาเพื่อจบเส้น</li>
   <li>ระหว่างวาด พิมพ์ตัวเลขแล้วกด <kbd>Enter</kbd> เพื่อกำหนดความยาวตามทิศที่เมาส์ชี้</li>
   <li>ลากบนพื้นที่ว่างหรือกดปุ่มกลางค้างเพื่อเลื่อนแปลน หมุนล้อเมาส์เพื่อซูม</li></ul>
  <h3>ใช้งานด้วยนิ้ว (มือถือและแท็บเล็ต)</h3><ul>
   <li>ในเครื่องมือเสาและคาน ให้แตะค้างแล้วเลื่อนนิ้ว แว่นขยายเหนือนิ้วจะแสดงจุดที่จะวาด ยกนิ้วเมื่อได้ตำแหน่ง</li>
   <li>ใช้สองนิ้วถ่างเพื่อซูมและลากเพื่อเลื่อนแปลนได้ทุกเครื่องมือ</li>
   <li>แตะจุดเดิมซ้ำหรือกด “จบเส้น” เพื่อหยุดวาด กด “ป้อนระยะ” เพื่อพิมพ์ความยาวและเลือกทิศ</li>
   <li>ในเครื่องมือเลือก กดค้างที่คานหรือเสาเพื่อเปิดแผงคุณสมบัติ ลากขอบบนของแผงหรือกด “แผง” เพื่อซ่อน</li></ul>
  <h3>ภาพ 3 มิติ</h3><ul>
   <li><b>นิ้ว:</b> ลากนิ้วเดียวเพื่อหมุน ลากสองนิ้วไปด้วยกันเพื่อเลื่อนภาพ ถ่างหรือหุบสองนิ้วเพื่อซูม</li>
   <li><b>เมาส์:</b> ลากเพื่อหมุน กด <kbd>Shift</kbd> ค้างแล้วลาก หรือลากด้วยปุ่มขวาหรือปุ่มกลาง เพื่อเลื่อนภาพ หมุนล้อเพื่อซูม</li>
   <li>กด “พอดีจอ” เพื่อกลับไปมุมมองเริ่มต้น</li></ul>
  <h3>สัญลักษณ์จุดดูด</h3><ul>
   <li>${sym("grid")}จุดตัดกริด</li><li>${sym("col")}ศูนย์กลางเสา</li><li>${sym("end")}ปลายคาน</li><li>${sym("mid")}กึ่งกลางคาน</li>
   <li>${sym("int")}จุดตัดของคานสองเส้น</li><li>${sym("onbeam")}จุดใดก็ได้บนคาน (ใช้วางคานซอย)</li><li>${sym("ongrid")}จุดใดก็ได้บนแนวกริด</li></ul>
  <h3>โปรแกรมหาจุดรองรับอย่างไร</h3><ul>
   <li>คานแนวเดียวกันที่ต่อปลายกันรวมเป็นคานต่อเนื่องเส้นเดียว และใช้ชื่อเดียวกันโดยอัตโนมัติ</li>
   <li>จุดที่มีเสาเป็นจุดรองรับ</li>
   <li>ปลายคานที่ไปชนกลางคานอื่น หมายถึงคานนั้นวางบนคานที่ถูกชน (คานฝากคาน)</li>
   <li>คานสองเส้นตัดกันกลางช่วง คานที่ลึกกว่าเป็นคานรับ ถ้าลึกเท่ากัน คานที่วาดก่อนเป็นคานรับ ปรับได้โดยเปลี่ยนความลึก</li>
   <li>ปลายคานชนปลายคานโดยไม่มีเสา หรือคานที่มีจุดรองรับน้อยกว่า 2 จุด จะถูกแจ้งเตือน</li></ul>
  <h3>ชั้น</h3><ul>
   <li>ปุ่มชื่อชั้นมุมขวาล่างของแปลนใช้สลับชั้นที่กำลังวาด ชั้นล่างถัดลงไปจะแสดงเป็นเส้นจางเพื่อช่วยวางเสาให้ตรงกัน</li>
   <li>เสาที่วาดในชั้นใด จะยาวจากระดับชั้นนั้นลงไปถึงชั้นถัดลงไป เสาของชั้นล่างสุดคือตอม่อ ยาวลงถึงระดับหลังฐานราก</li>
   <li>กด “คัดลอกจากชั้นอื่น” ในแผงแปลนชั้น เพื่อคัดลอกเสา คาน และพื้นจากชั้นหนึ่งมาทั้งหมด แล้วค่อยแก้เฉพาะจุดที่ต่าง</li></ul>
  <h3>แผ่นพื้น</h3><ul>
   <li>ช่องที่มีคานล้อมรอบครบจะกลายเป็นแผ่นพื้นเอง ไม่ต้องวาด</li>
   <li>ลูกศรสองทิศคือพื้นสองทาง (S/L ≥ 0.5) ลูกศรทิศเดียวคือพื้นทางเดียวพาดช่วงสั้น</li>
   <li>แตะในช่องพื้นเพื่อแก้ชื่อ ความหนา หรือเปลี่ยนเป็นแผ่นพื้นสำเร็จรูปหรือช่องเปิด เช่น ช่องบันได</li></ul>
  <h3>ขั้นน้ำหนัก</h3><ul>
   <li>แตะแผ่นพื้นเพื่อเลือกประเภทการใช้งาน (น้ำหนักจรตามกฎกระทรวง ข้อ 11) และชุดวัสดุปูผิวกับฝ้า แผงจะแสดงน้ำหนักทีละบรรทัดและน้ำหนักปรับค่า</li>
   <li>แตะคานเพื่อใส่ผนัง ความสูงผนังคิดอัตโนมัติจากระยะถึงคานชั้นบน กด “ใส่ผนังนี้ทุกคานรอบนอกของชั้น” เพื่อใส่ทีเดียวทั้งรอบ</li>
   <li>แผนภาพสีบนคานคือน้ำหนักที่กระจายจากพื้นจริง พื้นสองทางเป็นสามเหลี่ยมหรือคางหมู พื้นทางเดียวลงคานด้านยาวแบบสม่ำเสมอ</li>
   <li>แตะพื้นที่ว่างเพื่อดูสรุปน้ำหนักของชั้น การตรวจสมดุล แรงลม และแก้คลังวัสดุ</li></ul>
  <h3>สลับคานรับที่จุดตัด</h3><ul>
   <li>เลือกคานที่ตัดกับคานอื่นกลางช่วง ในรายการจุดของคานต่อเนื่องจะมีปุ่ม “สลับคานรับ” กดเพื่อเปลี่ยนว่าคานไหนวางบนคานไหน</li></ul>
  <h3>คีย์ลัด</h3><p><kbd>V</kbd> เลือก <kbd>C</kbd> เสา <kbd>B</kbd> คาน <kbd>O</kbd> ตั้งฉาก <kbd>F</kbd> พอดีจอ <kbd>PageUp</kbd>/<kbd>PageDown</kbd> ขึ้น/ลงชั้น <kbd>Delete</kbd> ลบ <kbd>Ctrl</kbd>+<kbd>Z</kbd> ย้อน <kbd>Ctrl</kbd>+<kbd>Y</kbd> ทำซ้ำ <kbd>?</kbd> คู่มือ</p>
  <div class="flex" style="margin-top:14px"><button class="btn primary" id="helpClose">เริ่มใช้งาน</button></div></div>`;}
function openHelp(){const d=$("#dlg");d.innerHTML=helpHTML();d.showModal();d.querySelector("#helpClose").onclick=()=>d.close();try{localStorage.setItem("knstudio.help","1")}catch(e){}}

/* ---------- ตัวอย่าง ---------- */
function exampleModel(){const M=defaultModel(),[G,F]=M.stories;
  const xs=M.grid.x.map(g=>g.p),ys=M.grid.y.map(g=>g.p);
  const cols=st=>{for(const gx of M.grid.x)for(const gy of M.grid.y)st.columns.push({id:"c"+(++M.seq),name:gx.n+"-"+gy.n,x:gx.p,y:gy.p,b:.25,h:.25});};
  const frame=(st,pre,h)=>{let k=1;for(const y of ys)st.beams.push({id:"b"+(++M.seq),name:pre+(k++),x1:xs[0],y1:y,x2:xs.at(-1),y2:y,b:.2,h});
    for(const x of xs)st.beams.push({id:"b"+(++M.seq),name:pre+(k++),x1:x,y1:ys[0],x2:x,y2:ys.at(-1),b:.2,h});return k;};
  cols(G);frame(G,"GB",.4);cols(F);const k=frame(F,"B",.5);
  F.beams.push({id:"b"+(++M.seq),name:"B"+k,x1:9.25,y1:4,x2:9.25,y2:8,b:.2,h:.4});
  F.beams.push({id:"b"+(++M.seq),name:"B4",x1:11,y1:12,x2:12.5,y2:12,b:.2,h:.5});
  F.slabs["1013,600"]={name:"S2",t:0.10,kind:"none"};
  const R=newStory("หลังคา (คานรัดหัวเสา)",6);M.stories.push(R);cols(R);frame(R,"RB",.4);
  const bays=[];for(const x of [200,575,925])for(const y of [200,600,1000])bays.push(x+","+y);
  bays.forEach(k=>{R.slabs[k]={kind:"none"};G.slabs[k]={sdl:"ground"};});
  const per=b=>([0,12].includes(b.y1)&&b.y1===b.y2)||([0,11].includes(b.x1)&&b.x1===b.x2);
  [G,F].forEach(st=>st.beams.forEach(b=>{if(per(b)&&blen(b)>2)b.wall={type:"brick",h:null,open:0};}));
  M.cur=1;return M;}
function loadExample(){pushHist();S.model=exampleModel();clearSel();changed();fitView();}

/* ---------- 3D ---------- */
const W3={r:null,scene:null,cam:null,grp:null,panMouse:false,o:{th:-0.9,ph:1.0,r:30,tx:5,ty:0,tz:6},ptr:new Map(),pin:null};
function ensureThree(cb){if(window.THREE)return cb();const box=$("#wb3d");if(box)box.innerHTML='<div class="msg">กำลังโหลดภาพ 3 มิติ…</div>';
  const s=document.createElement("script");s.src=window.KN_THREE_URL||"https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";s.onload=cb;
  s.onerror=()=>{const b=$("#wb3d");if(b)b.innerHTML='<div class="msg">โหลดภาพ 3 มิติไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วกดปุ่ม 3D อีกครั้ง</div>';};document.head.appendChild(s);}
function cssColor(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()||"#ffffff";}
function init3D(){const box=$("#wb3d");if(!box||!window.THREE)return;
  if(!W3.r){W3.r=new THREE.WebGLRenderer({antialias:true});W3.r.setPixelRatio(Math.min(devicePixelRatio,2));W3.scene=new THREE.Scene();
    W3.cam=new THREE.PerspectiveCamera(40,1,0.1,1000);W3.scene.add(new THREE.AmbientLight(0xffffff,.62));const dl=new THREE.DirectionalLight(0xffffff,.55);dl.position.set(20,40,10);W3.scene.add(dl);
    W3.grp=new THREE.Group();W3.scene.add(W3.grp);const c=W3.r.domElement;
    c.addEventListener("contextmenu",e=>e.preventDefault());
    c.addEventListener("pointerdown",e=>{c.setPointerCapture(e.pointerId);W3.ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
      W3.panMouse=e.pointerType==="mouse"&&(e.shiftKey||e.button===1||e.button===2);
      if(W3.ptr.size===2){const [a,b]=[...W3.ptr.values()];W3.pin={d:Math.hypot(a.x-b.x,a.y-b.y)||1,r:W3.o.r,m:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};}});
    c.addEventListener("pointermove",e=>{if(!W3.ptr.has(e.pointerId))return;const p=W3.ptr.get(e.pointerId);
      if(W3.ptr.size===2&&W3.pin){W3.ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});const [a,b]=[...W3.ptr.values()],m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        W3.o.r=clamp(W3.pin.r*W3.pin.d/(Math.hypot(a.x-b.x,a.y-b.y)||1),3,300);
        pan3D(m.x-W3.pin.m.x,m.y-W3.pin.m.y);W3.pin.m=m;render3D();return;}
      const dx=e.clientX-p.x,dy=e.clientY-p.y;W3.ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(W3.panMouse||(e.pointerType==="mouse"&&e.shiftKey)){pan3D(dx,dy);render3D();return;}
      W3.o.th+=dx*0.008;W3.o.ph=clamp(W3.o.ph-dy*0.008,0.15,1.5);render3D();});
    const up=e=>{W3.ptr.delete(e.pointerId);if(W3.ptr.size<2)W3.pin=null;if(!W3.ptr.size)W3.panMouse=false;};c.addEventListener("pointerup",up);c.addEventListener("pointercancel",up);
    c.addEventListener("wheel",e=>{e.preventDefault();W3.o.r=clamp(W3.o.r*Math.exp(e.deltaY*0.0012),3,300);render3D();},{passive:false});
    new ResizeObserver(()=>size3D()).observe(box);}
  box.innerHTML="";box.appendChild(W3.r.domElement);
  if(!box.dataset.ro){box.dataset.ro="1";new ResizeObserver(()=>size3D()).observe(box);}
  frame3D();size3D();}
function pan3D(dx,dy){if(!W3.cam)return;const box=$("#wb3d"),hgt=(box&&box.clientHeight)||400;
  const k=2*W3.o.r*Math.tan(W3.cam.fov*Math.PI/360)/hgt;W3.cam.updateMatrixWorld();
  const rt=new THREE.Vector3().setFromMatrixColumn(W3.cam.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(W3.cam.matrixWorld,1);
  W3.o.tx+=(-dx*rt.x+dy*up.x)*k;W3.o.ty+=(-dx*rt.y+dy*up.y)*k;W3.o.tz+=(-dx*rt.z+dy*up.z)*k;}
function frame3D(){const e=gridExt(LM()),m=S.model;W3.o.tx=(e.x0+e.x1)/2;W3.o.tz=(e.y0+e.y1)/2;W3.o.ty=(m.found+m.stories[m.stories.length-1].elev)/2;
  W3.o.r=Math.max(e.x1-e.x0,e.y1-e.y0,6)*2.7;W3.o.th=-0.9;W3.o.ph=1.0;}
function size3D(){const box=$("#wb3d");if(!W3.r||!box||!box.clientWidth)return;W3.r.setSize(box.clientWidth,box.clientHeight,false);W3.cam.aspect=box.clientWidth/box.clientHeight;W3.cam.updateProjectionMatrix();render3D();}
function build3D(){if(!WB.show3d||!W3.r)return;const m=S.model,G=W3.grp;
  while(G.children.length){const o=G.children.pop();o.geometry&&o.geometry.dispose();}
  const conc=new THREE.MeshLambertMaterial({color:0xc9cec6}),colm=new THREE.MeshLambertMaterial({color:0xa3abb4}),selm=new THREE.MeshLambertMaterial({color:0x2f63b8}),
    slm=new THREE.MeshLambertMaterial({color:0xd8dcd4,transparent:true,opacity:.45,depthWrite:false}),slsel=new THREE.MeshLambertMaterial({color:0x2f63b8,transparent:true,opacity:.5,depthWrite:false}),
    edge=new THREE.LineBasicMaterial({color:0x3a4350}),dim=new THREE.LineBasicMaterial({color:0x9aa3ad});
  const add=(geo,mat,x,y,z,ry=0,ed=edge)=>{const me=new THREE.Mesh(geo,mat);me.position.set(x,y,z);me.rotation.y=ry;G.add(me);const l=new THREE.LineSegments(new THREE.EdgesGeometry(geo),ed);l.position.copy(me.position);l.rotation.y=ry;G.add(l);return me;};
  m.stories.forEach((st,i)=>{const isCur=i===m.cur,bot=colBottom(i),H=st.elev-bot,Lm=LM(i);
    for(const c of st.columns) if(H>0) add(new THREE.BoxGeometry(c.b,H,c.h),isCur&&WB.selCol.has(c.id)?selm:colm,c.x,bot+H/2,c.y);
    for(const b of st.beams){const L=blen(b),a=Math.atan2(b.y2-b.y1,b.x2-b.x1);add(new THREE.BoxGeometry(L,b.h,b.b),isCur&&WB.sel.has(b.id)?selm:conc,(b.x1+b.x2)/2,st.elev-b.h/2,(b.y1+b.y2)/2,-a);}
    for(const pn of (isCur?WB.panels:findPanels(Lm))){const sp=slabProps(Lm,pn.key);if(sp.kind==="none")continue;
      const sh=new THREE.Shape(pn.poly.map(q=>new THREE.Vector2(q.x,q.y)));const geo=new THREE.ExtrudeGeometry(sh,{depth:sp.t,bevelEnabled:false});
      const me=new THREE.Mesh(geo,isCur&&WB.selSlab.has(pn.key)?slsel:slm);me.rotation.x=Math.PI/2;me.position.y=st.elev;G.add(me);}});
  const pts=[],e=gridExt(LM()),gy=m.found;
  for(const g of m.grid.x)pts.push(new THREE.Vector3(g.p,gy,e.y0-1.5),new THREE.Vector3(g.p,gy,e.y1+1.5));
  for(const g of m.grid.y)pts.push(new THREE.Vector3(e.x0-1.5,gy,g.p),new THREE.Vector3(e.x1+1.5,gy,g.p));
  G.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),dim));
  render3D();}
function render3D(){if(!W3.r)return;W3.scene.background=new THREE.Color(cssColor("--paper"));const o=W3.o,ty=o.ty;
  W3.cam.position.set(o.tx+o.r*Math.sin(o.ph)*Math.cos(o.th),ty+o.r*Math.cos(o.ph),o.tz+o.r*Math.sin(o.ph)*Math.sin(o.th));W3.cam.lookAt(o.tx,ty,o.tz);W3.r.render(W3.scene,W3.cam);}
function toggle3D(){WB.show3d=!WB.show3d;$("#wbViews").classList.toggle("three",WB.show3d);$("#wb3d").hidden=!WB.show3d;updateTools();
  if(WB.show3d) ensureThree(()=>{init3D();build3D();}); setTimeout(()=>{if(!WB.show3d||innerWidth>860)fitView();},30);}

/* ---------- โครงหน้าจอและเหตุการณ์ ---------- */
function viewWorkbench(){return `<div class="wb" id="wb"><div class="wb-tools" role="toolbar" aria-label="เครื่องมือแปลน">${toolsHTML()}</div>
  <div class="wb-stage"><div class="wb-hint" id="wbHint" role="status" aria-live="polite"></div>
   <div class="wb-views" id="wbViews"><div class="wb-plan"><svg id="wbSvg" aria-label="แปลนชั้น"><g id="wbScene"><g id="wbStatic"></g><g id="wbDyn"></g></g><g id="wbOver"></g></svg></div><div class="wb-3d" id="wb3d" hidden></div></div>
   <div class="wb-stories" id="wbStories" role="group" aria-label="เลือกชั้น"></div>
   <div class="wb-len" id="wbLen" hidden><label for="wbLenIn">ความยาว</label><input id="wbLenIn" type="number" inputmode="decimal" step="any"><span class="u">ม.</span>
    <button class="btn primary" data-wbact="lenGo">วาง</button><button class="btn" data-wbdir="1,0" aria-label="ไปทางขวา">→</button><button class="btn" data-wbdir="-1,0" aria-label="ไปทางซ้าย">←</button><button class="btn" data-wbdir="0,-1" aria-label="ขึ้น">↑</button><button class="btn" data-wbdir="0,1" aria-label="ลง">↓</button><button class="btn" data-wbact="lenClose">ปิด</button></div>
  </div><aside class="wb-panel" id="wbPanel" aria-label="คุณสมบัติ"></aside></div>`;}
function wbFit(){const el=$("#wb");if(!el)return;const sb=parseFloat(getComputedStyle(document.documentElement).paddingBottom)||0;el.style.height=Math.max(380,innerHeight-el.getBoundingClientRect().top-sb)+"px";}
function relP(e){const r=$("#wbSvg").getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function updCursor(p){WB.curS=p;const w=toW(p);WB.cur=doSnap(w.x,w.y);drawDyn();}
function initWorkbench(){
  WB.topo=analyzeModel(LM());WB.panels=findPanels(LM());refreshSnap();
  const svg=$("#wbSvg"),wb=$("#wb");
  if(innerWidth>860) WB.panelOpen=true;
  wbFit();renderPanel();updateTools();renderStories();
  if(WB.show3d){$("#wbViews").classList.add("three");$("#wb3d").hidden=false;ensureThree(()=>{init3D();build3D();});}
  requestAnimationFrame(()=>{wbFit();if(!WB.v)fitView();else drawAll();});
  svg.addEventListener("contextmenu",e=>e.preventDefault());
  svg.addEventListener("pointerdown",e=>{svg.setPointerCapture(e.pointerId);WB.ptype=e.pointerType==="mouse"?"mouse":"touch";
    const p=relP(e);WB.pointers.set(e.pointerId,p);
    if(WB.pointers.size===2){clearTimeout(WB.lpTimer);WB.aim=false;const [a,b]=[...WB.pointers.values()];
      WB.pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,m:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},s:WB.v.s,tx:WB.v.tx,ty:WB.v.ty};WB.gest="pinch";drawDyn();return;}
    WB.down={x:p.x,y:p.y};WB.moved=false;WB.panBase=null;
    if(e.pointerType==="mouse"){WB.gest=e.button===1?"pan":e.button===2?"rclick":"press";}
    else if(WB.tool!=="select"){WB.gest="aim";WB.aim=true;updCursor(p);}
    else{WB.gest="press";WB.lpTimer=setTimeout(()=>{if(!WB.moved&&WB.gest==="press"){const w=toW(p),h=hit(w.x,w.y);
      if(h){WB.panelOpen=true;selectHit(h,WB.multi);navigator.vibrate&&navigator.vibrate(15);}WB.gest="done";}},550);}
    refreshHintIfType();});
  svg.addEventListener("pointermove",e=>{const p=relP(e);
    if(WB.pointers.has(e.pointerId))WB.pointers.set(e.pointerId,p);
    if(WB.gest==="pinch"&&WB.pointers.size>=2){const [a,b]=[...WB.pointers.values()],P=WB.pinch,s=clamp(P.s*Math.hypot(a.x-b.x,a.y-b.y)/P.d,4,600),m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      const wx=(P.m.x-P.tx)/P.s,wy=(P.m.y-P.ty)/P.s;WB.v={s,tx:m.x-wx*s,ty:m.y-wy*s};drawAll();return;}
    if(!WB.down){if(e.pointerType==="mouse"&&WB.tool!=="select"){WB.ptype="mouse";updCursor(p);}return;}
    const dx=p.x-WB.down.x,dy=p.y-WB.down.y;if(Math.hypot(dx,dy)>(e.pointerType==="mouse"?5:9))WB.moved=true;
    if(WB.gest==="aim"){updCursor(p);return;}
    if((WB.gest==="press"&&WB.moved)||WB.gest==="pan"){WB.gest="pan";clearTimeout(WB.lpTimer);if(!WB.panBase)WB.panBase={tx:WB.v.tx-dx,ty:WB.v.ty-dy};
      WB.v.tx=WB.panBase.tx+dx;WB.v.ty=WB.panBase.ty+dy;drawAll();}});
  const up=e=>{WB.pointers.delete(e.pointerId);clearTimeout(WB.lpTimer);
    if(WB.gest==="pinch"){if(!WB.pointers.size){WB.gest=null;WB.down=null;}return;}
    const g=WB.gest,d=WB.down;WB.gest=null;WB.down=null;WB.panBase=null;if(!d||e.type==="pointercancel"){WB.aim=false;drawDyn();return;}
    const p=relP(e);
    if(g==="rclick"){endChain();return;}
    if(g==="aim"){WB.aim=false;updCursor(p);place();WB.curS=null;drawDyn();return;}
    if(g==="press"&&!WB.moved){if(WB.tool==="select"){const w=toW(p);selectHit(hit(w.x,w.y),e.shiftKey||e.ctrlKey||e.metaKey||WB.multi);}else{updCursor(p);place();}}};
  svg.addEventListener("pointerup",up);svg.addEventListener("pointercancel",up);
  svg.addEventListener("pointerleave",e=>{if(e.pointerType==="mouse"&&!WB.down){WB.cur=null;drawDyn();}});
  svg.addEventListener("wheel",e=>{e.preventDefault();const p=relP(e),s=clamp(WB.v.s*Math.exp(-e.deltaY*0.0015),4,600),wx=(p.x-WB.v.tx)/WB.v.s,wy=(p.y-WB.v.ty)/WB.v.s;
    WB.v={s,tx:p.x-wx*s,ty:p.y-wy*s};drawAll();},{passive:false});
  wb.addEventListener("click",e=>{
    const t=e.target.closest("[data-wbtool]");
    if(t){const id=t.dataset.wbtool;
      if(["select","column","beam"].includes(id))setTool(id);
      else if(id==="load"){WB.showLoad=!WB.showLoad;updateTools();drawAll();}
      else if(id==="ortho"){WB.ortho=!WB.ortho;updateTools();if(WB.curS)updCursor(WB.curS);}
      else if(id==="del")deleteSel(); else if(id==="undo")undo(); else if(id==="redo")redo();
      else if(id==="fit"){fitView();if(WB.show3d&&W3.r){frame3D();render3D();}} else if(id==="d3")toggle3D(); else if(id==="help")openHelp();
      else if(id==="panel"){WB.panelOpen=!WB.panelOpen;renderPanel();updateTools();}
      return;}
    const dir=e.target.closest("[data-wbdir]");if(dir){const [x,y]=dir.dataset.wbdir.split(",").map(Number);placeLen({x,y});return;}
    const ch=e.target.closest("[data-chain]");if(ch){const c=WB.topo.chains[+ch.dataset.chain];clearSel();WB.sel=new Set(c.members);drawAll();renderPanel();build3D();updateTools();return;}
    const sw=e.target.closest("[data-swap]");if(sw){pushHist();const st=curStory();st.over=st.over||{};st.over[sw.dataset.swap]=sw.dataset.sup;changed();return;}
    const sy=e.target.closest("[data-story]");if(sy){setStory(+sy.dataset.story);return;}
    const la=e.target.closest("[data-ldact]");if(la){loadsAct(la);return;}
    const a=e.target.closest("[data-wbact]");if(!a)return;const act=a.dataset.wbact;
    if(act==="endChain")endChain(); else if(act==="lenBox")showLen(); else if(act==="lenGo")placeLen(); else if(act==="lenClose")hideLen();
    else if(act==="hintMin"){WB.hintMin=!WB.hintMin;refreshHint();}
    else if(act==="multi"){WB.multi=!WB.multi;refreshHint();}
    else if(act==="panel"){WB.panelOpen=!WB.panelOpen;renderPanel();updateTools();}
    else if(act==="del")deleteSel();
    else if(act==="addStory"){pushHist();const m=S.model,top=m.stories[m.stories.length-1];
      m.stories.push(newStory("ชั้น "+(m.stories.length+1),+(top.elev+3).toFixed(3)));m.cur=m.stories.length-1;clearSel();changed();fitView();}
    else if(act==="delStory"){const m=S.model;if(m.stories.length<2){alert("ต้องมีอย่างน้อย 1 ชั้น");return;}
      if(confirm(`ลบ${curStory().name} พร้อมเสา คาน และพื้นทั้งหมดของชั้นนี้? กดย้อนกลับได้`)){pushHist();m.stories.splice(m.cur,1);m.cur=Math.max(0,m.cur-1);clearSel();changed();}}
    else if(act==="copyStory") copyStoryDialog();
    else if(act==="slabAll"){const key=[...WB.selSlab][0],st=curStory(),src=slabProps(LM(),key);pushHist();
      WB.panels.forEach(p=>{st.slabs[p.key]={name:src.name,t:src.t,kind:src.kind};});changed();}
    else if(act==="selChain"){const T=WB.topo,ids=new Set();[...WB.sel].forEach(id=>T.chains[T.beamChain.get(id)].members.forEach(m=>ids.add(m)));WB.sel=ids;drawAll();renderPanel();build3D();}
    else if(act==="allCols"){pushHist();let n=0;for(const gx of S.model.grid.x)for(const gy of S.model.grid.y)if(addColumn({x:gx.p,y:gy.p}))n++;if(n)changed();else WB.hist.pop();}
    else if(act==="example"){if(!LM().beams.length||confirm("แทนที่แปลนปัจจุบันด้วยตัวอย่าง? กดย้อนกลับได้"))loadExample();}
    else if(act==="clear"){if(confirm(`ลบเสา คาน และข้อมูลพื้นทั้งหมดของ${curStory().name}? กดย้อนกลับได้`)){pushHist();const st=curStory();st.columns=[];st.beams=[];st.slabs={};st.over={};clearSel();changed();}}
  });
  wb.addEventListener("change",e=>{const el=e.target,M=LM();if(WB.mode==="loads"&&loadsChange(el))return;
    if(el.dataset.lds||el.dataset.ldb||el.dataset.ldw||el.dataset.ld)return;
    if(el.dataset.wb){const k=el.dataset.wb,v=k==="name"?el.value.trim():parseFloat(el.value);if(k==="name"?!v:!(v>0))return;pushHist();M.beams.forEach(b=>{if(WB.sel.has(b.id))b[k]=v;});changed();}
    else if(el.dataset.wbc){const k=el.dataset.wbc,v=k==="name"?el.value.trim():parseFloat(el.value);if(k==="name"?!v:!(v>0))return;pushHist();M.columns.forEach(c=>{if(WB.selCol.has(c.id))c[k]=v;});changed();}
    else if(el.dataset.wbg){const sp=el.value.split(/[,\s]+/).map(parseFloat).filter(v=>v>0);if(!sp.length){renderPanel();return;}pushHist();
      const pos=[0];sp.forEach(v=>pos.push(+(pos.at(-1)+v).toFixed(4)));
      M.grid[el.dataset.wbg]=pos.map((p,i)=>({n:el.dataset.wbg==="x"?String.fromCharCode(65+i):String(i+1),p}));changed();fitView();}
    else if(el.dataset.wbd){const v=parseFloat(el.value);if(!(v>0))return;const k=el.dataset.wbd,m=S.model;
      if(k==="col")m.defCol={b:v,h:v};else if(k==="bb")m.defBeam.b=v;else if(k==="bh")m.defBeam.h=v;else if(k==="st")m.defSlab.t=v;save();}
    else if(el.dataset.wbs){const k=el.dataset.wbs,st=curStory();let v=el.value;if(k==="t"){v=parseFloat(v);if(!(v>0))return;}else if(k==="name"){v=v.trim();if(!v)return;}else if(!v)return;
      pushHist();WB.selSlab.forEach(key=>{st.slabs[key]=Object.assign(st.slabs[key]||{},{[k]:v});});changed();}
    else if(el.dataset.wst){const k=el.dataset.wst,m=S.model,st=curStory();
      if(k==="name"){const v=el.value.trim();if(!v)return;pushHist();st.name=v;changed();return;}
      const v=parseFloat(el.value);if(isNaN(v))return;pushHist();
      if(k==="found"){m.found=v;}else{st.elev=v;m.stories.sort((a,b)=>a.elev-b.elev);m.cur=m.stories.indexOf(st);}
      changed();}});
  $("#wbLenIn").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();placeLen();}if(e.key==="Escape"){hideLen();}});
  try{if(!localStorage.getItem("knstudio.help"))setTimeout(openHelp,300);}catch(e){}
}
function refreshHintIfType(){const h=$("#wbHint");if(h&&h.dataset.pt!==WB.ptype){h.dataset.pt=WB.ptype;refreshHint();}}
document.addEventListener("keydown",e=>{if((view!=="model"&&view!=="loads")||$("#dlg").open)return;const tg=e.target.tagName;if(tg==="INPUT"||tg==="TEXTAREA"||tg==="SELECT")return;
  const k=e.key;
  if((e.ctrlKey||e.metaKey)&&k.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo();return;}
  if((e.ctrlKey||e.metaKey)&&k.toLowerCase()==="y"){e.preventDefault();redo();return;}
  if(k==="Escape"){if(WB.start)endChain();else{clearSel();drawAll();renderPanel();build3D();updateTools();}return;}
  if(k==="Delete"||k==="Backspace"){deleteSel();return;}
  if(WB.tool==="beam"&&WB.start&&/^[0-9.]$/.test(k)){e.preventDefault();showLen(k);return;}
  const map={v:"select",c:"column",b:"beam"};if(map[k.toLowerCase()]){setTool(map[k.toLowerCase()]);return;}
  if(k.toLowerCase()==="o"){WB.ortho=!WB.ortho;updateTools();return;}
  if(k.toLowerCase()==="f"){fitView();if(WB.show3d&&W3.r){frame3D();render3D();}return;}
  if(k==="PageUp"){e.preventDefault();setStory(S.model.cur+1);return;}
  if(k==="PageDown"){e.preventDefault();setStory(S.model.cur-1);return;}
  if(k==="?"){openHelp();}});
addEventListener("resize",()=>{if(view==="model"||view==="loads"){wbFit();drawAll();}});

