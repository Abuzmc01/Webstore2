/*
 * Data mitra penitipan mesin.
 *   GET  /api/mitra              -> data publik (tanpa data pribadi, Gmail disensor)
 *   POST /api/mitra {action:...} -> khusus admin (login, me, logout, list, save, delete)
 *
 * Data disimpan TERENKRIPSI (AES-256-GCM) di Upstash Redis (Vercel Storage), bukan di GitHub dan bukan di bot.
 *
 * Environment Variables di Vercel:
 *   KV_REST_API_URL + KV_REST_API_TOKEN   (otomatis saat Upstash Redis dihubungkan; UPSTASH_REDIS_REST_* juga didukung)
 *   MITRA_ADMIN_PASSWORD                  password halaman /admin-mitra (minimal 10 karakter)
 *   MITRA_SECRET                          kode acak minimal 32 karakter (kunci enkripsi + sesi). JANGAN diganti setelah dipakai.
 */
"use strict";
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEY = "mdh:mitra:v1";
const SESSION_HOURS = 12;

const env = (k) => String(process.env[k] || "").trim();
const REDIS_URL = () => env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL");
const REDIS_TOKEN = () => env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN");

function configError() {
  if (!REDIS_URL() || !REDIS_TOKEN()) return "Database belum dihubungkan (Upstash Redis di Vercel Storage).";
  if (env("MITRA_SECRET").length < 32) return "MITRA_SECRET belum diisi (minimal 32 karakter).";
  if (env("MITRA_ADMIN_PASSWORD").length < 10) return "MITRA_ADMIN_PASSWORD belum diisi (minimal 10 karakter).";
  return "";
}

async function redis(cmd) {
  const r = await fetch(REDIS_URL(), {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN(), "Content-Type": "application/json" },
    body: JSON.stringify(cmd)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Redis: " + (j.error || r.status));
  return j.result;
}

// ---------------------------------------------------------------- enkripsi
const encKey = () => crypto.createHash("sha256").update("enc:" + env("MITRA_SECRET")).digest();
function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString("base64");
}
function decrypt(s) {
  const b = Buffer.from(s, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", encKey(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8"));
}

// data awal (publik) dari file lama, dipakai sekali saat database masih kosong
function seed() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/assets/data/mitra-mesin.json"), "utf8"));
    return (j.mitra || []).map((m) => Object.assign({ id: "s" + crypto.createHash("sha256").update(m.nama + "|" + m.mulai).digest("hex").slice(0, 11), tampil: true }, m));
  } catch (e) {
    return [];
  }
}
async function load() {
  const raw = await redis(["GET", KEY]);
  if (!raw) return seed();
  return decrypt(raw);
}
async function store(list) {
  await redis(["SET", KEY, encrypt(list)]);
}

// ---------------------------------------------------------------- data publik
function sensor(e) {
  const m = /^([^@]*)@(.+)$/.exec(String(e || ""));
  if (!m) return "";
  return (m[1].replace(/\*+$/, "").slice(0, 3) || "*") + "***@" + m[2];
}
function publicView(list) {
  return list.filter((m) => m.tampil !== false).map((m) => ({
    nama: m.nama, gmail: sensor(m.gmail), mesin: m.mesin || [], node: m.node || [],
    nilai: m.nilai, bagiHasilMin: m.bagiHasilMin, bagiHasilMax: m.bagiHasilMax, bulan: m.bulan,
    mulai: m.mulai, berakhir: m.berakhir, bayar: m.bayar || "bulanan"
  }));
}

// ---------------------------------------------------------------- sesi admin (cookie bertanda tangan)
const sigKey = () => crypto.createHash("sha256").update("sess:" + env("MITRA_SECRET")).digest();
function makeToken(user) {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + SESSION_HOURS * 3600e3 })).toString("base64url");
  return payload + "." + crypto.createHmac("sha256", sigKey()).update(payload).digest("base64url");
}
function readToken(req) {
  const m = /(?:^|;\s*)mdh_mitra=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig) return null;
  const want = crypto.createHmac("sha256", sigKey()).update(payload).digest("base64url");
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return p.exp > Date.now() ? p : null;
  } catch (e) {
    return null;
  }
}
function setCookie(res, value, maxAge) {
  res.setHeader("Set-Cookie", `mdh_mitra=${value}; Path=/api/mitra; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}

// ---------------------------------------------------------------- validasi input admin
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const money = (v) => Math.max(0, Math.round(Number(String(v == null ? "" : v).replace(/[^\d]/g, "")) || 0));
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : "");
const list = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((s) => clip(s, 40)).filter(Boolean).slice(0, 20);
function clean(b) {
  const mesin = list(b.mesin);
  return {
    nama: clip(b.nama, 80),
    gmail: clip(b.gmail, 120).toLowerCase(),
    wa: clip(b.wa, 30),
    waKeluarga: clip(b.waKeluarga, 30),
    rekNama: clip(b.rekNama, 80),
    rekBank: clip(b.rekBank, 40),
    rekNomor: clip(b.rekNomor, 40),
    mesin,
    node: mesin.map((m) => m.toLowerCase().replace(/\s+/g, "-")),
    nilai: money(b.nilai),
    bagiHasilMin: money(b.bagiHasilMin),
    bagiHasilMax: money(b.bagiHasilMax),
    bulan: Math.min(120, money(b.bulan)),
    mulai: date(b.mulai),
    berakhir: date(b.berakhir),
    bayar: b.bayar === "5bulan" ? "5bulan" : "bulanan",
    catatan: clip(b.catatan, 1000),
    tampil: b.tampil !== false
  };
}

function send(res, code, obj, cache) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache || "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(JSON.parse(req.body || "{}"));
  return new Promise((ok, no) => {
    let s = "";
    req.on("data", (c) => { s += c; if (s.length > 100000) no(new Error("too large")); });
    req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { no(e); } });
    req.on("error", no);
  });
}

module.exports = async (req, res) => {
  const cfgErr = configError();

  // ----- publik
  if (req.method === "GET") {
    if (cfgErr) return send(res, 503, { ok: false, error: "belum dikonfigurasi" });
    try {
      return send(res, 200, { ok: true, mitra: publicView(await load()) }, "public, s-maxage=60, stale-while-revalidate=300");
    } catch (e) {
      return send(res, 502, { ok: false, error: "Gagal memuat data" });
    }
  }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "Method tidak didukung" });

  // ----- admin: hanya dari website sendiri
  const origin = req.headers.origin || "";
  if (origin && !/^https:\/\/(www\.)?mineidhost\.com$/.test(origin) && !/\.vercel\.app$/.test(origin)) {
    return send(res, 403, { ok: false, error: "origin" });
  }
  if (cfgErr) return send(res, 503, { ok: false, error: cfgErr });

  let b;
  try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Data tidak valid" }); }

  try {
    if (b.action === "login") {
      const ip = String(req.headers["x-forwarded-for"] || "?").split(",")[0].trim();
      const rk = "mdh:mitra:login:" + crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
      const n = await redis(["INCR", rk]);
      if (n === 1) await redis(["EXPIRE", rk, 900]);
      if (n > 6) return send(res, 429, { ok: false, error: "Terlalu banyak percobaan. Coba lagi 15 menit lagi." });
      const user = clip(b.user, 20) || "admin";
      const a = crypto.createHash("sha256").update(String(b.password || "")).digest();
      const w = crypto.createHash("sha256").update(env("MITRA_ADMIN_PASSWORD")).digest();
      if (!crypto.timingSafeEqual(a, w)) return send(res, 401, { ok: false, error: "Password salah." });
      await redis(["DEL", rk]);
      setCookie(res, makeToken(user), SESSION_HOURS * 3600);
      return send(res, 200, { ok: true, user });
    }

    const s = readToken(req);
    if (b.action === "logout") { setCookie(res, "", 0); return send(res, 200, { ok: true }); }
    if (!s) return send(res, 401, { ok: false, error: "Silakan login." });
    if (b.action === "me") return send(res, 200, { ok: true, user: s.u });

    const all = await load();
    if (b.action === "list") return send(res, 200, { ok: true, mitra: all });

    if (b.action === "save") {
      const d = clean(b.data || {});
      if (!d.nama) return send(res, 400, { ok: false, error: "Nama wajib diisi." });
      if (d.nilai && (d.nilai < 1500000 || d.nilai > 50000000)) return send(res, 400, { ok: false, error: "Nilai mesin harus antara Rp1.500.000 dan Rp50.000.000." });
      if (!d.mulai || !d.berakhir) return send(res, 400, { ok: false, error: "Tanggal mulai dan berakhir wajib diisi." });
      if (d.berakhir <= d.mulai) return send(res, 400, { ok: false, error: "Tanggal berakhir harus setelah tanggal mulai." });
      const now = Date.now();
      const i = all.findIndex((m) => m.id && m.id === b.id);
      if (i >= 0) all[i] = Object.assign(all[i], d, { diubah: now, diubahOleh: s.u });
      else all.push(Object.assign({ id: crypto.randomBytes(6).toString("hex"), dibuat: now, dibuatOleh: s.u }, d));
      await store(all);
      return send(res, 200, { ok: true, mitra: all });
    }

    if (b.action === "delete") {
      const next = all.filter((m) => m.id !== b.id);
      if (next.length === all.length) return send(res, 404, { ok: false, error: "Mitra tidak ditemukan." });
      await store(next);
      return send(res, 200, { ok: true, mitra: next });
    }

    return send(res, 400, { ok: false, error: "action" });
  } catch (e) {
    console.error("[mitra]", e.message);
    return send(res, 502, { ok: false, error: "Database tidak bisa dihubungi." });
  }
};
