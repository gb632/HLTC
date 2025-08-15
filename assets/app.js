// Market Daily – reines Frontend (GitHub Pages tauglich)
const $ = (q) => document.querySelector(q);
const API = {
  trending: (region='US') => fetch(`https://query1.finance.yahoo.com/v1/finance/trending/${region}?count=10`).then(r=>r.json()),
  screener: (scrId='most_actives', count=10) => fetch(`https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=${count}&scrIds=${scrId}`).then(r=>r.json()),
  quote: (symbols) => fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}`).then(r=>r.json()),
  chart: (symbol, range='6mo', interval='1d') => fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`).then(r=>r.json()),
  recommends: (symbol) => fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=recommendationTrend`).then(r=>r.json())
};

function pct(n){ return (n>0?'+':'') + n.toFixed(2) + '%'; }
function fmt(n){ return new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(n); }

async function loadToday(){
  const region = localStorage.getItem('region') || 'US';
  try{
    const [tUS, tDE, g, l] = await Promise.all([
      API.trending(region),
      API.trending('DE'),
      API.screener('day_gainers',6),
      API.screener('day_losers',6)
    ]);
    const trending = [...(tUS.finance?.result?.[0]?.quotes||[]), ...(tDE.finance?.result?.[0]?.quotes||[])].slice(0,12);
    renderTrending(trending);
    renderMovers('#gainers', g.finance?.result?.[0]?.quotes||[], 'Top Gewinner');
    renderMovers('#losers', l.finance?.result?.[0]?.quotes||[], 'Top Verlierer');
  }catch(e){
    $('#trending').innerHTML = `<div class="small">Fehler beim Laden öffentlicher Daten (mögliche Rate-Limits/CORS). Bitte später erneut versuchen.</div>`;
    console.error(e);
  }
}
function renderTrending(list){
  const el = $('#trending');
  el.innerHTML = list.map(q => {
    const change = q.regularMarketChangePercent || q.postMarketChangePercent || 0;
    const cls = change>=0?'pos':'neg';
    return `<div class="tile">
      <h4>${q.symbol}</h4>
      <div class="small">${q.shortName||''}</div>
      <div class="kpi"><span class="${cls}">${pct(change)}</span> · ${fmt(q.regularMarketPrice||0)}</div>
      <button class="btn secondary" onclick="quickTA('${q.symbol}')">TA</button>
      <button class="btn secondary" onclick="embedChart('${q.symbol}')">Chart</button>
    </div>`
  }).join('');
}
function renderMovers(selector, list, title){
  const el = document.querySelector(selector);
  el.innerHTML = `<h4>${title}</h4>` + list.map(q => {
    const change = q.regularMarketChangePercent||0, cls = change>=0?'pos':'neg';
    return `<div class="small">${q.symbol} · <span class="${cls}">${pct(change)}</span> · ${fmt(q.regularMarketPrice||0)}</div>`;
  }).join('');
}

// --- RSI & MACD ---
function calcEMA(series, period){
  const k = 2/(period+1);
  let ema = [];
  series.forEach((price, i)=>{
    if(i===0){ ema.push(price); }
    else{ ema.push(price * k + ema[i-1]*(1-k)); }
  });
  return ema;
}
function calcSMA(series, period){
  let out=[];
  for(let i=0;i<series.length;i++){
    if(i<period-1){ out.push(null); continue; }
    const slice = series.slice(i-period+1, i+1);
    out.push(slice.reduce((a,b)=>a+b,0)/period);
  }
  return out;
}
function calcRSI(closes, period=14){
  let gains=[], losses=[];
  for(let i=1;i<closes.length;i++){
    const diff = closes[i]-closes[i-1];
    gains.push(Math.max(diff,0));
    losses.push(Math.max(-diff,0));
  }
  let avgGain = calcSMA(gains, period).slice(period-1);
  let avgLoss = calcSMA(losses, period).slice(period-1);
  let rsi = new Array(period).fill(null);
  for(let i=0;i<avgGain.length;i++){
    const ag = avgGain[i], al = avgLoss[i];
    if(al===0){ rsi.push(100); continue; }
    const rs = ag/al;
    rsi.push(100 - (100/(1+rs)));
  }
  return rsi;
}
function calcMACD(closes, fast=12, slow=26, signal=9){
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macd = emaFast.map((v,i)=> v - emaSlow[i]);
  const signalLine = calcEMA(macd.slice(slow-1), signal); // align roughly
  const paddedSignal = Array(slow-1).fill(null).concat(signalLine);
  const histogram = macd.map((v,i)=> (paddedSignal[i]==null?null: v - paddedSignal[i]));
  return {macd, signal:paddedSignal, histogram};
}

async function quickTA(symbol){
  $('#symbol-input').value = symbol;
  return analyzeSymbol();
}

async function analyzeSymbol(){
  const symbol = $('#symbol-input').value.trim().toUpperCase();
  if(!symbol) return;
  $('#ta-output').textContent = 'Lade Kursdaten...';
  try{
    const data = await API.chart(symbol,'1y','1d');
    const result = data.chart?.result?.[0];
    if(!result){ $('#ta-output').textContent = 'Keine Daten.'; return; }
    const closes = result.indicators.quote[0].close.filter(v=>v!=null);
    const rsi = calcRSI(closes,14);
    const {macd, signal, histogram} = calcMACD(closes,12,26,9);
    const lastRSI = rsi[rsi.length-1];
    const lastHist = histogram[histogram.length-1];
    let verdict = [];
    if(lastRSI<30) verdict.push('RSI überverkauft (<30)');
    else if(lastRSI>70) verdict.push('RSI überkauft (>70)');
    else verdict.push('RSI neutral (30–70)');
    if(lastHist!=null){
      verdict.push(lastHist>0 ? 'MACD Momentum positiv' : 'MACD Momentum negativ');
    }
    $('#ta-output').innerHTML = `<div class="tile">
      <h4>${symbol}</h4>
      <div class="small">RSI(14): ${lastRSI? lastRSI.toFixed(1):'n/a'} · MACD-Hist: ${lastHist? lastHist.toFixed(3):'n/a'}</div>
      <div class="small">Heuristik: ${verdict.join(' · ')}</div>
      <div class="small">Nur Information, keine Anlageberatung.</div>
    </div>`;
    embedChart(symbol);
  }catch(e){
    $('#ta-output').textContent = 'Fehler bei der technischen Analyse.';
    console.error(e);
  }
}

function embedChart(symbol){
  // TradingView lightweight embed
  if(typeof TradingView === 'undefined'){ return; }
  $('#tradingview-widget').innerHTML = "";
  new TradingView.widget({
    "container_id": "tradingview-widget",
    "autosize": true,
    "symbol": symbol,
    "interval": "D",
    "timezone": "Europe/Berlin",
    "theme": "dark",
    "style": "1",
    "locale": "de_DE",
    "enable_publishing": false,
    "hide_legend": true,
    "allow_symbol_change": true
  });
}

// --- Strong Buy (heuristisch) ---
async function scanStrongBuys(){
  $('#scan-strong-buys').disabled = true;
  $('#strong-buy-results').innerHTML = '<div class="small">Scanne Analysten-Trends für populäre Ticker...</div>';
  try{
    const actives = await API.screener('most_actives', 12);
    const quotes = (actives.finance?.result?.[0]?.quotes||[]).slice(0,12);
    const syms = quotes.map(q=>q.symbol);
    // Fetch recommendationTrend per symbol (sequential to avoid rate limit)
    let rows = [];
    for(const s of syms){
      try{
        const rec = await API.recommends(s);
        const trend = rec.quoteSummary?.result?.[0]?.recommendationTrend?.trend?.[0];
        if(!trend) continue;
        const strongBuy = trend.strongBuy || 0;
        const buy = trend.buy || 0;
        const hold = trend.hold || 0;
        const total = strongBuy + buy + hold + (trend.sell||0) + (trend.strongSell||0);
        const pctStrong = total ? (strongBuy/total)*100 : 0;
        rows.push({symbol:s, pctStrong, strongBuy, buy, hold});
      }catch(e){ /* ignore single symbol errors */ }
    }
    rows.sort((a,b)=> b.pctStrong - a.pctStrong);
    const top = rows.slice(0,8);
    const html = top.map(r => `<div class="tile">
        <h4>${r.symbol}</h4>
        <div class="kpi">Strong Buy ~ ${r.pctStrong.toFixed(0)}%</div>
        <div class="small">Votes: SB ${r.strongBuy} · B ${r.buy} · H ${r.hold}</div>
        <button class="btn secondary" onclick="quickTA('${r.symbol}')">TA</button>
        <button class="btn secondary" onclick="embedChart('${r.symbol}')">Chart</button>
      </div>`).join('');
    $('#strong-buy-results').innerHTML = html || '<div class="small">Keine Daten.</div>';
  }catch(e){
    $('#strong-buy-results').innerHTML = '<div class="small">Fehler beim Scan (Rate-Limit/CORS möglich).</div>';
    console.error(e);
  }finally{
    $('#scan-strong-buys').disabled = false;
  }
}

// --- Settings & AI ---
function loadSettings(){
  $('#openai-key').value = localStorage.getItem('openai_key')||'';
  $('#region').value = localStorage.getItem('region')||'US';
}
function saveSettings(){
  localStorage.setItem('openai_key', $('#openai-key').value.trim());
  localStorage.setItem('region', ($('#region').value.trim()||'US').toUpperCase());
  $('#settings-status').textContent = 'Gespeichert ✔';
  setTimeout(()=> $('#settings-status').textContent = '', 1500);
}

async function generateBriefing(){
  const key = localStorage.getItem('openai_key');
  const notes = $('#news-input').value.trim();
  if(!key){ 
    $('#briefing-output').textContent = 'Kein OpenAI‑Key hinterlegt. Du kannst die Prompt‑Vorlagen unten kopieren und extern nutzen.'; 
    return;
  }
  const prompt = window.PROMPTS.dailyBriefing.replace('{{USER_NOTES}}', notes || 'Keine Angaben');
  $('#briefing-output').textContent = 'Generiere Briefing...';
  try{
    // OpenAI Responses API (compatible with gpt-4o-mini / gpt-4.1). Using standard chat endpoint for broad compatibility.
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages:[{role:"system", content:"Du bist ein knapper Finanz-Redakteur. Gib keine Anlageempfehlung, nur Informationen."},
                  {role:"user", content: prompt}],
        temperature: 0.3
      })
    });
    if(!resp.ok){
      const text = await resp.text();
      throw new Error(text);
    }
    const data = await resp.json();
    const out = data.choices?.[0]?.message?.content || 'Kein Output.';
    $('#briefing-output').textContent = out;
  }catch(e){
    $('#briefing-output').textContent = 'Fehler bei OpenAI‑Request: ' + e.message;
  }
}

function renderPrompts(){
  const container = $('#prompt-templates');
  const entries = Object.entries(window.PROMPTS);
  container.innerHTML = entries.map(([k,v])=>{
    return `<div class="tile"><h4>${k}</h4><pre class="mono">${v}</pre></div>`;
  }).join('');
}

function copyPrompts(){
  const txt = Object.values(window.PROMPTS).join('\n\n---\n\n');
  navigator.clipboard.writeText(txt);
  alert('Prompts in die Zwischenablage kopiert.');
}

// Events
window.addEventListener('DOMContentLoaded', ()=>{
  loadSettings();
  loadToday();
  renderPrompts();
  $('#save-settings').addEventListener('click', saveSettings);
  $('#analyze-btn').addEventListener('click', analyzeSymbol);
  $('#scan-strong-buys').addEventListener('click', scanStrongBuys);
  $('#generate-briefing').addEventListener('click', generateBriefing);
  $('#copy-prompts').addEventListener('click', copyPrompts);
});