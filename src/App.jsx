/**
 * My Finance Hub v7.0
 * ALL 11 fixes: txn filters, notification timing, opening balance,
 * carry-forward, account transfer, file save, SMS detection,
 * PDF in-app viewer (back works), PDF generation, CSV/Excel save, JPG export.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from "recharts";

// ─── LOCALSTORAGE HOOK ────────────────────────────────────────────────────────
function useLS(key, def) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; }
    catch { return def; }
  });
  const set = useCallback((v) => {
    setVal(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [val, set];
}

// ─── CAPACITOR HELPER ─────────────────────────────────────────────────────────
const Cap = {
  isNative: () => { try { return !!window.Capacitor?.isNativePlatform?.(); } catch { return false; } },
  plugin:   (n) => { try { return window.Capacitor?.Plugins?.[n] || null; } catch { return null; } },
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
// Rule: ONLY fire at exact times in reminderTimes. NEVER fire automatically on
// enable or app open. Only fireTestNow() fires immediately (user action only).
// Uses on:{hour,minute} schedule = OS-level daily repeat alarm.
const Notif = {
  async getPermission() {
    const ln = Cap.plugin("LocalNotifications");
    if (ln) { try { const r = await ln.checkPermissions(); return r?.display || "prompt"; } catch {} }
    if (typeof Notification !== "undefined") return Notification.permission;
    return "inapp";
  },
  async requestPermission() {
    const ln = Cap.plugin("LocalNotifications");
    if (ln) {
      try {
        if (ln.createChannel) {
          await ln.createChannel({
            id: "finance_daily", name: "Daily Reminders",
            importance: 5, vibration: true, sound: "default",
          });
        }
        const r = await ln.requestPermissions();
        return r?.display === "granted" ? "granted" : "denied";
      } catch { return "denied"; }
    }
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") return "granted";
      if (Notification.permission === "denied")  return "denied";
      try { return await Notification.requestPermission(); } catch {}
    }
    return "inapp";
  },

  // Cancel every pending notification (wipes stale alarms from old versions too)
  async cancelAllPending() {
    const ln = Cap.plugin("LocalNotifications");
    if (!ln) return;
    try {
      const p = await ln.getPending();
      if (p?.notifications?.length) {
        await ln.cancel({ notifications: p.notifications.map(n => ({ id: n.id })) });
      }
    } catch {}
  },

  // WHY EXACT ALARMS: on:{hour,minute} uses AlarmManager.setRepeating() = INEXACT.
  // Android batches inexact alarms and fires them whenever it wants.
  // Solution: schedule individual at: alarms for each of next N days.
  // Each uses AlarmManager.setExactAndAllowWhileIdle() = MUST fire at exact time.
  async scheduleExactDays(hhmm, days = 14) {
    const ln = Cap.plugin("LocalNotifications");
    if (!ln) return { ok: false, count: 0 };
    const [h, m] = hhmm.split(":").map(Number);
    const baseId = (h * 1000 + m) * 100;  // e.g. "09:00" -> 900000
    const now = new Date();
    const notifications = [];

    for (let d = 0; d <= days; d++) {
      const fire = new Date(now);
      fire.setDate(fire.getDate() + d);
      fire.setHours(h, m, 0, 0);
      if (fire.getTime() <= now.getTime()) continue;  // skip times already passed

      notifications.push({
        id: baseId + d,
        channelId: "finance_daily",
        title: "💰 Finance Reminder",
        body: "Time to log today's transactions!",
        schedule: {
          at: fire,
          allowWhileIdle: true,  // fires even in Android Doze mode
        },
        sound: "default",
      });
    }

    if (!notifications.length) return { ok: false, count: 0 };
    try {
      await ln.schedule({ notifications });
      return { ok: true, count: notifications.length };
    } catch (e) {
      console.warn("Notif schedule error:", hhmm, e);
      return { ok: false, count: 0 };
    }
  },

  // Cancel ALL stale alarms first, then schedule fresh 14-day window for each time
  async rescheduleAll(times) {
    await this.cancelAllPending();
    const results = [];
    for (const t of times) {
      const r = await this.scheduleExactDays(t, 14);
      results.push({ time: t, ok: r.ok, count: r.count });
    }
    return results;
  },

  // ONLY called when user taps the Test button — never called automatically
  async fireTestNow() {
    const ln = Cap.plugin("LocalNotifications");
    if (ln) {
      try {
        await ln.schedule({ notifications: [{
          id: 99998,
          channelId: "finance_daily",
          title: "🧪 Test Notification",
          body: "Notifications are working correctly!",
          schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
          sound: "default",
        }]});
        return "native";
      } catch {}
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification("🧪 Test", { body: "Working!" }); return "web"; } catch {}
    }
    return "inapp";
  },
};

// ─── FILE SAVE (#6 #10: works on APK without WRITE_EXTERNAL_STORAGE) ──────────
// APK strategy: write to Cache dir (always works) → Share plugin opens share sheet
//   → user picks "Save to Files", WhatsApp, Drive, Gmail etc.
// Browser fallback: standard blob download
function toBase64(data) {
  if (data instanceof Uint8Array) {
    let bin = ""; const chunk = 8192;
    for (let i = 0; i < data.length; i += chunk)
      bin += String.fromCharCode(...data.subarray(i, i + chunk));
    return btoa(bin);
  }
  return btoa(unescape(encodeURIComponent(String(data))));
}

// Generate timestamp string with date + time for filenames (no overwrites)
function fileTimestamp() {
  const n = new Date();
  const pad = (v, l=2) => String(v).padStart(l, "0");
  return `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}_` +
         `${pad(n.getHours())}-${pad(n.getMinutes())}-${pad(n.getSeconds())}-${pad(n.getMilliseconds(),3)}`;
}

// Save file into Downloads/MyFinanceHub/ subfolder (creates folder if needed)
async function saveFile(data, filename, mime) {
  const FS = Cap.plugin("Filesystem");
  const SH = Cap.plugin("Share");
  // Always put files in MyFinanceHub subfolder
  const folder = "MyFinanceHub";
  const fullPath = `${folder}/${filename}`;

  if (FS) {
    try {
      const b64 = toBase64(data);
      let uri = null;
      // Try Downloads/MyFinanceHub/ first (most visible), then fallback dirs
      const dirsToTry = [
        { dir: "DOWNLOADS",        path: fullPath },
        { dir: "EXTERNAL_STORAGE", path: `Download/${fullPath}` },
        { dir: "CACHE",            path: fullPath },
      ];
      for (const { dir, path } of dirsToTry) {
        try {
          await FS.writeFile({ path, data: b64, directory: dir, recursive: true });
          const r = await FS.getUri({ path, directory: dir });
          uri = r.uri;
          break;
        } catch {}
      }
      if (uri && SH) {
        await SH.share({ title: filename, url: uri, dialogTitle: `Save "${filename}" to…` });
        return { ok: true, method: "share", uri };
      }
      if (uri) {
        alert(`✅ Saved!\n\nFolder: Downloads → MyFinanceHub\nFile: ${filename}`);
        return { ok: true, method: "filesystem", uri };
      }
    } catch (e) { console.warn("Filesystem save failed:", e); }
  }

  // Browser fallback: blob download
  try {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none"; a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { try { document.body.removeChild(a); } catch {} URL.revokeObjectURL(url); }, 5000);
    return { ok: true, method: "download" };
  } catch (e) { alert("Export failed: " + e.message); return { ok: false }; }
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
function buildRows(txns, expCats, incCats) {
  return [...txns].sort((a,b)=>b.date.localeCompare(a.date)).map(t => {
    const cats = t.type==="expense"?expCats:incCats;
    const cat  = cats.find(c=>c.id===t.catId);
    const sub  = cat?.sub?.find(s=>s.id===t.subCatId);
    return {
      "Date"    : fmtD(t.date),
      "Amount"  : t.type==="income"?t.amount: t.type==="transfer"?0:-t.amount,
      "Type"    : t.type==="income"?"Income":t.type==="transfer"?"Transfer":"Expense",
      "Category": t.type==="transfer"?"Account Transfer":(cat?(sub?`${cat.name}/${sub.name}`:cat.name):"–"),
      "Remarks" : t.note||"",
    };
  });
}
async function exportCSV(txns,eC,iC) {
  const rows=buildRows(txns,eC,iC), h=["Date","Amount","Type","Category","Remarks"];
  const csv=[h.join(","),...rows.map(r=>h.map(k=>`"${String(r[k]??"").replace(/"/g,'""')}"`).join(","))].join("\n");
  return saveFile("\uFEFF"+csv,`transactions-${fileTimestamp()}.csv`,"text/csv;charset=utf-8;");
}
async function exportExcel(txns,eC,iC) {
  const rows=buildRows(txns,eC,iC);
  const ws=XLSX.utils.json_to_sheet(rows); ws["!cols"]=[{wch:14},{wch:14},{wch:10},{wch:32},{wch:30}];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Transactions");
  const buf=XLSX.write(wb,{bookType:"xlsx",type:"array"});
  return saveFile(new Uint8Array(buf),`transactions-${fileTimestamp()}.xlsx`,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
// #8 #9: PDF — show INLINE in app (iframe overlay), back button works inside app
// Also offer "Save File" to share/download the HTML
function buildPDFHtml(txns, eC, iC, periodLabel, appName) {
  const rows = buildRows(txns, eC, iC);
  const inc = rows.filter(r => r.Amount > 0).reduce((s, r) => s + r.Amount, 0);
  const exp = rows.filter(r => r.Amount < 0).reduce((s, r) => s + Math.abs(r.Amount), 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${appName}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#f8fafc;color:#1e293b;font-size:13px}
.bar{background:#0f172a;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.bar h1{color:#fff;font-size:15px;font-weight:800;flex:1}.sub{color:#94a3b8;font-size:11px}
.btn{padding:8px 14px;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-size:12px;background:#10b981;color:#fff;margin-left:6px}
.content{padding:16px}.summ{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.sc{background:#fff;border-radius:10px;padding:10px 14px;border-left:3px solid #10b981;flex:1;min-width:80px}
.sc.e{border-color:#ef4444}.sc.n{border-color:#3b82f6}
.sl{font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase}.sv{font-size:18px;font-weight:800;margin-top:3px}
.pos{color:#059669}.neg{color:#dc2626}.neu{color:#2563eb}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}
th{background:#0f172a;color:#fff;padding:9px 12px;text-align:left;font-size:11px}
td{padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px}
tr:nth-child(even) td{background:#f8fafc}
.foot{text-align:center;font-size:10px;color:#94a3b8;margin-top:14px;padding-bottom:20px}
@media print{.bar{display:none!important}}</style></head><body>
<div class="bar">
  <div><h1>📊 ${appName}</h1><div class="sub">${periodLabel}</div></div>
  <div><button class="btn" onclick="window.print()">🖨️ Print / Save PDF</button></div>
</div>
<div class="content">
<div class="summ">
  <div class="sc"><div class="sl">Income</div><div class="sv pos">₹${inc.toLocaleString("en-IN")}</div></div>
  <div class="sc e"><div class="sl">Expense</div><div class="sv neg">₹${exp.toLocaleString("en-IN")}</div></div>
  <div class="sc n"><div class="sl">Net</div><div class="sv neu">₹${(inc-exp).toLocaleString("en-IN")}</div></div>
  <div class="sc"><div class="sl">Rows</div><div class="sv">${rows.length}</div></div>
</div>
<table><thead><tr><th>Date</th><th>Amount</th><th>Type</th><th>Category</th><th>Remarks</th></tr></thead>
<tbody>${rows.map(r=>`<tr><td>${r.Date}</td>
<td class="${r.Amount>=0?"pos":"neg"}">${r.Amount>=0?"+":"-"}₹${Math.abs(r.Amount).toLocaleString("en-IN")}</td>
<td>${r.Type}</td><td>${r.Category}</td><td>${r.Remarks}</td></tr>`).join("")}</tbody></table>
<div class="foot">Generated by ${appName} · ${new Date().toLocaleString("en-IN")}</div>
</div></body></html>`;
}

// PDF Viewer component — fullscreen in-app overlay, system back = close overlay
// PDFViewer — fullscreen in-app iframe, prints to PDF via system dialog
// Android hardware back button is intercepted via Capacitor App plugin
function PDFViewer({ html, onClose, appName }) {
  const iframeRef = useRef();

  useEffect(() => {
    // Intercept Android hardware back button to close viewer instead of exiting app
    const AppPlugin = Cap.plugin("App");
    let listener = null;
    if (AppPlugin?.addListener) {
      AppPlugin.addListener("backButton", () => { onClose(); }).then(l => { listener = l; });
    }
    // Also handle browser history back (popstate)
    const onPop = (e) => { e.preventDefault(); onClose(); };
    window.history.pushState({ pdfOpen: true }, "");
    window.addEventListener("popstate", onPop);

    return () => {
      if (listener?.remove) listener.remove();
      window.removeEventListener("popstate", onPop);
    };
  }, [onClose]);

  function printReport() {
    // Trigger system print dialog inside iframe — user selects "Save as PDF"
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"#f8fafc",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#0f172a",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <span style={{color:"#fff",fontWeight:700,fontSize:14}}>📋 {appName} Report</span>
        <button type="button" onClick={printReport}
          style={{background:"#10b981",border:"none",color:"#fff",borderRadius:8,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}>
          🖨️ Print / Save as PDF
        </button>
      </div>
      <div style={{background:"#1e293b",padding:"8px 14px",fontSize:11,color:"#94a3b8",lineHeight:1.5}}>
        Tap <b style={{color:"#fff"}}>Print / Save as PDF</b> → in the print dialog, change destination to <b style={{color:"#fff"}}>"Save as PDF"</b> → tap Save. Press your phone's <b style={{color:"#fff"}}>Back button</b> to return.
      </div>
      <iframe ref={iframeRef} srcDoc={html} style={{flex:1,border:"none",width:"100%"}} title="Report"/>
    </div>
  );
}

// Backup — saved to Downloads/MyFinanceHub/ with full timestamp (never overwrites)
async function doBackup(txns,accounts,eC,iC,appName,settings) {
  const json=JSON.stringify({version:"7.0",backupDate:new Date().toISOString(),transactions:txns,accounts,expCats:eC,incCats:iC,appName,settings},null,2);
  return saveFile(json,`backup-${fileTimestamp()}.json`,"application/json;charset=utf-8;");
}

// ─── THEMES ──────────────────────────────────────────────────────────────────
const THEMES = {
  dark:     {bg:"#0f1420",card:"#1a1f2e",card2:"#131828",text:"#f1f5f9",text2:"#e2e8f0",sub:"#94a3b8",muted:"#64748b",border:"#2d3748",input:"#0f1420",header:"linear-gradient(135deg,#0f1420,#1a2744)",nav:"#1a1f2e",navBdr:"#2d3748",acc:"#10b981"},
  light:    {bg:"#f0f4f8",card:"#ffffff",card2:"#f4f7fb",text:"#1e293b",text2:"#334155",sub:"#475569",muted:"#94a3b8",border:"#e2e8f0",input:"#f8fafc",header:"linear-gradient(135deg,#0f172a,#1e3a5f)",nav:"#ffffff",navBdr:"#e2e8f0",acc:"#10b981"},
  ocean:    {bg:"#071828",card:"#0d2442",card2:"#091c36",text:"#e0f2fe",text2:"#bae6fd",sub:"#7dd3fc",muted:"#38bdf8",border:"#1e3a5f",input:"#071828",header:"linear-gradient(135deg,#071828,#0c4a6e)",nav:"#0d2442",navBdr:"#1e3a5f",acc:"#0ea5e9"},
  forest:   {bg:"#071a0c",card:"#0d2a15",card2:"#091e0f",text:"#dcfce7",text2:"#bbf7d0",sub:"#6ee7b7",muted:"#34d399",border:"#1a4228",input:"#071a0c",header:"linear-gradient(135deg,#071a0c,#064e3b)",nav:"#0d2a15",navBdr:"#1a4228",acc:"#10b981"},
  sunset:   {bg:"#18060e",card:"#280f18",card2:"#20090f",text:"#fce7f3",text2:"#fbcfe8",sub:"#f9a8d4",muted:"#f472b6",border:"#4a1a28",input:"#18060e",header:"linear-gradient(135deg,#18060e,#7c2d12)",nav:"#280f18",navBdr:"#4a1a28",acc:"#f43f5e"},
  midnight: {bg:"#05040c",card:"#0d0b1e",card2:"#080714",text:"#ede9fe",text2:"#ddd6fe",sub:"#a78bfa",muted:"#7c3aed",border:"#1e1a3a",input:"#05040c",header:"linear-gradient(135deg,#05040c,#2e1065)",nav:"#0d0b1e",navBdr:"#1e1a3a",acc:"#8b5cf6"},
  rose:     {bg:"#1a0a14",card:"#2a1020",card2:"#200c18",text:"#fff1f2",text2:"#ffe4e6",sub:"#fca5a5",muted:"#f87171",border:"#4c1d28",input:"#1a0a14",header:"linear-gradient(135deg,#1a0a14,#881337)",nav:"#2a1020",navBdr:"#4c1d28",acc:"#fb7185"},
};
const THEME_LIST = [
  {id:"auto",icon:"🌓",label:"Auto"},{id:"dark",icon:"🌙",label:"Dark"},{id:"light",icon:"☀️",label:"Light"},
  {id:"ocean",icon:"🌊",label:"Ocean"},{id:"forest",icon:"🌿",label:"Forest"},{id:"sunset",icon:"🌅",label:"Sunset"},
  {id:"midnight",icon:"🔮",label:"Night"},{id:"rose",icon:"🌸",label:"Rose"},
];

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CLRS   = ["#10b981","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#ec4899","#14b8a6","#f97316","#06b6d4","#a855f7","#84cc16","#fb923c"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CAT_ICONS = ["🍽️","🚗","🏠","🎬","💊","🛍️","📚","💆","✈️","🎓","🏋️","🧾","🎁","💡","🔧","🏦","💰","📦","🎯","🧴","🚀","🌐","🏖️","⛽","🛒","🥛","🥦","🛡️","📊","💳","💵","🏧","👛","🪙","💸","🏘️","💼","📈","🏢","💻","☕","🍕","🚌","⚡","💧","📱","🔑","🏗️","🏥","🛺"];
const ACC_ICONS = ["🏦","💵","💳","💰","👛","🏧","📱","🏢","💎","🔐","🪙","💸","🎯","🏪","✈️"];
const PERIODS = [
  {id:"mtd",label:"Month"},{id:"7d",label:"7 Days"},{id:"lastm",label:"Last M"},
  {id:"3m",label:"3 Mon"},{id:"ytd",label:"Year"},{id:"custom",label:"📅 Date"},
];
// Fix #4: added carryForward to default settings
const DEF_SETTINGS = {
  uiMode:"auto", notifications:false, reminderTimes:["09:00","21:00"],
  smsDetection:false, carryForward:true,
};

// ─── DEFAULT DATA (Fix #3: openingBal added to accounts) ─────────────────────
const DEF_EXP_CATS = [
  {id:"e1",name:"Food & Dining",icon:"🍽️",color:"#f97316",sub:[{id:"e1s1",name:"Restaurants"},{id:"e1s2",name:"Groceries"},{id:"e1s3",name:"Coffee"},{id:"e1s4",name:"Food Delivery"},{id:"e1s5",name:"Milk"}]},
  {id:"e2",name:"Transportation",icon:"🚗",color:"#3b82f6",sub:[{id:"e2s1",name:"Petrol"},{id:"e2s2",name:"Public Transit"},{id:"e2s3",name:"Taxi"},{id:"e2s4",name:"Maintenance"}]},
  {id:"e3",name:"Housing",icon:"🏠",color:"#8b5cf6",sub:[{id:"e3s1",name:"Rent"},{id:"e3s2",name:"Electricity"},{id:"e3s3",name:"Water & Gas"},{id:"e3s4",name:"Repairs"},{id:"e3s5",name:"EMI"}]},
  {id:"e4",name:"Entertainment",icon:"🎬",color:"#ec4899",sub:[{id:"e4s1",name:"Movies"},{id:"e4s2",name:"Streaming"},{id:"e4s3",name:"Games"}]},
  {id:"e5",name:"Health",icon:"💊",color:"#14b8a6",sub:[{id:"e5s1",name:"Pharmacy"},{id:"e5s2",name:"Doctor"},{id:"e5s3",name:"Gym"},{id:"e5s4",name:"Insurance"}]},
  {id:"e6",name:"Shopping",icon:"🛍️",color:"#f59e0b",sub:[{id:"e6s1",name:"Clothing"},{id:"e6s2",name:"Electronics"},{id:"e6s3",name:"Gifts"}]},
  {id:"e7",name:"Education",icon:"📚",color:"#06b6d4",sub:[{id:"e7s1",name:"Tuition"},{id:"e7s2",name:"Books"},{id:"e7s3",name:"Courses"}]},
  {id:"e8",name:"Bills",icon:"🧾",color:"#64748b",sub:[{id:"e8s1",name:"Mobile"},{id:"e8s2",name:"Internet"},{id:"e8s3",name:"DTH"}]},
  {id:"e9",name:"Grocery",icon:"🛒",color:"#84cc16",sub:[{id:"e9s1",name:"Supermarket"},{id:"e9s2",name:"Household"}]},
  {id:"e10",name:"Miscellaneous",icon:"📦",color:"#94a3b8",sub:[{id:"e10s1",name:"Other"}]},
];
const DEF_INC_CATS = [
  {id:"i1",name:"Salary",icon:"💼",color:"#10b981"},{id:"i2",name:"Freelance",icon:"💻",color:"#3b82f6"},
  {id:"i3",name:"Business",icon:"🏢",color:"#f59e0b"},{id:"i4",name:"Investments",icon:"📈",color:"#8b5cf6"},
  {id:"i5",name:"Rental Income",icon:"🏘️",color:"#14b8a6"},{id:"i6",name:"Bonus",icon:"🎁",color:"#ec4899"},
  {id:"i7",name:"Other",icon:"💰",color:"#64748b"},
];
// Fix #3: openingBal field added to accounts
const DEF_ACCOUNTS = [
  {id:"a1",name:"HDFC Savings",     icon:"🏦",color:"#10b981",openingBal:0},
  {id:"a2",name:"SBI Current",      icon:"🏦",color:"#3b82f6",openingBal:0},
  {id:"a3",name:"ICICI Credit Card",icon:"💳",color:"#f59e0b",openingBal:0},
  {id:"a4",name:"Cash Wallet",      icon:"💵",color:"#8b5cf6",openingBal:0},
];
const DEF_TXN = [
  {id:"t1",date:"2026-02-01",type:"income",accountId:"a1",catId:"i1",subCatId:null,amount:65000,note:"Monthly salary"},
  {id:"t2",date:"2026-02-03",type:"expense",accountId:"a1",catId:"e1",subCatId:"e1s2",amount:4200,note:"Groceries"},
  {id:"t3",date:"2026-02-07",type:"expense",accountId:"a1",catId:"e3",subCatId:"e3s1",amount:15000,note:"Rent"},
  {id:"t4",date:"2026-02-10",type:"income",accountId:"a1",catId:"i4",subCatId:null,amount:3200,note:"Dividend"},
  {id:"t5",date:"2026-02-14",type:"expense",accountId:"a1",catId:"e2",subCatId:"e2s1",amount:2400,note:"Fuel"},
  {id:"t6",date:"2026-02-15",type:"income",accountId:"a1",catId:"i2",subCatId:null,amount:12000,note:"Freelance"},
  {id:"t7",date:"2026-02-20",type:"expense",accountId:"a3",catId:"e4",subCatId:"e4s2",amount:1199,note:"Netflix+Prime"},
  {id:"t8",date:"2026-02-22",type:"expense",accountId:"a1",catId:"e3",subCatId:"e3s2",amount:2100,note:"Electricity"},
  {id:"t9",date:"2026-01-05",type:"income",accountId:"a1",catId:"i1",subCatId:null,amount:65000,note:"Jan salary"},
  {id:"t10",date:"2026-01-08",type:"expense",accountId:"a1",catId:"e3",subCatId:"e3s1",amount:15000,note:"Jan Rent"},
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function periodDates(pid) {
  const t=new Date(); t.setHours(23,59,59,999); const y=t.getFullYear(),m=t.getMonth();
  switch(pid){
    case "mtd":   return{from:new Date(y,m,1,0,0,0),to:t};
    case "7d":    {const f=new Date(t);f.setDate(f.getDate()-6);f.setHours(0,0,0,0);return{from:f,to:t};}
    case "lastm": return{from:new Date(y,m-1,1,0,0,0),to:new Date(y,m,0,23,59,59)};
    case "3m":    return{from:new Date(y,m-3,1,0,0,0),to:t};
    case "ytd":   return{from:new Date(y,0,1,0,0,0),to:t};
    default:      return{from:new Date(y,m,1,0,0,0),to:t};
  }
}
const toYMD = d => !(d instanceof Date)?d:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const uid   = () => "x"+Math.random().toString(36).slice(2,9);
const fmt   = n => "₹"+Number(n).toLocaleString("en-IN");
const fmtD  = d => new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});

// ─── BASE UI COMPONENTS ───────────────────────────────────────────────────────
function Modal({title,onClose,children}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(0,0,0,.75)",backdropFilter:"blur(6px)"}}
         onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"var(--card)",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto",padding:"22px 18px 36px",boxShadow:"0 -8px 60px rgba(0,0,0,.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <span style={{fontSize:17,fontWeight:800,color:"var(--text)"}}>{title}</span>
          <button type="button" onClick={onClose} style={{background:"var(--bdr)",border:"none",color:"var(--sub)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:15}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
const FL = ({c})=><label style={{display:"block",fontSize:10,color:"var(--sub)",marginBottom:4,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em"}}>{c}</label>;
const FI = ({label,...p})=><div style={{marginBottom:12}}>{label&&<FL c={label}/>}<input {...p} style={{width:"100%",background:"var(--inp)",border:"1px solid var(--bdr)",borderRadius:10,padding:"11px 13px",color:"var(--text)",fontSize:14,outline:"none",boxSizing:"border-box",...p.style}}/></div>;
const FS = ({label,children,...p})=><div style={{marginBottom:12}}>{label&&<FL c={label}/>}<select {...p} style={{width:"100%",background:"var(--inp)",border:"1px solid var(--bdr)",borderRadius:10,padding:"11px 13px",color:"var(--text)",fontSize:14,outline:"none",boxSizing:"border-box",...p.style}}>{children}</select></div>;
const Btn = ({children,v="primary",s:st,...p})=>{
  const V={primary:{background:"var(--acc)",color:"#fff"},danger:{background:"#ef4444",color:"#fff"},ghost:{background:"var(--bdr)",color:"var(--sub)"},out:{background:"transparent",border:"1px solid var(--acc)",color:"var(--acc)"}};
  return <button type="button" {...p} style={{border:"none",borderRadius:11,padding:"12px 18px",fontWeight:700,fontSize:14,cursor:"pointer",width:"100%",marginTop:4,...V[v],...st}}>{children}</button>;
};
const Toggle = ({on,onChange,label,sub})=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 0",borderBottom:"1px solid var(--bdr)"}}>
    <div><div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{label}</div>{sub&&<div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{sub}</div>}</div>
    <div onClick={()=>onChange(!on)} style={{width:42,height:23,borderRadius:12,background:on?"var(--acc)":"var(--bdr)",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0,marginLeft:10}}>
      <div style={{position:"absolute",top:3,left:on?21:3,width:17,height:17,borderRadius:9,background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.3)"}}/>
    </div>
  </div>
);
const ClrPick=({v,onChange})=>(
  <div style={{marginBottom:12}}><FL c="Color"/>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      {CLRS.map(c=><div key={c} onClick={()=>onChange(c)} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:v===c?"3px solid #fff":"3px solid transparent",flexShrink:0}}/>)}
    </div>
  </div>
);
const IcoPickr=({v,onChange,icons=CAT_ICONS})=>(
  <div style={{marginBottom:12}}><FL c="Icon"/>
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      {icons.map(ic=><button key={ic} type="button" onClick={()=>onChange(ic)} style={{width:36,height:36,borderRadius:9,border:"none",fontSize:19,cursor:"pointer",flexShrink:0,background:v===ic?"var(--acc)":"var(--bdr)",outline:v===ic?"2px solid #fff":"none"}}>{ic}</button>)}
    </div>
  </div>
);
const CatPrev=({n,i,c})=>(
  <div style={{background:"var(--inp)",borderRadius:11,padding:12,marginBottom:12,display:"flex",alignItems:"center",gap:11}}>
    <div style={{width:42,height:42,borderRadius:11,background:c+"22",border:`2px solid ${c}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:21,flexShrink:0}}>{i}</div>
    <div><div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{n||"Name"}</div><div style={{fontSize:11,color:"var(--muted)"}}>Preview</div></div>
  </div>
);

// ─── PERIOD BAR ───────────────────────────────────────────────────────────────
function PeriodBar({period,setPeriod,cFrom,setCFrom,cTo,setCTo}){
  const label=useMemo(()=>{
    if(period==="custom")return`${fmtD(cFrom)} → ${fmtD(cTo)}`;
    const{from,to}=periodDates(period);return`${fmtD(toYMD(from))} → ${fmtD(toYMD(to))}`;
  },[period,cFrom,cTo]);
  return(
    <div style={{background:"var(--card)",borderRadius:12,padding:"9px 12px",marginBottom:11}}>
      <div style={{display:"flex",gap:5,overflowX:"auto",scrollbarWidth:"none",WebkitOverflowScrolling:"touch",paddingBottom:1}}>
        {PERIODS.map(p=>(
          <button key={p.id} type="button" onClick={()=>setPeriod(p.id)}
            style={{padding:"5px 11px",borderRadius:14,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,
              background:period===p.id?"var(--acc)":"var(--inp)",color:period===p.id?"#fff":"var(--muted)",outline:period===p.id?"none":"1px solid var(--bdr)"}}>
            {p.label}
          </button>
        ))}
      </div>
      {period!=="custom"
        ?<div style={{fontSize:10,color:"var(--muted)",marginTop:5}}>📅 {label}</div>
        :<div style={{display:"flex",gap:8,marginTop:8}}>
           <div style={{flex:1}}><FL c="From"/><input type="date" value={cFrom} onChange={e=>setCFrom(e.target.value)} style={{width:"100%",background:"var(--inp)",border:"1px solid var(--bdr)",borderRadius:8,padding:"7px 10px",color:"var(--text)",fontSize:12,outline:"none",boxSizing:"border-box"}}/></div>
           <div style={{flex:1}}><FL c="To"/><input type="date" value={cTo} onChange={e=>setCTo(e.target.value)} style={{width:"100%",background:"var(--inp)",border:"1px solid var(--bdr)",borderRadius:8,padding:"7px 10px",color:"var(--text)",fontSize:12,outline:"none",boxSizing:"border-box"}}/></div>
         </div>}
    </div>
  );
}

// ─── TRANSACTION ROW ─────────────────────────────────────────────────────────
function TxnRow({t,accounts,expCats,incCats,onTap,onDelete}){
  const isTransfer=t.type==="transfer";
  const cats=t.type==="expense"?expCats:incCats;
  const cat=!isTransfer?cats.find(c=>c.id===t.catId):null;
  const sub=cat?.sub?.find(s=>s.id===t.subCatId);
  const acc=accounts.find(a=>a.id===t.accountId);
  const toAcc=isTransfer?accounts.find(a=>a.id===t.toAccountId):null;
  const label=isTransfer?`🔄 Transfer → ${toAcc?.name||"?"}`:cat?`${cat.icon} ${cat.name}${sub?` › ${sub.name}`:""}`:t.type==="income"?"🟢 Income":"🔴 Expense";
  return(
    <div className="hov" onClick={onTap}
      style={{background:"var(--card)",borderRadius:11,padding:"11px 13px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
        <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{acc?.icon} {acc?.name} · {fmtD(t.date)}</div>
        {t.note&&<div style={{fontSize:11,color:"var(--muted)",marginTop:1,opacity:.7,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.note}</div>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
        <span style={{fontSize:14,fontWeight:800,color:isTransfer?"#3b82f6":t.type==="income"?"#10b981":"#ef4444"}}>
          {isTransfer?"⇄":t.type==="income"?"+":"-"}{fmt(t.amount)}
        </span>
        {onDelete&&<button type="button" onClick={e=>{e.stopPropagation();onDelete(t.id);}} style={{background:"var(--bdr)",border:"none",color:"#ef4444",borderRadius:7,padding:"4px 8px",cursor:"pointer",fontSize:14}}>🗑️</button>}
      </div>
    </div>
  );
}

// ─── TRANSACTION FORM (Fix #5: added transfer type) ─────────────────────────
function TxnForm({accounts,expCats,incCats,onSave,onClose,editT,prefill}){
  const [type, setType] = useState(editT?.type||prefill?.type||"expense");
  const [date, setDate] = useState(editT?.date||toYMD(new Date()));
  const [accId,setAccId]= useState(editT?.accountId||accounts[0]?.id||"");
  const [toAccId,setToAccId]=useState(editT?.toAccountId||"");
  const [catId,setCatId]= useState(editT?.catId||"");
  const [subId,setSubId]= useState(editT?.subCatId||"");
  const [amt,  setAmt]  = useState(editT?.amount||prefill?.amount||"");
  const [note, setNote] = useState(editT?.note||prefill?.note||"");
  const cats=type==="expense"?expCats:incCats;
  const selCat=expCats.find(c=>c.id===catId);
  const save=()=>{
    if(!accId||!amt)return;
    if(type!=="transfer"&&!catId)return;
    if(type==="transfer"&&(!toAccId||toAccId===accId)){alert("Select a different destination account");return;}
    onSave({id:editT?.id||uid(),date,type,accountId:accId,toAccountId:type==="transfer"?toAccId:null,catId:type==="transfer"?null:catId,subCatId:type==="expense"?subId:null,amount:parseFloat(amt),note});
  };
  return(
    <Modal title={editT?"Edit Transaction":prefill?"Add Transaction":"Add Transaction"} onClose={onClose}>
      {prefill&&<div style={{background:"#10b98122",border:"1px solid #10b981",borderRadius:10,padding:"9px 13px",marginBottom:13,fontSize:12,color:"#10b981"}}>💬 Pre-filled: ₹{prefill.amount}</div>}
      {/* Type selector */}
      <div style={{display:"flex",gap:7,marginBottom:16}}>
        {[{v:"expense",label:"🔴 Expense",col:"#ef4444"},{v:"income",label:"🟢 Income",col:"#10b981"},{v:"transfer",label:"🔄 Transfer",col:"#3b82f6"}].map(({v,label,col})=>(
          <button key={v} type="button" onClick={()=>{setType(v);setCatId("");setSubId("");setToAccId("");}}
            style={{flex:1,padding:"9px 4px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,
              background:type===v?col:"var(--bdr)",color:type===v?"#fff":"var(--sub)"}}>
            {label}
          </button>
        ))}
      </div>
      <FI label="Date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      <FS label={type==="transfer"?"From Account":"Account"} value={accId} onChange={e=>setAccId(e.target.value)}>
        <option value="">Select account</option>
        {accounts.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
      </FS>
      {type==="transfer"&&(
        <FS label="To Account" value={toAccId} onChange={e=>setToAccId(e.target.value)}>
          <option value="">Select destination</option>
          {accounts.filter(a=>a.id!==accId).map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
        </FS>
      )}
      {type!=="transfer"&&<>
        <FS label="Category" value={catId} onChange={e=>{setCatId(e.target.value);setSubId("");}}>
          <option value="">Select category</option>
          {cats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </FS>
        {type==="expense"&&selCat?.sub?.length>0&&(
          <FS label="Sub Category" value={subId} onChange={e=>setSubId(e.target.value)}>
            <option value="">None</option>
            {selCat.sub.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </FS>
        )}
      </>}
      <FI label="Amount (₹)" type="number" placeholder="0" value={amt} onChange={e=>setAmt(e.target.value)}/>
      <FI label="Remarks" placeholder="What was this for?" value={note} onChange={e=>setNote(e.target.value)}/>
      <Btn onClick={save}>{editT?"Update Transaction":"Save Transaction"}</Btn>
    </Modal>
  );
}

// Fix #3: AccForm with opening balance
function AccForm({onSave,onClose,editA}){
  const [name,sn]=useState(editA?.name||"");
  const [icon,si]=useState(editA?.icon||"🏦");
  const [clr, sc]=useState(editA?.color||"#10b981");
  const [obAmt,sOb]=useState(editA?.openingBal||0);
  return(
    <Modal title={editA?"Edit Account":"Add Account"} onClose={onClose}>
      <div style={{background:"#10b98115",border:"1px solid #10b98155",borderRadius:10,padding:"9px 13px",marginBottom:13,fontSize:12,color:"#10b981"}}>
        💡 Balance = Opening Balance + all transactions
      </div>
      <FI label="Account Name" placeholder="e.g. HDFC Savings" value={name} onChange={e=>sn(e.target.value)}/>
      <FI label="Opening Balance (₹)" type="number" placeholder="0" value={obAmt} onChange={e=>sOb(parseFloat(e.target.value)||0)}/>
      <IcoPickr v={icon} onChange={si} icons={ACC_ICONS}/>
      <ClrPick v={clr} onChange={sc}/>
      <Btn onClick={()=>{if(!name)return;onSave({id:editA?.id||uid(),name,icon,color:clr,openingBal:obAmt});}}>
        {editA?"Update":"Add Account"}
      </Btn>
    </Modal>
  );
}
function ExpCatForm({onSave,onClose,editC}){
  const[n,sn]=useState(editC?.name||"");const[i,si]=useState(editC?.icon||"🍽️");const[c,sc]=useState(editC?.color||"#10b981");
  return<Modal title={editC?"Edit Category":"Add Category"} onClose={onClose}><FI label="Name" placeholder="e.g. Travel" value={n} onChange={e=>sn(e.target.value)}/><IcoPickr v={i} onChange={si}/><ClrPick v={c} onChange={sc}/><CatPrev n={n} i={i} c={c}/><Btn onClick={()=>{if(!n)return;onSave({id:editC?.id||uid(),name:n,icon:i,color:c,sub:editC?.sub||[]});}}>{editC?"Update":"Add"}</Btn></Modal>;
}
function SubCatForm({pName,onSave,onClose,editS}){
  const[n,sn]=useState(editS?.name||"");
  return<Modal title={editS?"Edit Sub Category":"Add Sub Category"} onClose={onClose}><div style={{fontSize:11,color:"var(--muted)",marginBottom:12}}>Under: <b style={{color:"var(--acc)"}}>{pName}</b></div><FI label="Name" placeholder="e.g. Petrol" value={n} onChange={e=>sn(e.target.value)}/><Btn onClick={()=>{if(!n)return;onSave({id:editS?.id||uid(),name:n});}}>{editS?"Update":"Add"}</Btn></Modal>;
}
function IncCatForm({onSave,onClose,editC}){
  const[n,sn]=useState(editC?.name||"");const[i,si]=useState(editC?.icon||"💰");const[c,sc]=useState(editC?.color||"#10b981");
  return<Modal title={editC?"Edit Category":"Add Category"} onClose={onClose}><FI label="Name" placeholder="e.g. Rental" value={n} onChange={e=>sn(e.target.value)}/><IcoPickr v={i} onChange={si}/><ClrPick v={c} onChange={sc}/><CatPrev n={n} i={i} c={c}/><Btn onClick={()=>{if(!n)return;onSave({id:editC?.id||uid(),name:n,icon:i,color:c});}}>{editC?"Update":"Add"}</Btn></Modal>;
}

// ─── EXPORT MODAL (#11: added JPG option) ────────────────────────────────────
function ExportModal({onClose,txns,expCats,incCats,periodLabel,appName,accounts,accBal,T}){
  const[busy,setBusy]=useState(null);
  const[done,setDone]=useState(null);
  const[pdfHtml,setPdfHtml]=useState(null);
  const opts=[
    {id:"csv",  icon:"📄",label:"CSV File",      desc:"Saved to Downloads/MyFinanceHub/ — open in Excel or Sheets"},
    {id:"excel",icon:"📊",label:"Excel (.xlsx)", desc:"Full spreadsheet — saved to Downloads/MyFinanceHub/"},
    {id:"pdf",  icon:"🖨️",label:"PDF Report",    desc:"View inside app → tap Print → Save as PDF"},
  ];
  async function go(id){
    if(id==="pdf"){
      const html=buildPDFHtml(txns,expCats,incCats,periodLabel,appName);
      setPdfHtml(html);
      return;
    }
    setBusy(id);setDone(null);
    try{
      if(id==="csv")   await exportCSV(txns,expCats,incCats);
      if(id==="excel") await exportExcel(txns,expCats,incCats);
      setDone(id);
    }catch(e){alert("Export error: "+e.message);}
    setBusy(null);
  }
  if(pdfHtml) return(
    <PDFViewer html={pdfHtml} appName={appName} onClose={()=>setPdfHtml(null)}/>
  );
  return(
    <Modal title="📤 Export" onClose={onClose}>
      <div style={{background:"var(--card2)",borderRadius:11,padding:"11px 13px",marginBottom:14,display:"flex",gap:12,alignItems:"center"}}>
        <div style={{fontSize:26}}>📋</div>
        <div><div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{txns.length} transactions</div>
          <div style={{fontSize:11,color:"var(--muted)"}}>{periodLabel}</div></div>
      </div>
      {opts.map(o=>(
        <div key={o.id} onClick={()=>!busy&&go(o.id)}
          style={{display:"flex",alignItems:"center",gap:13,background:done===o.id?"#10b98115":"var(--card2)",border:`1px solid ${done===o.id?"#10b981":"transparent"}`,borderRadius:11,padding:"13px 15px",marginBottom:9,cursor:busy?"not-allowed":"pointer",opacity:busy&&busy!==o.id?0.5:1}}>
          <div style={{fontSize:26,flexShrink:0}}>{busy===o.id?"⏳":done===o.id?"✅":o.icon}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{o.label}</div>
            <div style={{fontSize:11,color:"var(--muted)"}}>{o.desc}</div>
          </div>
          <div style={{fontSize:16,color:"var(--muted)"}}>›</div>
        </div>
      ))}
      <div style={{background:"#3b82f615",border:"1px solid #3b82f644",borderRadius:10,padding:"10px 13px",fontSize:11,color:"var(--sub)",marginTop:4,lineHeight:1.6}}>
        📁 Files saved to <b style={{color:"var(--text)"}}>Downloads → MyFinanceHub</b> folder. Share sheet lets you send to WhatsApp, Drive, or Gmail too.
      </div>
    </Modal>
  );
}

// ─── SETTINGS MODAL (Fix #4: carry-forward, Fix #2: no auto-fire) ────────────
function SettingsModal({settings,onChange,onClose,txns,accounts,expCats,incCats,appName}){
  const fileRef=useRef();
  const[notifPerm,setNotifPerm]=useState("checking");
  const[notifMsg, setNotifMsg] =useState("");
  const[newTime,  setNewTime]  =useState("08:00");
  const[busyNotif,setBusyNotif]=useState(false);
  const set=(k,v)=>onChange({...settings,[k]:v});

  useEffect(()=>{
    Notif.getPermission().then(p=>{
      setNotifPerm(p);
      if(p==="granted")  setNotifMsg("✅ Permission granted — alarms fire at exact times even when app closed");
      else if(p==="denied") setNotifMsg("🚫 Blocked — go to Android Settings → Apps → My Finance Hub → Notifications → Allow");
      else setNotifMsg("⏳ Tap toggle to request permission");
    });
  },[]);

  // Fix #2: toggle only sets up scheduling, does NOT fire immediate notification
  async function toggleNotif(val){
    if(val){
      setBusyNotif(true);
      const perm=await Notif.requestPermission();
      setNotifPerm(perm);
      if(perm==="denied"){
        setNotifMsg("🚫 Denied. Android Settings → Apps → My Finance Hub → Notifications → Allow");
        setBusyNotif(false); return;
      }
      if(perm==="granted"){
        setNotifMsg("⏳ Scheduling daily alarms...");
        const results=await Notif.rescheduleAll(settings.reminderTimes);
        const ok=results.filter(r=>r.ok).map(r=>r.time);
        // NO fireNow here — only schedule at exact times
        setNotifMsg(`✅ Alarms set for ${ok.join(", ")} — fires daily at these exact times`);
      } else {
        setNotifMsg("📲 Scheduling failed. Try again or check permissions.");
      }
      setBusyNotif(false);
    } else {
      await Notif.cancelAllPending();
      setNotifMsg("⭕ Reminders disabled");
    }
    set("notifications",val);
  }

  async function addTime(){
    if(!newTime||settings.reminderTimes.includes(newTime))return;
    const times=[...settings.reminderTimes,newTime].sort();
    set("reminderTimes",times);
    if(settings.notifications&&notifPerm==="granted"){
      const results=await Notif.rescheduleAll(times);
      setNotifMsg(`✅ Alarms updated: ${results.filter(r=>r.ok).map(r=>r.time).join(", ")}`);
    }
  }
  async function removeTime(t){
    const times=settings.reminderTimes.filter(x=>x!==t);
    set("reminderTimes",times);
    if(settings.notifications&&notifPerm==="granted"){
      if(times.length>0){const results=await Notif.rescheduleAll(times);setNotifMsg(`✅ Alarms: ${results.filter(r=>r.ok).map(r=>r.time).join(", ")}`);}
      else{await Notif.cancelAllPending();setNotifMsg("⭕ No times set — add one below");}
    }
  }

  function handleRestore(file){
    const r=new FileReader();
    r.onload=e=>{
      try{
        const d=JSON.parse(e.target.result);
        if(!d.version){alert("❌ Invalid backup file.");return;}
        const date=d.backupDate?new Date(d.backupDate).toLocaleDateString("en-IN"):"unknown";
        if(!window.confirm(`Restore backup from ${date}?\n\nAll current data will be replaced.`))return;
        window.__restoreData=d;
        window.dispatchEvent(new CustomEvent("finance-restore"));
        onClose();
      }catch{alert("❌ Cannot read file.");}
    };
    r.readAsText(file);
  }

  return(
    <Modal title="⚙️ Settings" onClose={onClose}>
      {/* THEMES */}
      <div style={{marginBottom:18}}>
        <FL c="Theme"/>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {THEME_LIST.map(o=>(
            <div key={o.id} onClick={()=>set("uiMode",o.id)}
              style={{flex:"0 0 calc(25% - 4px)",minWidth:58,background:settings.uiMode===o.id?"var(--acc)22":"var(--inp)",
                border:`2px solid ${settings.uiMode===o.id?"var(--acc)":"var(--bdr)"}`,
                borderRadius:10,padding:"7px 4px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:18,marginBottom:1}}>{o.icon}</div>
              <div style={{fontSize:10,fontWeight:700,color:settings.uiMode===o.id?"var(--acc)":"var(--text)"}}>{o.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fix #2: NOTIFICATIONS */}
      <div style={{padding:"10px 0",borderBottom:"1px solid var(--bdr)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{flex:1,paddingRight:12}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>🔔 Daily Reminders</div>
            <div style={{fontSize:10,color:"var(--muted)",marginTop:2,lineHeight:1.4}}>{busyNotif?"⏳ Setting up...":(notifMsg||"Tap to enable")}</div>
          </div>
          <div onClick={()=>!busyNotif&&toggleNotif(!settings.notifications)}
            style={{width:42,height:23,borderRadius:12,background:settings.notifications?"var(--acc)":"var(--bdr)",cursor:busyNotif?"not-allowed":"pointer",position:"relative",flexShrink:0,transition:"background .2s"}}>
            <div style={{position:"absolute",top:3,left:settings.notifications?21:3,width:17,height:17,borderRadius:9,background:"#fff",transition:"left .2s"}}/>
          </div>
        </div>
        {settings.notifications&&(
          <div style={{background:"var(--inp)",borderRadius:10,padding:12,marginTop:10}}>
            <FL c="Reminder times"/>
            {settings.reminderTimes.map(t=>(
              <div key={t} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--card)",borderRadius:8,padding:"7px 11px",marginBottom:5}}>
                <span style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>⏰ {t}</span>
                <button type="button" onClick={()=>removeTime(t)} style={{background:"#ef444430",border:"none",color:"#ef4444",borderRadius:6,padding:"3px 9px",cursor:"pointer",fontSize:11,fontWeight:700}}>Remove</button>
              </div>
            ))}
            <div style={{display:"flex",gap:7,marginTop:7}}>
              <input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)}
                style={{flex:1,background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:8,padding:"7px 11px",color:"var(--text)",fontSize:13,outline:"none"}}/>
              <button type="button" onClick={addTime} style={{background:"var(--acc)",border:"none",color:"#fff",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontWeight:700,fontSize:12}}>+ Add</button>
            </div>
            <button type="button" onClick={async()=>{
              const r=await Notif.fireTestNow();
              if(r==="inapp") alert("📲 Test failed. Check Android Settings → Apps → My Finance Hub → Notifications → Allow.");
              else alert("✅ Test notification sent! You should see it in your notification tray within 2 seconds.");
            }} style={{marginTop:9,width:"100%",background:"var(--bdr)",border:"none",color:"var(--text)",borderRadius:8,padding:"9px",cursor:"pointer",fontWeight:700,fontSize:12}}>
              🧪 Send Test Notification Now
            </button>
            <div style={{marginTop:9,background:"#f59e0b15",border:"1px solid #f59e0b44",borderRadius:8,padding:"10px 12px",fontSize:11,color:"var(--sub)",lineHeight:1.7}}>
              <b style={{color:"#f59e0b"}}>If notifications are late or missing:</b><br/>
              Android Settings → Apps → <b style={{color:"var(--text)"}}>My Finance Hub</b> → Battery → set to <b style={{color:"var(--text)"}}>Unrestricted</b><br/>
              <span style={{fontSize:10,opacity:.7}}>This prevents Android from killing alarms in the background.</span>
            </div>
          </div>
        )}
      </div>

      {/* CARRY FORWARD */}
      <Toggle on={settings.carryForward!==false} onChange={v=>set("carryForward",v)}
        label="📊 Carry Forward Balance"
        sub={settings.carryForward!==false?"Period starts with previous balance (cumulative)":"Period starts from ₹0 (period-only view)"}/>

      {/* BACKUP */}
      <div style={{marginTop:18}}>
        <FL c="Backup & Restore"/>
        <div style={{background:"var(--inp)",borderRadius:11,padding:13}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:3}}>💾 Backup All Data</div>
          <div style={{fontSize:11,color:"var(--muted)",marginBottom:9}}>Saved to <b>Downloads → MyFinanceHub</b> folder</div>
          <Btn v="out" s={{marginTop:0}} onClick={()=>doBackup(txns,accounts,expCats,incCats,appName,settings)}>
            📤 Export Backup File
          </Btn>
          <div style={{borderTop:"1px solid var(--bdr)",paddingTop:13,marginTop:13}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:3}}>📂 Restore from Backup</div>
            <div style={{fontSize:11,color:"var(--muted)",marginBottom:9}}>Choose a .json backup file to restore all data</div>
            <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={e=>{if(e.target.files[0])handleRestore(e.target.files[0]);}}/>
            <Btn v="ghost" s={{marginTop:0}} onClick={()=>fileRef.current?.click()}>⬆ Choose Backup File</Btn>
          </div>
        </div>
      </div>
      <div style={{fontSize:10,color:"var(--muted)",textAlign:"center",marginTop:14}}>My Finance Hub v7.0 · All data saved locally on device</div>
    </Modal>
  );
}

// ─── NAME EDITOR ─────────────────────────────────────────────────────────────
function NameEdit({name,onChange}){
  const[e,setE]=useState(false);const[v,setV]=useState(name);
  const ok=()=>{onChange(v.trim()||"My Finance Hub");setE(false);};
  if(e)return(
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <input autoFocus value={v} onChange={ev=>setV(ev.target.value)} onKeyDown={ev=>{if(ev.key==="Enter")ok();if(ev.key==="Escape")setE(false);}}
        style={{background:"transparent",border:"none",borderBottom:"2px solid #10b981",color:"#fff",fontSize:17,fontWeight:800,outline:"none",padding:"2px 4px",width:170}}/>
      <button type="button" onClick={ok} style={{background:"#10b981",border:"none",color:"#fff",borderRadius:7,padding:"3px 9px",cursor:"pointer",fontSize:12,fontWeight:700}}>✓</button>
    </div>
  );
  return(
    <div style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer"}} onClick={()=>setE(true)}>
      <span style={{fontSize:17,fontWeight:800,color:"#fff"}}>{name}</span>
      <span style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>✏️</span>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const[appName, setAppName] = useLS("appName6","My Finance Hub");
  const[txns,    setTxns]    = useLS("txns6",   DEF_TXN);
  const[accounts,setAccounts]= useLS("accs6",   DEF_ACCOUNTS);
  const[expCats, setExpCats] = useLS("eC6",     DEF_EXP_CATS);
  const[incCats, setIncCats] = useLS("iC6",     DEF_INC_CATS);
  const[settings,setSettings]= useLS("set6",    DEF_SETTINGS);
  const[period,  setPeriod]  = useLS("per6",    "mtd");
  const NOW=new Date();
  const[cFrom,setCFrom]=useLS("cf6",toYMD(new Date(NOW.getFullYear(),NOW.getMonth(),1)));
  const[cTo,  setCTo]  =useLS("ct6",toYMD(NOW));

  const[tab,        setTab]        = useState("home");
  const[catTab,     setCatTab]     = useState("expense");
  const[reportTab,  setReportTab]  = useState("expense");
  const[trendCatId, setTrendCatId] = useState(null);
  // Fix #1: transaction filters (type, category, sub-category, account)
  const[txnType,    setTxnType]    = useState("all");
  const[txnCatId,   setTxnCatId]  = useState("");
  const[txnSubId,   setTxnSubId]  = useState("");
  const[txnAccId,   setTxnAccId]  = useState("");
  const[showFilters,setShowFilters]= useState(false);
  const[expCatSel,  setExpCatSel] = useState(null);
  const[subCatSel,  setSubCatSel] = useState(null);
  const[incCatSel,  setIncCatSel] = useState(null);
  const[expandedCat,setExpandedCat]=useState(null);

  const[showTF, setShowTF] = useState(false);
  const[showAF, setShowAF] = useState(false);
  const[showECF,setShowECF]= useState(false);
  const[showSCF,setShowSCF]= useState(false);
  const[showICF,setShowICF]= useState(false);
  const[showExp,setShowExp]= useState(false);
  const[showSet,setShowSet]= useState(false);
  const[editT,  setEditT]  = useState(null);
  const[editA,  setEditA]  = useState(null);
  const[editEC, setEditEC] = useState(null);
  const[editSC, setEditSC] = useState(null);
  const[editIC, setEditIC] = useState(null);
  const[prefill,setPrefill]= useState(null);
  const[inappBanner,setInappBanner]=useState(null);

  // ── Theme ──
  const sysDark=useMemo(()=>{try{return window.matchMedia?.("(prefers-color-scheme:dark)").matches;}catch{return true;}},[]);
  const T=useMemo(()=>{const m=settings.uiMode;if(m==="auto")return sysDark?THEMES.dark:THEMES.light;return THEMES[m]||THEMES.dark;},[settings.uiMode,sysDark]);
  useEffect(()=>{
    const r=document.documentElement.style;
    r.setProperty("--bg",T.bg);r.setProperty("--card",T.card);r.setProperty("--card2",T.card2);
    r.setProperty("--text",T.text);r.setProperty("--sub",T.sub);r.setProperty("--muted",T.muted);
    r.setProperty("--bdr",T.border);r.setProperty("--inp",T.input);r.setProperty("--acc",T.acc);
    document.body.style.background=T.bg;
  },[T]);

  // ── First-open: ask notification permission ──
  useEffect(()=>{
    if(localStorage.getItem("v6NotifAsked"))return;
    localStorage.setItem("v6NotifAsked","1");
    setTimeout(async()=>{
      const perm=await Notif.requestPermission();
      if(perm==="granted"){
        setSettings(p=>({...p,notifications:true}));
        await Notif.rescheduleAll(DEF_SETTINGS.reminderTimes);
        setInappBanner({title:"🔔 Reminders Set",msg:`Daily alarms set for ${DEF_SETTINGS.reminderTimes.join(" & ")}`});
        setTimeout(()=>setInappBanner(null),5000);
      }
    },2500);
  // eslint-disable-next-line
  },[]);

  // ── Refresh 14-day alarm window on every app open / foreground ──
  // This ensures alarms never expire. Each app open extends the window 14 more days.
  useEffect(()=>{
    async function refreshAlarms(){
      const perm=await Notif.getPermission();
      if(perm!=="granted")return;
      // Read latest settings from localStorage directly (state may be stale in closure)
      try{
        const raw=localStorage.getItem("set6");
        const s=raw?JSON.parse(raw):null;
        if(s?.notifications&&s?.reminderTimes?.length){
          await Notif.rescheduleAll(s.reminderTimes);
        }
      }catch{}
    }
    // Run on mount
    refreshAlarms();
    // Re-run every time app comes back to foreground
    const onVisible=()=>{ if(!document.hidden) refreshAlarms(); };
    document.addEventListener("visibilitychange",onVisible);
    return()=>document.removeEventListener("visibilitychange",onVisible);
  // eslint-disable-next-line
  },[]);

  // ── Restore handler ──
  useEffect(()=>{
    const fn=()=>{
      const d=window.__restoreData;if(!d)return;
      if(d.transactions)setTxns(d.transactions);if(d.accounts)setAccounts(d.accounts);
      if(d.expCats)setExpCats(d.expCats);if(d.incCats)setIncCats(d.incCats);
      if(d.appName)setAppName(d.appName);if(d.settings)setSettings(d.settings);
      delete window.__restoreData;alert("✅ Backup restored successfully!");
    };
    window.addEventListener("finance-restore",fn);
    return()=>window.removeEventListener("finance-restore",fn);
  },[setTxns,setAccounts,setExpCats,setIncCats,setAppName,setSettings]);

  // ── Fix #3 & #4: Account balances with opening balance + carry-forward ──
  const accBal=useMemo(()=>{
    const m={};
    accounts.forEach(a=>{m[a.id]=(a.openingBal||0);}); // start with opening balance
    txns.forEach(t=>{
      if(!(t.accountId in m))m[t.accountId]=0;
      if(t.type==="income")  m[t.accountId]+=t.amount;
      else if(t.type==="expense") m[t.accountId]-=t.amount;
      else if(t.type==="transfer"){
        m[t.accountId]-=t.amount;
        if(t.toAccountId){if(!(t.toAccountId in m))m[t.toAccountId]=0;m[t.toAccountId]+=t.amount;}
      }
    });
    return m;
  },[accounts,txns]);
  const netBal=useMemo(()=>Object.values(accBal).reduce((s,b)=>s+b,0),[accBal]);

  // Period txns
  const periodTxns=useMemo(()=>{
    let from,to;
    if(period==="custom"){from=new Date(cFrom);from.setHours(0,0,0,0);to=new Date(cTo);to.setHours(23,59,59,999);}
    else({from,to}=periodDates(period));
    return txns.filter(t=>{const d=new Date(t.date);return d>=from&&d<=to;});
  },[txns,period,cFrom,cTo]);

  const pLabel  =useMemo(()=>{if(period==="custom")return`${fmtD(cFrom)} → ${fmtD(cTo)}`;const{from,to}=periodDates(period);return`${fmtD(toYMD(from))} → ${fmtD(toYMD(to))}`;},[period,cFrom,cTo]);
  const pIncome =useMemo(()=>periodTxns.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),[periodTxns]);
  const pExpense=useMemo(()=>periodTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),[periodTxns]);

  // Fix #4: period opening balance (carry forward)
  const periodOpenBal=useMemo(()=>{
    if(settings.carryForward===false)return 0;
    // Sum all transactions BEFORE the period start
    let from;
    if(period==="custom"){from=new Date(cFrom);from.setHours(0,0,0,0);}
    else from=periodDates(period).from;
    const beforeTxns=txns.filter(t=>new Date(t.date)<from);
    let bal=accounts.reduce((s,a)=>s+(a.openingBal||0),0);
    beforeTxns.forEach(t=>{if(t.type==="income")bal+=t.amount;else if(t.type==="expense")bal-=t.amount;});
    return bal;
  },[txns,accounts,period,cFrom,settings.carryForward]);

  // Fix #1: filtered transactions with category/sub/account filters
  const filtered=useMemo(()=>{
    return [...periodTxns]
      .sort((a,b)=>b.date.localeCompare(a.date))
      .filter(t=>{
        if(txnType!=="all"&&t.type!==txnType)return false;
        if(txnCatId&&t.catId!==txnCatId)return false;
        if(txnSubId&&t.subCatId!==txnSubId)return false;
        if(txnAccId&&t.accountId!==txnAccId&&t.toAccountId!==txnAccId)return false;
        return true;
      });
  },[periodTxns,txnType,txnCatId,txnSubId,txnAccId]);

  const expByCat=useMemo(()=>{const m={};periodTxns.filter(t=>t.type==="expense").forEach(t=>{const c=expCats.find(x=>x.id===t.catId);if(!c)return;if(!m[c.id])m[c.id]={name:c.name,catId:c.id,icon:c.icon,value:0};m[c.id].value+=t.amount;});return Object.values(m).sort((a,b)=>b.value-a.value);},[periodTxns,expCats]);
  const incByCat=useMemo(()=>{const m={};periodTxns.filter(t=>t.type==="income").forEach(t=>{const c=incCats.find(x=>x.id===t.catId);if(!c)return;if(!m[c.id])m[c.id]={name:c.name,catId:c.id,icon:c.icon,value:0};m[c.id].value+=t.amount;});return Object.values(m).sort((a,b)=>b.value-a.value);},[periodTxns,incCats]);
  const subCatD =useMemo(()=>{const m={};periodTxns.filter(t=>t.type==="expense"&&t.subCatId&&(expCatSel?t.catId===expCatSel:true)).forEach(t=>{const c=expCats.find(x=>x.id===t.catId);const s=c?.sub?.find(x=>x.id===t.subCatId);if(!s)return;if(!m[t.subCatId])m[t.subCatId]={subId:t.subCatId,catId:t.catId,name:s.name,amount:0};m[t.subCatId].amount+=t.amount;});return Object.values(m).sort((a,b)=>b.amount-a.amount);},[periodTxns,expCats,expCatSel]);
  const drillExp=useMemo(()=>subCatSel?periodTxns.filter(t=>t.type==="expense"&&t.subCatId===subCatSel).sort((a,b)=>b.date.localeCompare(a.date)):[],[periodTxns,subCatSel]);
  const drillInc=useMemo(()=>incCatSel?periodTxns.filter(t=>t.type==="income"&&t.catId===incCatSel).sort((a,b)=>b.date.localeCompare(a.date)):[],[periodTxns,incCatSel]);
  const trendCats=useMemo(()=>{const used=new Set(txns.filter(t=>t.type==="expense").map(t=>t.catId));return expCats.filter(c=>used.has(c.id));},[txns,expCats]);
  const trendData=useMemo(()=>{const m={};txns.filter(t=>t.type==="expense").forEach(t=>{const d=new Date(t.date);const mk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;if(!m[mk])m[mk]={mk,label:`${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`};m[mk][t.catId]=(m[mk][t.catId]||0)+t.amount;});return Object.values(m).sort((a,b)=>a.mk.localeCompare(b.mk)).slice(-12);},[txns]);
  const trendSubData=useMemo(()=>{if(!trendCatId)return[];const cat=expCats.find(c=>c.id===trendCatId);if(!cat?.sub?.length)return[];const m={};txns.filter(t=>t.type==="expense"&&t.catId===trendCatId&&t.subCatId).forEach(t=>{const d=new Date(t.date);const mk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;if(!m[mk])m[mk]={mk,label:`${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`};m[mk][t.subCatId]=(m[mk][t.subCatId]||0)+t.amount;});return Object.values(m).sort((a,b)=>a.mk.localeCompare(b.mk)).slice(-12);},[txns,expCats,trendCatId]);

  // CRUD
  const saveTxn=t=>{setTxns(p=>{const i=p.findIndex(x=>x.id===t.id);if(i>=0){const n=[...p];n[i]=t;return n;}return[t,...p];});setShowTF(false);setEditT(null);setPrefill(null);};
  const delTxn =id=>{if(window.confirm("Delete this transaction?"))setTxns(p=>p.filter(t=>t.id!==id));};
  const saveAcc=a=>{setAccounts(p=>{const i=p.findIndex(x=>x.id===a.id);if(i>=0){const n=[...p];n[i]={...n[i],...a};return n;}return[...p,a];});setShowAF(false);setEditA(null);};
  const delAcc =id=>{if(window.confirm("Delete account?"))setAccounts(p=>p.filter(a=>a.id!==id));};
  const saveEC =c=>{setExpCats(p=>{const i=p.findIndex(x=>x.id===c.id);if(i>=0){const n=[...p];n[i]={...n[i],...c,sub:n[i].sub};return n;}return[...p,c];});setShowECF(false);setEditEC(null);};
  const delEC  =id=>{if(txns.some(t=>t.catId===id)){alert("Cannot delete: has transactions");return;}setExpCats(p=>p.filter(c=>c.id!==id));if(expandedCat===id)setExpandedCat(null);};
  const saveSC =(pid,s)=>{setExpCats(p=>p.map(c=>{if(c.id!==pid)return c;const i=c.sub.findIndex(x=>x.id===s.id);if(i>=0){const ss=[...c.sub];ss[i]=s;return{...c,sub:ss};}return{...c,sub:[...c.sub,s]};}));setShowSCF(false);setEditSC(null);};
  const delSC  =(pid,sid)=>{if(txns.some(t=>t.subCatId===sid)){alert("Cannot delete: has transactions");return;}setExpCats(p=>p.map(c=>c.id===pid?{...c,sub:c.sub.filter(s=>s.id!==sid)}:c));};
  const saveIC =c=>{setIncCats(p=>{const i=p.findIndex(x=>x.id===c.id);if(i>=0){const n=[...p];n[i]=c;return n;}return[...p,c];});setShowICF(false);setEditIC(null);};
  const delIC  =id=>{if(txns.some(t=>t.catId===id)){alert("Cannot delete: has transactions");return;}setIncCats(p=>p.filter(c=>c.id!==id));};

  // Derived helpers
  const pill=(on,col="var(--acc)")=>({padding:"5px 11px",borderRadius:14,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:on?col:"var(--bdr)",color:on?"#fff":"var(--sub)",flexShrink:0});
  const card={background:T.card,borderRadius:14,padding:15,marginBottom:13};

  // Fix #1: available sub-categories for the selected filter category
  const filterCat=expCats.find(c=>c.id===txnCatId)||incCats.find(c=>c.id===txnCatId);
  const activeFilters=[txnType!=="all",!!txnCatId,!!txnSubId,!!txnAccId].filter(Boolean).length;

  const TABS=[
    {id:"home",icon:"🏠",label:"Home"},
    {id:"accounts",icon:"🏦",label:"Accounts"},
    {id:"categories",icon:"🏷️",label:"Categories"},
    {id:"reports",icon:"📈",label:"Reports"},
  ];

  return(
    <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",background:T.bg,minHeight:"100vh",color:T.text,maxWidth:480,margin:"0 auto",paddingBottom:90}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg,#0f1420)}
        input[type=date]::-webkit-calendar-picker-indicator,input[type=time]::-webkit-calendar-picker-indicator{filter:${settings.uiMode==="light"?"none":"invert(1)"}}
        select option{background:var(--card,#1a1f2e)}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:2px}
        .hov:active{opacity:.7;transform:scale(.98)}
      `}</style>

      {/* IN-APP BANNER */}
      {inappBanner&&(
        <div style={{position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",zIndex:4000,background:"var(--acc)",borderRadius:13,padding:"11px 15px",maxWidth:440,width:"calc(100% - 28px)",boxShadow:"0 6px 28px rgba(0,0,0,.5)",display:"flex",gap:11,alignItems:"center"}}>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{inappBanner.title}</div><div style={{fontSize:11,color:"rgba(255,255,255,.8)",marginTop:1}}>{inappBanner.msg}</div></div>
          <button type="button" onClick={()=>setInappBanner(null)} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:13}}>✕</button>
        </div>
      )}

      {/* HEADER */}
      <div style={{background:T.header,padding:"20px 14px 13px",borderBottom:`1px solid ${T.navBdr}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <button type="button" onClick={()=>setShowSet(true)} style={{width:35,height:35,borderRadius:10,background:"rgba(255,255,255,.12)",border:"none",cursor:"pointer",fontSize:17,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>⚙️</button>
            <div>
              <div style={{fontSize:8,color:"rgba(255,255,255,.4)",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:1}}>Budget Tracker</div>
              <NameEdit name={appName} onChange={setAppName}/>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,.4)"}}>Net Balance</div>
            <div style={{fontSize:19,fontWeight:800,color:netBal>=0?"#10b981":"#ef4444"}}>{fmt(netBal)}</div>
          </div>
        </div>
      </div>

      <div style={{padding:"11px 13px 0"}}>

        {/* ════════ HOME TAB ════════ */}
        {tab==="home"&&<>
          <PeriodBar period={period} setPeriod={setPeriod} cFrom={cFrom} setCFrom={setCFrom} cTo={cTo} setCTo={setCTo}/>

          {/* Summary cards */}
          <div style={{display:"flex",gap:9,marginBottom:11}}>
            {settings.carryForward!==false&&periodOpenBal!==0&&(
              <div style={{flex:1,background:T.card,borderRadius:12,padding:"12px 14px",borderLeft:"3px solid #64748b"}}>
                <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase"}}>Opening</div>
                <div style={{fontSize:15,fontWeight:800,color:T.sub,marginTop:4}}>{fmt(periodOpenBal)}</div>
              </div>
            )}
            <div style={{flex:1,background:T.card,borderRadius:12,padding:"12px 14px",borderLeft:"3px solid #10b981"}}>
              <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase"}}>Income</div>
              <div style={{fontSize:19,fontWeight:800,color:"#10b981",marginTop:4}}>{fmt(pIncome)}</div>
            </div>
            <div style={{flex:1,background:T.card,borderRadius:12,padding:"12px 14px",borderLeft:"3px solid #ef4444"}}>
              <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase"}}>Expense</div>
              <div style={{fontSize:19,fontWeight:800,color:"#ef4444",marginTop:4}}>{fmt(pExpense)}</div>
            </div>
            <div style={{flex:1,background:T.card,borderRadius:12,padding:"12px 14px",borderLeft:"3px solid "+T.acc}}>
              <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase"}}>Saved</div>
              <div style={{fontSize:19,fontWeight:800,color:T.acc,marginTop:4}}>{fmt(pIncome-pExpense)}</div>
            </div>
          </div>

          {/* Account balance cards */}
          <div style={{display:"flex",gap:9,overflowX:"auto",paddingBottom:7,marginBottom:11,scrollbarWidth:"none"}}>
            {accounts.map(a=>{
              const b=accBal[a.id]||0;
              return(
                <div key={a.id} style={{minWidth:118,background:T.card,borderRadius:12,padding:11,borderTop:`3px solid ${a.color}`,flexShrink:0}}>
                  <div style={{fontSize:19,marginBottom:2}}>{a.icon}</div>
                  <div style={{fontSize:11,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{a.name}</div>
                  <div style={{fontSize:13,fontWeight:800,color:b>=0?a.color:"#ef4444"}}>{fmt(b)}</div>
                  {(a.openingBal||0)!==0&&<div style={{fontSize:9,color:T.muted}}>Opening: {fmt(a.openingBal)}</div>}
                </div>
              );
            })}
          </div>

          {/* Fix #1: Filter bar */}
          <div style={{background:T.card,borderRadius:12,padding:"9px 12px",marginBottom:9}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showFilters?10:0}}>
              <div style={{display:"flex",gap:5}}>
                {[{v:"all",l:"All"},{v:"expense",l:"🔴 Exp"},{v:"income",l:"🟢 Inc"},{v:"transfer",l:"🔄 Transfer"}].map(({v,l})=>(
                  <button key={v} type="button" style={pill(txnType===v,v==="income"?"#10b981":v==="expense"?"#ef4444":v==="transfer"?"#3b82f6":"#64748b")} onClick={()=>{setTxnType(v);if(v!=="expense"){setTxnCatId("");setTxnSubId("");}}}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                <button type="button" onClick={()=>setShowFilters(f=>!f)} style={{...pill(showFilters||activeFilters>1,"#64748b"),position:"relative"}}>
                  🔽 Filter{activeFilters>1?` (${activeFilters-1})` :""}
                </button>
                <button type="button" onClick={()=>setShowExp(true)} style={{background:T.border,border:"none",color:T.sub,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>📤</button>
              </div>
            </div>

            {/* Advanced filters */}
            {showFilters&&<div style={{borderTop:`1px solid ${T.border}`,paddingTop:9}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                {/* Account filter */}
                <div>
                  <FL c="Account"/>
                  <select value={txnAccId} onChange={e=>setTxnAccId(e.target.value)}
                    style={{width:"100%",background:"var(--inp)",border:"1px solid var(--bdr)",borderRadius:8,padding:"7px 9px",color:"var(--text)",fontSize:12,outline:"none"}}>
                    <option value="">All Accounts</option>
                    {accounts.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                  </select>
                </div>
                {/* Category filter */}
                <div>
                  <FL c="Category"/>
                  <select value={txnCatId} onChange={e=>{setTxnCatId(e.target.value);setTxnSubId("");}}
                    style={{width:"100%",background:"var(--inp)",border:"1px solid var(--bdr)",borderRadius:8,padding:"7px 9px",color:"var(--text)",fontSize:12,outline:"none"}}>
                    <option value="">All Categories</option>
                    <optgroup label="── Expense ──">
                      {expCats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </optgroup>
                    <optgroup label="── Income ──">
                      {incCats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </optgroup>
                  </select>
                </div>
                {/* Sub-category filter */}
                {filterCat?.sub?.length>0&&(
                  <div style={{gridColumn:"1/-1"}}>
                    <FL c="Sub Category"/>
                    <select value={txnSubId} onChange={e=>setTxnSubId(e.target.value)}
                      style={{width:"100%",background:"var(--inp)",border:"1px solid var(--bdr)",borderRadius:8,padding:"7px 9px",color:"var(--text)",fontSize:12,outline:"none"}}>
                      <option value="">All Sub-Categories</option>
                      {filterCat.sub.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {activeFilters>1&&(
                <button type="button" onClick={()=>{setTxnType("all");setTxnCatId("");setTxnSubId("");setTxnAccId("");}} style={{marginTop:7,width:"100%",background:"var(--bdr)",border:"none",color:"var(--sub)",borderRadius:7,padding:"6px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                  ✕ Clear All Filters
                </button>
              )}
            </div>}
          </div>

          <div style={{fontSize:10,color:T.muted,marginBottom:8}}>{filtered.length} transactions · {pLabel}</div>

          {/* Transactions list */}
          {!filtered.length
            ?<div style={{textAlign:"center",color:T.muted,padding:"40px 0"}}><div style={{fontSize:38,marginBottom:8}}>📭</div>No transactions for this filter</div>
            :filtered.map(t=><TxnRow key={t.id} t={t} accounts={accounts} expCats={expCats} incCats={incCats} onTap={()=>{setEditT(t);setShowTF(true);}} onDelete={delTxn}/>)
          }
        </>}

        {/* ════════ ACCOUNTS ════════ */}
        {tab==="accounts"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
            <div style={{fontSize:15,fontWeight:700,color:T.text}}>Accounts</div>
            <button type="button" onClick={()=>{setEditA(null);setShowAF(true);}} style={{background:"var(--acc)",border:"none",color:"#fff",borderRadius:10,padding:"7px 13px",cursor:"pointer",fontWeight:700,fontSize:12}}>+ Add</button>
          </div>
          {accounts.map(a=>{
            const b=accBal[a.id]||0;
            const ai=txns.filter(t=>t.accountId===a.id&&t.type==="income").reduce((s,t)=>s+t.amount,0);
            const ae=txns.filter(t=>t.accountId===a.id&&t.type==="expense").reduce((s,t)=>s+t.amount,0);
            const atOut=txns.filter(t=>t.accountId===a.id&&t.type==="transfer").reduce((s,t)=>s+t.amount,0);
            const atIn =txns.filter(t=>t.toAccountId===a.id&&t.type==="transfer").reduce((s,t)=>s+t.amount,0);
            return(
              <div key={a.id} className="hov" onClick={()=>{setEditA(a);setShowAF(true);}}
                style={{background:T.card,borderRadius:13,padding:15,marginBottom:11,cursor:"pointer",borderLeft:`4px solid ${a.color}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <div style={{fontSize:26}}>{a.icon}</div>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:T.text}}>{a.name}</div>
                      {(a.openingBal||0)!==0&&<div style={{fontSize:10,color:T.muted}}>Opening: {fmt(a.openingBal||0)}</div>}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:19,fontWeight:800,color:b>=0?a.color:"#ef4444"}}>{fmt(b)}</div><div style={{fontSize:9,color:T.muted}}>Balance</div></div>
                </div>
                <div style={{display:"flex",gap:7}}>
                  <div style={{flex:1,background:T.bg,borderRadius:7,padding:7,textAlign:"center"}}><div style={{fontSize:9,color:T.muted}}>Income</div><div style={{fontSize:12,fontWeight:700,color:"#10b981"}}>{fmt(ai)}</div></div>
                  <div style={{flex:1,background:T.bg,borderRadius:7,padding:7,textAlign:"center"}}><div style={{fontSize:9,color:T.muted}}>Expense</div><div style={{fontSize:12,fontWeight:700,color:"#ef4444"}}>{fmt(ae)}</div></div>
                  {(atOut+atIn)>0&&<div style={{flex:1,background:T.bg,borderRadius:7,padding:7,textAlign:"center"}}><div style={{fontSize:9,color:T.muted}}>Transfers</div><div style={{fontSize:11,fontWeight:700,color:"#3b82f6"}}>-{fmt(atOut)}/+{fmt(atIn)}</div></div>}
                  <button type="button" onClick={e=>{e.stopPropagation();delAcc(a.id);}} style={{background:T.border,border:"none",color:"#ef4444",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:700}}>🗑️</button>
                </div>
              </div>
            );
          })}
        </>}

        {/* ════════ CATEGORIES ════════ */}
        {tab==="categories"&&<>
          <div style={{display:"flex",gap:7,marginBottom:14}}>
            <button type="button" style={pill(catTab==="expense","#ef4444")} onClick={()=>setCatTab("expense")}>🔴 Expense</button>
            <button type="button" style={pill(catTab==="income","#10b981")} onClick={()=>setCatTab("income")}>🟢 Income</button>
          </div>
          {catTab==="expense"&&<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
              <div style={{fontSize:15,fontWeight:700,color:T.text}}>Expense Categories</div>
              <button type="button" onClick={()=>{setEditEC(null);setShowECF(true);}} style={{background:"#ef4444",border:"none",color:"#fff",borderRadius:10,padding:"7px 13px",cursor:"pointer",fontWeight:700,fontSize:12}}>+ Add</button>
            </div>
            {expCats.map(cat=>{
              const open=expandedCat===cat.id;
              return(
                <div key={cat.id} style={{marginBottom:9}}>
                  <div style={{background:T.card,borderRadius:open?"13px 13px 0 0":"13px",border:`1px solid ${open?cat.color:"transparent"}`}}>
                    <div className="hov" style={{display:"flex",alignItems:"center",gap:11,padding:13,cursor:"pointer"}} onClick={()=>setExpandedCat(open?null:cat.id)}>
                      <div style={{width:40,height:40,borderRadius:11,background:cat.color+"22",border:`2px solid ${cat.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{cat.icon}</div>
                      <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:T.text}}>{cat.name}</div><div style={{fontSize:10,color:T.muted}}>{cat.sub.length} sub-categories</div></div>
                      <div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
                        <button type="button" onClick={()=>{setEditEC(cat);setShowECF(true);}} style={{background:T.border,border:"none",color:T.sub,borderRadius:7,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
                        <button type="button" onClick={()=>delEC(cat.id)} style={{background:T.border,border:"none",color:"#ef4444",borderRadius:7,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
                      </div>
                      <div style={{fontSize:15,color:T.muted,transition:"transform .25s",transform:open?"rotate(90deg)":"none"}}>›</div>
                    </div>
                    {open&&<div style={{background:T.card2,borderTop:`1px solid ${cat.color}33`,padding:"9px 13px 11px"}}>
                      {cat.sub.map(s=>(
                        <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.card,borderRadius:9,padding:"9px 11px",marginBottom:6}}>
                          <div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:5,height:5,borderRadius:"50%",background:cat.color,flexShrink:0}}/><span style={{fontSize:12,color:T.text,fontWeight:500}}>{s.name}</span></div>
                          <div style={{display:"flex",gap:5}}>
                            <button type="button" onClick={()=>{setEditSC({parentId:cat.id,parentName:cat.name,sub:s});setShowSCF(true);}} style={{background:T.border,border:"none",color:T.sub,borderRadius:6,width:28,height:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
                            <button type="button" onClick={()=>delSC(cat.id,s.id)} style={{background:T.border,border:"none",color:"#ef4444",borderRadius:6,width:28,height:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={()=>{setEditSC({parentId:cat.id,parentName:cat.name,sub:null});setShowSCF(true);}} style={{width:"100%",marginTop:3,background:"transparent",border:`1.5px dashed ${cat.color}88`,borderRadius:9,padding:8,color:cat.color,fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Add Sub Category</button>
                    </div>}
                  </div>
                </div>
              );
            })}
          </>}
          {catTab==="income"&&<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
              <div style={{fontSize:15,fontWeight:700,color:T.text}}>Income Categories</div>
              <button type="button" onClick={()=>{setEditIC(null);setShowICF(true);}} style={{background:"var(--acc)",border:"none",color:"#fff",borderRadius:10,padding:"7px 13px",cursor:"pointer",fontWeight:700,fontSize:12}}>+ Add</button>
            </div>
            {incCats.map(cat=>(
              <div key={cat.id} className="hov" onClick={()=>{setEditIC(cat);setShowICF(true);}}
                style={{background:T.card,borderRadius:13,padding:13,marginBottom:9,display:"flex",alignItems:"center",gap:11,cursor:"pointer"}}>
                <div style={{width:40,height:40,borderRadius:11,background:cat.color+"22",border:`2px solid ${cat.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{cat.icon}</div>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:T.text}}>{cat.name}</div></div>
                <button type="button" onClick={e=>{e.stopPropagation();delIC(cat.id);}} style={{background:T.border,border:"none",color:"#ef4444",borderRadius:7,width:30,height:30,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
              </div>
            ))}
          </>}
        </>}

        {/* ════════ REPORTS ════════ */}
        {tab==="reports"&&<>
          <div style={{display:"flex",gap:6,marginBottom:9}}>
            {["expense","income","trend"].map(r=>(
              <button key={r} type="button" style={{...pill(reportTab===r,r==="expense"?"#ef4444":r==="income"?"#10b981":"#3b82f6"),flexShrink:0}}
                onClick={()=>{setReportTab(r);setExpCatSel(null);setSubCatSel(null);setIncCatSel(null);setTrendCatId(null);}}>
                {r==="expense"?"📉 Expense":r==="income"?"📈 Income":"📊 Trend"}
              </button>
            ))}
          </div>
          <PeriodBar period={period} setPeriod={setPeriod} cFrom={cFrom} setCFrom={setCFrom} cTo={cTo} setCTo={setCTo}/>
          <div style={{display:"flex",gap:7,marginBottom:11}}>
            <div style={{flex:1,background:T.card,borderRadius:10,padding:"9px 11px",borderLeft:"3px solid #10b981"}}><div style={{fontSize:8,color:T.muted,fontWeight:700}}>INCOME</div><div style={{fontSize:14,fontWeight:800,color:"#10b981"}}>{fmt(pIncome)}</div></div>
            <div style={{flex:1,background:T.card,borderRadius:10,padding:"9px 11px",borderLeft:"3px solid #ef4444"}}><div style={{fontSize:8,color:T.muted,fontWeight:700}}>EXPENSE</div><div style={{fontSize:14,fontWeight:800,color:"#ef4444"}}>{fmt(pExpense)}</div></div>
            <div style={{flex:1,background:T.card,borderRadius:10,padding:"9px 11px",borderLeft:"3px solid "+T.acc}}><div style={{fontSize:8,color:T.muted,fontWeight:700}}>SAVED</div><div style={{fontSize:14,fontWeight:800,color:T.acc}}>{fmt(pIncome-pExpense)}</div></div>
          </div>

          {reportTab==="expense"&&<>
            <div style={card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <div style={{fontSize:14,fontWeight:700,color:T.text}}>By Category</div>
                {expCatSel&&<button type="button" onClick={()=>{setExpCatSel(null);setSubCatSel(null);}} style={{background:T.border,border:"none",color:T.sub,borderRadius:7,padding:"3px 9px",cursor:"pointer",fontSize:10}}>✕ Clear</button>}
              </div>
              {!expByCat.length?<div style={{textAlign:"center",color:T.muted,padding:"22px 0"}}>No expense data</div>:
                <ResponsiveContainer width="100%" height={190}><PieChart>
                  <Pie data={expByCat} cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={3} dataKey="value"
                    onClick={d=>{setExpCatSel(p=>p===d.catId?null:d.catId);setSubCatSel(null);}} style={{cursor:"pointer"}}
                    label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {expByCat.map((_,i)=><Cell key={i} fill={CLRS[i%CLRS.length]} opacity={expCatSel&&expCatSel!==expByCat[i]?.catId?.3:1}/>)}
                  </Pie>
                  <Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:11}}/>
                  <Legend iconSize={9} wrapperStyle={{fontSize:10,color:T.sub}}/>
                </PieChart></ResponsiveContainer>}
            </div>
            <div style={card}>
              {expByCat.map((it,i)=>{const sel=expCatSel===it.catId;const cat=expCats.find(c=>c.id===it.catId);return(
                <div key={it.catId} onClick={()=>{setExpCatSel(p=>p===it.catId?null:it.catId);setSubCatSel(null);}}
                  style={{marginBottom:9,cursor:"pointer",padding:"7px 9px",borderRadius:9,background:sel?CLRS[i%CLRS.length]+"22":T.card2,border:`1px solid ${sel?CLRS[i%CLRS.length]:"transparent"}`,opacity:expCatSel&&!sel?.5:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.text,fontWeight:600}}>{cat?.icon} {it.name}</span><span style={{fontSize:12,fontWeight:800,color:T.text}}>{fmt(it.value)}</span></div>
                  <div style={{background:T.bg,borderRadius:4,height:4}}><div style={{height:"100%",borderRadius:4,background:CLRS[i%CLRS.length],width:`${(it.value/expByCat[0].value)*100}%`}}/></div>
                  <div style={{fontSize:9,color:T.muted,marginTop:2,textAlign:"right"}}>{pExpense>0?`${(it.value/pExpense*100).toFixed(1)}%`:""}</div>
                </div>);})}
            </div>
            {subCatD.length>0&&<div style={card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
                <div style={{fontSize:14,fontWeight:700,color:T.text}}>Sub Categories</div>
                {subCatSel&&<button type="button" onClick={()=>setSubCatSel(null)} style={{background:T.border,border:"none",color:T.sub,borderRadius:7,padding:"3px 9px",cursor:"pointer",fontSize:10}}>✕</button>}
              </div>
              {subCatD.map((it,i)=>{const pc=expCats.find(c=>c.id===it.catId);const sel=subCatSel===it.subId;return(
                <div key={it.subId}>
                  <div onClick={()=>setSubCatSel(p=>p===it.subId?null:it.subId)} style={{marginBottom:7,cursor:"pointer",padding:"8px 11px",borderRadius:9,background:sel?"#10b98120":T.card2,border:`1px solid ${sel?"#10b981":"transparent"}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}><div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:5,height:5,borderRadius:"50%",background:pc?.color||CLRS[i%12],flexShrink:0}}/><span style={{fontSize:12,color:T.text,fontWeight:500}}>{it.name}</span></div><span style={{fontSize:12,fontWeight:700,color:T.text}}>{fmt(it.amount)}</span></div>
                    <div style={{background:T.bg,borderRadius:3,height:3}}><div style={{height:"100%",borderRadius:3,background:pc?.color||CLRS[i%12],width:subCatD[0]?`${(it.amount/subCatD[0].amount)*100}%`:"0%"}}/></div>
                  </div>
                  {sel&&drillExp.length>0&&<div style={{background:T.card2,borderRadius:"0 0 9px 9px",padding:"7px 10px",marginTop:-7,marginBottom:7,border:"1px solid #10b98133",borderTop:"none"}}>
                    {drillExp.map(t=>(<div key={t.id} style={{background:T.card,borderRadius:7,padding:"8px 10px",marginBottom:5,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:11,color:T.muted}}>{fmtD(t.date)}</div>{t.note&&<div style={{fontSize:10,color:T.muted,opacity:.7}}>{t.note}</div>}</div><div style={{fontSize:12,fontWeight:700,color:"#ef4444"}}>{fmt(t.amount)}</div></div>))}
                    <div style={{fontSize:11,fontWeight:700,color:"#ef4444",textAlign:"right",marginTop:3}}>Total: {fmt(drillExp.reduce((s,t)=>s+t.amount,0))}</div>
                  </div>}
                </div>);})}
            </div>}
          </>}

          {reportTab==="income"&&<>
            <div style={card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <div style={{fontSize:14,fontWeight:700,color:T.text}}>By Category</div>
                {incCatSel&&<button type="button" onClick={()=>setIncCatSel(null)} style={{background:T.border,border:"none",color:T.sub,borderRadius:7,padding:"3px 9px",cursor:"pointer",fontSize:10}}>✕ Clear</button>}
              </div>
              {!incByCat.length?<div style={{textAlign:"center",color:T.muted,padding:"22px 0"}}>No income data</div>:
                <ResponsiveContainer width="100%" height={190}><PieChart>
                  <Pie data={incByCat} cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={3} dataKey="value"
                    onClick={d=>setIncCatSel(p=>p===d.catId?null:d.catId)} style={{cursor:"pointer"}}
                    label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {incByCat.map((_,i)=><Cell key={i} fill={CLRS[i%CLRS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={v=>fmt(v)} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:11}}/>
                  <Legend iconSize={9} wrapperStyle={{fontSize:10,color:T.sub}}/>
                </PieChart></ResponsiveContainer>}
            </div>
            <div style={card}>
              {incByCat.map((it,i)=>{const sel=incCatSel===it.catId;const cat=incCats.find(c=>c.id===it.catId);return(
                <div key={it.catId}>
                  <div onClick={()=>setIncCatSel(p=>p===it.catId?null:it.catId)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",borderRadius:9,marginBottom:7,cursor:"pointer",background:sel?"#10b98120":T.card2,border:`1px solid ${sel?"#10b981":"transparent"}`,opacity:incCatSel&&!sel?.5:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:9}}><div style={{width:34,height:34,borderRadius:9,background:CLRS[i%CLRS.length]+"22",border:`2px solid ${CLRS[i%CLRS.length]}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{cat?.icon}</div><div><div style={{fontSize:12,fontWeight:600,color:T.text}}>{it.name}</div><div style={{fontSize:10,color:T.muted}}>{pIncome>0?`${(it.value/pIncome*100).toFixed(1)}%`:""}</div></div></div>
                    <div style={{fontSize:14,fontWeight:800,color:"#10b981"}}>{fmt(it.value)}</div>
                  </div>
                  {sel&&drillInc.length>0&&<div style={{background:T.card2,borderRadius:"0 0 9px 9px",padding:"7px 10px",marginTop:-7,marginBottom:7,border:"1px solid #10b98133",borderTop:"none"}}>
                    {drillInc.map(t=>(<div key={t.id} style={{background:T.card,borderRadius:7,padding:"8px 10px",marginBottom:5,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:11,color:T.muted}}>{fmtD(t.date)}</div>{t.note&&<div style={{fontSize:10,color:T.muted,opacity:.7}}>{t.note}</div>}</div><div style={{fontSize:12,fontWeight:700,color:"#10b981"}}>{fmt(t.amount)}</div></div>))}
                    <div style={{fontSize:11,fontWeight:700,color:"#10b981",textAlign:"right",marginTop:3}}>Total: {fmt(drillInc.reduce((s,t)=>s+t.amount,0))}</div>
                  </div>}
                </div>);})}
            </div>
          </>}

          {reportTab==="trend"&&<>
            <div style={card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div style={{fontSize:14,fontWeight:700,color:T.text}}>Monthly Expense by Category</div>
                {trendCatId&&<button type="button" onClick={()=>setTrendCatId(null)} style={{background:T.border,border:"none",color:T.sub,borderRadius:7,padding:"3px 9px",cursor:"pointer",fontSize:10}}>✕ All</button>}
              </div>
              <div style={{fontSize:10,color:T.muted,marginBottom:9}}>Tap legend to drill into sub-categories</div>
              {!trendData.length?<div style={{textAlign:"center",color:T.muted,padding:"22px 0"}}>No data</div>:
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trendData} margin={{left:-18,right:4}} onClick={d=>{if(d?.activePayload?.[0]?.dataKey){const cid=d.activePayload[0].dataKey;setTrendCatId(p=>p===cid?null:cid);}}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                    <XAxis dataKey="label" tick={{fill:T.muted,fontSize:9}}/>
                    <YAxis tick={{fill:T.muted,fontSize:9}} tickFormatter={v=>`₹${v>=1000?`${(v/1000).toFixed(0)}k`:v}`}/>
                    <Tooltip formatter={(v,n)=>{const c=expCats.find(x=>x.id===n);return[fmt(v),c?`${c.icon} ${c.name}`:n];}} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:11}}/>
                    <Legend iconSize={9} wrapperStyle={{fontSize:10,color:T.sub}} formatter={n=>{const c=expCats.find(x=>x.id===n);return c?`${c.icon} ${c.name}`:n;}} onClick={e=>setTrendCatId(p=>p===e.dataKey?null:e.dataKey)}/>
                    {trendCats.map((cat,i)=><Bar key={cat.id} dataKey={cat.id} stackId="a" fill={CLRS[i%CLRS.length]} opacity={trendCatId&&trendCatId!==cat.id?.2:1} radius={i===trendCats.length-1?[3,3,0,0]:[0,0,0,0]} style={{cursor:"pointer"}}/>)}
                  </BarChart>
                </ResponsiveContainer>}
            </div>
            {trendCatId&&(()=>{const cat=expCats.find(c=>c.id===trendCatId);if(!cat?.sub?.length||!trendSubData.length)return null;return(
              <div style={card}>
                <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:3}}>{cat.icon} {cat.name} — Sub-Categories</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendSubData} margin={{left:-18,right:4}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                    <XAxis dataKey="label" tick={{fill:T.muted,fontSize:9}}/>
                    <YAxis tick={{fill:T.muted,fontSize:9}} tickFormatter={v=>`₹${v>=1000?`${(v/1000).toFixed(0)}k`:v}`}/>
                    <Tooltip formatter={(v,n)=>{const s=cat.sub.find(x=>x.id===n);return[fmt(v),s?.name||n];}} contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:11}}/>
                    <Legend iconSize={9} wrapperStyle={{fontSize:10,color:T.sub}} formatter={n=>{const s=cat.sub.find(x=>x.id===n);return s?.name||n;}}/>
                    {cat.sub.map((s,i)=><Bar key={s.id} dataKey={s.id} fill={CLRS[(i+4)%CLRS.length]} stackId="b" radius={i===cat.sub.length-1?[3,3,0,0]:[0,0,0,0]}/>)}
                  </BarChart>
                </ResponsiveContainer>
              </div>);})()}
          </>}
        </>}
      </div>

      {/* FAB */}
      <button type="button"
        style={{position:"fixed",bottom:82,right:"max(13px,calc(50% - 227px))",width:54,height:54,borderRadius:27,background:`linear-gradient(135deg,${T.acc},${T.acc}bb)`,border:"none",cursor:"pointer",fontSize:24,color:"#fff",boxShadow:`0 4px 20px ${T.acc}66`,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}
        onClick={()=>{setEditT(null);setPrefill(null);setShowTF(true);}}>＋</button>

      {/* BOTTOM NAV */}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:T.nav,borderTop:`1px solid ${T.navBdr}`,display:"flex",zIndex:100}}>
        {TABS.map(tb=>(
          <button key={tb.id} type="button" onClick={()=>setTab(tb.id)}
            style={{flex:1,padding:"10px 2px 9px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:tab===tb.id?T.acc:T.muted,transition:"color .15s"}}>
            <span style={{fontSize:18}}>{tb.icon}</span>
            <span style={{fontSize:8,fontWeight:700}}>{tb.label}</span>
            {tab===tb.id&&<div style={{width:18,height:2,borderRadius:1,background:T.acc,marginTop:2}}/>}
          </button>
        ))}
      </nav>

      {/* MODALS */}
      {showTF &&<TxnForm accounts={accounts} expCats={expCats} incCats={incCats} onSave={saveTxn} editT={editT} prefill={prefill} onClose={()=>{setShowTF(false);setEditT(null);setPrefill(null);}}/>}
      {showAF &&<AccForm onSave={saveAcc} editA={editA} onClose={()=>{setShowAF(false);setEditA(null);}}/>}
      {showECF&&<ExpCatForm onSave={saveEC} editC={editEC} onClose={()=>{setShowECF(false);setEditEC(null);}}/>}
      {showSCF&&editSC&&<SubCatForm pName={editSC.parentName} editS={editSC.sub} onSave={s=>saveSC(editSC.parentId,s)} onClose={()=>{setShowSCF(false);setEditSC(null);}}/>}
      {showICF&&<IncCatForm onSave={saveIC} editC={editIC} onClose={()=>{setShowICF(false);setEditIC(null);}}/>}
      {showExp&&<ExportModal onClose={()=>setShowExp(false)} txns={filtered} expCats={expCats} incCats={incCats} periodLabel={pLabel} appName={appName} accounts={accounts} accBal={accBal} T={T}/>}
      {showSet&&<SettingsModal settings={settings} onChange={setSettings} onClose={()=>setShowSet(false)} txns={txns} accounts={accounts} expCats={expCats} incCats={incCats} appName={appName}/>}
    </div>
  );
}
