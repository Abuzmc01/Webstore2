// Uji format perintah: node test.js
import assert from "node:assert/strict";
import { parseCommand, parseMoney, todayWIB } from "./lib/parse.js";

const T = todayWIB(), Y = T.slice(0, 4);
const cases = [
  ["!wd 1.500.000", { kategori: "midtrans", nominal: 1500000, tanggal: T }],
  ["!withdraw 1,5jt kemarin", { kategori: "midtrans", nominal: 1500000, tanggal: todayWIB(-1) }],
  ["!masuk bisnis 500rb setoran mitra", { kategori: "bisnis", nominal: 500000, ket: "setoran mitra" }],
  ["!masuk midtrans 2 juta", { kategori: "midtrans", nominal: 2000000 }],
  ["!talang domain mineidhost.net 3.330", { kategori: "talang_domain", nama: "mineidhost.net", tipe: ".net", nominal: 3330 }],
  ["!domain mdh.my.id 15rb 10/11", { kategori: "talang_domain", nama: "mdh.my.id", tipe: ".my.id", nominal: 15000, tanggal: Y + "-11-10" }],
  ["!baremetal sgp-medium-1 Ryzen 9 7950X 1.200.000 tgl 5 nov", { kategori: "baremetal", nama: "sgp-medium-1", tipe: "Ryzen 9 7950X", nominal: 1200000, tanggal: Y + "-11-05" }],
  ["!bm basic-2 128GB Rp850.000 dari midtrans", { kategori: "baremetal", nama: "basic-2", tipe: "128GB", nominal: 850000, sumber: "midtrans" }],
  ["!cloud Vultr akun utama 250rb", { kategori: "cloud", nama: "Vultr akun utama", nominal: 250000 }],
  ["!endorse Windah Basudara 1jt", { kategori: "endorse", nama: "Windah Basudara", nominal: 1000000 }],
  ["!jasa setup panel 250k", { kategori: "jasa", nama: "setup panel", nominal: 250000 }],
  ["!setup pterodactyl 300rb", { kategori: "jasa", nama: "setup pterodactyl", nominal: 300000 }],
  ["!talang beli kabel LAN 50rb", { kategori: "talang_lain", ket: "beli kabel LAN", nominal: 50000 }],
  ["!keluar sewa tools 100.000 2026-11-01", { kategori: "lain", ket: "sewa tools", nominal: 100000, tanggal: "2026-11-01" }],
];
let n = 0;
for (const [text, want] of cases) {
  const r = parseCommand(text);
  assert.equal(r.action, "add", text + " → " + JSON.stringify(r));
  for (const k of Object.keys(want)) assert.equal(r.tx[k], want[k], `${text} [${k}] → ${JSON.stringify(r.tx)}`);
  n++;
}
assert.equal(parseCommand("!baremetal basic-1 Xeon 900rb pakai refund voucher").tx.sumber, "voucher");
assert.equal(parseCommand("!baremetal basic-1 Xeon 900rb pakai refund voucher").tx.tipe, "Xeon");
assert.equal(parseCommand("!cloud Vultr 100rb dari voucher").tx.sumber, "voucher");
assert.deepEqual(parseCommand("!lunas k7q2pa"), { action: "lunas", id: "K7Q2PA", dari: "bisnis" });
assert.equal(parseCommand("!lunas K7Q2PA dari midtrans").dari, "midtrans");
assert.equal(parseCommand("!talang").action, "talang");
assert.equal(parseCommand("!rekap okt").periode, Y + "-10");
assert.equal(parseCommand("!rekap 2026-09").periode, "2026-09");
assert.equal(parseCommand("!rekap").periode, null);
assert.ok(parseCommand("!wd").error);
assert.ok(parseCommand("!cloud 100rb").error);
assert.ok(parseCommand("!xyz 100").error);
assert.equal(parseCommand("halo"), null);
assert.equal(parseMoney("3,5jt"), 3500000);
assert.equal(parseMoney("2.5k"), 2500);
assert.equal(parseMoney("1.250.000"), 1250000);
console.log(`OK: ${n} transaksi + perintah lain lolos uji`);
