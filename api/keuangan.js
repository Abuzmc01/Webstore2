/*
 * Laporan keuangan internal MineIDHost: POST /api/keuangan
 * TIDAK ADA akses publik. Dua jalur masuk:
 *   - bot WhatsApp keuangan: header X-Fin-Secret = FIN_BOT_SECRET
 *   - halaman /admin-keuangan: login password FIN_ADMIN_PASSWORD (cookie bertanda tangan)
 *
 * Data disimpan TERENKRIPSI (AES-256-GCM) di Upstash Redis (Vercel Storage), bukan di GitHub.
 *
 * Environment Variables di Vercel:
 *   KV_REST_API_URL + KV_REST_API_TOKEN  (sudah ada dari Upstash)
 *   FIN_ADMIN_PASSWORD   password halaman /admin-keuangan (minimal 10 karakter)
 *   FIN_BOT_SECRET       kode acak minimal 24 karakter, sama dengan di .env bot keuangan
 *   FIN_SECRET           kode acak minimal 32 karakter untuk enkripsi. JANGAN diganti setelah dipakai.
 *   FIN_CUTOFF_DAY       opsional, tanggal tutup buku (default 28)
 */
"use strict";
const crypto = require("crypto");

const TX_KEY = "mdh:fin:tx";
const REPORT_KEY = "mdh:fin:reports";
const SESSION_HOURS = 12;

const env = (k) => String(process.env[k] || "").trim();
const REDIS_URL = () => env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL");
const REDIS_TOKEN = () => env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN");
const CUTOFF = () => Math.min(28, Math.max(1, Number(env("FIN_CUTOFF_DAY")) || 28));

// ---------------------------------------------------------------- kategori
const KATEGORI = {
  midtrans: { jenis: "masuk", label: "Withdraw Midtrans" },
  bisnis: { jenis: "masuk", label: "Dana bisnis / pemasukan lain" },
  cloud: { jenis: "keluar", label: "Akun cloud" },
  baremetal: { jenis: "keluar", label: "Baremetal" },
  endorse: { jenis: "keluar", label: "Endorse" },
  jasa: { jenis: "keluar", label: "Jasa developer" },
  talang_domain: { jenis: "keluar", label: "Dana talang: domain" },
  talang_lain: { jenis: "keluar", label: "Dana talang: lainnya" },
  lain: { jenis: "keluar", label: "Pengeluaran lainnya" }
};
const isTalang = (k) => k === "talang_domain" || k === "talang_lain";

function configError() {
  if (!REDIS_URL() || !REDIS_TOKEN()) return "Database belum dihubungkan (Upstash Redis di Vercel Storage).";
  if (env("FIN_SECRET").length < 32) return "FIN_SECRET belum diisi (minimal 32 karakter).";
  if (env("FIN_ADMIN_PASSWORD").length < 10) return "FIN_ADMIN_PASSWORD belum diisi (minimal 10 karakter).";
  if (env("FIN_BOT_SECRET").length < 24) return "FIN_BOT_SECRET belum diisi (minimal 24 karakter).";
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
const encKey = () => crypto.createHash("sha256").update("fin-enc:" + env("FIN_SECRET")).digest();
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

async function loadAll() {
  const r = (await redis(["HGETALL", TX_KEY])) || [];
  const out = [];
  for (let i = 0; i < r.length; i += 2) {
    try { out.push(decrypt(r[i + 1])); } catch (e) { console.error("[fin] gagal membaca", r[i]); }
  }
  return out.sort((a, b) => (b.tanggal + b.dibuat).localeCompare(a.tanggal + a.dibuat));
}
async function saveTx(t) { await redis(["HSET", TX_KEY, t.id, encrypt(t)]); }
async function getTx(id) {
  const raw = await redis(["HGET", TX_KEY, id]);
  return raw ? decrypt(raw) : null;
}

// ---------------------------------------------------------------- tanggal & periode (WIB)
function todayWIB() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
// periode diberi nama bulan penutupnya: cutoff 28 -> "2026-11" = 28 Okt s/d 27 Nov
function periodOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + (d >= CUTOFF() ? 1 : 0), 1));
  return dt.toISOString().slice(0, 7);
}
function periodRange(p) {
  const [y, m] = p.split("-").map(Number);
  const c = CUTOFF();
  const start = new Date(Date.UTC(y, m - 2, c)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m - 1, c - 1)).toISOString().slice(0, 10);
  return { start, end };
}
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function tglID(s) { const [y, m, d] = s.split("-").map(Number); return d + " " + BLN[m - 1] + " " + y; }
function periodLabel(p) { const r = periodRange(p); return tglID(r.start) + " – " + tglID(r.end); }

// ---------------------------------------------------------------- laporan
function report(all, p) {
  const { end } = periodRange(p);
  const inP = all.filter((t) => periodOf(t.tanggal) === p);
  const sum = (arr) => arr.reduce((s, t) => s + t.nominal, 0);
  const byKat = {};
  Object.keys(KATEGORI).forEach((k) => { byKat[k] = sum(inP.filter((t) => t.kategori === k)); });
  const pendapatan = byKat.midtrans + byKat.bisnis;
  const pengeluaran = sum(inP.filter((t) => t.jenis === "keluar"));
  const voucher = sum(inP.filter((t) => t.jenis === "keluar" && t.sumber === "voucher"));

  // saldo kumulatif sampai akhir periode
  const upto = all.filter((t) => t.tanggal <= end);
  const saldo = { midtrans: 0, bisnis: 0 };
  upto.forEach((t) => {
    if (t.kategori === "midtrans") saldo.midtrans += t.nominal;
    else if (t.kategori === "bisnis") saldo.bisnis += t.nominal;
    else if (isTalang(t.kategori)) {
      // dana talang memakai uang pribadi admin; saldo bisnis baru berkurang saat diganti (lunas)
      if (t.lunas && t.lunasTgl && t.lunasTgl <= end) saldo[t.lunasDari === "midtrans" ? "midtrans" : "bisnis"] -= t.nominal;
    } else if (t.sumber !== "voucher") saldo[t.sumber === "midtrans" ? "midtrans" : "bisnis"] -= t.nominal;
    // dibayar pakai refund voucher: tercatat sebagai pengeluaran, tapi tidak mengurangi kas
  });

  const talang = {};
  upto.filter((t) => isTalang(t.kategori) && !(t.lunas && t.lunasTgl && t.lunasTgl <= end)).forEach((t) => {
    talang[t.admin] = (talang[t.admin] || 0) + t.nominal;
  });

  return {
    periode: p,
    label: periodLabel(p),
    pendapatan, pengeluaran, bersih: pendapatan - pengeluaran, voucher,
    perKategori: byKat,
    saldo: Object.assign(saldo, { total: saldo.midtrans + saldo.bisnis }),
    talangBelumLunas: talang,
    talangTotal: Object.values(talang).reduce((a, b) => a + b, 0),
    jumlahTransaksi: inP.length
  };
}

function rp(n) { return (n < 0 ? "-Rp" : "Rp") + Math.abs(Math.round(n)).toLocaleString("id-ID"); }
function reportText(r) {
  const k = r.perKategori, L = [];
  L.push("📊 *LAPORAN KEUANGAN MINEIDHOST*");
  L.push("Periode " + r.label);
  L.push("");
  L.push("💰 *Pendapatan: " + rp(r.pendapatan) + "*");
  L.push("• Withdraw Midtrans: " + rp(k.midtrans));
  L.push("• Dana bisnis/lainnya: " + rp(k.bisnis));
  L.push("");
  L.push("💸 *Pengeluaran: " + rp(r.pengeluaran) + "*");
  ["cloud", "baremetal", "endorse", "jasa", "talang_domain", "talang_lain", "lain"].forEach((x) => {
    if (k[x]) L.push("• " + KATEGORI[x].label + ": " + rp(k[x]));
  });
  if (!r.pengeluaran) L.push("• (tidak ada)");
  if (r.voucher) L.push("  _(" + rp(r.voucher) + " dibayar pakai refund voucher, tidak mengurangi dana)_");
  L.push("");
  L.push((r.bersih >= 0 ? "✅" : "⚠️") + " *Bersih periode ini: " + rp(r.bersih) + "*");
  L.push("");
  L.push("🏦 *Total dana sampai " + tglID(periodRange(r.periode).end) + ": " + rp(r.saldo.total) + "*");
  L.push("• Sumber Midtrans: " + rp(r.saldo.midtrans));
  L.push("• Dana bisnis: " + rp(r.saldo.bisnis));
  if (r.talangTotal) {
    L.push("");
    L.push("🧾 *Dana talang belum diganti: " + rp(r.talangTotal) + "*");
    Object.keys(r.talangBelumLunas).forEach((a) => L.push("• " + a + ": " + rp(r.talangBelumLunas[a])));
  }
  return L.join("\n");
}

// ---------------------------------------------------------------- validasi transaksi
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
function newId() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (const b of crypto.randomBytes(6)) s += A[b % A.length];
  return s;
}
function cleanTx(b, oleh, via) {
  const kategori = String(b.kategori || "");
  if (!KATEGORI[kategori]) return { error: "Kategori tidak dikenal." };
  const nominal = Math.round(Number(b.nominal));
  if (!(nominal > 0 && nominal <= 1e11)) return { error: "Nominal tidak valid." };
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(b.tanggal || "")) ? String(b.tanggal) : todayWIB();
  if (isNaN(Date.parse(tanggal + "T00:00:00Z"))) return { error: "Tanggal tidak valid." };
  if (tanggal > new Date(Date.now() + 7 * 3600e3 + 3 * 864e5).toISOString().slice(0, 10)) return { error: "Tanggal tidak boleh di masa depan." };
  const t = {
    kategori,
    jenis: KATEGORI[kategori].jenis,
    nominal,
    tanggal,
    nama: clip(b.nama, 80),      // akun cloud / nama node / nama endorse / jenis jasa / domain
    tipe: clip(b.tipe, 60),      // tipe node baremetal / tipe domain
    ket: clip(b.ket, 300),
    sumber: kategori === "midtrans" ? "midtrans" : isTalang(kategori) ? "talang" : (b.sumber === "midtrans" || b.sumber === "voucher" ? b.sumber : "bisnis"),
    admin: clip(b.admin || oleh, 40) || "admin",
    via: via
  };
  if (kategori === "talang_domain") { t.nama = t.nama.toLowerCase(); if (!t.tipe) t.tipe = (t.nama.match(/\.[a-z.]+$/) || [""])[0]; }
  if (isTalang(kategori)) t.lunas = false;
  return { tx: t };
}

// ---------------------------------------------------------------- sesi admin web
const sigKey = () => crypto.createHash("sha256").update("fin-sess:" + env("FIN_SECRET")).digest();
function makeToken(user) {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + SESSION_HOURS * 3600e3 })).toString("base64url");
  return payload + "." + crypto.createHmac("sha256", sigKey()).update(payload).digest("base64url");
}
function readToken(req) {
  const m = /(?:^|;\s*)mdh_fin=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig) return null;
  const want = crypto.createHmac("sha256", sigKey()).update(payload).digest("base64url");
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}
function setCookie(res, value, maxAge) {
  res.setHeader("Set-Cookie", `mdh_fin=${value}; Path=/api/keuangan; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}
function safeEq(a, b) {
  const x = crypto.createHash("sha256").update(String(a || "")).digest();
  const y = crypto.createHash("sha256").update(String(b || "")).digest();
  return crypto.timingSafeEqual(x, y);
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
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

// ---------------------------------------------------------------- aksi bersama (bot & web)
async function doLunas(id, oleh, dari, batal) {
  const t = await getTx(String(id || "").toUpperCase());
  if (!t) return [404, { ok: false, error: "Transaksi " + id + " tidak ditemukan." }];
  if (!isTalang(t.kategori)) return [400, { ok: false, error: "Transaksi " + t.id + " bukan dana talang." }];
  if (batal) { t.lunas = false; delete t.lunasTgl; delete t.lunasOleh; delete t.lunasDari; }
  else {
    if (t.lunas) return [400, { ok: false, error: "Dana talang " + t.id + " sudah lunas sejak " + tglID(t.lunasTgl) + "." }];
    Object.assign(t, { lunas: true, lunasTgl: todayWIB(), lunasOleh: oleh, lunasDari: dari === "midtrans" ? "midtrans" : "bisnis" });
  }
  t.diubah = Date.now();
  await saveTx(t);
  return [200, { ok: true, tx: t }];
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 404, { ok: false });
  const cfgErr = configError();

  const botHeader = req.headers["x-fin-secret"];
  const isBot = !!botHeader && !cfgErr && safeEq(botHeader, env("FIN_BOT_SECRET"));
  if (botHeader && !isBot) return send(res, cfgErr ? 503 : 401, { ok: false, error: cfgErr || "FIN_BOT_SECRET berbeda antara Vercel dan bot." });

  if (!isBot) {
    const origin = req.headers.origin || "";
    if (origin && !/^https:\/\/(www\.)?mineidhost\.com$/.test(origin) && !/\.vercel\.app$/.test(origin)) return send(res, 403, { ok: false, error: "origin" });
  }
  if (cfgErr) return send(res, 503, { ok: false, error: cfgErr });

  let b;
  try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Data tidak valid" }); }

  try {
    // ---------------- login web
    if (!isBot && b.action === "login") {
      const ip = String(req.headers["x-forwarded-for"] || "?").split(",")[0].trim();
      const rk = "mdh:fin:login:" + crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
      const n = await redis(["INCR", rk]);
      if (n === 1) await redis(["EXPIRE", rk, 900]);
      if (n > 6) return send(res, 429, { ok: false, error: "Terlalu banyak percobaan. Coba lagi 15 menit lagi." });
      if (!safeEq(b.password, env("FIN_ADMIN_PASSWORD"))) return send(res, 401, { ok: false, error: "Password salah." });
      await redis(["DEL", rk]);
      const user = clip(b.user, 20) || "admin";
      setCookie(res, makeToken(user), SESSION_HOURS * 3600);
      return send(res, 200, { ok: true, user });
    }
    if (!isBot && b.action === "logout") { setCookie(res, "", 0); return send(res, 200, { ok: true }); }

    let oleh;
    if (isBot) oleh = clip(b.oleh, 40) || "bot";
    else {
      const s = readToken(req);
      if (!s) return send(res, 401, { ok: false, error: "Silakan login." });
      oleh = s.u;
      if (b.action === "me") return send(res, 200, { ok: true, user: s.u });
    }
    const via = isBot ? "bot" : "web";

    switch (b.action) {
      case "add": {
        const c = cleanTx(b.tx || {}, oleh, via);
        if (c.error) return send(res, 400, { ok: false, error: c.error });
        // kunci = ID pesan WhatsApp; kalau bot mengirim ulang, jangan dicatat dua kali
        const kunci = isBot && b.kunci ? "mdh:fin:kunci:" + crypto.createHash("sha256").update(String(b.kunci)).digest("hex").slice(0, 32) : "";
        if (kunci) {
          const prev = await redis(["GET", kunci]);
          const old = prev && (await getTx(prev));
          if (old) return send(res, 200, { ok: true, tx: old, label: KATEGORI[old.kategori].label, periode: periodLabel(periodOf(old.tanggal)), duplikat: true });
        }
        let id;
        for (let i = 0; i < 5; i++) { id = newId(); if (!(await redis(["HEXISTS", TX_KEY, id]))) break; }
        const t = Object.assign({ id }, c.tx, { dibuat: Date.now(), oleh });
        await saveTx(t);
        if (kunci) await redis(["SET", kunci, id, "EX", 1209600]);
        return send(res, 200, { ok: true, tx: t, label: KATEGORI[t.kategori].label, periode: periodLabel(periodOf(t.tanggal)) });
      }
      case "update": {
        if (isBot) return send(res, 403, { ok: false, error: "Ubah data lewat halaman admin." });
        const old = await getTx(String(b.id || ""));
        if (!old) return send(res, 404, { ok: false, error: "Transaksi tidak ditemukan." });
        const c = cleanTx(b.tx || {}, old.admin, old.via);
        if (c.error) return send(res, 400, { ok: false, error: c.error });
        const t = Object.assign({}, old, c.tx, { diubah: Date.now(), diubahOleh: oleh });
        if (!isTalang(t.kategori)) { delete t.lunas; delete t.lunasTgl; delete t.lunasOleh; delete t.lunasDari; }
        else if (old.lunas && isTalang(old.kategori)) t.lunas = true;
        await saveTx(t);
        return send(res, 200, { ok: true, tx: t });
      }
      case "hapus": {
        const id = String(b.id || "").toUpperCase();
        const t = await getTx(id);
        if (!t) return send(res, 404, { ok: false, error: "Transaksi " + id + " tidak ditemukan." });
        await redis(["HDEL", TX_KEY, id]);
        return send(res, 200, { ok: true, tx: t });
      }
      case "lunas":
      case "batal_lunas": {
        const [code, out] = await doLunas(b.id, oleh, b.dari, b.action === "batal_lunas");
        return send(res, code, out);
      }
      case "rekap":
      case "tutup": {
        const p = /^\d{4}-\d{2}$/.test(String(b.periode || "")) ? b.periode : periodOf(todayWIB());
        const all = await loadAll();
        const r = report(all, p);
        if (b.action === "tutup") {
          r.ditutup = Date.now();
          await redis(["HSET", REPORT_KEY, p, encrypt(r)]);
        }
        return send(res, 200, { ok: true, report: r, text: reportText(r) });
      }
      case "terakhir": {
        const all = await loadAll();
        return send(res, 200, { ok: true, tx: all.slice(0, Math.min(20, Number(b.n) || 10)) });
      }
      case "talang": {
        const all = await loadAll();
        return send(res, 200, { ok: true, tx: all.filter((t) => isTalang(t.kategori) && !t.lunas) });
      }
      case "data": {
        if (isBot) return send(res, 403, { ok: false });
        const all = await loadAll();
        const now = periodOf(todayWIB());
        const p = /^\d{4}-\d{2}$/.test(String(b.periode || "")) ? b.periode : now;
        const periods = Array.from(new Set(all.map((t) => periodOf(t.tanggal)).concat([now]))).sort().reverse();
        const raw = (await redis(["HGETALL", REPORT_KEY])) || [];
        const closed = [];
        for (let i = 0; i < raw.length; i += 2) closed.push(raw[i]);
        return send(res, 200, {
          ok: true, tx: all, report: report(all, p), periods: periods.map((x) => ({ id: x, label: periodLabel(x), ditutup: closed.includes(x) })),
          kategori: KATEGORI, cutoff: CUTOFF()
        });
      }
      default:
        return send(res, 400, { ok: false, error: "action" });
    }
  } catch (e) {
    console.error("[fin]", e.message);
    return send(res, 502, { ok: false, error: "Database tidak bisa dihubungi." });
  }
};

module.exports._test = { periodOf, periodRange, report, reportText };
