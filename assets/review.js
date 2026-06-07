/* =========================================================================
   Cross-page weak review — gather 苦手 items from ALL pages, quiz ~20 at random.
   Uses stable item ids via FTKProgress; states can be changed here (得意/苦手),
   and persist (synced across devices when the server API is available).
   ========================================================================= */

const PICK = 20;

function shuffleArr(a){
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function itemIdOf(mode, item, i){ return (item && item.id) ? item.id : (mode[0] + i); }

function indexByItemId(data){
  const idx = {};
  (data.terms||[]).forEach((it,i)=>{ idx[itemIdOf('term',it,i)] = { mode:'term', item:it }; });
  (data.sentences||[]).forEach((it,i)=>{ idx[itemIdOf('sentence',it,i)] = { mode:'sentence', item:it }; });
  (data.grammar||[]).forEach((it,i)=>{ idx[itemIdOf('grammar',it,i)] = { mode:'grammar', item:it }; });
  return idx;
}

async function gatherWeak(){
  await FTKProgress.init();
  let pages=[];
  try{ const idx=await (await fetch('data/index.json',{cache:'no-cache'})).json(); pages=idx.pages||[]; }
  catch(e){ return null; }
  const titles={}; pages.forEach(p=>{ titles[p.id]=p.title || ('ページ '+p.id); });

  // collect weak keys grouped by page
  const map=FTKProgress.all();
  const byPage={};
  Object.keys(map).forEach(k=>{
    if(map[k]!=='weak') return;
    const c=k.indexOf(':'); if(c<0) return;
    const pid=k.slice(0,c), iid=k.slice(c+1);
    (byPage[pid]=byPage[pid]||[]).push(iid);
  });

  const out=[];
  for(const pid of Object.keys(byPage)){
    let data;
    try{ data=await (await fetch('data/page-'+pid+'.json',{cache:'no-cache'})).json(); }catch(e){ continue; }
    const idx=indexByItemId(data);
    byPage[pid].forEach(iid=>{
      const e=idx[iid]; if(!e) return;
      out.push({ pageId:pid, itemId:iid, pageTitle:titles[pid]||('ページ '+pid), mode:e.mode, item:e.item, lang:data.lang||'en-US' });
    });
  }
  return out;
}

function updateScore(){
  const root=document.getElementById('views');
  const total=root.querySelectorAll('.ans').length;
  const shown=root.querySelectorAll('.ans.open').length;
  document.getElementById('score').textContent=shown+' / '+total+' 表示';
}

function render(items, totalCount){
  const root=document.getElementById('views'); root.innerHTML='';
  const lead=document.getElementById('reviewLead');
  if(!items.length){
    root.innerHTML='<div class="empty">苦手（✕）に登録された項目がありません。<br>各ページで ✕ を付けると、ここに集まります。</div>';
    if(lead) lead.textContent='✕（苦手）の項目から、全ページ横断でランダム出題します。';
    updateScore(); return;
  }
  if(lead) lead.textContent='苦手 全 '+totalCount+' 件中 '+items.length+' 件を出題中。';
  const sec=document.createElement('section');
  items.forEach((w,n)=>{
    const card=FTKCards.buildCard({
      mode:w.mode, item:w.item, idx:n, state:'weak', lang:w.lang, sourceLabel:w.pageTitle,
      onState:(st)=>FTKProgress.set(w.pageId, w.itemId, st),
      onReveal:updateScore
    });
    sec.appendChild(card);
  });
  root.appendChild(sec);
  updateScore();
}

function setRevealAll(open){
  document.querySelectorAll('#views .q').forEach(q=>{
    const a=q.querySelector('.ans'), b=q.querySelector('.reveal-btn');
    if(!a||!b) return;
    a.classList.toggle('open', open); b.classList.toggle('shown', open);
    b.textContent = open ? b.dataset.open : b.dataset.closed;
  });
  updateScore();
}

async function start(){
  const all=await gatherWeak();
  if(all===null){
    document.getElementById('views').innerHTML='<div class="err">data/index.json を読み込めませんでした。</div>';
    return;
  }
  const picked=shuffleArr(all.slice()).slice(0, PICK);
  render(picked, all.length);
}

function wire(){
  document.getElementById('showAll').addEventListener('click',()=>setRevealAll(true));
  document.getElementById('hideAll').addEventListener('click',()=>setRevealAll(false));
  document.getElementById('reshuffle').addEventListener('click', start);
}

document.addEventListener('DOMContentLoaded', ()=>{ wire(); start(); });
