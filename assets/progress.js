/* =========================================================================
   Flashcard Test Kit — learning progress (3 states: new / good / weak)
   Cross-device: prefers the server API (/api/progress, Cloudflare KV); falls
   back to localStorage when the API is unavailable (e.g. local dev, or KV not
   bound yet). localStorage also acts as an offline cache.
   Exposes window.FTKProgress.
   ========================================================================= */
(function (global) {
  "use strict";

  const LS_KEY = 'ftk_progress_v1';
  let map = {};            // { "<pageId>:<itemId>": "good"|"weak" }   (absent = "new")
  let apiOK = false;       // true once the server API answered

  function lsLoad(){ try{ return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; }catch(e){ return {}; } }
  function lsSave(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(map)); }catch(e){} }

  function key(pageId, itemId){ return pageId + ':' + itemId; }

  async function init(){
    try{
      const res = await fetch('/api/progress', { headers: { 'accept': 'application/json' } });
      if(res.ok){
        const data = await res.json();
        map = (data && typeof data === 'object' && data.progress && typeof data.progress === 'object') ? data.progress : {};
        apiOK = true;
        lsSave();               // refresh local cache from the server
        return map;
      }
    }catch(e){ /* fall through to localStorage */ }
    apiOK = false;
    map = lsLoad();
    return map;
  }

  function get(pageId, itemId){ return map[key(pageId, itemId)] || 'new'; }

  function set(pageId, itemId, state){
    const k = key(pageId, itemId);
    if(state === 'good' || state === 'weak') map[k] = state;
    else { state = 'new'; delete map[k]; }
    lsSave();
    if(apiOK){
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: k, state: state })
      }).catch(()=>{});      // best-effort; localStorage already holds it
    }
    return state;
  }

  // Counts over a list of item ids on one page.
  function counts(pageId, itemIds){
    let good = 0, weak = 0;
    (itemIds || []).forEach(id => {
      const s = map[key(pageId, id)];
      if(s === 'good') good++; else if(s === 'weak') weak++;
    });
    const total = (itemIds || []).length;
    return { good: good, weak: weak, untouched: total - good - weak, total: total };
  }

  function all(){ return map; }
  function serverActive(){ return apiOK; }

  global.FTKProgress = {
    init: init, get: get, set: set, counts: counts,
    all: all, key: key, serverActive: serverActive
  };
})(window);
