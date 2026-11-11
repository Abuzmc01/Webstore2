// Membaca konfigurasi dari .env (tanpa dependency tambahan)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const e = process.env;
export const cfg = {
  siteUrl: (e.SITE_URL || "https://mineidhost.com").replace(/\/$/, ""),
  botSecret: (e.FIN_BOT_SECRET || "").trim(),
  pairingNumber: (e.PAIRING_NUMBER || "").replace(/\D/g, ""),
  groupJid: (e.FIN_GROUP_JID || "").trim(),
  cutoff: Math.min(28, Math.max(1, Number(e.CUTOFF_DAY) || 28)),
  // jam kirim rekap, format HH:MM (WIB)
  reportTime: /^\d{1,2}:\d{2}$/.test(e.REPORT_TIME || "") ? e.REPORT_TIME : "23:29",
  pollSeconds: Math.max(10, Number(e.POLL_SECONDS) || 20),
  dataDir: path.join(ROOT, "data"),
  authDir: path.join(ROOT, "auth"),
  logLevel: e.LOG_LEVEL || "warn",
  disableWhatsApp: e.DISABLE_WHATSAPP === "1"
};

export function checkConfig() {
  if (cfg.botSecret.length < 24) {
    console.error("[!] FIN_BOT_SECRET wajib diisi (minimal 24 karakter, sama dengan di Vercel).");
    process.exit(1);
  }
  if (!cfg.groupJid) console.warn('[i] FIN_GROUP_JID belum diisi. Ketik "!idgrup" di grup keuangan, salin ke .env, lalu restart.');
}
