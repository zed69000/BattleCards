// GDD preview scenes. Loaded only with ?tuning=preview: each chapter of the developer space opens the
// game on what it describes, plays it by itself and captions the sliders at work.
// Nothing leaves the page and nothing reaches the real save while this file is active.
(function () {
  "use strict";
  const params = new URLSearchParams(location.search);
  if (params.get("tuning") !== "preview") return;
  const slug = params.get("gdd") || "";
  const onGamePage = /cosmos\.html$|\/$/.test(location.pathname);
  const LEGEND_H = 34;
  const IDLE_RESUME_MS = 30000;
  const SAVE_KEY = "bda_save_v1";

  /* ───── Safety net, installed before the game script runs ───── */
  const DEMO_SAVE = JSON.stringify({
    name: "Commandant", mute: true, tuto: true, crystals: 420, games: 5, xp: 240,
    camp: { cleared: 5, stars: [3, 2, 3, 1, 2] }, stage: 5,
    seen: { welcomeGifts: 1, journey: 1, shop: 1 }
  });
  // Storage: the game reads a demo save and writes to memory only.
  try {
    const real = window.localStorage, memory = new Map(), P = Storage.prototype;
    const { getItem, setItem, removeItem, clear } = P;
    P.getItem = function (k) {
      if (this !== real) return getItem.call(this, k);
      if (memory.has(k)) return memory.get(k);
      if (k === SAVE_KEY) return DEMO_SAVE;
      if (k === "bda_a2hs") return "1";
      return getItem.call(this, k);
    };
    P.setItem = function (k, v) { if (this === real) memory.set(k, String(v)); else setItem.call(this, k, v); };
    P.removeItem = function (k) { if (this === real) memory.delete(k); else removeItem.call(this, k); };
    P.clear = function () { if (this === real) memory.clear(); else clear.call(this); };
  } catch (e) { /* storage unavailable: the game already copes with that */ }
  // Network: same-origin files only, no socket, no beacon.
  const nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = new URL(typeof input === "string" ? input : input.url || String(input), location.href);
    if (url.origin !== location.origin) return Promise.reject(new TypeError("Blocked in the GDD preview"));
    return nativeFetch.call(window, input, init);
  };
  window.WebSocket = class {
    constructor() { this.readyState = 0; }
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
  if (navigator.sendBeacon) navigator.sendBeacon = () => true;
  // The demo has no touch to answer, and the browser logs an error for each vibration without one.
  if (navigator.vibrate) navigator.vibrate = () => false;
  // Straight to the scene: no studio screen, no title page.
  document.documentElement.classList.remove("splash", "cover");

  /* ───── Legend ───── */
  const SLIDERS = {
    "rythme.annonceManche": { label: "Annonce de manche", unit: "ms", paced: true },
    "rythme.lectureTotaux": { label: "Lecture des totaux", unit: "ms", paced: true },
    "rythme.finManche": { label: "Pause entre manches", unit: "ms", paced: true },
    "ia.reflexion": { label: "Réponse de l'adversaire", unit: "ms", paced: true },
    "ia.rechercheAllie": { label: "Recherche d'allié", unit: "ms", paced: true },
    "ia.hasard": { label: "Hasard de l'IA", unit: "×" },
    "ia.renoncement": { label: "Renoncement à l'allié", unit: "×" },
    "ia.seuilAllie": { label: "Prudence pour l'allié", unit: "" },
    "boss.zorglaxFrequence": { label: "Super coup de Zorglax, toutes les", unit: "manches" },
    "partie.margeDecision": { label: "Marge « Partie jouée »", unit: "points" },
    "anim.arene": { label: "Changement d'arène", unit: "ms" },
    "anim.piece": { label: "Vol des pièces", unit: "ms" },
    "anim.boosterObjet": { label: "Pause entre objets", unit: "ms", paced: true }
  };
  const MECA_KEYS = ["rythme.annonceManche", "rythme.lectureTotaux", "rythme.finManche", "ia.reflexion", "ia.rechercheAllie", "ia.hasard", "ia.renoncement", "ia.seuilAllie", "boss.zorglaxFrequence", "partie.margeDecision"];
  const IFACE_KEYS = ["anim.arene", "anim.piece", "anim.boosterObjet"];
  const legend = { title: null, line: null, hints: [], hintAt: 0, queue: [], busyUntil: 0, keys: [] };

  function buildLegend(title, hints, keys) {
    const css = document.createElement("style");
    css.textContent = `
      #gddLegend { position: fixed; top: 0; left: 0; right: 0; height: ${LEGEND_H}px; z-index: 9999; pointer-events: none; box-sizing: border-box;
        padding: 3px 8px 0; background: #10162b; border-bottom: 2px dashed rgba(245, 233, 207, 0.35); color: #f5e9cf;
        font: 11px/14px Righteous, ui-rounded, system-ui, sans-serif; letter-spacing: 0.01em; }
      #gddLegend b, #gddLegend span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      #gddLegend b { font-weight: 400; color: #f5c445; }
      #gddLegend span { font-size: 10.5px; color: #f5e9cf; }
      #gddLegend span.live { color: #7be0a4; }
      #gddFinger { position: fixed; z-index: 9998; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; pointer-events: none;
        border: 3px solid #f5e9cf; background: rgba(245, 196, 69, 0.45); box-shadow: 0 2px 0 #0a0f1e; opacity: 0; transition: opacity 160ms; }`;
    document.head.appendChild(css);
    const box = document.createElement("div");
    box.id = "gddLegend";
    box.setAttribute("aria-live", "off");
    box.innerHTML = "<b></b><span></span>";
    document.body.appendChild(box);
    legend.title = box.querySelector("b");
    legend.line = box.querySelector("span");
    legend.title.textContent = title;
    legend.hints = hints;
    legend.keys = keys;
    setLine(hints[0] || "");
    setInterval(tickLegend, 500);
  }
  function setLine(text, live = false) {
    legend.line.textContent = text;
    legend.line.classList.toggle("live", live);
  }
  function sliderText(key, value) {
    const def = SLIDERS[key], unit = def.unit;
    const fmt = n => String(Math.round(n * 100) / 100).replace(".", ",");
    if (def.paced) {
      const pace = Tuning.num("rythme.pauses", 0.6);
      return `${def.label} : ${fmt(value)} ms × ${fmt(pace)} = ${Math.round(value * pace)} ms`;
    }
    return `${def.label}${unit === "manches" ? "" : " :"} ${unit === "×" ? "×" : ""}${fmt(value)}${unit && unit !== "×" ? ` ${unit}` : ""}`;
  }
  function tickLegend() {
    const now = Date.now();
    if (now < legend.busyUntil) return;
    const next = legend.queue.shift();
    if (next) { setLine(next, true); legend.busyUntil = now + 1100; legend.hintAt = now + 1100; return; }
    if (now >= legend.hintAt && legend.hints.length) {
      legend.hintIndex = ((legend.hintIndex === undefined ? -1 : legend.hintIndex) + 1) % legend.hints.length;
      setLine(legend.hints[legend.hintIndex]);
      legend.hintAt = now + 4000;
    }
  }
  function say(text, ms = 1800) { legend.queue.length = 0; setLine(text, true); legend.busyUntil = Date.now() + ms; legend.hintAt = legend.busyUntil; }
  function noteSlider(key, value) {
    if (!legend.keys.includes(key)) return;
    const text = sliderText(key, value);
    if (legend.queue.includes(text)) return;
    legend.queue.push(text);
    // A caption that arrives too late would describe a moment already gone.
    if (legend.queue.length > 2) legend.queue.shift();
  }

  /* ───── Scene runner ───── */
  const ABORT = new Error("scene aborted");
  let token = 0, auto = true, resumeTimer = 0;
  const alive = t => { if (t !== token || !auto) throw ABORT; };
  function runner(run) {
    const t = ++token;
    const again = () => Promise.resolve().then(() => run(t)).then(() => { alive(t); return again(); });
    again().catch(err => { if (err !== ABORT) console.error(err); });
  }
  function bindTakeover(start, onTake, onResume) {
    window.addEventListener("pointerdown", e => {
      if (!e.isTrusted) return;
      auto = false;
      token += 1;
      onTake();
      legend.queue.length = 0;
      setLine("À toi de jouer. La démo repart après 30 s sans toucher.");
      legend.busyUntil = Date.now() + IDLE_RESUME_MS;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { auto = true; legend.busyUntil = 0; onResume(); start(); }, IDLE_RESUME_MS);
    }, true);
  }
  const makeWait = t => ms => new Promise(resolve => setTimeout(resolve, ms)).then(() => alive(t));
  async function waitFor(t, test, max) {
    const wait = makeWait(t), end = Date.now() + max;
    while (!test() && Date.now() < end) await wait(150);
    alive(t);
  }
  async function scrollTour(t, el, ms) {
    const wait = makeWait(t), span = el.scrollHeight - el.clientHeight;
    if (span <= 0) return wait(ms);
    const steps = Math.ceil(ms / 40);
    for (let i = 1; i <= steps; i += 1) { el.scrollTop = (span * i) / steps; await wait(40); }
  }

  /* ───── Music page (chapter Son) ───── */
  function startMusicPage() {
    const style = document.createElement("style");
    style.textContent = `body { padding-top: ${LEGEND_H}px !important; } .gdd-focus { outline: 3px solid #f5c445; outline-offset: 2px; }`;
    document.head.appendChild(style);
    buildLegend("Son · les morceaux du jeu", ["Aucun curseur. L'aperçu reste muet tout seul.", "Touche « Écouter » pour entendre un morceau."], []);
    const cards = [...document.querySelectorAll(".card")];
    const clearFocus = () => cards.forEach(c => c.classList.remove("gdd-focus"));
    const start = () => runner(async t => {
      const wait = makeWait(t);
      for (const card of cards) {
        clearFocus();
        card.classList.add("gdd-focus");
        card.scrollIntoView({ block: "center" });
        await wait(3000);
      }
    });
    bindTakeover(start, clearFocus, () => {});
    start();
  }

  /* ───── Game page ───── */
  function startGamePage() {
    /* Test-mode money screens stay closed in the preview, even for a real touch. */
    window.watchAd = () => Promise.resolve(false);
    window.buyTest = () => Promise.resolve(false);
    window.loadPeerJS = () => Promise.reject(new Error("Blocked in the GDD preview"));

    const trace = [];
    const log = entry => { trace.push({ ...entry, at: Math.round(performance.now()) }); if (trace.length > 300) trace.shift(); };
    const nativeRound = window.startRound;
    window.startRound = function (battle) {
      const out = nativeRound.apply(this, arguments);
      log({ kind: "round", round: S.round, battle: battle || 0, charged: S.charged });
      return out;
    };
    const nativeNum = Tuning.num;
    Tuning.num = (key, def) => {
      const value = nativeNum(key, def);
      if (SLIDERS[key] || key === "rythme.pauses") log({ kind: "read", key, value });
      if (SLIDERS[key]) noteSlider(key, value);
      return value;
    };
    Tuning.onChange(next => {
      const key = Object.keys(next).find(k => legend.keys.includes(k));
      if (key) say(`Curseur reçu. ${sliderText(key, next[key])}`, 2200);
      else if ("rythme.pauses" in next && legend.keys.length) say(`Curseur reçu. Vitesse des pauses : ×${next["rythme.pauses"]}`, 2200);
    });
    window.GDDPreview = { scene: slug, trace, isAuto: () => auto };

    /* Bot: plays the player's side through the same functions as a real touch. */
    const bot = { on: false, style: "", key: "", since: 0, done: 0, acting: false };
    const sleepPlain = ms => new Promise(resolve => setTimeout(resolve, ms));
    const canCommit = () => auto && bot.on;
    const finger = document.createElement("div");
    finger.id = "gddFinger";
    document.body.appendChild(finger);
    function placeFinger(x, y) { finger.style.left = `${x}px`; finger.style.top = `${y}px`; finger.style.opacity = "1"; }
    const hideFinger = () => { finger.style.opacity = "0"; };
    const cardNode = card => $(`#hand .card[data-id="${card.id}"]`);
    async function tapGesture(card) {
      const el = cardNode(card);
      if (!el) return confirmCard(card);
      const c = center(el);
      placeFinger(c.x, c.y);
      say("Geste : toucher une carte affiche son effet", 1500);
      onHandCard(card);
      await sleepPlain(1300);
      hideFinger();
      if (!canCommit()) return;
      say("Geste : la toucher de nouveau la confirme", 1200);
      if (S.sel === card.id) confirmCard(card); else confirmCard(card);
    }
    async function dragGesture(card) {
      const el = cardNode(card), slot = $(`#slot-0-${S.phase === "riposte" ? "ally" : S.phase}`);
      if (!el || !slot) return confirmCard(card);
      const a = center(el), b = center(slot), dx = b.x - a.x, dy = b.y - a.y;
      say("Geste : glisser une carte vers le haut la joue", 1500);
      placeFinger(a.x, a.y);
      await sleepPlain(250);
      if (!canCommit()) { hideFinger(); return; }
      slot.classList.add("hot");
      el.classList.add("dragging");
      const move = el.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(1.12)` }], { duration: 650, easing: "ease-in-out", fill: "forwards" });
      finger.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px)` }], { duration: 650, easing: "ease-in-out" });
      await sleepPlain(650);
      hideFinger();
      slot.classList.remove("hot");
      if (!canCommit()) { move.cancel(); el.classList.remove("dragging"); return; }
      el.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`;
      move.cancel();
      confirmCard(card, { from: rectOf(el), spin: 6, force: 0.6 });
    }
    function comboScore(a, b) {
      let total = 0;
      try { for (const part of formation(a, b)) total += part[1]; } catch (e) { /* atouts without a pair bonus */ }
      return total;
    }
    function pickCard() {
      const hand = S.hands[0].slice();
      const byValue = (x, y) => x.value - y.value;
      if (bot.style === "swing") {
        // Takes one round, gives up the next, so the arena keeps changing hands.
        const win = S.round % 2 === 0;
        hand.sort(byValue);
        return win ? hand[hand.length - 1] : hand[0];
      }
      if (S.phase === "amb") {
        const van = S.board.van[0];
        hand.sort((x, y) => comboScore(van, y) - comboScore(van, x) || y.value - x.value);
        return hand[0];
      }
      let best = hand[rand(hand.length)], score = -1;
      for (const x of hand) for (const y of hand) {
        if (x === y) continue;
        const s = comboScore(x, y) * 3 + x.value + y.value;
        if (s > score) { score = s; best = x; }
      }
      return best;
    }
    function playCardGesture(card) {
      if (bot.style !== "control") { confirmCard(card); return Promise.resolve(); }
      bot.flip = !bot.flip;
      return bot.flip ? dragGesture(card) : tapGesture(card);
    }
    async function botPlay() {
      if (S.phase === "mull") {
        if (bot.style === "control") {
          say("Échange de départ : toucher les cartes à renvoyer", 2000);
          for (const card of S.hands[0].slice(0, 2)) {
            const el = cardNode(card);
            if (el) { const c = center(el); placeFinger(c.x, c.y); }
            toggleMull(card);
            await sleepPlain(700);
            if (!canCommit()) { hideFinger(); return; }
          }
          hideFinger();
          endMull(true);
        } else endMull(false);
        return;
      }
      if (S.phase === "van" || S.phase === "amb") return playCardGesture(pickCard());
      // Third card: the odds-on ally that still turns the round around, or give up.
      const options = S.hands[0].filter(selectable).sort((x, y) => allyInfo(y).pct - allyInfo(x).pct);
      const giveUp = bot.style === "swing" && S.round % 2 !== 0;
      if (!options.length || giveUp) { if (S.phase === "ally") fold(); else pickRiposte(null); return; }
      return playCardGesture(options[0]);
    }
    function botTick() {
      if (!auto || !bot.on || bot.acting) return;
      $("#pause").classList.remove("on");
      if (!$("#game").classList.contains("on") || S.swapMode) return;
      const buttons = $("#actions").querySelectorAll("button");
      const idle = !S.busy && ["mull", "van", "amb", "ally", "riposte"].includes(S.phase);
      const asking = S.busy && buttons.length > 0 && S.phase === "van";
      if (!idle && !asking) { bot.key = ""; return; }
      const key = [gameId, S.round, S.battle, S.phase, asking].join();
      const now = Date.now();
      if (key !== bot.key) { bot.key = key; bot.since = now; bot.done = 0; }
      if (now - bot.since < (asking ? 2600 : 700) || (bot.done && now - bot.done < 6000)) return;
      bot.done = now;
      bot.acting = true;
      const step = asking ? Promise.resolve(buttons[0].click()) : Promise.resolve().then(botPlay);
      step.catch(err => console.error(err)).then(() => { bot.acting = false; });
    }
    setInterval(botTick, 120);

    /* Stage helpers */
    let snapshot = "";
    function restoreSave() {
      for (const k of Object.keys(save)) delete save[k];
      Object.assign(save, JSON.parse(snapshot));
      S.stage = save.stage;
      S.cast[0] = CHARS[save.char].tribe;
      S.rival = null;
      chapterView = STAGES[S.stage].c;
      colSub = "chars";
      colPick = null;
    }
    function resetStage() {
      bot.on = false;
      gameId += 1;
      closeCoach();
      clearInterval(endGame.count);
      clearInterval(seekUI.timer);
      for (const el of document.querySelectorAll(".overlay.on")) el.classList.remove("on");
      document.documentElement.classList.remove("cover", "cover-out");
      battleFx(0);
      holdWarp(0);
      restoreSave();
      S.mode = "adv";
      show("menu");
      renderMenu();
      showTab("adv");
    }
    function ownEverything() {
      CHAR_IDS.forEach(id => { save.chars[id] = 1; });
      grantAtouts(ATOUT_IDS);
      for (const [kind, table] of [["dice", DICE], ["back", BACKS], ["decor", DECORS]]) Object.keys(table).forEach(id => { save.skins[kind][id] = 1; });
      save.fresh = {};
    }
    // Sets the experience so that the next game earns a level.
    function nearLevelUp() {
      let xp = save.xp;
      while (levelInfo(xp + 50).lvl === levelInfo(xp).lvl) xp += 10;
      save.xp = xp;
    }
    const paneOf = name => document.querySelector(`.pane[data-pane="${name}"]`);
    async function play(t, o = {}) {
      if (o.stage !== undefined) { S.stage = save.stage = o.stage; chapterView = STAGES[S.stage].c; }
      if (o.rival) S.rival = o.rival;
      bot.style = o.style || "";
      bot.flip = false;
      bot.key = "";
      newGame(o.mode || "adv", null, o.opt || {});
      if (o.cards !== undefined) for (const p of [0, 1]) if (S.decks[p].length > o.cards) S.decks[p].length = o.cards;
      bot.on = true;
      await waitFor(t, () => $("#endScreen").classList.contains("on"), o.max || 300000);
      bot.on = false;
    }
    async function tabs(t, names, ms) {
      const wait = makeWait(t);
      for (const name of names) {
        if (name === "shop") $("#shopTabBtn").hidden = false;
        showTab(name);
        if (paneOf(name)) paneOf(name).scrollTop = 0;
        await wait(ms);
      }
    }
    // Moves through a collection page item by item, as a touch on each cell would.
    async function browse(t, sub, ids, ms) {
      const wait = makeWait(t);
      colSub = sub;
      showTab("cards");
      for (const id of ids) {
        colPick = id;
        renderCollection();
        const cell = document.querySelector(`#colGrid .cell[data-id="${id}"]`);
        if (cell) cell.scrollIntoView({ block: "nearest" });
        await wait(ms);
      }
    }
    async function openBooster(t) {
      const wait = makeWait(t);
      save.freePacks = Math.max(1, save.freePacks || 0);
      openCapsuleShop(true);
      await wait(900);
      const before = $("#capTitle").textContent;
      $("#pack").click();
      await waitFor(t, () => $("#capTitle").textContent !== before, 30000);
      await wait(1800);
      closeCapsule();
    }
    // The developer shortcut: same reward screen as a real win, without the game.
    async function instantWin(t, stage) {
      S.stage = save.stage = stage;
      chapterView = STAGES[stage].c;
      newGame("adv");
      gameId += 1;
      closeCoach();
      S.loot = [26, 9];
      endGame();
      await waitFor(t, () => $("#endScreen").classList.contains("on"), 6000);
    }

    const SCENES = {
      "vue-ensemble": {
        title: "Vue d'ensemble · titre, menus, partie",
        hints: ["Page de titre, menus, puis une courte partie. Aucun curseur."],
        run: async t => {
          const wait = makeWait(t);
          document.documentElement.classList.add("cover");
          await wait(3000);
          document.documentElement.classList.remove("cover");
          await tabs(t, ["adv", "cards", "arena"], 3000);
          await play(t, { cards: 2 });
          await wait(3500);
        }
      },
      "boucle-de-jeu": {
        title: "Boucle de jeu · jouer, encaisser, ouvrir",
        hints: ["Adversaire, partie, récompenses, booster. Aucun curseur."],
        run: async t => {
          const wait = makeWait(t);
          say("Choisir un adversaire", 2200);
          await wait(2500);
          await play(t, { cards: 4 });
          say("Encaisser cristaux, expérience, étoiles", 3500);
          await scrollTour(t, $(".end-sheet"), 3000);
          await wait(1500);
          $("#unlock").classList.remove("on");
          $(".end-sheet").scrollTop = 0;
          goMenu();
          say("Ouvrir un booster", 3000);
          await openBooster(t);
          await browse(t, "atouts", [ATOUT_IDS[0]], 2500);
        }
      },
      regles: {
        title: "Règles · la fiche, puis des manches jouées",
        hints: ["Formations, total, allié au dé. Aucun curseur."],
        run: async t => {
          const wait = makeWait(t);
          openHelp(null);
          const sheet = $("#help .help");
          const scroller = sheet.scrollHeight > sheet.clientHeight ? sheet : $("#help .sheet");
          scroller.scrollTop = 0;
          await scrollTour(t, scroller, 9000);
          $("#help").classList.remove("on");
          say("L'IA et le joueur cherchent les formations", 2500);
          await play(t, { cards: 6 });
          await wait(3000);
        }
      },
      cartes: {
        title: "Cartes et atouts · les 17 atouts, puis les cartes",
        hints: ["Les atouts défilent, puis les cartes. Aucun curseur."],
        setup: ownEverything,
        run: async t => {
          const wait = makeWait(t);
          await browse(t, "atouts", ATOUT_IDS, 1800);
          goMenu();
          await play(t, { cards: 2 });
          await wait(2500);
        }
      },
      personnages: {
        title: "Personnages · tribus et talents",
        hints: ["Chaque personnage défile avec son talent. Aucun curseur."],
        setup: ownEverything,
        run: t => browse(t, "chars", CHAR_IDS, 1500)
      },
      controles: {
        title: "Contrôles · les gestes du joueur",
        hints: ["Le rond clair montre le doigt. Aucun curseur."],
        run: async t => {
          const wait = makeWait(t);
          await play(t, { cards: 6, style: "control" });
          await wait(3000);
        }
      },
      mecaniques: {
        title: "Mécaniques · partie seule contre Zorglax",
        keys: MECA_KEYS,
        hints: ["Rythme, IA, boss : chaque curseur s'affiche quand il agit.", "Tous les délais sont relus à chaque manche."],
        setup: () => { save.camp.cleared = STAGES.length; save.camp.stars = []; save.stage = STAGES.findIndex(sg => sg.boss === "zorglax"); ownEverything(); },
        run: async t => {
          const wait = makeWait(t);
          await play(t, { stage: STAGES.findIndex(sg => sg.boss === "zorglax") });
          await wait(3500);
        }
      },
      progression: {
        title: "Progression · récompenses puis Ton aventure",
        hints: ["Cristaux, XP, étoiles, niveau, déblocages. Aucun curseur."],
        setup: nearLevelUp,
        run: async t => {
          const wait = makeWait(t);
          await instantWin(t, save.camp.cleared);
          await wait(4800);
          $("#unlock").classList.remove("on");
          // On a short screen the buttons stay stuck over the tiles: scrolling brings them into view.
          await scrollTour(t, $(".end-sheet"), 3500);
          await wait(1500);
          $(".end-sheet").scrollTop = 0;
          $("#endScreen").classList.remove("on");
          goMenu();
          openJourney();
          await wait(5000);
          closeJourney();
        }
      },
      multijoueur: {
        title: "Multijoueur · ligue, attente, partie locale",
        hints: ["Démonstration locale : aucun serveur, aucun adversaire réel.", "Aucun curseur."],
        run: async t => {
          const wait = makeWait(t);
          await tabs(t, ["arena"], 3500);
          openLobby("", true);
          lobbyMsg("Aperçu : salle d'attente, sans connexion.");
          seekUI(true);
          await wait(5000);
          seekUI(false);
          $("#lobby").classList.remove("on");
          say("Un joueur résident prend la partie (IA locale)", 3000);
          await play(t, { mode: "arena", opt: { resident: true }, rival: pickRival(), cards: 2 });
          await wait(4000);
        }
      },
      "direction-artistique": {
        title: "Direction artistique · titre, décors, dos, dés",
        hints: ["Illustrations dessinées en code. Aucun curseur."],
        setup: ownEverything,
        run: async t => {
          const wait = makeWait(t);
          document.documentElement.classList.add("cover");
          await wait(2500);
          document.documentElement.classList.remove("cover");
          await browse(t, "decor", Object.keys(DECORS), 1800);
          await browse(t, "back", Object.keys(BACKS).slice(0, 8), 1100);
          await browse(t, "dice", Object.keys(DICE).slice(0, 8), 1100);
        }
      },
      interface: {
        title: "Interface · arène, pièces, booster",
        keys: IFACE_KEYS,
        hints: ["Arène, pièces vers le score, puis un booster.", "Chaque curseur s'affiche quand il agit."],
        run: async t => {
          const wait = makeWait(t);
          await openBooster(t);
          await play(t, { cards: 4, style: "swing" });
          await wait(2000);
        }
      },
      monetisation: {
        title: "Monétisation · boutique et vidéos, sans achat",
        hints: ["Rien n'est lancé : aucune vidéo, aucun achat. Aucun curseur."],
        run: async t => {
          const wait = makeWait(t);
          await tabs(t, ["shop"], 800);
          await scrollTour(t, paneOf("shop"), 7000);
          openBoosters();
          say("Page Boosters : vidéo au choix du joueur", 3500);
          await wait(4000);
          closeBoosters();
          await instantWin(t, Math.max(0, save.camp.cleared - 1));
          say("Fin de partie : la vidéo reste un bouton à toucher", 4500);
          await wait(5000);
          $("#unlock").classList.remove("on");
        }
      },
      technique: {
        title: "Technique · pas d'écran dédié, voici les options",
        hints: ["Version, langue, son, confidentialité. Aucun curseur."],
        run: async t => {
          await tabs(t, ["more"], 2500);
          await scrollTour(t, paneOf("more"), 6000);
          await makeWait(t)(2500);
        }
      }
    };

    const scene = SCENES[slug];
    if (!scene) return;
    buildLegend(scene.title, scene.hints, scene.keys || []);
    // The legend takes its height from the screen, so cards keep fitting below it.
    const shift = document.createElement("style");
    shift.textContent = `.view, .overlay, #cover { top: ${LEGEND_H}px !important; }`;
    document.head.appendChild(shift);
    const fitBelowLegend = () => {
      const h = (window.innerHeight / window.UIZ - LEGEND_H) / 100, root = document.documentElement.style;
      root.setProperty("--vh", `${h}px`);
      root.setProperty("--dvh", `${h}px`);
    };
    window.addEventListener("resize", fitBelowLegend);
    fitBelowLegend();

    if (scene.setup) scene.setup();
    snapshot = JSON.stringify(save);
    // The demo stays silent; a real touch gives the sound back.
    const start = () => {
      soundOn = false;
      runner(async t => { resetStage(); await scene.run(t); });
    };
    bindTakeover(start, () => { soundOn = true; bot.on = false; hideFinger(); }, () => {});
    start();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (onGamePage && typeof startRound === "function") startGamePage();
    else if (document.querySelector(".card[data-track]") && slug) startMusicPage();
  });
})();
