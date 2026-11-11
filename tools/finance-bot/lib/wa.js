// Koneksi WhatsApp (Baileys) untuk bot keuangan
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

export const wa = { get ready() { return ready; } };

export async function startWhatsApp(onMessage) {
  if (cfg.disableWhatsApp) {
    console.log("[i] DISABLE_WHATSAPP=1 (mode uji).");
    return;
  }
  const { state, saveCreds } = await useMultiFileAuthState(cfg.authDir);
  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch { /* pakai bawaan */ }

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: cfg.logLevel }),
    version,
    browser: Browsers.macOS("Chrome"), // harus nama yang dikenali WhatsApp, kalau tidak kode pairing ditolak
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  sock.ev.on("creds.update", saveCreds);

  let pairingAsked = false;
  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr && cfg.pairingNumber && !state.creds.registered) {
      if (!pairingAsked) {
        pairingAsked = true;
        sock.requestPairingCode(cfg.pairingNumber).then((code) => {
          const c = String(code).match(/.{1,4}/g).join("-");
          console.log(`\n[PAIRING] Kode untuk ${cfg.pairingNumber}: ${c}`);
          console.log("[PAIRING] HP nomor bot → WhatsApp → Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon saja → masukkan kode.");
          console.log("[PAIRING] Kode berlaku sekitar 1 menit. Kalau gagal, hapus folder auth/ lalu Restart.\n");
        }).catch((e) => console.error("[PAIRING] Gagal meminta kode:", e?.message, "→ kosongkan PAIRING_NUMBER untuk memakai QR."));
      }
    } else if (qr) {
      console.log("\n[QR] Scan dari WhatsApp nomor bot → Perangkat tertaut → Tautkan perangkat:\n");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      ready = true;
      console.log(`[OK] WhatsApp terhubung sebagai ${sock.user?.id}`);
      flush();
    }
    if (connection === "close") {
      ready = false;
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.error("[!] WhatsApp logout. Hapus folder auth/ lalu jalankan ulang untuk login baru.");
        return;
      }
      console.warn(`[!] WhatsApp terputus (kode ${code}). Menyambung ulang dalam 5 detik...`);
      setTimeout(() => startWhatsApp(onMessage).catch((e) => console.error(e)), 5000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      if (m.key.fromMe) continue;
      const text = (m.message?.conversation || m.message?.extendedTextMessage?.text || "").trim();
      if (!text || !/^[!/.]/.test(text)) continue;
      const jid = m.key.remoteJid || "";
      const ids = [m.key.participant, m.key.participantAlt, m.key.participantPn, m.key.senderPn, m.key.remoteJidAlt, jid.endsWith("@g.us") ? null : jid]
        .filter(Boolean).map((x) => String(x).split("@")[0].split(":")[0]);
      const reply = (t) => sock.sendMessage(jid, { text: t.slice(0, 6000) }, { quoted: m });
      try {
        await onMessage({ text, jid, isGroup: jid.endsWith("@g.us"), ids: Array.from(new Set(ids)), pushName: m.pushName || "", msgId: m.key.id, reply });
      } catch (e) {
        console.error("[!] Gagal memproses pesan:", e);
        await reply("⚠️ Terjadi kesalahan di bot. Coba lagi sebentar.").catch(() => {});
      }
    }
  });
}

async function flush() {
  while (ready && queue.length) {
    const job = queue[0];
    try { await sock.sendMessage(job.jid, { text: job.text.slice(0, 6000) }); queue.shift(); }
    catch (e) { console.error("[!] Kirim pesan gagal:", e.message); break; }
  }
}

export function sendTo(jid, text) {
  if (cfg.disableWhatsApp) { console.log("[WA-UJI → " + jid + "]\n" + text); return; }
  if (!jid) return;
  if (queue.length < 50) queue.push({ jid, text });
  flush();
}
