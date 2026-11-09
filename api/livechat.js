// Vercel Serverless Function: POST /api/livechat
// Meneruskan aksi live chat (pelanggan & admin) dari website ke bot live chat di VPS/Pterodactyl.
// Website tidak perlu domain/SSL tambahan untuk bot: browser -> Vercel (HTTPS) -> bot (server ke server).
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   BOT_URL        contoh: http://IP_SERVER_BOT:PORT
//   BOT_SECRET     kode rahasia yang sama dengan BOT_SECRET di .env bot
//   ALLOWED_ORIGIN (opsional) default: https://mineidhost.com

const ACTIONS = new Set([
  "create", "poll", "send",
  "admin_login", "admin_list", "admin_get", "admin_send", "admin_resolve", "admin_close",
]);

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  let raw = "";
  for await (const c of req) {
    raw += c;
    if (raw.length > 30000) throw new Error("too large");
  }
  return JSON.parse(raw || "{}");
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method" });
  }

  const allowed = process.env.ALLOWED_ORIGIN || "https://mineidhost.com";
  const origin = req.headers.origin || "";
  const okOrigins = [allowed, allowed.replace("://", "://www.")];
  if (origin && !okOrigins.includes(origin) && !origin.endsWith(".vercel.app")) {
    return res.status(403).json({ ok: false, error: "origin" });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return res.status(400).json({ ok: false, error: "body" });
  }
  if (!ACTIONS.has(body.action)) return res.status(400).json({ ok: false, error: "action" });

  // honeypot untuk bot spam pada pembuatan tiket
  if (body.action === "create" && body.website) {
    return res.status(200).json({ ok: true, id: "MDH-SPAM", token: "x", status: "closed", messages: [] });
  }

  // kompatibel dengan pengaturan lama (WA_BOT_URL=http://ip:port/ticket, WA_BOT_SECRET)
  const base = (process.env.BOT_URL || process.env.WA_BOT_URL || "").replace(/\/ticket\/?$/, "").replace(/\/$/, "");
  const secret = process.env.BOT_SECRET || process.env.WA_BOT_SECRET;
  if (!base || !secret) return res.status(503).json({ ok: false, error: "Live chat belum dikonfigurasi." });

  body.ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  delete body.website;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(base + "/api", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bot-Secret": secret },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const data = await r.json().catch(() => ({ ok: false, error: "Respon bot tidak valid." }));
    return res.status(r.status).json(data);
  } catch (e) {
    console.error("livechat forward failed:", e && e.message);
    return res.status(502).json({ ok: false, error: "Server live chat sedang tidak tersedia." });
  }
};
