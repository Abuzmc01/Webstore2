/*
 * Status node MineIDHost: GET /api/status
 * Data diambil dari Pterodactyl Application API (hanya baca).
 *
 * Environment Variables di Vercel:
 *   PTERODACTYL_URL      contoh https://panel.mineidhost.com
 *   PTERODACTYL_API_KEY  Application API key (ptla_...), izin Nodes: Read, Locations: Read
 *   STATUS_HIDE_NODES    opsional, nama/ID node yang disembunyikan, pisahkan koma
 *
 * Alamat (FQDN/IP) node tidak pernah dikirim ke browser.
 */
"use strict";

const NODE_TIMEOUT = 4000;
const API_TIMEOUT = 8000;

async function fetchT(url, opts, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, Object.assign({}, opts, { signal: ctl.signal }));
  } finally {
    clearTimeout(t);
  }
}

async function panelGet(base, key, path) {
  const r = await fetchT(base + path, {
    headers: { Authorization: "Bearer " + key, Accept: "application/json" }
  }, API_TIMEOUT);
  if (r.status === 401 || r.status === 403) {
    const e = new Error("API key ditolak panel. Pakai Application API key (ptla_) dengan izin Nodes: Read.");
    e.code = 502;
    throw e;
  }
  if (!r.ok) {
    const e = new Error("Panel membalas HTTP " + r.status);
    e.code = 502;
    throw e;
  }
  return r.json();
}

async function listNodes(base, key) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const j = await panelGet(base, key, "/api/application/nodes?include=location&per_page=100&page=" + page);
    (j.data || []).forEach((n) => out.push(n.attributes || {}));
    const p = j.meta && j.meta.pagination;
    if (!p || p.current_page >= p.total_pages) break;
  }
  return out;
}

// Node dianggap online kalau daemon Wings menjawab apa pun (401 tanpa token pun berarti hidup)
async function pingNode(n) {
  if (!n.fqdn) return false;
  const scheme = n.scheme === "http" ? "http" : "https";
  const port = n.behind_proxy ? (scheme === "https" ? 443 : 80) : (n.daemon_listen || 8080);
  try {
    await fetchT(scheme + "://" + n.fqdn + ":" + port + "/api/system", { method: "GET" }, NODE_TIMEOUT);
    return true;
  } catch (e) {
    return false;
  }
}

function num(v) { v = Number(v); return isFinite(v) ? v : 0; }

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "Method tidak didukung" }));
  }

  const base = String(process.env.PTERODACTYL_URL || "").trim().replace(/\/+$/, "");
  const key = String(process.env.PTERODACTYL_API_KEY || "").trim();
  if (!base || !key) {
    res.statusCode = 503;
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ ok: false, error: "Status belum dikonfigurasi (PTERODACTYL_URL / PTERODACTYL_API_KEY)" }));
  }

  const hide = String(process.env.STATUS_HIDE_NODES || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

  try {
    const raw = (await listNodes(base, key)).filter((n) =>
      !hide.includes(String(n.name || "").toLowerCase()) && !hide.includes(String(n.id))
    );
    const online = await Promise.all(raw.map(pingNode));

    const nodes = raw.map((n, i) => {
      const loc = n.relationships && n.relationships.location && n.relationships.location.attributes;
      const alloc = n.allocated_resources || {};
      const maintenance = !!n.maintenance_mode;
      return {
        id: n.id,
        name: n.name || "Node " + n.id,
        location: loc ? (loc.long || loc.short || "") : "",
        status: maintenance ? "maintenance" : online[i] ? "online" : "offline",
        memory: { total: num(n.memory), used: num(alloc.memory) },
        disk: { total: num(n.disk), used: num(alloc.disk) }
      };
    }).sort((a, b) => (a.location + a.name).localeCompare(b.location + b.name));

    const count = (s) => nodes.filter((n) => n.status === s).length;
    res.statusCode = 200;
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    res.end(JSON.stringify({
      ok: true,
      updated: new Date().toISOString(),
      summary: { total: nodes.length, online: count("online"), offline: count("offline"), maintenance: count("maintenance") },
      nodes
    }));
  } catch (e) {
    res.statusCode = e.code || 502;
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({
      ok: false,
      error: e.name === "AbortError" ? "Panel tidak menjawab (timeout)" : (e.code ? e.message : "Gagal menghubungi panel")
    }));
  }
};
