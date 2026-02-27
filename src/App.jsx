import { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Area, AreaChart
} from "recharts";

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const DEFAULT_EXPENSE_CATS = [
  { id:"e1", name:"Food & Dining",  icon:"🍽️", color:"#f97316", sub:[{id:"e1s1",name:"Restaurants"},{id:"e1s2",name:"Groceries"},{id:"e1s3",name:"Coffee & Snacks"},{id:"e1s4",name:"Food Delivery"}]},
  { id:"e2", name:"Transportation", icon:"🚗", color:"#3b82f6", sub:[{id:"e2s1",name:"Fuel"},{id:"e2s2",name:"Public Transit"},{id:"e2s3",name:"Taxi / Cab"},{id:"e2s4",name:"Vehicle Maintenance"}]},
  { id:"e3", name:"Housing",        icon:"🏠", color:"#8b5cf6", sub:[{id:"e3s1",name:"Rent / EMI"},{id:"e3s2",name:"Electricity"},{id:"e3s3",name:"Water & Gas"},{id:"e3s4",name:"Repairs"}]},
  { id:"e4", name:"Entertainment",  icon:"🎬", color:"#ec4899", sub:[{id:"e4s1",name:"Movies"},{id:"e4s2",name:"Streaming"},{id:"e4s3",name:"Games"},{id:"e4s4",name:"Events"}]},
  { id:"e5", name:"Health",         icon:"💊", color:"#14b8a6", sub:[{id:"e5s1",name:"Pharmacy"},{id:"e5s2",name:"Doctor"},{id:"e5s3",name:"Gym"},{id:"e5s4",name:"Insurance"}]},
  { id:"e6", name:"Shopping",       icon:"🛍️", color:"#f59e0b", sub:[{id:"e6s1",name:"Clothing"},{id:"e6s2",name:"Electronics"},{id:"e6s3",name:"Home & Decor"},{id:"e6s4",name:"Gifts"}]},
  { id:"e7", name:"Education",      icon:"📚", color:"#06b6d4", sub:[{id:"e7s1",name:"Tuition"},{id:"e7s2",name:"Books"},{id:"e7s3",name:"Courses"}]},
  { id:"e8", name:"Personal Care",  icon:"💆", color:"#a855f7", sub:[{id:"e8s1",name:"Salon & Spa"},{id:"e8s2",name:"Cosmetics"}]},
];
const DEFAULT_INCOME_CATS = [
  {id:"i1",name:"Salary",       icon:"💼",color:"#10b981"},{id:"i2",name:"Freelance",   icon:"💻",color:"#3b82f6"},
  {id:"i3",name:"Business",     icon:"🏢",color:"#f59e0b"},{id:"i4",name:"Investments", icon:"📈",color:"#8b5cf6"},
  {id:"i5",name:"Rental Income",icon:"🏘️",color:"#14b8a6"},{id:"i6",name:"Bonus",       icon:"🎁",color:"#ec4899"},
  {id:"i7",name:"Other",        icon:"💰",color:"#64748b"},
];
const DEFAULT_ACCOUNTS = [
  {id:"a1",name:"HDFC Savings",      type:"Savings",    balance:45000,color:"#10b981"},
  {id:"a2",name:"SBI Current",       type:"Current",    balance:12500,color:"#3b82f6"},
  {id:"a3",name:"ICICI Credit Card", type:"Credit Card",balance:-8200,color:"#f59e0b"},
  {id:"a4",name:"Cash Wallet",       type:"Cash",       balance:3000, color:"#8b5cf6"},
];
const DEFAULT_TXN = [
  {id:"t1", date:"2026-02-01",type:"income", accountId:"a1",catId:"i1",subCatId:null,  amount:65000,note:"Monthly salary"},
  {id:"t2", date:"2026-02-03",type:"expense",accountId:"a1",catId:"e1",subCatId:"e1s2",amount:4200, note:"Big Bazaar groceries"},
  {id:"t3", date:"2026-02-05",type:"expense",accountId:"a3",catId:"e6",subCatId:"e6s1",amount:2800, note:"Shirt and jeans"},
  {id:"t4", date:"2026-02-07",type:"expense",accountId:"a1",catId:"e3",subCatId:"e3s1",amount:15000,note:"Rent"},
  {id:"t5", date:"2026-02-09",type:"expense",accountId:"a4",catId:"e1",subCatId:"e1s1",amount:850,  note:"Dinner with friends"},
  {id:"t6", date:"2026-02-10",type:"income", accountId:"a2",catId:"i4",subCatId:null,  amount:3200, note:"Dividend payout"},
  {id:"t7", date:"2026-02-12",type:"expense",accountId:"a3",catId:"e4",subCatId:"e4s2",amount:1199, note:"Netflix + Prime"},
  {id:"t8", date:"2026-02-14",type:"expense",accountId:"a1",catId:"e2",subCatId:"e2s1",amount:2400, note:"Fuel for month"},
  {id:"t9", date:"2026-02-15",type:"income", accountId:"a1",catId:"i2",subCatId:null,  amount:12000,note:"Freelance project"},
  {id:"t10",date:"2026-02-18",type:"expense",accountId:"a1",catId:"e5",subCatId:"e5s2",amount:1500, note:"Clinic visit"},
  {id:"t11",date:"2026-02-20",type:"expense",accountId:"a4",catId:"e1",subCatId:"e1s3",amount:320,  note:"Starbucks"},
  {id:"t12",date:"2026-02-22",type:"expense",accountId:"a1",catId:"e3",subCatId:"e3s2",amount:2100, note:"Electricity bill"},
  {id:"t13",date:"2026-02-24",type:"expense",accountId:"a3",catId:"e6",subCatId:"e6s2",amount:5500, note:"Bluetooth earphones"},
  {id:"t14",date:"2026-01-05",type:"income", accountId:"a1",catId:"i1",subCatId:null,  amount:65000,note:"Jan salary"},
  {id:"t15",date:"2026-01-08",type:"expense",accountId:"a1",catId:"e3",subCatId:"e3s1",amount:15000,note:"Jan Rent"},
  {id:"t16",date:"2026-01-15",type:"expense",accountId:"a1",catId:"e1",subCatId:"e1s2",amount:3800, note:"Jan groceries"},
  {id:"t17",date:"2026-01-20",type:"expense",accountId:"a3",catId:"e2",subCatId:"e2s1",amount:2200, note:"Jan fuel"},
  {id:"t18",date:"2025-12-05",type:"income", accountId:"a1",catId:"i1",subCatId:null,  amount:65000,note:"Dec salary"},
  {id:"t19",date:"2025-12-10",type:"income", accountId:"a1",catId:"i6",subCatId:null,  amount:10000,note:"Year-end bonus"},
  {id:"t20",date:"2025-12-12",type:"expense",accountId:"a3",catId:"e6",subCatId:"e6s1",amount:6500, note:"Dec shopping"},
];

const COLORS_PALETTE = ["#10b981","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#ec4899","#14b8a6","#f97316","#06b6d4","#a855f7","#84cc16","#fb923c"];
const ACCOUNT_TYPES  = ["Savings","Current","Credit Card","Cash","Wallet","Fixed Deposit"];
const CAT_ICONS      = ["🍽️","🚗","🏠","🎬","💊","🛍️","📚","💆","✈️","🎓","🏋️","🐾","🎸","🖥️","🧾","🎁","💡","🔧","🏦","🧹","💰","📦","🤝","🎯","🧴","🐕","🚀","🎪","🌐","🏖️"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── THEME PALETTES ───────────────────────────────────────────────────────────
const DARK_THEME = {
  bg:"#0f1420", card:"#1a1f2e", card2:"#131828", card3:"#0d1520",
  text:"#f1f5f9", text2:"#e2e8f0", sub:"#94a3b8", muted:"#64748b",
  border:"#2d3748", input:"#0f1420", hover:"#232b3e", subhov:"#1e2640",
  header:"linear-gradient(135deg,#0f1420 0%,#1a2744 100%)",
  nav:"#1a1f2e", navBorder:"#2d3748",
};
const LIGHT_THEME = {
  bg:"#f0f4f8", card:"#ffffff", card2:"#f4f7fb", card3:"#e8f0fe",
  text:"#1e293b", text2:"#334155", sub:"#475569", muted:"#64748b",
  border:"#e2e8f0", input:"#f8fafc", hover:"#e8f0fe", subhov:"#dbeafe",
  header:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
  nav:"#ffffff", navBorder:"#e2e8f0",
};

// ─── PERIOD HELPERS ───────────────────────────────────────────────────────────
const PERIODS = [
  {id:"mtd",   label:"MTD"},
  {id:"7d",    label:"7 Days"},
  {id:"lastm", label:"Last Month"},
  {id:"3m",    label:"3 Months"},
  {id:"ytd",   label:"YTD"},
  {id:"custom",label:"Custom"},
];
function getPeriodDates(pid) {
  const today = new Date(); today.setHours(23,59,59,999);
  const y = today.getFullYear(), m = today.getMonth();
  switch(pid) {
    case "mtd":   return { from: new Date(y,m,1,0,0,0,0), to: today };
    case "7d":    { const f=new Date(today); f.setDate(f.getDate()-6); f.setHours(0,0,0,0); return {from:f,to:today}; }
    case "lastm": return { from: new Date(y,m-1,1,0,0,0,0), to: new Date(y,m,0,23,59,59,999) };
    case "3m":    return { from: new Date(y,m-3,1,0,0,0,0), to: new Date(y,m,0,23,59,59,999) };
    case "ytd":   return { from: new Date(y,0,1,0,0,0,0), to: today };
    default:      return { from: new Date(y,m,1,0,0,0,0), to: today };
  }
}
function toYMD(d){ if(!(d instanceof Date))return d; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

// ─── UTILS ────────────────────────────────────────────────────────────────────
const now = new Date();
function uid(){ return "x"+Math.random().toString(36).slice(2,9); }
function fmt(n){ return "₹"+Number(n).toLocaleString("en-IN"); }
function fmtDate(d){ return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); }

// ─── SMS PARSER ───────────────────────────────────────────────────────────────
// Parses common Indian bank / UPI SMS formats to extract transaction data
function parseSMS(text) {
  if(!text) return null;
  const t = text.replace(/,/g,""); // remove commas in amounts
  // Amount patterns: Rs.500, INR 1000, Rs 2500.50, ₹500
  const amtMatch = t.match(/(?:Rs\.?|INR|₹)\s*(\d+(?:\.\d{1,2})?)/i);
  if(!amtMatch) return null;
  const amount = parseFloat(amtMatch[1]);
  if(!amount || amount<=0) return null;
  // Type detection
  const lower = t.toLowerCase();
  const isDebit = /debited|debit|spent|paid|payment|withdrawn|withdrawal|upi.*sent|sent.*upi/i.test(lower);
  const isCredit = /credited|credit|received|deposited|refund/i.test(lower);
  if(!isDebit && !isCredit) return null;
  const type = isDebit ? "expense" : "income";
  // Merchant / note extraction
  let note = "";
  const merchantMatch = t.match(/(?:at|to|from|for)\s+([A-Za-z0-9 &'-]{2,30}?)(?:\s+on|\s+via|\s+ref|\.|\s*$)/i);
  if(merchantMatch) note = merchantMatch[1].trim();
  else {
    // Try VPA / UPI ID style
    const upiMatch = t.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)/);
    if(upiMatch) note = upiMatch[1];
  }
  return { type, amount, note: note||"SMS Transaction" };
}

// ─── EXPORT HELPERS ───────────────────────────────────────────────────────────
function buildExportRows(txns, accounts, expCats, incCats) {
  return [...txns].sort((a,b)=>b.date.localeCompare(a.date)).map(t => {
    const acc=accounts.find(a=>a.id===t.accountId);
    const cats=t.type==="expense"?expCats:incCats;
    const cat=cats.find(c=>c.id===t.catId);
    const sub=cat?.sub?.find(s=>s.id===t.subCatId);
    const signedAmt=t.type==="income"?t.amount:-t.amount;
    const catLabel=cat?cat.name:"";
    const subLabel=sub?sub.name:"";
    return { Date:fmtDate(t.date), Amount:signedAmt, Category:catLabel, "Sub Category":subLabel,
      "Category (Full)":subLabel?`${catLabel} / ${subLabel}`:catLabel, Note:t.note||"", Account:acc?.name||"", Type:t.type.charAt(0).toUpperCase()+t.type.slice(1) };
  });
}
function downloadBlob(content, filename, mime) {
  const blob=new Blob([content],{type:mime}); const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}
function exportCSV(txns,accounts,expCats,incCats){
  const rows=buildExportRows(txns,accounts,expCats,incCats);
  const headers=["Date","Amount","Category","Sub Category","Note","Account","Type"];
  const lines=[headers.join(",")];
  rows.forEach(r=>lines.push(headers.map(h=>`"${String(r[h]||"").replace(/"/g,'""')}"`).join(",")));
  downloadBlob("\uFEFF"+lines.join("\n"),"transactions.csv","text/csv;charset=utf-8;");
}
function exportExcel(txns,accounts,expCats,incCats){
  const rows=buildExportRows(txns,accounts,expCats,incCats);
  const ws=XLSX.utils.json_to_sheet(rows.map(r=>({"Date":r.Date,"Amount (₹)":r.Amount,"Category":r["Category (Full)"],"Note":r.Note,"Account":r.Account,"Type":r.Type})));
  ws["!cols"]=[{wch:14},{wch:14},{wch:28},{wch:30},{wch:20},{wch:10}];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Transactions"); XLSX.writeFile(wb,"transactions.xlsx");
}
function exportPDF(txns,accounts,expCats,incCats,periodLabel,appName){
  const rows=buildExportRows(txns,accounts,expCats,incCats);
  const totalInc=rows.filter(r=>r.Amount>0).reduce((s,r)=>s+r.Amount,0);
  const totalExp=rows.filter(r=>r.Amount<0).reduce((s,r)=>s+r.Amount,0);
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transactions</title>
<style>body{font-family:'Segoe UI',sans-serif;padding:24px;color:#1e293b;font-size:13px;}table{width:100%;border-collapse:collapse;}th{background:#0f172a;color:#fff;padding:8px 10px;text-align:left;font-size:12px;}td{padding:7px 10px;border-bottom:1px solid #e2e8f0;}tr:nth-child(even)td{background:#f8fafc;}.pos{color:#059669;font-weight:700;}.neg{color:#dc2626;font-weight:700;}.sum{display:flex;gap:16px;margin-bottom:20px;}.sc{background:#f1f5f9;border-radius:8px;padding:12px 16px;}.sl{font-size:10px;color:#64748b;text-transform:uppercase;}.sv{font-size:18px;font-weight:700;margin-top:2px;}@media print{body{padding:12px;}}</style></head><body>
<h1 style="margin:0 0 4px;">📊 ${appName}</h1><div style="color:#64748b;margin-bottom:16px;font-size:12px;">Transactions · ${periodLabel} · ${fmtDate(new Date())}</div>
<div class="sum"><div class="sc"><div class="sl">Income</div><div class="sv pos">₹${totalInc.toLocaleString("en-IN")}</div></div><div class="sc"><div class="sl">Expenses</div><div class="sv neg">₹${Math.abs(totalExp).toLocaleString("en-IN")}</div></div><div class="sc"><div class="sl">Transactions</div><div class="sv">${rows.length}</div></div></div>
<table><thead><tr><th>Date</th><th>Amount</th><th>Category</th><th>Note</th><th>Account</th></tr></thead><tbody>
${rows.map(r=>`<tr><td>${r.Date}</td><td class="${r.Amount>=0?"pos":"neg"}">${r.Amount>=0?"+":"-"}₹${Math.abs(r.Amount).toLocaleString("en-IN")}</td><td>${r["Category (Full)"]}</td><td>${r.Note}</td><td>${r.Account}</td></tr>`).join("")}
</tbody></table><script>setTimeout(()=>window.print(),400);</script></body></html>`;
  const win=window.open("","_blank"); if(win){win.document.write(html);win.document.close();}
}

// ─── SETTINGS DEFAULT ─────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  uiMode: "dark",       // 'auto' | 'light' | 'dark'
  notifications: false,
  reminderTimes: ["09:00","21:00"],
  smsDetection: false,
};

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────
// These use CSS variables set dynamically for theming
function Modal({ title, onClose, children }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)"}}>
      <div style={{background:"var(--c-card)",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto",padding:"24px 20px",boxShadow:"0 -8px 60px rgba(0,0,0,0.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontSize:18,fontWeight:800,color:"var(--c-text)"}}>{title}</span>
          <button onClick={onClose} style={{background:"var(--c-border)",border:"none",color:"var(--c-sub)",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function FL({ children }){ return <label style={{display:"block",fontSize:11,color:"var(--c-sub)",marginBottom:5,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>{children}</label>; }
function FInput({ label, ...p }){ return <div style={{marginBottom:14}}>{label&&<FL>{label}</FL>}<input {...p} style={{width:"100%",background:"var(--c-input)",border:"1px solid var(--c-border)",borderRadius:10,padding:"12px 14px",color:"var(--c-text)",fontSize:15,outline:"none",boxSizing:"border-box",...p.style}}/></div>; }
function FSelect({ label, children, ...p }){ return <div style={{marginBottom:14}}>{label&&<FL>{label}</FL>}<select {...p} style={{width:"100%",background:"var(--c-input)",border:"1px solid var(--c-border)",borderRadius:10,padding:"12px 14px",color:"var(--c-text)",fontSize:15,outline:"none",boxSizing:"border-box",...p.style}}>{children}</select></div>; }
function Btn({ children, variant="primary", style:st, ...p }){
  const V={primary:{background:"#10b981",color:"#fff"},danger:{background:"#ef4444",color:"#fff"},ghost:{background:"var(--c-border)",color:"var(--c-sub)"},outline:{background:"transparent",border:"1px solid #10b981",color:"#10b981"}};
  return <button {...p} style={{border:"none",borderRadius:12,padding:"13px 20px",fontWeight:700,fontSize:15,cursor:"pointer",width:"100%",marginTop:4,...V[variant],...st}}>{children}</button>;
}
function Toggle({ value, onChange, label }) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid var(--c-border)"}}>
      <span style={{fontSize:14,fontWeight:600,color:"var(--c-text)"}}>{label}</span>
      <div onClick={()=>onChange(!value)} style={{width:44,height:24,borderRadius:12,background:value?"#10b981":"var(--c-border)",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
        <div style={{position:"absolute",top:3,left:value?22:3,width:18,height:18,borderRadius:9,background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
      </div>
    </div>
  );
}
function ColorPicker({ value, onChange }){ return <div style={{marginBottom:14}}><FL>Color</FL><div style={{display:"flex",gap:9,flexWrap:"wrap"}}>{COLORS_PALETTE.map(c=><div key={c} onClick={()=>onChange(c)} style={{width:30,height:30,borderRadius:"50%",background:c,cursor:"pointer",border:value===c?"3px solid #fff":"3px solid transparent",flexShrink:0}}/>)}</div></div>; }
function IconPicker({ value, onChange }){ return <div style={{marginBottom:14}}><FL>Icon</FL><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{CAT_ICONS.map(ic=><button key={ic} onClick={()=>onChange(ic)} style={{width:38,height:38,borderRadius:10,border:"none",fontSize:20,cursor:"pointer",flexShrink:0,background:value===ic?"#10b981":"var(--c-border)",outline:value===ic?"2px solid #fff":"none"}}>{ic}</button>)}</div></div>; }

// ─── PERIOD BAR ───────────────────────────────────────────────────────────────
function PeriodBar({ period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo }) {
  const range = useMemo(()=>{ if(period==="custom")return`${fmtDate(customFrom)} — ${fmtDate(customTo)}`; const {from,to}=getPeriodDates(period); return`${fmtDate(toYMD(from))} — ${fmtDate(toYMD(to))}`; },[period,customFrom,customTo]);
  return (
    <div style={{background:"var(--c-card)",borderRadius:14,padding:"12px 14px",marginBottom:14}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {PERIODS.map(p=>(
          <button key={p.id} onClick={()=>setPeriod(p.id)} style={{padding:"5px 11px",borderRadius:16,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:period===p.id?"#10b981":"var(--c-input)",color:period===p.id?"#fff":"var(--c-muted)",outline:period===p.id?"none":"1px solid var(--c-border)"}}>{p.label}</button>
        ))}
      </div>
      {period==="custom"
        ? <div style={{display:"flex",gap:10,marginTop:10}}>
            <div style={{flex:1}}><div style={{fontSize:10,color:"var(--c-muted)",fontWeight:700,marginBottom:4,textTransform:"uppercase"}}>From</div><input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{width:"100%",background:"var(--c-input)",border:"1px solid var(--c-border)",borderRadius:8,padding:"8px 10px",color:"var(--c-text)",fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
            <div style={{flex:1}}><div style={{fontSize:10,color:"var(--c-muted)",fontWeight:700,marginBottom:4,textTransform:"uppercase"}}>To</div><input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{width:"100%",background:"var(--c-input)",border:"1px solid var(--c-border)",borderRadius:8,padding:"8px 10px",color:"var(--c-text)",fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
          </div>
        : <div style={{fontSize:11,color:"var(--c-muted)",marginTop:8}}>📅 {range}</div>
      }
    </div>
  );
}

// ─── TXN ROW ──────────────────────────────────────────────────────────────────
function TxnRow({ txn, accounts, expCats, incCats, onDelete, onClick }) {
  const acc=accounts.find(a=>a.id===txn.accountId);
  const cats=txn.type==="expense"?expCats:incCats;
  const cat=cats.find(c=>c.id===txn.catId);
  const sub=cat?.sub?.find(s=>s.id===txn.subCatId);
  const label=cat?`${cat.icon} ${cat.name}${sub?` › ${sub.name}`:""}`: "–";
  return (
    <div className="hov" onClick={onClick} style={{background:"var(--c-card2)",borderRadius:11,padding:"11px 13px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center",transition:"background 0.2s",cursor:onClick?"pointer":"default"}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--c-text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
        <div style={{fontSize:11,color:"var(--c-muted)",marginTop:2}}>{acc?.name} · {fmtDate(txn.date)}</div>
        {txn.note&&<div style={{fontSize:11,color:"var(--c-muted)",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",opacity:0.7}}>{txn.note}</div>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        <span style={{fontSize:14,fontWeight:800,color:txn.type==="income"?"#10b981":"#ef4444"}}>{txn.type==="income"?"+":"-"}{fmt(txn.amount)}</span>
        {onDelete&&<button onClick={e=>{e.stopPropagation();onDelete(txn.id);}} style={{background:"var(--c-border)",border:"none",color:"#ef4444",borderRadius:7,width:26,height:26,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
      </div>
    </div>
  );
}

// ─── FORMS ────────────────────────────────────────────────────────────────────
function TxnForm({ accounts, expCats, incCats, onSave, onClose, editTxn, prefill }) {
  const [type,setType]=useState(editTxn?.type||prefill?.type||"expense");
  const [date,setDate]=useState(editTxn?.date||toYMD(now));
  const [accountId,setAccountId]=useState(editTxn?.accountId||accounts[0]?.id||"");
  const [catId,setCatId]=useState(editTxn?.catId||"");
  const [subCatId,setSubCatId]=useState(editTxn?.subCatId||"");
  const [amount,setAmount]=useState(editTxn?.amount||prefill?.amount||"");
  const [note,setNote]=useState(editTxn?.note||prefill?.note||"");
  const cats=type==="expense"?expCats:incCats;
  const selCat=expCats.find(c=>c.id===catId);
  function save(){ if(!accountId||!catId||!amount)return; onSave({id:editTxn?.id||uid(),date,type,accountId,catId,subCatId:type==="expense"?subCatId:null,amount:parseFloat(amount),note}); }
  return (
    <Modal title={editTxn?"Edit Transaction":prefill?"Add SMS Transaction":"Add Transaction"} onClose={onClose}>
      {prefill&&<div style={{background:"#10b98120",border:"1px solid #10b981",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#10b981"}}>💬 Amount pre-filled from SMS · verify before saving</div>}
      <div style={{display:"flex",gap:8,marginBottom:18}}>
        {["expense","income"].map(t=>(
          <button key={t} onClick={()=>{setType(t);setCatId("");setSubCatId("");}} style={{flex:1,padding:11,borderRadius:12,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,background:type===t?(t==="expense"?"#ef4444":"#10b981"):"var(--c-border)",color:type===t?"#fff":"var(--c-sub)"}}>
            {t==="expense"?"🔴 Expense":"🟢 Income"}
          </button>
        ))}
      </div>
      <FInput label="Date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      <FSelect label="Account" value={accountId} onChange={e=>setAccountId(e.target.value)}>
        <option value="">Select Account</option>
        {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
      </FSelect>
      <FSelect label="Category" value={catId} onChange={e=>{setCatId(e.target.value);setSubCatId("");}}>
        <option value="">Select Category</option>
        {cats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
      </FSelect>
      {type==="expense"&&selCat&&selCat.sub.length>0&&(
        <FSelect label="Sub Category" value={subCatId} onChange={e=>setSubCatId(e.target.value)}>
          <option value="">Select Sub Category</option>
          {selCat.sub.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </FSelect>
      )}
      <FInput label="Amount (₹)" type="number" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)}/>
      <FInput label="Note (optional)" placeholder="What was this for?" value={note} onChange={e=>setNote(e.target.value)}/>
      <Btn onClick={save}>{editTxn?"Update Transaction":"Save Transaction"}</Btn>
    </Modal>
  );
}
function AccountForm({ onSave, onClose, editAcc }){
  const [name,setName]=useState(editAcc?.name||"");const [type,setType]=useState(editAcc?.type||"Savings");
  const [balance,setBalance]=useState(editAcc?.balance||"");const [color,setColor]=useState(editAcc?.color||"#10b981");
  return <Modal title={editAcc?"Edit Account":"Add Account"} onClose={onClose}><FInput label="Account Name" placeholder="e.g. HDFC Savings" value={name} onChange={e=>setName(e.target.value)}/><FSelect label="Account Type" value={type} onChange={e=>setType(e.target.value)}>{ACCOUNT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</FSelect><FInput label="Opening Balance (₹)" type="number" placeholder="0" value={balance} onChange={e=>setBalance(e.target.value)}/><ColorPicker value={color} onChange={setColor}/><Btn onClick={()=>{if(!name)return;onSave({id:editAcc?.id||uid(),name,type,balance:parseFloat(balance)||0,color});}}>{editAcc?"Update Account":"Add Account"}</Btn></Modal>;
}
function CatPreview({name,icon,color}){ return <div style={{background:"var(--c-input)",borderRadius:12,padding:14,marginBottom:14,display:"flex",alignItems:"center",gap:12}}><div style={{width:44,height:44,borderRadius:12,background:color+"22",border:`2px solid ${color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{icon}</div><div><div style={{fontSize:15,fontWeight:700,color:"var(--c-text)"}}>{name||"Category Name"}</div><div style={{fontSize:12,color:"var(--c-muted)"}}>Preview</div></div></div>; }
function ExpCatForm({ onSave, onClose, editCat }){
  const [name,setName]=useState(editCat?.name||"");const [icon,setIcon]=useState(editCat?.icon||"🍽️");const [color,setColor]=useState(editCat?.color||"#10b981");
  return <Modal title={editCat?"Edit Category":"Add Main Category"} onClose={onClose}><FInput label="Category Name" placeholder="e.g. Travel" value={name} onChange={e=>setName(e.target.value)}/><IconPicker value={icon} onChange={setIcon}/><ColorPicker value={color} onChange={setColor}/><CatPreview name={name} icon={icon} color={color}/><Btn onClick={()=>{if(!name)return;onSave({id:editCat?.id||uid(),name,icon,color,sub:editCat?.sub||[]});}}>{editCat?"Update":"Add Category"}</Btn></Modal>;
}
function SubCatForm({ parentName, onSave, onClose, editSub }){
  const [name,setName]=useState(editSub?.name||"");
  return <Modal title={editSub?"Edit Sub Category":"Add Sub Category"} onClose={onClose}><div style={{fontSize:12,color:"var(--c-muted)",marginBottom:16}}>Under: <span style={{color:"#10b981",fontWeight:700}}>{parentName}</span></div><FInput label="Sub Category Name" placeholder="e.g. Restaurants" value={name} onChange={e=>setName(e.target.value)}/><Btn onClick={()=>{if(!name)return;onSave({id:editSub?.id||uid(),name});}}>{editSub?"Update":"Add Sub Category"}</Btn></Modal>;
}
function IncCatForm({ onSave, onClose, editCat }){
  const [name,setName]=useState(editCat?.name||"");const [icon,setIcon]=useState(editCat?.icon||"💰");const [color,setColor]=useState(editCat?.color||"#10b981");
  return <Modal title={editCat?"Edit Income Category":"Add Income Category"} onClose={onClose}><FInput label="Category Name" placeholder="e.g. Rental Income" value={name} onChange={e=>setName(e.target.value)}/><IconPicker value={icon} onChange={setIcon}/><ColorPicker value={color} onChange={setColor}/><CatPreview name={name} icon={icon} color={color}/><Btn onClick={()=>{if(!name)return;onSave({id:editCat?.id||uid(),name,icon,color});}}>{editCat?"Update":"Add Category"}</Btn></Modal>;
}

// ─── EXPORT MODAL ─────────────────────────────────────────────────────────────
function ExportModal({ onClose, txns, accounts, expCats, incCats, periodLabel, appName }) {
  const [sel, setSel] = useState(null);
  const options=[{id:"csv",icon:"📄",label:"CSV",desc:"Universal spreadsheet format",color:"#10b981"},{id:"excel",icon:"📊",label:"Excel (.xlsx)",desc:"Microsoft Excel workbook",color:"#3b82f6"},{id:"pdf",icon:"🖨️",label:"PDF / Print",desc:"Print or save as PDF",color:"#ef4444"}];
  function doExport(f){ setSel(f); setTimeout(()=>{ if(f==="csv")exportCSV(txns,accounts,expCats,incCats); if(f==="excel")exportExcel(txns,accounts,expCats,incCats); if(f==="pdf")exportPDF(txns,accounts,expCats,incCats,periodLabel,appName); onClose(); },100); }
  return (
    <Modal title="Export Transactions" onClose={onClose}>
      <div style={{background:"var(--c-input)",borderRadius:12,padding:"12px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
        <div style={{fontSize:28}}>📋</div>
        <div><div style={{fontSize:14,fontWeight:700,color:"var(--c-text)"}}>{txns.length} transactions</div><div style={{fontSize:12,color:"var(--c-muted)"}}>Period: {periodLabel}</div></div>
      </div>
      <div style={{fontSize:11,color:"var(--c-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Columns: Date · Amount · Category / Sub · Note · Account</div>
      {options.map(o=>(
        <div key={o.id} onClick={()=>doExport(o.id)} className="hov" style={{display:"flex",alignItems:"center",gap:14,background:"var(--c-input)",borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer",transition:"background 0.2s",border:`1px solid ${sel===o.id?o.color:"transparent"}`}}>
          <div style={{fontSize:28,flexShrink:0}}>{o.icon}</div>
          <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:"var(--c-text)"}}>{o.label}</div><div style={{fontSize:12,color:"var(--c-muted)"}}>{o.desc}</div></div>
          <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${o.color}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{sel===o.id&&<div style={{width:10,height:10,borderRadius:"50%",background:o.color}}/>}</div>
        </div>
      ))}
    </Modal>
  );
}

// ─── SMS MODAL ────────────────────────────────────────────────────────────────
function SmsModal({ onClose, onTransaction }) {
  const [smsText, setSmsText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  function tryParse(text){ const r=parseSMS(text); if(r){setParsed(r);setError("");}else{setParsed(null);setError("Could not detect a transaction. Try pasting the full SMS.");} }
  return (
    <Modal title="📱 Paste SMS / UPI Alert" onClose={onClose}>
      <div style={{background:"#3b82f620",border:"1px solid #3b82f6",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#3b82f6",lineHeight:1.5}}>
        Paste your bank / UPI SMS below. The app will auto-detect the amount and transaction type.
      </div>
      <div style={{marginBottom:14}}>
        <FL>Paste SMS Text</FL>
        <textarea value={smsText} onChange={e=>{setSmsText(e.target.value);tryParse(e.target.value);}} placeholder={"INR 1,500.00 debited from your HDFC account for UPI payment to Swiggy on 25-Feb-2026."} rows={5}
          style={{width:"100%",background:"var(--c-input)",border:"1px solid var(--c-border)",borderRadius:10,padding:"12px 14px",color:"var(--c-text)",fontSize:13,outline:"none",boxSizing:"border-box",resize:"vertical",fontFamily:"monospace",lineHeight:1.5}}/>
      </div>
      {error&&<div style={{color:"#ef4444",fontSize:12,marginBottom:12}}>⚠️ {error}</div>}
      {parsed&&(
        <div style={{background:"#10b98120",border:"1px solid #10b981",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:12,color:"#10b981",fontWeight:700,marginBottom:8}}>✅ Transaction Detected</div>
          <div style={{display:"flex",gap:12}}>
            <div><div style={{fontSize:10,color:"var(--c-muted)"}}>TYPE</div><div style={{fontWeight:700,color:parsed.type==="expense"?"#ef4444":"#10b981",textTransform:"capitalize"}}>{parsed.type}</div></div>
            <div><div style={{fontSize:10,color:"var(--c-muted)"}}>AMOUNT</div><div style={{fontWeight:700,color:"var(--c-text)"}}>{fmt(parsed.amount)}</div></div>
            <div style={{flex:1}}><div style={{fontSize:10,color:"var(--c-muted)"}}>NOTE</div><div style={{fontWeight:600,color:"var(--c-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{parsed.note}</div></div>
          </div>
        </div>
      )}
      <Btn onClick={()=>{ if(parsed){ onTransaction(parsed); onClose(); } }} style={{opacity:parsed?1:0.4,pointerEvents:parsed?"auto":"none"}}>Open Add Transaction →</Btn>
      <Btn variant="ghost" style={{marginTop:8}} onClick={onClose}>Cancel</Btn>
    </Modal>
  );
}

// ─── APP NAME EDITOR ──────────────────────────────────────────────────────────
function AppNameEditor({ name, onChange }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  function commit(){ const n=val.trim()||"My Finance Hub"; onChange(n); setEditing(false); }
  if(editing) return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <input autoFocus value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setVal(name);setEditing(false);}}}
        style={{background:"transparent",border:"none",borderBottom:"2px solid #10b981",color:"#fff",fontSize:19,fontWeight:800,outline:"none",padding:"2px 4px",width:180,maxWidth:"52vw"}}/>
      <button onClick={commit} style={{background:"#10b981",border:"none",color:"#fff",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:700}}>✓</button>
    </div>
  );
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer"}} onClick={()=>setEditing(true)}>
      <div style={{fontSize:19,fontWeight:800,color:"#fff"}}>{name}</div>
      <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>✏️</span>
    </div>
  );
}

// ─── SETTINGS MODAL ───────────────────────────────────────────────────────────
function SettingsModal({ settings, onChange, onClose, onBackup, onRestore }) {
  const fileRef = useRef();
  const [newTime, setNewTime] = useState("08:00");

  function setSetting(key, val){ onChange({...settings, [key]:val}); }

  async function requestNotifPermission(val) {
    if(val && typeof Notification!=="undefined" && Notification.permission==="default"){
      const p = await Notification.requestPermission();
      if(p!=="granted"){ alert("Notification permission denied. Please enable in browser settings."); return; }
    }
    setSetting("notifications", val);
  }

  function addTime(){ if(!settings.reminderTimes.includes(newTime)) setSetting("reminderTimes",[...settings.reminderTimes,newTime].sort()); }
  function removeTime(t){ setSetting("reminderTimes",settings.reminderTimes.filter(x=>x!==t)); }

  const uiOptions=[{id:"auto",icon:"🌓",label:"Auto",desc:"Follows system setting"},{id:"dark",icon:"🌙",label:"Dark",desc:"Dark mode"},{id:"light",icon:"☀️",label:"Light",desc:"Light mode"}];

  return (
    <Modal title="⚙️ Settings" onClose={onClose}>

      {/* UI Mode */}
      <div style={{marginBottom:20}}>
        <FL>UI Theme</FL>
        <div style={{display:"flex",gap:8}}>
          {uiOptions.map(o=>(
            <div key={o.id} onClick={()=>setSetting("uiMode",o.id)} style={{flex:1,background:settings.uiMode===o.id?"#10b98122":"var(--c-input)",border:`2px solid ${settings.uiMode===o.id?"#10b981":"var(--c-border)"}`,borderRadius:12,padding:"10px 8px",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}>
              <div style={{fontSize:22,marginBottom:4}}>{o.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:settings.uiMode===o.id?"#10b981":"var(--c-text)"}}>{o.label}</div>
              <div style={{fontSize:10,color:"var(--c-muted)"}}>{o.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <Toggle value={settings.notifications} onChange={requestNotifPermission} label="🔔 Notifications"/>

      {settings.notifications&&(
        <div style={{background:"var(--c-input)",borderRadius:12,padding:"14px",marginTop:10,marginBottom:4}}>
          <FL>Daily Reminder Times</FL>
          <div style={{marginBottom:12}}>
            {settings.reminderTimes.map(t=>(
              <div key={t} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--c-card)",borderRadius:8,padding:"8px 12px",marginBottom:6}}>
                <span style={{fontSize:15,fontWeight:700,color:"var(--c-text)"}}>⏰ {t}</span>
                <button onClick={()=>removeTime(t)} style={{background:"#ef444430",border:"none",color:"#ef4444",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12}}>Remove</button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)} style={{flex:1,background:"var(--c-card)",border:"1px solid var(--c-border)",borderRadius:8,padding:"8px 12px",color:"var(--c-text)",fontSize:14,outline:"none"}}/>
            <button onClick={addTime} style={{background:"#10b981",border:"none",color:"#fff",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontWeight:700,fontSize:13}}>+ Add</button>
          </div>
          <div style={{fontSize:11,color:"var(--c-muted)",marginTop:8}}>App will notify you at these times daily to record transactions.</div>
        </div>
      )}

      {/* SMS Detection */}
      <Toggle value={settings.smsDetection} onChange={v=>setSetting("smsDetection",v)} label="📱 SMS Auto-Detection"/>
      {settings.smsDetection&&(
        <div style={{background:"#f59e0b15",border:"1px solid #f59e0b44",borderRadius:10,padding:"10px 14px",marginTop:8,marginBottom:4}}>
          <div style={{fontSize:12,color:"#f59e0b",fontWeight:700,marginBottom:4}}>ℹ️ How SMS Detection Works</div>
          <div style={{fontSize:11,color:"var(--c-sub)",lineHeight:1.6}}>
            When enabled, use the <b style={{color:"var(--c-text)"}}>📱 Paste SMS</b> button in Transactions tab to paste any UPI/bank SMS. The app automatically reads the amount and type.<br/><br/>
            <b style={{color:"var(--c-text)"}}>Native SMS reading</b> (auto-detect without pasting) requires installing this app via Capacitor as an Android APK with SMS permission.
          </div>
        </div>
      )}

      {/* Backup & Restore */}
      <div style={{marginTop:20,marginBottom:8}}>
        <FL>Backup & Restore</FL>
        <div style={{background:"var(--c-input)",borderRadius:12,padding:14}}>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:600,color:"var(--c-text)",marginBottom:4}}>💾 Backup Now</div>
            <div style={{fontSize:11,color:"var(--c-muted)",marginBottom:10}}>Save all transactions, accounts, categories, and settings to a JSON file on your device.</div>
            <Btn onClick={onBackup} variant="outline" style={{width:"100%",marginTop:0}}>⬇ Download Backup</Btn>
          </div>
          <div style={{borderTop:"1px solid var(--c-border)",paddingTop:12}}>
            <div style={{fontSize:14,fontWeight:600,color:"var(--c-text)",marginBottom:4}}>📂 Restore from Backup</div>
            <div style={{fontSize:11,color:"var(--c-muted)",marginBottom:10}}>Select a backup JSON file to restore all your data. Current data will be replaced.</div>
            <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onRestore(e.target.files[0]);}}/>
            <Btn onClick={()=>fileRef.current.click()} variant="ghost" style={{width:"100%",marginTop:0}}>⬆ Choose Backup File</Btn>
          </div>
        </div>
      </div>

      <div style={{fontSize:10,color:"var(--c-muted)",textAlign:"center",marginTop:12}}>Budget Tracker · v2.0</div>
    </Modal>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,          setTab]          = useState("dashboard");
  const [appName,      setAppName]      = useState("My Finance Hub");
  const [accounts,     setAccounts]     = useState(DEFAULT_ACCOUNTS);
  const [transactions, setTxns]         = useState(DEFAULT_TXN);
  const [expCats,      setExpCats]      = useState(DEFAULT_EXPENSE_CATS);
  const [incCats,      setIncCats]      = useState(DEFAULT_INCOME_CATS);
  const [settings,     setSettings]     = useState(DEFAULT_SETTINGS);

  // Shared period
  const [period,       setPeriod]       = useState("mtd");
  const [customFrom,   setCustomFrom]   = useState(toYMD(new Date(now.getFullYear(),now.getMonth(),1)));
  const [customTo,     setCustomTo]     = useState(toYMD(now));

  // UI state
  const [catTab,         setCatTab]         = useState("expense");
  const [txnTypeFilter,  setTxnTypeFilter]  = useState("all");
  const [reportTab,      setReportTab]      = useState("expense");
  const [expandedCat,    setExpandedCat]    = useState(null);
  const [selExpCatId,    setSelExpCatId]    = useState(null);
  const [selSubCatId,    setSelSubCatId]    = useState(null);
  const [selIncCatId,    setSelIncCatId]    = useState(null);

  // Modals
  const [showTxnForm,    setShowTxnForm]    = useState(false);
  const [showAccForm,    setShowAccForm]    = useState(false);
  const [showExpCatForm, setShowExpCatForm] = useState(false);
  const [showSubCatForm, setShowSubCatForm] = useState(false);
  const [showIncCatForm, setShowIncCatForm] = useState(false);
  const [showExport,     setShowExport]     = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);
  const [showSmsModal,   setShowSmsModal]   = useState(false);
  const [smsPrefill,     setSmsPrefill]     = useState(null);
  const [editTxn,        setEditTxn]        = useState(null);
  const [editAcc,        setEditAcc]        = useState(null);
  const [editExpCat,     setEditExpCat]     = useState(null);
  const [editSubCtx,     setEditSubCtx]     = useState(null);
  const [editIncCat,     setEditIncCat]     = useState(null);

  // ── Theme: apply CSS variables ──
  const systemDark = typeof window!=="undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const isDark = settings.uiMode==="dark" || (settings.uiMode==="auto" && systemDark);
  const T = isDark ? DARK_THEME : LIGHT_THEME;

  useEffect(()=>{
    const r=document.documentElement.style;
    r.setProperty("--c-bg",     T.bg);
    r.setProperty("--c-card",   T.card);
    r.setProperty("--c-card2",  T.card2);
    r.setProperty("--c-card3",  T.card3);
    r.setProperty("--c-text",   T.text);
    r.setProperty("--c-text2",  T.text2);
    r.setProperty("--c-sub",    T.sub);
    r.setProperty("--c-muted",  T.muted);
    r.setProperty("--c-border", T.border);
    r.setProperty("--c-input",  T.input);
    r.setProperty("--c-hover",  T.hover);
    r.setProperty("--c-subhov", T.subhov);
  },[T]);

  // ── Notification reminders ──
  useEffect(()=>{
    if(!settings.notifications) return;
    const tick = setInterval(()=>{
      const d=new Date();
      const hhmm=`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
      if(settings.reminderTimes.includes(hhmm) && typeof Notification!=="undefined" && Notification.permission==="granted"){
        const n=new Notification("💰 Budget Reminder",{body:"Time to record your transactions!",icon:"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='28' font-size='28'>💰</text></svg>"});
        n.onclick=()=>{ window.focus(); setTab("transactions"); setShowTxnForm(true); };
      }
    },30000);
    return ()=>clearInterval(tick);
  },[settings.notifications,settings.reminderTimes]);

  // ── Backup / Restore ──
  function doBackup(){
    const data={transactions,accounts,expCats,incCats,appName,settings,backupDate:new Date().toISOString(),version:"2.0"};
    downloadBlob(JSON.stringify(data,null,2),`budget-backup-${toYMD(now)}.json`,"application/json");
  }
  function doRestore(file){
    const reader=new FileReader();
    reader.onload=e=>{ try{
      const d=JSON.parse(e.target.result);
      if(d.transactions)setTxns(d.transactions); if(d.accounts)setAccounts(d.accounts);
      if(d.expCats)setExpCats(d.expCats); if(d.incCats)setIncCats(d.incCats);
      if(d.appName)setAppName(d.appName); if(d.settings)setSettings(d.settings);
      setShowSettings(false); alert("✅ Restore successful!");
    }catch{ alert("❌ Invalid backup file."); } };
    reader.readAsText(file);
  }

  // ── Period filtered ──
  const periodTxns = useMemo(()=>{
    let from,to;
    if(period==="custom"){ from=new Date(customFrom); from.setHours(0,0,0,0); to=new Date(customTo); to.setHours(23,59,59,999); }
    else{ ({from,to}=getPeriodDates(period)); }
    return transactions.filter(t=>{ const d=new Date(t.date); return d>=from&&d<=to; });
  },[transactions,period,customFrom,customTo]);

  const periodLabel = useMemo(()=>{
    if(period==="custom")return`${fmtDate(customFrom)} — ${fmtDate(customTo)}`;
    const {from,to}=getPeriodDates(period);
    return`${fmtDate(toYMD(from))} — ${fmtDate(toYMD(to))}`;
  },[period,customFrom,customTo]);

  const netBalance    = useMemo(()=>accounts.reduce((s,a)=>s+a.balance,0),[accounts]);
  const periodIncome  = useMemo(()=>periodTxns.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),[periodTxns]);
  const periodExpense = useMemo(()=>periodTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),[periodTxns]);
  const filteredTxns  = useMemo(()=>{ let b=[...periodTxns].sort((a,x)=>x.date.localeCompare(a.date)); return txnTypeFilter==="all"?b:b.filter(t=>t.type===txnTypeFilter); },[periodTxns,txnTypeFilter]);

  const expByCat = useMemo(()=>{ const m={}; periodTxns.filter(t=>t.type==="expense").forEach(t=>{ const c=expCats.find(x=>x.id===t.catId); if(!c)return; if(!m[c.id])m[c.id]={name:c.name,catId:c.id,value:0}; m[c.id].value+=t.amount; }); return Object.values(m).sort((a,b)=>b.value-a.value); },[periodTxns,expCats]);
  const incByCat = useMemo(()=>{ const m={}; periodTxns.filter(t=>t.type==="income").forEach(t=>{ const c=incCats.find(x=>x.id===t.catId); if(!c)return; if(!m[c.id])m[c.id]={name:c.name,catId:c.id,icon:c.icon,color:c.color,value:0}; m[c.id].value+=t.amount; }); return Object.values(m).sort((a,b)=>b.value-a.value); },[periodTxns,incCats]);
  const subCatData = useMemo(()=>{ const src=periodTxns.filter(t=>t.type==="expense"&&t.subCatId&&(selExpCatId?t.catId===selExpCatId:true)); const m={}; src.forEach(t=>{ const c=expCats.find(x=>x.id===t.catId); const s=c?.sub?.find(x=>x.id===t.subCatId); if(!s)return; if(!m[t.subCatId])m[t.subCatId]={subId:t.subCatId,catId:t.catId,name:s.name,amount:0}; m[t.subCatId].amount+=t.amount; }); return Object.values(m).sort((a,b)=>b.amount-a.amount); },[periodTxns,expCats,selExpCatId]);
  const monthlyData = useMemo(()=>{ const m={}; transactions.forEach(t=>{ const d=new Date(t.date); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; if(!m[k])m[k]={month:`${MONTHS[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,income:0,expense:0,k}; m[k][t.type]+=t.amount; }); return Object.values(m).sort((a,b)=>a.k.localeCompare(b.k)); },[transactions]);
  const drillExpTxns = useMemo(()=>selSubCatId?periodTxns.filter(t=>t.type==="expense"&&t.subCatId===selSubCatId).sort((a,b)=>b.date.localeCompare(a.date)):[]  ,[periodTxns,selSubCatId]);
  const drillIncTxns = useMemo(()=>selIncCatId?periodTxns.filter(t=>t.type==="income"&&t.catId===selIncCatId).sort((a,b)=>b.date.localeCompare(a.date)):[]      ,[periodTxns,selIncCatId]);

  function getCatName(txn){ const cats=txn.type==="expense"?expCats:incCats; const cat=cats.find(c=>c.id===txn.catId); if(!cat)return "–"; const sub=cat.sub?.find(s=>s.id===txn.subCatId); return`${cat.icon} ${cat.name}${sub?` › ${sub.name}`:""}`; }

  // CRUD
  function saveTxn(t){ setTxns(p=>{const i=p.findIndex(x=>x.id===t.id);if(i>=0){const n=[...p];n[i]=t;return n;}return[...p,t];}); setShowTxnForm(false); setEditTxn(null); setSmsPrefill(null); }
  function deleteTxn(id){ setTxns(p=>p.filter(t=>t.id!==id)); }
  function saveAcc(a){ setAccounts(p=>{const i=p.findIndex(x=>x.id===a.id);if(i>=0){const n=[...p];n[i]=a;return n;}return[...p,a];}); setShowAccForm(false); setEditAcc(null); }
  function deleteAcc(id){ setAccounts(p=>p.filter(a=>a.id!==id)); }
  function saveExpCat(c){ setExpCats(p=>{const i=p.findIndex(x=>x.id===c.id);if(i>=0){const n=[...p];n[i]={...n[i],...c,sub:n[i].sub};return n;}return[...p,c];}); setShowExpCatForm(false); setEditExpCat(null); }
  function deleteExpCat(id){ if(transactions.some(t=>t.catId===id)){alert("Category has transactions.");return;} setExpCats(p=>p.filter(c=>c.id!==id)); if(expandedCat===id)setExpandedCat(null); }
  function saveSubCat(pid,sub){ setExpCats(p=>p.map(c=>{ if(c.id!==pid)return c; const i=c.sub.findIndex(s=>s.id===sub.id); if(i>=0){const ss=[...c.sub];ss[i]=sub;return{...c,sub:ss};}return{...c,sub:[...c.sub,sub]}; })); setShowSubCatForm(false); setEditSubCtx(null); }
  function deleteSubCat(pid,sid){ if(transactions.some(t=>t.subCatId===sid)){alert("Sub-category has transactions.");return;} setExpCats(p=>p.map(c=>c.id===pid?{...c,sub:c.sub.filter(s=>s.id!==sid)}:c)); }
  function saveIncCat(c){ setIncCats(p=>{const i=p.findIndex(x=>x.id===c.id);if(i>=0){const n=[...p];n[i]=c;return n;}return[...p,c];}); setShowIncCatForm(false); setEditIncCat(null); }
  function deleteIncCat(id){ if(transactions.some(t=>t.catId===id)){alert("Category has transactions.");return;} setIncCats(p=>p.filter(c=>c.id!==id)); }
  function handlePieExpClick(data){ const cid=data?.catId||null; if(selExpCatId===cid){setSelExpCatId(null);setSelSubCatId(null);}else{setSelExpCatId(cid);setSelSubCatId(null);} }
  function handleSubCatClick(sid){ setSelSubCatId(p=>p===sid?null:sid); }
  function handleIncCatClick(cid){ setSelIncCatId(p=>p===cid?null:cid); }
  function switchReportTab(t){ setReportTab(t); setSelExpCatId(null); setSelSubCatId(null); setSelIncCatId(null); }

  // Inline style helpers (theme-aware)
  const pill=(a,col="#10b981")=>({padding:"7px 13px",borderRadius:18,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:a?col:T.border,color:a?"#fff":T.sub,transition:"all 0.15s"});
  const card={background:T.card,borderRadius:16,padding:18,marginBottom:14};
  const secTitle={fontSize:15,fontWeight:700,color:T.text,marginBottom:12};

  const TABS=[
    {id:"dashboard",   icon:"📊",label:"Home"},
    {id:"transactions",icon:"📋",label:"Transactions"},
    {id:"accounts",    icon:"🏦",label:"Accounts"},
    {id:"categories",  icon:"🏷️",label:"Categories"},
    {id:"reports",     icon:"📈",label:"Reports"},
  ];

  return (
    <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",background:T.bg,minHeight:"100vh",color:T.text,maxWidth:480,margin:"0 auto",position:"relative",paddingBottom:90}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:${isDark?"invert(1)":"none"};}
        input[type=time]::-webkit-calendar-picker-indicator{filter:${isDark?"invert(1)":"none"};}
        select option{background:var(--c-card);}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:var(--c-border);border-radius:2px;}
        .hov:hover{background:var(--c-hover) !important;}
        .sub-hov:hover{background:var(--c-subhov) !important;}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{background:T.header,padding:"22px 16px 16px",borderBottom:`1px solid ${T.navBorder}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {/* Settings gear */}
            <button onClick={()=>setShowSettings(true)} style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.12)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>⚙️</button>
            <div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.45)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>Budget Tracker</div>
              <AppNameEditor name={appName} onChange={setAppName}/>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.45)"}}>Net Worth</div>
            <div style={{fontSize:20,fontWeight:800,color:netBalance>=0?"#10b981":"#ef4444"}}>{fmt(netBalance)}</div>
          </div>
        </div>
      </div>

      <div style={{padding:"14px 14px 0"}}>

        {/* ══ DASHBOARD ══ */}
        {tab==="dashboard"&&(
          <>
            <PeriodBar period={period} setPeriod={setPeriod} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo}/>
            <div style={{display:"flex",gap:10,marginBottom:14}}>
              <div style={{flex:1,background:T.card,borderRadius:14,padding:"14px 16px",borderLeft:"3px solid #10b981"}}>
                <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase"}}>Income</div>
                <div style={{fontSize:22,fontWeight:800,color:"#10b981",marginTop:6}}>{fmt(periodIncome)}</div>
              </div>
              <div style={{flex:1,background:T.card,borderRadius:14,padding:"14px 16px",borderLeft:"3px solid #ef4444"}}>
                <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase"}}>Expenses</div>
                <div style={{fontSize:22,fontWeight:800,color:"#ef4444",marginTop:6}}>{fmt(periodExpense)}</div>
              </div>
            </div>
            <div style={secTitle}>My Accounts</div>
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8,marginBottom:14}}>
              {accounts.map(a=>(
                <div key={a.id} style={{minWidth:148,background:T.card,borderRadius:14,padding:14,borderTop:`3px solid ${a.color}`,flexShrink:0}}>
                  <div style={{fontSize:10,color:T.muted,fontWeight:600}}>{a.type}</div>
                  <div style={{fontSize:13,fontWeight:700,color:T.text,marginTop:2,marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                  <div style={{fontSize:17,fontWeight:800,color:a.balance>=0?a.color:"#ef4444"}}>{fmt(a.balance)}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={secTitle}>Recent Transactions</div>
              <button onClick={()=>setTab("transactions")} style={{background:"none",border:"none",color:"#10b981",fontSize:13,cursor:"pointer",fontWeight:700}}>See all →</button>
            </div>
            {!periodTxns.length&&<div style={{textAlign:"center",color:T.muted,padding:"28px 0",fontSize:13}}><div style={{fontSize:36,marginBottom:8}}>📭</div>No transactions in this period</div>}
            {[...periodTxns].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(txn=>{
              const acc=accounts.find(a=>a.id===txn.accountId);
              return(
                <div key={txn.id} className="hov" style={{background:T.card,borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",transition:"background 0.2s"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getCatName(txn)}</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:2}}>{acc?.name} · {fmtDate(txn.date)}</div>
                    {txn.note&&<div style={{fontSize:11,color:T.muted,marginTop:1,opacity:0.7,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{txn.note}</div>}
                  </div>
                  <div style={{fontSize:15,fontWeight:800,color:txn.type==="income"?"#10b981":"#ef4444",flexShrink:0,marginLeft:10}}>{txn.type==="income"?"+":"-"}{fmt(txn.amount)}</div>
                </div>
              );
            })}
          </>
        )}

        {/* ══ TRANSACTIONS ══ */}
        {tab==="transactions"&&(
          <>
            <PeriodBar period={period} setPeriod={setPeriod} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{display:"flex",gap:6}}>
                {["all","expense","income"].map(f=>(
                  <button key={f} style={pill(txnTypeFilter===f,f==="income"?"#10b981":f==="expense"?"#ef4444":"#64748b")} onClick={()=>setTxnTypeFilter(f)}>
                    {f==="all"?"All":f==="expense"?"🔴 Exp":"🟢 Inc"}
                  </button>
                ))}
              </div>
              <div style={{display:"flex",gap:6}}>
                {settings.smsDetection&&(
                  <button onClick={()=>setShowSmsModal(true)} style={{background:"#3b82f620",border:"1px solid #3b82f6",color:"#3b82f6",borderRadius:10,padding:"6px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>📱 SMS</button>
                )}
                <button onClick={()=>setShowExport(true)} style={{background:T.border,border:"none",color:T.sub,borderRadius:10,padding:"6px 11px",cursor:"pointer",fontWeight:700,fontSize:11,display:"flex",alignItems:"center",gap:4}}>⬇️ Export</button>
              </div>
            </div>
            <div style={{fontSize:11,color:T.muted,marginBottom:10}}>{filteredTxns.length} transactions · {periodLabel}</div>
            {filteredTxns.map(txn=>{
              const acc=accounts.find(a=>a.id===txn.accountId);
              return(
                <div key={txn.id} className="hov" style={{background:T.card,borderRadius:12,padding:"13px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",transition:"background 0.2s",cursor:"pointer"}}
                  onClick={()=>{setEditTxn(txn);setShowTxnForm(true);}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getCatName(txn)}</div>
                    <div style={{fontSize:12,color:T.muted,marginTop:2}}>{acc?.name} · {fmtDate(txn.date)}</div>
                    {txn.note&&<div style={{fontSize:11,color:T.muted,marginTop:1,opacity:0.7,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{txn.note}</div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    <div style={{fontSize:15,fontWeight:800,color:txn.type==="income"?"#10b981":"#ef4444"}}>{txn.type==="income"?"+":"-"}{fmt(txn.amount)}</div>
                    <button onClick={e=>{e.stopPropagation();deleteTxn(txn.id);}} style={{background:T.border,border:"none",color:"#ef4444",borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:12}}>✕</button>
                  </div>
                </div>
              );
            })}
            {!filteredTxns.length&&<div style={{textAlign:"center",color:T.muted,padding:"48px 0",fontSize:15}}><div style={{fontSize:42,marginBottom:12}}>📭</div>No transactions in this period</div>}
          </>
        )}

        {/* ══ ACCOUNTS ══ */}
        {tab==="accounts"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={secTitle}>All Accounts</div>
              <button onClick={()=>{setEditAcc(null);setShowAccForm(true);}} style={{background:"#10b981",border:"none",color:"#fff",borderRadius:10,padding:"8px 16px",cursor:"pointer",fontWeight:700,fontSize:13}}>+ Add</button>
            </div>
            {accounts.map(acc=>{
              const accInc=transactions.filter(t=>t.accountId===acc.id&&t.type==="income").reduce((s,t)=>s+t.amount,0);
              const accExp=transactions.filter(t=>t.accountId===acc.id&&t.type==="expense").reduce((s,t)=>s+t.amount,0);
              return(
                <div key={acc.id} className="hov" style={{background:T.card,borderRadius:14,padding:16,marginBottom:12,transition:"background 0.2s",cursor:"pointer",borderLeft:`4px solid ${acc.color}`}}
                  onClick={()=>{setEditAcc(acc);setShowAccForm(true);}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div><div style={{fontSize:16,fontWeight:700,color:T.text}}>{acc.name}</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>{acc.type}</div></div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:22,fontWeight:800,color:acc.balance>=0?acc.color:"#ef4444"}}>{fmt(acc.balance)}</div>
                      <div style={{fontSize:11,color:T.muted}}>Balance</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <div style={{flex:1,background:T.bg,borderRadius:8,padding:"8px",textAlign:"center"}}><div style={{fontSize:11,color:T.muted}}>Income</div><div style={{fontSize:14,fontWeight:700,color:"#10b981"}}>{fmt(accInc)}</div></div>
                    <div style={{flex:1,background:T.bg,borderRadius:8,padding:"8px",textAlign:"center"}}><div style={{fontSize:11,color:T.muted}}>Expenses</div><div style={{fontSize:14,fontWeight:700,color:"#ef4444"}}>{fmt(accExp)}</div></div>
                    <button onClick={e=>{e.stopPropagation();deleteAcc(acc.id);}} style={{background:T.border,border:"none",color:"#ef4444",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:700}}>✕</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ══ CATEGORIES ══ */}
        {tab==="categories"&&(
          <>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <button style={pill(catTab==="expense","#ef4444")} onClick={()=>setCatTab("expense")}>🔴 Expense</button>
              <button style={pill(catTab==="income","#10b981")}  onClick={()=>setCatTab("income")}>🟢 Income</button>
            </div>
            {catTab==="expense"&&(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div>
                    <div style={secTitle}>Expense Categories</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:-10,marginBottom:12}}>Tap to expand sub categories</div>
                  </div>
                  <button onClick={()=>{setEditExpCat(null);setShowExpCatForm(true);}} style={{background:"#ef4444",border:"none",color:"#fff",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:13,flexShrink:0}}>+ Add</button>
                </div>
                {expCats.map(cat=>{
                  const isOpen=expandedCat===cat.id;
                  return(
                    <div key={cat.id} style={{marginBottom:10}}>
                      <div style={{background:T.card,borderRadius:isOpen?"16px 16px 0 0":"16px",border:`1px solid ${isOpen?cat.color:"transparent"}`,overflow:"hidden"}}>
                        <div className="hov" style={{display:"flex",alignItems:"center",gap:12,padding:14,cursor:"pointer",transition:"background 0.2s"}} onClick={()=>setExpandedCat(isOpen?null:cat.id)}>
                          <div style={{width:46,height:46,borderRadius:14,background:cat.color+"20",border:`2px solid ${cat.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{cat.icon}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:15,fontWeight:700,color:T.text}}>{cat.name}</div>
                            <div style={{fontSize:11,color:T.muted,marginTop:2}}><span style={{color:cat.color,fontWeight:700}}>{cat.sub.length}</span> sub categor{cat.sub.length===1?"y":"ies"}</div>
                          </div>
                          <div style={{display:"flex",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>{setEditExpCat(cat);setShowExpCatForm(true);}} style={{background:T.border,border:"none",color:T.sub,borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
                            <button onClick={()=>deleteExpCat(cat.id)} style={{background:T.border,border:"none",color:"#ef4444",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                          </div>
                          <div style={{fontSize:18,color:T.muted,marginLeft:2,transition:"transform 0.25s",transform:isOpen?"rotate(90deg)":"rotate(0)"}}>›</div>
                        </div>
                        {isOpen&&(
                          <div style={{background:T.card2,borderTop:`1px solid ${cat.color}33`,padding:"12px 14px 14px"}}>
                            {!cat.sub.length&&<div style={{color:T.muted,fontSize:13,textAlign:"center",padding:"10px 0 6px"}}>No sub categories yet</div>}
                            {cat.sub.map(sub=>(
                              <div key={sub.id} className="sub-hov" style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.card,borderRadius:11,padding:"11px 13px",marginBottom:8,transition:"background 0.2s"}}>
                                <div style={{display:"flex",alignItems:"center",gap:10}}>
                                  <div style={{width:7,height:7,borderRadius:"50%",background:cat.color,flexShrink:0}}/>
                                  <span style={{fontSize:14,color:T.text2,fontWeight:500}}>{sub.name}</span>
                                </div>
                                <div style={{display:"flex",gap:6}}>
                                  <button onClick={()=>{setEditSubCtx({parentId:cat.id,parentName:cat.name,sub});setShowSubCatForm(true);}} style={{background:T.border,border:"none",color:T.sub,borderRadius:7,width:30,height:30,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
                                  <button onClick={()=>deleteSubCat(cat.id,sub.id)} style={{background:T.border,border:"none",color:"#ef4444",borderRadius:7,width:30,height:30,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                                </div>
                              </div>
                            ))}
                            <button onClick={()=>{setEditSubCtx({parentId:cat.id,parentName:cat.name,sub:null});setShowSubCatForm(true);}} style={{width:"100%",marginTop:4,background:"transparent",border:`1.5px dashed ${cat.color}88`,borderRadius:11,padding:10,color:cat.color,fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Add Sub Category</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!expCats.length&&<div style={{textAlign:"center",color:T.muted,padding:"48px 0"}}><div style={{fontSize:48,marginBottom:12}}>🏷️</div>No expense categories yet.</div>}
                <div style={{...card,display:"flex",justifyContent:"space-around"}}>
                  <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:"#ef4444"}}>{expCats.length}</div><div style={{fontSize:11,color:T.muted}}>Main</div></div>
                  <div style={{width:1,background:T.border}}/>
                  <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:"#f97316"}}>{expCats.reduce((s,c)=>s+c.sub.length,0)}</div><div style={{fontSize:11,color:T.muted}}>Sub</div></div>
                </div>
              </>
            )}
            {catTab==="income"&&(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={secTitle}>Income Categories</div>
                  <button onClick={()=>{setEditIncCat(null);setShowIncCatForm(true);}} style={{background:"#10b981",border:"none",color:"#fff",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:13}}>+ Add</button>
                </div>
                {incCats.map(cat=>(
                  <div key={cat.id} className="hov" style={{background:T.card,borderRadius:14,padding:14,marginBottom:10,display:"flex",alignItems:"center",gap:12,transition:"background 0.2s"}}>
                    <div style={{width:46,height:46,borderRadius:14,background:cat.color+"20",border:`2px solid ${cat.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{cat.icon}</div>
                    <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:T.text}}>{cat.name}</div></div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>{setEditIncCat(cat);setShowIncCatForm(true);}} style={{background:T.border,border:"none",color:T.sub,borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
                      <button onClick={()=>deleteIncCat(cat.id)} style={{background:T.border,border:"none",color:"#ef4444",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                    </div>
                  </div>
                ))}
                {!incCats.length&&<div style={{textAlign:"center",color:T.muted,padding:"48px 0"}}><div style={{fontSize:48,marginBottom:12}}>💰</div>No income categories yet.</div>}
                <div style={{...card,display:"flex",justifyContent:"center"}}>
                  <div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:"#10b981"}}>{incCats.length}</div><div style={{fontSize:11,color:T.muted}}>Categories</div></div>
                </div>
              </>
            )}
          </>
        )}

        {/* ══ REPORTS ══ */}
        {tab==="reports"&&(
          <>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              {["expense","income","trend"].map(r=>(
                <button key={r} style={pill(reportTab===r,r==="expense"?"#ef4444":r==="income"?"#10b981":"#3b82f6")} onClick={()=>switchReportTab(r)}>
                  {r==="expense"?"📉 Expense":r==="income"?"📈 Income":"📊 Trend"}
                </button>
              ))}
            </div>
            <PeriodBar period={period} setPeriod={p=>{setPeriod(p);setSelExpCatId(null);setSelSubCatId(null);setSelIncCatId(null);}} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo}/>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <div style={{flex:1,background:T.card,borderRadius:12,padding:"10px 12px",borderLeft:"3px solid #10b981"}}><div style={{fontSize:9,color:T.muted,fontWeight:700}}>INCOME</div><div style={{fontSize:16,fontWeight:800,color:"#10b981"}}>{fmt(periodIncome)}</div></div>
              <div style={{flex:1,background:T.card,borderRadius:12,padding:"10px 12px",borderLeft:"3px solid #ef4444"}}><div style={{fontSize:9,color:T.muted,fontWeight:700}}>EXPENSE</div><div style={{fontSize:16,fontWeight:800,color:"#ef4444"}}>{fmt(periodExpense)}</div></div>
            </div>

            {/* EXPENSE REPORT */}
            {reportTab==="expense"&&(
              <>
                <div style={card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={secTitle}>{selExpCatId?`${expCats.find(c=>c.id===selExpCatId)?.icon} ${expCats.find(c=>c.id===selExpCatId)?.name}`:"Expense by Category"}</div>
                    {selExpCatId&&<button onClick={()=>{setSelExpCatId(null);setSelSubCatId(null);}} style={{background:T.border,border:"none",color:T.sub,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:11}}>✕ All</button>}
                  </div>
                  <div style={{textAlign:"center",fontSize:12,color:T.muted,marginBottom:8}}>Tap a slice to drill into sub categories</div>
                  {!expByCat.length
                    ? <div style={{textAlign:"center",color:T.muted,padding:"28px 0",fontSize:13}}>No expense data for this period</div>
                    : <ResponsiveContainer width="100%" height={230}>
                        <PieChart>
                          <Pie data={expByCat} cx="50%" cy="50%" innerRadius={62} outerRadius={90} paddingAngle={3} dataKey="value" onClick={handlePieExpClick} style={{cursor:"pointer"}} label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
                            {expByCat.map((item,i)=><Cell key={i} fill={COLORS_PALETTE[i%COLORS_PALETTE.length]} opacity={selExpCatId&&selExpCatId!==item.catId?0.3:1} stroke={selExpCatId===item.catId?"#fff":"none"} strokeWidth={selExpCatId===item.catId?2:0}/>)}
                          </Pie>
                          <Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12}}/>
                          <Legend iconSize={10} wrapperStyle={{fontSize:11,color:T.sub}}/>
                        </PieChart>
                      </ResponsiveContainer>
                  }
                </div>
                <div style={card}>
                  <div style={secTitle}>Category Breakdown</div>
                  {!expByCat.length&&<div style={{color:T.muted,fontSize:13,textAlign:"center",padding:"10px 0"}}>No data</div>}
                  {expByCat.map((item,i)=>{ const cat=expCats.find(c=>c.id===item.catId); const isSel=selExpCatId===item.catId; return(
                    <div key={item.catId} onClick={()=>handlePieExpClick(item)} style={{marginBottom:10,cursor:"pointer",padding:"8px 10px",borderRadius:10,background:isSel?COLORS_PALETTE[i%COLORS_PALETTE.length]+"22":T.card2,border:`1px solid ${isSel?COLORS_PALETTE[i%COLORS_PALETTE.length]:"transparent"}`,transition:"all 0.2s",opacity:selExpCatId&&!isSel?0.5:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:"50%",background:COLORS_PALETTE[i%COLORS_PALETTE.length],flexShrink:0}}/><span style={{fontSize:13,color:T.text,fontWeight:600}}>{cat?.icon} {item.name}</span></div>
                        <span style={{fontSize:13,fontWeight:800,color:T.text}}>{fmt(item.value)}</span>
                      </div>
                      <div style={{background:T.bg,borderRadius:4,height:5,overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,background:COLORS_PALETTE[i%COLORS_PALETTE.length],width:`${(item.value/expByCat[0].value)*100}%`,transition:"width 0.5s"}}/></div>
                      <div style={{fontSize:10,color:T.muted,marginTop:3,textAlign:"right"}}>{periodExpense>0?`${(item.value/periodExpense*100).toFixed(1)}% of total`:""}</div>
                    </div>
                  );})}
                </div>
                <div style={card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={secTitle}>{selExpCatId?`Sub · ${expCats.find(c=>c.id===selExpCatId)?.name}`:"All Sub Categories"}</div>
                    {selSubCatId&&<button onClick={()=>setSelSubCatId(null)} style={{background:T.border,border:"none",color:T.sub,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11}}>✕ Close</button>}
                  </div>
                  {!subCatData.length&&<div style={{color:T.muted,fontSize:13,textAlign:"center",padding:"10px 0"}}>No sub-category data for this period</div>}
                  {subCatData.map((item,i)=>{ const parentCat=expCats.find(c=>c.id===item.catId); const isSelSub=selSubCatId===item.subId; return(
                    <div key={item.subId}>
                      <div onClick={()=>handleSubCatClick(item.subId)} style={{marginBottom:8,cursor:"pointer",padding:"10px 12px",borderRadius:11,background:isSelSub?"#10b98120":T.card2,border:`1px solid ${isSelSub?"#10b981":"transparent"}`,transition:"all 0.2s"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:7,height:7,borderRadius:"50%",background:parentCat?.color||COLORS_PALETTE[i%COLORS_PALETTE.length],flexShrink:0}}/><span style={{fontSize:13,color:T.text,fontWeight:500}}>{item.name}</span>{!selExpCatId&&<span style={{fontSize:10,color:T.muted}}>({parentCat?.icon} {parentCat?.name})</span>}</div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,fontWeight:700,color:T.text}}>{fmt(item.amount)}</span><span style={{fontSize:11,color:isSelSub?"#10b981":T.muted}}>{isSelSub?"▲":"▼"}</span></div>
                        </div>
                        <div style={{background:T.bg,borderRadius:4,height:4,overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,background:parentCat?.color||COLORS_PALETTE[i%COLORS_PALETTE.length],width:subCatData[0]?`${(item.amount/subCatData[0].amount)*100}%`:"0%",transition:"width 0.5s"}}/></div>
                      </div>
                      {isSelSub&&(
                        <div style={{background:T.card3,borderRadius:"0 0 12px 12px",padding:"10px 12px 12px",marginTop:-8,marginBottom:8,border:"1px solid #10b98133",borderTop:"none"}}>
                          <div style={{fontSize:10,color:"#10b981",fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Transactions · {drillExpTxns.length} found</div>
                          {!drillExpTxns.length&&<div style={{color:T.muted,fontSize:12,padding:"6px 0"}}>No transactions in this period</div>}
                          {drillExpTxns.map(txn=><TxnRow key={txn.id} txn={txn} accounts={accounts} expCats={expCats} incCats={incCats}/>)}
                          <div style={{fontSize:12,fontWeight:700,color:"#ef4444",textAlign:"right",marginTop:6}}>Total: {fmt(drillExpTxns.reduce((s,t)=>s+t.amount,0))}</div>
                        </div>
                      )}
                    </div>
                  );})}
                </div>
              </>
            )}

            {/* INCOME REPORT */}
            {reportTab==="income"&&(
              <>
                <div style={card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={secTitle}>Income by Category</div>
                    {selIncCatId&&<button onClick={()=>setSelIncCatId(null)} style={{background:T.border,border:"none",color:T.sub,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:11}}>✕ Clear</button>}
                  </div>
                  <div style={{textAlign:"center",fontSize:12,color:T.muted,marginBottom:8}}>Tap a slice or row to see transactions</div>
                  {!incByCat.length
                    ? <div style={{textAlign:"center",color:T.muted,padding:"28px 0",fontSize:13}}>No income data for this period</div>
                    : <ResponsiveContainer width="100%" height={230}>
                        <PieChart>
                          <Pie data={incByCat} cx="50%" cy="50%" innerRadius={62} outerRadius={90} paddingAngle={3} dataKey="value" onClick={d=>handleIncCatClick(d.catId)} style={{cursor:"pointer"}} label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
                            {incByCat.map((item,i)=><Cell key={i} fill={COLORS_PALETTE[i%COLORS_PALETTE.length]} opacity={selIncCatId&&selIncCatId!==item.catId?0.3:1} stroke={selIncCatId===item.catId?"#fff":"none"} strokeWidth={selIncCatId===item.catId?2:0}/>)}
                          </Pie>
                          <Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12}}/>
                          <Legend iconSize={10} wrapperStyle={{fontSize:11,color:T.sub}}/>
                        </PieChart>
                      </ResponsiveContainer>
                  }
                </div>
                <div style={card}>
                  <div style={secTitle}>Income Sources</div>
                  {incByCat.map((item,i)=>{ const isSel=selIncCatId===item.catId; const cat=incCats.find(c=>c.id===item.catId); return(
                    <div key={item.catId}>
                      <div onClick={()=>handleIncCatClick(item.catId)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 12px",borderRadius:11,marginBottom:8,cursor:"pointer",background:isSel?"#10b98120":T.card2,border:`1px solid ${isSel?"#10b981":"transparent"}`,transition:"all 0.2s",opacity:selIncCatId&&!isSel?0.5:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:38,height:38,borderRadius:10,background:COLORS_PALETTE[i%COLORS_PALETTE.length]+"22",border:`2px solid ${COLORS_PALETTE[i%COLORS_PALETTE.length]}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat?.icon}</div>
                          <div><div style={{fontSize:14,fontWeight:600,color:T.text}}>{item.name}</div><div style={{fontSize:11,color:T.muted}}>{periodIncome>0?`${(item.value/periodIncome*100).toFixed(1)}% of income`:""}</div></div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{fontSize:16,fontWeight:800,color:"#10b981"}}>{fmt(item.value)}</div>
                          <span style={{fontSize:12,color:isSel?"#10b981":T.muted}}>{isSel?"▲":"▼"}</span>
                        </div>
                      </div>
                      {isSel&&(
                        <div style={{background:T.card3,borderRadius:"0 0 12px 12px",padding:"10px 12px 12px",marginTop:-8,marginBottom:8,border:"1px solid #10b98133",borderTop:"none"}}>
                          <div style={{fontSize:10,color:"#10b981",fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Transactions · {drillIncTxns.length} found</div>
                          {!drillIncTxns.length&&<div style={{color:T.muted,fontSize:12,padding:"6px 0"}}>No transactions in this period</div>}
                          {drillIncTxns.map(txn=><TxnRow key={txn.id} txn={txn} accounts={accounts} expCats={expCats} incCats={incCats}/>)}
                          <div style={{fontSize:12,fontWeight:700,color:"#10b981",textAlign:"right",marginTop:6}}>Total: {fmt(drillIncTxns.reduce((s,t)=>s+t.amount,0))}</div>
                        </div>
                      )}
                    </div>
                  );})}
                </div>
                <div style={{...card,display:"flex",gap:12}}>
                  <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:10,color:T.muted,marginBottom:4}}>Avg / Txn</div><div style={{fontSize:16,fontWeight:700,color:"#10b981"}}>{fmt(periodTxns.filter(t=>t.type==="income").length?Math.round(periodIncome/periodTxns.filter(t=>t.type==="income").length):0)}</div></div>
                  <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:10,color:T.muted,marginBottom:4}}>Transactions</div><div style={{fontSize:16,fontWeight:700,color:T.sub}}>{periodTxns.filter(t=>t.type==="income").length}</div></div>
                </div>
              </>
            )}

            {/* TREND REPORT */}
            {reportTab==="trend"&&(
              <>
                <div style={card}>
                  <div style={secTitle}>Monthly Income vs Expense</div>
                  {!monthlyData.length&&<div style={{textAlign:"center",color:T.muted,padding:"28px 0",fontSize:13}}>No data</div>}
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthlyData} margin={{left:-10,right:10}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis dataKey="month" tick={{fill:T.muted,fontSize:10}}/>
                      <YAxis tick={{fill:T.muted,fontSize:10}} tickFormatter={v=>`₹${v/1000}k`}/>
                      <Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12}}/>
                      <Legend iconSize={10} wrapperStyle={{fontSize:11,color:T.sub}}/>
                      <Bar dataKey="income" name="Income" fill="#10b981" radius={[4,4,0,0]}/>
                      <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={card}>
                  <div style={secTitle}>Net Savings Trend</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={monthlyData.map(m=>({...m,savings:m.income-m.expense}))} margin={{left:-10,right:10}}>
                      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis dataKey="month" tick={{fill:T.muted,fontSize:10}}/>
                      <YAxis tick={{fill:T.muted,fontSize:10}} tickFormatter={v=>`₹${v/1000}k`}/>
                      <Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12}}/>
                      <Area type="monotone" dataKey="savings" name="Savings" stroke="#3b82f6" fill="url(#sg)" strokeWidth={2}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={card}>
                  <div style={secTitle}>Account-wise Balance</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={accounts.map(a=>({name:a.name.split(" ")[0],balance:a.balance}))} layout="vertical" margin={{left:40,right:20}}>
                      <XAxis type="number" tick={{fill:T.muted,fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                      <YAxis type="category" dataKey="name" tick={{fill:T.sub,fontSize:11}}/>
                      <Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12}}/>
                      <Bar dataKey="balance" radius={[0,6,6,0]}>{accounts.map((a,i)=><Cell key={i} fill={a.color}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      {(tab==="dashboard"||tab==="transactions")&&(
        <button style={{position:"fixed",bottom:82,right:"max(14px,calc(50% - 226px))",width:54,height:54,borderRadius:27,background:"linear-gradient(135deg,#10b981,#059669)",border:"none",cursor:"pointer",fontSize:22,color:"#fff",boxShadow:"0 4px 22px rgba(16,185,129,0.4)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>{setEditTxn(null);setSmsPrefill(null);setShowTxnForm(true);}}>＋</button>
      )}

      {/* BOTTOM NAV */}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:T.nav,borderTop:`1px solid ${T.navBorder}`,display:"flex",zIndex:100}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 2px 9px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:tab===t.id?"#10b981":T.muted}}>
            <span style={{fontSize:17}}>{t.icon}</span>
            <span style={{fontSize:8,fontWeight:700,letterSpacing:"0.02em"}}>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* MODALS */}
      {showTxnForm&&<TxnForm accounts={accounts} expCats={expCats} incCats={incCats} onSave={saveTxn} editTxn={editTxn} prefill={smsPrefill} onClose={()=>{setShowTxnForm(false);setEditTxn(null);setSmsPrefill(null);}}/>}
      {showAccForm&&<AccountForm onSave={saveAcc} editAcc={editAcc} onClose={()=>{setShowAccForm(false);setEditAcc(null);}}/>}
      {showExpCatForm&&<ExpCatForm onSave={saveExpCat} editCat={editExpCat} onClose={()=>{setShowExpCatForm(false);setEditExpCat(null);}}/>}
      {showSubCatForm&&editSubCtx&&<SubCatForm parentName={editSubCtx.parentName} editSub={editSubCtx.sub} onSave={sub=>saveSubCat(editSubCtx.parentId,sub)} onClose={()=>{setShowSubCatForm(false);setEditSubCtx(null);}}/>}
      {showIncCatForm&&<IncCatForm onSave={saveIncCat} editCat={editIncCat} onClose={()=>{setShowIncCatForm(false);setEditIncCat(null);}}/>}
      {showExport&&<ExportModal onClose={()=>setShowExport(false)} txns={filteredTxns} accounts={accounts} expCats={expCats} incCats={incCats} periodLabel={periodLabel} appName={appName}/>}
      {showSettings&&<SettingsModal settings={settings} onChange={setSettings} onClose={()=>setShowSettings(false)} onBackup={doBackup} onRestore={doRestore}/>}
      {showSmsModal&&<SmsModal onClose={()=>setShowSmsModal(false)} onTransaction={p=>{ setSmsPrefill(p); setShowSmsModal(false); setTab("transactions"); setShowTxnForm(true); }}/>}
    </div>
  );
}
