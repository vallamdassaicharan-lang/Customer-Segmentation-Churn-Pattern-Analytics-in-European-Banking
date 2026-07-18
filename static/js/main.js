/* ================= DATA =================
   Row schema: [CreditScore, Geography, Gender, Age, Tenure, Balance, NumOfProducts, HasCrCard, IsActiveMember, EstimatedSalary, Exited]
   Data is loaded asynchronously from /static/data/customers.json (see loadData() at bottom of this file).
*/
let RAW = [];
const COLS = {CS:0, GEO:1, GEN:2, AGE:3, TEN:4, BAL:5, PROD:6, CARD:7, ACTIVE:8, SAL:9, EXIT:10};

const GEO_NAMES = {FR:'France', ES:'Spain', DE:'Germany'};
const fmtPct = x => (x*100).toFixed(1) + '%';
const fmtEUR = x => '€' + Math.round(x).toLocaleString('en-US');
const fmtEURc = x => x >= 1e6 ? '€' + (x/1e6).toFixed(1) + 'M' : '€' + Math.round(x/1000) + 'k';

function ageBand(a){ return a<30?0 : a<=45?1 : a<=60?2 : 3; }
const ageBandLabel = ['<30','30–45','46–60','60+'];
function tenureBand(t){ return t<=2?0 : t<=6?1 : 2; }
const tenureBandLabel = ['New (0–2y)','Mid (3–6y)','Long (7–10y)'];
function balBand(b){ return b===0?0 : b<100000?1 : 2; }
const balBandLabel = ['Zero','Low','High'];
function creditBand(c){ return c<600?0 : c<700?1 : 2; }
const creditBandLabel = ['Low (<600)','Medium (600–700)','High (700+)'];

/* -------- filter state -------- */
const state = {
  geo: new Set(['FR','ES','DE']),
  age: new Set([0,1,2,3]),
  ten: new Set([0,1,2]),
  bal: new Set([0,1,2]),
  gen: new Set(['F','M']),
};

function applyFilter(){
  return RAW.filter(r =>
    state.geo.has(r[COLS.GEO]) &&
    state.age.has(ageBand(r[COLS.AGE])) &&
    state.ten.has(tenureBand(r[COLS.TEN])) &&
    state.bal.has(balBand(r[COLS.BAL])) &&
    state.gen.has(r[COLS.GEN]));
}

function churnRate(rows){ if(!rows.length) return 0; return rows.filter(r=>r[COLS.EXIT]===1).length/rows.length; }

/* -------- chart instances -------- */
let charts = {};
function destroyChart(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }

const CSS = getComputedStyle(document.documentElement);
const cVar = n => CSS.getPropertyValue(n).trim();
Chart.defaults.font.family = "'SF Mono','Cascadia Mono',Consolas,monospace";
Chart.defaults.color = cVar('--muted');
Chart.defaults.borderColor = cVar('--line');

function render(){
  const rows = applyFilter();
  const n = rows.length;
  const churned = rows.filter(r=>r[COLS.EXIT]===1);
  const retained = rows.filter(r=>r[COLS.EXIT]===0);
  const overall = churnRate(rows);

  document.getElementById('kpi-n').textContent = n.toLocaleString();
  document.getElementById('filterCount').textContent = n.toLocaleString() + ' / ' + RAW.length.toLocaleString() + ' customers';
  document.getElementById('kpi-overall').textContent = n? fmtPct(overall) : '—';
  document.getElementById('heroChurnRate').innerHTML = n? (overall*100).toFixed(1)+'<span>%</span>' : '—';
  document.getElementById('heroCount').textContent = n.toLocaleString() + ' records';

  // high value
  const hv = rows.filter(r=>r[COLS.BAL] >= 100000);
  const hvChurn = churnRate(hv);
  document.getElementById('kpi-hv').textContent = hv.length? fmtPct(hvChurn) : '—';
  document.getElementById('hv-count').textContent = hv.length.toLocaleString();
  document.getElementById('hv-count-d').textContent = n? ((hv.length/n*100).toFixed(1)+'% of filtered customers') : '—';
  const hvChurned = hv.filter(r=>r[COLS.EXIT]===1);
  const revenueAtRisk = hvChurned.reduce((s,r)=>s+r[COLS.BAL],0);
  document.getElementById('hv-revenue').textContent = fmtEURc(revenueAtRisk);
  const hvChurnedProd = hvChurned.length? hvChurned.reduce((s,r)=>s+r[COLS.PROD],0)/hvChurned.length : 0;
  const hvRetainedProd = (hv.length-hvChurned.length)? hv.filter(r=>r[COLS.EXIT]===0).reduce((s,r)=>s+r[COLS.PROD],0)/(hv.length-hvChurned.length) : 0;
  document.getElementById('hv-products').textContent = hvChurnedProd.toFixed(2);
  document.getElementById('hv-products-d').textContent = 'churned vs ' + hvRetainedProd.toFixed(2) + ' retained';

  // geography
  const geoKeys = ['FR','ES','DE'].filter(g=>state.geo.has(g));
  const geoStats = geoKeys.map(g=>{
    const grows = rows.filter(r=>r[COLS.GEO]===g);
    return {g, name: GEO_NAMES[g], n: grows.length, churn: churnRate(grows)};
  });
  const geoRatesForIndex = geoStats.filter(s=>s.n>0).map(s=>s.churn);
  const geoIdx = geoRatesForIndex.length>1 ? (Math.max(...geoRatesForIndex)/Math.max(0.0001,Math.min(...geoRatesForIndex))) : 1;
  document.getElementById('kpi-geo').textContent = geoRatesForIndex.length>1? geoIdx.toFixed(2)+'×' : '—';

  // engagement
  const activeRows = rows.filter(r=>r[COLS.ACTIVE]===1);
  const inactiveRows = rows.filter(r=>r[COLS.ACTIVE]===0);
  const activeChurn = churnRate(activeRows), inactiveChurn = churnRate(inactiveRows);
  document.getElementById('kpi-eng').textContent = (activeRows.length&&inactiveRows.length)? '+'+fmtPct(inactiveChurn-activeChurn) : '—';
  document.getElementById('kpi-eng-d').textContent = 'inactive churn − active churn';

  renderGeoCharts(geoStats, overall);
  renderSpectrum(geoStats, overall);
  renderAgeTenureCharts(rows);
  renderHeatmap(rows);
  renderCreditChart(rows);
  renderScatter(rows);
  renderExplorer(rows);
  renderHeroGauge(overall);
}

function renderHeroGauge(rate){
  destroyChart('hero');
  const ctx = document.getElementById('heroGauge');
  charts.hero = new Chart(ctx, {
    type:'doughnut',
    data:{ datasets:[{ data:[rate, 1-rate], backgroundColor:[cVar('--rust'), cVar('--ink')], borderWidth:0, cutout:'76%' }] },
    options:{ rotation:-90, circumference:360, plugins:{legend:{display:false}, tooltip:{enabled:false}}, animation:{duration:500} }
  });
}

function renderGeoCharts(geoStats, overall){
  destroyChart('geoBar'); destroyChart('geoDonut');
  charts.geoBar = new Chart(document.getElementById('chartGeoBar'), {
    type:'bar',
    data:{ labels: geoStats.map(s=>s.name),
      datasets:[{ data: geoStats.map(s=>+(s.churn*100).toFixed(1)),
        backgroundColor: geoStats.map(s=> s.churn>overall? cVar('--rust') : cVar('--teal')),
        borderRadius:6, maxBarThickness:64 }]},
    options:{ plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>c.raw+'% churn'}}},
      scales:{ y:{ grid:{color:cVar('--line')}, ticks:{callback:v=>v+'%'} }, x:{ grid:{display:false} } } }
  });
  charts.geoDonut = new Chart(document.getElementById('chartGeoDonut'), {
    type:'doughnut',
    data:{ labels: geoStats.map(s=>s.name), datasets:[{ data: geoStats.map(s=>s.n),
      backgroundColor:[cVar('--teal'), cVar('--gold'), cVar('--rust')], borderColor:cVar('--ink-2'), borderWidth:3 }]},
    options:{ plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, padding:16 } } } }
  });
}

function renderSpectrum(geoStats, overall){
  const el = document.getElementById('spectrumRows');
  const maxRate = Math.max(0.4, ...geoStats.map(s=>s.churn), overall);
  el.innerHTML = geoStats.map(s=>{
    const pct = (s.churn/maxRate*100).toFixed(1);
    const avgPct = (overall/maxRate*100).toFixed(1);
    return `<div class="spectrum-row">
      <span class="spectrum-name">${s.name}</span>
      <div class="spectrum-track">
        <div class="spectrum-fill" style="width:${pct}%"></div>
        <div class="spectrum-marker" style="left:${avgPct}%" title="cohort average"></div>
      </div>
      <span class="spectrum-val">${fmtPct(s.churn)}</span>
      <span class="spectrum-n">n=${s.n.toLocaleString()}</span>
    </div>`;
  }).join('') || '<div class="loading-note">No customers match the current filters.</div>';
}

function renderAgeTenureCharts(rows){
  destroyChart('age'); destroyChart('tenure');
  const ageStats = [0,1,2,3].map(b=>{ const rs = rows.filter(r=>ageBand(r[COLS.AGE])===b); return {label:ageBandLabel[b], rate:churnRate(rs), n:rs.length}; });
  const tenStats = [0,1,2].map(b=>{ const rs = rows.filter(r=>tenureBand(r[COLS.TEN])===b); return {label:tenureBandLabel[b], rate:churnRate(rs), n:rs.length}; });
  charts.age = new Chart(document.getElementById('chartAge'), {
    type:'bar',
    data:{ labels: ageStats.map(s=>s.label), datasets:[{ data: ageStats.map(s=>+(s.rate*100).toFixed(1)),
      backgroundColor: cVar('--gold'), borderRadius:6, maxBarThickness:56 }]},
    options:{ plugins:{legend:{display:false}}, scales:{ y:{ grid:{color:cVar('--line')}, ticks:{callback:v=>v+'%'} }, x:{grid:{display:false}} } }
  });
  charts.tenure = new Chart(document.getElementById('chartTenure'), {
    type:'bar',
    data:{ labels: tenStats.map(s=>s.label), datasets:[{ data: tenStats.map(s=>+(s.rate*100).toFixed(1)),
      backgroundColor: cVar('--teal'), borderRadius:6, maxBarThickness:56 }]},
    options:{ plugins:{legend:{display:false}}, scales:{ y:{ grid:{color:cVar('--line')}, ticks:{callback:v=>v+'%'} }, x:{grid:{display:false}} } }
  });
}

function heatColor(rate){
  // interpolate teal -> gold -> rust based on rate 0..0.6
  const t = Math.min(1, rate/0.5);
  const c1 = [51,172,151], c2=[199,88,60];
  const r = Math.round(c1[0]+(c2[0]-c1[0])*t);
  const g = Math.round(c1[1]+(c2[1]-c1[1])*t);
  const b = Math.round(c1[2]+(c2[2]-c1[2])*t);
  return `rgb(${r},${g},${b})`;
}

function renderHeatmap(rows){
  const el = document.getElementById('heatmapGrid');
  let html = `<div class="heat-row"><div></div>${tenureBandLabel.map(l=>`<div class="heat-head">${l}</div>`).join('')}</div>`;
  for(let a=0;a<4;a++){
    let cells = '';
    for(let t=0;t<3;t++){
      const rs = rows.filter(r=>ageBand(r[COLS.AGE])===a && tenureBand(r[COLS.TEN])===t);
      const rate = churnRate(rs);
      cells += `<div class="heat-cell" style="background:${rs.length? heatColor(rate): 'var(--ink)'}">${rs.length? (rate*100).toFixed(0)+'%':'–'}<small>${rs.length? 'n='+rs.length : ''}</small></div>`;
    }
    html += `<div class="heat-row"><div class="heat-label">${ageBandLabel[a]}</div>${cells}</div>`;
  }
  el.innerHTML = html;
}

function renderCreditChart(rows){
  destroyChart('credit');
  const stats = [0,1,2].map(b=>{ const rs = rows.filter(r=>creditBand(r[COLS.CS])===b); return {label:creditBandLabel[b], rate:churnRate(rs)}; });
  charts.credit = new Chart(document.getElementById('chartCredit'), {
    type:'bar',
    data:{ labels: stats.map(s=>s.label), datasets:[{ data: stats.map(s=>+(s.rate*100).toFixed(1)),
      backgroundColor: cVar('--rust'), borderRadius:6, maxBarThickness:56 }]},
    options:{ indexAxis:'y', plugins:{legend:{display:false}}, scales:{ x:{ grid:{color:cVar('--line')}, ticks:{callback:v=>v+'%'} }, y:{grid:{display:false}} } }
  });
}

function renderScatter(rows){
  destroyChart('scatter');
  const sample = rows.length > 2500 ? rows.filter((_,i)=> i % Math.ceil(rows.length/2500) === 0) : rows;
  const churned = sample.filter(r=>r[COLS.EXIT]===1).map(r=>({x:r[COLS.BAL], y:r[COLS.SAL]}));
  const retained = sample.filter(r=>r[COLS.EXIT]===0).map(r=>({x:r[COLS.BAL], y:r[COLS.SAL]}));
  charts.scatter = new Chart(document.getElementById('chartScatter'), {
    type:'scatter',
    data:{ datasets:[
      { label:'Retained', data:retained, backgroundColor:'rgba(51,172,151,.45)', pointRadius:3 },
      { label:'Churned', data:churned, backgroundColor:'rgba(199,88,60,.7)', pointRadius:3.4 },
    ]},
    options:{
      plugins:{ legend:{ position:'top', align:'end', labels:{boxWidth:10} },
        tooltip:{ callbacks:{ label:c=> `Balance ${fmtEUR(c.raw.x)} · Salary ${fmtEUR(c.raw.y)}` } } },
      scales:{
        x:{ title:{display:true,text:'Balance (€)'}, grid:{color:cVar('--line')}, ticks:{ callback:v=>fmtEURc(v) } },
        y:{ title:{display:true,text:'Estimated salary (€)'}, grid:{color:cVar('--line')}, ticks:{ callback:v=>fmtEURc(v) } }
      }
    }
  });
}

/* -------- explorer -------- */
let explorerPage = 0;
const PAGE_SIZE = 12;
let explorerRowsCache = [];

function renderExplorer(rows){
  const search = document.getElementById('explorerSearch').value.trim().toLowerCase();
  const sort = document.getElementById('explorerSort').value;
  let list = rows;
  if(search){
    list = list.filter(r=>{
      const hay = `${GEO_NAMES[r[COLS.GEO]]} ${r[COLS.GEN]==='F'?'female':'male'} ${r[COLS.CS]} ${r[COLS.AGE]} ${r[COLS.EXIT]===1?'churned':'retained'}`.toLowerCase();
      return hay.includes(search);
    });
  }
  const sorters = {
    'balance-desc': (a,b)=>b[COLS.BAL]-a[COLS.BAL],
    'balance-asc': (a,b)=>a[COLS.BAL]-b[COLS.BAL],
    'salary-desc': (a,b)=>b[COLS.SAL]-a[COLS.SAL],
    'age-desc': (a,b)=>b[COLS.AGE]-a[COLS.AGE],
    'credit-asc': (a,b)=>a[COLS.CS]-b[COLS.CS],
    'churn-first': (a,b)=>b[COLS.EXIT]-a[COLS.EXIT],
  };
  list = [...list].sort(sorters[sort]);
  explorerRowsCache = list;
  explorerPage = Math.min(explorerPage, Math.max(0, Math.ceil(list.length/PAGE_SIZE)-1));
  paintExplorerPage();
}

function paintExplorerPage(){
  const list = explorerRowsCache;
  const start = explorerPage*PAGE_SIZE;
  const pageRows = list.slice(start, start+PAGE_SIZE);
  const body = document.getElementById('explorerBody');
  body.innerHTML = pageRows.map(r=>{
    const hv = r[COLS.BAL] >= 100000;
    return `<tr>
      <td>${GEO_NAMES[r[COLS.GEO]]}</td>
      <td>${r[COLS.GEN]==='F'?'Female':'Male'}</td>
      <td>${r[COLS.AGE]}</td>
      <td>${r[COLS.TEN]}y</td>
      <td>${r[COLS.CS]}</td>
      <td>${fmtEUR(r[COLS.BAL])}</td>
      <td>${r[COLS.PROD]}</td>
      <td>${fmtEUR(r[COLS.SAL])}</td>
      <td><span class="badge ${r[COLS.EXIT]===1?'churn':'retain'}">${r[COLS.EXIT]===1?'Churned':'Retained'}</span>${hv?'<span class="badge hv">HV</span>':''}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" style="text-align:center; color:var(--muted-dim); padding:30px 0;">No customers match the current search.</td></tr>`;
  document.getElementById('pagerInfo').textContent = list.length? `Showing ${start+1}–${Math.min(start+PAGE_SIZE,list.length)} of ${list.length.toLocaleString()}` : 'No results';
  document.getElementById('pagerPrev').disabled = explorerPage===0;
  document.getElementById('pagerNext').disabled = start+PAGE_SIZE >= list.length;
}

document.getElementById('pagerPrev').addEventListener('click', ()=>{ if(explorerPage>0){ explorerPage--; paintExplorerPage(); } });
document.getElementById('pagerNext').addEventListener('click', ()=>{ if((explorerPage+1)*PAGE_SIZE < explorerRowsCache.length){ explorerPage++; paintExplorerPage(); } });
document.getElementById('explorerSearch').addEventListener('input', ()=>{ explorerPage=0; renderExplorer(applyFilter()); });
document.getElementById('explorerSort').addEventListener('change', ()=>{ explorerPage=0; renderExplorer(applyFilter()); });

/* -------- filter chip wiring -------- */
function wireChips(containerId, stateSet, castFn){
  const container = document.getElementById(containerId);
  container.querySelectorAll('.chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      const val = castFn(chip.dataset.val);
      if(stateSet.has(val)){
        if(stateSet.size>1){ stateSet.delete(val); chip.classList.remove('on'); }
      } else {
        stateSet.add(val); chip.classList.add('on');
      }
      explorerPage = 0;
      render();
    });
  });
}
wireChips('f-geo', state.geo, v=>v);
wireChips('f-age', state.age, v=>+v);
wireChips('f-ten', state.ten, v=>+v);
wireChips('f-bal', state.bal, v=>+v);
wireChips('f-gen', state.gen, v=>v);

document.getElementById('resetFilters').addEventListener('click', ()=>{
  state.geo = new Set(['FR','ES','DE']);
  state.age = new Set([0,1,2,3]);
  state.ten = new Set([0,1,2]);
  state.bal = new Set([0,1,2]);
  state.gen = new Set(['F','M']);
  document.querySelectorAll('.chip').forEach(c=>c.classList.add('on'));
  document.getElementById('explorerSearch').value='';
  explorerPage = 0;
  render();
});

/* -------- nav: explicit click handling + active state on scroll -------- */
const sections = ['overview','geography','demographics','high-value','explorer'].map(id=>document.getElementById(id));
const navA = document.querySelectorAll('#navLinks a');
navA.forEach(a=>{
  a.addEventListener('click', (e)=>{
    e.preventDefault();
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if(target){ target.scrollIntoView({behavior:'smooth', block:'start'}); }
    navA.forEach(x=>x.classList.remove('active'));
    a.classList.add('active');
  });
});
window.addEventListener('scroll', ()=>{
  let current = sections[0].id;
  for(const s of sections){ if(window.scrollY >= s.offsetTop - 120) current = s.id; }
  navA.forEach(a=> a.classList.toggle('active', a.getAttribute('href')==='#'+current));
}, {passive:true});

/* -------- bootstrap: load data then render -------- */
async function loadData(){
  try{
    const res = await fetch('/static/data/customers.json');
    if(!res.ok) throw new Error('HTTP ' + res.status);
    RAW = await res.json();
    render();
  }catch(err){
    console.error('Dashboard failed to load data:', err);
    document.body.insertAdjacentHTML('afterbegin', '<div style="background:#C7583C;color:#0A1120;padding:12px 24px;font-family:monospace;font-size:13px;">Could not load customer data: '+err.message+'</div>');
  }
}
loadData();
