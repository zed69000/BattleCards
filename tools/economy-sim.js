/* Simulateur d'économie : fait vivre des joueurs virtuels pendant des mois, partie après partie.
 *
 * Il se lance DANS la page du jeu, après tools/balance-sim.js (les parties de campagne sont jouées par l'IA du
 * simulateur d'équilibrage, avec les vraies règles). Il reprend les données de la page : STAGES, RARITY, ITEMS,
 * MONET, GEM_PACKS, PICK_PRICE, CAPSULE_COST, lootBonus, levelInfo…
 *   EconomySim.run(EconomySim.PROFILES.videos, 30, 180)   // 30 joueurs pendant 180 jours
 *   EconomySim.report(30, 180)                            // tous les profils
 * Un profil : { name, games (par jour), ads (vidéos par jour, 0 à 4), buys: [{ day, what: "starter" | 300 | 800 | 2000 }],
 *   skill (niveau d'IA du joueur), every (rachète tous les N jours) }.
 */
window.EconomySim = (function () {
  const key = it => `${it.kind}:${it.id}`;
  const ALL = ITEMS.map(key);
  const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
  const euros = { starter: 1.99, 300: 1.99, 800: 4.99, 2000: 9.99 };
  /* Règles des boosters à essayer (par défaut celles du jeu). */
  // price ou priceAt (fraction possédée -> prix) ; pity : un nouvel objet garanti après N boosters sans nouveauté (0 = jamais).
  const OPT = { price: CAPSULE_COST, priceAt: f => (PRICE_STEPS.find(([max]) => f < max) || PRICE_STEPS[PRICE_STEPS.length - 1])[1], pity: 1 };

  function player(profile) {
    return { p: profile, gems: CAPSULE_COST, xp: 0, cleared: 0, owned: new Set(), atouts: new Set(START_ATOUTS), free: 0, spent: 0,
      dry: 0, fromAds: 0, fromGames: 0, fromDups: 0, packs: 0, newItems: 0, emptyPacks: 0, campaignDay: null, losses: 0, full: null, at: {} };
  }
  const slots = xp => { const lvl = levelInfo(xp).lvl; let n = 3; for (const [at, k] of SLOT_LEVELS) if (lvl >= at) n = k; return n; };
  function grant(pl, it) {
    pl.owned.add(key(it));
    if (it.kind === "atout") pl.atouts.add(it.id);
  }
  /* Same rule as the game: three different items, at least one new while something is missing. */
  function pack(pl) {
    const pulls = [];
    for (let t = 0; pulls.length < 3 && t < 60; t += 1) { const it = rollItem(); if (!pulls.some(x => key(x) === key(it))) pulls.push(it); }
    if (OPT.pity && pulls.every(it => pl.owned.has(key(it))) && pl.dry + 1 >= OPT.pity) {
      const missing = ITEMS.filter(it => !pl.owned.has(key(it)));
      if (missing.length) {
        const w = missing.map(it => RARITY[itemDef(it).rarity].weight), total = w.reduce((a, b) => a + b, 0);
        let r = Math.random() * total, k = 0;
        while (r >= w[k]) { r -= w[k]; k += 1; }
        pulls[2] = missing[k];
      }
    }
    let fresh = 0;
    for (const it of pulls) {
      if (pl.owned.has(key(it))) { const d = RARITY[itemDef(it).rarity].dup; pl.gems += d; pl.fromDups += d; } else { grant(pl, it); fresh += 1; }
    }
    pl.packs += 1;
    pl.newItems += fresh;
    pl.dry = fresh ? 0 : pl.dry + 1;
    if (!fresh && pl.owned.size < ALL.length) pl.emptyPacks += 1;
  }
  function campaignGame(pl) {
    const i = pl.cleared, sg = STAGES[i];
    const owned = [...pl.atouts], mine = owned.sort(() => Math.random() - 0.5).slice(0, slots(pl.xp));
    const foe = ATOUT_IDS.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(mine.length, sg.foeAtouts));
    const g = BalanceSim.game({ lv: [pl.p.skill || PLAYER, sg.ai], cast: ["mars", sg.cast], boss: [null, sg.boss ? BOSSES[sg.boss].super : null], every: [3, sg.boss ? BOSSES[sg.boss].every : 3], atouts: [mine, foe] });
    const [a, b] = g.loot, won = a > b, lost = a < b;
    let gain = won ? sg.reward + Math.min(20, a - b) : lost ? 8 : 12;
    gain += lootBonus(a);
    if (won) {
      pl.cleared += 1;
      if (sg.gift) pl.atouts.add(sg.gift);
    } else pl.losses += 1;
    return { gain, xp: won ? 50 : lost ? 20 : 30 };
  }
  /* After the campaign: arena games against rivals of mixed strength, with the real loot bonus. */
  /* Arena games are drawn from a bank of simulated games (one per player strength), which keeps long runs fast. */
  const bank = new Map();
  function arenaGame(pl) {
    const skill = pl.p.skill || PLAYER;
    if (!bank.has(skill)) bank.set(skill, Array.from({ length: 1500 }, () => arenaSim(pl)));
    const g = bank.get(skill)[Math.floor(Math.random() * 1500)];
    return { gain: (g.won ? ARENA_GEMS[0] : ARENA_GEMS[1]) + lootBonus(g.a), xp: g.won ? 50 : g.lost ? 20 : 30 };
  }
  function arenaSim(pl) {
    const tier = TIERS[5 + Math.floor(Math.random() * 5)], mine = [...pl.atouts].sort(() => Math.random() - 0.5).slice(0, slots(pl.xp));
    const g = BalanceSim.game({ lv: [pl.p.skill || PLAYER, tier], cast: ["mars", "cranes"], atouts: [mine, ATOUT_IDS.slice().sort(() => Math.random() - 0.5).slice(0, mine.length)] });
    const [a, b] = g.loot, won = a > b, lost = a < b;
    return { a, won, lost };
  }
  function buy(pl, what) {
    pl.spent += euros[what];
    if (what === "starter") { pl.gems += MONET.starterGems; pl.free += MONET.starterPacks; }
    else pl.gems += what;
  }
  function spend(pl, day) {
    const missing = () => ALL.length - pl.owned.size;
    while (pl.free > 0) { pl.free -= 1; pack(pl); }
    // Close to the end, the daily showcase is cheaper than hoping for the last items in boosters.
    if (missing() > 0 && missing() <= 12) {
      const pool = ITEMS.filter(it => it.kind !== "atout" && !pl.owned.has(key(it))).sort(() => Math.random() - 0.5).slice(0, 4);
      for (const it of pool.sort((x, y) => PICK_PRICE[itemDef(x).rarity] - PICK_PRICE[itemDef(y).rarity])) {
        const price = PICK_PRICE[itemDef(it).rarity];
        if (pl.gems >= price) { pl.gems -= price; grant(pl, it); }
      }
      if (ITEMS.filter(it => !pl.owned.has(key(it))).every(it => it.kind !== "atout")) return;
    }
    const price = () => (OPT.priceAt ? OPT.priceAt(pl.owned.size / ALL.length) : OPT.price);
    while (pl.gems >= price() && missing() > 0) { pl.gems -= price(); pack(pl); }
  }
  function live(profile, days) {
    const pl = player(profile);
    for (let day = 1; day <= days; day += 1) {
      // Nobody buys crystals once the collection is complete: there is nothing left to spend them on.
      const done = () => pl.owned.size === ALL.length;
      if (!done()) for (const b of profile.buys || []) if (b.day === day || (b.every && day > b.day && (day - b.day) % b.every === 0)) buy(pl, b.what);
      if (profile.rush) while (!done() && pl.gems < 200) { buy(pl, 2000); spend(pl, day); }
      let ads = 0;
      for (let g = 0; g < profile.games; g += 1) {
        const before = levelInfo(pl.xp).lvl;
        const r = pl.cleared < STAGES.length ? campaignGame(pl) : arenaGame(pl);
        pl.xp += r.xp;
        const after = levelInfo(pl.xp).lvl;
        r.gain += 30 * (after - before);
        for (const [at, id] of Object.entries(LEVEL_ATOUTS)) if (after >= Number(at)) pl.atouts.add(id);
        pl.gems += r.gain;
        pl.fromGames += r.gain;
        // Videos are offered at the end of a game from the second one on, up to the ladder's end.
        if (ads < Math.min(profile.ads || 0, MONET.ladder.length) && (day > 1 || g >= MONET.adFrom - 1)) { const v = MONET.ladder[ads]; pl.gems += v; pl.fromAds += v; ads += 1; }
        if (pl.cleared === STAGES.length && pl.campaignDay === null) pl.campaignDay = day;
        spend(pl, day);
      }
      for (const d of [7, 30, 60, 90, 180]) if (day === d) pl.at[d] = Math.round((pl.owned.size / ALL.length) * 100);
      if (pl.full === null && pl.owned.size === ALL.length) { pl.full = day; pl.snap = { games: pl.fromGames, ads: pl.fromAds, spent: pl.spent }; }
    }
    return pl;
  }
  function run(profile, n = 30, days = 180) {
    const out = Array.from({ length: n }, () => live(profile, days));
    const m = f => median(out.map(f));
    const full = out.filter(pl => pl.full !== null).map(pl => pl.full);
    return {
      profil: profile.name, "parties/jour": profile.games, "vidéos/jour": profile.ads || 0,
      "€ dépensés": Math.round(m(pl => pl.spent) * 100) / 100,
      "campagne finie (jour)": m(pl => pl.campaignDay ?? 999), "défaites en campagne": m(pl => pl.losses),
      "collection J7 %": m(pl => pl.at[7]), "J30 %": m(pl => pl.at[30]), "J90 %": m(pl => pl.at[90]), "J180 %": m(pl => pl.at[180]),
      "collection complète (jour)": full.length * 2 > n ? median(full) : `> ${days}`,
      "◆ des parties (jusqu'à complète)": m(pl => (pl.snap || { games: pl.fromGames }).games), "◆ des vidéos (jusqu'à complète)": m(pl => (pl.snap || { ads: pl.fromAds }).ads), "◆ des doublons": m(pl => pl.fromDups),
      boosters: m(pl => pl.packs), "nouveaux/booster": Math.round((m(pl => pl.newItems) / Math.max(1, m(pl => pl.packs))) * 100) / 100,
      "boosters sans nouveauté": m(pl => pl.emptyPacks)
    };
  }
  const PROFILES = {
    gratuit: { name: "Sans vidéo, sans achat", games: 4, ads: 0 },
    casual: { name: "Petit joueur, sans vidéo", games: 2, ads: 0 },
    videos: { name: "Vidéos tous les jours", games: 4, ads: 4 },
    casualVideos: { name: "Petit joueur + 2 vidéos", games: 2, ads: 2 },
    starter: { name: "Pack de départ (J1)", games: 4, ads: 0, buys: [{ day: 1, what: "starter" }] },
    starterVideos: { name: "Pack de départ + vidéos", games: 4, ads: 4, buys: [{ day: 1, what: "starter" }] },
    once: { name: "Pack de départ + 800 ◆ (J10)", games: 4, ads: 2, buys: [{ day: 1, what: "starter" }, { day: 10, what: 800 }] },
    whale: { name: "2 000 ◆ chaque mois", games: 4, ads: 4, buys: [{ day: 1, what: "starter" }, { day: 1, what: 2000, every: 30 }] },
    rush: { name: "Achète tout de suite (2 000 ◆ à la fois)", games: 1, ads: 0, rush: true },
    debutant: { name: "Joueur moins fort", games: 4, ads: 0, skill: TIERS[6] }
  };
  function report(n = 30, days = 180) { return Object.values(PROFILES).map(p => run(p, n, days)); }
  return { run, report, live, PROFILES, OPT };
})();
