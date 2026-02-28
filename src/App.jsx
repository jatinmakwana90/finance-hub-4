import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart } from "recharts";

// ─── LOCALSTORAGE HOOK (Fix #1 - data persistence) ───────────────────────────
function useLS(key, def) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; }
    catch { return def; }
  });
  const set = useCallback((v) => {
    setVal(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch(e) {}
      return next;
    });
  }, [key]);
  return [val, set];
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const DEFAULT_EXPENSE_CATS = [
  { id:"e1", name:"Food & Dining",  icon:"🍽️", color:"#f97316", sub:[{id:"e1s1",name:"Restaurants"},{id:"e1s2",name:"Groceries"},{id:"e1s3",name:"Coffee & Snacks"},{id:"e1s4",name:"Food Delivery"},{id:"e1s5",name:"Milk"},{id:"e1s6",name:"Fruits & Vegetables"}]},
  { id:"e2", name:"Transportation", icon:"🚗", color:"#3b82f6", sub:[{id:"e2s1",name:"Petrol"},{id:"e2s2",name:"Public Transit"},{id:"e2s3",name:"Taxi / Cab"},{id:"e2s4",name:"Vehicle Maintenance"}]},
  { id:"e3", name:"Housing",        icon:"🏠", color:"#8b5cf6", sub:[{id:"e3s1",name:"Rent"},{id:"e3s2",name:"Electricity"},{id:"e3s3",name:"Water & Gas"},{id:"e3s4",name:"Repairs"},{id:"e3s5",name:"EMI"}]},
  { id:"e4", name:"Entertainment",  icon:"🎬", color:"#ec4899", sub:[{id:"e4s1",name:"Movies"},{id:"e4s2",name:"Streaming"},{id:"e4s3",name:"Games"},{id:"e4s4",name:"Events"}]},
  { id:"e5", name:"Health",         icon:"💊", color:"#14b8a6", sub:[{id:"e5s1",name:"Pharmacy"},{id:"e5s2",name:"Doctor"},{id:"e5s3",name:"Gym"},{id:"e5s4",name:"Insurance"}]},
  { id:"e6", name:"Shopping",       icon:"🛍️", color:"#f59e0b", sub:[{id:"e6s1",name:"Clothing"},{id:"e6s2",name:"Electronics"},{id:"e6s3",name:"Home & Decor"},{id:"e6s4",name:"Gifts"}]},
  { id:"e7", name:"Education",      icon:"📚", color:"#06b6d4", sub:[{id:"e7s1",name:"Tuition"},{id:"e7s2",name:"Books"},{id:"e7s3",name:"Courses"}]},
  { id:"e8", name:"Personal Care",  icon:"💆", color:"#a855f7", sub:[{id:"e8s1",name:"Salon & Spa"},{id:"e8s2",name:"Cosmetics"}]},
  { id:"e9", name:"Bills",          icon:"🧾", color:"#64748b", sub:[{id:"e9s1",name:"Mobile Bill"},{id:"e9s2",name:"Internet"},{id:"e9s3",name:"DTH/Cable"}]},
  { id:"e10",name:"Grocery",        icon:"🛒", color:"#84cc16", sub:[{id:"e10s1",name:"Supermarket"},{id:"e10s2",name:"Household"},{id:"e10s3",name:"Snacks"}]},
  { id:"e11",name:"Miscellaneous",  icon:"📦", color:"#94a3b8", sub:[{id:"e11s1",name:"Other"}]},
];
const DEFAULT_INCOME_CATS = [
  {id:"i1",name:"Salary",       icon:"💼",color:"#10b981"},
  {id:"i2",name:"Freelance",    icon:"💻",color:"#3b82f6"},
  {id:"i3",name:"Business",     icon:"🏢",color:"#f59e0b"},
  {id:"i4",name:"Investments",  icon:"📈",color:"#8b5cf6"},
  {id:"i5",name:"Rental Income",icon:"🏘️",color:"#14b8a6"},
  {id:"i6",name:"Bonus",        icon:"🎁",color:"#ec4899"},
  {id:"i7",name:"IPO / Stocks", icon:"📊",color:"#3b82f6"},
  {id:"i8",name:"Other",        icon:"💰",color:"#64748b"},
];
const DEFAULT_ACCOUNTS = [
  {id:"a1",name:"HDFC Savings",      icon:"🏦",color:"#10b981"},
  {id:"a2",name:"SBI Current",       icon:"🏦",color:"#3b82f6"},
  {id:"a3",name:"ICICI Credit Card", icon:"💳",color:"#f59e0b"},
  {id:"a4",name:"Cash Wallet",       icon:"💵",color:"#8b5cf6"},
];
const DEFAULT_TXN = [
  {id:"t1", date:"2026-02-01",type:"income", accountId:"a1",catId:"i1",subCatId:null,  amount:65000,note:"Monthly salary"},
  {id:"t2", date:"2026-02-03",type:"expense",accountId:"a1",catId:"e1",subCatId:"e1s2",amount:4200, note:"Big Bazaar groceries"},
  {id:"t3", date:"2026-02-05",type:"expense",accountId:"a3",catId:"e6",subCatId:"e6s1",amount:2800, note:"Shirt and jeans"},
  {id:"t4", date:"2026-02-07",type:"expense",accountId:"a1",catId:"e3",subCatId:"e3s1",amount:15000,note:"Rent"},
  {id:"t5", date:"2026-02-09",type:"expense",accountId:"a4",catId:"e1",subCatId:"e1s1",amount:850,  note:"Dinner with friends"},
  {id:"t6", date:"2026-02-10",type:"income", accountId:"a1",catId:"i4",subCatId:null,  amount:3200, note:"Dividend payout"},
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
];

const COLORS_PALETTE = ["#10b981","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#ec4899","#14b8a6","#f97316","#06b6d4","#a855f7","#84cc16","#fb923c"];
// Fix #10 - expanded category icons
const CAT_ICONS = ["🍽️","🚗","🏠","🎬","💊","🛍️","📚","💆","✈️","🎓","🏋️","🐾","🎸","🖥️","🧾","🎁","💡","🔧","🏦","🧹","💰","📦","🤝","🎯","🧴","🐕","🚀","🎪","🌐","🏖️","⛽","🛒","🥛","🥦","🛡️","📊","💳","💵","🏧","👛","🪙","💸","🏘️","💼","📈","🏢","💻","🧾","🎗️","⚕️","🏥","🌾","🍎","🥗","☕","🥐","🍕","🚕","🛺","🚌","🚂","⚡","💧","📱","📺","🖨️","🔑","🏗️"];
// Fix #8 - account icons
const ACCOUNT_ICONS = ["🏦","💵","💳","💰","👛","🏧","📱","🏢","💎","🔐","🪙","💸","🎯","🏪","✈️"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── THEME ────────────────────────────────────────────────────────────────────
const DARK_THEME  = {bg:"#0f1420",card:"#1a1f2e",card2:"#131828",card3:"#0d1520",text:"#f1f5f9",text2:"#e2e8f0",sub:"#94a3b8",muted:"#64748b",border:"#2d3748",input:"#0f1420",hover:"#232b3e",header:"linear-gradient(135deg,#0f1420 0%,#1a2744 100%)",nav:"#1a1f2e",navBorder:"#2d3748"};
const LIGHT_THEME = {bg:"#f0f4f8",card:"#ffffff",card2:"#f4f7fb",card3:"#e8f0fe",text:"#1e293b",text2:"#334155",sub:"#475569",muted:"#64748b",border:"#e2e8f0",input:"#f8fafc",hover:"#e8f0fe",header:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",nav:"#ffffff",navBorder:"#e2e8f0"};

// ─── PERIOD HELPERS ───────────────────────────────────────────────────────────
const PERIODS = [{id:"mtd",label:"MTD"},{id:"7d",label:"7 Days"},{id:"lastm",label:"Last Month"},{id:"3m",label:"3 Months"},{id:"ytd",label:"YTD"},{id:"custom",label:"Custom"}];
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

// ─── UTILS ───────────────────────────────────────────────────────────────────
const now = new Date();
function uid(){ return "x"+Math.random().toString(36).slice(2,9); }
function fmt(n){ return "₹"+Number(n).toLocaleString("en-IN"); }
function fmtDate(d){ return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); }

// ─── SMS PARSER ───────────────────────────────────────────────────────────────
function parseSMS(text) {
  if(!text) return null;
  const t = text.replace(/,/g,"");
  const amtMatch = t.match(/(?:Rs\.?|INR|₹)\s*(\d+(?:\.\d{1,2})?)/i);
  if(!amtMatch) return null;
  const amount = parseFloat(amtMatch[1]);
  if(!amount || amount<=0) return null;
  const lower = t.toLowerCase();
  const isDebit = /debited|debit|spent|paid|payment|withdrawn|withdrawal|sent/i.test(lower);
  const isCredit = /credited|credit|received|deposited|refund/i.test(lower);
  if(!isDebit && !isCredit) return null;
  const type = isDebit ? "expense" : "income";
  let note = "";
  const merchantMatch = t.match(/(?:at|to|from|for)\s+([A-Za-z0-9 &'-]{2,30}?)(?:\s+on|\s+via|\s+ref|\.|\s*$)/i);
  if(merchantMatch) note = merchantMatch[1].trim();
  else { const upiMatch = t.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)/); if(upiMatch) note = upiMatch[1]; }
  return { type, amount, note: note||"SMS Transaction" };
}

// ─── EXPORT HELPERS (Fix #2 - proper exports) ─────────────────────────────────
function buildExportRows(txns, accounts, expCats, incCats) {
  return [...txns].sort((a,b)=>b.date.localeCompare(a.date)).map(t => {
    const cats=t.type==="expense"?expCats:incCats;
    const cat=cats.find(c=>c.id===t.catId);
    const sub=cat?.sub?.find(s=>s.id===t.subCatId);
    const catFull=cat?(sub?`${cat.name} / ${sub.name}`:cat.name):"";
    return {
      "Date": fmtDate(t.date),
      "Amount": t.type==="income" ? t.amount : -t.amount,
      "Category": catFull,
      "Remarks": t.note||"",
      "Type": t.type.charAt(0).toUpperCase()+t.type.slice(1),
    };
  });
}

// Fix #2 - share/download file (works on Android via Web Share API)
async function shareFile(data, filename, mime) {
  try {
    const blob = new Blob([data], {type:mime});
    const file = new File([blob], filename, {type:mime});
    if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
      await navigator.share({files:[file], title:filename});
      return;
    }
  } catch(e) {}
  // fallback download
  try {
    const blob = new Blob([data], {type:mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch(e) { alert("Export failed: "+e.message); }
}

async function exportCSV(txns, accounts, expCats, incCats) {
  const rows = buildExportRows(txns, accounts, expCats, incCats);
  const headers = ["Date","Amount","Category","Remarks","Type"];
  const lines = [headers.join(",")];
  rows.forEach(r=>lines.push(headers.map(h=>`"${String(r[h]||"").replace(/"/g,'""')}"`).join(",")));
  await shareFile("\uFEFF"+lines.join("\n"), "transactions.csv", "text/csv;charset=utf-8;");
}

async function exportExcel(txns, accounts, expCats, incCats) {
  const rows = buildExportRows(txns, accounts, expCats, incCats);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{wch:14},{wch:14},{wch:32},{wch:30},{wch:10}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  const buf = XLSX.write(wb, {bookType:"xlsx", type:"array"});
  await shareFile(new Uint8Array(buf), "transactions.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

function generatePDFHTML(txns, accounts, expCats, incCats, periodLabel, appName) {
  const rows = buildExportRows(txns, accounts, expCats, incCats);
  const totalInc = rows.filter(r=>r.Amount>0).reduce((s,r)=>s+r.Amount,0);
  const totalExp = rows.filter(r=>r.Amount<0).reduce((s,r)=>s+Math.abs(r.Amount),0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${appName} - Transactions</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:system-ui,sans-serif;padding:16px;color:#1e293b;font-size:13px;}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0;}
h1{font-size:18px;font-weight:800;}
.sub{font-size:11px;color:#64748b;margin-top:2px;}
.summary{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;}
.sc{background:#f8fafc;border-radius:8px;padding:10px 14px;border-left:3px solid #10b981;}
.sc.exp{border-color:#ef4444;}
.sl{font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;}
.sv{font-size:16px;font-weight:800;margin-top:2px;}
.pos{color:#059669;} .neg{color:#dc2626;}
table{width:100%;border-collapse:collapse;font-size:12px;}
th{background:#0f172a;color:#fff;padding:8px 10px;text-align:left;font-size:11px;}
td{padding:7px 10px;border-bottom:1px solid #f1f5f9;}
tr:nth-child(even)td{background:#f8fafc;}
.footer{margin-top:16px;font-size:10px;color:#94a3b8;text-align:center;}
@media print{body{padding:8px;} .no-print{display:none!important;}}
</style></head><body>
<div class="header">
<div><h1>📊 ${appName}</h1><div class="sub">Transactions · ${periodLabel} · ${fmtDate(new Date())}</div></div>
</div>
<div class="summary">
<div class="sc"><div class="sl">Income</div><div class="sv pos">₹${totalInc.toLocaleString("en-IN")}</div></div>
<div class="sc exp"><div class="sl">Expense</div><div class="sv neg">₹${totalExp.toLocaleString("en-IN")}</div></div>
<div class="sc"><div class="sl">Count</div><div class="sv">${rows.length}</div></div>
</div>
<table>
<thead><tr><th>Date</th><th>Amount</th><th>Category</th><th>Remarks</th></tr></thead>
<tbody>
${rows.map(r=>`<tr>
<td>${r.Date}</td>
<td class="${r.Amount>=0?"pos":"neg"}">${r.Amount>=0?"+":"-"}₹${Math.abs(r.Amount).toLocaleString("en-IN")}</td>
<td>${r.Category}</td>
<td>${r.Remarks}</td>
</tr>`).join("")}
</tbody>
</table>
<div class="footer">Generated by ${appName} · ${new Date().toLocaleString("en-IN")}</div>
</body></html>`;
}

// ─── SETTINGS DEFAULT ─────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = { uiMode:"dark", notifications:false, reminderTimes:["09:00","21:00"], smsDetection:true };

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────
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
function Toggle({ value, onChange, label, sub }) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid var(--c-border)"}}>
      <div><div style={{fontSize:14,fontWeight:600,color:"var(--c-text)"}}>{label}</div>{sub&&<div style={{fontSize:11,color:"var(--c-muted)",marginTop:2}}>{sub}</div>}</div>
      <div onClick={()=>onChange(!value)} style={{width:44,height:24,borderRadius:12,background:value?"#10b981":"var(--c-border)",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0,marginLeft:12}}>
        <div style={{position:"absolute",top:3,left:value?22:3,width:18,height:18,borderRadius:9,background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
      </div>
    </div>
  );
}
function ColorPicker({ value, onChange }){ return <div style={{marginBottom:14}}><FL>Color</FL><div style={{display:"flex",gap:9,flexWrap:"wrap"}}>{COLORS_PALETTE.map(c=><div key={c} onClick={()=>onChange(c)} style={{width:30,height:30,borderRadius:"50%",background:c,cursor:"pointer",border:value===c?"3px solid #fff":"3px solid transparent",flexShrink:0}}/>)}</div></div>; }
function IconPicker({ value, onChange, icons=CAT_ICONS }){ return <div style={{marginBottom:14}}><FL>Icon</FL><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{icons.map(ic=><button key={ic} onClick={()=>onChange(ic)} style={{width:38,height:38,borderRadius:10,border:"none",fontSize:20,cursor:"pointer",flexShrink:0,background:value===ic?"#10b981":"var(--c-border)",outline:value===ic?"2px solid #fff":"none"}}>{ic}</button>)}</div></div>; }

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
        <div style={{fontSize:11,color:"var(--c-muted)",marginTop:2}}>{acc?.icon} {acc?.name} · {fmtDate(txn.date)}</div>
        {txn.note&&<div style={{fontSize:11,color:"var(--c-muted)",marginTop:1,opacity:0.7,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{txn.note}</div>}
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
      {prefill&&<div style={{background:"#10b98120",border:"1px solid #10b981",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#10b981"}}>💬 Amount ₹{prefill.amount} detected from SMS · fill remaining details</div>}
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
        {accounts.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
      </FSelect>
      <FSelect label="Category" value={catId} onChange={e=>{setCatId(e.target.value);setSubCatId("");}}>
        <option value="">Select Category</option>
        {cats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
      </FSelect>
      {type==="expense"&&selCat&&selCat.sub?.length>0&&(
        <FSelect label="Sub Category" value={subCatId} onChange={e=>setSubCatId(e.target.value)}>
          <option value="">Select Sub Category</option>
          {selCat.sub.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </FSelect>
      )}
      <FInput label="Amount (₹)" type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/>
      <FInput label="Remarks (optional)" placeholder="What was this for?" value={note} onChange={e=>setNote(e.target.value)}/>
      <Btn onClick={save}>{editTxn?"Update Transaction":"Save Transaction"}</Btn>
    </Modal>
  );
}

// Account form - no balance field (balance calculated from transactions)
function AccountForm({ onSave, onClose, editAcc }) {
  const [name,setName]=useState(editAcc?.name||"");
  const [icon,setIcon]=useState(editAcc?.icon||"🏦");
  const [color,setColor]=useState(editAcc?.color||"#10b981");
  return (
    <Modal title={editAcc?"Edit Account":"Add Account"} onClose={onClose}>
      <div style={{background:"#10b98115",border:"1px solid #10b98144",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#10b981"}}>
        💡 Account balance is automatically calculated from your income & expense transactions.
      </div>
      <FInput label="Account Name" placeholder="e.g. HDFC Savings" value={name} onChange={e=>setName(e.target.value)}/>
      <IconPicker value={icon} onChange={setIcon} icons={ACCOUNT_ICONS}/>
      <ColorPicker value={color} onChange={setColor}/>
      <Btn onClick={()=>{if(!name)return;onSave({id:editAcc?.id||uid(),name,icon,color});}}>{editAcc?"Update Account":"Add Account"}</Btn>
    </Modal>
  );
}
function CatPreview({name,icon,color}){ return <div style={{background:"var(--c-input)",borderRadius:12,padding:14,marginBottom:14,display:"flex",alignItems:"center",gap:12}}><div style={{width:44,height:44,borderRadius:12,background:color+"22",border:`2px solid ${color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{icon}</div><div><div style={{fontSize:15,fontWeight:700,color:"var(--c-text)"}}>{name||"Category Name"}</div><div style={{fontSize:12,color:"var(--c-muted)"}}>Preview</div></div></div>; }
function ExpCatForm({ onSave, onClose, editCat }){
  const [name,setName]=useState(editCat?.name||"");const [icon,setIcon]=useState(editCat?.icon||"🍽️");const [color,setColor]=useState(editCat?.color||"#10b981");
  return <Modal title={editCat?"Edit Category":"Add Category"} onClose={onClose}><FInput label="Name" placeholder="e.g. Travel" value={name} onChange={e=>setName(e.target.value)}/><IconPicker value={icon} onChange={setIcon}/><ColorPicker value={color} onChange={setColor}/><CatPreview name={name} icon={icon} color={color}/><Btn onClick={()=>{if(!name)return;onSave({id:editCat?.id||uid(),name,icon,color,sub:editCat?.sub||[]});}}>{editCat?"Update":"Add Category"}</Btn></Modal>;
}
function SubCatForm({ parentName, onSave, onClose, editSub }){
  const [name,setName]=useState(editSub?.name||"");
  return <Modal title={editSub?"Edit Sub Category":"Add Sub Category"} onClose={onClose}><div style={{fontSize:12,color:"var(--c-muted)",marginBottom:16}}>Under: <span style={{color:"#10b981",fontWeight:700}}>{parentName}</span></div><FInput label="Name" placeholder="e.g. Petrol" value={name} onChange={e=>setName(e.target.value)}/><Btn onClick={()=>{if(!name)return;onSave({id:editSub?.id||uid(),name});}}>{editSub?"Update":"Add Sub Category"}</Btn></Modal>;
}
function IncCatForm({ onSave, onClose, editCat }){
  const [name,setName]=useState(editCat?.name||"");const [icon,setIcon]=useState(editCat?.icon||"💰");const [color,setColor]=useState(editCat?.color||"#10b981");
  return <Modal title={editCat?"Edit Category":"Add Category"} onClose={onClose}><FInput label="Name" placeholder="e.g. Rental Income" value={name} onChange={e=>setName(e.target.value)}/><IconPicker value={icon} onChange={setIcon}/><ColorPicker value={color} onChange={setColor}/><CatPreview name={name} icon={icon} color={color}/><Btn onClick={()=>{if(!name)return;onSave({id:editCat?.id||uid(),name,icon,color});}}>{editCat?"Update":"Add Category"}</Btn></Modal>;
}

// Fix #2 - PDF modal: in-app preview with close button (no fullscreen trap)
function PDFModal({ html, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"#fff",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#0f172a",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <span style={{color:"#fff",fontWeight:700,fontSize:15}}>📊 Transaction Report</span>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>window.print()} style={{background:"#10b981",border:"none",color:"#fff",padding:"8px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}>🖨️ Print / Save PDF</button>
          <button onClick={onClose} style={{background:"#ef4444",border:"none",color:"#fff",padding:"8px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}>✕ Close</button>
        </div>
      </div>
      <iframe srcDoc={html} style={{flex:1,border:"none",width:"100%"}} title="PDF Preview"/>
    </div>
  );
}

// ─── EXPORT MODAL ─────────────────────────────────────────────────────────────
function ExportModal({ onClose, txns, accounts, expCats, incCats, periodLabel, appName, onShowPDF }) {
  const [loading, setLoading] = useState(null);
  const options=[
    {id:"csv",  icon:"📄",label:"CSV File",        desc:"Save & share as spreadsheet",color:"#10b981"},
    {id:"excel",icon:"📊",label:"Excel (.xlsx)",   desc:"Open in Excel / Google Sheets",color:"#3b82f6"},
    {id:"pdf",  icon:"🖨️",label:"PDF / Print",     desc:"View & print as PDF",color:"#ef4444"},
  ];
  async function doExport(id){
    setLoading(id);
    try {
      if(id==="csv")   await exportCSV(txns,accounts,expCats,incCats);
      if(id==="excel") await exportExcel(txns,accounts,expCats,incCats);
      if(id==="pdf"){ onClose(); onShowPDF(generatePDFHTML(txns,accounts,expCats,incCats,periodLabel,appName)); return; }
    } catch(e){ alert("Export failed: "+e.message); }
    setLoading(null);
    if(id!=="pdf") onClose();
  }
  return (
    <Modal title="Export Transactions" onClose={onClose}>
      <div style={{background:"var(--c-input)",borderRadius:12,padding:"12px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
        <div style={{fontSize:28}}>📋</div>
        <div><div style={{fontSize:14,fontWeight:700,color:"var(--c-text)"}}>{txns.length} transactions</div><div style={{fontSize:12,color:"var(--c-muted)"}}>Columns: Date · Amount · Category · Remarks</div></div>
      </div>
      {options.map(o=>(
        <div key={o.id} onClick={()=>doExport(o.id)} className="hov" style={{display:"flex",alignItems:"center",gap:14,background:"var(--c-input)",borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer",transition:"background 0.2s",opacity:loading&&loading!==o.id?0.5:1}}>
          <div style={{fontSize:28,flexShrink:0}}>{loading===o.id?"⏳":o.icon}</div>
          <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:"var(--c-text)"}}>{o.label}</div><div style={{fontSize:12,color:"var(--c-muted)"}}>{o.desc}</div></div>
          <div style={{width:8,height:8,borderRadius:"50%",background:o.color}}/>
        </div>
      ))}
    </Modal>
  );
}

// ─── APP NAME EDITOR ──────────────────────────────────────────────────────────
function AppNameEditor({ name, onChange }) {
  const [editing,setEditing]=useState(false);const [val,setVal]=useState(name);
  function commit(){ const n=val.trim()||"My Finance Hub"; onChange(n); setEditing(false); }
  if(editing) return <div style={{display:"flex",alignItems:"center",gap:6}}><input autoFocus value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setVal(name);setEditing(false);}}} style={{background:"transparent",border:"none",borderBottom:"2px solid #10b981",color:"#fff",fontSize:19,fontWeight:800,outline:"none",padding:"2px 4px",width:180,maxWidth:"52vw"}}/><button onClick={commit} style={{background:"#10b981",border:"none",color:"#fff",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:700}}>✓</button></div>;
  return <div style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer"}} onClick={()=>setEditing(true)}><div style={{fontSize:19,fontWeight:800,color:"#fff"}}>{name}</div><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>✏️</span></div>;
}

// ─── SETTINGS MODAL (Fix #3 #4) ──────────────────────────────────────────────
function SettingsModal({ settings, onChange, onClose, onBackup, onRestore }) {
  const fileRef = useRef();
  const [newTime, setNewTime] = useState("08:00");
  function setSetting(key, val){ onChange({...settings,[key]:val}); }
  async function requestNotif(val) {
    if(val){
      if(typeof Notification === "undefined"){ alert("Notifications not supported in this browser."); return; }
      if(Notification.permission === "denied"){
        alert("Notifications are blocked. Please go to your browser/app Settings → Site Settings → Notifications and allow this app, then try again.");
        return;
      }
      if(Notification.permission === "default"){
        const p = await Notification.requestPermission();
        if(p !== "granted"){ alert("Notification permission denied."); return; }
      }
      // Permission granted - send test notification
      new Notification("🔔 Reminders Enabled!", { body: "You will be reminded at your selected times every day.", tag:"reminder-test" });
    }
    setSetting("notifications", val);
  }
  function addTime(){ if(!settings.reminderTimes.includes(newTime)) setSetting("reminderTimes",[...settings.reminderTimes,newTime].sort()); }
  function removeTime(t){ setSetting("reminderTimes",settings.reminderTimes.filter(x=>x!==t)); }
  const uiOpts=[{id:"auto",icon:"🌓",label:"Auto"},{id:"dark",icon:"🌙",label:"Dark"},{id:"light",icon:"☀️",label:"Light"}];
  return (
    <Modal title="⚙️ Settings" onClose={onClose}>
      <div style={{marginBottom:20}}>
        <FL>UI Theme</FL>
        <div style={{display:"flex",gap:8}}>
          {uiOpts.map(o=>(
            <div key={o.id} onClick={()=>setSetting("uiMode",o.id)} style={{flex:1,background:settings.uiMode===o.id?"#10b98122":"var(--c-input)",border:`2px solid ${settings.uiMode===o.id?"#10b981":"var(--c-border)"}`,borderRadius:12,padding:"10px 8px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4}}>{o.icon}</div>
              <div style={{fontSize:12,fontWeight:700,color:settings.uiMode===o.id?"#10b981":"var(--c-text)"}}>{o.label}</div>
            </div>
          ))}
        </div>
      </div>

      <Toggle value={settings.notifications} onChange={requestNotif} label="🔔 Daily Reminders" sub="Notify you to add transactions"/>
      {settings.notifications&&(
        <div style={{background:"var(--c-input)",borderRadius:12,padding:14,marginTop:10,marginBottom:4}}>
          <FL>Reminder Times</FL>
          {settings.reminderTimes.map(t=>(
            <div key={t} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--c-card)",borderRadius:8,padding:"8px 12px",marginBottom:6}}>
              <span style={{fontSize:15,fontWeight:700,color:"var(--c-text)"}}>⏰ {t}</span>
              <button onClick={()=>removeTime(t)} style={{background:"#ef444430",border:"none",color:"#ef4444",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12}}>Remove</button>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)} style={{flex:1,background:"var(--c-card)",border:"1px solid var(--c-border)",borderRadius:8,padding:"8px 12px",color:"var(--c-text)",fontSize:14,outline:"none"}}/>
            <button onClick={addTime} style={{background:"#10b981",border:"none",color:"#fff",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontWeight:700,fontSize:13}}>+ Add</button>
          </div>
        </div>
      )}

      {/* Fix #5 - SMS auto-detection info */}
      <Toggle value={settings.smsDetection} onChange={v=>setSetting("smsDetection",v)} label="📱 SMS Auto-Detection" sub="Auto-detect UPI/bank SMS transactions"/>
      {settings.smsDetection&&(
        <div style={{background:"#10b98115",border:"1px solid #10b98144",borderRadius:10,padding:"12px 14px",marginTop:8,marginBottom:4}}>
          <div style={{fontSize:12,color:"#10b981",fontWeight:700,marginBottom:6}}>✅ How SMS Detection Works in APK</div>
          <div style={{fontSize:11,color:"var(--c-sub)",lineHeight:1.7}}>
            When a UPI/bank debit or credit SMS arrives, the app will automatically detect it and show a <b style={{color:"var(--c-text)"}}>notification</b>.<br/>
            Tap the notification → transaction screen opens with <b style={{color:"var(--c-text)"}}>amount pre-filled</b>.<br/><br/>
            <b style={{color:"#f59e0b"}}>⚠️ Requires:</b> SMS permission must be granted when the app is installed from APK.
          </div>
        </div>
      )}

      {/* Fix #4 - Backup & Restore */}
      <div style={{marginTop:20}}>
        <FL>Backup & Restore</FL>
        <div style={{background:"var(--c-input)",borderRadius:12,padding:14}}>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:600,color:"var(--c-text)",marginBottom:4}}>💾 Backup Now</div>
            <div style={{fontSize:11,color:"var(--c-muted)",marginBottom:10}}>Save all your data as a JSON file. Share to Google Drive, WhatsApp or save locally.</div>
            <Btn onClick={onBackup} variant="outline" style={{marginTop:0}}>⬇ Download / Share Backup</Btn>
          </div>
          <div style={{borderTop:"1px solid var(--c-border)",paddingTop:14}}>
            <div style={{fontSize:14,fontWeight:600,color:"var(--c-text)",marginBottom:4}}>📂 Restore from Backup</div>
            <div style={{fontSize:11,color:"var(--c-muted)",marginBottom:10}}>Select a backup file to restore all data. Current data will be replaced.</div>
            <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){onRestore(e.target.files[0]);onClose();}}}/>
            <Btn onClick={()=>fileRef.current.click()} variant="ghost" style={{marginTop:0}}>⬆ Choose Backup File</Btn>
          </div>
        </div>
      </div>
      <div style={{fontSize:10,color:"var(--c-muted)",textAlign:"center",marginTop:16}}>My Finance Hub · v3.0 · All data saved locally on device</div>
    </Modal>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // Fix #1 - All state uses localStorage
  const [appName,      setAppName]      = useLS("appName",      "My Finance Hub");
  const [transactions, setTxns]         = useLS("txns",         DEFAULT_TXN);
  const [accounts,     setAccounts]     = useLS("accounts",     DEFAULT_ACCOUNTS);
  const [expCats,      setExpCats]      = useLS("expCats",      DEFAULT_EXPENSE_CATS);
  const [incCats,      setIncCats]      = useLS("incCats",      DEFAULT_INCOME_CATS);
  const [settings,     setSettings]     = useLS("settings",     DEFAULT_SETTINGS);
  const [period,       setPeriod]       = useLS("period",       "mtd");
  const [customFrom,   setCustomFrom]   = useLS("cFrom",        toYMD(new Date(now.getFullYear(),now.getMonth(),1)));
  const [customTo,     setCustomTo]     = useLS("cTo",          toYMD(now));

  const [tab,            setTab]            = useState("dashboard");
  const [catTab,         setCatTab]         = useState("expense");
  const [txnTypeFilter,  setTxnTypeFilter]  = useState("all");
  const [reportTab,      setReportTab]      = useState("expense");
  const [expandedCat,    setExpandedCat]    = useState(null);
  const [selExpCatId,    setSelExpCatId]    = useState(null);
  const [selSubCatId,    setSelSubCatId]    = useState(null);
  const [selIncCatId,    setSelIncCatId]    = useState(null);
  const [showTxnForm,    setShowTxnForm]    = useState(false);
  const [showAccForm,    setShowAccForm]    = useState(false);
  const [showExpCatForm, setShowExpCatForm] = useState(false);
  const [showSubCatForm, setShowSubCatForm] = useState(false);
  const [showIncCatForm, setShowIncCatForm] = useState(false);
  const [showExport,     setShowExport]     = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);
  const [pdfHTML,        setPdfHTML]        = useState(null);
  const [editTxn,        setEditTxn]        = useState(null);
  const [editAcc,        setEditAcc]        = useState(null);
  const [editExpCat,     setEditExpCat]     = useState(null);
  const [editSubCtx,     setEditSubCtx]     = useState(null);
  const [editIncCat,     setEditIncCat]     = useState(null);
  const [smsPrefill,     setSmsPrefill]     = useState(null);
  const [smsToast,       setSmsToast]       = useState(null);

  // ── Theme ──
  const systemDark = typeof window!=="undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const isDark = settings.uiMode==="dark"||(settings.uiMode==="auto"&&systemDark);
  const T = isDark ? DARK_THEME : LIGHT_THEME;
  useEffect(()=>{
    const r=document.documentElement.style;
    r.setProperty("--c-bg",T.bg); r.setProperty("--c-card",T.card); r.setProperty("--c-card2",T.card2);
    r.setProperty("--c-card3",T.card3||T.card2); r.setProperty("--c-text",T.text); r.setProperty("--c-text2",T.text2);
    r.setProperty("--c-sub",T.sub); r.setProperty("--c-muted",T.muted); r.setProperty("--c-border",T.border);
    r.setProperty("--c-input",T.input); r.setProperty("--c-hover",T.hover);
  },[T]);

  // ── Ask notification permission on first app load (like native apps) ──
  useEffect(()=>{
    const asked = localStorage.getItem("notifAsked");
    if(!asked && typeof Notification !== "undefined" && Notification.permission === "default"){
      // Small delay so app loads first
      setTimeout(async ()=>{
        localStorage.setItem("notifAsked","1");
        const permission = await Notification.requestPermission();
        if(permission === "granted"){
          // Auto-enable notifications on first grant
          setSettings(prev => {
            const next = {...prev, notifications: true};
            try { localStorage.setItem("settings", JSON.stringify(next)); } catch(e){}
            return next;
          });
          // Show welcome notification
          new Notification("💰 My Finance Hub", {
            body: "Notifications enabled! You'll get daily reminders to record transactions.",
          });
        }
      }, 1500);
    }
  // eslint-disable-next-line
  },[]);

  // ── Notification reminders - fires at correct time once per minute ──
  useEffect(()=>{
    if(!settings.notifications) return;
    if(typeof Notification === "undefined" || Notification.permission !== "granted") return;
    let lastFired = "";
    const tick = setInterval(()=>{
      const d = new Date();
      const hhmm = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
      // Only fire once per minute per time slot
      if(settings.reminderTimes.includes(hhmm) && lastFired !== hhmm){
        lastFired = hhmm;
        const n = new Notification("💰 Finance Reminder", {
          body: "Time to record your transactions for today!",
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "finance-reminder", // prevents duplicate notifications
          renotify: true,
        });
        n.onclick = ()=>{ window.focus(); setTab("transactions"); setShowTxnForm(true); n.close(); };
      }
    }, 10000); // check every 10 seconds
    return ()=>clearInterval(tick);
  },[settings.notifications, settings.reminderTimes]);

  // ── Fix #5 - SMS clipboard monitoring (web fallback; native plugin needed for background) ──
  useEffect(()=>{
    if(!settings.smsDetection) return;
    const handle = setInterval(async ()=>{
      try {
        if(!document.hasFocus()) return;
        const text = await navigator.clipboard?.readText?.();
        if(!text || text.length < 20 || text === (window.__lastClipboard||"")) return;
        window.__lastClipboard = text;
        const parsed = parseSMS(text);
        if(parsed && !smsToast){
          setSmsToast(parsed);
          setTimeout(()=>setSmsToast(null), 8000);
        }
      } catch(e) {}
    }, 3000);
    return ()=>clearInterval(handle);
  },[settings.smsDetection, smsToast]);

  // ── Fix #4 - Backup ──
  async function doBackup(){
    const data={transactions,accounts,expCats,incCats,appName,settings,backupDate:new Date().toISOString(),version:"3.0"};
    const json = JSON.stringify(data,null,2);
    await shareFile(json, `finance-backup-${toYMD(now)}.json`, "application/json");
  }
  function doRestore(file){
    const reader=new FileReader();
    reader.onload=e=>{ try{
      const d=JSON.parse(e.target.result);
      if(d.transactions)setTxns(d.transactions); if(d.accounts)setAccounts(d.accounts);
      if(d.expCats)setExpCats(d.expCats); if(d.incCats)setIncCats(d.incCats);
      if(d.appName)setAppName(d.appName); if(d.settings)setSettings(d.settings);
      alert("✅ Restore successful! All data loaded.");
    }catch{ alert("❌ Invalid backup file. Please select a valid backup."); } };
    reader.readAsText(file);
  }

  // ── Period ──
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

  // Balance calculated purely from transactions (no stored balance field)
  const accBalances = useMemo(()=>{
    const map={};
    accounts.forEach(a=>{ map[a.id]=0; });
    transactions.forEach(t=>{
      if(map[t.accountId]===undefined) map[t.accountId]=0;
      if(t.type==="income") map[t.accountId]+=t.amount;
      else map[t.accountId]-=t.amount;
    });
    return map;
  },[accounts,transactions]);
  const netBalance = useMemo(()=>Object.values(accBalances).reduce((s,b)=>s+b,0),[accBalances]);
  const periodIncome  = useMemo(()=>periodTxns.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),[periodTxns]);
  const periodExpense = useMemo(()=>periodTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),[periodTxns]);
  const filteredTxns  = useMemo(()=>{ let b=[...periodTxns].sort((a,x)=>x.date.localeCompare(a.date)); return txnTypeFilter==="all"?b:b.filter(t=>t.type===txnTypeFilter); },[periodTxns,txnTypeFilter]);
  const expByCat = useMemo(()=>{ const m={}; periodTxns.filter(t=>t.type==="expense").forEach(t=>{ const c=expCats.find(x=>x.id===t.catId); if(!c)return; if(!m[c.id])m[c.id]={name:c.name,catId:c.id,value:0}; m[c.id].value+=t.amount; }); return Object.values(m).sort((a,b)=>b.value-a.value); },[periodTxns,expCats]);
  const incByCat = useMemo(()=>{ const m={}; periodTxns.filter(t=>t.type==="income").forEach(t=>{ const c=incCats.find(x=>x.id===t.catId); if(!c)return; if(!m[c.id])m[c.id]={name:c.name,catId:c.id,icon:c.icon,value:0}; m[c.id].value+=t.amount; }); return Object.values(m).sort((a,b)=>b.value-a.value); },[periodTxns,incCats]);
  const subCatData = useMemo(()=>{ const src=periodTxns.filter(t=>t.type==="expense"&&t.subCatId&&(selExpCatId?t.catId===selExpCatId:true)); const m={}; src.forEach(t=>{ const c=expCats.find(x=>x.id===t.catId); const s=c?.sub?.find(x=>x.id===t.subCatId); if(!s)return; if(!m[t.subCatId])m[t.subCatId]={subId:t.subCatId,catId:t.catId,name:s.name,amount:0}; m[t.subCatId].amount+=t.amount; }); return Object.values(m).sort((a,b)=>b.amount-a.amount); },[periodTxns,expCats,selExpCatId]);
  const monthlyData = useMemo(()=>{ const m={}; transactions.forEach(t=>{ const d=new Date(t.date); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; if(!m[k])m[k]={month:`${MONTHS[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,income:0,expense:0,k}; m[k][t.type]+=t.amount; }); return Object.values(m).sort((a,b)=>a.k.localeCompare(b.k)); },[transactions]);
  const drillExpTxns = useMemo(()=>selSubCatId?periodTxns.filter(t=>t.type==="expense"&&t.subCatId===selSubCatId).sort((a,b)=>b.date.localeCompare(a.date)):[]  ,[periodTxns,selSubCatId]);
  const drillIncTxns = useMemo(()=>selIncCatId?periodTxns.filter(t=>t.type==="income"&&t.catId===selIncCatId).sort((a,b)=>b.date.localeCompare(a.date)):[]      ,[periodTxns,selIncCatId]);

  function getCatName(txn){ const cats=txn.type==="expense"?expCats:incCats; const cat=cats.find(c=>c.id===txn.catId); if(!cat)return "–"; const sub=cat.sub?.find(s=>s.id===txn.subCatId); return`${cat.icon} ${cat.name}${sub?` › ${sub.name}`:""}`; }

  function saveTxn(t){ setTxns(p=>{const i=p.findIndex(x=>x.id===t.id);if(i>=0){const n=[...p];n[i]=t;return n;}return[...p,t];}); setShowTxnForm(false); setEditTxn(null); setSmsPrefill(null); }
  function deleteTxn(id){ setTxns(p=>p.filter(t=>t.id!==id)); }
  function saveAcc(a){ setAccounts(p=>{const i=p.findIndex(x=>x.id===a.id);if(i>=0){const n=[...p];n[i]={...n[i],...a};return n;}return[...p,a];}); setShowAccForm(false); setEditAcc(null); }
  function deleteAcc(id){ setAccounts(p=>p.filter(a=>a.id!==id)); }
  function saveExpCat(c){ setExpCats(p=>{const i=p.findIndex(x=>x.id===c.id);if(i>=0){const n=[...p];n[i]={...n[i],...c,sub:n[i].sub};return n;}return[...p,c];}); setShowExpCatForm(false); setEditExpCat(null); }
  function deleteExpCat(id){ if(transactions.some(t=>t.catId===id)){alert("Cannot delete: category has transactions.");return;} setExpCats(p=>p.filter(c=>c.id!==id)); if(expandedCat===id)setExpandedCat(null); }
  function saveSubCat(pid,sub){ setExpCats(p=>p.map(c=>{ if(c.id!==pid)return c; const i=c.sub.findIndex(s=>s.id===sub.id); if(i>=0){const ss=[...c.sub];ss[i]=sub;return{...c,sub:ss};}return{...c,sub:[...c.sub,sub]}; })); setShowSubCatForm(false); setEditSubCtx(null); }
  function deleteSubCat(pid,sid){ if(transactions.some(t=>t.subCatId===sid)){alert("Cannot delete: sub-category has transactions.");return;} setExpCats(p=>p.map(c=>c.id===pid?{...c,sub:c.sub.filter(s=>s.id!==sid)}:c)); }
  function saveIncCat(c){ setIncCats(p=>{const i=p.findIndex(x=>x.id===c.id);if(i>=0){const n=[...p];n[i]=c;return n;}return[...p,c];}); setShowIncCatForm(false); setEditIncCat(null); }
  function deleteIncCat(id){ if(transactions.some(t=>t.catId===id)){alert("Cannot delete: category has transactions.");return;} setIncCats(p=>p.filter(c=>c.id!==id)); }
  function handlePieExpClick(data){ const cid=data?.catId||null; if(selExpCatId===cid){setSelExpCatId(null);setSelSubCatId(null);}else{setSelExpCatId(cid);setSelSubCatId(null);} }
  function handleSubCatClick(sid){ setSelSubCatId(p=>p===sid?null:sid); }
  function handleIncCatClick(cid){ setSelIncCatId(p=>p===cid?null:cid); }
  function switchReportTab(t){ setReportTab(t); setSelExpCatId(null); setSelSubCatId(null); setSelIncCatId(null); }

  const pill=(a,col="#10b981")=>({padding:"7px 13px",borderRadius:18,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:a?col:T.border,color:a?"#fff":T.sub,transition:"all 0.15s"});
  const card={background:T.card,borderRadius:16,padding:18,marginBottom:14};
  const secTitle={fontSize:15,fontWeight:700,color:T.text,marginBottom:12};
  const TABS=[{id:"dashboard",icon:"📊",label:"Home"},{id:"transactions",icon:"📋",label:"Transactions"},{id:"accounts",icon:"🏦",label:"Accounts"},{id:"categories",icon:"🏷️",label:"Categories"},{id:"reports",icon:"📈",label:"Reports"}];

  return (
    <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",background:T.bg,minHeight:"100vh",color:T.text,maxWidth:480,margin:"0 auto",position:"relative",paddingBottom:90}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input[type=date]::-webkit-calendar-picker-indicator,input[type=time]::-webkit-calendar-picker-indicator{filter:${isDark?"invert(1)":"none"};}
        select option{background:var(--c-card);}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:var(--c-border);border-radius:2px;}
        .hov:hover{background:var(--c-hover) !important;}
        @media print{.no-print{display:none!important;}}
      `}</style>

      {/* ── SMS TOAST (Fix #5) ── */}
      {smsToast&&(
        <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:3000,background:"#10b981",borderRadius:14,padding:"12px 16px",maxWidth:440,width:"calc(100% - 28px)",boxShadow:"0 8px 32px rgba(0,0,0,0.4)",display:"flex",gap:12,alignItems:"center"}}>
          <div style={{fontSize:24,flexShrink:0}}>📱</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>SMS Detected — {smsToast.type==="expense"?"Expense":"Income"} of {fmt(smsToast.amount)}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.8)",marginTop:2}}>Tap to add transaction</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{setSmsPrefill(smsToast);setSmsToast(null);setTab("transactions");setShowTxnForm(true);}} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>Add</button>
            <button onClick={()=>setSmsToast(null)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:14}}>✕</button>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{background:T.header,padding:"22px 16px 16px",borderBottom:`1px solid ${T.navBorder}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setShowSettings(true)} style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.12)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>⚙️</button>
            <div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.45)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:2}}>Budget Tracker</div>
              <AppNameEditor name={appName} onChange={setAppName}/>
            </div>
          </div>
          {/* Fix #9 - Balance instead of Net Worth */}
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.45)"}}>Balance</div>
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
              <div style={{flex:1,background:T.card,borderRadius:14,padding:"14px 16px",borderLeft:"3px solid #10b981"}}><div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase"}}>Income</div><div style={{fontSize:22,fontWeight:800,color:"#10b981",marginTop:6}}>{fmt(periodIncome)}</div></div>
              <div style={{flex:1,background:T.card,borderRadius:14,padding:"14px 16px",borderLeft:"3px solid #ef4444"}}><div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase"}}>Expenses</div><div style={{fontSize:22,fontWeight:800,color:"#ef4444",marginTop:6}}>{fmt(periodExpense)}</div></div>
            </div>
            <div style={{...secTitle,marginBottom:10}}>My Accounts</div>
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8,marginBottom:14}}>
              {accounts.map(a=>{
                const bal=accBalances[a.id]||0;
                return(
                <div key={a.id} style={{minWidth:148,background:T.card,borderRadius:14,padding:14,borderTop:`3px solid ${a.color}`,flexShrink:0}}>
                  <div style={{fontSize:22,marginBottom:4}}>{a.icon}</div>
                  <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                  <div style={{fontSize:17,fontWeight:800,color:bal>=0?a.color:"#ef4444"}}>{fmt(bal)}</div>
                </div>
                );
              })}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={secTitle}>Recent Transactions</div>
              <button onClick={()=>setTab("transactions")} style={{background:"none",border:"none",color:"#10b981",fontSize:13,cursor:"pointer",fontWeight:700}}>See all →</button>
            </div>
            {!periodTxns.length&&<div style={{textAlign:"center",color:T.muted,padding:"28px 0",fontSize:13}}><div style={{fontSize:36,marginBottom:8}}>📭</div>No transactions in this period</div>}
            {[...periodTxns].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(txn=>(
              <div key={txn.id} className="hov" style={{background:T.card,borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",transition:"background 0.2s"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getCatName(txn)}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>{accounts.find(a=>a.id===txn.accountId)?.icon} {accounts.find(a=>a.id===txn.accountId)?.name} · {fmtDate(txn.date)}</div>
                  {txn.note&&<div style={{fontSize:11,color:T.muted,marginTop:1,opacity:0.7,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{txn.note}</div>}
                </div>
                <div style={{fontSize:15,fontWeight:800,color:txn.type==="income"?"#10b981":"#ef4444",flexShrink:0,marginLeft:10}}>{txn.type==="income"?"+":"-"}{fmt(txn.amount)}</div>
              </div>
            ))}
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
              <button onClick={()=>setShowExport(true)} style={{background:T.border,border:"none",color:T.sub,borderRadius:10,padding:"6px 11px",cursor:"pointer",fontWeight:700,fontSize:11}}>⬇️ Export</button>
            </div>
            <div style={{fontSize:11,color:T.muted,marginBottom:10}}>{filteredTxns.length} transactions · {periodLabel}</div>
            {filteredTxns.map(txn=>(
              <div key={txn.id} className="hov" style={{background:T.card,borderRadius:12,padding:"13px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",transition:"background 0.2s"}} onClick={()=>{setEditTxn(txn);setShowTxnForm(true);}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getCatName(txn)}</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>{accounts.find(a=>a.id===txn.accountId)?.icon} {accounts.find(a=>a.id===txn.accountId)?.name} · {fmtDate(txn.date)}</div>
                  {txn.note&&<div style={{fontSize:11,color:T.muted,marginTop:1,opacity:0.7,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{txn.note}</div>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  <div style={{fontSize:15,fontWeight:800,color:txn.type==="income"?"#10b981":"#ef4444"}}>{txn.type==="income"?"+":"-"}{fmt(txn.amount)}</div>
                  <button onClick={e=>{e.stopPropagation();deleteTxn(txn.id);}} style={{background:T.border,border:"none",color:"#ef4444",borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:12}}>✕</button>
                </div>
              </div>
            ))}
            {!filteredTxns.length&&<div style={{textAlign:"center",color:T.muted,padding:"48px 0"}}><div style={{fontSize:42,marginBottom:12}}>📭</div>No transactions</div>}
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
              const bal=accBalances[acc.id]||0;
              return(
                <div key={acc.id} className="hov" style={{background:T.card,borderRadius:14,padding:16,marginBottom:12,transition:"background 0.2s",cursor:"pointer",borderLeft:`4px solid ${acc.color}`}} onClick={()=>{setEditAcc(acc);setShowAccForm(true);}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{fontSize:28}}>{acc.icon}</div>
                      <div><div style={{fontSize:16,fontWeight:700,color:T.text}}>{acc.name}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>Tap to edit</div></div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:22,fontWeight:800,color:bal>=0?acc.color:"#ef4444"}}>{fmt(bal)}</div>
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
                  <div><div style={secTitle}>Expense Categories</div><div style={{fontSize:11,color:T.muted,marginTop:-8,marginBottom:8}}>Tap to expand sub categories</div></div>
                  <button onClick={()=>{setEditExpCat(null);setShowExpCatForm(true);}} style={{background:"#ef4444",border:"none",color:"#fff",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:13,flexShrink:0}}>+ Add</button>
                </div>
                {expCats.map(cat=>{
                  const isOpen=expandedCat===cat.id;
                  return(
                    <div key={cat.id} style={{marginBottom:10}}>
                      <div style={{background:T.card,borderRadius:isOpen?"16px 16px 0 0":"16px",border:`1px solid ${isOpen?cat.color:"transparent"}`}}>
                        <div className="hov" style={{display:"flex",alignItems:"center",gap:12,padding:14,cursor:"pointer"}} onClick={()=>setExpandedCat(isOpen?null:cat.id)}>
                          <div style={{width:46,height:46,borderRadius:14,background:cat.color+"20",border:`2px solid ${cat.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{cat.icon}</div>
                          <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:700,color:T.text}}>{cat.name}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}><span style={{color:cat.color,fontWeight:700}}>{cat.sub.length}</span> sub categor{cat.sub.length===1?"y":"ies"}</div></div>
                          <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>{setEditExpCat(cat);setShowExpCatForm(true);}} style={{background:T.border,border:"none",color:T.sub,borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
                            <button onClick={()=>deleteExpCat(cat.id)} style={{background:T.border,border:"none",color:"#ef4444",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                          </div>
                          <div style={{fontSize:18,color:T.muted,marginLeft:2,transition:"transform 0.25s",transform:isOpen?"rotate(90deg)":"none"}}>›</div>
                        </div>
                        {isOpen&&(
                          <div style={{background:T.card2,borderTop:`1px solid ${cat.color}33`,padding:"12px 14px 14px"}}>
                            {cat.sub.map(sub=>(
                              <div key={sub.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.card,borderRadius:11,padding:"11px 13px",marginBottom:8}}>
                                <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:7,height:7,borderRadius:"50%",background:cat.color,flexShrink:0}}/><span style={{fontSize:14,color:T.text2,fontWeight:500}}>{sub.name}</span></div>
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
              </>
            )}
            {catTab==="income"&&(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={secTitle}>Income Categories</div>
                  <button onClick={()=>{setEditIncCat(null);setShowIncCatForm(true);}} style={{background:"#10b981",border:"none",color:"#fff",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:13}}>+ Add</button>
                </div>
                {incCats.map(cat=>(
                  <div key={cat.id} className="hov" style={{background:T.card,borderRadius:14,padding:14,marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:46,height:46,borderRadius:14,background:cat.color+"20",border:`2px solid ${cat.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{cat.icon}</div>
                    <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700,color:T.text}}>{cat.name}</div></div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>{setEditIncCat(cat);setShowIncCatForm(true);}} style={{background:T.border,border:"none",color:T.sub,borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
                      <button onClick={()=>deleteIncCat(cat.id)} style={{background:T.border,border:"none",color:"#ef4444",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                    </div>
                  </div>
                ))}
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

            {reportTab==="expense"&&(
              <>
                <div style={card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={secTitle}>Expense by Category</div>
                    {selExpCatId&&<button onClick={()=>{setSelExpCatId(null);setSelSubCatId(null);}} style={{background:T.border,border:"none",color:T.sub,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:11}}>✕ All</button>}
                  </div>
                  {!expByCat.length?<div style={{textAlign:"center",color:T.muted,padding:"28px 0"}}>No expense data</div>:
                    <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={expByCat} cx="50%" cy="50%" innerRadius={60} outerRadius={88} paddingAngle={3} dataKey="value" onClick={handlePieExpClick} style={{cursor:"pointer"}} label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>{expByCat.map((item,i)=><Cell key={i} fill={COLORS_PALETTE[i%COLORS_PALETTE.length]} opacity={selExpCatId&&selExpCatId!==item.catId?0.3:1}/>)}</Pie><Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12}}/><Legend iconSize={10} wrapperStyle={{fontSize:11,color:T.sub}}/></PieChart></ResponsiveContainer>}
                </div>
                <div style={card}>
                  <div style={secTitle}>Breakdown</div>
                  {expByCat.map((item,i)=>{ const isSel=selExpCatId===item.catId; const cat=expCats.find(c=>c.id===item.catId); return(
                    <div key={item.catId} onClick={()=>handlePieExpClick(item)} style={{marginBottom:10,cursor:"pointer",padding:"8px 10px",borderRadius:10,background:isSel?COLORS_PALETTE[i%COLORS_PALETTE.length]+"22":T.card2,border:`1px solid ${isSel?COLORS_PALETTE[i%COLORS_PALETTE.length]:"transparent"}`,opacity:selExpCatId&&!isSel?0.5:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,color:T.text,fontWeight:600}}><span style={{marginRight:6}}>{cat?.icon}</span>{item.name}</span><span style={{fontSize:13,fontWeight:800,color:T.text}}>{fmt(item.value)}</span></div>
                      <div style={{background:T.bg,borderRadius:4,height:5,overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,background:COLORS_PALETTE[i%COLORS_PALETTE.length],width:`${(item.value/expByCat[0].value)*100}%`}}/></div>
                      <div style={{fontSize:10,color:T.muted,marginTop:3,textAlign:"right"}}>{periodExpense>0?`${(item.value/periodExpense*100).toFixed(1)}%`:""}</div>
                    </div>);
                  })}
                </div>
                {subCatData.length>0&&<div style={card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={secTitle}>Sub Categories</div>{selSubCatId&&<button onClick={()=>setSelSubCatId(null)} style={{background:T.border,border:"none",color:T.sub,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11}}>✕ Close</button>}</div>
                  {subCatData.map((item,i)=>{ const parentCat=expCats.find(c=>c.id===item.catId); const isSel=selSubCatId===item.subId; return(
                    <div key={item.subId}>
                      <div onClick={()=>handleSubCatClick(item.subId)} style={{marginBottom:8,cursor:"pointer",padding:"10px 12px",borderRadius:11,background:isSel?"#10b98120":T.card2,border:`1px solid ${isSel?"#10b981":"transparent"}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:7,height:7,borderRadius:"50%",background:parentCat?.color||COLORS_PALETTE[i%12],flexShrink:0}}/><span style={{fontSize:13,color:T.text,fontWeight:500}}>{item.name}</span></div><span style={{fontSize:13,fontWeight:700,color:T.text}}>{fmt(item.amount)}</span></div>
                        <div style={{background:T.bg,borderRadius:4,height:4,overflow:"hidden"}}><div style={{height:"100%",borderRadius:4,background:parentCat?.color||COLORS_PALETTE[i%12],width:subCatData[0]?`${(item.amount/subCatData[0].amount)*100}%`:"0%"}}/></div>
                      </div>
                      {isSel&&drillExpTxns.length>0&&<div style={{background:T.card2,borderRadius:"0 0 12px 12px",padding:"10px 12px",marginTop:-8,marginBottom:8,border:"1px solid #10b98133",borderTop:"none"}}>
                        {drillExpTxns.map(txn=><TxnRow key={txn.id} txn={txn} accounts={accounts} expCats={expCats} incCats={incCats}/>)}
                        <div style={{fontSize:12,fontWeight:700,color:"#ef4444",textAlign:"right",marginTop:6}}>Total: {fmt(drillExpTxns.reduce((s,t)=>s+t.amount,0))}</div>
                      </div>}
                    </div>);
                  })}
                </div>}
              </>
            )}

            {reportTab==="income"&&(
              <>
                <div style={card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={secTitle}>Income by Category</div>{selIncCatId&&<button onClick={()=>setSelIncCatId(null)} style={{background:T.border,border:"none",color:T.sub,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:11}}>✕</button>}</div>
                  {!incByCat.length?<div style={{textAlign:"center",color:T.muted,padding:"28px 0"}}>No income data</div>:
                    <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={incByCat} cx="50%" cy="50%" innerRadius={60} outerRadius={88} paddingAngle={3} dataKey="value" onClick={d=>handleIncCatClick(d.catId)} style={{cursor:"pointer"}} label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>{incByCat.map((item,i)=><Cell key={i} fill={COLORS_PALETTE[i%COLORS_PALETTE.length]} opacity={selIncCatId&&selIncCatId!==item.catId?0.3:1}/>)}</Pie><Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12}}/><Legend iconSize={10} wrapperStyle={{fontSize:11,color:T.sub}}/></PieChart></ResponsiveContainer>}
                </div>
                <div style={card}>
                  <div style={secTitle}>Income Sources</div>
                  {incByCat.map((item,i)=>{ const isSel=selIncCatId===item.catId; const cat=incCats.find(c=>c.id===item.catId); return(
                    <div key={item.catId}>
                      <div onClick={()=>handleIncCatClick(item.catId)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 12px",borderRadius:11,marginBottom:8,cursor:"pointer",background:isSel?"#10b98120":T.card2,border:`1px solid ${isSel?"#10b981":"transparent"}`,opacity:selIncCatId&&!isSel?0.5:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:38,height:38,borderRadius:10,background:COLORS_PALETTE[i%COLORS_PALETTE.length]+"22",border:`2px solid ${COLORS_PALETTE[i%COLORS_PALETTE.length]}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat?.icon}</div><div><div style={{fontSize:14,fontWeight:600,color:T.text}}>{item.name}</div><div style={{fontSize:11,color:T.muted}}>{periodIncome>0?`${(item.value/periodIncome*100).toFixed(1)}%`:""}</div></div></div>
                        <div style={{fontSize:16,fontWeight:800,color:"#10b981"}}>{fmt(item.value)}</div>
                      </div>
                      {isSel&&drillIncTxns.length>0&&<div style={{background:T.card2,borderRadius:"0 0 12px 12px",padding:"10px 12px",marginTop:-8,marginBottom:8,border:"1px solid #10b98133",borderTop:"none"}}>
                        {drillIncTxns.map(txn=><TxnRow key={txn.id} txn={txn} accounts={accounts} expCats={expCats} incCats={incCats}/>)}
                        <div style={{fontSize:12,fontWeight:700,color:"#10b981",textAlign:"right",marginTop:6}}>Total: {fmt(drillIncTxns.reduce((s,t)=>s+t.amount,0))}</div>
                      </div>}
                    </div>);
                  })}
                </div>
              </>
            )}

            {reportTab==="trend"&&(
              <>
                <div style={card}>
                  <div style={secTitle}>Monthly Income vs Expense</div>
                  <ResponsiveContainer width="100%" height={240}><BarChart data={monthlyData} margin={{left:-10,right:10}}><CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="month" tick={{fill:T.muted,fontSize:10}}/><YAxis tick={{fill:T.muted,fontSize:10}} tickFormatter={v=>`₹${v/1000}k`}/><Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12}}/><Legend iconSize={10} wrapperStyle={{fontSize:11,color:T.sub}}/><Bar dataKey="income" name="Income" fill="#10b981" radius={[4,4,0,0]}/><Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
                </div>
                <div style={card}>
                  <div style={secTitle}>Savings Trend</div>
                  <ResponsiveContainer width="100%" height={200}><AreaChart data={monthlyData.map(m=>({...m,savings:m.income-m.expense}))} margin={{left:-10,right:10}}><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="month" tick={{fill:T.muted,fontSize:10}}/><YAxis tick={{fill:T.muted,fontSize:10}} tickFormatter={v=>`₹${v/1000}k`}/><Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12}}/><Area type="monotone" dataKey="savings" name="Savings" stroke="#3b82f6" fill="url(#sg)" strokeWidth={2}/></AreaChart></ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      {(tab==="dashboard"||tab==="transactions")&&(
        <button className="no-print" style={{position:"fixed",bottom:82,right:"max(14px,calc(50% - 226px))",width:54,height:54,borderRadius:27,background:"linear-gradient(135deg,#10b981,#059669)",border:"none",cursor:"pointer",fontSize:22,color:"#fff",boxShadow:"0 4px 22px rgba(16,185,129,0.4)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>{setEditTxn(null);setSmsPrefill(null);setShowTxnForm(true);}}>＋</button>
      )}

      {/* BOTTOM NAV */}
      <nav className="no-print" style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:T.nav,borderTop:`1px solid ${T.navBorder}`,display:"flex",zIndex:100}}>
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
      {showExport&&<ExportModal onClose={()=>setShowExport(false)} txns={filteredTxns} accounts={accounts} expCats={expCats} incCats={incCats} periodLabel={periodLabel} appName={appName} onShowPDF={setPdfHTML}/>}
      {showSettings&&<SettingsModal settings={settings} onChange={setSettings} onClose={()=>setShowSettings(false)} onBackup={doBackup} onRestore={doRestore}/>}
      {pdfHTML&&<PDFModal html={pdfHTML} onClose={()=>setPdfHTML(null)}/>}
    </div>
  );
}
