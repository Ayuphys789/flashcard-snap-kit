/* =========================================================================
   Flashcard Test Kit — shared card rendering + pie helper
   Used by the test page (app.js), the cross-page review (review.js) and the
   index page (pies). Exposes window.FTKCards.
   States per item: "new" (未着手) / "good" (得意) / "weak" (苦手).
   ========================================================================= */
(function (global) {
  "use strict";

  const MODE_META = {
    term:     { label: "単語", note: "各単語の意味を答える。", alt: false },
    sentence: { label: "例文", note: "文を訳し、語句・文法を確認する。", alt: true },
    grammar:  { label: "文法", note: "各文法ポイントを説明する。", alt: true }
  };

  function esc(s){
    return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function speak(text, lang){
    const synth = global.speechSynthesis;
    if(!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang || 'en-US';
    u.rate = 0.9;
    synth.speak(u);
  }

  /* Build one card element.
     opts: {
       mode, item, idx,
       state:"new"|"good"|"weak", lang:String,
       sourceLabel:String|undefined,         // shown above the card (review page)
       onState:(state)=>void,                // persist the 得意/苦手/未着手 change
       onReveal:(open:Boolean)=>void         // e.g. update score
     } */
  function buildCard(opts){
    const mode = opts.mode, item = opts.item, idx = opts.idx;
    const meta = MODE_META[mode] || {};
    let state = opts.state || 'new';

    const q = document.createElement('div');
    q.className = 'q' + (meta.alt ? ' alt' : '');
    applyState(q, state);

    const head = document.createElement('div'); head.className = 'q-head';
    const num = document.createElement('div'); num.className = 'num'; num.textContent = (idx + 1);

    const front = document.createElement('div');
    let speakText = null, revClosed, revOpen, answerHTML;

    if (mode === 'term'){
      front.className = 'term'; front.textContent = item.term;
      speakText = item.term; revClosed = '答え'; revOpen = '隠す';
      answerHTML = (item.tag ? '<span class="tag">' + esc(item.tag) + '</span>' : '') +
                   '<span class="meaning">' + esc(item.translation) + '</span>' +
                   (item.reading ? '<div class="example">[' + esc(item.reading) + ']</div>' : '');
    } else if (mode === 'sentence'){
      front.className = 'sentence'; front.textContent = item.text;
      speakText = item.text; revClosed = '答えを見る'; revOpen = '閉じる';
      let h = '<p class="trans"><b>和訳</b>　' + esc(item.translation) + '</p>';
      if (item.notes && item.notes.length){
        h += '<ul class="notes">';
        item.notes.forEach(n => { h += '<li><span class="k">' + esc(n[0]) + '</span>　' + esc(n[1]) + '</li>'; });
        h += '</ul>';
      }
      if (item.grammar){ h += '<p class="point">' + esc(item.grammar) + '</p>'; }
      answerHTML = h;
    } else { // grammar
      front.className = 'term'; front.textContent = item.point;
      revClosed = '答え'; revOpen = '隠す';
      answerHTML = '<div class="meaning">' + esc(item.explanation) + '</div>' +
                   (item.example ? '<p class="example">' + esc(item.example) + '</p>' : '');
    }

    head.append(num, front);

    const actions = document.createElement('div'); actions.className = 'q-actions';

    if (speakText && global.speechSynthesis){
      const sp = document.createElement('button');
      sp.className = 'icon-btn speak'; sp.textContent = '🔊'; sp.title = '発音';
      sp.addEventListener('click', () => speak(speakText, opts.lang));
      actions.append(sp);
    }

    const goodBtn = document.createElement('button');
    goodBtn.className = 'icon-btn st-good'; goodBtn.textContent = '◎'; goodBtn.title = '得意';
    const weakBtn = document.createElement('button');
    weakBtn.className = 'icon-btn st-weak'; weakBtn.textContent = '✕'; weakBtn.title = '苦手';

    function refresh(){
      goodBtn.classList.toggle('on', state === 'good');
      weakBtn.classList.toggle('on', state === 'weak');
      applyState(q, state);
      if (opts.onState) opts.onState(state);
    }
    goodBtn.addEventListener('click', () => { state = (state === 'good') ? 'new' : 'good'; refresh(); });
    weakBtn.addEventListener('click', () => { state = (state === 'weak') ? 'new' : 'weak'; refresh(); });
    goodBtn.classList.toggle('on', state === 'good');
    weakBtn.classList.toggle('on', state === 'weak');
    actions.append(goodBtn, weakBtn);

    const ans = document.createElement('div'); ans.className = 'ans';
    const inner = document.createElement('div'); inner.className = 'ans-inner';
    inner.innerHTML = answerHTML; ans.appendChild(inner);

    const rev = document.createElement('button');
    rev.className = 'reveal-btn'; rev.textContent = revClosed;
    rev.dataset.closed = revClosed; rev.dataset.open = revOpen;
    rev.addEventListener('click', () => {
      const open = ans.classList.toggle('open');
      rev.classList.toggle('shown', open);
      rev.textContent = open ? rev.dataset.open : rev.dataset.closed;
      if (opts.onReveal) opts.onReveal(open);
    });
    actions.append(rev);

    head.append(actions);

    if (opts.sourceLabel){
      const src = document.createElement('div'); src.className = 'q-src'; src.textContent = opts.sourceLabel;
      q.appendChild(src);
    }
    q.append(head, ans);
    return q;
  }

  function applyState(q, state){
    q.classList.toggle('good', state === 'good');
    q.classList.toggle('weak', state === 'weak');
  }

  /* Donut pie of mastery. Green = good, red = weak, grey = untouched.
     Center shows the 得意 ratio (good/total). Returns an element.
     opts: { size, label } */
  function makePie(good, weak, total, opts){
    opts = opts || {};
    const size = opts.size || 52;
    const gPct = total ? (good / total) * 100 : 0;

    const pie = document.createElement('div');
    pie.className = 'pie';
    pie.style.width = pie.style.height = size + 'px';
    pie.style.background = pieGradient(good, weak, total);
    pie.title = '得意 ' + good + ' / 苦手 ' + weak + ' / 未着手 ' + (total - good - weak) + '（全 ' + total + '）';

    const hole = document.createElement('div');
    hole.className = 'pie-hole';
    hole.textContent = total ? Math.round(gPct) + '%' : '–';
    pie.appendChild(hole);

    if (opts.label){
      const wrap = document.createElement('div'); wrap.className = 'pie-wrap';
      const lab = document.createElement('div'); lab.className = 'pie-label'; lab.textContent = opts.label;
      wrap.append(pie, lab);
      return wrap;
    }
    return pie;
  }

  // Build the conic-gradient with thin white separators between slices, so
  // adjacent segments are readable regardless of hue (helps color vision too).
  function pieGradient(good, weak, total){
    const segs = [];
    if (total > 0){
      if (good > 0) segs.push(['var(--good)', good]);
      if (weak > 0) segs.push(['var(--weak)', weak]);
      const rest = total - good - weak;
      if (rest > 0) segs.push(['var(--line)', rest]);
    }
    if (!segs.length) return 'var(--line)';
    if (segs.length === 1) return segs[0][0];
    const gap = 3;                              // white separator width (deg)
    const avail = 360 - gap * segs.length;
    let cur = 0; const stops = [];
    segs.forEach(function(s){
      const span = avail * (s[1] / total);
      stops.push(s[0] + ' ' + cur + 'deg ' + (cur + span) + 'deg');
      cur += span;
      stops.push('#fff ' + cur + 'deg ' + (cur + gap) + 'deg');
      cur += gap;
    });
    return 'conic-gradient(' + stops.join(',') + ')';
  }

  global.FTKCards = {
    MODE_META: MODE_META, esc: esc, speak: speak, buildCard: buildCard, makePie: makePie
  };
})(window);
