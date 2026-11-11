// Uji perintah grup: node test.js
import assert from "node:assert/strict";
import { parseCommand, todayWIB } from "./lib/parse.js";
const Y = todayWIB().slice(0, 4);
assert.equal(parseCommand("!rekap").action, "rekap");
assert.equal(parseCommand("!rekap okt").periode, Y + "-10");
assert.equal(parseCommand("!rekap 2026-09").periode, "2026-09");
assert.equal(parseCommand("!talang").action, "talang");
assert.equal(parseCommand("!ping").action, "ping");
assert.equal(parseCommand("!idgrup").action, "idgrup");
assert.equal(parseCommand("!wd 1jt"), null, "pencatatan lewat bot sudah tidak ada");
assert.equal(parseCommand("halo"), null);
console.log("OK: perintah grup lolos uji");
