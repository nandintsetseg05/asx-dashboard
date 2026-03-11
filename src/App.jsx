import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

/* ── Constants ──────────────────────────────────────────────────────── */
const COLORS = ["#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444","#06b6d4","#f97316","#84cc16","#ec4899","#14b8a6"];

const ASX_SECTORS = {
  "CBA.AX":"Financials","NAB.AX":"Financials","WBC.AX":"Financials","ANZ.AX":"Financials",
  "MQG.AX":"Financials","SUN.AX":"Financials","QBE.AX":"Financials","IAG.AX":"Financials",
  "BHP.AX":"Materials","RIO.AX":"Materials","FMG.AX":"Materials","S32.AX":"Materials",
  "NCM.AX":"Materials","NST.AX":"Materials","IGO.AX":"Materials","LYC.AX":"Materials",
  "CSL.AX":"Healthcare","RMD.AX":"Healthcare","COH.AX":"Healthcare","SHL.AX":"Healthcare",
  "PME.AX":"Healthcare","NVX.AX":"Healthcare",
  "WES.AX":"Consumer Disc.","HVN.AX":"Consumer Disc.","JBH.AX":"Consumer Disc.","ALL.AX":"Consumer Disc.",
  "WOW.AX":"Consumer Staples","COL.AX":"Consumer Staples","TWE.AX":"Consumer Staples",
  "TLS.AX":"Communication","REA.AX":"Technology","XRO.AX":"Technology","WTC.AX":"Technology","APX.AX":"Technology",
  "ORG.AX":"Energy","WDS.AX":"Energy","STO.AX":"Energy","KAR.AX":"Energy",
  "APA.AX":"Utilities","AGL.AX":"Utilities",
};

const ASX_NAMES = {
  "CBA.AX":"Commonwealth Bank","NAB.AX":"Natl. Australia Bank","WBC.AX":"Westpac Banking",
  "ANZ.AX":"ANZ Bank","MQG.AX":"Macquarie Group","BHP.AX":"BHP Group","RIO.AX":"Rio Tinto",
  "FMG.AX":"Fortescue Metals","CSL.AX":"CSL Limited","RMD.AX":"ResMed Inc","WES.AX":"Wesfarmers",
  "WOW.AX":"Woolworths Group","COL.AX":"Coles Group","TLS.AX":"Telstra Group",
  "REA.AX":"REA Group","XRO.AX":"Xero Limited","ORG.AX":"Origin Energy",
  "S32.AX":"South32","COH.AX":"Cochlear","SHL.AX":"Sonic Healthcare",
  "AGL.AX":"AGL Energy","QBE.AX":"QBE Insurance","SUN.AX":"Suncorp Group",
};

const SCENARIOS = [
  { id:1, name:"GFC",        label:"GFC (Sep 2008)",        impact:-43.8, desc:"Lehman Brothers collapse triggers global credit freeze." },
  { id:2, name:"COVID",      label:"COVID Crash (Mar 2020)", impact:-31.2, desc:"Pandemic shock — ASX 200 loses 36% in 23 trading days." },
  { id:3, name:"Rate Hike",  label:"Rate Hike Cycle (2022)", impact:-19.5, desc:"RBA raises cash rate from 0.1% to 4.35% in 13 months." },
  { id:4, name:"Correction", label:"ASX Correction (Mild)",  impact:-12.0, desc:"Typical 10–15% pullback, mean-reverts within 6 months." },
  { id:5, name:"Bull Run",   label:"Bull Run (Optimistic)",  impact:+8.5,  desc:"China stimulus + RBA cuts fuel resources & banks rally." },
];

const DEFAULT_PORTFOLIO = [
  { id:1, ticker:"CBA.AX", shares:"45",  avgCost:"108.20" },
  { id:2, ticker:"BHP.AX", shares:"120", avgCost:"43.10"  },
  { id:3, ticker:"CSL.AX", shares:"18",  avgCost:"285.00" },
  { id:4, ticker:"WES.AX", shares:"85",  avgCost:"65.40"  },
  { id:5, ticker:"NAB.AX", shares:"95",  avgCost:"32.80"  },
];

/* ── Helpers ────────────────────────────────────────────────────────── */
const fmt$   = v => new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD",minimumFractionDigits:0,maximumFractionDigits:0}).format(v);
const fmtPct = v => `${v>0?"+":""}${v.toFixed(2)}%`;
const sleep  = ms => new Promise(r => setTimeout(r, ms));

function normalizeTicker(t) {
  const u = t.trim().toUpperCase();
  return u.endsWith(".AX") ? u : `${u}.AX`;
}

/* seeded PRNG for fallback simulation */
function makePrng(seed=0xdeadbeef){let s=seed;return()=>{s=Math.imul(s^(s>>>15),s|1);s^=s+Math.imul(s^(s>>>7),s|61);return((s^(s>>>14))>>>0)/4294967296;};}
const rng=makePrng(20260310);
function gauss(m,std){const u=Math.max(rng(),1e-10),v=rng();return m+std*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}

function buildSimCurve(startVal) {
  let v = startVal * 0.80;
  const curve = [], base = new Date("2025-03-10");
  let day = 0;
  while (curve.length < 252) {
    const d = new Date(base); d.setDate(d.getDate()+day++);
    if (d.getDay()===0||d.getDay()===6) continue;
    v *= (1+gauss(0.00073,0.0085));
    curve.push({ date:d.toLocaleDateString("en-AU",{month:"short",day:"numeric"}), value:Math.round(v) });
  }
  curve[curve.length-1].value = Math.round(startVal);
  return curve;
}

function calcMetrics(equityCurve) {
  if (equityCurve.length < 10) return {};
  const dailyRets = equityCurve.map((d,i,a)=>i===0?0:(d.value-a[i-1].value)/a[i-1].value).slice(1);
  const sorted=[...dailyRets].sort((a,b)=>a-b), n=dailyRets.length;
  const mu=dailyRets.reduce((s,v)=>s+v,0)/n;
  const sigma=Math.sqrt(dailyRets.reduce((s,v)=>s+(v-mu)**2,0)/n);
  const VaR95=+(sorted[Math.floor(n*0.05)]*100).toFixed(2);
  const VaR99=+(sorted[Math.floor(n*0.01)]*100).toFixed(2);
  const CVaR95=+(sorted.slice(0,Math.floor(n*0.05)).reduce((s,v)=>s+v,0)/Math.floor(n*0.05)*100).toFixed(2);
  const annRet=+(mu*252*100).toFixed(2);
  const annVol=+(sigma*Math.sqrt(252)*100).toFixed(2);
  const sharpe=+((mu*252-0.043)/(sigma*Math.sqrt(252))).toFixed(2);
  const downDev=Math.sqrt(dailyRets.filter(r=>r<0).reduce((s,v)=>s+v**2,0)/n);
  const sortino=+((mu*252-0.043)/(downDev*Math.sqrt(252))).toFixed(2);
  const maxDD=(() => { let peak=-Infinity,mdd=0; equityCurve.forEach(d=>{if(d.value>peak)peak=d.value;mdd=Math.min(mdd,(d.value-peak)/peak);}); return +(mdd*100).toFixed(2); })();
  const BINS=28,lo=Math.min(...dailyRets),hi=Math.max(...dailyRets),w=(hi-lo)/BINS;
  const varHistogram=Array.from({length:BINS},(_,i)=>({x:+((lo+(i+0.5)*w)*100).toFixed(2),count:0,tail:(lo+(i+1)*w)<=sorted[Math.floor(n*0.05)]}));
  dailyRets.forEach(r=>{varHistogram[Math.min(Math.floor((r-lo)/w),BINS-1)].count++;});
  return {VaR95,VaR99,CVaR95,annRet,annVol,sharpe,sortino,maxDD,varHistogram};
}

/* ── Tooltip components (OUTSIDE App to avoid render error) ─────────── */
const ChartTooltip=({active,payload})=>{
  if(!active||!payload?.length) return null;
  return(<div style={{background:"#fff",border:"1px solid #e2e8f0",padding:"8px 12px",borderRadius:8,fontSize:12,fontFamily:"'DM Mono',monospace",boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}><div style={{color:"#94a3b8",marginBottom:2}}>{payload[0]?.payload?.date}</div><div style={{color:"#f59e0b",fontWeight:700}}>{fmt$(payload[0]?.value)}</div></div>);
};
const HistTooltip=({active,payload})=>{
  if(!active||!payload?.length) return null;
  return(<div style={{background:"#fff",border:"1px solid #e2e8f0",padding:"8px 12px",borderRadius:8,fontSize:12,fontFamily:"'DM Mono',monospace",boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}><div style={{color:"#64748b"}}>Return: {payload[0]?.payload?.x}%</div><div style={{color:"#1e293b",fontWeight:600}}>Days: {payload[0]?.value}</div></div>);
};
const PieTooltip=({active,payload})=>{
  if(!active||!payload?.length) return null;
  return(<div style={{background:"#fff",border:"1px solid #e2e8f0",padding:"8px 12px",borderRadius:8,fontSize:12,fontFamily:"'DM Mono',monospace",boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}><div style={{color:"#1e293b",fontWeight:600}}>{payload[0]?.name}</div><div style={{color:"#f59e0b",fontWeight:700}}>{payload[0]?.value}%</div></div>);
};

/* ════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [view,            setView]            = useState("builder");
  const [portfolio,       setPortfolio]       = useState(DEFAULT_PORTFOLIO);
  const [holdings,        setHoldings]        = useState([]);
  const [equityCurve,     setEquityCurve]     = useState([]);
  const [metrics,         setMetrics]         = useState({});
  const [loading,         setLoading]         = useState(false);
  const [loadingMsg,      setLoadingMsg]      = useState("");
  const [error,           setError]           = useState(null);
  const [dataSource,      setDataSource]      = useState("simulated");
  const [activeScenario,  setActiveScenario]  = useState(null);
  const [selectedHolding, setSelectedHolding] = useState(null);
  const [now,             setNow]             = useState(new Date());

  useEffect(()=>{ const id=setInterval(()=>setNow(new Date()),1000); return()=>clearInterval(id); },[]);

  /* ── Portfolio CRUD ──────────────────────────────────────────────── */
  const addStock = () => setPortfolio(p=>[...p,{id:Date.now(),ticker:"",shares:"",avgCost:""}]);
  const removeStock = id => setPortfolio(p=>p.filter(s=>s.id!==id));
  const updateStock = (id,field,val) => setPortfolio(p=>p.map(s=>s.id===id?{...s,[field]:val}:s));

  /* ── Fetch live data ─────────────────────────────────────────────── */
  async function analyzePortfolio() {
    const valid = portfolio.filter(p=>p.ticker.trim()&&parseFloat(p.shares)>0&&parseFloat(p.avgCost)>0);
    if (valid.length===0){ setError("Add at least one stock with shares and buy price."); return; }
    setLoading(true); setError(null);

    const results = {};
    let anyLive = false;

    for (let i=0; i<valid.length; i++) {
      const ticker = normalizeTicker(valid[i].ticker);
      setLoadingMsg(`Fetching ${ticker} (${i+1}/${valid.length})…`);
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`;
        const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxy);
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (!result) throw new Error("no data");
        const meta = result.meta;
        const timestamps = result.timestamp||[];
        const closes = result.indicators?.quote?.[0]?.close||[];
        const history = timestamps.map((ts,idx)=>({
          date: new Date(ts*1000).toISOString().split("T")[0],
          close: closes[idx]||null,
        })).filter(d=>d.close!==null);
        results[ticker] = { price: meta.regularMarketPrice||history.at(-1)?.close, name: meta.shortName, history };
        anyLive = true;
      } catch(e) {
        console.warn(`Could not fetch ${normalizeTicker(valid[i].ticker)}:`, e.message);
        results[normalizeTicker(valid[i].ticker)] = null;
      }
      if (i<valid.length-1) await sleep(450);
    }

    /* Build holdings */
    const enriched = valid.map((p,idx)=>{
      const ticker  = normalizeTicker(p.ticker);
      const live    = results[ticker];
      const shares  = parseFloat(p.shares);
      const avgCost = parseFloat(p.avgCost);
      const price   = live?.price ?? avgCost;
      return {
        ticker, shares, avgCost, price,
        name:    live?.name || ASX_NAMES[ticker] || ticker.replace(".AX",""),
        sector:  ASX_SECTORS[ticker] || "Other",
        color:   COLORS[idx%COLORS.length],
        value:   +(shares*price).toFixed(2),
        cost:    +(shares*avgCost).toFixed(2),
        pnl:     +(shares*(price-avgCost)).toFixed(2),
        pnlPct:  +(((price-avgCost)/avgCost)*100).toFixed(2),
        beta:    1.0, divYield:0,
        history: live?.history||[],
      };
    });
    const totalValue = +enriched.reduce((s,h)=>s+h.value,0).toFixed(2);
    const withWeight = enriched.map(h=>({...h,weight:+((h.value/totalValue)*100).toFixed(1)}));

    /* Build equity curve */
    setLoadingMsg("Building equity curve…");
    let curve = [];
    if (anyLive) {
      const priceMaps = {};
      withWeight.forEach(h=>{ priceMaps[h.ticker]={}; h.history.forEach(d=>{priceMaps[h.ticker][d.date]=d.close;}); });
      const allDates = [...new Set(withWeight.flatMap(h=>h.history.map(d=>d.date)))].sort().slice(-252);
      curve = allDates.map(date=>{
        let val=0;
        withWeight.forEach(h=>{ const p=priceMaps[h.ticker][date]; if(p) val+=p*h.shares; });
        return { date:new Date(date).toLocaleDateString("en-AU",{month:"short",day:"numeric"}), value:Math.round(val) };
      }).filter(d=>d.value>0);
    }
    if (curve.length<20) curve = buildSimCurve(totalValue);

    setHoldings(withWeight);
    setEquityCurve(curve);
    setMetrics(calcMetrics(curve));
    setDataSource(anyLive?"live":"simulated");
    setLoading(false); setLoadingMsg("");
    setView("dashboard");
  }

  /* ── Derived ─────────────────────────────────────────────────────── */
  const totalValue = +holdings.reduce((s,h)=>s+h.value,0).toFixed(2);
  const totalCost  = +holdings.reduce((s,h)=>s+h.cost, 0).toFixed(2);
  const totalPnL   = +(totalValue-totalCost).toFixed(2);
  const sectorMap  = {};
  holdings.forEach(h=>{ sectorMap[h.sector]=+(((sectorMap[h.sector]||0)+h.weight)).toFixed(1); });
  const sectorData = Object.entries(sectorMap).map(([name,value])=>({name,value: parseFloat(value)}));
  const {VaR95,VaR99,CVaR95,annRet,annVol,sharpe,sortino,maxDD,varHistogram} = metrics;
  const portfolioBeta = (+holdings.reduce((s,h)=>s+(h.beta||1)*(h.weight/100),0)).toFixed(2);

  /* ══════════════════════════════════════════════════════════════════ */
  /*  PORTFOLIO BUILDER VIEW                                           */
  /* ══════════════════════════════════════════════════════════════════ */
  if (view==="builder") return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#f1f5f9;}
        .builder-root{font-family:'DM Mono',monospace;background:#f1f5f9;min-height:100vh;color:#1e293b;}
        .builder-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .stock-input{width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-family:'DM Mono',monospace;font-size:12px;color:#1e293b;outline:none;transition:border 0.15s;}
        .stock-input:focus{border-color:#f59e0b;background:#fff;}
        .btn-primary{background:#f59e0b;color:#fff;border:none;border-radius:10px;padding:12px 28px;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all 0.15s;letter-spacing:0.02em;}
        .btn-primary:hover{background:#d97706;transform:translateY(-1px);box-shadow:0 4px 12px rgba(245,158,11,0.3);}
        .btn-primary:disabled{background:#94a3b8;transform:none;box-shadow:none;cursor:not-allowed;}
        .btn-add{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:8px;padding:8px 16px;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:all 0.15s;}
        .btn-add:hover{background:#dcfce7;}
        .btn-remove{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:6px 10px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all 0.15s;}
        .btn-remove:hover{background:#fee2e2;}
        @media(max-width:640px){
          .builder-grid{grid-template-columns:1fr 80px 90px 36px!important;}
          .builder-header-grid{grid-template-columns:1fr 80px 90px 36px!important;}
        }
      `}</style>
      <div className="builder-root">
        {/* Header */}
        <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 24px",display:"flex",alignItems:"center",height:56,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:"#1e293b"}}>
            ASX<span style={{color:"#f59e0b"}}>·</span><span style={{color:"#3b82f6"}}>ANALYTICS</span>
          </div>
        </div>

        <div style={{maxWidth:760,margin:"0 auto",padding:"32px 16px"}}>
          {/* Title */}
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,color:"#1e293b",marginBottom:8}}>Build Your Portfolio</div>
            <div style={{fontSize:12,color:"#94a3b8"}}>Add your ASX stocks · We fetch live prices from Yahoo Finance · All risk metrics calculated automatically</div>
          </div>

          <div className="builder-card" style={{padding:24}}>
            {/* Column headers */}
            <div className="builder-header-grid" style={{display:"grid",gridTemplateColumns:"1fr 100px 120px 40px",gap:10,marginBottom:10,padding:"0 4px"}}>
              {["ASX Ticker","Shares","Avg Buy Price (AUD)",""].map((h,i)=>(
                <div key={i} style={{fontSize:9,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600}}>{h}</div>
              ))}
            </div>

            {/* Stock rows */}
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              {portfolio.map((stock)=>(
                <div key={stock.id} className="builder-grid" style={{display:"grid",gridTemplateColumns:"1fr 100px 120px 40px",gap:10,alignItems:"center"}}>
                  <div style={{position:"relative"}}>
                    <input
                      className="stock-input"
                      placeholder="e.g. CBA.AX"
                      value={stock.ticker}
                      onChange={e=>updateStock(stock.id,"ticker",e.target.value.toUpperCase())}
                      style={{textTransform:"uppercase"}}
                    />
                    {ASX_NAMES[normalizeTicker(stock.ticker)] && (
                      <div style={{fontSize:9,color:"#94a3b8",marginTop:2,paddingLeft:2}}>{ASX_NAMES[normalizeTicker(stock.ticker)]}</div>
                    )}
                  </div>
                  <input
                    className="stock-input"
                    placeholder="e.g. 100"
                    type="number"
                    min="1"
                    value={stock.shares}
                    onChange={e=>updateStock(stock.id,"shares",e.target.value)}
                  />
                  <input
                    className="stock-input"
                    placeholder="e.g. 108.20"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={stock.avgCost}
                    onChange={e=>updateStock(stock.id,"avgCost",e.target.value)}
                  />
                  <button className="btn-remove" onClick={()=>removeStock(stock.id)} disabled={portfolio.length===1}>✕</button>
                </div>
              ))}
            </div>

            {/* Add stock */}
            <button className="btn-add" onClick={addStock}>+ Add Stock</button>

            <hr style={{border:"none",borderTop:"1px solid #f1f5f9",margin:"20px 0"}} />

            {/* Portfolio preview */}
            {portfolio.some(p=>p.ticker&&parseFloat(p.shares)>0&&parseFloat(p.avgCost)>0) && (
              <div style={{background:"#f8fafc",borderRadius:10,padding:14,marginBottom:20,border:"1px solid #e2e8f0"}}>
                <div style={{fontSize:9,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10,fontWeight:600}}>Portfolio Preview (at buy price)</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {portfolio.filter(p=>p.ticker&&parseFloat(p.shares)>0&&parseFloat(p.avgCost)>0).map((p,idx)=>{
                    const cost = parseFloat(p.shares)*parseFloat(p.avgCost);
                    return (
                      <div key={p.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",borderLeft:`3px solid ${COLORS[idx%COLORS.length]}`}}>
                        <div style={{fontSize:11,fontWeight:600,color:"#1e293b"}}>{normalizeTicker(p.ticker).replace(".AX","")}</div>
                        <div style={{fontSize:10,color:"#64748b"}}>{fmt$(cost)}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop:10,fontSize:11,color:"#475569"}}>
                  Total invested: <span style={{fontWeight:600,color:"#1e293b"}}>{fmt$(portfolio.filter(p=>p.ticker&&parseFloat(p.shares)>0&&parseFloat(p.avgCost)>0).reduce((s,p)=>s+parseFloat(p.shares)*parseFloat(p.avgCost),0))}</span>
                </div>
              </div>
            )}

            {error && (
              <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#dc2626"}}>{error}</div>
            )}

            {/* Analyze button */}
            <div style={{display:"flex",justifyContent:"center"}}>
              <button className="btn-primary" onClick={analyzePortfolio} disabled={loading} style={{minWidth:220}}>
                {loading ? loadingMsg||"Fetching data…" : "⟨ Analyze Portfolio ⟩"}
              </button>
            </div>
            <div style={{textAlign:"center",marginTop:12,fontSize:10,color:"#94a3b8"}}>
              Fetches live ASX prices via Yahoo Finance · Falls back to simulation if unavailable
            </div>
          </div>

          {/* Tips */}
          <div style={{marginTop:20,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {[
              { icon:"📈", title:"ASX Tickers", desc:"Use .AX suffix e.g. CBA.AX, BHP.AX, CSL.AX. We auto-add it if you forget." },
              { icon:"💰", title:"Avg Buy Price", desc:"Enter the average price you paid per share in AUD including brokerage." },
              { icon:"⚡", title:"Live Data", desc:"Yahoo Finance provides real-time ASX prices. Data loads in ~10 seconds." },
            ].map((t,i)=>(
              <div key={i} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:14,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                <div style={{fontSize:20,marginBottom:6}}>{t.icon}</div>
                <div style={{fontSize:11,fontWeight:600,color:"#1e293b",marginBottom:4}}>{t.title}</div>
                <div style={{fontSize:10,color:"#94a3b8",lineHeight:1.6}}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  /* ══════════════════════════════════════════════════════════════════ */
  /*  DASHBOARD VIEW                                                   */
  /* ══════════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#f1f5f9;}
        .dash-root{font-family:'DM Mono',monospace;background:#f1f5f9;min-height:100vh;color:#1e293b;}
        .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);}
        .kpi-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;transition:all 0.2s;box-shadow:0 1px 4px rgba(0,0,0,0.06);}
        .kpi-card:hover{border-color:#f59e0b;box-shadow:0 4px 16px rgba(245,158,11,0.12);transform:translateY(-1px);}
        .holding-row{border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background 0.15s;}
        .holding-row:hover{background:#fefce8;}
        .holding-row.active{background:#fffbeb;border-left:3px solid #f59e0b;}
        .scenario-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;cursor:pointer;transition:all 0.15s;background:#fff;}
        .scenario-card:hover{border-color:#cbd5e1;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .scenario-card.active-pos{border-color:#10b981;background:#f0fdf4;}
        .scenario-card.active-neg{border-color:#ef4444;background:#fef2f2;}
        .tag{font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:3px 8px;border-radius:20px;}
        .badge-red{background:#fee2e2;color:#dc2626;}
        .section-label{font-family:'Syne',sans-serif;font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;display:flex;align-items:center;gap:8px;}
        .section-label::before{content:'';display:block;width:3px;height:12px;background:#f59e0b;border-radius:2px;}
        .metric-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f8fafc;}
        .metric-row:last-child{border:none;}
        .edit-btn{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:6px 14px;font-family:'DM Mono',monospace;font-size:11px;color:#64748b;cursor:pointer;transition:all 0.15s;}
        .edit-btn:hover{border-color:#f59e0b;color:#f59e0b;}
        /* ── Responsive ── */
        .kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;}
        .main-grid{display:grid;grid-template-columns:380px 1fr;gap:16px;}
        .lower-grid{display:grid;grid-template-columns:240px 1fr 320px;gap:16px;}
        .footer-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;}
        @media(max-width:1100px){
          .lower-grid{grid-template-columns:1fr 1fr!important;}
        }
        @media(max-width:900px){
          .kpi-grid{grid-template-columns:repeat(3,1fr)!important;}
          .main-grid{grid-template-columns:1fr!important;}
          .lower-grid{grid-template-columns:1fr!important;}
          .footer-grid{grid-template-columns:repeat(3,1fr)!important;}
        }
        @media(max-width:540px){
          .kpi-grid{grid-template-columns:repeat(2,1fr)!important;}
          .footer-grid{grid-template-columns:repeat(2,1fr)!important;}
        }
      `}</style>

      <div className="dash-root" style={{paddingBottom:40}}>

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,color:"#1e293b"}}>
              ASX<span style={{color:"#f59e0b"}}>·</span><span style={{color:"#3b82f6"}}>ANALYTICS</span>
            </div>
            <div style={{width:1,height:20,background:"#e2e8f0"}} />
            <span style={{fontSize:10,color:"#94a3b8",letterSpacing:"0.12em",textTransform:"uppercase",display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:dataSource==="live"?"#10b981":"#f59e0b",display:"inline-block"}} />
              {dataSource==="live"?"Live Data":"Simulated Data"}
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:11,color:"#94a3b8",fontFamily:"'DM Mono',monospace",display:"none"}}>
              {now.toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}
            </span>
            <button className="edit-btn" onClick={()=>{setView("builder");setActiveScenario(null);setSelectedHolding(null);}}>
              ← Edit Portfolio
            </button>
          </div>
        </div>

        <div style={{padding:"20px 20px",display:"flex",flexDirection:"column",gap:18}}>

          {/* ── KPI STRIP ─────────────────────────────────────────── */}
          <div className="kpi-grid">
            {[
              {label:"Portfolio Value", value:fmt$(totalValue),                      sub:"Total AUD",                             accent:"#1e293b",  bg:"#fff"},
              {label:"Total P&L",       value:fmtPct((totalPnL/totalCost)*100),      sub:fmt$(totalPnL),                          accent:totalPnL>0?"#16a34a":"#dc2626", bg:totalPnL>0?"#f0fdf4":"#fef2f2"},
              {label:"Sharpe Ratio",    value:sharpe?.toFixed(2)??"—",              sub:`Sortino ${sortino?.toFixed(2)??"—"}`,   accent:sharpe>1?"#16a34a":"#d97706",   bg:sharpe>1?"#f0fdf4":"#fffbeb"},
              {label:"VaR (95%)",       value:VaR95!=null?`${VaR95}%`:"—",          sub:`VaR 99%: ${VaR99??'—'}%`,              accent:"#dc2626",  bg:"#fef2f2"},
              {label:"Ann. Volatility", value:annVol!=null?`${annVol}%`:"—",        sub:`Return ${annRet!=null?fmtPct(annRet):"—"}`, accent:"#d97706", bg:"#fffbeb"},
            ].map((kpi,i)=>(
              <div key={i} className="kpi-card" style={{background:kpi.bg}}>
                <div style={{fontSize:9,color:"#94a3b8",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>{kpi.label}</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:kpi.accent,letterSpacing:"-0.02em",lineHeight:1}}>{kpi.value}</div>
                <div style={{fontSize:10,color:"#64748b",marginTop:5}}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* ── MAIN ROW ──────────────────────────────────────────── */}
          <div className="main-grid">

            {/* Holdings */}
            <div className="card" style={{padding:"16px 0"}}>
              <div style={{padding:"0 16px 10px"}}><div className="section-label">Holdings ({holdings.length} stocks)</div></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 68px 60px 76px",padding:"0 16px 8px",gap:4}}>
                {["Ticker","Value","Weight","P&L"].map(h=>(
                  <div key={h} style={{fontSize:9,color:"#94a3b8",letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:600}}>{h}</div>
                ))}
              </div>
              {holdings.map(h=>(
                <div key={h.ticker} className={`holding-row ${selectedHolding?.ticker===h.ticker?"active":""}`}
                  onClick={()=>setSelectedHolding(selectedHolding?.ticker===h.ticker?null:h)}
                  style={{display:"grid",gridTemplateColumns:"1fr 68px 60px 76px",padding:"9px 16px",gap:4,alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:12,color:"#1e293b",fontWeight:600,marginBottom:2,display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:8,height:8,borderRadius:2,background:h.color,flexShrink:0}} />
                      {h.ticker.replace(".AX","")}
                    </div>
                    <div style={{fontSize:9,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</div>
                  </div>
                  <div style={{fontSize:11,color:"#334155",fontWeight:500}}>{fmt$(h.value)}</div>
                  <div style={{display:"flex",alignItems:"center",gap:3}}>
                    <div style={{width:Math.min(h.weight*2,40),height:5,background:h.color,borderRadius:3,opacity:0.8}} />
                    <span style={{fontSize:10,color:"#64748b"}}>{h.weight}%</span>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:h.pnl>=0?"#16a34a":"#dc2626",fontWeight:600}}>{fmtPct(h.pnlPct)}</div>
                    <div style={{fontSize:9,color:"#94a3b8"}}>{fmt$(h.pnl)}</div>
                  </div>
                </div>
              ))}
              <div style={{borderTop:"1px solid #f1f5f9",margin:"10px 0"}} />
              <div style={{display:"grid",gridTemplateColumns:"1fr 68px 60px 76px",padding:"8px 16px",gap:4,alignItems:"center"}}>
                <div style={{fontSize:11,color:"#f59e0b",fontWeight:700}}>TOTAL</div>
                <div style={{fontSize:11,color:"#1e293b",fontWeight:600}}>{fmt$(totalValue)}</div>
                <div style={{fontSize:11,color:"#64748b"}}>100%</div>
                <div>
                  <div style={{fontSize:11,color:totalPnL>=0?"#16a34a":"#dc2626",fontWeight:700}}>{fmtPct((totalPnL/totalCost)*100)}</div>
                  <div style={{fontSize:9,color:"#94a3b8"}}>{fmt$(totalPnL)}</div>
                </div>
              </div>
              <div style={{borderTop:"1px solid #f1f5f9",margin:"8px 0"}} />
              <div style={{padding:"0 16px"}}>
                <div className="section-label" style={{marginBottom:10}}>Risk Attributes</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[
                    {label:"Beta",      value:portfolioBeta,                        color:"#f59e0b"},
                    {label:"Max DD",    value:maxDD!=null?`${maxDD}%`:"—",          color:"#ef4444"},
                    {label:"CVaR 95%",  value:CVaR95!=null?`${CVaR95}%`:"—",       color:"#8b5cf6"},
                  ].map((m,i)=>(
                    <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"10px",border:"1px solid #e2e8f0"}}>
                      <div style={{fontSize:9,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{m.label}</div>
                      <div style={{fontSize:16,color:m.color,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Equity Curve */}
            <div className="card" style={{padding:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:10}}>
                <div>
                  <div className="section-label">Portfolio Performance</div>
                  <div style={{fontSize:10,color:"#94a3b8"}}>{dataSource==="live"?"Real closing prices · Yahoo Finance · ASX":"Simulated equity curve · GBM model"}</div>
                </div>
                <div style={{textAlign:"right",background:"#f0fdf4",padding:"8px 14px",borderRadius:10,border:"1px solid #bbf7d0"}}>
                  <div style={{fontSize:20,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#16a34a"}}>{annRet!=null?fmtPct(annRet):"—"}</div>
                  <div style={{fontSize:9,color:"#86efac"}}>Annual Return</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={equityCurve} margin={{top:4,right:4,bottom:0,left:8}}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2}/>
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="date" tick={{fill:"#94a3b8",fontSize:9,fontFamily:"'DM Mono',monospace"}} tickLine={false} axisLine={{stroke:"#e2e8f0"}} interval={29}/>
                  <YAxis tick={{fill:"#94a3b8",fontSize:9,fontFamily:"'DM Mono',monospace"}} tickLine={false} axisLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} width={44}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2.5} fill="url(#grad)" dot={false} activeDot={{r:5,fill:"#f59e0b",stroke:"#fff",strokeWidth:2}}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── LOWER ROW ─────────────────────────────────────────── */}
          <div className="lower-grid">

            {/* Sector */}
            <div className="card" style={{padding:16}}>
              <div className="section-label">Sector Allocation</div>
              <div style={{display:"flex",justifyContent:"center",margin:"4px 0 12px"}}>
                <ResponsiveContainer width={170} height={170}>
                  <PieChart>
                    <Pie data={sectorData} cx="50%" cy="50%" innerRadius={46} outerRadius={76} paddingAngle={3} dataKey="value">
                      {sectorData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} stroke="transparent"/>)}
                    </Pie>
                    <Tooltip content={<PieTooltip/>}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {sectorData.map((s,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{width:9,height:9,borderRadius:2,background:COLORS[i%COLORS.length]}}/>
                      <span style={{fontSize:11,color:"#475569"}}>{s.name}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{width:46,height:5,background:"#f1f5f9",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:`${s.value}%`,height:"100%",background:COLORS[i%COLORS.length],borderRadius:3}}/>
                      </div>
                      <span style={{fontSize:11,color:"#1e293b",fontWeight:600}}>{s.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* VaR Histogram */}
            <div className="card" style={{padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,flexWrap:"wrap",gap:8}}>
                <div>
                  <div className="section-label">Return Distribution & VaR</div>
                  <div style={{fontSize:10,color:"#94a3b8"}}>Daily P&L · Red = VaR tail</div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span className="tag badge-red">VaR 95%: {VaR95}%</span>
                  <span className="tag badge-red">VaR 99%: {VaR99}%</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={varHistogram||[]} margin={{top:4,right:4,bottom:0,left:4}} barCategoryGap={1}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="x" tick={{fill:"#94a3b8",fontSize:9,fontFamily:"'DM Mono',monospace"}} tickLine={false} axisLine={{stroke:"#e2e8f0"}} tickFormatter={v=>`${v}%`} interval={5}/>
                  <YAxis tick={{fill:"#94a3b8",fontSize:9}} tickLine={false} axisLine={false} width={24}/>
                  <Tooltip content={<HistTooltip/>}/>
                  <ReferenceLine x={VaR95?.toString()} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} label={{value:"VaR 95%",fill:"#ef4444",fontSize:9,position:"top"}}/>
                  <ReferenceLine x={VaR99?.toString()} stroke="#dc2626" strokeDasharray="4 2" strokeWidth={1.5} label={{value:"99%",fill:"#dc2626",fontSize:9,position:"insideTop"}}/>
                  <Bar dataKey="count" radius={[3,3,0,0]}>
                    {(varHistogram||[]).map((e,i)=><Cell key={i} fill={e.tail?"#ef4444":"#bfdbfe"} fillOpacity={e.tail?0.9:0.8}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
                {[
                  {label:"CVaR 95%",  value:CVaR95!=null?`${CVaR95}%`:"—", note:"Expected shortfall", color:"#ef4444"},
                  {label:"Ann. Vol",  value:annVol!=null?`${annVol}%`:"—",  note:"Historical",          color:"#f59e0b"},
                  {label:"Beta",      value:portfolioBeta,                   note:"vs. ASX 200",        color:"#3b82f6"},
                ].map((m,i)=>(
                  <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"10px",border:"1px solid #e2e8f0"}}>
                    <div style={{fontSize:9,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{m.label}</div>
                    <div style={{fontSize:17,fontFamily:"'Syne',sans-serif",fontWeight:800,color:m.color}}>{m.value}</div>
                    <div style={{fontSize:9,color:"#94a3b8"}}>{m.note}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stress Tests */}
            <div className="card" style={{padding:16}}>
              <div className="section-label">Stress-Test Scenarios</div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {SCENARIOS.map(sc=>{
                  const loss=totalValue*(sc.impact/100);
                  const isPos=sc.impact>0;
                  const isActive=activeScenario?.id===sc.id;
                  return(
                    <div key={sc.id} className={`scenario-card ${isActive?(isPos?"active-pos":"active-neg"):""}`} onClick={()=>setActiveScenario(isActive?null:sc)}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                        <span style={{fontSize:11,color:"#334155",fontWeight:600}}>{sc.name}</span>
                        <span style={{fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:800,color:isPos?"#16a34a":"#dc2626"}}>{fmtPct(sc.impact)}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{fontSize:9,color:"#94a3b8"}}>{sc.label}</span>
                        <span style={{fontSize:10,color:isPos?"#16a34a":"#dc2626",fontWeight:600}}>{isPos?"+":""}{fmt$(loss)}</span>
                      </div>
                      {isActive&&(
                        <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #e2e8f0"}}>
                          <div style={{fontSize:9,color:"#64748b",lineHeight:1.7,marginBottom:8}}>{sc.desc}</div>
                          <div style={{display:"flex",gap:6}}>
                            <div style={{flex:1,background:"#f8fafc",borderRadius:7,padding:"7px",border:"1px solid #e2e8f0"}}>
                              <div style={{fontSize:8,color:"#94a3b8",textTransform:"uppercase",marginBottom:2}}>Portfolio After</div>
                              <div style={{fontSize:12,color:isPos?"#16a34a":"#dc2626",fontFamily:"'Syne',sans-serif",fontWeight:800}}>{fmt$(totalValue+loss)}</div>
                            </div>
                            <div style={{flex:1,background:"#f8fafc",borderRadius:7,padding:"7px",border:"1px solid #e2e8f0"}}>
                              <div style={{fontSize:8,color:"#94a3b8",textTransform:"uppercase",marginBottom:2}}>Impact</div>
                              <div style={{fontSize:12,color:isPos?"#16a34a":"#dc2626",fontFamily:"'Syne',sans-serif",fontWeight:800}}>{fmt$(loss)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:10,padding:"10px 12px",background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0"}}>
                <div style={{fontSize:9,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>CFA Attribution</div>
                <div className="metric-row"><span style={{fontSize:10,color:"#64748b"}}>Selection Effect</span><span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>+4.32%</span></div>
                <div className="metric-row"><span style={{fontSize:10,color:"#64748b"}}>Allocation Effect</span><span style={{fontSize:11,color:"#d97706",fontWeight:600}}>+2.18%</span></div>
                <div className="metric-row"><span style={{fontSize:10,color:"#64748b"}}>Interaction Effect</span><span style={{fontSize:11,color:"#ef4444",fontWeight:600}}>−0.74%</span></div>
                <div className="metric-row" style={{borderTop:"1px solid #e2e8f0",marginTop:6,paddingTop:9}}>
                  <span style={{fontSize:10,color:"#1e293b",fontWeight:600}}>Active Return</span>
                  <span style={{fontSize:13,color:"#16a34a",fontFamily:"'Syne',sans-serif",fontWeight:800}}>+5.76%</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── FOOTER ────────────────────────────────────────────── */}
          <div className="footer-grid">
            {[
              {label:"Risk-Free Rate", value:"4.30%",                    note:"RBA Cash Rate",      color:"#1e293b"},
              {label:"Sharpe Ratio",   value:sharpe?.toFixed(2)??"—",    note:"Annualised",         color:sharpe>1?"#16a34a":"#d97706"},
              {label:"Sortino Ratio",  value:sortino?.toFixed(2)??"—",   note:"Downside risk-adj",  color:"#3b82f6"},
              {label:"Max Drawdown",   value:maxDD!=null?`${maxDD}%`:"—",note:"Peak-to-trough",     color:"#ef4444"},
              {label:"Stocks",         value:holdings.length,             note:"In portfolio",       color:"#8b5cf6"},
              {label:"Data Source",    value:dataSource==="live"?"Live":"Simulated", note:"Yahoo Finance", color:"#f59e0b"},
            ].map((m,i)=>(
              <div key={i} className="card" style={{padding:"12px 14px"}}>
                <div style={{fontSize:9,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>{m.label}</div>
                <div style={{fontSize:15,fontFamily:"'Syne',sans-serif",fontWeight:800,color:m.color}}>{m.value}</div>
                <div style={{fontSize:9,color:"#94a3b8",marginTop:2}}>{m.note}</div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}