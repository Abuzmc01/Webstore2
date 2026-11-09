// Koneksi WhatsApp (Baileys) untuk notifikasi ke grup admin
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { cfg } from "./config.js";

let sock = null;
let ready = false;
const queue = [];

export const wa = {
  get ready() { return ready; },
  get group() { return cfg.groupJid; },
};

export async function startWhatsApp() {
  if (cfg.disableWhatsApp) {
    console.log("[i] DISABLE_WHATSAPP=1, notifikasi WhatsApp dimatikan (mode uji).");
    return;
  }
  const { state, saveCreds } = await useMultiFileAuthState(cfg.authDir);
  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch { /* pakai bawaan */ }

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: cfg.logLevel }),
    version,
    // Nama browser harus dikenali WhatsApp (Chrome), kalau tidak login kode pairing selalu ditolak
    browser: Browsers.macOS("Chrome"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  sock.ev.on("creds.update", saveCreds);

  let pairingAsked = false;

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr && cfg.pairingNumber && !state.creds.registered) {
      // minta kode pairing saat socket sudah siap (event qr pertama), cukup sekali per start
      if (!pairingAsked) {
        pairingAsked = true;
        sock.requestPairingCode(cfg.pairingNumber).then((code) => {
          const c = String(code).match(/.{1,4}/g).join("-");
          console.log(`\n[PAIRING] Kode untuk ${cfg.pairingNumber}: ${c}`);
          console.log("[PAIRING] HP nomor bot → WhatsApp → Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon saja → masukkan kode.");
          console.log("[PAIRING] Kode berlaku sekitar 1 menit. Kalau gagal, hapus folder auth/ lalu Restart.\n");
        }).catch((e) => {
          console.error("[PAIRING] Gagal meminta kode:", e?.message, "→ kosongkan PAIRING_NUMBER untuk memakai QR.");
        });
      }
    } else if (qr) {
      console.log("\n[QR] Scan dari WhatsApp nomor bot → Perangkat tertaut → Tautkan perangkat:\n");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      ready = true;
      console.log(`[OK] WhatsApp terhubung sebagai ${sock.user?.id}`);
      if (!cfg.groupJid) console.log('[i] GROUP_JID belum diisi. Ketik "!idgrup" di grup admin.');
      flush();
    }
    if (connection === "close") {
      ready = false;
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.error("[!] WhatsApp logout. Hapus folder auth/ lalu jalankan ulang untuk scan QR baru.");
        return;
      }
      console.warn(`[!] WhatsApp terputus (kode ${code}). Menyambung ulang dalam 5 detik...`);
      setTimeout(() => startWhatsApp().catch((e) => console.error(e)), 5000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      const jid = m.key.remoteJid || "";
      const text = (m.message?.conversation || m.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (text === "!idgrup" && jid.endsWith("@g.us")) {
        await sock.sendMessage(jid, { text: `ID grup ini:\n${jid}\n\nIsi di .env bot:\nGROUP_JID=${jid}` }, { quoted: m });
      } else if (text === "!ping") {
        await sock.sendMessage(jid, { text: `Bot live chat aktif ✅\nGrup notifikasi: ${cfg.groupJid || "(belum diatur)"}\nAdmin chat: ${cfg.siteUrl}/admin-chat` }, { quoted: m });
      }
    }
  });
}

async function send(text, tagAll) {
  if (!cfg.groupJid) throw new Error("GROUP_JID belum diatur");
  let mentions = [];
  if (tagAll) {
    const meta = await sock.groupMetadata(cfg.groupJid);
    const me = (sock.user?.id || "").split(":")[0].split("@")[0];
    mentions = meta.participants.map((p) => p.id).filter((id) => id && !id.startsWith(me + "@") && !id.startsWith(me + ":"));
  }
  // Mention tersembunyi: semua anggota mendapat notifikasi tanpa menuliskan nomor satu per satu
  await sock.sendMessage(cfg.groupJid, { text: text.slice(0, 6000), mentions });
}

async function flush() {
  while (ready && queue.length) {
    const job = queue[0];
    try { await send(job.text, job.tagAll); queue.shift(); }
    catch (e) { console.error("[!] Notifikasi WhatsApp gagal:", e.message); break; }
  }
}

// Kirim notifikasi ke grup; kalau WhatsApp sedang putus, masuk antrean
export function notifyGroup(text, tagAll = false) {
  if (cfg.disableWhatsApp) { console.log("[WA-UJI]" + (tagAll ? " (tag semua)" : "") + "\n" + text); return; }
  if (queue.length < 100) queue.push({ text, tagAll });
  flush();
}
