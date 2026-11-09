// Penyimpanan tiket sederhana di file JSON (data/tickets.json)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { cfg } from "./config.js";

const FILE = path.join(cfg.dataDir, "tickets.json");
fs.mkdirSync(cfg.dataDir, { recursive: true });

let db = { tickets: {} };
try {
  if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch (e) {
  console.error("[!] tickets.json rusak, membuat baru. Salinan lama disimpan sebagai tickets.broken.json");
  try { fs.copyFileSync(FILE, FILE.replace(".json", ".broken.json")); } catch {}
}

let timer = null;
export function persist() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  }, 300);
}

function newId() {
  const d = new Date(Date.now() + 7 * 3600 * 1000); // WIB
  const p = (x) => String(x).padStart(2, "0");
  let id;
  do {
    id = `MDH-${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-` +
      crypto.randomBytes(3).toString("base64url").replace(/[-_]/g, "X").slice(0, 4).toUpperCase();
  } while (db.tickets[id]);
  return id;
}

export function createTicket(data) {
  const id = newId();
  const t = {
    id,
    token: crypto.randomBytes(24).toString("base64url"),
    status: "open", // open | confirming | closed
    name: data.name,
    email: data.email,
    whatsapp: data.whatsapp || "",
    page: data.page || "",
    ip: data.ip || "",
    assistant: data.transcript || "",
    created: Date.now(),
    updated: Date.now(),
    confirmAt: 0,
    closedAt: 0,
    closedBy: "",
    lastAdminRead: 0,
    mail: "",
    messages: [],
  };
  db.tickets[id] = t;
  addMessage(t, "user", data.name, data.message);
  return t;
}

export function getTicket(id) {
  return db.tickets[id] || null;
}

export function checkToken(t, token) {
  if (!t || typeof token !== "string") return false;
  const a = Buffer.from(t.token), b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function addMessage(t, from, name, text, extra) {
  const m = { i: t.messages.length + 1, from, name: String(name || "").slice(0, 40), text: String(text || "").slice(0, 2000), t: Date.now() };
  if (extra && extra.file) { m.kind = "image"; m.file = extra.file; }
  t.messages.push(m);
  t.updated = m.t;
  persist();
  return m;
}

export function listTickets() {
  return Object.values(db.tickets);
}

export function publicMessages(t, since = 0) {
  return t.messages.filter((m) => m.i > since);
}

// ---------------------------------------------------------------- foto
const UPLOAD_DIR = path.join(cfg.dataDir, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export function detectImage(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", type: "image/png" };
  if (buf.length > 12 && buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

export function saveUpload(t, buf, ext) {
  const dir = path.join(UPLOAD_DIR, t.id);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${t.messages.length + 1}-${crypto.randomBytes(5).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(dir, name), buf);
  return name;
}

export function uploadPath(t, file) {
  if (!/^[0-9]+-[0-9a-f]{10}\.(jpg|png|webp)$/.test(String(file))) return null;
  if (!t.messages.some((m) => m.file === file)) return null;
  const p = path.join(UPLOAD_DIR, t.id, file);
  return fs.existsSync(p) ? p : null;
}
