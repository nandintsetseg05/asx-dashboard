import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

/* ── Seeded PRNG ────────────────────────────────────────────────────── */
function makePrng(seed = 0xdeadbeef) {
  let s = seed;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makePrng(20260310);
function gauss(mean, std) {
  const u = Math.max(rng(), 1e-10), v = rng();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ── Portfolio Data ─────────────────────────────────────────────────── */
const RAW = [
  { ticker:"CBA.AX", name:"Commonwealth Bank",   sector:"Financials",     color:"#f59e0b", shares:45,  avgCost:108.20, price:125.40, beta:1.05, divYield:3.8 },
  { ticker:"BHP.AX", name:"BHP Group",            sector:"Materials",      color:"#3b82f6", shares:120, avgCost:43.10,  price:46.80,  beta:1.18, divYield:5.1 },
  { ticker:"CSL.AX", name:"CSL Limited",          sector:"Healthcare",     color:"#10b981", shares:18,  avgCost:285.00, price:312.50, beta:0.72, divYield:1.2 },
  { ticker:"WES.AX", name:"Wesfarmers",           sector:"Consumer Disc.", color:"#8b5cf6", shares:85,  avgCost:65.40,  price:72.10,  beta:0.88, divYield:3.5 },
  { ticker:"NAB.AX", name:"Natl. Australia Bank", sector:"Financials",     color:"#ef4444", shares:95,  avgCost:32.80,  price:35.90,  beta:1.02, divYield:5.3 },
];

const holdings = RAW.map(h => ({
  ...h,
  value:  +(h.shares * h.price).toFixed(2),
  cost:   +(h.shares * h.avgCost).toFixed(2),
  pnl:    +(h.shares * (h.price - h.avgCost)).toFixed(2),
  pnlPct: +(((h.price - h.avgCost) / h.avgCost) * 100).toFixed(2),
}));
const totalValue = +holdings.reduce((s, h) => s + h.value, 0).toFixed(2);
const totalCost  = +holdings.reduce((s, h) => s + h.cost,  0).toFixed(2);
const totalPnL   = +(totalValue - totalCost).toFixed(2);
const portfolioH = holdings.map(h => ({ ...h, weight: +((h.value / totalValue) * 100).toFixed(1) }));

/* ── Equity Curve ───────────────────────────────────────────────────── */
function buildEquityCurve() {
  const DAYS = 252, MU = 0.00073, SIGMA = 0.0085;
  let v = totalValue * 0.80;
  const curve = [];
  const base = new Date("2025-03-10");
  let day = 0;
  while (curve.length < DAYS) {
    const d = new Date(base); d.setDate(d.getDate() + day++);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    v *= (1 + gauss(MU, SIGMA));
    curve.push({ date: d.toLocaleDateString("en-AU", { month:"short", day:"numeric" }), value: Math.round(v) });
  }
  curve[curve.length - 1].value = Math.round(totalValue);
  return curve;
}
const equityCurve = buildEquityCurve();

/* ── Risk Metrics ───────────────────────────────────────────────────── */
const dailyRets = equityCurve.map((d,i,a) => i===0 ? 0 : (d.value - a[i-1].value)/a[i-1].value).slice(1);
const sorted    = [...dailyRets].sort((a,b) => a - b);
const n         = dailyRets.length;
const mu        = dailyRets.reduce((s,v) => s+v, 0) / n;
const sigma     = Math.sqrt(dailyRets.reduce((s,v) => s+(v-mu)**2, 0) / n);
const VaR95     = +(sorted[Math.floor(n * 0.05)] * 100).toFixed(2);
const VaR99     = +(sorted[Math.floor(n * 0.01)] * 100).toFixed(2);
const CVaR95    = +(sorted.slice(0, Math.floor(n*0.05)).reduce((s,v) => s+v, 0) / Math.floor(n*0.05) * 100).toFixed(2);
const annRet    = +(mu * 252 * 100).toFixed(2);
const annVol    = +(sigma * Math.sqrt(252) * 100).toFixed(2);
const sharpe    = +((mu * 252 - 0.043) / (sigma * Math.sqrt(252))).toFixed(2);
const sortino   = +((mu * 252 - 0.043) / (Math.sqrt(dailyRets.filter(r=>r<0).reduce((s,v)=>s+v**2,0)/n) * Math.sqrt(252))).toFixed(2);
const maxDD     = (() => {
  let peak = -Infinity, mdd = 0;
  equityCurve.forEach(d => { if(d.value > peak) peak = d.value; mdd = Math.min(mdd, (d.value-peak)/peak); });
  return +(mdd * 100).toFixed(2);
})();

/* ── VaR Histogram ──────────────────────────────────────────────────── */
const varHistogram = (() => {
  const BINS = 28;
  const lo = Math.min(...dailyRets), hi = Math.max(...dailyRets);
  const w = (hi - lo) / BINS;
  const bins = Array.from({length:BINS}, (_,i) => ({
    x: +((lo + (i+0.5)*w) * 100).toFixed(2),
    count: 0,
    tail: (lo + (i+1)*w) <= sorted[Math.floor(n*0.05)],
  }));
  dailyRets.forEach(r => { bins[Math.min(Math.floor((r-lo)/w), BINS-1)].count++; });
  return bins;
})();

/* ── Sector Data ────────────────────────────────────────────────────── */
const sectorMap = {};
portfolioH.forEach(h => { sectorMap[h.sector] = +(((sectorMap[h.sector]||0) + h.weight)).toFixed(1); });
const sectorData = Object.entries(sectorMap).map(([name, value]) => ({ name, value }));
const SECTOR_COLORS = ["#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444"];

/* ── Scenarios ──────────────────────────────────────────────────────── */
const SCENARIOS = [
  { id:1, name:"GFC",         label:"GFC (Sep 2008)",        impact:-43.8, desc:"Lehman Brothers collapse triggers global credit freeze." },
  { id:2, name:"COVID",       label:"COVID Crash (Mar 2020)", impact:-31.2, desc:"Pandemic shock sees ASX 200 lose 36% in 23 trading days." },
  { id:3, name:"Rate Hike",   label:"Rate Hike Cycle (2022)", impact:-19.5, desc:"RBA raises cash rate from 0.1% to 4.35% in 13 months." },
  { id:4, name:"Correction",  label:"ASX Correction (Mild)",  impact:-12.0, desc:"Typical 10–15% correction, mean-reverts within 6 months." },
  { id:5, name:"Bull Market", label:"Bull Run (Optimistic)",  impact: +8.5, desc:"China stimulus + RBA cuts fuel resources & financials rally." },
];

/* ── Helpers ────────────────────────────────────────────────────────── */
const fmt$   = v => new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD",minimumFractionDigits:0,maximumFractionDigits:0}).format(v);
const fmtPct = v => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

/* ── Tooltips ───────────────────────────────────────────────────────── */
const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff", border:"1px solid #e2e8f0", padding:"8px 12px", borderRadius:8, fontSize:12, fontFamily:"'DM Mono',monospace", boxShadow:"0 4px 12px rgba(0,0,0,0.1)" }}>
      <div style={{ color:"#94a3b8", marginBottom:2 }}>{payload[0]?.payload?.date}</div>
      <div style={{ color:"#f59e0b", fontWeight:700 }}>{fmt$(payload[0]?.value)}</div>
    </div>
  );
};
const HistTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff", border:"1px solid #e2e8f0", padding:"8px 12px", borderRadius:8, fontSize:12, fontFamily:"'DM Mono',monospace", boxShadow:"0 4px 12px rgba(0,0,0,0.1)" }}>
      <div style={{ color:"#64748b" }}>Return: {payload[0]?.payload?.x}%</div>
      <div style={{ color:"#1e293b", fontWeight:600 }}>Days: {payload[0]?.value}</div>
    </div>
  );
};
const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff", border:"1px solid #e2e8f0", padding:"8px 12px", borderRadius:8, fontSize:12, fontFamily:"'DM Mono',monospace", boxShadow:"0 4px 12px rgba(0,0,0,0.1)" }}>
      <div style={{ color:"#1e293b", fontWeight:600 }}>{payload[0]?.name}</div>
      <div style={{ color:"#f59e0b", fontWeight:700 }}>{payload[0]?.value}%</div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [activeScenario,  setActiveScenario]  = useState(null);
  const [selectedHolding, setSelectedHolding] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin:0; padding:0; }
        body { background: #f1f5f9; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius:2px; }
        .dash-root { font-family:'DM Mono', monospace; background:#f1f5f9; min-height:100vh; color:#1e293b; }
        .card { background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,0.06); }
        .kpi-card { background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:16px 20px; transition:all 0.2s; box-shadow:0 1px 4px rgba(0,0,0,0.06); }
        .kpi-card:hover { border-color:#f59e0b; box-shadow:0 4px 16px rgba(245,158,11,0.12); transform:translateY(-1px); }
        .holding-row { border-bottom:1px solid #f1f5f9; cursor:pointer; transition:background 0.15s; }
        .holding-row:hover { background:#fefce8; }
        .holding-row.active { background:#fffbeb; border-left:3px solid #f59e0b; }
        .scenario-card { border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; cursor:pointer; transition:all 0.15s; background:#fff; }
        .scenario-card:hover { border-color:#cbd5e1; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
        .scenario-card.active-pos { border-color:#10b981; background:#f0fdf4; box-shadow:0 2px 8px rgba(16,185,129,0.12); }
        .scenario-card.active-neg { border-color:#ef4444; background:#fef2f2; box-shadow:0 2px 8px rgba(239,68,68,0.12); }
        .tag { font-size:9px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; padding:3px 8px; border-radius:20px; }
        .badge-red   { background:#fee2e2; color:#dc2626; }
        .badge-green { background:#dcfce7; color:#16a34a; }
        .badge-amber { background:#fef3c7; color:#d97706; }
        .section-label { font-family:'Syne', sans-serif; font-size:10px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:#94a3b8; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
        .section-label::before { content:''; display:block; width:3px; height:12px; background:#f59e0b; border-radius:2px; }
        .divider { border:none; border-top:1px solid #f1f5f9; }
        .metric-row { display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px solid #f8fafc; }
        .metric-row:last-child { border:none; }
      `}</style>

      <div className="dash-root" style={{ padding:"0 0 40px 0" }}>

        {/* ── HEADER ────────────────────────────────────────────────── */}
        <div style={{ background:"#ffffff", borderBottom:"1px solid #e2e8f0", padding:"0 28px", display:"flex", alignItems:"center", justifyContent:"space-between", height:58, boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:18, color:"#1e293b", letterSpacing:"0.02em" }}>
              ASX<span style={{ color:"#f59e0b" }}>·</span><span style={{ color:"#3b82f6" }}>ANALYTICS</span>
            </div>
            <div style={{ width:1, height:22, background:"#e2e8f0" }} />
            <span style={{ fontSize:10, color:"#94a3b8", letterSpacing:"0.12em", textTransform:"uppercase" }}>Portfolio Risk Dashboard</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"#f0fdf4", padding:"5px 12px", borderRadius:20, border:"1px solid #bbf7d0" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#10b981" }} />
              <span style={{ fontSize:10, color:"#16a34a", fontWeight:600 }}>LIVE SIM</span>
            </div>
            <span style={{ fontSize:11, color:"#64748b", fontFamily:"'DM Mono', monospace" }}>
              {now.toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short",year:"numeric"})} · {now.toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit",second:"2-digit"})} AEST
            </span>
          </div>
        </div>

        <div style={{ padding:"24px 28px", display:"flex", flexDirection:"column", gap:20 }}>

          {/* ── KPI STRIP ───────────────────────────────────────────── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14 }}>
            {[
              { label:"Portfolio Value", value:fmt$(totalValue),               sub:"Total AUD",                          accent:"#1e293b",  bg:"#fff" },
              { label:"Total P&L",       value:fmtPct((totalPnL/totalCost)*100), sub:fmt$(totalPnL),                    accent:totalPnL>0?"#16a34a":"#dc2626", bg:totalPnL>0?"#f0fdf4":"#fef2f2" },
              { label:"Sharpe Ratio",    value:sharpe.toFixed(2),              sub:`Sortino ${sortino.toFixed(2)}`,      accent:sharpe>1?"#16a34a":"#d97706",   bg:sharpe>1?"#f0fdf4":"#fffbeb" },
              { label:"VaR (95%)",       value:`${VaR95}%`,                    sub:`VaR 99%: ${VaR99}%`,                accent:"#dc2626",  bg:"#fef2f2" },
              { label:"Ann. Volatility", value:`${annVol}%`,                   sub:`Return ${fmtPct(annRet)}`,          accent:"#d97706",  bg:"#fffbeb" },
            ].map((kpi,i) => (
              <div key={i} className="kpi-card" style={{ background:kpi.bg }}>
                <div style={{ fontSize:9, color:"#94a3b8", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>{kpi.label}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, color:kpi.accent, letterSpacing:"-0.02em", lineHeight:1 }}>{kpi.value}</div>
                <div style={{ fontSize:11, color:"#64748b", marginTop:5 }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* ── MAIN ROW ──────────────────────────────────────────────── */}
          <div style={{ display:"grid", gridTemplateColumns:"420px 1fr", gap:16 }}>

            {/* Holdings */}
            <div className="card" style={{ padding:"18px 0" }}>
              <div style={{ padding:"0 18px 12px" }}><div className="section-label">Holdings</div></div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 72px 72px 80px", padding:"0 18px 8px", gap:4 }}>
                {["Ticker / Name","Value","Weight","P&L"].map(h => (
                  <div key={h} style={{ fontSize:9, color:"#94a3b8", letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600 }}>{h}</div>
                ))}
              </div>
              {portfolioH.map(h => (
                <div
                  key={h.ticker}
                  className={`holding-row ${selectedHolding?.ticker === h.ticker ? "active" : ""}`}
                  onClick={() => setSelectedHolding(selectedHolding?.ticker === h.ticker ? null : h)}
                  style={{ display:"grid", gridTemplateColumns:"1fr 72px 72px 80px", padding:"10px 18px", gap:4, alignItems:"center" }}
                >
                  <div>
                    <div style={{ fontSize:12, color:"#1e293b", fontWeight:600, marginBottom:2, display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:h.color }} />
                      {h.ticker.replace(".AX","")}
                    </div>
                    <div style={{ fontSize:10, color:"#94a3b8" }}>{h.name}</div>
                  </div>
                  <div style={{ fontSize:11, color:"#334155", fontWeight:500 }}>{fmt$(h.value)}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ width:h.weight * 2, height:5, background:h.color, borderRadius:3, opacity:0.8 }} />
                    <span style={{ fontSize:11, color:"#64748b" }}>{h.weight}%</span>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:h.pnl>=0?"#16a34a":"#dc2626", fontWeight:600 }}>{fmtPct(h.pnlPct)}</div>
                    <div style={{ fontSize:9, color:"#94a3b8" }}>{fmt$(h.pnl)}</div>
                  </div>
                </div>
              ))}
              <hr className="divider" style={{ margin:"12px 0" }} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 72px 72px 80px", padding:"8px 18px", gap:4, alignItems:"center" }}>
                <div style={{ fontSize:11, color:"#f59e0b", fontWeight:700 }}>TOTAL</div>
                <div style={{ fontSize:11, color:"#1e293b", fontWeight:600 }}>{fmt$(totalValue)}</div>
                <div style={{ fontSize:11, color:"#64748b" }}>100%</div>
                <div>
                  <div style={{ fontSize:11, color:totalPnL>=0?"#16a34a":"#dc2626", fontWeight:700 }}>{fmtPct((totalPnL/totalCost)*100)}</div>
                  <div style={{ fontSize:9, color:"#94a3b8" }}>{fmt$(totalPnL)}</div>
                </div>
              </div>
              <hr className="divider" style={{ margin:"10px 0" }} />
              <div style={{ padding:"0 18px" }}>
                <div className="section-label" style={{ marginBottom:10 }}>Risk Attributes</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {[
                    { label:"Portfolio Beta", value:(+portfolioH.reduce((s,h) => s+h.beta*(h.weight/100), 0)).toFixed(2), color:"#f59e0b" },
                    { label:"Max Drawdown",   value:`${maxDD}%`,   color:"#ef4444" },
                    { label:"CVaR (95%)",     value:`${CVaR95}%`,  color:"#8b5cf6" },
                  ].map((m,i) => (
                    <div key={i} style={{ background:"#f8fafc", borderRadius:8, padding:"10px", border:"1px solid #e2e8f0" }}>
                      <div style={{ fontSize:9, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>{m.label}</div>
                      <div style={{ fontSize:16, color:m.color, fontWeight:800, fontFamily:"'Syne',sans-serif" }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Equity Curve */}
            <div className="card" style={{ padding:"18px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                <div>
                  <div className="section-label">Portfolio Performance — 252 Trading Days</div>
                  <div style={{ fontSize:10, color:"#94a3b8" }}>Mar 2025 → Mar 2026 · Simulated equity curve</div>
                </div>
                <div style={{ textAlign:"right", background:"#f0fdf4", padding:"8px 14px", borderRadius:10, border:"1px solid #bbf7d0" }}>
                  <div style={{ fontSize:22, fontFamily:"'Syne',sans-serif", fontWeight:800, color:"#16a34a" }}>{fmtPct(annRet)}</div>
                  <div style={{ fontSize:9, color:"#86efac" }}>Annual Return</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={equityCurve} margin={{ top:4, right:4, bottom:0, left:8 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill:"#94a3b8", fontSize:9, fontFamily:"'DM Mono',monospace" }} tickLine={false} axisLine={{ stroke:"#e2e8f0" }} interval={29} />
                  <YAxis tick={{ fill:"#94a3b8", fontSize:9, fontFamily:"'DM Mono',monospace" }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2.5} fill="url(#grad)" dot={false} activeDot={{ r:5, fill:"#f59e0b", stroke:"#fff", strokeWidth:2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── LOWER ROW ─────────────────────────────────────────────── */}
          <div style={{ display:"grid", gridTemplateColumns:"260px 1fr 340px", gap:16 }}>

            {/* Sector Allocation */}
            <div className="card" style={{ padding:"18px" }}>
              <div className="section-label">Sector Allocation</div>
              <div style={{ display:"flex", justifyContent:"center", margin:"4px 0 12px" }}>
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={sectorData} cx="50%" cy="50%" innerRadius={50} outerRadius={82} paddingAngle={3} dataKey="value">
                      {sectorData.map((_,i) => <Cell key={i} fill={SECTOR_COLORS[i]} stroke="transparent" />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {sectorData.map((s,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:10, height:10, borderRadius:3, background:SECTOR_COLORS[i] }} />
                      <span style={{ fontSize:11, color:"#475569" }}>{s.name}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:50, height:5, background:"#f1f5f9", borderRadius:3, overflow:"hidden" }}>
                        <div style={{ width:`${s.value}%`, height:"100%", background:SECTOR_COLORS[i], borderRadius:3 }} />
                      </div>
                      <span style={{ fontSize:11, color:"#1e293b", fontWeight:600 }}>{s.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* VaR Histogram */}
            <div className="card" style={{ padding:"18px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                <div>
                  <div className="section-label">Return Distribution & Value at Risk</div>
                  <div style={{ fontSize:10, color:"#94a3b8" }}>Daily P&L distribution · Historical simulation (252d)</div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <span className="tag badge-red">VaR 95%: {VaR95}%</span>
                  <span className="tag badge-red">VaR 99%: {VaR99}%</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={varHistogram} margin={{ top:4, right:4, bottom:0, left:8 }} barCategoryGap={1}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="x" tick={{ fill:"#94a3b8", fontSize:9, fontFamily:"'DM Mono',monospace" }} tickLine={false} axisLine={{ stroke:"#e2e8f0" }} tickFormatter={v => `${v}%`} interval={5} />
                  <YAxis tick={{ fill:"#94a3b8", fontSize:9 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip content={<HistTooltip />} />
                  <ReferenceLine x={VaR95.toString()} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} label={{ value:"VaR 95%", fill:"#ef4444", fontSize:9, position:"top" }} />
                  <ReferenceLine x={VaR99.toString()} stroke="#dc2626" strokeDasharray="4 2" strokeWidth={1.5} label={{ value:"99%", fill:"#dc2626", fontSize:9, position:"insideTop" }} />
                  <Bar dataKey="count" radius={[3,3,0,0]}>
                    {varHistogram.map((entry,i) => (
                      <Cell key={i} fill={entry.tail ? "#ef4444" : "#bfdbfe"} fillOpacity={entry.tail ? 0.9 : 0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:14 }}>
                {[
                  { label:"CVaR (95%)",    value:`${CVaR95}%`,  note:"Expected shortfall", color:"#ef4444" },
                  { label:"Ann. Vol",      value:`${annVol}%`,  note:"Historical 1Y",       color:"#f59e0b" },
                  { label:"Portfolio Beta",value:(+portfolioH.reduce((s,h) => s+h.beta*(h.weight/100), 0)).toFixed(2), note:"vs. ASX 200", color:"#3b82f6" },
                ].map((m,i) => (
                  <div key={i} style={{ background:"#f8fafc", borderRadius:8, padding:"10px", border:"1px solid #e2e8f0" }}>
                    <div style={{ fontSize:9, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>{m.label}</div>
                    <div style={{ fontSize:18, fontFamily:"'Syne',sans-serif", fontWeight:800, color:m.color }}>{m.value}</div>
                    <div style={{ fontSize:9, color:"#94a3b8" }}>{m.note}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stress Tests */}
            <div className="card" style={{ padding:"18px" }}>
              <div className="section-label">Stress-Test Scenarios</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {SCENARIOS.map(sc => {
                  const loss = totalValue * (sc.impact/100);
                  const isPos = sc.impact > 0;
                  const isActive = activeScenario?.id === sc.id;
                  return (
                    <div key={sc.id} className={`scenario-card ${isActive ? (isPos ? "active-pos" : "active-neg") : ""}`} onClick={() => setActiveScenario(isActive ? null : sc)}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                        <span style={{ fontSize:11, color:"#334155", fontWeight:600 }}>{sc.name}</span>
                        <span style={{ fontSize:13, fontFamily:"'Syne',sans-serif", fontWeight:800, color:isPos?"#16a34a":"#dc2626" }}>{fmtPct(sc.impact)}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:9, color:"#94a3b8" }}>{sc.label}</span>
                        <span style={{ fontSize:10, color:isPos?"#16a34a":"#dc2626", fontWeight:600 }}>{isPos?"+":""}{fmt$(loss)}</span>
                      </div>
                      {isActive && (
                        <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #e2e8f0" }}>
                          <div style={{ fontSize:9, color:"#64748b", lineHeight:1.7 }}>{sc.desc}</div>
                          <div style={{ display:"flex", gap:8, marginTop:10 }}>
                            <div style={{ flex:1, background:"#f8fafc", borderRadius:8, padding:"8px", border:"1px solid #e2e8f0" }}>
                              <div style={{ fontSize:8, color:"#94a3b8", textTransform:"uppercase", marginBottom:2 }}>Portfolio After</div>
                              <div style={{ fontSize:13, color:isPos?"#16a34a":"#dc2626", fontFamily:"'Syne',sans-serif", fontWeight:800 }}>{fmt$(totalValue+loss)}</div>
                            </div>
                            <div style={{ flex:1, background:"#f8fafc", borderRadius:8, padding:"8px", border:"1px solid #e2e8f0" }}>
                              <div style={{ fontSize:8, color:"#94a3b8", textTransform:"uppercase", marginBottom:2 }}>Impact</div>
                              <div style={{ fontSize:13, color:isPos?"#16a34a":"#dc2626", fontFamily:"'Syne',sans-serif", fontWeight:800 }}>{fmt$(loss)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop:12, padding:"12px", background:"#f8fafc", borderRadius:10, border:"1px solid #e2e8f0" }}>
                <div style={{ fontSize:9, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>CFA-Style Attribution</div>
                <div className="metric-row"><span style={{ fontSize:10, color:"#64748b" }}>Selection Effect</span><span style={{ fontSize:11, color:"#16a34a", fontWeight:600 }}>+4.32%</span></div>
                <div className="metric-row"><span style={{ fontSize:10, color:"#64748b" }}>Allocation Effect</span><span style={{ fontSize:11, color:"#d97706", fontWeight:600 }}>+2.18%</span></div>
                <div className="metric-row"><span style={{ fontSize:10, color:"#64748b" }}>Interaction Effect</span><span style={{ fontSize:11, color:"#ef4444", fontWeight:600 }}>−0.74%</span></div>
                <div className="metric-row" style={{ borderTop:"1px solid #e2e8f0", marginTop:6, paddingTop:10 }}>
                  <span style={{ fontSize:10, color:"#1e293b", fontWeight:600 }}>Active Return</span>
                  <span style={{ fontSize:13, color:"#16a34a", fontFamily:"'Syne',sans-serif", fontWeight:800 }}>+5.76%</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── FOOTER ────────────────────────────────────────────────── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:12 }}>
            {[
              { label:"Risk-Free Rate",  value:"4.30%",          note:"RBA Cash Rate",       color:"#1e293b" },
              { label:"Sharpe Ratio",    value:sharpe.toFixed(2), note:"Annualised",          color:sharpe>1?"#16a34a":"#d97706" },
              { label:"Sortino Ratio",   value:sortino.toFixed(2),note:"Downside risk-adj",   color:"#3b82f6" },
              { label:"Max Drawdown",    value:`${maxDD}%`,       note:"Peak-to-trough",      color:"#ef4444" },
              { label:"Avg Div Yield",   value:"+"+((portfolioH.reduce((s,h) => s+h.divYield*(h.weight/100), 0)).toFixed(2))+"%", note:"Weighted portfolio", color:"#8b5cf6" },
              { label:"Data Refresh",    value:"Weekly",          note:"Python + yfinance",   color:"#f59e0b" },
            ].map((m,i) => (
              <div key={i} className="card" style={{ padding:"12px 16px" }}>
                <div style={{ fontSize:9, color:"#8c9aad", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:5 }}>{m.label}</div>
                <div style={{ fontSize:16, fontFamily:"'Syne',sans-serif", fontWeight:800, color:m.color }}>{m.value}</div>
                <div style={{ fontSize:9, color:"#94a3b8", marginTop:2 }}>{m.note}</div>
              </div>
            ))}
          </div>

        </div>
      </div> 
    </>
  );
}