/* Simulateur d'équilibrage : rejoue les règles de cosmos.html sans affichage, des milliers de fois.
 *
 * Les deux camps sont pilotés par l'IA du jeu (niveau au choix pour chacun). Le simulateur reprend les
 * constantes de la page (LEVELS, ATOUTS, RANKS, threshold, chance, lootOf…), donc il se lance DANS la page
 * du jeu : ouvrir cosmos.html, coller ce fichier dans la console, puis par exemple
 *   BalanceSim.run({ lv: [1, 1], atouts: [["hole"], []] }, 5000)
 * Résultat : taux de victoire du camp 0, écart moyen de butin, et quelques mesures de rythme.
 */
window.BalanceSim = (function () {
  const R = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i -= 1) { const j = R(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const thrOf = c => c.thr || threshold(c.value);
  const ev = (c, o) => (c.special === "clone" ? (o && o.special !== "clone" ? Math.min(o.value, CLONE_CAP) : 0) : c.value);
  // Réglages retenus pour la v0.16 : le Trou noir aspire la plus faible carte, le Clone copie 7 au plus.
  let HOLE = Math.min, HOLE_BEST = x => x; let CLONE_CAP = 7;
  function formation(a, b) {
    const out = [], va = ev(a, b), vb = ev(b, a);
    if (va === vb) out.push(5); else if (Math.abs(va - vb) === 1) out.push(2);
    if (a.house === b.house && a.house !== "X") out.push(3);
    return out;
  }
  function makeDeck() { const d = []; for (const h of "SHDC") for (const [label, value] of RANKS) d.push({ label, value, house: h, loot: lootOf(value) }); return shuffle(d); }
  const atout = id => ({ label: "★", value: ATOUTS[id].value, thr: ATOUTS[id].thr, house: "X", special: id, loot: ATOUT_LOOT });
  function inject(deck, ids) {
    ids.forEach(id => {
      const lows = deck.map((c, i) => [c, i]).filter(([c]) => !c.special).sort((x, y) => x[0].value - y[0].value);
      deck[lows[R(Math.min(6, lows.length))][1]] = atout(id);
    });
    return shuffle(deck);
  }
  const empty = () => ({ van: [null, null], amb: [null, null], ally: [null, null], allyOk: [false, false], role: [null, null] });
  const lootSum = cards => cards.reduce((t, c) => t + (c && c.special !== "nova" ? c.loot : 0), 0);

  function game(cfg) {
    const st = { lv: cfg.lv, cast: cfg.cast || ["none", "none"] };
    const d = makeDeck();
    st.decks = [inject(d.slice(0, 26), cfg.atouts[0]), inject(d.slice(26), cfg.atouts[1])];
    st.hands = [[], []]; st.loot = [0, 0]; st.pot = []; st.first = R(2);
    st.fuel = [0, 1].map(p => (st.cast[p] === "mars" ? 2 : 1) + (LEVELS[st.lv[p]].bonusFuel || 0));
    const drawn = [new Set(), new Set()];
    const stats = { ally: 0, allyOk: 0, riposte: 0, riposteOk: 0, reversal: 0, war: 0 };
    const hs = p => (st.cast[p] === "poulpes" ? 6 : 5) + (LEVELS[st.lv[p]].bonusHand || 0);
    let B = empty(), revealed = false, hidden = [false, false];

    const onBoard = (p, sp) => [B.van[p], revealed ? B.amb[p] : null, B.allyOk[p] ? B.ally[p] : null].some(c => c && c.special === sp);
    function total(p) {
      const o = 1 - p, van = B.van[p], amb = B.amb[p];
      if (!revealed) return van ? ev(van, null) : 0;
      const vv = van ? ev(van, amb) : 0, va = amb ? ev(amb, van) : 0;
      let t = vv + va;
      if (van && amb) for (const x of formation(van, amb)) t += x;
      const shield = onBoard(p, "shield"), impact = B.amb[o] && B.amb[o].house === "S", hole = onBoard(o, "hole");
      if (!(shield && (impact || hole))) { if (impact) t -= 2; if (hole) t -= HOLE(vv, va); }
      if (B.allyOk[p]) t += B.ally[p].special === "clone" ? Math.min(Math.max(vv, va), CLONE_CAP) : B.ally[p].value;
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
    /* Totaux exacts de deux paires face à face (sans allié) : sert au calcul de probabilités du Stratège. */
    function duelTotals(av, aa, bv, ba) {
      const side = (v, a, ov, oa) => {
        const vv = ev(v, a), va = ev(a, v);
        let t = vv + va;
        for (const x of formation(v, a)) t += x;
        const shield = [v, a].some(c => c.special === "shield"), hole = [ov, oa].some(c => c.special === "hole"), impact = oa.house === "S";
        if (!(shield && (impact || hole))) { if (impact) t -= 2; if (hole) t -= HOLE(vv, va); }
        return t;
      };
      return [side(av, aa, bv, ba), side(bv, ba, av, aa)];
    }
    /* Probabilité de gagner la paire (van, amb) en passant en revue les cartes que l'adversaire peut encore avoir. */
    function exactOdds(p, van, amb, seen, knownAmb) {
      const o = 1 - p, pool = [...st.decks[o], ...st.hands[o]];
      let win = 0, tie = 0, n = 0;
      if (seen && knownAmb) { const [a, b] = duelTotals(van, amb, seen, knownAmb); return a > b ? [1, 0] : a === b ? [0, 1] : [0, 0]; }
      if (seen) { for (const x of pool) { const [a, b] = duelTotals(van, amb, seen, x); if (a > b) win += 1; else if (a === b) tie += 1; n += 1; } }
      else { for (let k = 0; k < 30 && pool.length > 1; k += 1) { const i = R(pool.length); let j = R(pool.length - 1); if (j >= i) j += 1; const [a, b] = duelTotals(van, amb, pool[i], pool[j]); if (a > b) win += 1; else if (a === b) tie += 1; n += 1; } }
      return n ? [win / n, tie / n] : [0.5, 0];
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
      const oppBest = seen ? Math.max(seen.value, 8) : 9;
      const theirLoot = (seen ? seen.loot : 1.5) + (knownAmb ? knownAmb.loot : 1.5);
      let best = null;
      for (const van of fixedVan ? [fixedVan] : hand) {
        for (const amb of hand) {
          if (amb === van) continue;
          let power = ev(van, amb) + ev(amb, van);
          for (const x of formation(van, amb)) power += x;
          if (amb.house === "S") power += 2;
          if (van.special === "hole" || amb.special === "hole") power += HOLE_BEST(oppBest);
          let pWin = 1 / (1 + Math.exp(-(power - expected) / slope));
          if (L.exact) { const [w2, t2] = exactOdds(p, van, amb, seen, knownAmb); pWin = w2 + t2 * 0.5; }
          const stake = van.loot + amb.loot + theirLoot + lootSum(st.pot);
          let u = (2 * pWin - 1) * stake * L.greed - (van.value + amb.value) * L.cost + Math.random() * L.noise;
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
    /* Choix d'une 3ᵉ carte (allié pour le camp en retard, riposte pour le camp attaqué). */
    function pickThird(p) {
      const o = 1 - p, L = LEVELS[st.lv[p]];
      if (Math.random() < (L.skip || 0)) return null;
      if (FUEL_MODE === "call" && st.fuel[p] < 1) return null;
      const amb = B.amb[p], bonus = (amb.house === "H" ? 1 : 0) + (B.role[o] === "ally" && st.cast[p] === "cranes" ? 1 : 0);
      const opts = st.hands[p].map(c => ({ c, t: afterAlly(p, c) })).filter(x => x.t[p] >= x.t[o]).map(({ c, t }) => ({
        c, score: chance(thrOf(c) - (FUEL_MODE === "dice" && L.fuel ? Math.min(st.fuel[p], 1) : 0), bonus, amb.house === "C") * (t[p] > t[o] ? 1 : 0.45) - c.value * 0.004 - c.loot * 0.03
      })).sort((a, b) => b.score - a.score);
      return opts.length && (opts[0].score >= 0.2 || lootSum(st.pot) >= 6) ? opts[0].c : null;
    }
    const used = [false, false];  // relance radar utilisée cette manche
    function roll(p, card) {
      const L = LEVELS[st.lv[p]], o = 1 - p;
      const thr = thrOf(card), bonus = (B.amb[p].house === "H" ? 1 : 0) + (B.role[p] === "riposte" && st.cast[p] === "cranes" ? 1 : 0);
      let spent = 0, r = 1 + R(6);
      while (r + bonus + spent < thr) {
        const need = thr - (r + bonus);
        if (B.amb[p].house === "C" && !used[p]) { used[p] = true; r = 1 + R(6); }
        else if (FUEL_MODE === "dice" && st.fuel[p] >= need && L.fuel) { spent = need; st.fuel[p] -= need; }
        else break;
      }
      return r + bonus + spent >= thr;
    }
    const take = (p, c) => { st.hands[p].splice(st.hands[p].indexOf(c), 1); return c; };
    const tank = (p, c) => { if (c && c.special === "tank" && !c.done) { c.done = true; st.fuel[p] = Math.min(MAX_FUEL, st.fuel[p] + 2); } };
    const stock = p => st.decks[p].length + st.hands[p].length;
    const blind = p => (st.decks[p].length ? st.decks[p].shift() : st.hands[p].length ? st.hands[p].splice(R(st.hands[p].length), 1)[0] : null);
    const onTable = () => [...B.van, ...B.amb, ...B.ally].filter(Boolean);

    function finish(w, war) {
      const cards = onTable().concat(st.pot);
      if (w === null) { st.pot = cards; st.first = 1 - st.first; return; }
      const l = 1 - w, pts = lootSum(cards);
      const steal = !war && onBoard(w, "tractor") ? Math.min(TRACTOR_STEAL, st.loot[l]) : 0;
      const refuel = !war && B.amb[w] && B.amb[w].house === "D";
      st.loot[w] += pts + steal; st.loot[l] -= steal; st.pot = [];
      if (st.fuel[l] < MAX_FUEL && (FUEL_GAIN === "always" || (FUEL_GAIN === "fold" && !B.ally[l]))) st.fuel[l] += 1;
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
          const boost = L.fuel && st.fuel[p] > 0 && stock(p) >= 2 && (level >= 2 || lootSum(st.pot) >= 10 || Math.random() < 0.4);
          let c = blind(p);
          if (boost) { st.fuel[p] -= 1; const other = blind(p); if (other) { const keep = other.value > c.value ? other : c; st.pot.push(keep === c ? other : c); c = keep; } }
          B.van[p] = c; val[p] = c.value;
        }
        if (val[0] !== val[1]) return finish(val[0] > val[1] ? 0 : 1, true);
      }
    }
    function round() {
      B = empty(); revealed = false; hidden = [false, false]; used[0] = used[1] = false;
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
      const l = t[0] < t[1] ? 0 : 1, w = 1 - l;
      const pick = pickThird(l);
      if (!pick) return finish(w, false);
      stats.ally += 1;
      if (FUEL_MODE === "call") st.fuel[l] -= 1;
      B.role[l] = "ally"; take(l, pick); B.ally[l] = pick; tank(l, pick);
      if (!roll(l, pick)) return finish(w, false);
      B.allyOk[l] = true; stats.allyOk += 1;
      t = totals();
      // Riposte : le camp dépassé peut poser une carte à son tour, s'il réussit son dé.
      if (t[l] >= t[w] && RIPOSTE) {
        const rip = pickThird(w);
        if (rip) {
          stats.riposte += 1;
          if (FUEL_MODE === "call") st.fuel[w] -= 1;
          B.role[w] = "riposte"; take(w, rip); B.ally[w] = rip; tank(w, rip);
          if (roll(w, rip)) { B.allyOk[w] = true; stats.riposteOk += 1; t = totals(); }
        }
      }
      if (t[l] > t[w]) { stats.reversal += 1; return finish(l, false); }
      if (t[l] === t[w]) return war();
      return finish(w, false);
    }

    let rounds = 0;
    while (stock(0) >= 2 && stock(1) >= 2 && rounds < 300) { round(); rounds += 1; }
    return { win: st.loot[0] > st.loot[1] ? 1 : st.loot[0] < st.loot[1] ? 0 : 0.5, diff: st.loot[0] - st.loot[1], loot: st.loot, rounds, drawn, stats };
  }

  /* Réglages de règles testables sans toucher au jeu. */
  let ATOUT_LOOT = 2, TRACTOR_STEAL = 3, RIPOSTE = true, FUEL_GAIN = "always", FUEL_MODE = "call";
  const set = o => { if ("atoutLoot" in o) ATOUT_LOOT = o.atoutLoot; if ("steal" in o) TRACTOR_STEAL = o.steal; if ("riposte" in o) RIPOSTE = o.riposte; if ("fuelGain" in o) FUEL_GAIN = o.fuelGain; if ("fuelMode" in o) FUEL_MODE = o.fuelMode; if ("cloneCap" in o) CLONE_CAP = o.cloneCap; if ("hole" in o) HOLE = o.hole === "min" ? Math.min : (a, b) => Math.max(a, b); };

  /* cfg.atouts peut contenir "random3" pour tirer 3 atouts au hasard à chaque partie. */
  function run(cfg, n) {
    let win = 0, diff = 0, rounds = 0, pts = 0;
    const agg = { ally: 0, allyOk: 0, riposte: 0, riposteOk: 0, reversal: 0, war: 0 };
    const pickSet = spec => (spec === "random3" ? shuffle(ATOUT_IDS).slice(0, 3) : spec);
    for (let i = 0; i < n; i += 1) {
      const g = game({ lv: cfg.lv, cast: cfg.cast, atouts: [pickSet(cfg.atouts[0]), pickSet(cfg.atouts[1])] });
      win += g.win; diff += g.diff; rounds += g.rounds; pts += g.loot[0] + g.loot[1];
      for (const k of Object.keys(agg)) agg[k] += g.stats[k];
    }
    const r1 = x => Math.round(x * 10) / 10;
    const per = {}; for (const k of Object.keys(agg)) per[k] = Math.round((agg[k] / n) * 100) / 100;
    return { win: r1((win / n) * 100), diff: r1(diff / n), rounds: r1(rounds / n), points: r1(pts / n), perGame: per };
  }
  return { game, run, set };
})();
