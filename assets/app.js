const $ = (q)=>document.querySelector(q);
const pc = (x)=> (x>0?'+':'') + (x||0).toFixed(2) + '%';

const API = {
  trending: (region='DE') => fetch(`https://query1.finance.yahoo.com/v1/finance/trending/${region}?count=12`).then(r=>r.json()),
  quotes:   (symbols)=> fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}`).then(r=>r.json()),
  recs:     (s)=> fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${s}?modules=recommendationTrend`).then(r=>r.json())
};

// --- Technik Helfer ---
function ema(arr,p){const k=2/(p+1);let o=[];arr.forEach((v,i)=>o.push(i? v*k+o[i-1]*(1-k):v));return o;}
function rsi14(closes){
  let gains=[],losses=[];
  for(let i=1;i<closes.length;i++){const d=closes[i]-closes[i-1];gains.push(Math.max(d,0));losses.push(Math.max(-d,0));}
  const avg=(a,n)=>a.slice(-n).reduce((x,y)=>x+y,0)/n||0;
  const RS = (avg(gains,14))/(avg(losses,14)||1e-9);
  return 100 - (100/(1+RS));
}
function macdHist(closes){
  const f=ema(closes,12), s=ema(closes,26);
  const macd=f.map((v,i)=>v-s[i]), sig=ema(macd.slice(26-1),9);
  const pad=Array(26-1).fill(null).concat(sig);
  return macd.at(-1)-pad.at(-1);
}

// --- Laden ---
async function loadBankTrends(){
  try{
    const t = await API.trending('DE'); // oder 'US'
    const quotes = t.finance?.result?.[0]?.quotes || [];
    $("#bank-trends").innerHTML = quotes.slice(0,12).map(q=>{
      const ch = q.regularMarketChangePercent||0, cls=ch>=0?'pos':'neg';
      return `<div class="tile">
        <div style="font-weight:700">${q.symbol}</div>
        <div class="k"><span>${q.shortName||''}</span><span class="${cls}">${pc(ch)}</span></div>
      </div>`;
    }).join('') || `<div class="tile">Keine Daten (Rate-Limit/CORS). Später erneut versuchen.</div>`;
  }catch(e){ $("#bank-trends").innerHTML = `<div class="tile">Keine Trends verfügbar.</div>`; }
}

async function loadAnalysts(){
  try{
    const tUS = await API.trending('US'); const syms = (tUS.finance?.result?.[0]?.quotes||[]).slice(0,12).map(x=>x.symbol);
    let rows=[];
    for(const s of syms){
      try{
        const r = await API.recs(s);
        const t = r.quoteSummary?.result?.[0]?.recommendationTrend?.trend?.[0];
        if(!t) continue;
        const tot = (t.strongBuy||0)+(t.buy||0)+(t.hold||0)+(t.sell||0)+(t.strongSell||0);
        rows.push({s, sb:t.strongBuy||0, b:t.buy||0, h:t.hold||0, se:t.sell||0, pct: tot?(t.strongBuy/tot*100):0});
      }catch{}
    }
    rows.sort((a,b)=>b.pct-a.pct);
    $("#analyst-table").innerHTML = `<table><thead><tr>
      <th>Symbol</th><th>Strong Buy</th><th>Buy</th><th>Hold</th><th>Sell</th><th>SB %</th>
    </tr></thead><tbody>${rows.map(r=>`
      <tr><td><strong>${r.s}</strong></td><td>${r.sb}</td><td>${r.b}</td><td>${r.h}</td><td>${r.se}</td><td>${r.pct.toFixed(0)}%</td></tr>
    `).join('')}</tbody></table>`;
  }catch{ $("#analyst-table").innerHTML = `<div class="tile">Analysten-Daten nicht verfügbar.</div>`; }
}

async function loadTechnicals(){
  const symbols = ["NVDA","AAPL","MSFT","SAP.DE","^GDAXI","SPY"];
  try{
    const r = await API.quotes(symbols); const qm={}; (r.quoteResponse?.result||[]).forEach(o=>qm[o.symbol]=o);
    const boxes = await Promise.all(symbols.map(async s=>{
      try{
        const ch = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s}?range=6mo&interval=1d`).then(r=>r.json());
        const closes = ch.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(v=>v!=null) || [];
        const rsi = closes.length>15? rsi14(closes):null;
        const hist = closes.length>30? macdHist(closes):null;
        const chg = qm[s]?.regularMarketChangePercent||0;
        return `<div class="tile"><div style="font-weight:700">${s}</div>
          <div class="k"><span>Δ Tag</span><span class="${chg>=0?'pos':'neg'}">${pc(chg)}</span></div>
          <div class="k"><span>RSI(14)</span><span>${rsi? rsi.toFixed(1):'–'}</span></div>
          <div class="k"><span>MACD-Hist</span><span>${hist? hist.toFixed(3):'–'}</span></div></div>`;
      }catch{return `<div class="tile">${s}: keine Daten</div>`;}
    }));
    $("#tech-grid").innerHTML = boxes.join("");
  }catch{ $("#tech-grid").innerHTML = `<div class="tile">Technik nicht verfügbar.</div>`; }

  try{
    const q = await API.quotes(["^CPC"]);
    const val = q.quoteResponse?.result?.[0]?.regularMarketPrice;
    $("#pcr").innerHTML = `<div class="k"><span>CBOE Put/Call (^CPC)</span><span>${val ?? '–'}</span></div>`;
  }catch{}
}

async function loadEvents(){
  try{
    const res = await fetch("assets/data/events.json?b="+Date.now());
    const items = await res.json();
    $("#event-list").innerHTML = items.map(ev=>`
      <div class="tile">
        <div><strong>${ev.date}</strong> · ${ev.headline}</div>
        <div class="muted">${ev.summary||''}</div>
        <div style="margin-top:6px">Impact: ${ev.impact_score}/100 · Horizont: ${ev.horizon||''}</div>
      </div>`).join('') || `<div class="tile">Keine Einträge.</div>`;
  }catch{ $("#event-list").innerHTML = `<div class="tile">Ereignisse nicht geladen.</div>`; }
}

window.addEventListener("DOMContentLoaded", ()=>{
  if (document.querySelector("#bank-trends"))  loadBankTrends();
  if (document.querySelector("#analyst-table")) loadAnalysts();
  if (document.querySelector("#tech-grid"))     loadTechnicals();
  if (document.querySelector("#event-list"))    loadEvents();
});
