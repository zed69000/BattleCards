/* Musique de La Bataille Galactique, jouée en direct avec Web Audio : de vrais instruments enregistrés
   (banque FluidR3_GM de Frank Wen, licence CC BY 3.0, notes extraites dans sounds/) et des synthés.
   Chaque morceau est une partition écrite en code et jouée par un petit séquenceur (doubles croches,
   programmation un peu en avance sur l'horloge audio). Les morceaux de bataille ont trois niveaux
   d'intensité qui s'ajoutent au début de la mesure suivante. */
(function () {
  const BDAMusic = {};
  let ctx = null, master, comp, revIn, dlyIn, dL, dR, noise;
  const players = [];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);

  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c += 1) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i += 1) {
        const k = i / len, x = (Math.random() * 2 - 1) * Math.pow(1 - k, decay);
        lp += (x - lp) * (0.9 - k * 0.75);   // la queue s'assombrit en s'éteignant
        d[i] = lp;
      }
    }
    return buf;
  }
  function noiseBuf() {
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function setup() {
    if (ctx) return ctx;
    // iPhone : sans cela, l'interrupteur silencieux coupe le son des pages web
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* ancien iOS */ }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Safari ne laisse démarrer le son qu'après un geste : on relance au premier toucher
    const wake = () => { if (ctx.state !== "running") ctx.resume(); };
    for (const ev of ["touchend", "pointerup", "keydown"]) window.addEventListener(ev, wake, { passive: true });
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = 0.012; comp.release.value = 0.3;
    master = ctx.createGain();
    master.gain.value = 0.75;
    // Limiteur final : aucune crête ne dépasse -1 dB, même quand tout s'empile en bataille
    const lim = ctx.createDynamicsCompressor(), trim = ctx.createGain();
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
    trim.gain.value = 0.9;
    const warm = ctx.createWaveShaper(), curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i += 1) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); }
    warm.curve = curve; warm.oversample = "2x";
    master.connect(warm); warm.connect(comp);
    comp.connect(lim); lim.connect(trim); trim.connect(ctx.destination);
    // Réverbération : un grand espace sombre, sans les graves
    revIn = ctx.createGain();
    const hp = ctx.createBiquadFilter(), conv = ctx.createConvolver(), revOut = ctx.createGain();
    hp.type = "highpass"; hp.frequency.value = 200;
    conv.buffer = impulse(4.2, 2.4);
    revOut.gain.value = 0.6;
    revIn.connect(hp); hp.connect(conv); conv.connect(revOut); revOut.connect(master);
    // Écho ping-pong, adouci à chaque passage
    dlyIn = ctx.createGain();
    dL = ctx.createDelay(2); dR = ctx.createDelay(2);
    const fb = ctx.createGain(), lp = ctx.createBiquadFilter(), merge = ctx.createChannelMerger(2), dOut = ctx.createGain(), dRev = ctx.createGain();
    lp.type = "lowpass"; lp.frequency.value = 3000;
    fb.gain.value = 0.36; dOut.gain.value = 0.42; dRev.gain.value = 0.25;
    dlyIn.connect(dL); dL.connect(lp); lp.connect(dR); dR.connect(fb); fb.connect(dL);
    dL.connect(merge, 0, 0); dR.connect(merge, 0, 1);
    merge.connect(dOut); dOut.connect(master); dOut.connect(dRev); dRev.connect(revIn);
    noise = noiseBuf();
    return ctx;
  }

  /* ─── Branchement d'une voix sur la piste : sec, réverb, écho, panoramique ─── */
  function route(T, node, o = {}) {
    let n = node;
    if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; n.connect(p); n = p; }
    n.connect(o.dry ? T.dry : T.bus);
    if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; n.connect(s); s.connect(T.rev); }
    if (o.dly) { const s = ctx.createGain(); s.gain.value = o.dly; n.connect(s); s.connect(T.dly); }
  }
  function adsr(param, t, a, peak, d, sus, end, r) {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.setTargetAtTime(peak * sus, t + a, d / 3);
    param.setValueAtTime(peak * sus, end);
    param.setTargetAtTime(0.0001, end, r / 4);
  }
  function osc(type, f, t, stop, detune = 0) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    o.start(t); o.stop(stop);
    return o;
  }
  function vibrato(t, stop, rate, cents, delay = 0) {
    const l = osc("sine", rate, t, stop), g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(cents, t + delay + 0.4);
    l.connect(g);
    return g;
  }
  function noiseSrc(t, stop) {
    const s = ctx.createBufferSource();
    s.buffer = noise; s.loop = true;
    s.start(t, Math.random() * 1.5); s.stop(stop);
    return s;
  }

  /* ─── Échantillons : une note enregistrée toutes les 3 ou 4 demi-tons, transposée à la volée ─── */
  const BANK = {}, loading = {};
  let manifest = null;
  const base = () => BDAMusic.base || "sounds/";
  async function loadInst(name) {
    if (BANK[name]) return BANK[name];
    if (loading[name]) return loading[name];
    loading[name] = (async () => {
      if (!manifest) manifest = await (await fetch(`${base()}manifest.json`)).json();
      const notes = manifest[name] || [], bufs = {};
      await Promise.all(notes.map(async m => {
        const data = await (await fetch(`${base()}${name}/${m}.mp3`)).arrayBuffer();
        bufs[m] = await new Promise((ok, ko) => ctx.decodeAudioData(data, ok, ko));
      }));
      BANK[name] = { notes, bufs };
      return BANK[name];
    })();
    return loading[name];
  }
  /* Une note jouée par un instrument enregistré. Les notes longues sont tenues en relançant l'échantillon
     avec un fondu enchaîné (les enregistrements durent quelques secondes). */
  function sample(T, name, t, n, dur, vel = 1, o = {}) {
    const b = BANK[name];
    if (!b || !b.notes.length) return;
    let m = b.notes[0];
    for (const k of b.notes) if (Math.abs(k - n) < Math.abs(m - n)) m = k;
    const buf = b.bufs[m], rate = Math.pow(2, (n - m) / 12), len = buf.duration / rate;
    const att = o.att ?? 0.004, rel = o.rel ?? 0.25, end = t + dur, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime((o.vol ?? 0.5) * vel, t + att);
    g.gain.setValueAtTime((o.vol ?? 0.5) * vel, end);
    g.gain.setTargetAtTime(0.0001, end, rel / 4);
    const stopAt = end + rel * 1.5;
    let out = g;
    if (o.cut) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.cut; f.Q.value = 0.5; g.connect(f); out = f; }
    const play = (at, offset, fadeIn) => {
      const src = ctx.createBufferSource(), sg = ctx.createGain();
      src.buffer = buf; src.playbackRate.value = rate;
      if (o.bend) { src.playbackRate.setValueAtTime(rate * Math.pow(2, o.bend / 12), at); src.playbackRate.exponentialRampToValueAtTime(rate, at + 0.08); }
      sg.gain.setValueAtTime(fadeIn ? 0.0001 : 1, at);
      if (fadeIn) sg.gain.linearRampToValueAtTime(1, at + fadeIn);
      src.connect(sg); sg.connect(g);
      src.start(at, offset); src.stop(Math.min(stopAt, at + len - offset / rate));
      return sg;
    };
    let first = play(t, 0, 0);
    if (o.hold && dur + rel > len * 0.85) {
      // Relance au milieu de l'échantillon, fondu croisé de 0,35 s
      const seg = Math.max(0.6, len * 0.55), off = buf.duration * 0.3;
      for (let at = t + seg; at < stopAt; at += seg - 0.35) {
        first.gain.setValueAtTime(1, at); first.gain.linearRampToValueAtTime(0.0001, at + 0.35);
        first = play(at, off, 0.35);
      }
    }
    route(T, out, { rev: o.rev ?? 0.25, dly: o.dly || 0, pan: o.pan || 0 });
  }

  /* ─── Instruments ─── */
  const I = {
    // Nappe : scies désaccordées, filtre qui respire
    pad(T, t, notes, dur, o = {}) {
      const vol = o.vol || 0.05, att = o.att || 1.2, rel = o.rel || 1.6, cut = o.cut || 900, end = t + dur;
      const f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "lowpass"; f.Q.value = 0.5;
      f.frequency.setValueAtTime(cut * 0.7, t);
      f.frequency.linearRampToValueAtTime(cut * 1.5, t + dur * 0.55);
      f.frequency.linearRampToValueAtTime(cut, end + rel);
      adsr(g.gain, t, att, vol, 1, 0.85, end, rel);
      for (const n of notes) for (const d of [-11, 0, 10]) osc("sawtooth", mtof(n), t, end + rel * 1.5, d + rnd(-2, 2)).connect(f);
      f.connect(g);
      route(T, g, { rev: o.rev ?? 0.45, pan: o.pan || 0 });
    },
    // Cordes : ensemble large, vibrato lent
    strings(T, t, notes, dur, o = {}) {
      const vol = o.vol || 0.035, att = o.att || 0.7, rel = o.rel || 1.1, end = t + dur;
      const hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = "highpass"; hp.frequency.value = 180;
      lp.type = "lowpass"; lp.frequency.value = o.cut || 2600;
      adsr(g.gain, t, att, vol, 1.5, 0.9, end, rel);
      for (const n of notes) {
        const vib = vibrato(t, end + rel * 1.5, 5.1 + rnd(-0.3, 0.3), 7, 0.2);
        for (const d of [-13, -4, 5, 14]) { const s = osc("sawtooth", mtof(n), t, end + rel * 1.5, d); vib.connect(s.detune); s.connect(hp); }
      }
      hp.connect(lp); lp.connect(g);
      route(T, g, { rev: o.rev ?? 0.5 });
    },
    // Chœur « aah » : formants
    choir(T, t, notes, dur, o = {}) {
      const vol = o.vol || 0.09, att = o.att || 0.9, rel = o.rel || 1.4, end = t + dur;
      const g = ctx.createGain(), mix = ctx.createGain();
      adsr(g.gain, t, att, vol, 1.5, 0.9, end, rel);
      for (const [fq, q, a] of [[730, 9, 1], [1150, 11, 0.55], [2650, 13, 0.25]]) {
        const b = ctx.createBiquadFilter(), bg = ctx.createGain();
        b.type = "bandpass"; b.frequency.value = fq; b.Q.value = q; bg.gain.value = a;
        mix.connect(b); b.connect(bg); bg.connect(g);
      }
      for (const n of notes) {
        const vib = vibrato(t, end + rel * 1.5, 5.4, 12, 0.3);
        for (const d of [-8, 7]) { const s = osc("sawtooth", mtof(n), t, end + rel * 1.5, d); vib.connect(s.detune); s.connect(mix); }
      }
      route(T, g, { rev: o.rev ?? 0.7 });
    },
    // Basse : scie filtrée + sous-basse
    bass(T, t, n, dur, vel = 1, o = {}) {
      const end = t + dur, f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "lowpass"; f.Q.value = 3;
      f.frequency.setValueAtTime(220 + 1400 * vel * (o.bright || 1), t);
      f.frequency.setTargetAtTime(200 + 160 * (o.bright || 1), t, 0.07);
      adsr(g.gain, t, 0.006, 0.22 * vel * (o.vol || 1), 0.2, o.sus ?? 0.55, end, 0.08);
      osc("sawtooth", mtof(n), t, end + 0.2).connect(f);
      const sub = osc("sine", mtof(n), t, end + 0.2), sg = ctx.createGain();
      sg.gain.value = 0.85; sub.connect(sg); sg.connect(g);
      f.connect(g);
      route(T, g, { rev: 0.04 });
    },
    // Arpège pincé, dans l'écho
    pluck(T, t, n, vel = 1, o = {}) {
      const f = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + (o.len || 0.35);
      f.type = "lowpass"; f.Q.value = 2;
      f.frequency.setValueAtTime(o.cut || 4200, t);
      f.frequency.setTargetAtTime(600, t, 0.08);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07 * vel * (o.vol || 1), t + 0.004);
      g.gain.setTargetAtTime(0.0001, t + 0.01, (o.len || 0.35) / 4);
      for (const d of [-7, 7]) osc("sawtooth", mtof(n), t, end + 0.3, d).connect(f);
      f.connect(g);
      route(T, g, { rev: o.rev ?? 0.2, dly: o.dly ?? 0.5, pan: o.pan || 0 });
    },
    // Lead héroïque, vibrato tardif
    lead(T, t, n, dur, vel = 1, o = {}) {
      const end = t + dur, f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "lowpass"; f.Q.value = 1; f.frequency.value = o.cut || 2600;
      adsr(g.gain, t, 0.03, 0.06 * vel * (o.vol || 1), 0.4, 0.8, end, 0.3);
      const vib = vibrato(t, end + 0.5, 5.6, 14, Math.min(0.35, dur * 0.4));
      for (const [type, d, a] of [["sawtooth", -6, 1], ["sawtooth", 6, 1], ["square", 1200, 0.25]]) {
        const s = osc(type, mtof(n), t, end + 0.5, d), sg = ctx.createGain();
        if (o.from) { s.frequency.setValueAtTime(mtof(o.from), t); s.frequency.exponentialRampToValueAtTime(mtof(n), t + 0.07); }
        sg.gain.value = a; vib.connect(s.detune); s.connect(sg); sg.connect(f);
      }
      f.connect(g);
      route(T, g, { rev: o.rev ?? 0.4, dly: o.dly ?? 0.22 });
    },
    // Cuivres : attaque qui s'ouvre
    brass(T, t, notes, dur, vel = 1, o = {}) {
      const end = t + dur, f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = "lowpass"; f.Q.value = 1.5;
      f.frequency.setValueAtTime(300, t);
      f.frequency.linearRampToValueAtTime(2600 * vel, t + 0.09);
      f.frequency.setTargetAtTime(1300, t + 0.09, 0.2);
      adsr(g.gain, t, 0.04, 0.045 * vel * (o.vol || 1), 0.3, 0.75, end, 0.18);
      for (const n of notes) for (const d of [-9, 0, 9]) osc("sawtooth", mtof(n), t, end + 0.4, d).connect(f);
      f.connect(g);
      route(T, g, { rev: o.rev ?? 0.35 });
    },
    // Cordes piquées (spiccato)
    spic(T, t, n, vel = 1, o = {}) {
      const f = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + 0.22;
      f.type = "lowpass"; f.frequency.value = o.cut || 2400;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05 * vel * (o.vol || 1), t + 0.008);
      g.gain.setTargetAtTime(0.0001, t + 0.03, 0.05);
      for (const d of [-12, 0, 12]) osc("sawtooth", mtof(n), t, end + 0.2, d).connect(f);
      f.connect(g);
      route(T, g, { rev: o.rev ?? 0.3, pan: o.pan || 0 });
    },
    // Cloche FM, scintillement spatial
    bell(T, t, n, vel = 1, o = {}) {
      const f = mtof(n), car = osc("sine", f, t, t + 4), mod = osc("sine", f * (o.ratio || 3.5), t, t + 4), mg = ctx.createGain(), g = ctx.createGain();
      mg.gain.setValueAtTime(f * 2.2 * vel, t);
      mg.gain.setTargetAtTime(0, t, 0.35);
      mod.connect(mg); mg.connect(car.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06 * vel * (o.vol || 1), t + 0.003);
      g.gain.setTargetAtTime(0.0001, t + 0.01, 0.9);
      car.connect(g);
      route(T, g, { rev: o.rev ?? 0.55, dly: o.dly ?? 0.4, pan: o.pan ?? rnd(-0.6, 0.6) });
    },
    // Piano électrique FM, trémolo doux
    ep(T, t, notes, dur, vel = 1, o = {}) {
      const g = ctx.createGain(), trem = osc("sine", 4.2, t, t + dur + 2), tg = ctx.createGain(), out = ctx.createGain();
      tg.gain.value = 0.18; trem.connect(tg); tg.connect(out.gain); out.gain.value = 0.82;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05 * vel * (o.vol || 1), t + 0.005);
      g.gain.setTargetAtTime(0.0001, t + 0.02, 0.7);
      g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
      for (const n of notes) {
        const f = mtof(n), car = osc("sine", f, t, t + dur + 2), mod = osc("sine", f, t, t + dur + 2), mg = ctx.createGain();
        mg.gain.setValueAtTime(f * 1.3, t); mg.gain.setTargetAtTime(f * 0.15, t, 0.25);
        mod.connect(mg); mg.connect(car.frequency); car.connect(g);
      }
      g.connect(out);
      route(T, out, { rev: o.rev ?? 0.3, dly: o.dly ?? 0.08 });
    },
    kick(T, t, vel = 1, o2 = {}) {
      const depth = o2.pump ?? 0.6;
      if (depth) { T.pump.gain.cancelScheduledValues(t); T.pump.gain.setValueAtTime(1 - depth, t + 0.005); T.pump.gain.setTargetAtTime(1, t + 0.03, 0.07); }
      const o = osc("sine", 150, t, t + 0.6), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55 * vel, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.1);
      o.connect(g);
      const cl = noiseSrc(t, t + 0.02), hp = ctx.createBiquadFilter(), cg = ctx.createGain();
      hp.type = "highpass"; hp.frequency.value = 2500; cg.gain.setValueAtTime(0.12 * vel, t); cg.gain.setTargetAtTime(0.0001, t, 0.004);
      cl.connect(hp); hp.connect(cg); cg.connect(g);
      route(T, g, { dry: true });
    },
    snare(T, t, vel = 1, o = {}) {
      const n = noiseSrc(t, t + 0.5), b = ctx.createBiquadFilter(), g = ctx.createGain(), tone = osc("triangle", 190, t, t + 0.3), tg = ctx.createGain();
      b.type = "bandpass"; b.frequency.value = 1900; b.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32 * vel, t + 0.002); g.gain.setTargetAtTime(0.0001, t + 0.01, o.len || 0.06);
      tone.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      tg.gain.setValueAtTime(0.18 * vel, t); tg.gain.setTargetAtTime(0.0001, t, 0.03);
      n.connect(b); b.connect(g); tone.connect(tg); tg.connect(g);
      route(T, g, { rev: o.rev ?? 0.35, pan: o.pan || 0 });
    },
    hat(T, t, vel = 1, open = false) {
      const n = noiseSrc(t, t + 0.5), h = ctx.createBiquadFilter(), g = ctx.createGain();
      h.type = "highpass"; h.frequency.value = 7600;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * vel, t + 0.002); g.gain.setTargetAtTime(0.0001, t + 0.004, open ? 0.09 : 0.016);
      n.connect(h); h.connect(g);
      route(T, g, { pan: 0.28, rev: 0.08 });
    },
    taiko(T, t, vel = 1) {
      const o = osc("sine", 105, t, t + 1.4), g = ctx.createGain(), n = noiseSrc(t, t + 0.3), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(48, t + 0.3);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42 * vel, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.02, 0.2);
      lp.type = "lowpass"; lp.frequency.value = 520;
      ng.gain.setValueAtTime(0.3 * vel, t); ng.gain.setTargetAtTime(0.0001, t, 0.04);
      o.connect(g); n.connect(lp); lp.connect(ng); ng.connect(g);
      route(T, g, { rev: 0.4 });
    },
    tom(T, t, n, vel = 1) {
      const o = osc("sine", mtof(n), t, t + 0.8), g = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(mtof(n) * 0.62, t + 0.28);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4 * vel, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.14);
      o.connect(g);
      route(T, g, { rev: 0.35, pan: rnd(-0.3, 0.3) });
    },
    crash(T, t, vel = 1) {
      const n = noiseSrc(t, t + 3), h = ctx.createBiquadFilter(), g = ctx.createGain();
      h.type = "highpass"; h.frequency.value = 4200;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13 * vel, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.6);
      n.connect(h); h.connect(g);
      route(T, g, { rev: 0.35 });
    },
    // Souffle qui monte jusqu'au temps fort suivant
    riser(T, t, dur, vel = 1) {
      const n = noiseSrc(t, t + dur + 0.1), b = ctx.createBiquadFilter(), g = ctx.createGain();
      b.type = "bandpass"; b.Q.value = 4;
      b.frequency.setValueAtTime(350, t); b.frequency.exponentialRampToValueAtTime(7000, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * vel, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
      n.connect(b); b.connect(g);
      route(T, g, { rev: 0.5 });
    },
    // Supersaw : 7 scies réparties en stéréo (accords « stab » ou nappe large)
    saw(T, t, notes, dur, o = {}) {
      const end = t + dur, f = ctx.createBiquadFilter(), g = ctx.createGain(), L = ctx.createStereoPanner(), Rr = ctx.createStereoPanner();
      f.type = "lowpass"; f.Q.value = o.q || 1;
      f.frequency.setValueAtTime(o.cut || 3200, t);
      if (o.env) { f.frequency.setValueAtTime(o.cut * (1 + o.env), t); f.frequency.setTargetAtTime(o.cut, t, o.envT || 0.08); }
      L.pan.value = -0.55; Rr.pan.value = 0.55;
      adsr(g.gain, t, o.att ?? 0.005, (o.vol || 0.03), o.dec ?? 0.15, o.sus ?? 0.7, end, o.rel ?? 0.12);
      const spread = [-24, -15, -7, 0, 7, 15, 24];
      for (const n of notes) spread.forEach((d, i) => osc("sawtooth", mtof(n), t, end + (o.rel ?? 0.12) * 3, d + rnd(-2, 2)).connect(i % 2 ? L : Rr));
      L.connect(f); Rr.connect(f); f.connect(g);
      route(T, g, { rev: o.rev ?? 0.2, dly: o.dly || 0 });
    },
    // Voix robot façon talkbox : formants qui s'ouvrent (« oua ») puis se referment, glissé entre les notes
    talk(T, t, n, dur, vel = 1, o = {}) {
      const end = t + dur, g = ctx.createGain(), mix = ctx.createGain(), drive = ctx.createWaveShaper();
      const c = new Float32Array(256); for (let i = 0; i < 256; i += 1) { const x = i / 127.5 - 1; c[i] = Math.tanh(2.2 * x); } drive.curve = c;
      adsr(g.gain, t, 0.02, 0.11 * vel * (o.vol || 1), 0.3, 0.85, end, 0.1);
      const vib = vibrato(t, end + 0.4, 5.8, 18, Math.min(0.3, dur * 0.5));
      for (const [type, d] of [["sawtooth", 0], ["square", -1200]]) {
        const s = osc(type, mtof(n), t, end + 0.4, d);
        if (o.from) { s.frequency.setValueAtTime(mtof(o.from), t); s.frequency.exponentialRampToValueAtTime(mtof(n), t + 0.06); }
        vib.connect(s.detune); s.connect(drive);
      }
      drive.connect(mix);
      // « ou » -> « a » -> « o » : deux formants qui bougent avec la note
      for (const [f1, f2, f3, q, a] of [[300, 750, 520, 7, 1], [870, 1250, 900, 9, 0.7], [2250, 2600, 2400, 11, 0.3]]) {
        const b = ctx.createBiquadFilter(), bg = ctx.createGain();
        b.type = "bandpass"; b.Q.value = q; bg.gain.value = a * 2.2;
        b.frequency.setValueAtTime(f1, t);
        b.frequency.exponentialRampToValueAtTime(f2, t + Math.min(0.09, dur * 0.3));
        b.frequency.setValueAtTime(f2, Math.max(t + 0.1, end - 0.06));
        b.frequency.exponentialRampToValueAtTime(f3, end + 0.08);
        mix.connect(b); b.connect(bg); bg.connect(g);
      }
      route(T, g, { rev: o.rev ?? 0.3, dly: o.dly ?? 0.25 });
    },
    clap(T, t, vel = 1, o = {}) {
      const n = noiseSrc(t, t + 0.6), b = ctx.createBiquadFilter(), g = ctx.createGain();
      b.type = "bandpass"; b.frequency.value = 1300; b.Q.value = 0.9;
      g.gain.setValueAtTime(0.0001, t);
      for (const k of [0, 0.011, 0.022]) { g.gain.setValueAtTime(0.3 * vel, t + k); g.gain.setTargetAtTime(0.02, t + k + 0.001, 0.003); }
      g.gain.setValueAtTime(0.22 * vel, t + 0.033); g.gain.setTargetAtTime(0.0001, t + 0.034, o.len || 0.08);
      n.connect(b); b.connect(g);
      route(T, g, { rev: o.rev ?? 0.3 });
    },
    // Petit « blip » cartoon (bulle qui monte ou descend)
    blip(T, t, n, vel = 1, up = true) {
      const o = osc("sine", mtof(n), t, t + 0.3), g = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(mtof(n + (up ? 12 : -12)), t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * vel, t + 0.005); g.gain.setTargetAtTime(0.0001, t + 0.02, 0.04);
      o.connect(g);
      route(T, g, { rev: 0.3, dly: 0.35, pan: rnd(-0.5, 0.5) });
    },
    // Vent cosmique : bruit filtré qui dérive lentement
    wind(T, t, dur, vel = 1) {
      const n = noiseSrc(t, t + dur + 1), b = ctx.createBiquadFilter(), g = ctx.createGain();
      b.type = "bandpass"; b.Q.value = 6;
      b.frequency.setValueAtTime(rnd(300, 600), t); b.frequency.exponentialRampToValueAtTime(rnd(900, 2200), t + dur * 0.5); b.frequency.exponentialRampToValueAtTime(rnd(300, 700), t + dur);
      adsr(g.gain, t, dur * 0.4, 0.05 * vel, 1, 1, t + dur * 0.6, dur * 0.4);
      n.connect(b); b.connect(g);
      route(T, g, { rev: 0.8, pan: rnd(-0.7, 0.7) });
    },
    // Impact grave au début d'une montée
    boom(T, t, vel = 1) {
      const o = osc("sine", 70, t, t + 2), g = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(30, t + 1.2);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7 * vel, t + 0.01); g.gain.setTargetAtTime(0.0001, t + 0.05, 0.4);
      const og = ctx.createGain(); og.gain.value = 0.7; o.connect(og); og.connect(g);
      route(T, g, { rev: 0.3 });
      I.crash(T, t, vel);
    }
  };

  /* ─── Séquenceur ─── */
  /* Une piste : voix -> filtre (balayages « filter house ») -> pompe (baisse à chaque grosse caisse) -> sortie.
     La grosse caisse rejoint directement la sortie. */
  function makeTrackBus() {
    const T = { bus: ctx.createGain(), filt: ctx.createBiquadFilter(), pump: ctx.createGain(), out: ctx.createGain(), rev: ctx.createGain(), dly: ctx.createGain(), dry: ctx.createGain() };
    T.filt.type = "lowpass"; T.filt.frequency.value = 20000; T.filt.Q.value = 0.9;
    T.bus.connect(T.filt); T.filt.connect(T.pump); T.pump.connect(T.out); T.dry.connect(T.out);
    T.out.connect(master); T.rev.connect(revIn); T.dly.connect(dlyIn);
    return T;
  }
  function fade(T, from, to, t, sec) {
    for (const g of [T.out, T.rev, T.dly]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(from, t); g.gain.linearRampToValueAtTime(to, t + sec); }
  }
  let timer = null;
  function tick() {
    const ahead = ctx.currentTime + 0.18;
    for (const p of players) {
      if (p.dead || p.pending || p.ending) continue;
      const spb = 60 / p.track.bpm / 4;
      while (p.next < ahead) {
        const s = p.step % 16;
        if (s === 0) {
          if (p.want !== p.level) { const up = p.want > p.level; p.level = p.want; if (p.track.onLevel) p.track.onLevel(p, up, p.next); }
          p.bar = Math.floor(p.step / 16);
        }
        p.track.step(p, s, p.next + (p.track.swing && s % 2 ? spb * p.track.swing : 0), spb);
        p.next += spb;
        p.step += 1;
        if (p.track.bars && p.step >= p.track.bars * 16) {
          if (p.track.once) { const q = p; q.ending = true; setTimeout(() => { if (!q.dead) release(q, 0.3); }, (q.track.tail || 4) * 1000); break; }
          p.step = (p.track.loopFrom || 0) * 16;
        }
      }
    }
  }
  function start(name, o = {}) {
    setup();
    if (ctx.state !== "running") ctx.resume();   // « suspended », ou « interrupted » sur iPhone
    const track = BDAMusic.tracks[name], T = makeTrackBus(), t = ctx.currentTime + 0.08;
    if (track.uses && track.uses.some(i => !BANK[i])) {
      // Les instruments arrivent d'abord ; la piste démarre dès qu'ils sont prêts
      const p = { track, T, name, pending: true, dead: false };
      players.push(p);
      Promise.all(track.uses.map(loadInst)).then(() => {
        if (p.dead) return;
        players.splice(players.indexOf(p), 1);
        for (const g of [T.out, T.rev, T.dly]) g.disconnect();
        start(name, o);
      });
      return p;
    }
    fade(T, 0.0001, track.gain || 1, t, o.fade ?? 0.8);
    const beat = 60 / track.bpm;
    dL.delayTime.setValueAtTime(beat * 0.75, t); dR.delayTime.setValueAtTime(beat * 0.75, t);
    const p = { track, T, name, step: 0, bar: 0, next: t + 0.05, level: o.level || 1, want: o.level || 1, tr: 0, mem: {} };
    if (track.init) track.init(p);
    players.push(p);
    if (!timer) timer = setInterval(tick, 25);
    return p;
  }
  function release(p, sec) {
    p.dead = true;
    if (p.pending) { players.splice(players.indexOf(p), 1); return; }
    const t = ctx.currentTime;
    fade(p.T, p.T.out.gain.value || 1, 0.0001, t, sec);
    setTimeout(() => { for (const g of [p.T.out, p.T.rev, p.T.dly]) g.disconnect(); }, (sec + 6) * 1000);
    if (players.includes(p)) players.splice(players.indexOf(p), 1);
    if (!players.length) { clearInterval(timer); timer = null; }
  }
  BDAMusic.play = (name, o = {}) => { [...players].forEach(p => release(p, o.cross ?? 0.6)); return start(name, o); };
  BDAMusic.cross = (name, o = {}) => BDAMusic.play(name, { fade: 2.4, cross: 2.4, ...o });
  BDAMusic.stop = (sec = 1.2) => { [...players].forEach(p => release(p, sec)); };
  BDAMusic.setLevel = n => { for (const p of players) p.want = Math.max(1, Math.min(3, n)); };
  BDAMusic.volume = v => { setup(); master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); };
  BDAMusic.current = () => players[players.length - 1] || null;
  I.sample = sample;
  BDAMusic.load = names => { setup(); return Promise.all(names.map(loadInst)); };
  // Petit jingle par-dessus la musique en cours (victoire, défaite)
  BDAMusic.jingle = name => { setup(); if (ctx.state !== "running") ctx.resume(); return start(name, { fade: 0.02 }); };
  BDAMusic.I = I;
  BDAMusic.sweep = (p, t, from, to, sec, q) => {
    const f = p.T.filt.frequency;
    f.cancelScheduledValues(t); f.setValueAtTime(from, t); f.exponentialRampToValueAtTime(to, t + sec);
    if (q) p.T.filt.Q.setValueAtTime(q, t);
  };
  BDAMusic.setup = setup;
  BDAMusic.ctx = () => ctx;
  BDAMusic.output = () => comp;
  BDAMusic.tracks = {};
  window.BDAMusic = BDAMusic;
})();
