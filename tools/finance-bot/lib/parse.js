// Mengubah pesan admin menjadi transaksi. Tanpa AI: format perintah sederhana tapi longgar.
//   !wd 1.5jt                         -> withdraw Midtrans
//   !baremetal sgp-medium-1 Ryzen 7950X 1.200.000 kemarin
//   !talang domain mineidhost.net 3.330
const BLN = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };

export function todayWIB(offsetDays = 0) {
  return new Date(Date.now() + 7 * 3600e3 + offsetDays * 864e5).toISOString().slice(0, 10);
}
const pad = (n) => String(n).padStart(2, "0");
function mkDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}
function guessYear(m, d) {
  // tanpa tahun: pakai tahun ini, kecuali hasilnya jauh di masa depan (misal "28/12" saat Januari)
  const t = todayWIB(), y = Number(t.slice(0, 4));
  const s = mkDate(y, m, d);
  return s && s > todayWIB(3) ? y - 1 : y;
}

// nominal: 3.330 | 3330 | Rp1.500.000 | 1,5jt | 1.5 juta | 500rb | 500k | 2.5k
export function parseMoney(tok) {
  const s = String(tok || "").toLowerCase().replace(/^rp\.?/, "");
  const m = /^(\d+(?:[.,]\d+)*)(rb|ribu|k|jt|juta)?$/.exec(s);
  if (!m) return null;
  let n;
  if (m[2]) {
    const mult = /^(jt|juta)$/.test(m[2]) ? 1e6 : 1e3;
    // dengan satuan, titik/koma dianggap desimal ("1,5jt", "1.5jt")
    const parts = m[1].split(/[.,]/);
    n = parts.length === 2 && parts[1].length <= 2 ? parseFloat(parts[0] + "." + parts[1]) : Number(parts.join(""));
    n = Math.round(n * mult);
  } else {
    n = Number(m[1].replace(/[.,]/g, ""));
  }
  return n > 0 ? n : null;
}

// tanggal: kemarin | hari ini | 10/11 | 10-11-2026 | 2026-11-10 | 10 nov [2026] | tgl 10/11
function takeDate(words) {
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase();
    if (w === "kemarin") { words.splice(i, 1); return todayWIB(-1); }
    if (w === "lusa") continue;
    if (w === "hari" && (words[i + 1] || "").toLowerCase() === "ini") { words.splice(i, 2); return todayWIB(); }
    if (w === "tgl" || w === "tanggal") { words.splice(i, 1); i--; continue; }
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(w);
    if (m) { const d = mkDate(+m[1], +m[2], +m[3]); if (d) { words.splice(i, 1); return d; } }
    m = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(w);
    if (m) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : guessYear(+m[2], +m[1]);
      const d = mkDate(y, +m[2], +m[1]);
      if (d) { words.splice(i, 1); return d; }
    }
    m = /^(\d{1,2})$/.exec(w);
    const mon = BLN[(words[i + 1] || "").toLowerCase().slice(0, 3)];
    if (m && mon) {
      const yTok = words[i + 2] && /^\d{4}$/.test(words[i + 2]) ? +words[i + 2] : null;
      const d = mkDate(yTok || guessYear(mon, +m[1]), mon, +m[1]);
      if (d) { words.splice(i, yTok ? 3 : 2); return d; }
    }
  }
  return null;
}

function takeSource(words) {
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].toLowerCase() === "dari" && /^(midtrans|midtran|midrans|midrants|bisnis|kas)$/i.test(words[i + 1])) {
      const v = /^mid/i.test(words[i + 1]) ? "midtrans" : "bisnis";
      words.splice(i, 2);
      return v;
    }
  }
  return null;
}

function takeMoney(words) {
  // utamakan token ber-"rp" atau bersatuan, lalu angka terakhir
  let idx = words.findIndex((w) => /^rp/i.test(w) && parseMoney(w));
  if (idx < 0) idx = words.findIndex((w) => /(rb|ribu|k|jt|juta)$/i.test(w) && parseMoney(w));
  if (idx < 0) for (let i = words.length - 1; i >= 0; i--) if (/^\d/.test(words[i]) && parseMoney(words[i])) { idx = i; break; }
  // "1.5 juta" / "500 ribu" (angka dan satuan dipisah spasi)
  if (idx >= 0 && /^(rb|ribu|k|jt|juta)$/i.test(words[idx + 1] || "") && !/[a-z]$/i.test(words[idx])) {
    const n = parseMoney(words[idx] + words[idx + 1].toLowerCase());
    words.splice(idx, 2);
    return n;
  }
  if (idx < 0) return null;
  const n = parseMoney(words[idx]);
  words.splice(idx, 1);
  return n;
}

const CMD = {
  wd: "midtrans", withdraw: "midtrans", midtrans: "midtrans",
  masuk: "masuk", pemasukan: "masuk",
  cloud: "cloud", akun: "cloud",
  baremetal: "baremetal", bm: "baremetal", node: "baremetal",
  endorse: "endorse",
  jasa: "jasa", dev: "jasa", developer: "jasa", setup: "jasa_setup",
  talang: "talang", domain: "talang_domain",
  keluar: "lain", pengeluaran: "lain", lain: "lain"
};

// hasil: { action, ... } atau { error }
export function parseCommand(text) {
  const raw = String(text || "").trim();
  if (!/^[!/.]/.test(raw)) return null;
  const words = raw.slice(1).trim().split(/\s+/).filter(Boolean);
  const cmd = (words.shift() || "").toLowerCase();

  // perintah tanpa transaksi
  if (["bantuan", "help", "menu", "format"].includes(cmd)) return { action: "help" };
  if (cmd === "idgrup") return { action: "idgrup" };
  if (cmd === "saya" || cmd === "id") return { action: "saya" };
  if (cmd === "ping") return { action: "ping" };
  if (cmd === "rekap" || cmd === "laporan") return { action: "rekap", periode: parsePeriod(words) };
  if (cmd === "terakhir" || cmd === "riwayat") return { action: "terakhir" };
  if (cmd === "lunas" || cmd === "batal") {
    const id = (words.shift() || "").replace(/^#/, "").toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(id)) return { error: "Tulis ID dana talang, contoh: *!lunas K7Q2PA*" };
    if (cmd === "batal") return { action: "batal_lunas", id };
    // "!lunas K7Q2PA dari midtrans" -> diganti memakai uang Midtrans (default: dana bisnis)
    return { action: "lunas", id, dari: /mid/i.test(words.join(" ")) ? "midtrans" : "bisnis" };
  }
  if (cmd === "hapus") {
    const id = (words.shift() || "").replace(/^#/, "").toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(id)) return { error: "Tulis ID transaksi, contoh: *!hapus K7Q2PA*" };
    return { action: "hapus", id };
  }
  if (cmd === "talang" && !words.length) return { action: "talang" };

  let kind = CMD[cmd];
  if (!kind) return { error: `Perintah *!${cmd}* tidak dikenal. Ketik *!bantuan* untuk melihat format.` };

  const tanggal = takeDate(words) || todayWIB();
  const sumber = takeSource(words);
  const nominal = takeMoney(words);
  if (!nominal) return { error: "Nominal tidak terbaca. Contoh: *3.330*, *1.500.000*, *1,5jt*, atau *500rb*." };

  const tx = { nominal, tanggal };
  if (sumber) tx.sumber = sumber;
  const rest = words.join(" ").trim();

  if (kind === "masuk") {
    // !masuk midtrans 1jt  /  !masuk bisnis 500rb catatan
    const first = (words[0] || "").toLowerCase();
    if (/^mid/.test(first)) { words.shift(); kind = "midtrans"; }
    else { if (/^(bisnis|kas|lain|lainnya)$/.test(first)) words.shift(); kind = "bisnis"; }
    tx.kategori = kind;
    tx.ket = words.join(" ");
  } else if (kind === "midtrans") {
    tx.kategori = "midtrans";
    tx.ket = rest;
  } else if (kind === "cloud") {
    tx.kategori = "cloud";
    tx.nama = rest;
    if (!tx.nama) return { error: "Tulis nama/isi akun cloud. Contoh: *!cloud Vultr akun utama 250rb*" };
  } else if (kind === "baremetal") {
    tx.kategori = "baremetal";
    tx.nama = words.shift() || "";
    tx.tipe = words.join(" ");
    if (!tx.nama) return { error: "Tulis nama node. Contoh: *!baremetal sgp-medium-1 Ryzen 7950X 1,2jt*" };
  } else if (kind === "endorse") {
    tx.kategori = "endorse";
    tx.nama = rest;
    if (!tx.nama) return { error: "Tulis nama yang di-endorse. Contoh: *!endorse NamaYoutuber 300rb*" };
  } else if (kind === "jasa" || kind === "jasa_setup") {
    tx.kategori = "jasa";
    tx.nama = kind === "jasa_setup" ? ("setup " + rest).trim() : rest;
    if (!tx.nama) return { error: "Tulis jenis jasa. Contoh: *!jasa setup panel 250rb*" };
  } else if (kind === "talang" || kind === "talang_domain") {
    if (kind === "talang" && /^domain$/i.test(words[0] || "")) { words.shift(); kind = "talang_domain"; }
    if (kind === "talang_domain") {
      tx.kategori = "talang_domain";
      tx.nama = (words.shift() || "").toLowerCase();
      tx.tipe = words.join(" ") || ((tx.nama.match(/\.[a-z.]+$/) || [""])[0]);
      if (!tx.nama) return { error: "Tulis nama domain. Contoh: *!talang domain mineidhost.net 3.330*" };
    } else {
      tx.kategori = "talang_lain";
      tx.ket = rest;
      if (!tx.ket) return { error: "Tulis catatan dana talang. Contoh: *!talang beli kabel LAN 50rb*" };
    }
  } else if (kind === "lain") {
    tx.kategori = "lain";
    tx.ket = rest;
    if (!tx.ket) return { error: "Tulis untuk apa uangnya. Contoh: *!keluar sewa tools 100rb*" };
  }
  return { action: "add", tx };
}

// !rekap | !rekap nov | !rekap 2026-11 | !rekap 11/2026
function parsePeriod(words) {
  const w = words.join(" ").toLowerCase();
  let m = /(\d{4})-(\d{1,2})/.exec(w);
  if (m) return `${m[1]}-${pad(+m[2])}`;
  m = /(\d{1,2})\/(\d{4})/.exec(w);
  if (m) return `${m[2]}-${pad(+m[1])}`;
  m = /([a-z]{3})[a-z]*\s*(\d{4})?/.exec(w);
  if (m && BLN[m[1]]) {
    const y = m[2] ? +m[2] : Number(todayWIB().slice(0, 4));
    return `${y}-${pad(BLN[m[1]])}`;
  }
  return null;
}

export const HELP = `📒 *Bot Keuangan MineIDHost*

*Pemasukan*
• !wd 1.500.000 _(withdraw Midtrans)_
• !masuk bisnis 500rb catatan

*Pengeluaran*
• !cloud <nama akun> <nominal>
• !baremetal <node> <tipe> <nominal>
• !endorse <nama> <nominal>
• !jasa <jenis jasa> <nominal>  _(contoh: !jasa setup panel 250rb)_
• !keluar <catatan> <nominal>

*Dana talang* (pakai uang pribadi dulu)
• !talang domain <domain> <nominal>
• !talang <catatan> <nominal>
• !lunas <ID> _(sudah diganti)_
• !talang _(lihat yang belum diganti)_

*Lainnya*
• !rekap _(periode berjalan)_ · !rekap okt
• !terakhir _(10 catatan terakhir)_
• !hapus <ID>

Tanggal opsional: _kemarin_, _10/11_, _10 nov_. Default hari ini.
Sumber dana opsional: _dari midtrans_ / _dari bisnis_ (default bisnis).
Nominal: 3.330 · 1.500.000 · 1,5jt · 500rb`;
