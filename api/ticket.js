// Vercel Serverless Function: POST /api/ticket
// Menerima tiket dari asisten chat website, lalu meneruskannya ke bot WhatsApp MineIDHost.
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   WA_BOT_URL     contoh: http://IP_VPS:PORT/ticket   (alamat bot WhatsApp)
//   WA_BOT_SECRET  kode rahasia yang sama dengan BOT_SECRET di bot
//   ALLOWED_ORIGIN (opsional) default: https://mineidhost.com

const hits = new Map(); // batas sederhana per IP (per instance)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;

function clip(v, n) {
  return String(v == null ? "" : v).replace(/\u0000/g, "").trim().slice(0, n);
}

function ticketId() {
  const d = new Date(Date.now() + 7 * 3600 * 1000); // WIB
  const p = (x) => String(x).padStart(2, "0");
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MDH-${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${rnd}`;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 20000) throw new Error("too large");
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

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    return res.status(429).json({ ok: false, error: "Terlalu banyak tiket. Coba lagi beberapa menit lagi." });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return res.status(400).json({ ok: false, error: "body" });
  }

  // honeypot: bot spam biasanya mengisi kolom tersembunyi ini
  if (clip(body.website, 200)) return res.status(200).json({ ok: true, id: ticketId() });

  const t = {
    id: ticketId(),
    name: clip(body.name, 60),
    contact: clip(body.contact, 80),
    message: clip(body.message, 1500),
    transcript: clip(body.transcript, 4000),
    page: clip(body.page, 300),
    ip,
    ua: clip(req.headers["user-agent"], 160),
    time: new Date().toISOString(),
  };

  const isMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.contact);
  const digits = t.contact.replace(/[^\d]/g, "");
  if (t.name.length < 2 || t.message.length < 5 || (!isMail && digits.length < 9)) {
    return res.status(400).json({ ok: false, error: "Data tiket belum lengkap." });
  }

  const url = process.env.WA_BOT_URL;
  const secret = process.env.WA_BOT_SECRET;
  if (!url || !secret) {
    return res.status(503).json({ ok: false, error: "Bot belum dikonfigurasi." });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bot-Secret": secret },
      body: JSON.stringify(t),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) throw new Error("bot " + r.status);
  } catch (e) {
    console.error("ticket forward failed:", e && e.message);
    return res.status(502).json({ ok: false, error: "Bot WhatsApp sedang tidak tersedia." });
  }

  list.push(now);
  hits.set(ip, list);
  return res.status(200).json({ ok: true, id: t.id });
};
