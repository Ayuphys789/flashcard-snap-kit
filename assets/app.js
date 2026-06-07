/* =========================================================================
   Flashcard Test Kit — test page logic (uses cards.js + progress.js)
   - ?page=001 loads data/page-001.json
   - Per-item state: 未着手 / 得意 / 苦手 (via FTKProgress, synced across devices)
   - Per-mode mastery pies, shuffle / restore order, prev/next page nav
   ========================================================================= */

const params = new URLSearchParams(location.search);
const PAGE_ID = params.get('page');

let DATA = null;
let weakMode = false;
let order = {};          // { term:[...], sentence:[...], grammar:[...] }
let activeMode = null;

function shuffleArr(a){
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

function dataFor(mode){
  if(mode==='term') return DATA.terms || [];
  if(mode==='sentence') return DATA.sentences || [];
  if(mode==='grammar') return DATA.grammar || [];
  return [];
}
function itemIdOf(mode, item, i){ return (item && item.id) ? item.id : (mode[0] + i); }

function render(){
  const root = document.getElementById('views');
  root.innerHTML='';
  DATA.modes.forEach(mode=>{
    const meta = FTKCards.MODE_META[mode];
    const view = document.createElement('div');
    view.id = 'view-'+mode;
    if(mode!==activeMode) view.classList.add('hidden');

    const sec = document.createElement('section');
    if(meta.alt) sec.className='alt-sec';
    const t=document.createElement('div'); t.className='sec-title'; t.textContent=meta.label;
    const n=document.createElement('div'); n.className='sec-note'; n.textContent=meta.note;
    sec.append(t,n);

    let count=0;
    order[mode].forEach(i=>{
      const item = dataFor(mode)[i];
      const id = itemIdOf(mode, item, i);
      if(weakMode && FTKProgress.get(PAGE_ID, id) !== 'weak') return;
      const card = FTKCards.buildCard({
        mode: mode, item: item, idx: i, state: FTKProgress.get(PAGE_ID, id), lang: DATA.lang,
        onState: (st)=>{ FTKProgress.set(PAGE_ID, id, st); updateStats(); },
        onReveal: updateScore
      });
      sec.appendChild(card); count++;
    });
    if(count===0){
      const e=document.createElement('div'); e.className='empty';
      e.textContent = weakMode ? '苦手の項目はありません。' : '項目がありません。';
      sec.appendChild(e);
    }
    view.appendChild(sec);
    root.appendChild(view);
  });
  updateScore();
}

function activeView(){ return document.getElementById('view-'+activeMode); }

function updateScore(){
  const a=activeView(); if(!a) return;
  const total=a.querySelectorAll('.ans').length;
  const shown=a.querySelectorAll('.ans.open').length;
  document.getElementById('score').textContent=shown+' / '+total+' 表示';
}

function updateStats(){
  const bar=document.getElementById('stats'); if(!bar) return;
  bar.innerHTML='';
  DATA.modes.forEach(mode=>{
    const items=dataFor(mode);
    const ids=items.map((it,i)=>itemIdOf(mode,it,i));
    const c=FTKProgress.counts(PAGE_ID, ids);
    bar.appendChild(FTKCards.makePie(c.good, c.weak, c.total, { size:56, label: '進捗（'+FTKCards.MODE_META[mode].label+'）' }));
  });
}

function buildTabs(){
  const tabs=document.getElementById('tabs'); tabs.innerHTML='';
  DATA.modes.forEach(mode=>{
    const b=document.createElement('button');
    b.textContent=FTKCards.MODE_META[mode].label;
    if(mode===activeMode) b.classList.add('active');
    b.addEventListener('click',()=>{
      activeMode=mode;
      DATA.modes.forEach(m=>{
        document.getElementById('view-'+m).classList.toggle('hidden', m!==mode);
      });
      [...tabs.children].forEach((c,i)=>c.classList.toggle('active', DATA.modes[i]===mode));
      updateScore();
    });
    tabs.appendChild(b);
  });
  tabs.classList.toggle('hidden', DATA.modes.length<2);
}

function setRevealAll(open){
  activeView().querySelectorAll('.q').forEach(q=>{
    const ans=q.querySelector('.ans'); const b=q.querySelector('.reveal-btn');
    ans.classList.toggle('open', open); b.classList.toggle('shown', open);
    b.textContent = open ? b.dataset.open : b.dataset.closed;
  });
  updateScore();
}

function resetOrder(){
  DATA.modes.forEach(m=>{ order[m] = dataFor(m).map((_,i)=>i); });
  render();
}

function wireToolbar(){
  document.getElementById('showAll').addEventListener('click',()=>setRevealAll(true));
  document.getElementById('hideAll').addEventListener('click',()=>setRevealAll(false));
  document.getElementById('shuffle').addEventListener('click',()=>{
    Object.keys(order).forEach(m=>shuffleArr(order[m])); render();
  });
  document.getElementById('resetOrder').addEventListener('click', resetOrder);
  document.getElementById('weakOnly').addEventListener('click',(e)=>{
    weakMode=!weakMode; e.currentTarget.classList.toggle('on',weakMode); render();
  });
}

async function setupNav(){
  const prev=document.getElementById('prevPage');
  const next=document.getElementById('nextPage');
  const pos=document.getElementById('navpos');
  if(!prev || !next) return;
  let pages=[];
  try{ const idx=await (await fetch('data/index.json',{cache:'no-cache'})).json(); pages=idx.pages||[]; }catch(e){}
  const i = pages.findIndex(p=>String(p.id)===String(PAGE_ID));
  if(i===-1){ if(pos) pos.textContent=''; return; }
  if(pos) pos.textContent=(i+1)+' / '+pages.length;
  if(i>0){ prev.href='test.html?page='+encodeURIComponent(pages[i-1].id); }
  else { prev.classList.add('disabled'); prev.removeAttribute('href'); }
  if(i<pages.length-1){ next.href='test.html?page='+encodeURIComponent(pages[i+1].id); }
  else { next.classList.add('disabled'); next.removeAttribute('href'); }
}

async function init(){
  wireToolbar();
  if(!PAGE_ID){
    document.getElementById('views').innerHTML='<div class="err">ページを指定してください（例: ?page=001）。</div>';
    return;
  }
  try{
    const res = await fetch('data/page-'+PAGE_ID+'.json', {cache:'no-cache'});
    if(!res.ok) throw new Error();
    DATA = await res.json();
  }catch(e){
    document.getElementById('views').innerHTML='<div class="err">data/page-'+FTKCards.esc(PAGE_ID)+'.json を読み込めませんでした。</div>';
    return;
  }
  if(!DATA.modes || !DATA.modes.length) DATA.modes=['term'];
  activeMode = DATA.modes[0];
  document.getElementById('pageTitle').textContent = DATA.title || ('ページ '+PAGE_ID);
  document.getElementById('pageSource').textContent = DATA.source || '';
  document.title = (DATA.title || '単語テスト');

  await FTKProgress.init();
  DATA.modes.forEach(m=>{ order[m] = dataFor(m).map((_,i)=>i); });
  buildTabs();
  render();
  updateStats();
  setupNav();
}
document.addEventListener('DOMContentLoaded', init);
