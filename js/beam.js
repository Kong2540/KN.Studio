"use strict";
/* ============================================================
   STEP 2 — โมดูลคาน ค.ส.ล. (วิธีกำลัง, เสริมเหล็กรับแรงดึงอย่างเดียว)
   opts.legacy = true → ใช้สมมติฐานเดียวกับไฟล์ B1 เพื่อทดสอบเทียบค่า
   ============================================================ */
function designBeam(bm,mat,phiCase,opts={}){
  const T=new Trace(), phi=PHI[phiCase], leg=!!opts.legacy;
  const fc=mat.fc, fy=mat.fy, Es=mat.Es;
  const b=bm.b*100, h=bm.h*100, cv=bm.cover*100, sc=bm.clear*100, ds=bm.stDia/10, L=bm.L;
  const fyv = bm.stType==="DB"?fy:mat.fvy;

  // ---- น้ำหนักบรรทุก
  let Mu=+bm.Mu, Vu=+bm.Vu;
  T.group("1. แรงกระทำ");
  if(bm.loadMode==="udl"){
    const sw = bm.selfWt? bm.b*bm.h*2400 : 0;
    if(bm.selfWt) T.add("น้ำหนักคานเอง","b·h·2400",`${bm.b}·${bm.h}·2400`,sw,"กก./ม.","STAT",1);
    const wD=+bm.wD+sw, wu=T.add("น้ำหนักแผ่ปรับค่า wu","1.4wD + 1.7wL",`1.4·${fmt(wD,1)} + 1.7·${fmt(bm.wL,1)}`,1.4*wD+1.7*bm.wL,"กก./ม.","MR66_7",1);
    const Pu=T.add("น้ำหนักจุดปรับค่า Pu","1.4PD + 1.7PL",`1.4·${fmt(bm.pD,0)} + 1.7·${fmt(bm.pL,0)}`,1.4*bm.pD+1.7*bm.pL,"กก.","MR66_7",1);
    if(bm.support==="cantilever"){
      Mu=T.add("Mu (คานยื่น, P ที่ปลาย)","wu·L²/2 + Pu·L",`${fmt(wu,1)}·${L}²/2 + ${fmt(Pu,0)}·${L}`,wu*L*L/2+Pu*L,"กก.-ม.","STAT");
      Vu=T.add("Vu","wu·L + Pu","",wu*L+Pu,"กก.","STAT");
    }else{
      Mu=T.add("Mu (ช่วงเดียว, P กลางช่วง)","wu·L²/8 + Pu·L/4",`${fmt(wu,1)}·${L}²/8 + ${fmt(Pu,0)}·${L}/4`,wu*L*L/8+Pu*L/4,"กก.-ม.","STAT");
      Vu=T.add("Vu","wu·L/2 + Pu/2","",wu*L/2+Pu/2,"กก.","STAT");
    }
  }else{
    T.add("Mu (ป้อนค่า)","","",Mu,"กก.-ม.",null);
    T.add("Vu (ป้อนค่า)","","",Vu,"กก.",null);
  }

  // ---- เรขาคณิตหน้าตัด
  const tens = bm.sign==="+"? bm.bot : bm.top, comp = bm.sign==="+"? bm.top : bm.bot;
  const L1=tens[0], L2=tens[1];
  const As1=L1.n*A(L1.d), As2=L2.n*A(L2.d), As=As1+As2;
  const y1=cv+ds+L1.d/20, y2=cv+ds+L1.d/10+sc+L2.d/20;
  T.group("2. หน้าตัดและความลึกประสิทธิผล");
  T.add("พื้นที่เหล็กรับแรงดึง As",`Σ n·πdb²/4`,`${L1.n}-${L1.d}มม. + ${L2.n}-${L2.d}มม.`,As,"ซม.²","FLEX",3);
  let d;
  if(leg){
    d=T.add("ความลึกประสิทธิผล d (ตามไฟล์เดิม)","h − ระยะหุ้ม − db,ปลอก − db/2 ของชั้นที่ 1",`${h} − ${cv} − ${ds} − ${L1.d/20}`,h-cv-ds-L1.d/20,"ซม.","SHEET",2);
  }else{
    const ybar = As>0? (As1*y1+As2*y2)/As : y1;
    if(As2>0) T.add("ระยะศูนย์ถ่วงเหล็กจากผิวรับแรงดึง ȳ","(As₁y₁ + As₂y₂)/As",`(${fmt(As1,3)}·${fmt(y1)} + ${fmt(As2,3)}·${fmt(y2)})/${fmt(As,3)}`,ybar,"ซม.","FLEX");
    d=T.add("ความลึกประสิทธิผล d","h − ȳ",`${h} − ${fmt(ybar)}`,h-ybar,"ซม.","FLEX");
  }

  // ---- แรงดัด
  T.group("3. ออกแบบรับแรงดัด");
  const b1 = fc<=280?0.85:Math.max(0.65,0.85-0.05*(fc-280)/70);
  T.add("β₁","0.85 เมื่อ fc′ ≤ 280","",b1,"","FLEX",2);
  const rb=T.add("ρb","0.85β₁(fc′/fy)·6120/(6120+fy)",`0.85·${b1}·(${fc}/${fy})·6120/(6120+${fy})`,0.85*b1*(fc/fy)*(6120/(6120+fy)),"","RHO",5);
  const rmax=T.add("ρmax","0.75ρb","",0.75*rb,"","RHO",5);
  const rmin=T.add("ρmin","14/fy",`14/${fy}`,14/fy,"","RHO",5);
  const rho=T.add("ρ ที่ใช้","As/(b·d)",`${fmt(As,3)}/(${b}·${fmt(d)})`,As/(b*d),"","FLEX",5);
  const a=T.add("ความลึกบล็อกหน่วยแรง a","As·fy/(0.85fc′·b)",`${fmt(As,3)}·${fy}/(0.85·${fc}·${b})`,As*fy/(0.85*fc*b),"ซม.","FLEX",3);
  const c=a/b1, es=0.003*(d-c)/c, ey=fy/Es;
  T.add("แกนสะเทิน c","a/β₁","",c,"ซม.","FLEX",2);
  T.add("ความเครียดเหล็ก εs","0.003(d − c)/c","",es,"","FLEX",5);
  const phiMn=T.add("กำลังรับโมเมนต์ ɸMn","ɸb·As·fy·(d − a/2)",`${phi.flex}·${fmt(As,3)}·${fy}·(${fmt(d)} − ${fmt(a,3)}/2)/100`,phi.flex*As*fy*(d-a/2)/100,"กก.-ม.","MR66_8");
  const m=fy/(0.85*fc), Rn=Mu*100/(phi.flex*b*d*d);
  T.add("m","fy/(0.85fc′)","",m,"","FLEX",3);
  T.add("Rn","Mu/(ɸb·b·d²)",`${fmt(Mu,0)}·100/(${phi.flex}·${b}·${fmt(d)}²)`,Rn,"กก./ซม.²","FLEX",3);
  const disc=1-2*m*Rn/fy;
  const rreq=disc>=0? T.add("ρ ที่ต้องการ","(1/m)[1 − √(1 − 2m·Rn/fy)]","",(1/m)*(1-Math.sqrt(disc)),"","FLEX",5) : (T.add("ρ ที่ต้องการ","หน้าตัดเล็กเกินไป (ค่าใต้รากติดลบ)","",NaN,"","FLEX"),Infinity);
  T.add("As ที่ต้องการ","max(ρreq, ρmin)·b·d","",Math.max(rreq,rmin)*b*d,"ซม.²","FLEX",3);

  T.check("ɸMn ≥ Mu",phiMn>=Mu,`${fmt(phiMn,0)} ≥ ${fmt(Mu,0)} กก.-ม.`,"MR66_8");
  T.check("ρ ≥ ρmin",rho>=rmin,`${fmt(rho,5)} ≥ ${fmt(rmin,5)}`,"RHO");
  T.check("ρ ≤ ρmax",rho<=rmax,`${fmt(rho,5)} ≤ ${fmt(rmax,5)}`,"RHO");
  T.check("เหล็กรับแรงดึงถึงจุดคราก εs ≥ εy",es>=ey,`${fmt(es,5)} ≥ ${fmt(ey,5)}`,"FLEX");

  // ---- แรงเฉือน
  T.group("4. ออกแบบรับแรงเฉือน");
  const sq=Math.sqrt(fc), phv = phi.shear;
  const phVc=T.add("ɸVc","ɸv·0.53√fc′·b·d",`${phv}·0.53·√${fc}·${b}·${fmt(d)}`,phv*0.53*sq*b*d,"กก.","SHEAR");
  const Vs=T.add("Vs ที่ต้องการ","(Vu − ɸVc)/ɸv",`(${fmt(Vu,0)} − ${fmt(phVc,0)})/${phv}`,Math.max(0,(Vu-phVc)/phv),"กก.","SHEAR");
  const lim1=T.add("1.1√fc′·b·d (เกินค่านี้ลดระยะเรียงครึ่งหนึ่ง)","","",1.1*sq*b*d,"กก.","SHEAR",0);
  const lim2=T.add("Vs สูงสุด 2.1√fc′·b·d","","",2.1*sq*b*d,"กก.","SHEAR",0);
  const Av=T.add("Av",`${bm.legs} ขา · π·db²/4`,`${bm.legs}·π·${ds}²/4`,bm.legs*A(bm.stDia),"ซม.²","SHEAR",4);
  const sStr = Vs>0? Av*fyv*d/Vs : Infinity;
  const sMinAv = Av*fyv/(3.5*b);
  const sMax = Vs>lim1? Math.min(d/4,30) : Math.min(d/2,60);
  if(leg){
    T.add("S1 = Av·fy/(3.5b)","","",sMinAv,"ซม.","SHEAR");
    T.add("S2 = bw (ตามไฟล์เดิม)","","",b,"ซม.","SHEET");
    T.add("S3 = ɸb·Av·fy·d/Vs (ตามไฟล์เดิม ใช้ ɸb)","","",Vs>0? Math.round(phi.flex*Av*fyv*(d/100)/Vs*100)/100*100 : Infinity,"ซม.","SHEET");
    T.add("S4 = d/2","","",d/2,"ซม.","SHEAR");
  }else{
    T.add("s จากกำลัง","Av·fyv·d/Vs",Vs>0?`${fmt(Av,4)}·${fyv}·${fmt(d)}/${fmt(Vs,0)}`:"ไม่ต้องการ Vs",sStr,"ซม.","SHEAR");
    T.add("s จากเหล็กปลอกขั้นต่ำ","Av·fyv/(3.5b)",`${fmt(Av,4)}·${fyv}/(3.5·${b})`,sMinAv,"ซม.","SHEAR");
    T.add("s สูงสุด",Vs>lim1?"min(d/4, 30)":"min(d/2, 60)","",sMax,"ซม.","SHEAR");
  }
  const sAllow=Math.min(sStr,sMinAv,sMax);
  T.add("ระยะเรียงที่ยอมให้","ค่าน้อยที่สุดข้างต้น","",sAllow,"ซม.","SHEAR");
  const phVs=T.add(`ɸVs ที่ใช้ (${bm.stType}${bm.stDia} @${bm.s} ซม.)`,"ɸv·Av·fyv·d/s",`${phv}·${fmt(Av,4)}·${fyv}·${fmt(d)}/${bm.s}`,phv*Av*fyv*d/bm.s,"กก.","SHEAR");
  T.check("Vs ≤ 2.1√fc′bd (ขนาดหน้าตัดพอ)",Vs<=lim2,`${fmt(Vs,0)} ≤ ${fmt(lim2,0)} กก.`,"SHEAR");
  T.check("ระยะเรียงเหล็กปลอก ≤ ค่าที่ยอมให้",bm.s<=sAllow+1e-9,`${bm.s} ≤ ${fmt(sAllow,1)} ซม.`,"SHEAR");
  T.check("ɸVc + ɸVs ≥ Vu",phVc+phVs>=Vu,`${fmt(phVc+phVs,0)} ≥ ${fmt(Vu,0)} กก.`,"SHEAR");

  // ---- รายละเอียดการเสริมเหล็ก
  T.group("5. รายละเอียดการเสริมเหล็ก");
  const minClear=(db)=>Math.max(db/10,2.5,4/3*mat.agg/10);
  [["ล่าง",bm.bot],["บน",bm.top]].forEach(([nm,lay])=>lay.forEach((ly,i)=>{
    if(ly.n<2) return;
    const cl=(b-2*cv-2*ds-ly.n*ly.d/10)/(ly.n-1);
    T.add(`ช่องว่างเหล็ก${nm} ชั้น ${i+1} (${ly.n}-${ly.d}มม.)`,"(b − 2c − 2db,ปลอก − n·db)/(n − 1)","",cl,"ซม.","DET");
    T.check(`ช่องว่างเหล็ก${nm} ชั้น ${i+1} ≥ ${fmt(minClear(ly.d),2)} ซม.`,cl>=minClear(ly.d)-1e-9,`${fmt(cl,2)} ซม.`,"DET");
  }));
  const k={simple:16,one:18.5,both:21,cantilever:8}[bm.support]||16;
  const hmin=T.add("ความลึกต่ำสุดที่ไม่ต้องตรวจการโก่งตัว",`L/${k}·(0.4 + fy/7000)`,`${L*100}/${k}·(0.4 + ${fy}/7000)`,L*100/k*(0.4+fy/7000),"ซม.","DEFL",1);
  T.check("h ≥ ความลึกต่ำสุด (ไม่ต้องตรวจการโก่งตัว)",h>=hmin,`${h} ≥ ${fmt(hmin,1)} ซม.`,"DEFL");

  return {T, Mu, Vu, d, As, a, rho, phiMn, phVc, Vs, Av, sMinAv, sStr, sMax, sAllow, phVs, lim1, lim2, rb, rmax, rmin, Rn, rreq,
    ok:T.checks.every(c=>c.ok)};
}

/* ---------- ภาพหน้าตัด 2D (SVG, หน่วย ซม.) ---------- */
function sectionSVG(bm){
  const b=bm.b*100,h=bm.h*100,cv=bm.cover*100,ds=bm.stDia/10,sc=bm.clear*100, m=9;
  const W=b+2*m+4, H=h+2*m;
  let s=`<svg viewBox="${-m-4} ${-m} ${W} ${H}" width="${Math.min(300,W*6)}" role="img" aria-label="หน้าตัดคาน ${esc(bm.name)}">`;
  s+=`<rect class="conc" x="0" y="0" width="${b}" height="${h}"/>`;
  const r=ds*2;
  s+=`<rect class="stir" x="${cv+ds/2}" y="${cv+ds/2}" width="${b-2*cv-ds}" height="${h-2*cv-ds}" rx="${r}"/>`;
  const drawLayer=(ly,y)=>{ if(!ly.n) return ""; const db=ly.d/10, x0=cv+ds+db/2, x1=b-cv-ds-db/2; let o="";
    for(let i=0;i<ly.n;i++){const x=ly.n===1?b/2:x0+(x1-x0)*i/(ly.n-1); o+=`<circle class="bar" cx="${x}" cy="${y}" r="${db/2}"/>`;} return o;};
  const B1=bm.bot[0],B2=bm.bot[1],T1=bm.top[0],T2=bm.top[1];
  s+=drawLayer(B1,h-cv-ds-B1.d/20)+drawLayer(B2,h-cv-ds-B1.d/10-sc-B2.d/20);
  s+=drawLayer(T1,cv+ds+T1.d/20)+drawLayer(T2,cv+ds+T1.d/10+sc+T2.d/20);
  // dims
  s+=`<path class="dim" d="M0 ${h+3} H${b} M0 ${h+1.8} V${h+4.2} M${b} ${h+1.8} V${h+4.2}"/><text x="${b/2}" y="${h+6.8}" text-anchor="middle">${fmt(b,0)} ซม.</text>`;
  s+=`<path class="dim" d="M-3 0 V${h} M-4.2 0 H-1.8 M-4.2 ${h} H-1.8"/><text x="-5" y="${h/2}" text-anchor="middle" transform="rotate(-90 -5 ${h/2})">${fmt(h,0)} ซม.</text>`;
  s+=`</svg>`; return s;
}
const barsText=lay=>lay.filter(l=>l.n>0).map(l=>`${l.n}-DB${l.d}`).join(" + ")||"–";

