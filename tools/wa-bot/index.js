// Bot Live Chat MineIDHost
// - Menyimpan tiket & percakapan live chat website
// - Notifikasi grup WhatsApp admin (tag semua) saat ada tiket / balasan pelanggan
// - Admin membalas dari halaman mineidhost.com/admin-chat
// - Penutupan tiket: bot bertanya ke pelanggan, lalu tutup otomatis + email transkrip + ajakan rating Trustpilot
//
// Jalankan: npm install && npm start   (Node.js 20+). Konfigurasi di .env (lihat .env.example)

import http from "node:http";
import crypto from "node:crypto";
import { cfg, checkConfig } from "./lib/config.js";
import * as store from "./lib/store.js";
import { startWhatsApp, notifyGroup, wa } from "./lib/wa.js";
import { sendTranscript } from "./lib/mail.js";

checkConfig();

const MSG = {
  confirm: "Apakah masih ada yang bisa kami bantu? 😊\nKalau sudah selesai, balas \"selesai\". Kalau masih ada pertanyaan, langsung tulis saja ya.",
  reopen: "Siap, tim kami akan lanjut membantu. Silakan tulis pertanyaan kamu.",
  closed: (t) =>
    `Terima kasih sudah menghubungi MineIDHost! 🙏 Tiket ${t.id} sudah ditutup.\n` +
    `Transkrip percakapan dikirim ke email ${t.email}.\n` +
    `Kalau berkenan, bantu kami dengan memberi rating di Trustpilot: ${cfg.trustpilotUrl}`,
  timeout: "Karena belum ada balasan, tiket ini kami tutup otomatis. Kalau masih butuh bantuan, mulai chat baru kapan saja ya.",
};

// Pesan dianggap "selesai" kalau SEMUA katanya ada di daftar ini (contoh: "sudah min makasih", "selesai kak", "gak ada lagi")
const DONE_CORE = new Set(["selesai", "sudah", "udah", "udh", "sdh", "cukup", "beres", "done", "aman", "tidak", "gak", "ga", "gk",
  "nggak", "ngga", "enggak", "engga", "no", "nope", "makasih", "makasi", "mksh", "thanks", "thank", "thx", "tq", "terimakasih", "kasih"]);
const DONE_FILL = new Set(["ada", "lagi", "itu", "aja", "saja", "kok", "deh", "sih", "ya", "yaa", "iya", "ok", "oke", "okey", "okay",
  "sip", "siap", "mantap", "min", "admin", "kak", "ka", "bang", "gan", "bro", "mas", "mba", "mbak", "pak", "bu", "banyak", "terima",
  "you", "so", "much", "semua", "udah", "jelas", "paham", "ngerti", "beres", "dulu", "ini", "untuk", "atas", "bantuannya", "bantuan"]);
function isDone(text) {
  const words = String(text).toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 10) return false;
  return words.some((w) => DONE_CORE.has(w)) && words.every((w) => DONE_CORE.has(w) || DONE_FILL.has(w));
}

// ---------------------------------------------------------------- sesi admin
const adminSessions = new Map(); // token -> { name, exp }
function adminLogin(password, name) {
  const a = Buffer.from(String(password || "")), b = Buffer.from(cfg.adminPassword);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const token = crypto.randomBytes(24).toString("base64url");
  adminSessions.set(token, { name: String(name || "Admin").slice(0, 30), exp: Date.now() + 7 * 864e5 });
  return token;
}
function adminFrom(body) {
  const s = adminSessions.get(String(body.adminToken || ""));
  if (!s || s.exp < Date.now()) return null;
  return s;
}

// ---------------------------------------------------------------- batas kecepatan
const buckets = new Map();
function limited(key, max, ms) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < ms);
  if (arr.length >= max) return true;
  arr.push(now);
  buckets.set(key, arr);
  return false;
}

// ---------------------------------------------------------------- helpers
const clip = (v, n) => String(v == null ? "" : v).replace(/\u0000/g, "").trim().slice(0, n);
const adminLink = (id) => `${cfg.siteUrl}/admin-chat#${id}`;
function waLink(n) {
  let d = String(n || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  if (d.startsWith("8")) d = "62" + d;
  return d.length >= 9 ? `https://wa.me/${d}` : "";
}
function view(t, since) {
  return { ok: true, id: t.id, status: t.status, messages: store.publicMessages(t, since) };
}

async function closeTicket(t, by, reason) {
  if (t.status === "closed") return;
  t.status = "closed";
  t.closedAt = Date.now();
  t.closedBy = by;
  if (reason === "timeout") store.addMessage(t, "bot", "Asisten", MSG.timeout);
  store.addMessage(t, "bot", "Asisten", MSG.closed(t));
  notifyGroup(`✅ Tiket *${t.id}* (${t.name}) ditutup oleh ${by}. Transkrip dikirim ke ${t.email} dan ${cfg.supportEmail}.`);
  t.mail = await sendTranscript(t);
  store.persist();
  console.log(`[OK] Tiket ${t.id} ditutup (${by}). Email: ${t.mail}`);
}

// ---------------------------------------------------------------- aksi API
const actions = {
  // ----- pelanggan
  async create(b) {
    const name = clip(b.name, 60), email = clip(b.email, 120).toLowerCase(), whatsapp = clip(b.whatsapp, 30), message = clip(b.message, 1500);
    if (name.length < 2) return { ok: false, error: "Isi nama kamu." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Email tidak valid." };
    if (message.length < 3) return { ok: false, error: "Tulis pertanyaan kamu." };
    if (limited("create:" + (b.ip || "?"), 3, 10 * 60e3) || limited("create:all", 30, 10 * 60e3)) {
      return { ok: false, error: "Terlalu banyak tiket. Coba lagi beberapa menit lagi." };
    }
    const t = store.createTicket({ name, email, whatsapp, message, transcript: clip(b.transcript, 4000), page: clip(b.page, 300), ip: clip(b.ip, 60) });
    store.addMessage(t, "bot", "Asisten", "Tiket kamu sudah diterima ✅ Tim teknis MineIDHost akan segera merespon di chat ini. Biarkan halaman ini terbuka atau kembali lagi nanti, balasan tetap tersimpan.");
    const wl = waLink(whatsapp);
    notifyGroup(
      [
        `🎫 *TIKET BARU ${t.id}*`,
        `@semua ada pelanggan yang menunggu di live chat website.`,
        ``,
        `👤 *Nama:* ${name}`,
        `📧 *Email:* ${email}`,
        whatsapp ? `📱 *WhatsApp:* ${whatsapp}${wl ? " (" + wl + ")" : ""}` : null,
        `🌐 *Halaman:* ${t.page || "-"}`,
        ``,
        `💬 *Pertanyaan:*`,
        message,
        ``,
        `👉 *Balas di sini:* ${adminLink(t.id)}`,
      ].filter((x) => x !== null).join("\n"),
      true
    );
    console.log(`[OK] Tiket baru ${t.id} dari ${name}`);
    return { ok: true, id: t.id, token: t.token, status: t.status, messages: t.messages };
  },

  async poll(b) {
    const t = store.getTicket(b.id);
    if (!store.checkToken(t, b.token)) return { ok: false, error: "Tiket tidak ditemukan.", code: 404 };
    return view(t, Number(b.since) || 0);
  },

  async send(b) {
    const t = store.getTicket(b.id);
    if (!store.checkToken(t, b.token)) return { ok: false, error: "Tiket tidak ditemukan.", code: 404 };
    if (t.status === "closed") return { ...view(t, Number(b.since) || 0), ok: false, error: "Tiket sudah ditutup. Mulai chat baru ya." };
    const text = clip(b.text, 2000);
    if (!text) return { ok: false, error: "Pesan kosong." };
    if (limited("send:" + t.id, 15, 60e3)) return { ok: false, error: "Terlalu cepat, tunggu sebentar." };
    store.addMessage(t, "user", t.name, text);

    if (t.status === "confirming") {
      if (isDone(text)) {
        await closeTicket(t, "pelanggan");
      } else {
        t.status = "open";
        t.confirmAt = 0;
        store.addMessage(t, "bot", "Asisten", MSG.reopen);
        notifyGroup(`🔁 *${t.id}* (${t.name}) masih butuh bantuan:\n"${text.slice(0, 300)}"\n👉 ${adminLink(t.id)}`, true);
      }
    } else {
      // notifikasi balasan pelanggan, maksimal 1x per 2 menit per tiket
      if (!limited("notify:" + t.id, 1, 2 * 60e3)) {
        notifyGroup(`💬 Balasan baru di *${t.id}* (${t.name}):\n"${text.slice(0, 300)}"\n👉 ${adminLink(t.id)}`);
      }
    }
    return view(t, Number(b.since) || 0);
  },

  // ----- admin
  async admin_login(b) {
    if (limited("login:" + (b.ip || "?"), 8, 10 * 60e3)) return { ok: false, error: "Terlalu banyak percobaan login." };
    const token = adminLogin(b.password, clip(b.name, 30));
    return token ? { ok: true, adminToken: token } : { ok: false, error: "Password salah.", code: 401 };
  },

  async admin_list(b) {
    if (!adminFrom(b)) return { ok: false, error: "Sesi admin habis, login lagi.", code: 401 };
    const order = { confirming: 0, open: 0, closed: 1 };
    const list = store.listTickets()
      .filter((t) => b.all || t.status !== "closed" || Date.now() - t.closedAt < 3 * 864e5)
      .sort((x, y) => order[x.status] - order[y.status] || y.updated - x.updated)
      .slice(0, 200)
      .map((t) => {
        const last = t.messages[t.messages.length - 1];
        const lastAdmin = [...t.messages].reverse().find((m) => m.from === "admin");
        const lastHuman = [...t.messages].reverse().find((m) => m.from !== "bot");
        const waiting = t.status !== "closed" && lastHuman && lastHuman.from === "user";
        return { id: t.id, name: t.name, email: t.email, whatsapp: t.whatsapp, status: t.status, updated: t.updated, created: t.created,
          last: last ? last.text.slice(0, 90) : "", lastFrom: last ? last.from : "", waiting, unread: t.messages.filter((m) => m.from === "user" && m.t > (t.lastAdminRead || 0)).length,
          lastAdmin: lastAdmin ? lastAdmin.name : "" };
      });
    return { ok: true, tickets: list, whatsapp: wa.ready };
  },

  async admin_get(b) {
    if (!adminFrom(b)) return { ok: false, error: "Sesi admin habis, login lagi.", code: 401 };
    const t = store.getTicket(b.id);
    if (!t) return { ok: false, error: "Tiket tidak ditemukan.", code: 404 };
    t.lastAdminRead = Date.now();
    store.persist();
    return { ok: true, ticket: { id: t.id, name: t.name, email: t.email, whatsapp: t.whatsapp, page: t.page, status: t.status, created: t.created,
      closedBy: t.closedBy, mail: t.mail, assistant: t.assistant }, messages: store.publicMessages(t, Number(b.since) || 0) };
  },

  async admin_send(b) {
    const s = adminFrom(b);
    if (!s) return { ok: false, error: "Sesi admin habis, login lagi.", code: 401 };
    const t = store.getTicket(b.id);
    if (!t) return { ok: false, error: "Tiket tidak ditemukan.", code: 404 };
    if (t.status === "closed") return { ok: false, error: "Tiket sudah ditutup." };
    const text = clip(b.text, 2000);
    if (!text) return { ok: false, error: "Pesan kosong." };
    store.addMessage(t, "admin", s.name, text);
    if (t.status === "confirming") { t.status = "open"; t.confirmAt = 0; }
    t.lastAdminRead = Date.now();
    return { ok: true, messages: store.publicMessages(t, Number(b.since) || 0), status: t.status };
  },

  async admin_resolve(b) {
    const s = adminFrom(b);
    if (!s) return { ok: false, error: "Sesi admin habis, login lagi.", code: 401 };
    const t = store.getTicket(b.id);
    if (!t || t.status === "closed") return { ok: false, error: "Tiket tidak ditemukan atau sudah ditutup." };
    t.status = "confirming";
    t.confirmAt = Date.now();
    store.addMessage(t, "bot", "Asisten", MSG.confirm);
    return { ok: true, status: t.status, messages: store.publicMessages(t, Number(b.since) || 0) };
  },

  async admin_close(b) {
    const s = adminFrom(b);
    if (!s) return { ok: false, error: "Sesi admin habis, login lagi.", code: 401 };
    const t = store.getTicket(b.id);
    if (!t) return { ok: false, error: "Tiket tidak ditemukan." };
    await closeTicket(t, s.name);
    return { ok: true, status: t.status, mail: t.mail, messages: store.publicMessages(t, Number(b.since) || 0) };
  },
};

// tutup otomatis tiket "confirming" yang tidak dibalas
setInterval(() => {
  const limit = cfg.confirmTimeoutMin * 60e3;
  for (const t of store.listTickets()) {
    if (t.status === "confirming" && t.confirmAt && Date.now() - t.confirmAt > limit) {
      closeTicket(t, "otomatis (tidak ada balasan)", "timeout").catch((e) => console.error(e));
    }
  }
}, 60e3);

// ---------------------------------------------------------------- server HTTP
const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(obj));
  };
  try {
    if (req.method === "GET" && req.url === "/health") {
      return send(200, { ok: true, whatsapp: wa.ready, group: Boolean(cfg.groupJid), email: Boolean(cfg.gmailUser && cfg.gmailAppPassword) });
    }
    if (req.method !== "POST" || req.url !== "/api") return send(404, { ok: false });
    const sec = Buffer.from(String(req.headers["x-bot-secret"] || "")), want = Buffer.from(cfg.botSecret);
    if (sec.length !== want.length || !crypto.timingSafeEqual(sec, want)) return send(401, { ok: false, error: "secret" });

    let raw = "";
    for await (const c of req) {
      raw += c;
      if (raw.length > 30000) return send(413, { ok: false });
    }
    const body = JSON.parse(raw || "{}");
    const fn = actions[body.action];
    if (!fn) return send(400, { ok: false, error: "action" });
    const out = await fn(body);
    return send(out.code || (out.ok ? 200 : 400), out);
  } catch (e) {
    console.error("[!] Error API:", e);
    return send(500, { ok: false, error: "Kesalahan server bot." });
  }
});

server.listen(cfg.port, "0.0.0.0", () => console.log(`[OK] Server live chat berjalan di port ${cfg.port} (POST /api, GET /health)`));
startWhatsApp().catch((e) => console.error("[!] Gagal start WhatsApp:", e));
