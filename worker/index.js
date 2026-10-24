/* Game server for online play. Static files of public/ are served by Cloudflare before this script runs;
   only /ws and /api reach it.
   - Lobby (one Durable Object) pairs waiting players, relays their moves and rolls the dice itself.
   - Board (one Durable Object, SQLite) keeps the shared trophy ranking: real players plus a resident
     population whose trophies drift day after day, so the ranking always looks alive. */
import { DurableObject } from "cloudflare:workers";

const MAX_MESSAGE = 32 * 1024;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket expected", { status: 426 });
      return env.LOBBY.get(env.LOBBY.idFromName("lobby")).fetch(request);
    }
    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
      return env.BOARD.get(env.BOARD.idFromName("board")).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS } });
const CASTS = ["mars", "cranes", "poulpes", "incognito"];

/* Resident players: [name, tribe, base trophies]. Their trophies move a little every day around a slow trend. */
const RESIDENTS = [
  ["zorglax", "cranes", 760], ["mimi.laser", "cranes", 610], ["capitaine_flan", "poulpes", 470], ["mr_dupont", "incognito", 380],
  ["tontonzap", "mars", 300], ["baronne_gloups", "poulpes", 230], ["kiki92", "mars", 170], ["zorglub13", "cranes", 120],
  ["pieuvre_qui_rit", "poulpes", 80], ["gerard.mars", "mars", 50], ["agent_trefle", "incognito", 25], ["bebe_soucoupe", "mars", 10],
  ["albert215", "mars", 540], ["vince", "cranes", 445], ["jeanne21", "poulpes", 395], ["lulu_spatiale", "poulpes", 330],
  ["max13", "mars", 285], ["kevin.zip", "incognito", 260], ["nina", "cranes", 205], ["toto_mars", "mars", 190],
  ["lea_lune", "poulpes", 160], ["yanis07", "incognito", 140], ["chloe", "cranes", 110], ["bob42", "mars", 95],
  ["pti_martien", "mars", 70], ["sam", "incognito", 60], ["ines.b", "poulpes", 45], ["karim77", "cranes", 35],
  ["lola", "poulpes", 30], ["theo.v", "mars", 20], ["mamie_cosmos", "cranes", 15], ["papi_ovni", "incognito", 5],
  ["lucas2012", "mars", 250], ["emma", "poulpes", 175], ["hugo_galaxy", "cranes", 355], ["sarah_s", "incognito", 125],
  ["noah", "mars", 85], ["camille", "poulpes", 65], ["manon.r", "cranes", 40], ["nathan", "mars", 150],
  ["louis_xiv", "incognito", 310], ["jade", "poulpes", 100], ["enzo", "mars", 55], ["leo42", "cranes", 225],
  ["la_comete", "poulpes", 505], ["dr_nebula", "cranes", 680], ["sylvain", "incognito", 270], ["axel_v", "mars", 410],
  ["ptitecrevette", "poulpes", 12], ["rayan", "mars", 135], ["juju", "cranes", 75], ["marco_polo", "incognito", 195],
  ["fanny", "poulpes", 240], ["quentin.k", "cranes", 165], ["luna", "poulpes", 580], ["fred_ufo", "mars", 105]
];
const EPOCH = Date.UTC(2026, 9, 24);
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
function residents(now) {
  const days = (now - EPOCH) / 86400000;
  return RESIDENTS.map(([name, cast, base]) => {
    const a = hash(name), b = hash(`${name}#`), c = hash(`${name}*`);
    const trend = (a - 0.35) * 2.2 * days;
    const wave = 18 + 40 * b, period = 4 + 9 * c;
    const t = Math.round(base + trend + wave * Math.sin((2 * Math.PI * days) / period + a * 6.28));
    return { n: name, c: cast, t: Math.max(0, Math.min(1400, t)), g: 1 };
  });
}

export class Board extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT NOT NULL, tribe TEXT NOT NULL, t INTEGER NOT NULL, seen INTEGER NOT NULL)");
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/score") {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: "json" }, 400); }
      const id = String(body.id || "");
      if (!/^[a-z0-9]{16,40}$/.test(id)) return json({ error: "id" }, 400);
      const name = String(body.name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 14) || "Joueur";
      const cast = CASTS.includes(body.cast) ? body.cast : "mars";
      let t = Math.max(0, Math.min(3000, Math.round(Number(body.t) || 0)));
      const old = this.ctx.storage.sql.exec("SELECT t FROM players WHERE id = ?", id).toArray()[0];
      // A single game moves trophies by a few dozen at most: bigger jumps are trimmed.
      if (old && t > old.t + 40) t = old.t + 40;
      if (!old && t > 1500) t = 1500;
      this.ctx.storage.sql.exec("INSERT INTO players (id, name, tribe, t, seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, tribe = excluded.tribe, t = excluded.t, seen = excluded.seen", id, name, cast, t, Date.now());
      return json(this.rank(id));
    }
    if (url.pathname === "/api/rank") return json(this.rank(url.searchParams.get("id") || ""));
    return json({ error: "route" }, 404);
  }

  /* The top of the ranking, and the player with their neighbours. */
  rank(id) {
    const now = Date.now();
    const rows = this.ctx.storage.sql.exec("SELECT id, name, tribe, t FROM players WHERE seen > ?", now - 30 * 86400000).toArray();
    const list = residents(now).concat(rows.map(r => ({ n: r.name, c: r.tribe, t: r.t, me: r.id === id ? 1 : 0 })));
    list.sort((x, y) => y.t - x.t || (x.me ? -1 : y.me ? 1 : 0));
    list.forEach((r, i) => { r.r = i + 1; });
    const at = list.findIndex(r => r.me);
    const clean = r => ({ r: r.r, n: r.n, c: r.c, t: r.t, ...(r.me ? { me: 1 } : {}), ...(r.g ? { g: 1 } : {}) });
    return {
      total: list.length,
      me: at >= 0 ? at + 1 : null,
      top: list.slice(0, 50).map(clean),
      around: at >= 0 ? list.slice(Math.max(0, at - 3), at + 4).map(clean) : []
    };
  }
}

const die = () => 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 6);

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Keep-alive pings are answered without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    const id = crypto.randomUUID();
    this.ctx.acceptWebSocket(server, [id]);
    server.serializeAttachment({ id, partner: null });
    this.pair(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  info(ws) { return ws.deserializeAttachment() || {}; }
  find(id) { return id ? this.ctx.getWebSockets(id)[0] || null : null; }
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch (e) { /* socket already closed */ } }

  /* The player who has been waiting hosts the game: it deals the cards, as in a duel between friends. */
  pair(ws) {
    const me = this.info(ws);
    const other = this.ctx.getWebSockets().find(o => o !== ws && this.info(o).partner === null);
    if (!other) return this.send(ws, { sys: "wait" });
    const them = this.info(other);
    other.serializeAttachment({ ...them, partner: me.id });
    ws.serializeAttachment({ ...me, partner: them.id });
    this.send(other, { sys: "start", host: true });
    this.send(ws, { sys: "start", host: false });
  }

  webSocketMessage(ws, data) {
    if (typeof data !== "string" || data.length > MAX_MESSAGE) return;
    const partner = this.find(this.info(ws).partner);
    if (!partner) return;
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    if (!msg || typeof msg.t !== "string") return;
    if (msg.t === "rollreq") {
      const roll = { t: "roll", v: die() };
      this.send(ws, roll);
      this.send(partner, roll);
      return;
    }
    partner.send(data);
  }

  /* The partner is told first: the closing socket may refuse any further call. */
  leave(ws) {
    const me = this.info(ws);
    const partner = me.partner === "gone" ? null : this.find(me.partner);
    if (partner && partner !== ws) {
      this.send(partner, { sys: "left" });
      try { partner.serializeAttachment({ ...this.info(partner), partner: "gone" }); } catch (e) { /* closing */ }
      try { partner.close(1000, "partner left"); } catch (e) { /* already closed */ }
    }
    try { ws.serializeAttachment({ ...me, partner: "gone" }); } catch (e) { /* closing */ }
    try { ws.close(1000, "bye"); } catch (e) { /* already closed */ }
  }

  webSocketClose(ws) { this.leave(ws); }
  webSocketError(ws) { this.leave(ws); }
}
