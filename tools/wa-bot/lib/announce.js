// Pengumuman untuk halaman mineidhost.com/status (data/announcements.json)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { cfg } from "./config.js";

const FILE = path.join(cfg.dataDir, "announcements.json");
export const TYPES = ["info", "maintenance", "gangguan", "selesai"];

let list = [];
try {
  if (fs.existsSync(FILE)) list = JSON.parse(fs.readFileSync(FILE, "utf8")).items || [];
} catch (e) {
  console.error("[!] announcements.json rusak, membuat baru.");
}

function save() {
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ items: list }));
  fs.renameSync(tmp, FILE);
}

const clip = (v, n) => String(v == null ? "" : v).replace(/\u0000/g, "").trim().slice(0, n);

// untuk publik: pengumuman aktif + yang sudah selesai dalam 3 hari terakhir
export function publicList() {
  const since = Date.now() - 3 * 864e5;
  return list
    .filter((a) => a.active || a.updatedAt > since)
    .sort((a, b) => (b.active - a.active) || (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt))
    .slice(0, 10)
    .map(({ id, type, title, body, nodes, by, createdAt, updatedAt, active, pinned }) =>
      ({ id, type, title, body, nodes, by, createdAt, updatedAt, active, pinned }));
}

export function adminList() {
  return list.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 100);
}

export function upsert(b, by) {
  const type = TYPES.includes(b.type) ? b.type : "info";
  const title = clip(b.title, 120);
  const body = clip(b.body, 2000);
  if (!title) return { ok: false, error: "Judul pengumuman wajib diisi." };
  const now = Date.now();
  let a = b.id && list.find((x) => x.id === b.id);
  if (a) {
    Object.assign(a, { type, title, body, nodes: clip(b.nodes, 200), active: b.active !== false, pinned: !!b.pinned, updatedAt: now, by });
  } else {
    a = { id: crypto.randomBytes(5).toString("hex"), type, title, body, nodes: clip(b.nodes, 200),
      active: b.active !== false, pinned: !!b.pinned, by, createdAt: now, updatedAt: now };
    list.push(a);
    if (list.length > 300) list = list.sort((x, y) => y.updatedAt - x.updatedAt).slice(0, 300);
  }
  // status "selesai" otomatis tidak aktif lagi (tetap tampil 3 hari sebagai riwayat)
  if (type === "selesai") a.active = false;
  save();
  return { ok: true, item: a };
}

export function remove(id) {
  const n = list.length;
  list = list.filter((a) => a.id !== id);
  if (list.length === n) return { ok: false, error: "Pengumuman tidak ditemukan." };
  save();
  return { ok: true };
}
