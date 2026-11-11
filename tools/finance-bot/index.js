// Bot WhatsApp notifikasi keuangan MineIDHost
// - Admin mencatat di mineidhost.com/admin-keuangan.
// - Bot mengecek website setiap beberapa detik dan mengirim notifikasi catatan baru ke grup keuangan.
// - Tanggal 28 pukul 23.29 WIB bot mengirim rekap total periode (29 bulan lalu s/d 28 bulan ini).
import fs from "node:fs";
import path from "node:path";
import { cfg, checkConfig } from "./lib/config.js";
import { parseCommand, HELP, todayWIB } from "./lib/parse.js";
import { call } from "./lib/api.js";
import { startWhatsApp, sendTo, wa } from "./lib/wa.js";

checkConfig();
fs.mkdirSync(cfg.dataDir, { recursive: true });

const STATE = path.join(cfg.dataDir, "state.json");
let state = {};
try { if (fs.existsSync(STATE)) state = JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { state = {}; }
const saveState = () => fs.writeFileSync(STATE, JSON.stringify(state));

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const rp = (n) => (n < 0 ? "-Rp" : "Rp") + Math.abs(Math.round(n || 0)).toLocaleString("id-ID");
const tgl = (s) => { const [y, m, d] = s.split("-").map(Number); return `${d} ${BLN[m - 1]} ${y}`; };
const SUMBER = { midtrans: "Midtrans", voucher: "refund voucher", bisnis: "dana bisnis" };

// sama dengan rumus di website: periode "2026-11" = 29 Okt s/d 28 Nov
function periodOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + (d > cfg.cutoff ? 1 : 0), 1)).toISOString().slice(0, 7);
}
function prevPeriod(p) {
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

// ---------------------------------------------------------------- format notifikasi
function detail(t, label) {
  const parts = [label];
  if (t.nama) parts.push(t.nama + (t.tipe ? " (" + t.tipe + ")" : ""));
  else if (t.tipe) parts.push(t.tipe);
  if (t.ket) parts.push(t.ket);
  return parts.join(" · ");
}
function formatEvent(e) {
  const t = e.tx, masuk = t.jenis === "masuk", talang = String(t.kategori).startsWith("talang");
  const nominal = `*${masuk ? "+" : "−"}${rp(t.nominal)}* · ${tgl(t.tanggal)}`;
  const L = [];
  if (e.jenis === "tambah") {
    L.push(`${masuk ? "💰" : "💸"} *${masuk ? "Pemasukan" : "Pengeluaran"} baru* oleh ${e.oleh}`);
    L.push(detail(t, e.label));
    L.push(nominal + (!masuk && !talang ? ` · ${SUMBER[t.sumber] || "dana bisnis"}` : ""));
    if (talang) L.push(`🧾 Dana talang dari *${t.admin}*, belum diganti`);
  } else if (e.jenis === "ubah") {
    L.push(`✏️ *Catatan diubah* oleh ${e.oleh}`);
    L.push(detail(t, e.label));
    L.push(nominal + (e.sebelum && e.sebelum.nominal !== t.nominal ? ` _(sebelumnya ${rp(e.sebelum.nominal)})_` : ""));
  } else if (e.jenis === "hapus") {
    L.push(`🗑️ *Catatan dihapus* oleh ${e.oleh}`);
    L.push(detail(t, e.label));
    L.push(`~${rp(t.nominal)}~ · ${tgl(t.tanggal)}`);
  } else if (e.jenis === "lunas") {
    L.push(`✅ *Dana talang lunas* (dicatat ${e.oleh})`);
    L.push(detail(t, e.label) + ` · ${rp(t.nominal)}`);
    L.push(`Diganti ke *${t.admin}* dari ${SUMBER[t.lunasDari] || "dana bisnis"}`);
  } else if (e.jenis === "batal_lunas") {
    L.push(`↩️ *Status lunas dibatalkan* oleh ${e.oleh}`);
    L.push(detail(t, e.label) + ` · ${rp(t.nominal)} (kembali belum diganti ke ${t.admin})`);
  } else return null;
  L.push(`#${t.id}`);
  return L.join("\n");
}
function footer(r) {
  if (!r) return "";
  return `\n\n📊 _Periode ${r.label}:_\nMasuk ${rp(r.pendapatan)} · Keluar ${rp(r.pengeluaran)} · Bersih ${rp(r.bersih)}` +
    (r.talang ? `\nTalang belum diganti ${rp(r.talang)}` : "");
}

// ---------------------------------------------------------------- ambil notifikasi dari website
let polling = false;
async function poll() {
  if (polling || !cfg.groupJid) return;
  if (!wa.ready && !cfg.disableWhatsApp) return; // tunggu WhatsApp tersambung; event tidak hilang
  polling = true;
  try {
    if (state.seq == null) {
      // pertama kali jalan: mulai dari sekarang, jangan kirim catatan lama
      const r = await call({ action: "events" });
      if (r.ok) { state.seq = r.seq; saveState(); console.log("[i] Notifikasi mulai dari nomor", r.seq); }
      return;
    }
    const r = await call({ action: "events", since: state.seq });
    if (!r.ok) { if (!r.network) console.error("[!] events:", r.error); return; }
    if (r.seq < state.seq) { state.seq = r.seq; saveState(); return; } // database direset
    if (!r.events.length) return;
    const texts = r.events.map(formatEvent).filter(Boolean);
    const last = r.events[r.events.length - 1];
    // banyak catatan sekaligus -> digabung jadi satu pesan supaya grup tidak banjir
    for (let i = 0; i < texts.length; i += 8) {
      const chunk = texts.slice(i, i + 8).join("\n\n────────\n\n");
      sendTo(cfg.groupJid, chunk + (i + 8 >= texts.length ? footer(last.ringkas) : ""));
    }
    state.seq = last.seq;
    saveState();
  } finally {
    polling = false;
  }
}

// ---------------------------------------------------------------- rekap otomatis tanggal 28 pukul 23.29 WIB
async function autoReport() {
  const now = new Date(Date.now() + 7 * 3600e3);
  const today = todayWIB();
  const [hh, mm] = cfg.reportTime.split(":").map(Number);
  const passed = now.getUTCHours() * 60 + now.getUTCMinutes() >= hh * 60 + mm;
  // periode yang seharusnya sudah direkap: hari ini (tgl 28 setelah 23.29) atau periode sebelumnya
  const due = now.getUTCDate() === cfg.cutoff && passed ? periodOf(today) : prevPeriod(periodOf(today));
  if (!state.lastReport) { state.lastReport = due; saveState(); return; } // pertama kali jalan: jangan kirim rekap lama
  if (state.lastReport >= due) return;
  if (!cfg.groupJid || (!wa.ready && !cfg.disableWhatsApp)) return;
  await poll(); // kirim notifikasi yang tertunda dulu
  const r = await call({ action: "tutup", periode: due });
  if (!r.ok) { console.error("[!] Rekap otomatis gagal:", r.error); return; }
  sendTo(cfg.groupJid, r.text + `\n\n_Rekap otomatis. Mulai tanggal ${cfg.cutoff + 1} catatan masuk periode baru._\n_Detail: ${cfg.siteUrl}/admin-keuangan_`);
  state.lastReport = due;
  saveState();
  console.log("[OK] Rekap periode", due, "dikirim.");
}

// ---------------------------------------------------------------- perintah di grup (hanya membaca)
async function handle(msg) {
  const p = parseCommand(msg.text);
  if (!p) return;
  if (p.action === "idgrup") {
    if (!msg.isGroup) return msg.reply("Ketik !idgrup di dalam grup keuangan.");
    return msg.reply(`ID grup ini:\n${msg.jid}\n\nIsi di .env bot keuangan:\nFIN_GROUP_JID=${msg.jid}\nLalu restart bot.`);
  }
  if (!msg.isGroup || msg.jid !== cfg.groupJid) return; // hanya grup keuangan
  if (p.action === "help") return msg.reply(HELP);
  if (p.action === "ping") {
    return msg.reply(`Bot keuangan aktif ✅\nNotifikasi dicek setiap ${cfg.pollSeconds} detik\nRekap otomatis: tanggal ${cfg.cutoff} pukul ${cfg.reportTime} WIB\nCatat di: ${cfg.siteUrl}/admin-keuangan`);
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
    return msg.reply(`🧾 *Dana talang belum diganti: ${rp(total)}*\n\n` +
      r.tx.map((t) => `#${t.id} · ${t.admin} · ${rp(t.nominal)}\n   ${t.nama || t.ket} · ${tgl(t.tanggal)}`).join("\n") +
      `\n\nTandai lunas di ${cfg.siteUrl}/admin-keuangan`);
  }
}

setInterval(() => { poll().catch((e) => console.error("[!] poll:", e.message)); }, cfg.pollSeconds * 1000);
setInterval(() => { autoReport().catch((e) => console.error("[!] autoReport:", e.message)); }, 30 * 1000);

startWhatsApp(handle).catch((e) => { console.error(e); process.exit(1); });
console.log(`[i] Bot notifikasi keuangan berjalan. Sumber data: ${cfg.siteUrl}/admin-keuangan`);

export { handle, poll, autoReport, formatEvent, state };
