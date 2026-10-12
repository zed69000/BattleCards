/* Simulateur d'équilibrage : rejoue les règles de cosmos.html sans affichage, des milliers de fois.
 *
 * Les deux camps sont pilotés par l'IA du jeu (niveau au choix pour chacun). Le simulateur reprend les
 * constantes de la page (LEVELS, ATOUTS, RANKS, threshold, chance…), donc il se lance DANS la page du jeu :
 * ouvrir cosmos.html, coller ce fichier dans la console, puis par exemple
 *   BalanceSim.run({ lv: [1, 1], atouts: [["hole"], []] }, 5000)
 * Résultat : taux de victoire du camp 0, écart moyen de butin, et taux de victoire quand l'atout a été pioché.
 */
window.BalanceSim = (function () {
  const R = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i -= 1) { const j = R(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const thrOf = c => c.thr || threshold(c.value);
  const ev = (c, o) => (c.special === "clone" ? (o && o.special !== "clone" ? o.value : 0) : c.value);
  function formation(a, b) {
    const out = [], va = ev(a, b), vb = ev(b, a);
    if (va === vb) out.push(5); else if (Math.abs(va - vb) === 1) out.push(2);
    if (a.house === b.house && a.house !== "X") out.push(3);
    return out;
  }
  function makeDeck() { const d = []; for (const h of "SHDC") for (const [label, value] of RANKS) d.push({ label, value, house: h }); return shuffle(d); }
  const atout = id => ({ label: "★", value: ATOUTS[id].value, thr: ATOUTS[id].thr, house: "X", special: id });
  function inject(deck, ids) {
    ids.forEach(id => {
      const lows = deck.map((c, i) => [c, i]).filter(([c]) => !c.special).sort((x, y) => x[0].value - y[0].value);
      deck[lows[R(Math.min(6, lows.length))][1]] = atout(id);
    });
    return shuffle(deck);
  }
  /* Cartes supplémentaires consumées par la Supernova, en plus d'elle-même (doit refléter la règle du jeu). */
  let NOVA_EXTRA_BURN = 0;
  const setNovaBurn = n => { NOVA_EXTRA_BURN = n; };
  const empty = () => ({ van: [null, null], amb: [null, null], ally: [null, null], allyOk: [false, false], cut: [0, 0] });

  function game(cfg) {
    const st = { lv: cfg.lv, cast: cfg.cast || ["none", "none"] };
    const d = makeDeck();
    st.decks = [inject(d.slice(0, 26), cfg.atouts[0]), inject(d.slice(26), cfg.atouts[1])];
    st.hands = [[], []]; st.loot = [0, 0]; st.pot = []; st.first = R(2);
    st.fuel = [0, 1].map(p => (st.cast[p] === "mars" ? 2 : 1));
    const drawn = [new Set(), new Set()];
    const stats = { ally: [0, 0], allyOk: [0, 0], counter: [0, 0], war: 0 };
    const hs = p => (st.cast[p] === "poulpes" ? 6 : 5);
    let B = empty(), revealed = false, hidden = [false, false];

    const onBoard = (p, sp) => [B.van[p], revealed ? B.amb[p] : null, B.allyOk[p] ? B.ally[p] : null].some(c => c && c.special === sp);
    function total(p) {
      const o = 1 - p, van = B.van[p], amb = B.amb[p];
      if (!revealed) return van ? ev(van, null) : 0;
      const vv = van ? ev(van, amb) : 0, va = amb ? ev(amb, van) : 0;
      let t = vv + va;
      if (van && amb) for (const x of formation(van, amb)) t += x;
      const shield = onBoard(p, "shield"), impact = B.amb[o] && B.amb[o].house === "S", hole = onBoard(o, "hole");
      if (!(shield && (impact || hole))) { if (impact) t -= 2; if (hole) t -= Math.max(vv, va); }
      if (B.allyOk[p]) t += Math.max(0, (B.ally[p].special === "clone" ? Math.max(vv, va) : B.ally[p].value) - B.cut[p]);
      return t;
    }
    const totals = () => [total(0), total(1)];
    function afterAlly(p, c) {
      const keep = [B.ally[p], B.allyOk[p]];
      B.ally[p] = c; B.allyOk[p] = true;
      const t = totals();
      [B.ally[p], B.allyOk[p]] = keep;
      return t;
    }
    function plan(p, fixedVan, knownAmb) {
      const o = 1 - p, L = LEVELS[st.lv[p]], hand = st.hands[p], seen = hidden[o] ? null : B.van[o];
      let expected, slope = L.slope;
      if (seen && knownAmb) {
        expected = ev(seen, knownAmb) + ev(knownAmb, seen) + formation(seen, knownAmb).reduce((a, b) => a + b, 0) + 0.5;
        slope = 0.4;
      } else {
        const rest = [...st.decks[o], ...st.hands[o]];
        const mean = L.count && rest.length ? rest.reduce((t, c) => t + c.value, 0) / rest.length : 8;
        expected = (seen ? ev(seen, null) : mean) + mean + 1;
      }
      const oppBest = seen ? Math.max(seen.value, 8) : 9, worth = 4 + st.pot.length;
      let best = null;
      for (const van of fixedVan ? [fixedVan] : hand) {
        for (const amb of hand) {
          if (amb === van) continue;
          let power = ev(van, amb) + ev(amb, van);
          for (const x of formation(van, amb)) power += x;
          if (amb.house === "S") power += 2;
          if (van.special === "hole" || amb.special === "hole") power += oppBest;
          const pWin = 1 / (1 + Math.exp(-(power - expected) / slope));
          let u = pWin * worth - (van.value + amb.value) * L.cost + Math.random() * L.noise;
          if (amb.house === "D") u += 0.3 * pWin;
          if (amb.house === "H" || amb.house === "C") u += 0.3 * (1 - pWin);
          if (!fixedVan && van.value < amb.value) u += 0.2;
          if (!fixedVan && van.special === "spy") u += 0.7;
          if (amb.special === "spy") u -= 0.4;
          if (!best || u > best.u) best = { u, van, amb };
        }
      }
      return best;
    }
    const take = (p, c) => { st.hands[p].splice(st.hands[p].indexOf(c), 1); return c; };
    const tank = (p, c) => { if (c && c.special === "tank" && !c.done) { c.done = true; st.fuel[p] = Math.min(MAX_FUEL, st.fuel[p] + 2); } };
    const stock = p => st.decks[p].length + st.hands[p].length;
    const blind = p => (st.decks[p].length ? st.decks[p].shift() : st.hands[p].length ? st.hands[p].splice(R(st.hands[p].length), 1)[0] : null);
    const onTable = () => [...B.van, ...B.amb, ...B.ally].filter(Boolean);

    function finish(w, war) {
      const cards = onTable().concat(st.pot);
      if (w === null) { st.pot = cards; st.first = 1 - st.first; return; }
      const l = 1 - w, nova = cards.some(c => c.special === "nova");
      const kept = Math.max(0, cards.filter(c => c.special !== "nova").length - (nova ? NOVA_EXTRA_BURN : 0));
      const steal = !war && onBoard(w, "tractor") ? Math.min(2, st.loot[l]) : 0;
      const refuel = !war && B.amb[w] && B.amb[w].house === "D";
      st.loot[w] += kept + steal; st.loot[l] -= steal; st.pot = [];
      if (st.fuel[l] < MAX_FUEL) st.fuel[l] += 1;
      if (refuel && st.fuel[w] < MAX_FUEL) st.fuel[w] += 1;
      st.first = w;
    }
    function war() {
      stats.war += 1;
      for (let level = 1; ; level += 1) {
        st.pot.push(...onTable()); B = empty(); revealed = false;
        if (!stock(0) || !stock(1)) return finish(!stock(0) && !stock(1) ? null : stock(0) ? 0 : 1, true);
        for (const p of [1, 0]) if (stock(p) >= 2) B.amb[p] = blind(p);
        const val = [0, 0];
        for (const p of [1, 0]) {
          const L = LEVELS[st.lv[p]];
          const boost = L.fuel && st.fuel[p] > 0 && stock(p) >= 2 && (level >= 2 || st.pot.length >= 7 || Math.random() < 0.4);
          let c = blind(p);
          if (boost) { st.fuel[p] -= 1; const other = blind(p); if (other) { const keep = other.value > c.value ? other : c; st.pot.push(keep === c ? other : c); c = keep; } }
          B.van[p] = c; val[p] = c.value;
        }
        if (val[0] !== val[1]) return finish(val[0] > val[1] ? 0 : 1, true);
      }
    }
    function round() {
      B = empty(); revealed = false; hidden = [false, false];
      for (const p of [0, 1]) while (st.hands[p].length < hs(p) && st.decks[p].length) { const c = st.decks[p].shift(); st.hands[p].push(c); if (c.special) drawn[p].add(c.special); }
      const f = st.first, s = 1 - f;
      hidden[f] = st.cast[f] === "incognito";
      B.van[f] = take(f, plan(f, null).van);
      B.van[s] = take(s, plan(s, null).van);
      hidden[f] = false;
      tank(0, B.van[0]); tank(1, B.van[1]);
      const spies = [0, 1].map(p => B.van[p].special === "spy"), spy = spies[0] !== spies[1] ? (spies[0] ? 0 : 1) : null;
      if (spy !== null) {
        const v = 1 - spy;
        B.amb[v] = take(v, plan(v, B.van[v]).amb);
        B.amb[spy] = take(spy, plan(spy, B.van[spy], B.amb[v]).amb);
      } else {
        const picks = [0, 1].map(p => plan(p, B.van[p]).amb);
        for (const p of [0, 1]) B.amb[p] = take(p, picks[p]);
      }
      revealed = true;
      tank(0, B.amb[0]); tank(1, B.amb[1]);
      let t = totals();
      if (t[0] === t[1]) return war();
      const l = t[0] < t[1] ? 0 : 1, w = 1 - l, L = LEVELS[st.lv[l]];
      let pick = null;
      if (Math.random() >= (L.skip || 0)) {
        const amb = B.amb[l], bonus = amb.house === "H" ? 1 : 0;
        const opts = st.hands[l].map(c => ({ c, t: afterAlly(l, c) })).filter(o => o.t[l] >= o.t[w]).map(({ c, t: tt }) => ({
          c, score: chance(thrOf(c) - (L.fuel ? Math.min(st.fuel[l], 1) : 0), bonus, amb.house === "C") * (tt[l] > tt[w] ? 1 : 0.45) - c.value * 0.004
        })).sort((a, b) => b.score - a.score);
        if (opts.length && (opts[0].score >= 0.2 || st.pot.length >= 4)) pick = opts[0].c;
      }
      if (!pick) return finish(w, false);
      stats.ally[l] += 1;
      take(l, pick); B.ally[l] = pick; tank(l, pick);
      const thr = thrOf(pick), bonus = B.amb[l].house === "H" ? 1 : 0;
      let reroll = B.amb[l].house === "C" ? 1 : 0, spent = 0, roll = 1 + R(6);
      while (roll + bonus + spent < thr) {
        const need = thr - (roll + bonus);
        if (reroll > 0) { reroll -= 1; roll = 1 + R(6); }
        else if (st.fuel[l] >= need && L.fuel) { spent = need; st.fuel[l] -= need; }
        else break;
      }
      if (roll + bonus + spent < thr) return finish(w, false);
      const base = total(l);
      B.allyOk[l] = true; stats.allyOk[l] += 1;
      t = totals();
      const gain = t[l] - base;
      if (gain > 0 && t[l] >= t[w] && st.fuel[w] >= 1) {
        const margin = t[l] - t[w];
        if (margin <= 5 && (LEVELS[st.lv[w]].fuel ? (6 - margin) / 6 >= 0.33 : Math.random() < 0.4)) {
          st.fuel[w] -= 1; stats.counter[w] += 1;
          const die = 1 + R(6), c = st.cast[w];
          B.cut[l] = Math.min(c === "cranes" ? Math.max(die, 2) : die, gain);
          t = totals();
        }
      }
      if (t[l] > t[w]) return finish(l, false);
      if (t[l] === t[w]) return war();
      return finish(w, false);
    }

    let rounds = 0;
    while (stock(0) >= 2 && stock(1) >= 2 && rounds < 300) { round(); rounds += 1; }
    return { win: st.loot[0] > st.loot[1] ? 1 : st.loot[0] < st.loot[1] ? 0 : 0.5, diff: st.loot[0] - st.loot[1], rounds, drawn, stats };
  }

  /* cfg.atouts peut contenir "random3" pour tirer 3 atouts au hasard à chaque partie. */
  function run(cfg, n) {
    let win = 0, diff = 0, rounds = 0, drawnN = 0, drawnWin = 0, war = 0;
    const pickSet = spec => (spec === "random3" ? shuffle(ATOUT_IDS).slice(0, 3) : spec);
    for (let i = 0; i < n; i += 1) {
      const g = game({ lv: cfg.lv, cast: cfg.cast, atouts: [pickSet(cfg.atouts[0]), pickSet(cfg.atouts[1])] });
      win += g.win; diff += g.diff; rounds += g.rounds; war += g.stats.war;
      if (cfg.watch && g.drawn[0].has(cfg.watch)) { drawnN += 1; drawnWin += g.win; }
    }
    const pct = x => Math.round(x * 1000) / 10;
    return { win: pct(win / n), diff: Math.round((diff / n) * 100) / 100, rounds: Math.round((rounds / n) * 10) / 10, wars: Math.round((war / n) * 100) / 100,
      drawn: cfg.watch ? pct(drawnN / n) : undefined, winIfDrawn: cfg.watch && drawnN ? pct(drawnWin / drawnN) : undefined };
  }
  return { game, run, setNovaBurn };
})();
