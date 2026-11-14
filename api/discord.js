/*
 * Bot Discord "akses server" MineIDHost (Discord Interactions, jalan di Vercel, tanpa server bot)
 *
 *   /akses server_id:<id> [jam]  -> form Gmail staf -> staf ditambahkan sebagai SUBUSER (izin penuh) di server itu
 *   /cabut server_id:<id>        -> cabut akses yang diberikan bot di server itu sekarang juga
 *   /akses-aktif                 -> daftar akses yang masih berlaku
 *
 * Akses dicabut otomatis setelah AKSES_JAM (default 24 jam). Pencabutan dijalankan oleh
 * GET /api/discord?sweep=1 (GitHub Actions tiap 15 menit + cron Vercel harian + setiap ada perintah).
 * Pendaftaran perintah: buka sekali https://mineidhost.com/api/discord?setup=1
 *
 * Environment Variables (Vercel):
 *   DISCORD_APP_ID, DISCORD_PUBLIC_KEY, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
 *   DISCORD_CHANNEL_IDS   ID channel staf yang boleh memakai perintah (pisahkan koma). Channel pertama = log pencabutan.
 *   STAF_EMAILS           Gmail staf yang boleh diberi akses (pisahkan koma)
 *   PTERODACTYL_URL       https://panel.mineidhost.com (sudah ada)
 *   PTERO_CLIENT_KEY      Client API key (ptlc_) dari akun ROOT ADMIN khusus bot
 *   AKSES_JAM             opsional, lama akses default (jam), default 24
 *   KV_REST_API_URL / KV_REST_API_TOKEN (sudah ada, Upstash)
 */
"use strict";
const crypto = require("crypto");

const GRANTS = "mdh:akses:grants";
const env = (k) => String(process.env[k] || "").trim();
const list = (k) => env(k).split(",").map((s) => s.trim()).filter(Boolean);
const REDIS_URL = () => env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL");
const REDIS_TOKEN = () => env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN");
const PANEL = () => env("PTERODACTYL_URL").replace(/\/+$/, "");
const DEFAULT_HOURS = () => Math.min(168, Math.max(1, Number(env("AKSES_JAM")) || 24));
const EPHEMERAL = 64;

// izin penuh subuser Pterodactyl (dipakai kalau daftar dari panel tidak bisa diambil)
const FULL_PERMS = [
  "control.console", "control.start", "control.stop", "control.restart",
  "user.create", "user.read", "user.update", "user.delete",
  "file.create", "file.read", "file.read-content", "file.update", "file.delete", "file.archive", "file.sftp",
  "backup.create", "backup.read", "backup.delete", "backup.download", "backup.restore",
  "allocation.read", "allocation.create", "allocation.update", "allocation.delete",
  "startup.read", "startup.update", "startup.docker-image",
  "database.create", "database.read", "database.update", "database.delete", "database.view_password",
  "schedule.create", "schedule.read", "schedule.update", "schedule.delete",
  "settings.rename", "settings.reinstall", "activity.read"
];

// ---------------------------------------------------------------- util
async function redis(cmd) {
  const r = await fetch(REDIS_URL(), { method: "POST", headers: { Authorization: "Bearer " + REDIS_TOKEN(), "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Redis: " + (j.error || r.status));
  return j.result;
}
async function fetchT(url, opts, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 8000);
  try { return await fetch(url, Object.assign({}, opts, { signal: ctl.signal })); } finally { clearTimeout(t); }
}
async function panel(method, path, body) {
  const r = await fetchT(PANEL() + "/api/client" + path, {
    method,
    headers: { Authorization: "Bearer " + env("PTERO_CLIENT_KEY"), Accept: "application/json", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  }, 8000);
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) {
    const detail = (j.errors && j.errors[0] && (j.errors[0].detail || j.errors[0].code)) || ("HTTP " + r.status);
    const e = new Error(detail); e.status = r.status; throw e;
  }
  return j;
}
async function discord(method, path, body) {
  const r = await fetchT("https://discord.com/api/v10" + path, {
    method, headers: { Authorization: "Bot " + env("DISCORD_BOT_TOKEN"), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined
  }, 8000);
  if (!r.ok && r.status !== 204) throw new Error("Discord HTTP " + r.status + " " + (await r.text()).slice(0, 200));
  return r.status === 204 ? {} : r.json();
}
const wib = (ms) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ") + " WIB";
const ts = (ms) => `<t:${Math.floor(ms / 1000)}:f> (<t:${Math.floor(ms / 1000)}:R>)`;

// "1d3a7b65", UUID lengkap, atau link panel ".../server/1d3a7b65"
function serverId(input) {
  const s = String(input || "").trim().toLowerCase();
  const m = /([0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?)(?:[/?#].*)?$/.exec(s.replace(/\/+$/, ""));
  return m ? m[1].slice(0, 8) : "";
}

function configError() {
  const need = ["DISCORD_APP_ID", "DISCORD_PUBLIC_KEY", "DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID", "DISCORD_CHANNEL_IDS", "STAF_EMAILS", "PTERODACTYL_URL", "PTERO_CLIENT_KEY"];
  const miss = need.filter((k) => !env(k));
  if (!REDIS_URL() || !REDIS_TOKEN()) miss.push("KV_REST_API_URL/KV_REST_API_TOKEN");
  if (env("PTERO_CLIENT_KEY") && !/^ptlc_/.test(env("PTERO_CLIENT_KEY"))) return "PTERO_CLIENT_KEY harus Client API key (diawali ptlc_) dari akun root admin.";
  return miss.length ? "Belum diisi di Vercel: " + miss.join(", ") : "";
}

// ---------------------------------------------------------------- tanda tangan Discord (Ed25519)
function verify(req, raw) {
  try {
    const sig = req.headers["x-signature-ed25519"], time = req.headers["x-signature-timestamp"];
    if (!sig || !time) return false;
    const key = crypto.createPublicKey({ key: Buffer.from("302a300506032b6570032100" + env("DISCORD_PUBLIC_KEY"), "hex"), format: "der", type: "spki" });
    return crypto.verify(null, Buffer.from(time + raw), key, Buffer.from(sig, "hex"));
  } catch (e) { return false; }
}
function readRaw(req) {
  return new Promise((ok, no) => {
    let s = "";
    req.setEncoding("utf8");
    req.on("data", (c) => { s += c; if (s.length > 200000) no(new Error("too large")); });
    req.on("end", () => ok(s));
    req.on("error", no);
  });
}

// ---------------------------------------------------------------- inti: beri & cabut akses
let permCache = null;
async function fullPermissions() {
  if (permCache) return permCache;
  try {
    const j = await panel("GET", "/permissions");
    const groups = j.attributes && j.attributes.permissions;
    const out = [];
    Object.keys(groups || {}).forEach((g) => {
      if (g === "websocket") return; // bukan izin yang bisa diberikan
      Object.keys(groups[g].keys || {}).forEach((k) => out.push(g + "." + k));
    });
    if (out.length > 10) permCache = out;
  } catch (e) { /* pakai daftar bawaan */ }
  return permCache || FULL_PERMS;
}

async function grant(sid, email, hours, by) {
  const srv = await panel("GET", "/servers/" + sid).catch((e) => {
    throw new Error(e.status === 404 ? `Server \`${sid}\` tidak ditemukan di panel.` : "Panel: " + e.message);
  });
  const name = srv.attributes.name;
  const users = await panel("GET", "/servers/" + sid + "/users");
  const perms = await fullPermissions();
  let su = (users.data || []).map((u) => u.attributes).find((u) => String(u.email).toLowerCase() === email);
  let existed = !!su;
  if (su) await panel("POST", "/servers/" + sid + "/users/" + su.uuid, { permissions: perms });
  else {
    const r = await panel("POST", "/servers/" + sid + "/users", { email, permissions: perms }).catch((e) => {
      if (/owner/i.test(e.message)) throw new Error("Gmail itu adalah pemilik server, tidak bisa dijadikan subuser.");
      throw new Error("Panel menolak: " + e.message);
    });
    su = r.attributes;
  }
  const key = sid + "|" + email;
  const prev = await redis(["HGET", GRANTS, key]);
  const old = prev ? JSON.parse(prev) : null;
  // kalau staf sudah jadi subuser SEBELUM bot (diberi manual), jangan dihapus saat kedaluwarsa
  const manual = old ? !!old.manual : existed;
  const exp = Date.now() + hours * 3600e3;
  await redis(["HSET", GRANTS, key, JSON.stringify({ server: sid, name, email, uuid: su.uuid, exp, by: by.name, byId: by.id, at: Date.now(), manual })]);
  return { name, exp, manual, extended: !!old };
}

async function revoke(g, reason) {
  if (!g.manual) {
    try { await panel("DELETE", "/servers/" + g.server + "/users/" + g.uuid); }
    catch (e) { if (e.status !== 404) throw e; } // sudah dihapus manual
  }
  await redis(["HDEL", GRANTS, g.server + "|" + g.email]);
  return reason;
}

async function allGrants() {
  const raw = (await redis(["HGETALL", GRANTS])) || [];
  const out = [];
  for (let i = 0; i < raw.length; i += 2) { try { out.push(JSON.parse(raw[i + 1])); } catch (e) { /* lewati */ } }
  return out.sort((a, b) => a.exp - b.exp);
}

async function sweep() {
  const lock = await redis(["SET", "mdh:akses:sweep", "1", "NX", "EX", 50]);
  if (!lock) return { skipped: true };
  const now = Date.now(), done = [], failed = [];
  for (const g of await allGrants()) {
    if (g.exp > now) continue;
    try { await revoke(g); done.push(g); } catch (e) { failed.push(g.server + " " + e.message); }
  }
  const log = list("DISCORD_CHANNEL_IDS")[0];
  if (log && done.length) {
    await discord("POST", "/channels/" + log + "/messages", {
      content: "⏰ **Akses otomatis dicabut** (waktu habis):\n" + done.map((g) => `• \`${g.server}\` ${g.name} — ${g.email}${g.manual ? " _(subuser manual, tidak dihapus dari panel)_" : ""}`).join("\n"),
      allowed_mentions: { parse: [] }
    }).catch(() => {});
  }
  return { revoked: done.length, failed };
}

// ---------------------------------------------------------------- perintah
const COMMANDS = [
  { name: "akses", description: "Minta akses subuser (izin penuh) ke server pelanggan", options: [
    { type: 3, name: "server_id", description: "ID server (contoh 1d3a7b65) atau link panel", required: true },
    { type: 4, name: "jam", description: "Lama akses dalam jam (default 24, maks 168)", required: false, min_value: 1, max_value: 168 }
  ] },
  { name: "cabut", description: "Cabut akses yang diberikan bot di server ini sekarang", options: [
    { type: 3, name: "server_id", description: "ID server", required: true },
    { type: 3, name: "gmail", description: "Hanya cabut Gmail ini (kosongkan = semua akses bot di server itu)", required: false }
  ] },
  { name: "akses-aktif", description: "Daftar akses server yang masih berlaku" }
];

function reply(res, content, flags) {
  json(res, 200, { type: 4, data: { content, flags: flags || 0, allowed_mentions: { parse: [] } } });
}
function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}
const opt = (i, name) => ((i.data.options || []).find((o) => o.name === name) || {}).value;

// pekerjaan ke panel bisa > 3 detik: jawab "sedang diproses" dulu lalu ubah pesannya
async function slow(res, i, work) {
  let finished = false;
  const job = work().then((c) => { finished = true; return c; }, (e) => { finished = true; return "⚠️ " + e.message; });
  const quick = await Promise.race([job, new Promise((r) => setTimeout(() => r(null), 2200))]);
  if (finished) return reply(res, quick);
  json(res, 200, { type: 5 });
  const followUp = job.then((content) => fetchT(`https://discord.com/api/v10/webhooks/${env("DISCORD_APP_ID")}/${i.token}/messages/@original`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, allowed_mentions: { parse: [] } })
  }, 8000)).catch(() => {});
  const ctx = globalThis[Symbol.for("@vercel/request-context")];
  const wu = ctx && ctx.get && ctx.get() && ctx.get().waitUntil;
  if (wu) wu(followUp);
  await followUp;
}

async function handle(i, res) {
  if (i.type === 1) return json(res, 200, { type: 1 }); // PING dari Discord

  const user = (i.member && i.member.user) || i.user || {};
  const by = { id: user.id, name: (i.member && i.member.nick) || user.global_name || user.username || "staf" };
  if (i.guild_id !== env("DISCORD_GUILD_ID") || !list("DISCORD_CHANNEL_IDS").includes(i.channel_id)) {
    return reply(res, "⛔ Perintah ini hanya bisa dipakai di channel staf MineIDHost.", EPHEMERAL);
  }
  sweep().catch(() => {}); // sekalian cabut yang sudah kedaluwarsa

  // 1) /akses -> tampilkan form Gmail
  if (i.type === 2 && i.data.name === "akses") {
    const sid = serverId(opt(i, "server_id"));
    if (!sid) return reply(res, "⚠️ ID server tidak valid. Contoh: `1d3a7b65` atau link `panel.mineidhost.com/server/1d3a7b65`.", EPHEMERAL);
    const hours = Math.min(168, Math.max(1, Number(opt(i, "jam")) || DEFAULT_HOURS()));
    return json(res, 200, { type: 9, data: {
      custom_id: `akses|${sid}|${hours}`,
      title: `Akses server ${sid} (${hours} jam)`,
      components: [{ type: 1, components: [{ type: 4, custom_id: "gmail", label: "Gmail staf yang terdaftar", style: 1, min_length: 6, max_length: 120, placeholder: "nama@gmail.com", required: true }] }]
    } });
  }

  // 2) form Gmail dikirim -> beri akses
  if (i.type === 5 && String(i.data.custom_id).startsWith("akses|")) {
    const [, sid, h] = i.data.custom_id.split("|");
    const email = String(((i.data.components || [])[0] || {}).components[0].value || "").trim().toLowerCase();
    const staff = list("STAF_EMAILS").map((x) => x.toLowerCase());
    if (!staff.includes(email)) {
      return reply(res, `⛔ \`${email}\` bukan Gmail staf yang terdaftar. Minta founder menambahkannya di STAF_EMAILS.`, EPHEMERAL);
    }
    return slow(res, i, async () => {
      const g = await grant(sid, email, Number(h), by);
      return `✅ **Akses diberikan** oleh ${by.name}\n` +
        `Server: \`${sid}\` **${g.name}**\nSubuser: ${email} (izin penuh)\n` +
        `Berlaku sampai ${ts(g.exp)}${g.extended ? " _(diperpanjang)_" : ""}\n` +
        `Buka: ${PANEL()}/server/${sid}` +
        (g.manual ? "\n_Gmail ini sudah jadi subuser sebelumnya (diberi manual), jadi tidak akan dihapus otomatis._" : "");
    });
  }

  // /cabut
  if (i.type === 2 && i.data.name === "cabut") {
    const sid = serverId(opt(i, "server_id"));
    const only = String(opt(i, "gmail") || "").trim().toLowerCase();
    if (!sid) return reply(res, "⚠️ ID server tidak valid.", EPHEMERAL);
    return slow(res, i, async () => {
      const gs = (await allGrants()).filter((g) => g.server === sid && (!only || g.email === only));
      if (!gs.length) return `Tidak ada akses dari bot di server \`${sid}\`${only ? " untuk " + only : ""}.`;
      for (const g of gs) await revoke(g);
      return `🔒 **Akses dicabut** oleh ${by.name}\nServer \`${sid}\` ${gs[0].name}: ${gs.map((g) => g.email + (g.manual ? " _(subuser manual, tetap di panel)_" : "")).join(", ")}`;
    });
  }

  // /akses-aktif
  if (i.type === 2 && i.data.name === "akses-aktif") {
    const gs = (await allGrants()).filter((g) => g.exp > Date.now());
    if (!gs.length) return reply(res, "Tidak ada akses server yang aktif.");
    return reply(res, "🔑 **Akses aktif**\n" + gs.map((g) => `• \`${g.server}\` ${g.name} — ${g.email} · oleh ${g.by} · sampai ${ts(g.exp)}`).join("\n"));
  }

  return reply(res, "Perintah tidak dikenal.", EPHEMERAL);
}

// ---------------------------------------------------------------- handler Vercel
module.exports = async (req, res) => {
  const cfgErr = configError();

  if (req.method === "GET") {
    const q = new URL(req.url, "http://x").searchParams;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    if (cfgErr) return json(res, 503, { ok: false, error: cfgErr });
    try {
      if (q.has("setup")) {
        // daftar perintah slash di server Discord (aman dijalankan berkali-kali)
        await discord("PUT", `/applications/${env("DISCORD_APP_ID")}/guilds/${env("DISCORD_GUILD_ID")}/commands`, COMMANDS);
        // isi otomatis "Interactions Endpoint URL" (Discord langsung mengetes alamat ini)
        const url = "https://" + String(req.headers["x-forwarded-host"] || req.headers.host || "mineidhost.com").split(",")[0].trim() + "/api/discord";
        let endpoint = "Interactions Endpoint URL terpasang: " + url;
        try { await discord("PATCH", "/applications/@me", { interactions_endpoint_url: url }); }
        catch (e) { endpoint = "Perintah sudah terdaftar, tapi Interactions Endpoint URL gagal dipasang otomatis. Isi manual di Developer Portal: " + url + " (" + e.message.slice(0, 120) + ")"; }
        return json(res, 200, { ok: true, message: "Perintah /akses, /cabut, /akses-aktif sudah terdaftar di server Discord.", endpoint });
      }
      if (q.has("sweep")) return json(res, 200, Object.assign({ ok: true }, await sweep()));
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 502, { ok: false, error: e.message });
    }
  }
  if (req.method !== "POST") return json(res, 405, { ok: false });

  let raw;
  try { raw = await readRaw(req); } catch (e) { return json(res, 400, { error: "body" }); }
  if (!env("DISCORD_PUBLIC_KEY") || !verify(req, raw)) return json(res, 401, { error: "invalid request signature" });
  const i = JSON.parse(raw || "{}");
  if (i.type === 1) return json(res, 200, { type: 1 });
  if (cfgErr) return reply(res, "⚠️ Bot belum selesai disetup: " + cfgErr, EPHEMERAL);
  try { await handle(i, res); }
  catch (e) {
    console.error("[discord]", e);
    if (!res.writableEnded) reply(res, "⚠️ Terjadi kesalahan: " + e.message, EPHEMERAL);
  }
};

module.exports._test = { serverId, verify, COMMANDS };
