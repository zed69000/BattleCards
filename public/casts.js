/* Illustrations des cartes : quatre tribus de martiens. Partagé par cosmos.html (le jeu) et da4.html (planche de DA). */
const N = "#1f2a44", K = "#f5e9cf", D2 = "#9fb0b3", GL = "#cdeef0", OR = "#f26a3d", YE = "#f5c445", SK = "#f3c9a0";
const ST = `stroke="${N}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
const LN = `fill="none" ${ST}`;
const SYM = { S: "♠", H: "♥", D: "♦", C: "♣" };
const G1 = "#a8e6a1", BRAIN = "#f08fa8", FOLD = "#c2577a", PALE = "#a9dccb", OCTO = "#ee7fb0", OCTO2 = "#ffc2d9", COAT = "#d9b98a", LIPS = "#e8456b";
const accent = house => (house === "D" ? OR : YE);

function rng(seed) { let s = seed || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function crown(cx, base, w, h, fill) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  return `<path d="M${x0} ${base} L${x0 - 1.5} ${base - h * 0.8} L${cx - w / 4} ${base - h * 0.42} L${cx} ${base - h} L${cx + w / 4} ${base - h * 0.42} L${x1 + 1.5} ${base - h * 0.8} L${x1} ${base}z" fill="${fill}" ${ST}/>
    <circle cx="${x0 - 1.5}" cy="${base - h * 0.8}" r="2.4" fill="${K}" ${ST}/><circle cx="${cx}" cy="${base - h}" r="2.4" fill="${K}" ${ST}/><circle cx="${x1 + 1.5}" cy="${base - h * 0.8}" r="2.4" fill="${K}" ${ST}/>`;
}
function dome(cx, cy, rx, ry) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${GL}" fill-opacity=".28" ${ST}/>
    <path d="M${cx - rx * 0.74} ${cy - ry * 0.3} Q${cx - rx * 0.62} ${cy - ry * 0.78} ${cx - rx * 0.14} ${cy - ry * 0.88}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>`;
}
function tentacle(d, fill, w = 5.8) {
  return `<path d="${d}" fill="none" stroke="${N}" stroke-width="${w + 4.7}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;
}
function frame(inner, seed) {
  const r = rng(seed);
  let stars = "";
  for (let i = 0; i < 7; i += 1) stars += `<circle cx="${(r() * 100).toFixed(0)}" cy="${(r() * 110).toFixed(0)}" r="${r() > 0.6 ? 1.6 : 1}" fill="${K}"/>`;
  return `<svg viewBox="0 0 100 110" preserveAspectRatio="xMidYMid slice"><circle cx="50" cy="50" r="43" fill="${K}" opacity=".17"/>${stars}${inner}</svg>`;
}
function saucer(a, y = 0) {
  return `<g transform="translate(0 ${y})"><path d="M30 44 Q30 14 50 14 Q70 14 70 44z" fill="${GL}" ${ST}/><circle cx="50" cy="34" r="7" fill="${G1}" ${ST}/><circle cx="47.500" cy="33" r="1.400" fill="${N}"/><circle cx="52.500" cy="33" r="1.400" fill="${N}"/>
    <ellipse cx="50" cy="48" rx="44" ry="13" fill="${K}" ${ST}/><ellipse cx="50" cy="44" rx="26" ry="5" fill="${D2}" ${ST} stroke-width="1.800"/>
    ${[16, 33, 50, 67, 84].map((x, i) => `<circle cx="${x}" cy="${[50, 56, 58, 56, 50][i]}" r="3.500" fill="${a}" ${ST}/>`).join("")}</g>`;
}

/* Tête des « Grosses têtes » : cerveau à l'air, yeux exorbités, sourire de squelette. */
function bigHead(opts = {}) {
  const lips = opts.lips ? `<ellipse cx="50" cy="68" rx="15" ry="8.500" fill="${LIPS}" ${ST}/>` : "";
  const lashes = opts.lashes ? `<path d="M31 43 L27 38 M36 40 L34 34 M42 40 L43 34 M69 43 L73 38 M64 40 L66 34 M58 40 L57 34" ${LN} stroke-width="2"/>` : "";
  const brain = opts.noBrain ? "" : `<path d="M22 40 Q13 14 38 12 Q50 3 62 12 Q87 14 78 40 Q70 48 50 46 Q30 48 22 40z" fill="${BRAIN}" ${ST}/>
    <path d="M50 9 V44 M35 17 q9 6 0 15 M65 17 q-9 6 0 15 M25 32 q8 -5 13 2 M75 32 q-8 -5 -13 2" fill="none" stroke="${FOLD}" stroke-width="2.200" stroke-linecap="round"/>`;
  return `<rect x="45" y="70" width="10" height="16" fill="${PALE}" ${ST}/>
    <path d="M30 40 Q27 66 40 75 H60 Q73 66 70 40z" fill="${PALE}" ${ST}/>${brain}
    <circle cx="38" cy="51" r="9.500" fill="#fff" ${ST}/><circle cx="62" cy="51" r="9.500" fill="#fff" ${ST}/>
    <circle cx="${opts.cross ? 41 : 38}" cy="52" r="2.600" fill="${N}"/><circle cx="${opts.cross ? 59 : 62}" cy="52" r="2.600" fill="${N}"/>${lashes}${lips}
    <rect x="38" y="63" width="24" height="9.500" rx="2" fill="#fff" ${ST} stroke-width="2"/><path d="M44 63 V72 M50 63 V72 M56 63 V72" ${LN} stroke-width="1.500"/>`;
}
/* Corps de pieuvre des « Tentacules ». */
function octoBody(extra = "") {
  return `${tentacle("M26 62 q-16 12 -8 30 q6 10 14 2", OCTO)}${tentacle("M74 62 q16 12 8 30 q-6 10 -14 2", OCTO)}${tentacle("M40 68 q-8 18 2 34", OCTO)}${tentacle("M60 68 q8 18 -2 34", OCTO)}${extra}
    <path d="M17 50 Q17 13 50 13 Q83 13 83 50 Q83 72 50 72 Q17 72 17 50z" fill="${OCTO}" ${ST}/>
    <circle cx="27" cy="30" r="3" fill="${OCTO2}"/><circle cx="73" cy="28" r="2.400" fill="${OCTO2}"/><circle cx="68" cy="20" r="1.800" fill="${OCTO2}"/><circle cx="33" cy="22" r="1.800" fill="${OCTO2}"/>`;
}
/* Tête verte et imperméable des « Incognito ». */
function spy(extra = "") {
  return `<path d="M12 112 Q14 82 50 82 Q86 82 88 112z" fill="${COAT}" ${ST}/><path d="M50 84 L36 100 L30 84 M50 84 L64 100 L70 84" ${LN}/>${extra}
    ${tentacle("M38 26 Q32 16 28 8", G1, 4.6)}${tentacle("M62 26 Q68 16 72 8", G1, 4.6)}<circle cx="27" cy="6" r="4.500" fill="${OR}" ${ST}/><circle cx="73" cy="6" r="4.500" fill="${OR}" ${ST}/>
    <ellipse cx="50" cy="50" rx="27" ry="26" fill="${G1}" ${ST}/>`;
}

const CASTS = {
  mars: {
    label: "Petits verts",
    pitch: "Le martien de dessin animé : vert, rond, trop d'yeux, pas très malin.",
    R: a => `<path d="M12 112 Q14 84 50 84 Q86 84 88 112z" fill="${a}" ${ST}/><path d="M28 88 L34 98 L42 88 L50 98 L58 88 L66 98 L72 88" ${LN}/>${tentacle("M36 72 q-8 12 0 26", G1)}${tentacle("M50 74 q6 12 0 28", G1)}${tentacle("M64 72 q8 12 0 26", G1)}<path d="M12 48 Q12 9 50 9 Q88 9 88 48 Q88 74 50 78 Q12 74 12 48z" fill="${G1}" ${ST}/><path d="M26 24 q6 -7 12 0 q6 7 12 0 q6 -7 12 0 q6 7 12 0" ${LN} stroke-width="1.800"/><circle cx="30" cy="52" r="8" fill="${K}" ${ST}/><circle cx="50" cy="46" r="9.500" fill="${K}" ${ST}/><circle cx="70" cy="52" r="8" fill="${K}" ${ST}/><circle cx="31" cy="53" r="3" fill="${N}"/><circle cx="50" cy="47" r="3.800" fill="${N}"/><circle cx="69" cy="53" r="3" fill="${N}"/><path d="M42 66 Q50 61 58 66" ${LN}/>${crown(50, 13, 30, 12, a)}`,
    D: a => `<path d="M26 112 L40 86 H60 L74 112z" fill="${a}" ${ST}/><rect x="45" y="64" width="10" height="24" fill="${G1}" ${ST}/><path d="M22 94 Q50 68 78 94 Q50 86 22 94z" fill="${K}" ${ST}/>${tentacle("M40 20 Q32 12 24 8", G1)}${tentacle("M60 20 Q68 12 76 8", G1)}<circle cx="22" cy="7" r="5.500" fill="${a}" ${ST}/><circle cx="78" cy="7" r="5.500" fill="${a}" ${ST}/><ellipse cx="50" cy="42" rx="22" ry="29" fill="${G1}" ${ST}/><ellipse cx="50" cy="40" rx="13.500" ry="11" fill="${K}" ${ST}/><circle cx="50" cy="41" r="6" fill="${a}" ${ST}/><circle cx="50" cy="41" r="2.600" fill="${N}"/><path d="M38 32 L34 26 M43 29 L41 22 M50 28 V21 M57 29 L59 22 M62 32 L66 26" ${LN} stroke-width="2"/><ellipse cx="50" cy="60" rx="5" ry="3" fill="${LIPS}" ${ST} stroke-width="1.800"/>${crown(50, 19, 28, 13, a)}`,
    V: a => `<path d="M24 112 Q26 88 50 88 Q74 88 76 112z" fill="${a}" ${ST}/>${tentacle("M36 50 Q32 38 29 28", G1)}${tentacle("M64 50 Q68 38 71 28", G1)}<ellipse cx="50" cy="64" rx="32" ry="23" fill="${G1}" ${ST}/><circle cx="28" cy="21" r="10.500" fill="${K}" ${ST}/><circle cx="72" cy="21" r="10.500" fill="${K}" ${ST}/><circle cx="31" cy="23" r="3.800" fill="${N}"/><circle cx="68" cy="19" r="3.800" fill="${N}"/><path d="M32 66 Q50 86 68 66z" fill="${N}" ${ST}/><rect x="46" y="67" width="8" height="6.500" rx="1" fill="${K}"/><path d="M37 46 Q50 28 63 46z" fill="${a}" ${ST}/><path d="M50 37 V30" ${LN}/><ellipse cx="43" cy="29" rx="7" ry="2.500" fill="${K}" ${ST} stroke-width="1.800"/><ellipse cx="57" cy="29" rx="7" ry="2.500" fill="${K}" ${ST} stroke-width="1.800"/>`,
    A: (a, h) => `<path d="M34 54 L14 112 H86 L66 54z" fill="${K}" opacity=".55"/>${saucer(a)}<text x="50" y="100" text-anchor="middle" font-size="30" font-family="serif" fill="${N}">${SYM[h]}</text>`
  },

  cranes: {
    label: "Grosses têtes",
    pitch: "Cerveau à l'air sous cloche de verre, yeux exorbités, sourire de squelette. Les plus méchants, donc les plus drôles.",
    R: a => `<path d="M10 112 L26 84 H74 L90 112z" fill="${a}" ${ST}/><path d="M26 86 L6 62 L36 82z" fill="${OR}" ${ST}/><path d="M74 86 L94 62 L64 82z" fill="${OR}" ${ST}/>
      <g transform="translate(4 11) scale(.92)">${bigHead()}${dome(50, 40, 43, 40)}</g>${crown(50, 15, 30, 13, a)}`,
    D: a => `<path d="M16 112 L30 86 H70 L84 112z" fill="${a}" ${ST}/>
      <g transform="translate(4 16) scale(.92)">${bigHead({ lips: true, lashes: true, noBrain: true })}
        <path d="M24 42 Q10 26 26 14 Q20 -4 42 -6 Q50 -14 58 -6 Q80 -4 74 14 Q90 26 76 42 Q50 30 24 42z" fill="${a === YE ? YE : "#ffd98a"}" ${ST}/>
        <path d="M30 30 Q50 20 70 30 M28 16 Q50 6 72 16 M36 2 Q50 -4 64 2" fill="none" stroke="${N}" stroke-width="1.800" stroke-linecap="round" opacity=".7"/>
        <path d="M24 40 q-4 4 0 8 M76 40 q4 4 0 8" fill="none" stroke="${FOLD}" stroke-width="3" stroke-linecap="round"/></g>
      ${[34, 42, 50, 58, 66].map((x, i) => `<circle cx="${x}" cy="${[92, 95, 96, 95, 92][i]}" r="3.200" fill="#fff" ${ST} stroke-width="1.800"/>`).join("")}`,
    V: a => `<path d="M22 112 L32 92 H62 L72 112z" fill="${a}" ${ST}/>
      <path d="M66 100 L80 86" ${LN} stroke-width="5"/><path d="M72 84 V72 H88 L96 67 V79 H82 V84z" fill="${OR}" ${ST}/><circle cx="96" cy="73" r="3" fill="${YE}" ${ST} stroke-width="1.800"/>
      <g transform="translate(6 28) scale(.8)">${bigHead({ cross: true })}${dome(50, 40, 43, 40)}</g>
      <path d="M4 22 L14 18 L12 8 L22 12 L28 3 L33 12 L44 9 L41 19 L50 24 L40 28 L41 38 L31 33 L24 41 L20 31 L8 33 L12 25z" fill="${K}" ${ST} stroke-width="2"/>
      <text x="27" y="26.500" text-anchor="middle" font-size="9.500" font-family="Righteous, sans-serif" fill="${OR}">ACK!</text>`,
    A: (a, h) => `<path d="M2 20 L22 26 L14 34 L34 38 L24 46 L46 52" fill="none" stroke="${N}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/><path d="M2 20 L22 26 L14 34 L34 38 L24 46 L46 52" fill="none" stroke="${a}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
      <g transform="rotate(32 60 66)"><rect x="34" y="52" width="14" height="10" fill="${D2}" ${ST}/><path d="M40 44 h4 v26 h-4z" fill="${a}" ${ST}/><path d="M32 46 h4 v22 h-4z" fill="${a}" ${ST}/>
        <ellipse cx="66" cy="57" rx="20" ry="13" fill="${OR}" ${ST}/><path d="M70 68 L66 96 H82 L84 66z" fill="${D2}" ${ST}/><circle cx="66" cy="57" r="8" fill="${K}" ${ST}/>
        <path d="M84 50 h8 v14 h-8z" fill="${D2}" ${ST}/></g>
      <text x="74" y="34" text-anchor="middle" font-size="30" font-family="serif" fill="${K}" stroke="${N}" stroke-width="1.600">${SYM[h]}</text>`
  },

  poulpes: {
    label: "Tentacules",
    pitch: "Des pieuvres roses qui se prennent pour l'aristocratie de la galaxie.",
    R: a => `${octoBody()}
      <circle cx="50" cy="40" r="14" fill="#fff" ${ST}/><circle cx="52" cy="42" r="6.500" fill="${a}" ${ST}/><circle cx="53" cy="42" r="2.800" fill="${N}"/>
      <circle cx="50" cy="40" r="17" fill="none" stroke="${a}" stroke-width="3"/><circle cx="50" cy="40" r="18.500" fill="none" stroke="${N}" stroke-width="1.500"/><path d="M66 48 Q78 60 72 76" fill="none" stroke="${a}" stroke-width="1.800" stroke-dasharray="2 2.500"/>
      <path d="M50 62 Q38 56 30 64 q-4 6 3 7 M50 62 Q62 56 70 64 q4 6 -3 7" fill="none" stroke="${N}" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="50" cy="66" rx="3.500" ry="2.500" fill="${N}"/>${crown(50, 15, 34, 14, a)}`,
    D: a => `${octoBody()}
      ${[30, 50, 70].map((x, i) => `<circle cx="${x}" cy="${i === 1 ? 38 : 42}" r="8" fill="#fff" ${ST}/><circle cx="${x + 1}" cy="${i === 1 ? 39 : 43}" r="2.800" fill="${N}"/><path d="M${x - 6} ${i === 1 ? 31 : 35} l-3 -5 M${x} ${i === 1 ? 29 : 33} v-6 M${x + 6} ${i === 1 ? 31 : 35} l3 -5" ${LN} stroke-width="1.800"/>`).join("")}
      <path d="M41 58 Q50 52 59 58 Q50 68 41 58z" fill="${LIPS}" ${ST} stroke-width="2"/>
      ${[26, 34, 42, 50, 58, 66, 74].map((x, i) => `<circle cx="${x}" cy="${[70, 74, 76, 77, 76, 74, 70][i]}" r="3" fill="#fff" ${ST} stroke-width="1.600"/>`).join("")}
      <path d="M50 16 L34 6 V24z M50 16 L66 6 V24z" fill="${a}" ${ST}/><circle cx="50" cy="16" r="4" fill="${a}" ${ST}/>`,
    V: a => `${tentacle("M76 56 Q92 46 86 22", OCTO)}<path d="M86 30 V4" ${LN} stroke-width="2.600"/><path d="M86 5 H66 L71 12 L66 19 H86z" fill="${a}" ${ST}/>${octoBody()}
      <circle cx="38" cy="40" r="10" fill="#fff" ${ST}/><circle cx="62" cy="40" r="10" fill="#fff" ${ST}/><circle cx="42" cy="42" r="3.200" fill="${N}"/><circle cx="58" cy="42" r="3.200" fill="${N}"/>
      <path d="M36 56 Q50 70 64 56z" fill="${N}" ${ST}/><path d="M46 62 q4 12 8 0z" fill="${LIPS}" ${ST} stroke-width="1.800"/>
      <path d="M32 18 Q50 0 68 18z" fill="${a}" ${ST}/><path d="M50 9 V2" ${LN}/><ellipse cx="42" cy="2" rx="8" ry="2.600" fill="${K}" ${ST} stroke-width="1.800"/><ellipse cx="58" cy="2" rx="8" ry="2.600" fill="${K}" ${ST} stroke-width="1.800"/>`,
    A: (a, h) => `${tentacle("M50 100 Q10 104 12 66 Q14 44 30 40", OCTO, 7)}${tentacle("M50 100 Q90 104 88 66 Q86 44 70 40", OCTO, 7)}
      <circle cx="50" cy="52" r="28" fill="${K}" ${ST}/><path d="M24 44 Q50 36 76 44 M23 60 Q50 68 77 60" fill="none" stroke="${D2}" stroke-width="3" stroke-linecap="round"/>
      ${tentacle("M22 86 Q36 70 30 54 Q28 46 36 44", OCTO, 6)}${tentacle("M78 86 Q64 70 70 54 Q72 46 64 44", OCTO, 6)}
      <text x="50" y="62" text-anchor="middle" font-size="28" font-family="serif" fill="currentColor" stroke="${N}" stroke-width="1.200">${SYM[h]}</text>
      <circle cx="50" cy="12" r="8" fill="${OCTO}" ${ST}/><circle cx="47" cy="11" r="1.600" fill="${N}"/><circle cx="53" cy="11" r="1.600" fill="${N}"/>`
  },

  incognito: {
    label: "Incognito",
    pitch: "Des martiens infiltrés, persuadés que leur déguisement d'humain est parfait.",
    R: a => `<path d="M88 112 V58" ${LN} stroke-width="3.500"/><path d="M79 58 Q79 44 88 44 Q97 44 97 58z" fill="${OR}" ${ST}/>${spy()}
      <circle cx="39" cy="44" r="8.500" fill="#fff" ${ST}/><circle cx="61" cy="44" r="8.500" fill="#fff" ${ST}/><circle cx="41" cy="45" r="3" fill="${N}"/><circle cx="59" cy="45" r="3" fill="${N}"/>
      <path d="M24 46 L32 56 M76 46 L68 56" fill="none" stroke="${N}" stroke-width="1.400"/>
      <path d="M30 56 Q50 50 70 56 Q72 84 50 92 Q28 84 30 56z" fill="#fff" ${ST}/><path d="M40 62 q5 4 10 0 q5 4 10 0 M42 72 q4 4 8 0 q4 4 8 0" ${LN} stroke-width="1.600"/>
      <g transform="rotate(-9 50 22)">${crown(50, 28, 36, 15, a)}</g>`,
    D: a => `${spy(`${[32, 40, 50, 60, 68].map((x, i) => `<circle cx="${x}" cy="${[84, 88, 90, 88, 84][i]}" r="3.200" fill="#fff" ${ST} stroke-width="1.800"/>`).join("")}`)}
      <g transform="rotate(9 50 30)"><path d="M20 50 Q10 20 34 14 Q50 4 66 14 Q90 20 82 54 Q76 34 62 30 Q50 26 38 30 Q26 34 20 50z" fill="${a === YE ? YE : "#ffd98a"}" ${ST}/><path d="M36 18 q6 6 0 12 M50 13 v14 M64 18 q-6 6 0 12" fill="none" stroke="${N}" stroke-width="1.600" stroke-linecap="round" opacity=".7"/></g>
      <ellipse cx="50" cy="48" rx="12.500" ry="10.500" fill="#fff" ${ST}/><circle cx="51" cy="49" r="5" fill="${a}" ${ST} stroke-width="1.800"/><circle cx="51" cy="49" r="2.200" fill="${N}"/>
      <path d="M39 41 L35 36 M44 38 L42 32 M50 37 V31 M56 38 L58 32 M61 41 L65 36" ${LN} stroke-width="1.800"/>
      <ellipse cx="53" cy="67" rx="9" ry="4.500" transform="rotate(-10 53 67)" fill="${LIPS}" ${ST} stroke-width="1.800"/><path d="M45 68 L61 66" ${LN} stroke-width="1.400"/><circle cx="66" cy="60" r="1.600" fill="${N}"/>`,
    V: a => `${spy(`<path d="M46 86 L50 92 L54 86 L52 106 H48z" fill="${a}" ${ST} stroke-width="1.800"/>`)}
      <path d="M22 32 Q50 22 78 32 L74 26 Q72 10 50 10 Q28 10 26 26z" fill="${N}" ${ST}/><path d="M27 26 Q50 20 73 26" fill="none" stroke="${a}" stroke-width="3"/>
      <circle cx="38" cy="47" r="9.500" fill="#fff" ${ST} stroke-width="3.200"/><circle cx="62" cy="47" r="9.500" fill="#fff" ${ST} stroke-width="3.200"/><path d="M47.500 46 Q50 43 52.500 46" ${LN} stroke-width="3"/>
      <circle cx="40" cy="48" r="2.800" fill="${N}"/><circle cx="60" cy="48" r="2.800" fill="${N}"/>
      <path d="M50 50 Q42 62 50 66 Q58 62 50 50z" fill="${SK}" ${ST}/>
      <path d="M50 66 Q40 62 34 70 Q42 76 50 70 Q58 76 66 70 Q60 62 50 66z" fill="${N}" ${ST}/>`,
    A: (a, h) => `<path d="M36 52 L20 112 H80 L64 52z" fill="${K}" opacity=".55"/>${saucer(a, -8)}
      <path d="M36 92 V102 M44 94 V104 M56 94 V104 M64 92 V102" ${LN} stroke-width="3"/><path d="M32 82 Q26 78 26 72" ${LN} stroke-width="2"/>
      <ellipse cx="50" cy="84" rx="19" ry="11" fill="#fff" ${ST}/><path d="M40 76 q6 4 2 10 q-8 2 -8 -6z M56 82 q8 -2 8 6 q-6 4 -10 0z" fill="${N}"/>
      <circle cx="72" cy="74" r="8" fill="#fff" ${ST}/><ellipse cx="75" cy="77" rx="5" ry="3.500" fill="#f39a84" ${ST} stroke-width="1.600"/><circle cx="69" cy="71" r="1.500" fill="${N}"/><path d="M66 67 L62 62 M76 66 L79 61" ${LN} stroke-width="2"/>
      <text x="50" y="42" text-anchor="middle" font-size="13" font-family="serif" fill="currentColor" stroke="${N}" stroke-width=".8">${SYM[h]}</text>`
  }
};

function art(cast, house, rank, seed) {
  const a = accent(house);
  if (typeof CASTS[cast][rank] === "function") return frame(CASTS[cast][rank](a, house), seed);
  return frame(`<ellipse cx="50" cy="56" rx="44" ry="14" transform="rotate(-20 50 56)" fill="none" stroke="${K}" stroke-width="2.200" opacity=".7"/><text x="50" y="77" text-anchor="middle" font-size="60" font-family="serif" fill="${K}" stroke="${N}" stroke-width="1.800">${SYM[house]}</text><circle cx="88" cy="42" r="4" fill="${a}" ${ST} stroke-width="1.800"/>`, seed);
}
