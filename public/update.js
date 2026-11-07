// Tells testers who installed the game from Google Play that a newer version is out, with its short note.
// The published version and its note live in the catalog (releases.json), so a release only edits that file:
// no app has to be republished for the message to change.
//
// Shown only in the Android app, once per version, and only while the game says it is idle (menu, no run
// in progress). Before opening the store page the game's save is written, so nothing is lost if Android
// closes the app during the update. Never blocks the game: no network, no message.
//
//   GameUpdate.init({
//     id: "date-gravity",               // the game's id in the catalog
//     version: "1.2.10",                // the version of this build, same format as releases.json
//     android: "com.dategravity.app",   // Google Play id
//     isIdle: () => true,               // false during a run or while another window is open
//     save: () => promiseOrNothing,     // writes the save now
//     lang: "fr",                       // optional, otherwise the device language
//     theme: { bg, fg, muted, accent, accentFg, font, radius },  // optional colors to match the game
//   })
//
// Test in a browser: ?update=preview always shows the published note; ?update=android behaves as the app does.
(function(){
  const URL_RELEASES="https://games-catalog.sebastienalzamora.workers.dev/releases.json";
  const TIMEOUT_MS=5000;
  const IDLE_POLL_MS=2000;
  const REFRESH_MS=30*60*1000;
  const mode=(new URLSearchParams(location.search).get("update")||"").toLowerCase();
  const cap=window.Capacitor;
  const platform=cap&&cap.getPlatform?cap.getPlatform():"web";

  const TEXT={
    fr:{title:"Nouvelle version disponible",
        body:"La version {v} est sur Google Play. Mets le jeu à jour pour que ta sauvegarde suive les nouveautés.",
        news:"Ce qui change",update:"Mettre à jour",later:"Plus tard",saving:"Sauvegarde…"},
    en:{title:"New version available",
        body:"Version {v} is on Google Play. Update the game so your save keeps up with what's new.",
        news:"What's new",update:"Update",later:"Later",saving:"Saving…"},
  };

  let opts=null, release=null, lastFetch=0, timer=0, open=false;

  // "1.2.10", "0.91", "v31" -> [1,2,10], [0,91], [31]
  function parts(v){return String(v||"").split(/[^0-9]+/).filter(Boolean).map(Number);}
  function newer(a,b){
    const x=parts(a), y=parts(b);
    for(let i=0;i<Math.max(x.length,y.length);i++){
      const d=(x[i]||0)-(y[i]||0);
      if(d)return d>0;
    }
    return false;
  }
  function langOf(){
    const l=String((opts&&opts.lang)||navigator.language||"fr").slice(0,2).toLowerCase();
    return l==="fr"?"fr":"en";
  }
  function local(v,lang){
    if(!v||typeof v==="string")return v||"";
    return v[lang]||v.en||v.fr||"";
  }
  const seenKey=()=>"gu_seen_"+opts.id;
  function seen(v){try{return localStorage.getItem(seenKey())===String(v);}catch(e){return false;}}
  function markSeen(v){try{localStorage.setItem(seenKey(),String(v));}catch(e){}}

  function fetchRelease(){
    if(!window.fetch)return Promise.resolve(null);
    lastFetch=Date.now();
    const ctrl=window.AbortController?new AbortController():null;
    const t=ctrl?setTimeout(()=>ctrl.abort(),TIMEOUT_MS):0;
    return fetch(URL_RELEASES,Object.assign({cache:"no-cache"},ctrl?{signal:ctrl.signal}:{}))
      .then(r=>r.ok?r.json():null)
      .then(d=>(d&&d.games&&d.games[opts.id])||null)
      .catch(()=>null)
      .then(r=>{clearTimeout(t);return r;});
  }

  function wanted(r){
    if(!r||!r.version)return false;
    if(mode==="preview")return true;
    return newer(r.version,opts.version)&&!seen(r.version);
  }
  function idle(){
    try{return !opts.isIdle||!!opts.isIdle();}catch(e){return false;}
  }
  function waitForIdle(){
    clearTimeout(timer);
    if(open||!wanted(release))return;
    if(document.visibilityState!=="hidden"&&idle())show(release);
    else timer=setTimeout(waitForIdle,IDLE_POLL_MS);
  }
  function check(){
    fetchRelease().then(r=>{release=r;waitForIdle();});
  }

  function storeUrl(){return "https://play.google.com/store/apps/details?id="+encodeURIComponent(opts.android);}
  function saveNow(){
    let p;
    try{p=opts.save&&opts.save();}catch(e){p=null;}
    // a save that never answers must not keep the player on the window
    return Promise.race([Promise.resolve(p).catch(()=>{}),new Promise(r=>setTimeout(r,2000))]);
  }

  function css(t){
    const v=Object.assign({bg:"#fffaf0",fg:"#2b2233",muted:"#6b6070",accent:"#2f6fdb",accentFg:"#ffffff",font:"inherit",radius:"14px"},t||{});
    return `
#gu-veil{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;
  padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));background:rgba(10,8,20,.55);
  font-family:${v.font};-webkit-tap-highlight-color:transparent;animation:gu-in .18s ease-out}
#gu-box{width:100%;max-width:360px;max-height:100%;overflow:auto;box-sizing:border-box;padding:22px 20px 18px;
  background:${v.bg};color:${v.fg};border-radius:${v.radius};box-shadow:0 10px 40px rgba(0,0,0,.35);text-align:left}
#gu-box h2{margin:0 0 10px;font-size:1.25rem;line-height:1.25;font-weight:700}
#gu-box p{margin:0 0 12px;font-size:.98rem;line-height:1.45}
#gu-box .gu-news{margin:0 0 18px;padding:10px 12px;font-size:.98rem;line-height:1.45;border-left:3px solid ${v.accent};background:rgba(127,127,127,.1);border-radius:6px}
#gu-box .gu-news b{display:block;margin-bottom:4px;font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;color:${v.muted}}
#gu-box .gu-news span{white-space:pre-line}
#gu-box .gu-row{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
#gu-box button{font:inherit;font-size:1rem;min-height:44px;padding:10px 18px;border-radius:999px;cursor:pointer;border:0}
#gu-box .gu-later{background:transparent;color:${v.muted}}
#gu-box .gu-go{background:${v.accent};color:${v.accentFg};font-weight:700}
#gu-box button:disabled{opacity:.6;cursor:default}
@keyframes gu-in{from{opacity:0}to{opacity:1}}`;
  }

  function show(r){
    if(open)return;
    open=true;
    markSeen(r.version);
    const lang=langOf(), tx=TEXT[lang];
    const note=local(r.notes,lang);
    const style=document.createElement("style");
    style.id="gu-style";
    style.textContent=css(opts.theme);
    const veil=document.createElement("div");
    veil.id="gu-veil";
    veil.innerHTML=`<div id="gu-box" role="dialog" aria-modal="true" aria-labelledby="gu-title">
<h2 id="gu-title"></h2><p class="gu-body"></p>
<div class="gu-news"><b></b><span></span></div>
<div class="gu-row"><button type="button" class="gu-later"></button><button type="button" class="gu-go"></button></div></div>`;
    veil.querySelector("#gu-title").textContent=tx.title;
    veil.querySelector(".gu-body").textContent=tx.body.replace("{v}",r.version);
    const news=veil.querySelector(".gu-news");
    if(note){news.querySelector("b").textContent=tx.news;news.querySelector("span").textContent=note;}
    else news.remove();
    const later=veil.querySelector(".gu-later"), go=veil.querySelector(".gu-go");
    later.textContent=tx.later;
    go.textContent=tx.update;
    function close(){open=false;veil.remove();style.remove();}
    // taps on the window must not reach the game underneath
    ["pointerdown","touchstart","click"].forEach(e=>veil.addEventListener(e,ev=>ev.stopPropagation()));
    later.addEventListener("click",close);
    go.addEventListener("click",()=>{
      go.disabled=later.disabled=true;
      go.textContent=tx.saving;
      saveNow().then(()=>{
        if(mode!=="preview")window.open(storeUrl(),"_blank");
        close();
      });
    });
    document.head.appendChild(style);
    document.body.appendChild(veil);
    try{go.focus({preventScroll:true});}catch(e){}
  }

  function init(o){
    if(opts||!o||!o.id||!o.version||!o.android)return;
    opts=o;
    // the site is always the latest version; only the Android app can lag behind
    if(mode!=="preview"&&mode!=="android"&&platform!=="android")return;
    check();
    // coming back to the app after a while: look again
    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState!=="visible")return;
      if(Date.now()-lastFetch>REFRESH_MS)check();
      else waitForIdle();
    });
  }

  window.GameUpdate={init,newer,get pending(){return !!(opts&&wanted(release))&&!open;}};
})();
