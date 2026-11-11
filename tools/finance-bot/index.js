// Bot WhatsApp keuangan MineIDHost
// Admin mencatat pemasukan/pengeluaran lewat chat → tersimpan di mineidhost.com/admin-keuangan.
// Setiap tanggal tutup buku (default 28) bot mengirim laporan otomatis ke grup keuangan.
import fs from "node:fs";
import path from "node:path";
import { cfg, checkConfig } from "./lib/config.js";
import { parseCommand, HELP, todayWIB } from "./lib/parse.js";
import { call, addTx, flushQueue, queueSize } from "./lib/api.js";
import { startWhatsApp, sendTo, wa } from "./lib/wa.js";

checkConfig();

const STATE = path.join(cfg.dataDir, "state.json");
let state = {};
try { if (fs.existsSync(STATE)) state = JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { state = {}; }
const saveState = () => fs.writeFileSync(STATE, JSON.stringify(state));

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const rp = (n) => (n < 0 ? "-Rp" : "Rp") + Math.abs(Math.round(n)).toLocaleString("id-ID");
const tgl = (s) => { const [y, m, d] = s.split("-").map(Number); return `${d} ${BLN[m - 1]} ${y}`; };

// periode berjalan & periode yang terakhir ditutup (sama dengan rumus di website)
function periodOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + (d >= cfg.cutoff ? 1 : 0), 1)).toISOString().slice(0, 7);
}
function prevPeriod(p) {
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

function whoIs(ids, pushName) {
  for (const id of ids) if (cfg.admins[id]) return cfg.admins[id];
  return null;
}

function describe(t, label) {
  const parts = [label];
  if (t.nama) parts.push(t.nama + (t.tipe ? " (" + t.tipe + ")" : ""));
  else if (t.tipe) parts.push(t.tipe);
  if (t.ket) parts.push(t.ket);
  return parts.join(" · ");
}

async function handle(msg) {
  const p = parseCommand(msg.text);
  if (!p) return;

  // perintah bantu yang boleh dipakai siapa saja
  if (p.action === "idgrup") {
    if (!msg.isGroup) return msg.reply("Ketik !idgrup di dalam grup keuangan.");
    return msg.reply(`ID grup ini:\n${msg.jid}\n\nIsi di .env bot keuangan:\nFIN_GROUP_JID=${msg.jid}\nLalu restart bot.`);
  }
  if (p.action === "saya") return msg.reply(`ID WhatsApp kamu:\n${msg.ids.join("\n")}\n\nTambahkan di .env bot (FIN_ADMINS), contoh:\nFIN_ADMINS=${msg.ids[0]}:${(msg.pushName || "Nama").replace(/[:,]/g, "")}`);

  // hanya grup keuangan (atau chat pribadi admin terdaftar)
  const listed = Object.keys(cfg.admins).length > 0;
  const name = whoIs(msg.ids, msg.pushName);
  const inGroup = msg.isGroup && cfg.groupJid && msg.jid === cfg.groupJid;
  if (msg.isGroup && !inGroup) return; // grup lain: diam
  if (!msg.isGroup && !name) return;   // chat pribadi dari orang tidak terdaftar: diam
  if (listed && !name) return msg.reply("⛔ Nomor kamu belum terdaftar sebagai admin keuangan. Ketik *!saya* lalu minta founder menambahkan ID kamu di FIN_ADMINS.");
  const oleh = name || msg.pushName || msg.ids[0] || "admin";

  if (p.error) return msg.reply("⚠️ " + p.error);
  if (p.action === "help") return msg.reply(HELP);
  if (p.action === "ping") return msg.reply(`Bot keuangan aktif ✅\nAntrean belum terkirim: ${queueSize()}\nLaporan otomatis: tanggal ${cfg.cutoff} pukul ${cfg.reportHour}.00 WIB\nPantau: ${cfg.siteUrl}/admin-keuangan`);

  if (p.action === "add") {
    const r = await addTx(p.tx, oleh, msg.msgId);
    if (r.queued) return msg.reply(`⏳ Website sedang tidak bisa dihubungi. Catatan disimpan di bot dan dikirim otomatis begitu tersambung:\n${rp(p.tx.nominal)} · ${tgl(p.tx.tanggal)}`);
    if (!r.ok) return msg.reply("⚠️ Gagal mencatat: " + (r.error || "kesalahan tidak diketahui"));
    const t = r.tx;
    const lines = [
      `✅ Tercatat *#${t.id}*`,
      describe(t, r.label),
      `*${rp(t.nominal)}* · ${tgl(t.tanggal)}`,
      t.jenis === "keluar" && !t.kategori.startsWith("talang") ? `Sumber dana: ${t.sumber === "midtrans" ? "Midtrans" : "dana bisnis"}` : null,
      `Oleh: ${t.admin}`,
      `Periode: ${r.periode}`,
      t.kategori.startsWith("talang") ? `\n🧾 Dana talang *belum diganti*. Kalau sudah diganti ke ${t.admin}, ketik *!lunas ${t.id}*` : null,
      r.duplikat ? "\n(Catatan ini sudah pernah masuk, tidak dicatat dua kali.)" : null
    ].filter(Boolean);
    return msg.reply(lines.join("\n"));
  }

  if (p.action === "lunas" || p.action === "batal_lunas") {
    const r = await call({ action: p.action, id: p.id, dari: p.dari, oleh });
    if (!r.ok) return msg.reply("⚠️ " + (r.error || "Gagal"));
    const t = r.tx;
    return msg.reply(p.action === "lunas"
      ? `✅ Dana talang *#${t.id}* ditandai *lunas*\n${describe(t, t.kategori === "talang_domain" ? "Domain" : "Talang")} · ${rp(t.nominal)}\nDiganti ke ${t.admin} dari ${t.lunasDari === "midtrans" ? "Midtrans" : "dana bisnis"}.`
      : `↩️ Status lunas *#${t.id}* dibatalkan. Dana talang kembali tercatat belum diganti.`);
  }

  if (p.action === "hapus") {
    const r = await call({ action: "hapus", id: p.id, oleh });
    if (!r.ok) return msg.reply("⚠️ " + (r.error || "Gagal"));
    return msg.reply(`🗑️ Catatan *#${r.tx.id}* dihapus (${rp(r.tx.nominal)} · ${tgl(r.tx.tanggal)}).`);
  }

  if (p.action === "rekap") {
    const r = await call({ action: "rekap", periode: p.periode });
    if (!r.ok) return msg.reply("⚠️ " + (r.error || "Gagal"));
    return msg.reply(r.text + `\n\n_Rekap sementara. Detail: ${cfg.siteUrl}/admin-keuangan_`);
  }

  if (p.action === "talang") {
    const r = await call({ action: "talang" });
    if (!r.ok) return msg.reply("⚠️ " + (r.error || "Gagal"));
    if (!r.tx.length) return msg.reply("✅ Tidak ada dana talang yang belum diganti.");
    const total = r.tx.reduce((s, t) => s + t.nominal, 0);
    return msg.reply(`🧾 *Dana talang belum diganti: ${rp(total)}*\n\n` + r.tx.map((t) => `#${t.id} · ${t.admin} · ${rp(t.nominal)}\n   ${t.nama || t.ket} · ${tgl(t.tanggal)}`).join("\n") + "\n\nTandai lunas: *!lunas ID*");
  }

  if (p.action === "terakhir") {
    const r = await call({ action: "terakhir", n: 10 });
    if (!r.ok) return msg.reply("⚠️ " + (r.error || "Gagal"));
    if (!r.tx.length) return msg.reply("Belum ada catatan.");
    return msg.reply("🕘 *10 catatan terakhir*\n\n" + r.tx.map((t) => `#${t.id} ${t.jenis === "masuk" ? "➕" : "➖"} ${rp(t.nominal)} · ${tgl(t.tanggal)}\n   ${t.nama || t.ket || t.kategori} · ${t.admin}`).join("\n"));
  }
}

// ---------------------------------------------------------------- laporan otomatis
async function autoReport() {
  const now = new Date(Date.now() + 7 * 3600e3);
  const today = todayWIB();
  const closing = prevPeriod(periodOf(today)); // periode yang sudah berakhir kemarin atau sebelumnya
  if (!state.lastReport) { state.lastReport = closing; saveState(); return; } // pertama kali jalan: jangan kirim laporan lama
  if (state.lastReport === closing) return;
  if (now.getUTCDate() === cfg.cutoff && now.getUTCHours() < cfg.reportHour) return; // tunggu jam laporan
  if (!cfg.groupJid || (!wa.ready && !cfg.disableWhatsApp)) return;
  const r = await call({ action: "tutup", periode: closing });
  if (!r.ok) { console.error("[!] Laporan otomatis gagal:", r.error); return; }
  sendTo(cfg.groupJid, r.text + `\n\n_Laporan otomatis tanggal ${cfg.cutoff}. Detail: ${cfg.siteUrl}/admin-keuangan_`);
  state.lastReport = closing;
  saveState();
  console.log("[OK] Laporan periode", closing, "dikirim.");
}

setInterval(() => {
  autoReport().catch((e) => console.error("[!] autoReport:", e.message));
  flushQueue((job, r) => {
    if (r.ok && cfg.groupJid) sendTo(cfg.groupJid, `✅ Catatan tertunda sudah masuk: *#${r.tx.id}* ${rp(r.tx.nominal)} · ${tgl(r.tx.tanggal)} (oleh ${job.oleh})`);
  }).catch(() => {});
}, 60 * 1000);

startWhatsApp(handle).catch((e) => { console.error(e); process.exit(1); });
console.log(`[i] Bot keuangan berjalan. Data → ${cfg.siteUrl}/admin-keuangan`);

export { handle, autoReport };
