// Perintah grup (hanya membaca). Pencatatan dilakukan di website, bukan lewat bot.
const BLN = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

export function todayWIB(offsetDays = 0) {
  return new Date(Date.now() + 7 * 3600e3 + offsetDays * 864e5).toISOString().slice(0, 10);
}

export function parseCommand(text) {
  const raw = String(text || "").trim();
  if (!/^[!/.]/.test(raw)) return null;
  const words = raw.slice(1).trim().split(/\s+/).filter(Boolean);
  const cmd = (words.shift() || "").toLowerCase();
  if (["bantuan", "help", "menu"].includes(cmd)) return { action: "help" };
  if (cmd === "idgrup") return { action: "idgrup" };
  if (cmd === "ping") return { action: "ping" };
  if (cmd === "rekap" || cmd === "laporan") return { action: "rekap", periode: parsePeriod(words) };
  if (cmd === "talang") return { action: "talang" };
  return null; // perintah lain diabaikan (pencatatan lewat website)
}

// !rekap | !rekap okt | !rekap 2026-11 | !rekap 11/2026
export function parsePeriod(words) {
  const w = words.join(" ").toLowerCase();
  let m = /(\d{4})-(\d{1,2})/.exec(w);
  if (m) return `${m[1]}-${pad(+m[2])}`;
  m = /(\d{1,2})\/(\d{4})/.exec(w);
  if (m) return `${m[2]}-${pad(+m[1])}`;
  m = /([a-z]{3})[a-z]*\s*(\d{4})?/.exec(w);
  if (m && BLN[m[1]]) return `${m[2] ? +m[2] : Number(todayWIB().slice(0, 4))}-${pad(BLN[m[1]])}`;
  return null;
}

export const HELP = `📒 *Bot Keuangan MineIDHost*

Bot ini hanya mengirim *notifikasi*. Semua pencatatan dilakukan di website:
mineidhost.com/admin-keuangan

*Otomatis*
• Setiap ada catatan baru, diubah, dihapus, atau dana talang lunas → notifikasi ke grup ini
• Tanggal 28 pukul 23.29 WIB → rekap total bulan ini. Tanggal 29 mulai periode baru.

*Perintah*
• !rekap — rekap sementara periode berjalan
• !rekap okt — rekap periode tertentu
• !talang — dana talang yang belum diganti
• !ping — cek bot aktif`;
