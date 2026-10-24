/* Partitions de la musique (voir music.js). Notes en MIDI : 60 = do central.
   step(p, s, t, spb) est appelé à chaque double croche : s = 0..15 dans la mesure, p.bar = numéro de mesure.
   « uses » liste les instruments enregistrés à charger avant de jouer. */
(function () {
  const M = window.BDAMusic, I = M.I;
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const at = (list, pos) => list.filter(([, a]) => a === pos);
  const prevNote = (list, pos) => { let n = null; for (const [m, a] of list) if (a < pos) n = m; return n; };
  // Un musicien n'est jamais pile sur la grille : quelques millisecondes d'écart et des nuances
  const X = (p, inst, t, n, dur, vel, o) => I.sample(p.T, inst, t + R(-0.006, 0.006), n, dur, vel * R(0.9, 1.05), o);
  const chord = (p, inst, t, notes, dur, vel, o = {}) => notes.forEach((n, i) => X(p, inst, t + i * (o.strum || 0), n, dur, vel, o));
  const hits = pat => pat.split("").map(c => (c === "X" ? 1 : c === "x" ? 0.55 : 0));

  /* ═════ MENU A · Robot Disco ═════
     Disco-house en la dorien, 118 BPM : guitare funk étouffée, basse aux doigts, piano Rhodes, cordes disco
     et cuivres « pa-pa », voix robot au refrain ; filtre qui s'ouvre au début et pause filtrée. */
  const RD = [[33, [55, 59, 60, 64]], [38, [54, 57, 60, 64]]];
  const RD_GTR = hits("X.xXx.Xx.xX.x.Xx");
  const RD_BASS = { 0: [0, 3], 3: [12, 1], 6: [0, 1], 7: [3, 1], 8: [7, 2], 10: [12, 1], 12: [10, 1], 14: [7, 2] };
  const RD_MEL = [[76, 0, 3], [79, 4, 2], [81, 6, 4], [79, 10, 2], [76, 12, 4], [74, 16, 3], [76, 19, 3], [78, 22, 4], [76, 26, 6],
    [81, 32, 3], [84, 36, 2], [83, 38, 4], [81, 42, 2], [79, 44, 4], [76, 48, 4], [74, 52, 2], [76, 54, 10]];
  M.tracks.disco = {
    title: "Robot Disco", bpm: 118, bars: 32, loopFrom: 8, swing: 0.07,
    uses: ["electric_guitar_muted", "electric_bass_finger", "electric_piano_1", "string_ensemble_1", "brass_section"],
    step(p, s, t, spb) {
      const bar = p.bar, [root, ch] = RD[bar % 2], sec = Math.floor(bar / 8), bl = spb * 16, brk = sec === 3;
      if (s === 0 && bar === 0) M.sweep(p, t, 420, 12000, bl * 8, 3);
      if (s === 0 && bar === 8) M.sweep(p, t, 12000, 20000, bl, 0.7);
      if (s === 0 && bar === 24) M.sweep(p, t, 20000, 900, bl * 2, 5);
      if (s === 0 && bar === 30) M.sweep(p, t, 900, 20000, bl * 2, 1);
      if (s === 0 && bar === 31) I.riser(p.T, t, bl, 0.7);
      // Batterie
      if (!brk || bar >= 30) { if (s % 4 === 0) I.kick(p.T, t, 1, { pump: 0.45 }); }
      if (sec >= 1 && !brk && (s === 4 || s === 12)) I.clap(p.T, t, 0.75);
      if (s % 4 === 2) I.hat(p.T, t, sec ? 0.8 : 0.55, true);
      if (sec >= 1 && s % 2 === 1) I.hat(p.T, t, 0.28);
      // Guitare funk étouffée (à droite)
      if (!brk && RD_GTR[s]) chord(p, "electric_guitar_muted", t, ch.slice(1).map(n => n + 12), spb * 0.9, RD_GTR[s], { vol: 0.42, strum: 0.007, pan: 0.45, rev: 0.12, rel: 0.05 });
      // Basse aux doigts
      if (!brk && RD_BASS[s]) { const [iv, len] = RD_BASS[s]; X(p, "electric_bass_finger", t, root + iv + 12, spb * len * 0.9, iv === 12 ? 0.75 : 1, { vol: 0.9, rel: 0.06, rev: 0.03 }); }
      if (brk && s === 0) X(p, "electric_bass_finger", t, root + 12, bl * 0.9, 0.6, { vol: 0.7, hold: true });
      // Piano Rhodes (à gauche)
      if (sec === 0 && s === 0) chord(p, "electric_piano_1", t, ch, bl * 0.95, 0.7, { vol: 0.5, strum: 0.02, pan: -0.35, rev: 0.3 });
      if (sec >= 1 && !brk && [2, 7, 10].includes(s)) chord(p, "electric_piano_1", t, ch, spb * (s === 10 ? 3 : 1.6), s === 7 ? 0.5 : 0.8, { vol: 0.45, pan: -0.35, rev: 0.25 });
      if (brk && s === 0) chord(p, "electric_piano_1", t, ch, bl, 0.7, { vol: 0.5, strum: 0.04, rev: 0.45, dly: 0.2 });
      // Cordes disco : montée en doubles croches avant chaque section, puis tenue
      if ((bar === 15 || bar === 23) && s >= 12) X(p, "string_ensemble_1", t, ch[s - 12] + 12, spb, 0.6 + (s - 12) * 0.1, { vol: 0.5, rev: 0.4 });
      if ((sec >= 2) && s === 0) chord(p, "string_ensemble_1", t, ch.slice(1).map(n => n + 12), bl, brk ? 0.5 : 0.65, { vol: 0.32, att: brk ? 0.6 : 0.15, rel: 0.6, hold: true, rev: 0.45 });
      // Cuivres « pa-pa »
      if (sec === 2 && bar % 4 === 3 && (s === 12 || s === 14)) chord(p, "brass_section", t, [ch[1] + 12, ch[2] + 12, ch[3] + 12], spb * 1.2, 0.9, { vol: 0.5, rev: 0.3 });
      // Voix robot
      if (sec === 2 || (brk && bar >= 26)) {
        const pos = (bar % 4) * 16 + s;
        for (const [n, , len] of at(RD_MEL, pos)) I.talk(p.T, t, n - 12, len * spb * 0.92, 1, { from: prevNote(RD_MEL, pos) && prevNote(RD_MEL, pos) - 12, vol: 0.85 });
      }
      if (sec >= 1 && s === 15 && bar % 8 === 7) I.blip(p.T, t, 84, 0.7, true);
    }
  };

  /* ═════ MENU B · Hyperdrive ═════
     Électro-orchestre en ré mineur, 124 BPM : basse synthé qui roule, grandes cordes, hymne aux cuivres,
     timbales et coups d'orchestre aux reprises, chœur et voix robot dans la pause. */
  const HY = [[38, [62, 65, 69, 72]], [34, [62, 65, 70, 74]], [41, [60, 65, 69, 72]], [36, [60, 64, 67, 72]]];
  const HY_MEL = [[69, 0, 4], [72, 4, 4], [74, 8, 6], [72, 14, 2], [70, 16, 4], [69, 20, 4], [65, 24, 8], [69, 32, 4], [72, 36, 4],
    [77, 40, 6], [76, 46, 2], [74, 48, 8], [72, 56, 8]];
  M.tracks.hyper = {
    title: "Hyperdrive", bpm: 124, bars: 32, loopFrom: 8,
    uses: ["string_ensemble_1", "brass_section", "choir_aahs", "timpani", "orchestra_hit", "french_horn"],
    step(p, s, t, spb) {
      const bar = p.bar, [root, ch] = HY[bar % 4], sec = Math.floor(bar / 8), bl = spb * 16, brk = sec === 3;
      if (s === 0 && bar === 0) M.sweep(p, t, 600, 20000, bl * 8, 2);
      if (s === 0 && (bar === 8 || bar === 16)) { X(p, "orchestra_hit", t, 62, spb * 6, 1, { vol: 0.55, rev: 0.4 }); I.crash(p.T, t, 0.7); }
      if ((bar === 7 || bar === 15 || bar === 31) && s >= 8) X(p, "timpani", t, 38, spb, 0.45 + (s - 8) * 0.07, { vol: 0.8, rev: 0.3 });
      if (sec >= 1 && !brk && s === 0 && bar % 2 === 0) X(p, "timpani", t, root < 38 ? root + 12 : root, spb * 4, 0.9, { vol: 0.8, rev: 0.3 });
      if (!brk && s % 4 === 0) I.kick(p.T, t, 1, { pump: 0.5 });
      if (brk && bar >= 28 && s % (bar >= 30 ? 2 : 4) === 0) I.snare(p.T, t, 0.3 + (bar - 28) * 0.12, { len: 0.04, rev: 0.3 });
      if (sec >= 1 && !brk && (s === 4 || s === 12)) I.clap(p.T, t, 0.8);
      if (!brk && s % 4 === 2) I.hat(p.T, t, 0.75, true);
      if (!brk) {
        const iv = [0, 12, 0, 0, 12, 0, 0, 12, 0, 0, 12, 0, 7, 0, 12, 0][s];
        I.bass(p.T, t, root + iv, spb * 0.85, s % 4 === 0 ? 1 : 0.7, { bright: 1.1 + 0.5 * Math.sin((bar * 16 + s) / 20), sus: 0.25, vol: 0.8 });
      }
      if (s === 0 && sec >= 1) {
        chord(p, "string_ensemble_1", t, [ch[0] - 12, ...ch], bl, brk ? 0.55 : 0.7, { vol: 0.3, att: brk ? 0.5 : 0.12, rel: 0.5, hold: true, rev: 0.4 });
        if (!brk) X(p, "french_horn", t, ch[1] - 12, bl, 0.6, { vol: 0.4, att: 0.2, hold: true, rev: 0.4 });
      }
      if (sec === 1 && s % 2 === 0) { const arp = [...ch, ...ch.map(n => n + 12)]; I.pluck(p.T, t, arp[[0, 2, 1, 3, 2, 4, 3, 5][(s / 2) % 8]] + 12, 0.5, { dly: 0.4, pan: s % 4 ? 0.4 : -0.4, len: 0.18 }); }
      const pos = (bar % 4) * 16 + s;
      if (sec === 2) for (const [n, , len] of at(HY_MEL, pos)) { X(p, "brass_section", t, n, len * spb * 0.95, 0.95, { vol: 0.55, att: 0.02, hold: true, rev: 0.35 }); X(p, "brass_section", t, n - 12, len * spb * 0.95, 0.7, { vol: 0.4, hold: true, rev: 0.35 }); }
      if (brk) {
        if (s === 0) chord(p, "choir_aahs", t, [ch[1] + 12, ch[2] + 12], bl, 0.7, { vol: 0.4, att: 0.4, hold: true, rev: 0.6 });
        for (const [n, , len] of at(HY_MEL, pos)) I.talk(p.T, t, n - 12, len * spb * 0.92, 1, { from: prevNote(HY_MEL, pos) && prevNote(HY_MEL, pos) - 12, vol: 0.8 });
      }
    }
  };

  /* ═════ EN PARTIE A · Apesanteur ═════
     Zen, 60 BPM : cordes très douces, chœur « ouh » lointain, Rhodes égrené, harpe, célesta,
     vent cosmique ; un robot fredonne au loin de temps en temps. */
  const AP = [[41, [57, 60, 64, 67]], [40, [55, 59, 62, 66]], [38, [57, 60, 64, 65]], [36, [55, 59, 62, 64]]];
  const AP_HUM = [[64, 0, 8], [67, 8, 8], [69, 16, 12], [67, 28, 4], [64, 32, 16]];
  M.tracks.apesanteur = {
    title: "Apesanteur", bpm: 60, bars: 16, gain: 2.2,
    uses: ["string_ensemble_1", "voice_oohs", "electric_piano_1", "orchestral_harp", "celesta"],
    step(p, s, t, spb) {
      const bar = p.bar, [root, ch] = AP[Math.floor(bar / 2) % 4], bl = spb * 16;
      if (s === 0 && bar % 2 === 0) {
        chord(p, "string_ensemble_1", t, ch, bl * 2, 0.5, { vol: 0.26, att: 2.4, rel: 3, hold: true, cut: 2600, rev: 0.6 });
        I.bass(p.T, t, root - 12, bl * 1.95, 0.3, { bright: 0.15, sus: 1, vol: 0.5 });
        chord(p, "electric_piano_1", t, ch, bl * 1.5, 0.55, { vol: 0.42, strum: 0.09, rev: 0.5, dly: 0.25 });
      }
      if (s === 0 && bar % 2 === 0 && bar >= 4) chord(p, "voice_oohs", t, [ch[2] + 12, ch[3] + 12], bl * 2, 0.45, { vol: 0.28, att: 2, rel: 2.5, hold: true, rev: 0.75 });
      if (bar % 4 === 1 && s % 2 === 0) { const up = [ch[0], ch[1], ch[2], ch[3], ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12]; X(p, "orchestral_harp", t, up[s / 2] + 12, spb * 6, 0.45 + s * 0.015, { vol: 0.45, rev: 0.55 }); }
      if (s === 0 && bar % 4 === 2) I.wind(p.T, t, bl * 3, 0.7);
      if (s % 2 === 0 && Math.random() < 0.08) X(p, "celesta", t, pick([76, 79, 81, 84, 86, 88]), spb * 8, R(0.3, 0.5), { vol: 0.35, rev: 0.6, dly: 0.45, pan: R(-0.6, 0.6) });
      if (bar >= 8 && bar < 12) {
        const pos = (bar - 8) * 16 + s;
        for (const [n, , len] of at(AP_HUM, pos)) I.talk(p.T, t, n - 12, len * spb * 0.95, 0.4, { from: prevNote(AP_HUM, pos) && prevNote(AP_HUM, pos) - 12, vol: 0.45, rev: 0.8, dly: 0.4 });
      }
    }
  };

  /* ═════ EN PARTIE B · Dérive ═════
     Downtempo spatial, 76 BPM : Rhodes syncopé, vibraphone en arpège dans l'écho, basse aux doigts
     ronde, petite batterie feutrée, nappe de cordes. */
  const DE = [[45, [60, 64, 67, 71]], [41, [60, 64, 65, 69]], [36, [59, 62, 64, 67]], [43, [59, 62, 67, 69]]];
  M.tracks.derive = {
    title: "Dérive", bpm: 76, bars: 8, swing: 0.1, gain: 1.9,
    uses: ["electric_piano_1", "vibraphone", "electric_bass_finger", "string_ensemble_1"],
    step(p, s, t, spb) {
      const bar = p.bar, [root, ch] = DE[bar % 4], bl = spb * 16;
      if (s === 0 || s === 10) I.kick(p.T, t, s ? 0.35 : 0.5, { pump: 0.2 });
      if (s === 8) I.snare(p.T, t, 0.22, { len: 0.03, rev: 0.4 });
      if (s % 4 === 2) I.hat(p.T, t, 0.25);
      if (s === 0) chord(p, "electric_piano_1", t, ch, spb * 6, 0.75, { vol: 0.45, strum: 0.015, rev: 0.35 });
      if (s === 10) chord(p, "electric_piano_1", t, ch.slice(1), spb * 4, 0.5, { vol: 0.4, rev: 0.35 });
      if (s === 0) chord(p, "string_ensemble_1", t, ch.slice(2).map(n => n + 12), bl, 0.4, { vol: 0.2, att: 0.8, rel: 1.2, hold: true, rev: 0.6 });
      if (s === 0) X(p, "electric_bass_finger", t, root - 12 + 12, spb * 7, 0.8, { vol: 0.8, rel: 0.1 });
      if (s === 8) X(p, "electric_bass_finger", t, root + 7, spb * 5, 0.6, { vol: 0.75, rel: 0.1 });
      if (s % 2 === 0) { const arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 12, ch[3] + 12, ch[2] + 12]; X(p, "vibraphone", t, arp[(s / 2) % 8], spb * 4, 0.45, { vol: 0.35, dly: 0.35, rev: 0.4, pan: s % 4 ? 0.4 : -0.4 }); }
    }
  };

  /* ═════ BATAILLE A · Grille ═════
     Électro-orchestre façon bande originale, 128 BPM, ré mineur.
     1 basse synthé en doubles croches, cordes en trémolo, taikos ;
     2 grosse caisse et claps, pizzicati, timbales, accents de cuivres ;
     3 thème aux cordes, contrechant au cor, chœur, coups d'orchestre, un ton plus haut. */
  const GR = [[38, [62, 65, 69]], [38, [62, 65, 69]], [34, [62, 65, 70]], [36, [60, 64, 67]], [38, [62, 65, 69]], [38, [62, 65, 69]], [43, [62, 67, 70]], [33, [61, 64, 69]]];
  const GR_MEL = [[74, 0, 12], [72, 12, 4], [74, 16, 8], [77, 24, 8], [76, 32, 12], [74, 44, 4], [72, 48, 16],
    [74, 64, 12], [77, 76, 4], [81, 80, 12], [79, 92, 4], [77, 96, 8], [74, 104, 8], [73, 112, 16]];
  M.tracks.grille = {
    title: "Grille", bpm: 128, bars: 8, battle: true,
    uses: ["tremolo_strings", "pizzicato_strings", "string_ensemble_1", "brass_section", "french_horn", "choir_aahs", "timpani", "taiko_drum", "orchestra_hit"],
    onLevel(p, up, t) { if (up) { I.boom(p.T, t, 0.8); X(p, "orchestra_hit", t, 62 + (p.level === 3 ? 2 : 0), 1, 1, { vol: 0.6, rev: 0.4 }); } p.tr = p.level === 3 ? 2 : 0; },
    step(p, s, t, spb) {
      const L = p.level, bar = p.bar, [r0, c0] = GR[bar % 8], root = r0 + p.tr, ch = c0.map(n => n + p.tr), bl = spb * 16;
      I.bass(p.T, t, root + (s % 4 === 3 ? 12 : 0), spb * 0.8, s % 4 === 0 ? 1 : 0.65, { bright: 0.9 + 0.5 * ((bar * 16 + s) % 32) / 32, sus: 0.2, vol: 0.85 });
      if (s === 0) chord(p, "tremolo_strings", t, ch.map(n => n - 12), bl, L >= 2 ? 0.75 : 0.6, { vol: 0.3, att: 0.15, rel: 0.4, hold: true, rev: 0.35 });
      if (s === 0 || s === 14 || (s === 8 && L === 1)) X(p, "taiko_drum", t, 36, 1, s ? 0.6 : 0.95, { vol: 0.8, rev: 0.35 });
      I.hat(p.T, t, s % 2 ? 0.3 : 0.5);
      if (L >= 2) {
        if (s % 4 === 0) I.kick(p.T, t, 1, { pump: 0.5 });
        if (s === 4 || s === 12) I.clap(p.T, t, 0.8);
        if (s % 2 === 0) { const ost = [root + 24, ch[2], ch[0] + 12, ch[2], ch[1] + 12, ch[2], ch[0] + 12, ch[1]]; X(p, "pizzicato_strings", t, ost[(s / 2) % 8], spb, s % 4 === 0 ? 0.85 : 0.6, { vol: 0.5, rev: 0.25, pan: 0.3 }); }
        if (s === 0) X(p, "timpani", t, root < 38 ? root + 12 : root, bl * 0.5, 0.8, { vol: 0.75, rev: 0.3 });
        if (s === 0 && bar % 2 === 0) chord(p, "brass_section", t, [ch[0], ch[2], ch[0] + 12], spb * 3, 0.95, { vol: 0.45, rev: 0.35 });
        if (s === 0 && bar % 4 === 0) I.crash(p.T, t, 0.6);
      }
      if (L === 3) {
        if (s === 0) chord(p, "choir_aahs", t, [ch[0] + 12, ch[2] + 12], bl, 0.75, { vol: 0.3, att: 0.2, hold: true, rev: 0.55 });
        if (s === 0) X(p, "french_horn", t, ch[1], bl, 0.75, { vol: 0.4, att: 0.08, hold: true, rev: 0.4 });
        const pos = (bar % 8) * 16 + s;
        for (const [n, , len] of at(GR_MEL, pos)) { X(p, "string_ensemble_1", t, n + p.tr, len * spb * 0.97, 1, { vol: 0.45, att: 0.03, hold: true, rev: 0.4 }); X(p, "string_ensemble_1", t, n + p.tr - 12, len * spb * 0.97, 0.8, { vol: 0.38, att: 0.03, hold: true, rev: 0.4 }); }
        if (s === 0 && bar % 4 === 0) X(p, "orchestra_hit", t, ch[0], 1, 0.9, { vol: 0.45, rev: 0.4 });
        if (bar % 8 === 7 && s >= 8) X(p, "timpani", t, root < 38 ? root + 12 : root, spb, 0.5 + (s - 8) * 0.06, { vol: 0.7, rev: 0.3 });
      }
    }
  };

  /* ═════ BATAILLE B · Surcharge ═════
     Plus brutal, 132 BPM, mi mineur. 1 demi-tempo lourd : taikos, timbales, cuivres graves, cordes en trémolo ;
     2 tout s'accélère : grosse caisse, basse synthé, pizzicati, accents de cuivres ;
     3 chœur, thème aux cordes, cor, coups d'orchestre, un ton plus haut. */
  const SU = [[40, [64, 67, 71]], [36, [64, 67, 72]], [43, [62, 67, 71]], [38, [62, 66, 69]]];
  const SU_MEL = [[71, 0, 8], [74, 8, 4], [76, 12, 4], [79, 16, 12], [78, 28, 4], [76, 32, 8], [74, 40, 8], [71, 48, 8], [74, 56, 8]];
  M.tracks.surcharge = {
    title: "Surcharge", bpm: 132, bars: 8, battle: true,
    uses: ["tremolo_strings", "pizzicato_strings", "string_ensemble_1", "brass_section", "french_horn", "choir_aahs", "timpani", "taiko_drum", "orchestra_hit"],
    onLevel(p, up, t) { if (up) { I.boom(p.T, t, 0.9); X(p, "orchestra_hit", t, 64 + (p.level === 3 ? 2 : 0), 1, 1, { vol: 0.6, rev: 0.4 }); } p.tr = p.level === 3 ? 2 : 0; },
    step(p, s, t, spb) {
      const L = p.level, bar = p.bar, [r0, c0] = SU[bar % 4], root = r0 + p.tr, ch = c0.map(n => n + p.tr), bl = spb * 16;
      if (s === 0) chord(p, "tremolo_strings", t, ch.map(n => n - 12), bl, 0.65, { vol: 0.28, att: 0.2, hold: true, rev: 0.35 });
      if (L === 1) {
        if (s === 0 || s === 6) X(p, "taiko_drum", t, 36, 1, s ? 0.65 : 1, { vol: 0.85, rev: 0.4 });
        if (s === 8) X(p, "timpani", t, root < 38 ? root + 12 : root, bl * 0.5, 0.85, { vol: 0.8, rev: 0.35 });
        if (s === 0) { chord(p, "brass_section", t, [ch[0] - 12, ch[2] - 12], spb * 7, 0.8, { vol: 0.45, att: 0.25, hold: true, rev: 0.4 }); I.bass(p.T, t, root, bl * 0.9, 0.55, { bright: 0.7, sus: 0.7, vol: 0.75 }); }
        if (s % 4 === 2) I.hat(p.T, t, 0.35);
      } else {
        if (s % 4 === 0) I.kick(p.T, t, 1, { pump: 0.5 });
        if (s === 4 || s === 12) I.clap(p.T, t, 0.85);
        if (s % 2 === 0) I.bass(p.T, t, root + (s % 8 === 6 ? 12 : 0), spb * 1.6, s % 4 === 0 ? 1 : 0.75, { bright: 1.3, sus: 0.3 });
        I.hat(p.T, t, s % 2 ? 0.35 : 0.6, s % 4 === 2);
        if (s % 2 === 0) { const ost = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12]; X(p, "pizzicato_strings", t, ost[(s / 2) % 4], spb, s % 4 === 0 ? 0.85 : 0.6, { vol: 0.5, rev: 0.25, pan: -0.3 }); }
        if (s === 0) X(p, "taiko_drum", t, 36, 1, 0.85, { vol: 0.8, rev: 0.35 });
        if ([3, 6, 11].includes(s)) chord(p, "brass_section", t, [ch[0], ch[2]], spb * 1.2, 0.85, { vol: 0.4, rev: 0.3 });
        if (s === 0 && bar % 4 === 0) I.crash(p.T, t, 0.65);
      }
      if (L === 3) {
        if (s === 0) chord(p, "choir_aahs", t, [ch[0] + 12, ch[1] + 12, ch[2] + 12], bl, 0.75, { vol: 0.28, att: 0.15, hold: true, rev: 0.55 });
        if (s === 0) X(p, "french_horn", t, ch[1], bl, 0.75, { vol: 0.4, att: 0.08, hold: true, rev: 0.4 });
        const pos = (bar % 4) * 16 + s;
        for (const [n, , len] of at(SU_MEL, pos)) { X(p, "string_ensemble_1", t, n + p.tr, len * spb * 0.95, 1, { vol: 0.45, att: 0.03, hold: true, rev: 0.4 }); X(p, "string_ensemble_1", t, n + p.tr + 12, len * spb * 0.95, 0.7, { vol: 0.3, att: 0.03, hold: true, rev: 0.4 }); }
        if (s === 0 && bar % 2 === 0) X(p, "orchestra_hit", t, ch[0], 1, 0.85, { vol: 0.42, rev: 0.4 });
        if (bar % 4 === 3 && s >= 12) X(p, "timpani", t, root < 38 ? root + 12 : root, spb, 0.6 + (s - 12) * 0.1, { vol: 0.75, rev: 0.3 });
      }
    }
  };

  /* ═════ JINGLES ═════ */
  // Victoire : fanfare de cuivres, roulement de timbales, cordes, étincelles de célesta et un « yeah » robot
  M.tracks.victoire = {
    title: "Victoire", bpm: 120, bars: 2, once: true, tail: 4, gain: 1.4,
    uses: ["brass_section", "string_ensemble_1", "timpani", "celesta", "orchestra_hit"],
    step(p, s, t, spb) {
      const bar = p.bar, k = bar * 16 + s;
      if (k === 0) X(p, "orchestra_hit", t, 60, 1, 1, { vol: 0.55, rev: 0.4 });
      if (k < 6) X(p, "timpani", t, 43, spb, 0.5 + k * 0.08, { vol: 0.8, rev: 0.3 });
      if (k === 6) X(p, "timpani", t, 36, spb * 6, 1, { vol: 0.9, rev: 0.3 });
      const fan = { 0: [67, 2], 2: [72, 2], 4: [76, 2] };
      if (fan[k]) X(p, "brass_section", t, fan[k][0], spb * fan[k][1] * 0.9, 0.95, { vol: 0.55, rev: 0.35 });
      if (k === 6) { chord(p, "brass_section", t, [67, 72, 76, 79], spb * 12, 1, { vol: 0.45, hold: true, rel: 0.8, rev: 0.45 }); I.crash(p.T, t, 0.8); }
      if (k === 6) chord(p, "string_ensemble_1", t, [48, 60, 64, 67, 72], spb * 14, 0.9, { vol: 0.32, att: 0.1, hold: true, rel: 1, rev: 0.5 });
      if (k >= 8 && k <= 15) X(p, "celesta", t, [84, 88, 91, 96, 91, 96, 100, 103][k - 8], spb * 4, 0.6, { vol: 0.4, rev: 0.5, dly: 0.3 });
      if (k === 18) I.talk(p.T, t, 67, spb * 3, 1, { vol: 0.8 });
      if (k === 21) I.talk(p.T, t, 72, spb * 6, 1, { from: 67, vol: 0.85 });
    }
  };
  // Défaite : petite descente cartoon aux pizzicati, Rhodes doux, cor en sourdine et un « ouin-ouin » robot
  M.tracks.defaite = {
    title: "Défaite", bpm: 96, bars: 2, once: true, tail: 4, gain: 1.6,
    uses: ["pizzicato_strings", "electric_piano_1", "french_horn"],
    step(p, s, t, spb) {
      const k = p.bar * 16 + s;
      const down = { 0: 67, 3: 66, 6: 65 };
      if (down[k]) X(p, "pizzicato_strings", t, down[k], spb * 2, 0.8, { vol: 0.55, rev: 0.3 });
      if (k === 9) { X(p, "pizzicato_strings", t, 64, spb * 4, 0.9, { vol: 0.55, rev: 0.35 }); chord(p, "electric_piano_1", t, [53, 56, 60, 62], spb * 12, 0.6, { vol: 0.45, strum: 0.05, rev: 0.45 }); X(p, "french_horn", t, 48, spb * 12, 0.5, { vol: 0.35, att: 0.3, hold: true, rev: 0.45 }); }
      if (k === 12) I.talk(p.T, t, 60, spb * 3, 0.6, { vol: 0.5 });
      if (k === 15) I.talk(p.T, t, 55, spb * 7, 0.6, { from: 60, vol: 0.5 });
    }
  };
})();
