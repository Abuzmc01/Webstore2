// Vercel Serverless Function: POST /api/livechat
// Meneruskan aksi live chat (pelanggan & admin) dari website ke bot live chat di VPS/Pterodactyl.
// Website tidak perlu domain/SSL tambahan untuk bot: browser -> Vercel (HTTPS) -> bot (server ke server).
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   BOT_URL        contoh: http://IP_SERVER_BOT:PORT
//   BOT_SECRET     kode rahasia yang sama dengan BOT_SECRET di .env bot
//   ALLOWED_ORIGIN (opsional) default: https://mineidhost.com

const ACTIONS = new Set([
  "create", "poll", "send", "send_image", "file",
  "admin_methods", "admin_login", "admin_request_code", "admin_verify_code",
  "admin_list", "admin_get", "admin_send", "admin_send_image", "admin_file", "admin_resolve", "admin_close",
]);

// Foto dikirim sebagai base64 di JSON; Vercel membatasi body ±4,5 MB
const MAX_BODY = 4 * 1024 * 1024;

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new Error("too large");
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
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
    return res.status(413).json({ ok: false, error: "Data terlalu besar. Kirim foto yang lebih kecil." });
  }
  if (!ACTIONS.has(body.action)) return res.status(400).json({ ok: false, error: "action" });

  // honeypot untuk bot spam pada pembuatan tiket
  if (body.action === "create" && body.website) {
    return res.status(200).json({ ok: true, id: "MDH-SPAM", token: "x", status: "closed", messages: [] });
  }

  // kompatibel dengan pengaturan lama (WA_BOT_URL=http://ip:port/ticket, WA_BOT_SECRET)
  const base = String(process.env.BOT_URL || process.env.WA_BOT_URL || "").trim().replace(/\/ticket\/?$/, "").replace(/\/$/, "");
  const secret = String(process.env.BOT_SECRET || process.env.WA_BOT_SECRET || "").trim();
  if (!base || !secret) return res.status(503).json({ ok: false, error: "Live chat belum dikonfigurasi." });

  body.ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  delete body.website;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(base + "/api", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bot-Secret": secret },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const ctype = r.headers.get("content-type") || "";
    if (r.ok && ctype.startsWith("image/")) {
      res.setHeader("Content-Type", ctype);
      res.setHeader("Cache-Control", "private, max-age=86400");
      return res.status(200).send(Buffer.from(await r.arrayBuffer()));
    }
    const data = await r.json().catch(() => ({ ok: false, error: "Respon bot tidak valid." }));
    if (r.status === 401 && data.error === "secret") {
      console.error("BOT_SECRET di Vercel tidak sama dengan BOT_SECRET di .env bot");
      return res.status(502).json({ ok: false, error: "Konfigurasi live chat belum cocok (BOT_SECRET berbeda antara Vercel dan bot)." });
    }
    return res.status(r.status).json(data);
  } catch (e) {
    console.error("livechat forward failed:", e && e.message);
    return res.status(502).json({ ok: false, error: "Server live chat sedang tidak tersedia." });
  }
};
