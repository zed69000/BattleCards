/* Simulateur d'équilibrage : rejoue les règles de cosmos.html sans affichage, des milliers de fois.
 *
 * Les deux camps sont pilotés par l'IA du jeu. Le simulateur reprend les données de la page
 * (ATOUTS, ATOUT_IDS, RANKS, threshold, chance, lootOf, MAX_FUEL, STAGES, BOSSES…), donc il se lance DANS
 * la page du jeu : ouvrir cosmos.html, coller ce fichier dans la console, puis par exemple
 *   BalanceSim.run({ lv: [PLAYER, STAGES[3].ai], boss: [null, "crush"], atouts: [["hole"], []] }, 5000)
 *   BalanceSim.campaign(PLAYER, 3000)   // taux de victoire du joueur type à chaque étape de la campagne
 * Un niveau d'IA est un objet { greed, cost, slope, noise, skip, count, exact, bonusHand, bonusFuel }.
 * Résultat : taux de victoire du camp 0, écart moyen de butin, et quelques mesures de rythme.
 */
window.BalanceSim = (function () {
  const R = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i -= 1) { const j = R(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const thrOf = c => c.thr || threshold(c.value);
  const CLONE_CAP = 7;
  const SIPHON = 3;  // points volés par le Siphon d'un boss
  const LOCK_MARGIN = 6;  // marge de sécurité (vols du Rayon tracteur, Siphon) avant de déclarer une partie jouée
  const ev = (c, o) => (c.special === "clone" ? (o && o.special !== "clone" ? Math.min(o.value, CLONE_CAP) : 0) : c.value);
  function formation(a, b) {
    const out = [], va = ev(a, b), vb = ev(b, a);
    if (va === vb) out.push(5); else if (Math.abs(va - vb) === 1) out.push(2);
    if (a.house === b.house && a.house !== "X") out.push(3);
    return out;
  }
  const atoutLoot = id => (ATOUTS[id].loot !== undefined ? ATOUTS[id].loot : 2);
  function makeDeck() { const d = []; for (const h of "SHDC") for (const [label, value] of RANKS) d.push({ label, value, house: h, loot: lootOf(value) }); return shuffle(d); }
  const atout = id => ({ label: "★", value: ATOUTS[id].value, thr: ATOUTS[id].thr, house: "X", special: id, loot: atoutLoot(id) });
  function inject(deck, ids) {
    ids.forEach(id => {
      const lows = deck.map((c, i) => [c, i]).filter(([c]) => !c.special).sort((x, y) => x[0].value - y[0].value);
      deck[lows[R(Math.min(6, lows.length))][1]] = atout(id);
    });
    return shuffle(deck);
  }
  const empty = () => ({ van: [null, null], amb: [null, null], ally: [null, null], allyOk: [false, false], role: [null, null] });
  const lootSum = cards => cards.reduce((t, c) => t + (c ? c.loot : 0), 0);

  function game(cfg) {
    const Ls = cfg.lv, cast = cfg.cast || ["none", "none"], boss = cfg.boss || [null, null], every = cfg.every || [3, 3];
    const st = { first: R(2), round: 0 };
    const d = makeDeck();
    st.decks = [inject(d.slice(0, 26), cfg.atouts[0]), inject(d.slice(26), cfg.atouts[1])];
    st.hands = [[], []]; st.loot = [0, 0]; st.pot = [];
    st.fuel = [0, 1].map(p => (cast[p] === "mars" ? 2 : 1) + (Ls[p].bonusFuel || 0));
    const stats = { ally: 0, allyOk: 0, riposte: 0, riposteOk: 0, reversal: 0, war: 0, super: 0, superWon: 0, wasted: 0, swap: 0 };
    const hs = p => (cast[p] === "poulpes" ? 6 : 5) + (Ls[p].bonusHand || 0);
    let B = empty(), revealed = false, hidden = [false, false], charged = [false, false];
    const sup = (p, k) => charged[p] && boss[p] === k;

    const onBoard = (p, sp) => [B.van[p], revealed ? B.amb[p] : null, B.allyOk[p] ? B.ally[p] : null].some(c => c && c.special === sp);
    function total(p) {
      const o = 1 - p, van = B.van[p], amb = B.amb[p];
      if (!revealed) return van ? ev(van, null) : 0;
      const vv = van ? ev(van, amb) : 0, va = amb ? ev(amb, van) : 0;
      let t = vv + va;
      if (van && amb) for (const x of formation(van, amb)) t += x;
      const shield = onBoard(p, "shield"), impact = B.amb[o] && B.amb[o].house === "S", hole = onBoard(o, "hole"), met = onBoard(o, "meteor");
      if (!shield) { if (impact) t -= 2; if (hole && van && amb) t -= Math.min(vv, va); if (met) t -= 3; }
      if (B.allyOk[p]) { const c = B.ally[p]; t += c.special === "clone" ? Math.min(Math.max(vv, va), CLONE_CAP) : c.special === "turbo" ? c.value * 2 : c.value; }
      if (sup(p, "crush")) t += vv;
      if (sup(p, "tide")) t += 4;
      if (sup(o, "bomb")) t -= 3;
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
    function duelTotals(av, aa, bv, ba) {
      const side = (v, a, ov, oa) => {
        const vv = ev(v, a), va = ev(a, v);
        let t = vv + va;
        for (const x of formation(v, a)) t += x;
        const shield = [v, a].some(c => c.special === "shield"), hole = [ov, oa].some(c => c.special === "hole"), met = [ov, oa].some(c => c.special === "meteor"), impact = oa.house === "S";
        if (!shield) { if (impact) t -= 2; if (hole) t -= Math.min(vv, va); if (met) t -= 3; }
        return t;
      };
      return [side(av, aa, bv, ba), side(bv, ba, av, aa)];
    }
    function exactOdds(p, van, amb, seen, knownAmb, edge) {
      const o = 1 - p, pool = [...st.decks[o], ...st.hands[o]];
      let win = 0, tie = 0, n = 0;
      const count = ([a, b]) => { a += edge; if (a > b) win += 1; else if (a === b) tie += 1; n += 1; };
      if (seen && knownAmb) { count(duelTotals(van, amb, seen, knownAmb)); return [win, tie]; }
      if (seen) for (const x of pool) count(duelTotals(van, amb, seen, x));
      else for (let k = 0; k < 30 && pool.length > 1; k += 1) { const i = R(pool.length); let j = R(pool.length - 1); if (j >= i) j += 1; count(duelTotals(van, amb, pool[i], pool[j])); }
      return n ? [win / n, tie / n] : [0.5, 0];
    }
    /* Avantage connu du boss pendant son super coup (il sait qu'il frappe). */
    const bossEdge = (p, van) => (sup(p, "crush") ? ev(van, null) : 0) + (sup(p, "tide") ? 4 : 0) + (sup(p, "bomb") ? 3 : 0);
    function plan(p, fixedVan, knownAmb) {
      const o = 1 - p, L = Ls[p], hand = st.hands[p], seen = hidden[o] ? null : B.van[o];
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
          if (van.special === "hole" || amb.special === "hole") power += Math.min(oppBest, 6);
          if (van.special === "meteor" || amb.special === "meteor") power += 3;
          const edge = bossEdge(p, van);
          let pWin = 1 / (1 + Math.exp(-(power + edge - expected) / slope));
          if (L.exact) { const [w2, t2] = exactOdds(p, van, amb, seen, knownAmb, edge); pWin = w2 + t2 * 0.5; }
          const stake = van.loot + amb.loot + theirLoot + lootSum(st.pot) + (sup(p, "siphon") ? SIPHON : 0);
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
    /* Seuil de dé d'une 3ᵉ carte : Cryo et l'Ouragan d'un boss le durcissent d'un cran. */
    const thirdThr = (p, c) => thrOf(c) + (onBoard(1 - p, "cryo") ? 1 : 0) + (sup(1 - p, "storm") ? 1 : 0);
    const used = [false, false];  // relance radar utilisée cette manche
    function pickThird(p, role) {
      const o = 1 - p, L = Ls[p];
      if (Math.random() < (L.skip || 0) || st.fuel[p] < 1) return null;
      const amb = B.amb[p], bonus = (amb.house === "H" ? 1 : 0) + (role === "riposte" && cast[p] === "cranes" ? 1 : 0);
      const opts = st.hands[p].map(c => ({ c, t: afterAlly(p, c) })).filter(x => x.t[p] >= x.t[o]).map(({ c, t }) => ({
        c, score: chance(thirdThr(p, c), bonus, amb.house === "C" && !used[p]) * (t[p] > t[o] ? 1 : 0.45) - c.value * 0.004 - c.loot * 0.03
      })).sort((a, b) => b.score - a.score);
      return opts.length && (opts[0].score >= 0.2 || lootSum(st.pot) >= 6) ? opts[0].c : null;
    }
    function roll(p, card, role) {
      const thr = thirdThr(p, card), bonus = (B.amb[p].house === "H" ? 1 : 0) + (role === "riposte" && cast[p] === "cranes" ? 1 : 0);
      let r = 1 + R(6) + (surge[p] ? 1 : 0);
      surge[p] = false;
      if (r + bonus < thr && B.amb[p].house === "C" && !used[p]) { used[p] = true; r = 1 + R(6); }
      return r + bonus >= thr;
    }
    const take = (p, c) => { st.hands[p].splice(st.hands[p].indexOf(c), 1); return c; };
    /* Gain de boosts : au-delà du plafond, le surplus devient du butin (« loot »), un dé surchargé (« surge ») ou rien. */
    const surge = [false, false];
    const gain = (p, n) => {
      for (let i = 0; i < n; i += 1) {
        if (st.fuel[p] < MAX_FUEL) { st.fuel[p] += 1; continue; }
        stats.wasted += 1;
        if (OPT.overflow[p] === "loot") st.loot[p] += 1;
        else if (OPT.overflow[p] === "surge") surge[p] = true;
      }
    };
    const tank = (p, c) => { if (c && c.special === "tank" && !c.done) { c.done = true; gain(p, 2); } };
    /* Échange : 1 boost = 1 carte de la main glissée sous la pioche contre celle du dessus, une fois par manche. */
    function swap(p) {
      const mode = OPT.swap[p], hand = st.hands[p];
      if (mode === "never" || st.fuel[p] < 1 || !st.decks[p].length) return;
      const plain = hand.filter(c => !c.special);
      if (!plain.length) return;
      const weak = Math.max(...plain.map(c => c.value)) < 10;
      const full = st.fuel[p] >= MAX_FUEL;
      if (mode === "full" ? !full : !(full || (weak && st.fuel[p] >= 2))) return;
      const out = plain.reduce((a, c) => (c.value < a.value ? c : a));
      st.fuel[p] -= 1; stats.swap += 1;
      take(p, out); st.decks[p].push(out); hand.push(st.decks[p].shift());
    }
    const stock = p => st.decks[p].length + st.hands[p].length;
    const blind = p => (st.decks[p].length ? st.decks[p].shift() : st.hands[p].length ? st.hands[p].splice(R(st.hands[p].length), 1)[0] : null);
    const onTable = () => [...B.van, ...B.amb, ...B.ally].filter(Boolean);

    function finish(w, war) {
      const cards = onTable().concat(st.pot);
      if (w === null) { st.pot = cards; st.first = 1 - st.first; return; }
      const l = 1 - w, pts = lootSum(cards);
      let steal = !war && onBoard(w, "tractor") ? Math.min(3, st.loot[l]) : 0;
      if (sup(w, "siphon")) steal += Math.min(SIPHON, st.loot[l] - steal);
      if (charged[w]) stats.superWon += 1;
      const refuel = !war && B.amb[w] && B.amb[w].house === "D";
      st.loot[w] += pts + steal; st.loot[l] -= steal; st.pot = [];
      gain(l, 1);
      if (refuel) gain(w, 1);
      st.first = w;
    }
    function war() {
      stats.war += 1;
      for (let level = 1; ; level += 1) {
        st.pot.push(...onTable()); B = empty(); revealed = false;
        if (!stock(0) || !stock(1)) return finish(!stock(0) && !stock(1) ? null : stock(0) ? 0 : 1, true);
        for (const p of [1, 0]) if (stock(p) >= 2) B.amb[p] = blind(p);
        const val = [0, 0];
        if (OPT.war === "pick") {
          // Duel choisi : chacun pose une carte de sa main face cachée (+3 avec 1 boost), révélation simultanée.
          for (const p of [0, 1]) if (!st.hands[p].length && st.decks[p].length) st.hands[p].push(st.decks[p].shift());
          if (!st.hands[0].length || !st.hands[1].length) return finish(st.hands[0].length ? 0 : st.hands[1].length ? 1 : null, true);
          const stake = lootSum(st.pot) + lootSum(onTable());
          for (const p of [0, 1]) {
            const sorted = [...st.hands[p]].sort((a, b) => a.value - b.value), r = Math.random() * Ls[p].noise;
            const c = stake + r >= 9 ? sorted[sorted.length - 1] : stake + r >= 5 ? sorted[Math.floor(sorted.length / 2)] : sorted[0];
            const boost = st.fuel[p] >= 1 && c === sorted[sorted.length - 1] && (stake >= 10 || level >= 2);
            if (boost) st.fuel[p] -= 1;
            B.van[p] = take(p, c); val[p] = c.value + (boost ? 3 : 0);
          }
          if (val[0] !== val[1]) return finish(val[0] > val[1] ? 0 : 1, true);
          continue;
        }
        for (const p of [1, 0]) {
          const boost = st.fuel[p] > 0 && stock(p) >= 2 && (level >= 2 || lootSum(st.pot) >= 10 || Math.random() < 0.4);
          let c = blind(p);
          if (boost) { st.fuel[p] -= 1; const other = blind(p); if (other) { const keep = other.value > c.value ? other : c; st.pot.push(keep === c ? other : c); c = keep; } }
          B.van[p] = c; val[p] = c.value;
        }
        if (val[0] !== val[1]) return finish(val[0] > val[1] ? 0 : 1, true);
      }
    }
    function round() {
      st.round += 1;
      B = empty(); revealed = false; hidden = [false, false]; used[0] = used[1] = false;
      charged = [0, 1].map(p => Boolean(boss[p]) && st.round % every[p] === 0);
      if (charged[0] || charged[1]) stats.super += 1;
      for (const p of [0, 1]) while (st.hands[p].length < hs(p) && st.decks[p].length) st.hands[p].push(st.decks[p].shift());
      swap(0); swap(1);
      const f = st.first, s = 1 - f;
      hidden[f] = cast[f] === "incognito";
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
      const pick = pickThird(l, "ally");
      if (!pick) return finish(w, false);
      stats.ally += 1;
      st.fuel[l] -= 1;
      B.role[l] = "ally"; take(l, pick); B.ally[l] = pick; tank(l, pick);
      if (!roll(l, pick, "ally")) return finish(w, false);
      B.allyOk[l] = true; stats.allyOk += 1;
      t = totals();
      if (t[l] >= t[w]) {
        const rip = pickThird(w, "riposte");
        if (rip) {
          stats.riposte += 1;
          st.fuel[w] -= 1;
          B.role[w] = "riposte"; take(w, rip); B.ally[w] = rip; tank(w, rip);
          if (roll(w, rip, "riposte")) { B.allyOk[w] = true; stats.riposteOk += 1; t = totals(); }
        }
      }
      if (t[l] > t[w]) { stats.reversal += 1; return finish(l, false); }
      if (t[l] === t[w]) return war();
      return finish(w, false);
    }

    // decided = manche à partir de laquelle l'écart de butin ne peut plus être comblé (même règle que le jeu)
    let decided = null;
    while (stock(0) >= 2 && stock(1) >= 2 && st.round < 300) {
      round();
      const rest = lootSum([...st.decks[0], ...st.decks[1], ...st.hands[0], ...st.hands[1], ...st.pot]);
      if (decided === null && Math.abs(st.loot[0] - st.loot[1]) > rest + LOCK_MARGIN) decided = st.round;
    }
    return { win: st.loot[0] > st.loot[1] ? 1 : st.loot[0] < st.loot[1] ? 0 : 0.5, diff: st.loot[0] - st.loot[1], loot: st.loot, rounds: st.round, decided, stats };
  }

  /* cfg.atouts : une liste d'atouts, "random3" (3 au hasard), une liste de listes (une tirée par partie),
     ou "same" pour le camp 1 (autant d'atouts que le camp 0, tirés au hasard). */
  function run(cfg, n) {
    let win = 0, diff = 0, rounds = 0, pts = 0;
    const agg = {};
    const pickSet = spec => (spec === "random3" ? shuffle(ATOUT_IDS).slice(0, 3) : Array.isArray(spec[0]) ? spec[R(spec.length)] : spec);
    for (let i = 0; i < n; i += 1) {
      const a0 = pickSet(cfg.atouts[0]);
      const a1 = cfg.atouts[1] === "same" ? shuffle(ATOUT_IDS).slice(0, Math.min(a0.length, cfg.foeMax ?? 99)) : pickSet(cfg.atouts[1]);
      const g = game({ lv: cfg.lv, cast: cfg.cast, boss: cfg.boss, every: cfg.every, atouts: [a0, a1] });
      win += g.win; diff += g.diff; rounds += g.rounds; pts += g.loot[0] + g.loot[1];
      for (const k of Object.keys(g.stats)) agg[k] = (agg[k] || 0) + g.stats[k];
    }
    const r1 = x => Math.round(x * 10) / 10;
    const per = {}; for (const k of Object.keys(agg)) per[k] = Math.round((agg[k] / n) * 100) / 100;
    return { win: r1((win / n) * 100), diff: r1(diff / n), rounds: r1(rounds / n), points: r1(pts / n), perGame: per };
  }
  /* Le joueur type (niveau `me`) parcourt la campagne : il joue avec 3 des atouts gagnés avant chaque étape,
     l'adversaire en reçoit autant, tirés au hasard. Renvoie le taux de victoire étape par étape. */
  function campaign(me, n) {
    return STAGES.map((sg, i) => {
      const owned = [...START_ATOUTS, ...STAGES.slice(0, i).map(x => x.gift).filter(Boolean)];
      const mine = owned.length ? Array.from({ length: 12 }, () => shuffle(owned).slice(0, Math.min(MAX_ATOUTS, owned.length))) : [[]];
      const res = run({ lv: [me, sg.ai], cast: ["mars", sg.cast], boss: [null, sg.boss ? BOSSES[sg.boss].super : null], every: [3, sg.boss ? BOSSES[sg.boss].every : 3], foeMax: sg.foeAtouts, atouts: [mine, "same"] }, n);
      return { stage: i + 1, name: sg.name, boss: Boolean(sg.boss), win: res.win };
    });
  }
  /* Options de règles à tester, par camp : swap = "never" | "full" | "any", overflow = "none" | "loot" | "surge". */
  const OPT = { swap: ["any", "any"], overflow: ["loot", "loot"], war: "pick" };
  const set = o => Object.assign(OPT, o);
  return { game, run, campaign, set, OPT };
})();
