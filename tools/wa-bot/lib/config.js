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
  port: Number(e.SERVER_PORT || e.PORT || 3000), // SERVER_PORT otomatis di Pterodactyl
  botSecret: e.BOT_SECRET || "",
  adminPassword: e.ADMIN_PASSWORD || "",
  groupJid: e.GROUP_JID || "",
  pairingNumber: (e.PAIRING_NUMBER || "").replace(/\D/g, ""),
  siteUrl: (e.SITE_URL || "https://mineidhost.com").replace(/\/$/, ""),
  supportEmail: e.SUPPORT_EMAIL || "mineidhost@gmail.com",
  gmailUser: e.GMAIL_USER || "",
  gmailAppPassword: (e.GMAIL_APP_PASSWORD || "").replace(/\s+/g, ""),
  smtpHost: e.SMTP_HOST || "", // opsional, untuk selain Gmail / pengujian
  smtpPort: Number(e.SMTP_PORT || 465),
  trustpilotUrl: e.TRUSTPILOT_URL || "https://www.trustpilot.com/evaluate/mineidhost.com",
  confirmTimeoutMin: Number(e.CONFIRM_TIMEOUT_MINUTES || 30),
  dataDir: path.join(ROOT, "data"),
  authDir: path.join(ROOT, "auth"),
  logLevel: e.LOG_LEVEL || "warn",
  disableWhatsApp: e.DISABLE_WHATSAPP === "1", // untuk pengujian tanpa WhatsApp
};

export function checkConfig() {
  const errs = [];
  if (cfg.botSecret.length < 16) errs.push("BOT_SECRET wajib diisi minimal 16 karakter acak.");
  if (cfg.adminPassword.length < 8) errs.push("ADMIN_PASSWORD wajib diisi minimal 8 karakter (password halaman admin chat).");
  if (!cfg.gmailUser || !cfg.gmailAppPassword) console.warn("[i] GMAIL_USER / GMAIL_APP_PASSWORD belum diisi: transkrip email tidak akan dikirim.");
  if (errs.length) {
    errs.forEach((x) => console.error("[!] " + x));
    process.exit(1);
  }
}
