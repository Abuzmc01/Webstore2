// Bot WhatsApp tiket MineIDHost
// Menerima tiket dari website (lewat /api/ticket di Vercel) lalu mengirimnya ke grup WhatsApp admin
// dengan tag semua anggota grup.
//
// Jalankan: npm install && npm start   (Node.js 20+)
// Konfigurasi di file .env (lihat .env.example)

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- config (.env sederhana tanpa dependency)
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const PORT = Number(process.env.SERVER_PORT || process.env.PORT || 3000); // SERVER_PORT otomatis di Pterodactyl
const BOT_SECRET = process.env.BOT_SECRET || "";
let GROUP_JID = process.env.GROUP_JID || "";
const PAIRING_NUMBER = (process.env.PAIRING_NUMBER || "").replace(/\D/g, "");
const AUTH_DIR = path.join(__dirname, "auth");
const LOG_FILE = path.join(__dirname, "tickets.log");

if (BOT_SECRET.length < 16) {
  console.error("[!] BOT_SECRET di .env wajib diisi minimal 16 karakter acak.");
  process.exit(1);
}

const logger = pino({ level: process.env.LOG_LEVEL || "warn" });
let sock = null;
let ready = false;
const queue = []; // tiket yang masuk saat bot sedang reconnect

// ---------------------------------------------------------------- WhatsApp
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    /* pakai versi bawaan */
  }

  sock = makeWASocket({
    auth: state,
    logger,
    version,
    browser: Browsers.ubuntu("MineIDHost Bot"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  if (PAIRING_NUMBER && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PAIRING_NUMBER);
        console.log(`\n[PAIRING] Buka WhatsApp di HP bot → Perangkat tertaut → Tautkan dengan nomor telepon → masukkan kode: ${code}\n`);
      } catch (e) {
        console.error("[PAIRING] Gagal meminta kode, pakai QR saja (hapus PAIRING_NUMBER).", e?.message);
      }
    }, 3000);
  }

  sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr && !PAIRING_NUMBER) {
      console.log("\n[QR] Scan QR ini dari WhatsApp nomor bot → Perangkat tertaut → Tautkan perangkat:\n");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      ready = true;
      console.log(`[OK] Bot WhatsApp terhubung sebagai ${sock.user?.id}`);
      if (!GROUP_JID) {
        console.log('[i] GROUP_JID belum diisi. Ketik "!idgrup" di grup admin untuk melihat ID grup.');
      }
      flushQueue();
    }
    if (connection === "close") {
      ready = false;
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.error("[!] Bot logout dari WhatsApp. Hapus folder auth/ lalu jalankan ulang untuk scan QR baru.");
        return;
      }
      console.warn(`[!] Koneksi terputus (kode ${code}). Menyambung ulang dalam 5 detik...`);
      setTimeout(start, 5000);
    }
  });

  // Perintah sederhana di grup
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      const jid = m.key.remoteJid || "";
      const text = (m.message?.conversation || m.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (!text.startsWith("!")) continue;
      if (text === "!idgrup" && jid.endsWith("@g.us")) {
        await sock.sendMessage(jid, { text: `ID grup ini:\n${jid}\n\nIsi di .env bot:\nGROUP_JID=${jid}` }, { quoted: m });
      } else if (text === "!ping") {
        await sock.sendMessage(jid, { text: `Bot tiket aktif ✅\nGrup tiket: ${GROUP_JID || "(belum diatur)"}` }, { quoted: m });
      }
    }
  });
}

function waLink(contact) {
  let d = String(contact).replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  if (d.startsWith("8")) d = "62" + d;
  return d.length >= 9 ? `https://wa.me/${d}` : "";
}

function formatTicket(t) {
  const isMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.contact);
  const link = isMail ? "" : waLink(t.contact);
  const time = new Date(t.time || Date.now()).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  return [
    `🎫 *TIKET BARU ${t.id}*`,
    `@semua ada pelanggan yang butuh bantuan.`,
    ``,
    `👤 *Nama:* ${t.name}`,
    `📱 *Kontak:* ${t.contact}${link ? `\n↪️ Balas: ${link}` : ""}`,
    `🕒 *Waktu:* ${time} WIB`,
    `🌐 *Halaman:* ${t.page || "-"}`,
    ``,
    `💬 *Pertanyaan:*`,
    t.message,
    t.transcript ? `\n📝 *Riwayat chat asisten:*\n${t.transcript}` : "",
  ].filter((x) => x !== undefined).join("\n").slice(0, 6000);
}

async function sendTicket(t) {
  if (!GROUP_JID) throw new Error("GROUP_JID belum diatur");
  const meta = await sock.groupMetadata(GROUP_JID);
  const me = (sock.user?.id || "").split(":")[0];
  const mentions = meta.participants
    .map((p) => p.id)
    .filter((id) => id && !id.startsWith(me + "@") && !id.startsWith(me + ":"));
  // "Hidetag": semua anggota di-mention (dapat notifikasi) tanpa menuliskan nomor satu per satu
  await sock.sendMessage(GROUP_JID, { text: formatTicket(t), mentions });
  fs.appendFile(LOG_FILE, JSON.stringify(t) + "\n", () => {});
}

async function flushQueue() {
  while (ready && queue.length) {
    const t = queue.shift();
    try {
      await sendTicket(t);
      console.log(`[OK] Tiket antrean ${t.id} terkirim`);
    } catch (e) {
      console.error(`[!] Tiket ${t.id} gagal:`, e.message);
      break;
    }
  }
}

// ---------------------------------------------------------------- HTTP server untuk menerima tiket
const recent = [];
const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (req.method === "GET" && req.url === "/health") {
    return send(200, { ok: true, whatsapp: ready, group: Boolean(GROUP_JID), queued: queue.length });
  }
  if (req.method !== "POST" || req.url !== "/ticket") return send(404, { ok: false });
  if (req.headers["x-bot-secret"] !== BOT_SECRET) return send(401, { ok: false, error: "secret" });

  // batas: maksimal 20 tiket per 10 menit
  const now = Date.now();
  while (recent.length && now - recent[0] > 10 * 60 * 1000) recent.shift();
  if (recent.length >= 20) return send(429, { ok: false, error: "rate" });

  let raw = "";
  for await (const c of req) {
    raw += c;
    if (raw.length > 20000) return send(413, { ok: false });
  }
  let t;
  try {
    t = JSON.parse(raw);
  } catch {
    return send(400, { ok: false });
  }
  if (!t || !t.id || !t.name || !t.contact || !t.message) return send(400, { ok: false, error: "data" });
  recent.push(now);

  if (!ready) {
    if (queue.length < 50) queue.push(t);
    console.warn(`[!] Bot belum terhubung, tiket ${t.id} masuk antrean`);
    return send(202, { ok: true, queued: true });
  }
  try {
    await sendTicket(t);
    console.log(`[OK] Tiket ${t.id} dikirim ke grup`);
    return send(200, { ok: true });
  } catch (e) {
    console.error(`[!] Gagal kirim tiket ${t.id}:`, e.message);
    return send(500, { ok: false, error: e.message });
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`[OK] Server tiket berjalan di port ${PORT} (POST /ticket, GET /health)`));
start().catch((e) => {
  console.error("[!] Gagal start bot:", e);
  process.exit(1);
});
