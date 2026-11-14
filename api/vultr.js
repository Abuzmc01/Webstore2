/*
 * Admin VPS Vultr MineIDHost: POST /api/vultr  (halaman /admin-vultr)
 * Membuat & mengelola VPS di BEBERAPA akun Vultr milik mitra (masing-masing API key sendiri).
 * TIDAK ADA akses publik: login password VULTR_ADMIN_PASSWORD, cookie bertanda tangan.
 * API key mitra & password root VPS disimpan TERENKRIPSI (AES-256-GCM) di Upstash, tidak pernah dikirim ke browser.
 *
 * Environment Variables (Vercel):
 *   VULTR_ADMIN_PASSWORD  password halaman /admin-vultr (minimal 10 karakter)
 *   VULTR_SECRET          kode acak minimal 32 karakter (kunci enkripsi). JANGAN diganti setelah dipakai.
 *   KV_REST_API_URL / KV_REST_API_TOKEN (sudah ada, Upstash)
 *
 * Catatan untuk mitra: di Vultr → Account → API → Access Control, izinkan "Any IPv4" (dan IPv6),
 * karena server Vercel tidak punya IP tetap.
 */
"use strict";
const crypto = require("crypto");

const ACC_KEY = "mdh:vultr:accounts";
const PW_KEY = "mdh:vultr:pw";
const LOG_KEY = "mdh:vultr:log";
const CAT_KEY = "mdh:vultr:catalog:v2";
const SESSION_HOURS = 12;
const VULTR = "https://api.vultr.com/v2";

const env = (k) => String(process.env[k] || "").trim();
const REDIS_URL = () => env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL");
const REDIS_TOKEN = () => env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN");

function configError() {
  if (!REDIS_URL() || !REDIS_TOKEN()) return "Database belum dihubungkan (Upstash Redis di Vercel Storage).";
  if (env("VULTR_SECRET").length < 32) return "VULTR_SECRET belum diisi (minimal 32 karakter).";
  if (env("VULTR_ADMIN_PASSWORD").length < 10) return "VULTR_ADMIN_PASSWORD belum diisi (minimal 10 karakter).";
  return "";
}

async function redis(cmd) {
  const r = await fetch(REDIS_URL(), { method: "POST", headers: { Authorization: "Bearer " + REDIS_TOKEN(), "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Redis: " + (j.error || r.status));
  return j.result;
}

// ---------------------------------------------------------------- enkripsi
const encKey = () => crypto.createHash("sha256").update("vultr-enc:" + env("VULTR_SECRET")).digest();
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

// ---------------------------------------------------------------- Vultr API
async function vultr(key, method, path, body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  let r;
  try {
    r = await fetch(VULTR + path, {
      method,
      headers: Object.assign({ "Content-Type": "application/json" }, key ? { Authorization: "Bearer " + key } : {}),
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal
    });
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "Vultr tidak menjawab (timeout)." : "Vultr tidak bisa dihubungi.");
  } finally { clearTimeout(t); }
  if (r.status === 204) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    let msg = j.error || ("HTTP " + r.status);
    if (r.status === 401 && /ip/i.test(msg)) msg = "IP ditolak. Mitra perlu mengizinkan \"Any IPv4/IPv6\" di Vultr → Account → API → Access Control.";
    else if (r.status === 401) msg = "API key ditolak (salah, dihapus, atau API belum diaktifkan di akun itu).";
    else if (/locked/i.test(msg)) msg = "VPS sedang dikunci Vultr karena masih ada proses berjalan (baru dibuat/instalasi OS, reinstall, atau aksi lain). Tunggu ±5 menit, klik Muat ulang, lalu coba lagi. Kalau lebih dari 30 menit masih terkunci, cek di dashboard Vultr atau hubungi support Vultr.";
    const e = new Error(msg); e.status = r.status; throw e;
  }
  return j;
}
async function vultrAll(key, path, field) {
  const out = [];
  let cursor = "";
  for (let i = 0; i < 20; i++) {
    const j = await vultr(key, "GET", path + (path.includes("?") ? "&" : "?") + "per_page=500" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""));
    (j[field] || []).forEach((x) => out.push(x));
    cursor = j.meta && j.meta.links && j.meta.links.next;
    if (!cursor) break;
  }
  return out;
}

// ---------------------------------------------------------------- akun mitra
async function accounts() {
  const raw = (await redis(["HGETALL", ACC_KEY])) || [];
  const out = [];
  for (let i = 0; i < raw.length; i += 2) { try { out.push(decrypt(raw[i + 1])); } catch (e) { /* lewati */ } }
  return out.sort((a, b) => a.nama.localeCompare(b.nama));
}
async function account(id) {
  const raw = await redis(["HGET", ACC_KEY, String(id || "")]);
  return raw ? decrypt(raw) : null;
}
const safeAcc = (a) => ({ id: a.id, nama: a.nama, mitra: a.mitra || "", catatan: a.catatan || "", aktif: a.aktif !== false, keyAkhir: a.apiKey.slice(-4), dibuat: a.dibuat, creditAwal: Number(a.creditAwal) || 0, tanggal: a.tanggal || "" });
const r2 = (n) => Math.round(n * 100) / 100;

// Hitungan credit sama seperti spreadsheet "Data Akun Vultr" (BUKAN tagihan per jam Vultr):
//   Credit Awal     = diisi manual per akun (misal $305)
//   Credit Terpakai = jumlah Biaya/Bulan PENUH semua server di akun itu (harga bulanan plan Vultr, misal $96)
//   Sisa Credit     = Credit Awal - Credit Terpakai
async function accountInfo(a) {
  try {
    const [j, list, cat] = await Promise.all([vultr(a.apiKey, "GET", "/account"), vultrAll(a.apiKey, "/instances", "instances"), catalog()]);
    const acc = j.account || {};
    const price = {};
    cat.plans.forEach((p) => { price[p.id] = p.bulanan; });
    const terpakai = r2(list.reduce((s, v) => s + (price[v.plan] || 0), 0));
    const awal = Number(a.creditAwal) || 0;
    return {
      ok: true, email: acc.email || "", creditAwal: awal, terpakai, kredit: r2(awal - terpakai), jumlahServer: list.length,
      server: list.map((v) => ({ label: v.label, plan: v.plan, biaya: price[v.plan] || 0 })),
      tanpaHarga: list.filter((v) => !(v.plan in price)).map((v) => v.plan)
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ---------------------------------------------------------------- katalog
// merek processor: dari data Vultr (cpu_vendor) kalau ada, kalau tidak dari ID plan ("...-amd", "...-intel")
function cpuVendor(p) {
  const v = String(p.cpu_vendor || "").toLowerCase();
  if (v.includes("amd")) return "AMD";
  if (v.includes("intel")) return "Intel";
  const id = String(p.id).toLowerCase();
  if (/(^|-)amd($|-)/.test(id)) return "AMD";
  if (/(^|-)intel($|-)/.test(id)) return "Intel";
  if (/^(vc2|vhf)-/.test(id)) return "Intel";
  return "Lainnya";
}
// katalog publik di Vultr, di-cache 6 jam
async function catalog(force) {
  if (!force) {
    const c = await redis(["GET", CAT_KEY]);
    if (c) return JSON.parse(c);
  }
  const [regions, plans, os] = await Promise.all([
    vultrAll(null, "/regions", "regions"),
    vultrAll(null, "/plans", "plans"),
    vultrAll(null, "/os", "os")
  ]);
  const cat = {
    regions: regions.map((r) => ({ id: r.id, kota: r.city, negara: r.country, benua: r.continent })),
    plans: plans.filter((p) => p.monthly_cost > 0).map((p) => ({ id: p.id, tipe: p.type, cpu: cpuVendor(p), vcpu: p.vcpu_count, ram: p.ram, disk: p.disk, diskCount: p.disk_count, bw: p.bandwidth, bulanan: p.monthly_cost, jam: p.hourly_cost, lokasi: p.locations })),
    os: os.filter((o) => o.family !== "iso" && o.family !== "snapshot" && o.family !== "backup" && o.family !== "application").map((o) => ({ id: o.id, nama: o.name, arch: o.arch, family: o.family })),
    waktu: Date.now()
  };
  await redis(["SET", CAT_KEY, JSON.stringify(cat), "EX", 21600]);
  return cat;
}

// ---------------------------------------------------------------- daftar VPS
function slimInstance(v, acc) {
  return {
    id: v.id, akun: acc.id, akunNama: acc.nama, label: v.label, hostname: v.hostname, ip: v.main_ip, ipv6: v.v6_main_ip,
    region: v.region, plan: v.plan, os: v.os, osId: v.os_id, vcpu: v.vcpu_count, ram: v.ram, disk: v.disk,
    status: v.status, power: v.power_status, server: v.server_status, dibuat: v.date_created, tag: (v.tags || []).join(", ")
  };
}
async function instancesOf(a) {
  const list = await vultrAll(a.apiKey, "/instances", "instances");
  return list.map((v) => slimInstance(v, a));
}

// ---------------------------------------------------------------- log aktivitas
async function log(oleh, aksi, detail) {
  try {
    await redis(["LPUSH", LOG_KEY, encrypt({ waktu: Date.now(), oleh, aksi, detail })]);
    await redis(["LTRIM", LOG_KEY, 0, 499]);
  } catch (e) { /* log tidak boleh menggagalkan aksi */ }
}

// ---------------------------------------------------------------- sesi admin
const sigKey = () => crypto.createHash("sha256").update("vultr-sess:" + env("VULTR_SECRET")).digest();
function makeToken(user) {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + SESSION_HOURS * 3600e3 })).toString("base64url");
  return payload + "." + crypto.createHmac("sha256", sigKey()).update(payload).digest("base64url");
}
function readToken(req) {
  const m = /(?:^|;\s*)mdh_vultr=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig) return null;
  const want = crypto.createHmac("sha256", sigKey()).update(payload).digest("base64url");
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try { const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
}
function setCookie(res, value, maxAge) {
  res.setHeader("Set-Cookie", `mdh_vultr=${value}; Path=/api/vultr; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}
function safeEq(a, b) {
  return crypto.timingSafeEqual(crypto.createHash("sha256").update(String(a || "")).digest(), crypto.createHash("sha256").update(String(b || "")).digest());
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
const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const HOST_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;

// ---------------------------------------------------------------- handler
module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 404, { ok: false });
  const origin = req.headers.origin || "";
  if (origin && !/^https:\/\/(www\.)?mineidhost\.com$/.test(origin) && !/\.vercel\.app$/.test(origin)) return send(res, 403, { ok: false, error: "origin" });
  const cfgErr = configError();
  if (cfgErr) return send(res, 503, { ok: false, error: cfgErr });

  let b;
  try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Data tidak valid" }); }

  try {
    if (b.action === "login") {
      const ip = String(req.headers["x-forwarded-for"] || "?").split(",")[0].trim();
      const rk = "mdh:vultr:login:" + crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
      const n = await redis(["INCR", rk]);
      if (n === 1) await redis(["EXPIRE", rk, 900]);
      if (n > 6) return send(res, 429, { ok: false, error: "Terlalu banyak percobaan. Coba lagi 15 menit lagi." });
      if (!safeEq(b.password, env("VULTR_ADMIN_PASSWORD"))) return send(res, 401, { ok: false, error: "Password salah." });
      await redis(["DEL", rk]);
      const user = clip(b.user, 20) || "admin";
      setCookie(res, makeToken(user), SESSION_HOURS * 3600);
      return send(res, 200, { ok: true, user });
    }
    if (b.action === "logout") { setCookie(res, "", 0); return send(res, 200, { ok: true }); }
    const s = readToken(req);
    if (!s) return send(res, 401, { ok: false, error: "Silakan login." });
    const oleh = s.u;

    switch (b.action) {
      case "me": return send(res, 200, { ok: true, user: oleh });

      // ---------- akun mitra
      case "accounts": {
        const all = await accounts();
        const info = await Promise.all(all.map((a) => (a.aktif !== false ? accountInfo(a) : Promise.resolve({ ok: false, error: "nonaktif" }))));
        return send(res, 200, { ok: true, accounts: all.map((a, i) => Object.assign(safeAcc(a), { info: info[i] })) });
      }
      case "account_save": {
        const nama = clip(b.nama, 60);
        if (!nama) return send(res, 400, { ok: false, error: "Nama akun wajib diisi." });
        const old = b.id ? await account(b.id) : null;
        if (b.id && !old) return send(res, 404, { ok: false, error: "Akun tidak ditemukan." });
        const apiKey = clip(b.apiKey, 120) || (old && old.apiKey);
        if (!apiKey || !/^[A-Z0-9]{20,}$/i.test(apiKey)) return send(res, 400, { ok: false, error: "API key Vultr tidak valid (huruf besar + angka, ±36 karakter)." });
        const creditAwal = Math.max(0, Math.round(Number(String(b.creditAwal == null ? "" : b.creditAwal).replace(/[^\d.]/g, "")) * 100) / 100 || 0);
        const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(b.tanggal || "")) ? String(b.tanggal) : (old && old.tanggal) || "";
        const a = Object.assign({}, old || { id: crypto.randomBytes(6).toString("hex"), dibuat: Date.now() }, {
          nama, mitra: clip(b.mitra, 80), catatan: clip(b.catatan, 300), aktif: b.aktif !== false, apiKey, creditAwal, tanggal, diubah: Date.now(), diubahOleh: oleh
        });
        const info = await accountInfo(a); // pastikan key berfungsi sebelum disimpan
        if (!info.ok) return send(res, 400, { ok: false, error: "Tidak tersimpan: " + info.error });
        await redis(["HSET", ACC_KEY, a.id, encrypt(a)]);
        await log(oleh, old ? "ubah akun" : "tambah akun", nama + (info.email ? " (" + info.email + ")" : ""));
        return send(res, 200, { ok: true, account: Object.assign(safeAcc(a), { info }) });
      }
      case "account_delete": {
        const a = await account(b.id);
        if (!a) return send(res, 404, { ok: false, error: "Akun tidak ditemukan." });
        await redis(["HDEL", ACC_KEY, a.id]);
        await log(oleh, "hapus akun", a.nama + " (VPS di Vultr tidak ikut terhapus)");
        return send(res, 200, { ok: true });
      }

      // ---------- katalog
      case "catalog": return send(res, 200, Object.assign({ ok: true }, await catalog(!!b.refresh)));
      case "ssh_keys": {
        const a = await account(b.akun);
        if (!a) return send(res, 404, { ok: false, error: "Akun tidak ditemukan." });
        const keys = await vultrAll(a.apiKey, "/ssh-keys", "ssh_keys");
        return send(res, 200, { ok: true, keys: keys.map((k) => ({ id: k.id, nama: k.name })) });
      }

      // ---------- VPS
      case "instances": {
        const all = (await accounts()).filter((a) => a.aktif !== false && (!b.akun || a.id === b.akun));
        const results = await Promise.all(all.map((a) => instancesOf(a).then((l) => ({ ok: true, l }), (e) => ({ ok: false, akun: a.nama, error: e.message }))));
        const list = [], errors = [];
        results.forEach((r) => (r.ok ? list.push(...r.l) : errors.push(r.akun + ": " + r.error)));
        const raw = (await redis(["HGETALL", PW_KEY])) || [];
        const pw = {};
        for (let i = 0; i < raw.length; i += 2) { try { pw[raw[i]] = decrypt(raw[i + 1]).password; } catch (e) { /* lewati */ } }
        list.forEach((v) => { v.password = pw[v.id] || ""; v.adaPassword = !!pw[v.id]; });
        list.sort((x, y) => String(y.dibuat).localeCompare(String(x.dibuat)));
        return send(res, 200, { ok: true, instances: list, errors });
      }

      case "create": {
        const cat = await catalog();
        const plan = cat.plans.find((p) => p.id === b.plan);
        if (!plan) return send(res, 400, { ok: false, error: "Plan tidak dikenal." });
        if (!cat.regions.find((r) => r.id === b.region)) return send(res, 400, { ok: false, error: "Region tidak dikenal." });
        const osId = Number(b.os_id);
        if (!cat.os.find((o) => o.id === osId)) return send(res, 400, { ok: false, error: "OS tidak dikenal." });
        const label = clip(b.label, 60) || "mineidhost-" + b.region;
        const hostname = clip(b.hostname, 63).toLowerCase() || label.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 63) || "mineidhost";
        if (!HOST_RE.test(hostname)) return send(res, 400, { ok: false, error: "Hostname hanya boleh huruf, angka, dan tanda minus." });

        // pilih akun: manual, atau otomatis = akun aktif dengan kredit cukup (>= 1 bulan plan) yang kreditnya paling besar
        let acc, info;
        if (b.akun && b.akun !== "auto") {
          acc = await account(b.akun);
          if (!acc) return send(res, 404, { ok: false, error: "Akun tidak ditemukan." });
          info = await accountInfo(acc);
          if (!info.ok) return send(res, 400, { ok: false, error: acc.nama + ": " + info.error });
        } else {
          const all = (await accounts()).filter((a) => a.aktif !== false);
          const infos = await Promise.all(all.map(accountInfo));
          const ok = all.map((a, i) => ({ a, info: infos[i] })).filter((x) => x.info.ok && x.info.kredit >= plan.bulanan).sort((x, y) => y.info.kredit - x.info.kredit);
          if (!ok.length) return send(res, 400, { ok: false, error: `Tidak ada akun mitra aktif dengan sisa credit minimal $${plan.bulanan} (Biaya/Bulan plan ini).` });
          acc = ok[0].a; info = ok[0].info;
        }
        if (b.akun && b.akun !== "auto" && info.kredit < plan.bulanan && !b.paksa) {
          return send(res, 400, { ok: false, perluKonfirmasi: true, error: `Sisa credit ${acc.nama} $${info.kredit}, kurang dari Biaya/Bulan plan ini ($${plan.bulanan}). Setelah dibuat sisa jadi $${r2(info.kredit - plan.bulanan)}. Centang "tetap buat" kalau yakin.` });
        }

        const body = { region: b.region, plan: b.plan, os_id: osId, label, hostname, enable_ipv6: b.ipv6 !== false, backups: "disabled", tags: ["mineidhost"] }; // auto backup selalu mati
        // SSH key: pilih yang sudah ada di akun itu, atau tempel public key baru
        if (b.sshKeyId) body.sshkey_id = [String(b.sshKeyId)];
        else if (b.sshPublic && /^(ssh-(rsa|ed25519)|ecdsa-sha2-)/.test(String(b.sshPublic).trim())) {
          const k = await vultr(acc.apiKey, "POST", "/ssh-keys", { name: "mineidhost-" + Date.now().toString(36), ssh_key: String(b.sshPublic).trim() });
          body.sshkey_id = [k.ssh_key.id];
        }
        const r = await vultr(acc.apiKey, "POST", "/instances", body);
        const v = r.instance || {};
        if (v.default_password) await redis(["HSET", PW_KEY, v.id, encrypt({ password: v.default_password, akun: acc.id, waktu: Date.now() })]);
        await log(oleh, "buat VPS", `${label} · ${plan.id} · ${b.region} · akun ${acc.nama}`);
        return send(res, 200, { ok: true, akun: acc.nama, otomatis: !b.akun || b.akun === "auto", password: v.default_password || "", instance: slimInstance(v, acc) });
      }

      case "power": {
        const a = await account(b.akun);
        if (!a) return send(res, 404, { ok: false, error: "Akun tidak ditemukan." });
        const map = { start: "start", stop: "halt", reboot: "reboot" };
        if (!map[b.aksi]) return send(res, 400, { ok: false, error: "Aksi tidak dikenal." });
        await vultr(a.apiKey, "POST", "/instances/" + encodeURIComponent(b.id) + "/" + map[b.aksi]);
        await log(oleh, b.aksi + " VPS", (b.label || b.id) + " · akun " + a.nama);
        return send(res, 200, { ok: true });
      }

      case "reinstall": {
        const a = await account(b.akun);
        if (!a) return send(res, 404, { ok: false, error: "Akun tidak ditemukan." });
        if (String(b.konfirmasi || "") !== String(b.label || "")) return send(res, 400, { ok: false, error: "Ketik label VPS persis untuk konfirmasi." });
        const osId = Number(b.os_id);
        if (osId) await vultr(a.apiKey, "PATCH", "/instances/" + encodeURIComponent(b.id), { os_id: osId }); // ganti OS (ikut reinstall)
        else {
          const r = await vultr(a.apiKey, "POST", "/instances/" + encodeURIComponent(b.id) + "/reinstall", {});
          const pw = r.instance && r.instance.default_password;
          if (pw) await redis(["HSET", PW_KEY, b.id, encrypt({ password: pw, akun: a.id, waktu: Date.now() })]);
        }
        await log(oleh, "reinstall VPS", (b.label || b.id) + (osId ? " (OS baru " + osId + ")" : "") + " · akun " + a.nama);
        return send(res, 200, { ok: true });
      }

      case "delete": {
        const a = await account(b.akun);
        if (!a) return send(res, 404, { ok: false, error: "Akun tidak ditemukan." });
        if (!b.label || String(b.konfirmasi || "") !== String(b.label)) return send(res, 400, { ok: false, error: "Ketik label VPS persis untuk konfirmasi hapus." });
        await vultr(a.apiKey, "DELETE", "/instances/" + encodeURIComponent(b.id));
        await redis(["HDEL", PW_KEY, String(b.id)]);
        await log(oleh, "HAPUS VPS", b.label + " · " + (b.ip || "") + " · akun " + a.nama);
        return send(res, 200, { ok: true });
      }

      case "password": {
        const raw = await redis(["HGET", PW_KEY, String(b.id || "")]);
        if (!raw) return send(res, 404, { ok: false, error: "Password root tidak tersimpan (VPS dibuat di luar website ini, atau memakai SSH key)." });
        const p = decrypt(raw);
        await log(oleh, "lihat password", String(b.label || b.id));
        return send(res, 200, { ok: true, password: p.password, waktu: p.waktu });
      }

      case "set_password": {
        const a = await account(b.akun);
        if (!a) return send(res, 404, { ok: false, error: "Akun tidak ditemukan." });
        const pass = String(b.password || "").slice(0, 200);
        if (!pass) { await redis(["HDEL", PW_KEY, String(b.id)]); await log(oleh, "hapus password", String(b.label || b.id)); return send(res, 200, { ok: true }); }
        await redis(["HSET", PW_KEY, String(b.id), encrypt({ password: pass, akun: a.id, waktu: Date.now(), manual: true })]);
        await log(oleh, "ubah password", String(b.label || b.id));
        return send(res, 200, { ok: true });
      }

      case "log": {
        const raw = (await redis(["LRANGE", LOG_KEY, 0, 199])) || [];
        return send(res, 200, { ok: true, log: raw.map((x) => { try { return decrypt(x); } catch (e) { return null; } }).filter(Boolean) });
      }

      default: return send(res, 400, { ok: false, error: "action" });
    }
  } catch (e) {
    console.error("[vultr]", e.message);
    return send(res, e.status && e.status < 500 ? 400 : 502, { ok: false, error: e.message || "Kesalahan server." });
  }
};

module.exports._test = { accountInfo, slimInstance };
