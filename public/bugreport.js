// Lets every tester report a bug, or suggest an improvement, from inside the game: a screenshot (that they can
// draw on), what they saw or would like, how bad it is (bugs). The report goes to the catalog with the game, the version, the device and the last console
// lines, and shows up in the developers' space (tab « Bugs »), sorted by game and version. Claude reads the
// same list. No account is needed to send. Without network the report waits on the device and leaves later.
//
//   BugReport.init({
//     id: "date-gravity",               // the game's id in the catalog
//     version: "1.2.10",                // the version of this build, as in releases.json
//     build: "10210",                   // optional build number
//     button: false,                    // a small floating bug button (default: none, the tester taps with three fingers)
//     scene: () => "level 3",           // optional: where the player is, sent with the report
//     context: () => ({ coins: 12 }),   // optional: anything that helps to reproduce (small JSON)
//     capture: () => canvas.toDataURL("image/jpeg", .85),  // optional: your own screenshot (dataURL or Promise)
//     pause: () => {}, resume: () => {},// optional: pause the game while the window is open
//     lang: "fr",                       // optional, otherwise the device language
//     theme: { bg, fg, muted, accent, accentFg, font, radius },  // optional, same as update.js
//   })
//   BugReport.open()                    // opens the window (from a menu entry « Signaler un bug »)
//   BugReport.open("idea")              // opens it on « Idée » (a menu entry « Proposer une idée »)
//
// Load it as early as possible (before the game) so the console lines and errors are kept from the start.
// Without `capture`, the visible canvases are copied right after the game's next frame (works for WebGL without
// preserveDrawingBuffer), then the whole page is drawn around them with html2canvas-pro, loaded from jsdelivr only when
// a report opens, so the HTML interface shows too (`dom: false` to skip it). Offline: the canvases only.
// Opens with a three-finger tap anywhere (nothing shows on screen), F8 on desktop, or BugReport.open() from a menu.
// ?bugreport=button shows the floating button anyway, ?bugreport=off turns the tap and the button off.
// Code lines are plain ASCII (accents written \uXXXX): the texts show right whatever charset the game page declares.
(function(){
  const TOOL_VERSION="1.2";  // shown at the bottom of the window and sent with each report: raise it with every change
  const URL_REPORT="https://games-catalog.sebastienalzamora.workers.dev/bugs/report";
  // html2canvas-pro: html2canvas kept up to date, reads the modern CSS colours (color(), oklch, color-mix) that 1.4.1 rejects
  const H2C_URL="https://cdn.jsdelivr.net/npm/html2canvas-pro@2.5.2/dist/html2canvas-pro.min.js";  // loaded only when a report opens
  const LOG_LINES=80, QUEUE_MAX=3, SHOT_SIDE=1280, SHOT_BYTES=850*1024, TIMEOUT_MS=20000;
  const QUEUE_KEY="bugreport_queue", POS_KEY="bugreport_pos", NAME_KEY="bugreport_name", CLIENT_KEY="bugreport_client";
  const started=Date.now();
  // Counts the WebGL draw calls, to copy the game's canvas in a frame it has just drawn: without preserveDrawingBuffer
  // the browser clears it once shown, and a game that skips frames (adaptive quality) would give a blank picture.
  let drawn=0;
  [window.WebGLRenderingContext,window.WebGL2RenderingContext].forEach(C=>{
    if(!C)return;
    ["drawArrays","drawElements","drawArraysInstanced","drawElementsInstanced","drawRangeElements","clear"].forEach(m=>{
      const f=C.prototype[m];
      if(typeof f==="function")C.prototype[m]=function(){drawn++;return f.apply(this,arguments);};
    });
  });
  const params=new URLSearchParams(location.search);
  const TEXT={
    fr:{title:"Signaler un bug",titleIdea:"Proposer une am\u00e9lioration",bug:"\ud83d\udc1e Bug",idea:"\ud83d\udca1 Id\u00e9e",
        what:"Qu'est-ce qui ne va pas ?",ph:"Ce que tu faisais, ce qui s'est pass\u00e9, ce que tu attendais\u2026",
        whatIdea:"Quelle est ton id\u00e9e ?",phIdea:"Ce qui rendrait le jeu plus amusant, plus clair, plus beau\u2026",
        sev:"Gravit\u00e9",blocker:"Bloquant",major:"G\u00eanant",minor:"Mineur",name:"Ton pr\u00e9nom ou pseudo (facultatif)",
        draw:"Dessine sur la capture pour montrer le probl\u00e8me.",undo:"Annuler le trait",noshot:"Pas de capture",
        cancel:"Annuler",send:"Envoyer",sending:"Envoi\u2026",thanks:"Merci ! Bug n\u00b0{n} envoy\u00e9.",queued:"Pas de r\u00e9seau : le rapport partira tout seul plus tard.",
        empty:"\u00c9cris quelques mots.",error:"\u00c9chec de l'envoi : {e}",btn:"Signaler un bug ou proposer une id\u00e9e",thanksIdea:"Merci pour ton id\u00e9e ! (n\u00b0{n})"},
    en:{title:"Report a bug",titleIdea:"Suggest an improvement",bug:"\ud83d\udc1e Bug",idea:"\ud83d\udca1 Idea",
        what:"What's wrong?",ph:"What you were doing, what happened, what you expected\u2026",
        whatIdea:"What's your idea?",phIdea:"What would make the game more fun, clearer, nicer\u2026",
        sev:"Severity",blocker:"Blocking",major:"Annoying",minor:"Minor",name:"Your name or nickname (optional)",
        draw:"Draw on the screenshot to show the problem.",undo:"Undo stroke",noshot:"No screenshot",
        cancel:"Cancel",send:"Send",sending:"Sending\u2026",thanks:"Thanks! Bug #{n} sent.",queued:"No network: the report will be sent later.",
        empty:"Write a few words.",error:"Could not send: {e}",btn:"Report a bug or suggest an idea",thanksIdea:"Thanks for your idea! (#{n})"},
  };
  let opts=null, open=false, fab=null;

  // ---------- console lines and errors, from the start
  const logs=[];
  function keep(kind,args){
    try{
      const line=[...args].map(a=>a instanceof Error?(a.stack||a.message):typeof a==="object"?safeJson(a):String(a)).join(" ");
      logs.push(new Date().toISOString().slice(11,23)+" "+kind+" "+line.slice(0,500));
      if(logs.length>LOG_LINES)logs.shift();
    }catch(e){}
  }
  function safeJson(o){try{return JSON.stringify(o).slice(0,300);}catch(e){return String(o);}}
  ["log","info","warn","error"].forEach(k=>{
    const orig=console[k];
    console[k]=function(){keep(k.toUpperCase(),arguments);return orig&&orig.apply(console,arguments);};
  });
  window.addEventListener("error",e=>keep("UNCAUGHT",[e.error||e.message+" @"+(e.filename||"")+":"+(e.lineno||"")]));
  window.addEventListener("unhandledrejection",e=>keep("UNHANDLED",[e.reason]));

  const store={
    get(k){try{return localStorage.getItem(k);}catch(e){return null;}},
    set(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}},
  };
  function clientId(){
    let id=store.get(CLIENT_KEY);
    if(!id){id=Math.random().toString(36).slice(2,12);store.set(CLIENT_KEY,id);}
    return id;
  }
  function langOf(){
    const l=String((opts&&opts.lang)||navigator.language||"fr").slice(0,2).toLowerCase();
    return l==="fr"?"fr":"en";
  }
  function call(fn,fallback){try{return fn?fn():fallback;}catch(e){return fallback;}}

  // ---------- screenshot
  function nextFrame(){return new Promise(r=>requestAnimationFrame(()=>r()));}
  async function grab(){
    if(opts.capture){
      try{const d=await opts.capture();if(d)return await toImage(d);}catch(e){keep("BUGREPORT",["capture failed",e]);}
    }
    const h2c=opts.dom===false?null:loadH2C().catch(e=>{keep("BUGREPORT",["page capture unavailable",e]);return null;});
    // our frame callback runs after the game's own render of the same frame, before the buffer is cleared;
    // wait for a frame in which the game drew (a game that skips frames, or renders less often, still gets caught)
    await nextFrame();
    if(drawn){
      let seen=drawn;
      for(let i=0;i<60;i++){await nextFrame();if(drawn!==seen)break;seen=drawn;}
    }
    const w=innerWidth,h=innerHeight,s=Math.min(SHOT_SIDE/Math.max(w,h),Math.min(devicePixelRatio||1,2));
    const out=document.createElement("canvas");
    out.width=Math.round(w*s);out.height=Math.round(h*s);
    const g=out.getContext("2d");
    g.fillStyle=getComputedStyle(document.body).backgroundColor||"#000";
    if(g.fillStyle==="rgba(0, 0, 0, 0)")g.fillStyle="#000";
    g.fillRect(0,0,out.width,out.height);
    let any=false;
    const canvases=[...document.querySelectorAll("canvas")], frames=[];
    canvases.forEach((c,i)=>{
      const r=c.getBoundingClientRect();
      if(r.width<2||r.height<2||getComputedStyle(c).visibility==="hidden")return;
      // a small copy, made now: the game's own canvas can be huge on a phone, and is cleared after this frame
      const k=document.createElement("canvas");
      k.width=Math.max(1,Math.round(r.width*s));k.height=Math.max(1,Math.round(r.height*s));
      try{k.getContext("2d").drawImage(c,0,0,k.width,k.height);g.drawImage(k,r.left*s,r.top*s);any=true;frames[i]=k;}catch(e){}
    });
    frames.forEach((k,i)=>{try{frames[i]=k&&k.toDataURL("image/png");}catch(e){frames[i]=null;}});
    // the whole page (HTML interface over the game), each canvas replaced by the frame just copied
    const lib=h2c&&await h2c;
    if(lib){
      const frozen=[],marked=[];
      document.body.querySelectorAll("*").forEach(e=>{
        if(!e.getAnimations||!e.getAnimations().length||e.closest("#br-fab,#br-veil"))return;
        const cs=getComputedStyle(e),st={};
        for(const k of ["opacity","transform","visibility","filter","clipPath","translate","scale","rotate","color","backgroundColor"])if(cs[k]!=null&&cs[k]!=="")st[k]=cs[k];
        e.setAttribute("data-br-anim",frozen.length);frozen.push(st);marked.push(e);
      });
      try{
        const page=await Promise.race([lib(document.body,{
          scale:s,x:scrollX,y:scrollY,width:w,height:h,windowWidth:w,windowHeight:h,useCORS:true,logging:false,
          ignoreElements:el=>el.id==="br-fab"||el.id==="br-veil",
          onclone:doc=>{
            // the copy restarts the CSS animations from their start (a logo that drops in would be invisible):
            // each animated element, marked before the copy, is frozen as it is on screen right now
            doc.querySelectorAll("[data-br-anim]").forEach(el=>{
              const st=frozen[+el.getAttribute("data-br-anim")],d=el.style;
              d.animation="none";d.transition="none";
              for(const k in st)d[k]=st[k];
            });
            doc.querySelectorAll("canvas").forEach((c,i)=>{
              if(!frames[i])return;
              const r=canvases[i].getBoundingClientRect(), img=doc.createElement("img");
              img.src=frames[i];img.className=c.className;img.setAttribute("style",c.getAttribute("style")||"");
              img.style.width=r.width+"px";img.style.height=r.height+"px";
              c.replaceWith(img);
            });
          },
        }),new Promise((_,rej)=>setTimeout(()=>rej(new Error("page capture too slow")),8000))]);
        if(page&&page.width)return page;
      }catch(e){keep("BUGREPORT",["page capture failed",e]);}
      finally{marked.forEach(e=>e.removeAttribute("data-br-anim"));}
    }
    return any?out:null;
  }
  let h2cLoading=null;
  function loadH2C(){
    if(typeof window.html2canvas==="function")return Promise.resolve(window.html2canvas);
    return h2cLoading||(h2cLoading=new Promise((res,rej)=>{
      const sc=document.createElement("script");
      sc.src=H2C_URL;sc.async=true;
      sc.onload=()=>typeof window.html2canvas==="function"?res(window.html2canvas):rej(new Error("html2canvas missing"));
      sc.onerror=()=>{h2cLoading=null;rej(new Error("html2canvas not loaded"));};
      setTimeout(()=>rej(new Error("html2canvas timeout")),6000);
      document.head.appendChild(sc);
    }));
  }
  function toImage(src){
    // always a copy: the game's own canvas must never be moved into the window or drawn on
    return new Promise((res,rej)=>{
      if(src instanceof HTMLCanvasElement){
        const s=Math.min(1,SHOT_SIDE/Math.max(src.width,src.height));
        const c=document.createElement("canvas");c.width=Math.round(src.width*s);c.height=Math.round(src.height*s);
        c.getContext("2d").drawImage(src,0,0,c.width,c.height);return res(c);
      }
      const i=new Image();i.onload=()=>{
      const s=Math.min(1,SHOT_SIDE/Math.max(i.width,i.height));
      const c=document.createElement("canvas");c.width=Math.round(i.width*s);c.height=Math.round(i.height*s);
      c.getContext("2d").drawImage(i,0,0,c.width,c.height);res(c);};i.onerror=rej;i.src=src;});
  }
  function encode(canvas){
    try{
      for(const q of [.8,.65,.5,.35]){
        const d=canvas.toDataURL("image/jpeg",q);
        if(d.length*.75<SHOT_BYTES)return d;
      }
    }catch(e){keep("BUGREPORT",["screenshot not readable",e]);}  // a canvas tainted by a cross-origin image
    return "";
  }

  // ---------- sending, and the reports waiting for network
  function post(report){
    const ctrl=window.AbortController?new AbortController():null;
    const t=ctrl?setTimeout(()=>ctrl.abort(),TIMEOUT_MS):0;
    return fetch(URL_REPORT,Object.assign({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(report)},ctrl?{signal:ctrl.signal}:{}))
      .then(r=>r.json().catch(()=>({})).then(d=>{clearTimeout(t);if(!r.ok){const e=new Error(d.error||("HTTP "+r.status));e.server=true;throw e;}return d;}));
  }
  function queue(){try{return JSON.parse(store.get(QUEUE_KEY)||"[]");}catch(e){return [];}}
  function enqueue(report){
    const q=queue();q.push(report);
    while(q.length>QUEUE_MAX)q.shift();
    // too big for the storage: keep the text, drop the screenshot
    if(!store.set(QUEUE_KEY,JSON.stringify(q))){q[q.length-1]=Object.assign({},report,{shot:""});store.set(QUEUE_KEY,JSON.stringify(q));}
  }
  let flushing=false;
  async function flush(){
    if(flushing||!navigator.onLine)return;
    flushing=true;
    try{
      let q=queue();
      while(q.length){
        try{await post(q[0]);}catch(e){if(!e.server)break;}  // a refused report is dropped, a network error waits
        q=queue();q.shift();store.set(QUEUE_KEY,JSON.stringify(q));
      }
    }finally{flushing=false;}
  }

  function report(kind,body,severity,reporter,shot){
    return {
      kind,game:opts.id,version:String(opts.version),build:String(opts.build||""),body,severity,reporter,
      platform:(window.Capacitor&&Capacitor.getPlatform&&Capacitor.getPlatform())||"web",
      device:navigator.userAgent.slice(0,200),
      screen:innerWidth+"x"+innerHeight+"@"+(Math.round((devicePixelRatio||1)*100)/100),
      lang:(navigator.language||"").slice(0,10),scene:String(call(opts.scene,"")||"").slice(0,80),
      context:Object.assign({tool:"bugreport.js "+TOOL_VERSION,url:location.href.split("#")[0].slice(0,200),uptime:Math.round((Date.now()-started)/1000)+" s",
        memory:navigator.deviceMemory?navigator.deviceMemory+" Go":undefined},call(opts.context,{})||{}),
      logs:logs.slice(),shot:shot||"",client:clientId(),
    };
  }

  // ---------- the window
  function css(t){
    const v=Object.assign({bg:"#fffaf0",fg:"#2b2233",muted:"#6b6070",accent:"#2f6fdb",accentFg:"#ffffff",font:"inherit",radius:"14px"},t||{});
    return `
#br-veil{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;
  padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));background:rgba(10,8,20,.6);
  font-family:${v.font};-webkit-tap-highlight-color:transparent}
#br-box{width:100%;max-width:440px;max-height:100%;overflow:auto;box-sizing:border-box;padding:16px;background:${v.bg};color:${v.fg};
  border-radius:${v.radius};box-shadow:0 10px 40px rgba(0,0,0,.4);text-align:left}
#br-box{position:relative}
#br-box h2{margin:0 36px 10px 0;font-size:1.15rem;font-weight:700}
#br-veil #br-box .br-x{position:absolute;top:8px;right:8px;width:40px;height:40px;border:0;border-radius:50%;background:rgba(127,127,127,.15);
  color:inherit;font:400 22px/40px system-ui,sans-serif;padding:0;cursor:pointer}
#br-box .br-shot{position:relative;border-radius:10px;overflow:hidden;background:#000;touch-action:none}
#br-box .br-shot canvas{display:block!important;position:static!important;inset:auto!important;transform:none!important;
  width:100%!important;height:auto!important;max-height:38vh!important;max-width:100%!important;object-fit:contain;cursor:crosshair;
  margin:0!important;opacity:1!important;visibility:visible!important;z-index:auto!important;pointer-events:auto!important}
#br-box .br-x{z-index:2}
#br-veil button,#br-veil textarea,#br-veil input{position:static;transform:none}
#br-veil,#br-veil *{letter-spacing:normal;text-transform:none;font-variant:normal;text-shadow:none;word-spacing:normal}
#br-box .br-tools{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0 10px;font-size:.82rem;color:${v.muted}}
#br-box .br-none{padding:18px;text-align:center;color:#aaa;font-size:.9rem}
#br-box label{display:block;margin:10px 0 4px;font-size:.85rem;font-weight:700}
#br-box textarea,#br-box input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:9px 10px;border-radius:10px;
  border:2px solid rgba(127,127,127,.35);background:rgba(127,127,127,.08);color:inherit}
#br-box textarea,#br-box input{-webkit-user-select:text;user-select:text}
#br-box textarea{min-height:92px;resize:vertical}
#br-box .br-kind{display:flex;gap:6px;margin:0 0 10px}
#br-box .br-sev,#br-box .br-kind{display:flex;gap:6px;flex-wrap:wrap}
#br-box .br-sev button,#br-box .br-kind button{flex:1;min-height:40px;border-radius:999px;border:2px solid rgba(127,127,127,.35);background:transparent;color:inherit;font:inherit;font-size:.92rem}
#br-box .br-sev button[aria-pressed="true"],#br-box .br-kind button[aria-pressed="true"]{border-color:${v.accent};background:${v.accent};color:${v.accentFg};font-weight:700}
#br-box .br-msg{margin:10px 0 0;font-size:.92rem}
#br-box .br-row{display:flex;gap:10px;justify-content:flex-end;margin-top:14px}
#br-box .br-ver{margin:10px 0 0;text-align:right;font-size:.72rem;opacity:.55}
#br-box .br-row button,#br-box .br-tools button{font:inherit;cursor:pointer;border:0;border-radius:999px}
#br-box .br-row button{font-size:1rem;min-height:44px;padding:10px 18px}
#br-box .br-tools button{background:transparent;color:${v.muted};text-decoration:underline;padding:4px 0;font-size:.82rem}
#br-box .br-cancel{background:transparent;color:${v.muted}}
#br-box .br-send{background:${v.accent};color:${v.accentFg};font-weight:700}
#br-box button:disabled{opacity:.6;cursor:default}
#br-fab{position:fixed;z-index:2147483000;width:40px;height:40px;border-radius:50%;border:0;padding:0;background:rgba(20,16,30,.55);
  color:#fff;font-size:20px;line-height:40px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3);touch-action:none;user-select:none;
  -webkit-user-select:none;opacity:.7;cursor:pointer}
#br-fab:active{opacity:1}`;
  }
  function style(){
    if(document.getElementById("br-style"))return;
    const s=document.createElement("style");s.id="br-style";s.textContent=css(opts.theme);document.head.appendChild(s);
  }

  // drawing on the screenshot: red strokes, undo
  function painter(canvas){
    const base=canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height);
    const strokes=[];let cur=null;
    const g=canvas.getContext("2d");
    const at=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];};
    function redraw(){
      g.putImageData(base,0,0);
      g.lineCap=g.lineJoin="round";g.strokeStyle="#ff2a2a";g.lineWidth=Math.max(3,canvas.width/180);
      for(const s of strokes){g.beginPath();s.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();}
    }
    canvas.addEventListener("pointerdown",e=>{cur=[at(e)];strokes.push(cur);try{canvas.setPointerCapture(e.pointerId);}catch(x){}redraw();});
    canvas.addEventListener("pointermove",e=>{if(cur){cur.push(at(e));redraw();}});
    const end=()=>{cur=null;};
    canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",end);
    return {undo(){strokes.pop();redraw();},get count(){return strokes.length;}};
  }

  async function show(start){
    if(open||!opts)return;
    open=true;
    if(fab)fab.style.display="none";
    let shot=null;
    try{shot=await grab();}catch(e){keep("BUGREPORT",["screenshot failed",e]);}
    call(opts.pause);
    style();
    const tx=TEXT[langOf()];
    const veil=document.createElement("div");
    veil.id="br-veil";
    veil.innerHTML=`<div id="br-box" role="dialog" aria-modal="true" aria-labelledby="br-title">
<button type="button" class="br-x"></button><h2 id="br-title"></h2><div class="br-kind" role="group"></div><div class="br-shot"></div><div class="br-tools"><span class="br-hint"></span><button type="button" class="br-undo"></button></div>
<label for="br-text" class="br-what"></label><textarea id="br-text" maxlength="4000"></textarea>
<div class="br-sevbox"><label class="br-sevl"></label><div class="br-sev" role="group"></div></div>
<label for="br-name" class="br-namel"></label><input id="br-name" maxlength="40" autocomplete="nickname">
<p class="br-msg" role="status"></p>
<div class="br-row"><button type="button" class="br-cancel"></button><button type="button" class="br-send"></button></div>
<p class="br-ver"></p></div>`;
    const $=s=>veil.querySelector(s);
    let kind=start==="idea"?"idea":"bug";
    function setKind(k){
      kind=k;
      $("#br-title").textContent=k==="idea"?tx.titleIdea:tx.title;
      $(".br-what").textContent=k==="idea"?tx.whatIdea:tx.what;
      $("#br-text").placeholder=k==="idea"?tx.phIdea:tx.ph;
      $(".br-sevbox").hidden=k==="idea";
      $(".br-kind").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.k===k)));
    }
    for(const k of ["bug","idea"]){
      const b=document.createElement("button");b.type="button";b.dataset.k=k;b.textContent=tx[k];
      b.onclick=()=>setKind(k);$(".br-kind").appendChild(b);
    }
    $(".br-sevl").textContent=tx.sev;
    $(".br-namel").textContent=tx.name;
    $("#br-name").value=store.get(NAME_KEY)||"";
    $(".br-cancel").textContent=tx.cancel;
    $(".br-ver").textContent=(opts.id||"")+" v"+opts.version+" \u00b7 bugreport "+TOOL_VERSION;
    $(".br-send").textContent=tx.send;
    let pen=null;
    if(shot){
      $(".br-shot").appendChild(shot);
      pen=painter(shot);
      $(".br-hint").textContent=tx.draw;
      $(".br-undo").textContent=tx.undo;
      $(".br-undo").onclick=()=>pen.undo();
    }else{
      $(".br-shot").innerHTML=`<div class="br-none"></div>`;$(".br-none").textContent=tx.noshot;$(".br-tools").remove();
    }
    setKind(kind);
    let severity="major";
    for(const k of ["blocker","major","minor"]){
      const b=document.createElement("button");b.type="button";b.textContent=tx[k];b.setAttribute("aria-pressed",String(k===severity));
      b.onclick=()=>{severity=k;$(".br-sev").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));};
      $(".br-sev").appendChild(b);
    }
    function close(){
      open=false;veil.remove();window.removeEventListener("keydown",esc,true);
      if(fab)fab.style.display="";
      call(opts.resume);
    }
    function esc(e){if(e.key==="Escape"){e.stopPropagation();close();}else e.stopPropagation();}
    // taps and keys on the window must not reach the game underneath
    ["pointerdown","pointerup","touchstart","touchend","click","wheel"].forEach(e=>veil.addEventListener(e,ev=>ev.stopPropagation()));
    window.addEventListener("keydown",esc,true);
    $(".br-cancel").onclick=close;
    $(".br-x").textContent="\u2715";$(".br-x").setAttribute("aria-label",tx.cancel);$(".br-x").title=tx.cancel;
    $(".br-x").onclick=()=>{if(!$(".br-send").disabled)close();};  // not while a report is leaving
    $(".br-send").onclick=async()=>{
      const body=$("#br-text").value.trim(), m=$(".br-msg");
      if(!body){m.textContent=tx.empty;$("#br-text").focus();return;}
      const name=$("#br-name").value.trim();store.set(NAME_KEY,name);
      const send=$(".br-send");send.disabled=$(".br-cancel").disabled=true;send.textContent=tx.sending;
      const r=report(kind,body,kind==="idea"?"minor":severity,name,shot?encode(shot):"");
      try{
        const d=await post(r);
        m.textContent=(kind==="idea"?tx.thanksIdea:tx.thanks).replace("{n}",d.id);
        setTimeout(close,1400);
        flush();
      }catch(e){
        if(e.server){m.textContent=tx.error.replace("{e}",e.message);send.disabled=$(".br-cancel").disabled=false;send.textContent=tx.send;return;}
        enqueue(r);m.textContent=tx.queued;setTimeout(close,2200);
      }
    };
    document.body.appendChild(veil);
    try{$("#br-text").focus({preventScroll:true});}catch(e){}
  }

  // ---------- the floating button, draggable, remembered where it was left
  function makeFab(){
    style();
    fab=document.createElement("button");
    fab.id="br-fab";fab.type="button";fab.textContent="\ud83d\udc1e";
    fab.setAttribute("aria-label",TEXT[langOf()].btn);fab.title=TEXT[langOf()].btn;
    let pos;try{pos=JSON.parse(store.get(POS_KEY)||"null");}catch(e){}
    const place=(x,y)=>{
      x=Math.max(4,Math.min(innerWidth-44,x));y=Math.max(4,Math.min(innerHeight-44,y));
      fab.style.left=x+"px";fab.style.top=y+"px";return [x,y];
    };
    let [x,y]=pos?[pos[0]*innerWidth,pos[1]*innerHeight]:[innerWidth-52,innerHeight*.35];
    [x,y]=place(x,y);
    let drag=null;
    fab.addEventListener("pointerdown",e=>{e.stopPropagation();drag={sx:e.clientX,sy:e.clientY,x,y,moved:false};try{fab.setPointerCapture(e.pointerId);}catch(x){}});
    fab.addEventListener("pointermove",e=>{
      if(!drag)return;
      const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
      if(Math.abs(dx)+Math.abs(dy)>8)drag.moved=true;
      if(drag.moved)[x,y]=place(drag.x+dx,drag.y+dy);
    });
    fab.addEventListener("pointerup",e=>{
      e.stopPropagation();
      if(!drag)return;
      const moved=drag.moved;drag=null;
      if(moved)store.set(POS_KEY,JSON.stringify([x/innerWidth,y/innerHeight]));else show();
    });
    ["click","touchstart","touchend"].forEach(n=>fab.addEventListener(n,e=>e.stopPropagation()));
    window.addEventListener("resize",()=>{[x,y]=place(x,y);});
    document.body.appendChild(fab);
  }

  function init(o){
    if(opts||!o||!o.id||!o.version)return;
    opts=o;
    const off=params.get("bugreport")==="off";
    const ready=()=>{
      if(!off&&(o.button===true||params.get("bugreport")==="button"))makeFab();
      flush();
    };
    // three fingers on the screen at once: nothing to see, nothing in the way of the game
    if(!off)window.addEventListener("touchstart",e=>{
      if(e.touches.length===3&&!open){setTimeout(()=>{if(!open)show();},0);}
    },{passive:true,capture:true});
    if(document.body)ready();else document.addEventListener("DOMContentLoaded",ready);
    window.addEventListener("online",flush);
    window.addEventListener("keydown",e=>{if(e.key==="F8"&&!open){e.preventDefault();show();}});
  }

  window.BugReport={init,open:show,flush,get pending(){return queue().length;}};
})();
