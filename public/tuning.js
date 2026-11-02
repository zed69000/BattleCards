// Values set in the game's GDD (games-catalog). Never blocks the game: a launch uses the copy saved
// by an earlier launch, or the defaults written in the code, and fetches a fresh copy for the next one.
// In the GDD preview (?tuning=preview) it uses the values sent by the page and saves nothing.
(function(){
  const GAME="bataille-galactique";
  const BASE="https://games-catalog.sebastienalzamora.workers.dev";
  const CACHE_KEY="tuning_"+GAME;
  const TIMEOUT_MS=4000;
  const preview=new URLSearchParams(location.search).get("tuning")==="preview";
  const listeners=[];
  let values={};

  function safe(o){
    const out={};
    if(!o||typeof o!=="object")return out;
    for(const k of Object.keys(o)){
      const v=o[k];
      if(typeof v==="boolean"||(typeof v==="number"&&isFinite(v)))out[k]=v;
    }
    return out;
  }
  function fromHash(){
    const m=location.hash.match(/tv=([^&]*)/);
    if(!m)return {};
    try{return safe(JSON.parse(decodeURIComponent(m[1])));}catch(e){return {};}
  }
  function fromCache(){
    try{return safe(JSON.parse(localStorage.getItem(CACHE_KEY)));}catch(e){return {};}
  }
  function refresh(){
    if(!window.fetch)return;
    const ctrl=window.AbortController?new AbortController():null;
    const timer=ctrl?setTimeout(()=>ctrl.abort(),TIMEOUT_MS):0;
    fetch(BASE+"/tuning/"+GAME+".json",ctrl?{signal:ctrl.signal}:{}).then(r=>r.ok?r.json():null).then(d=>{
      if(d&&d.values){try{localStorage.setItem(CACHE_KEY,JSON.stringify(safe(d.values)));}catch(e){}}
    }).catch(()=>{}).then(()=>clearTimeout(timer));
  }

  if(preview){
    values=fromHash();
    window.addEventListener("message",e=>{
      if(e.origin!==BASE||!e.data||e.data.type!=="tuning")return;
      const next=safe(e.data.values);
      Object.assign(values,next);
      listeners.forEach(fn=>{try{fn(next);}catch(err){}});
    });
  }else{
    values=fromCache();
    refresh();
  }

  window.Tuning={
    preview,
    num(key,def){const v=values[key];return typeof v==="number"?v:def;},
    bool(key,def){const v=values[key];return typeof v==="boolean"?v:def;},
    onChange(fn){listeners.push(fn);},
  };
})();
