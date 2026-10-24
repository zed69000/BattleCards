/* Game server for online play. Static files of public/ are served by Cloudflare before this script runs;
   only /ws reaches it. One Durable Object pairs waiting players and relays their moves, and rolls the dice
   itself so that neither phone decides them. It keeps nothing once a game is over. */
import { DurableObject } from "cloudflare:workers";

const MAX_MESSAGE = 32 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket expected", { status: 426 });
      return env.LOBBY.get(env.LOBBY.idFromName("lobby")).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

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

  leave(ws) {
    const me = this.info(ws);
    const partner = this.find(me.partner);
    ws.serializeAttachment({ ...me, partner: "gone" });
    if (partner) {
      this.send(partner, { sys: "left" });
      partner.serializeAttachment({ ...this.info(partner), partner: "gone" });
      try { partner.close(1000, "partner left"); } catch (e) { /* already closed */ }
    }
    try { ws.close(1000, "bye"); } catch (e) { /* already closed */ }
  }

  webSocketClose(ws) { this.leave(ws); }
  webSocketError(ws) { this.leave(ws); }
}
