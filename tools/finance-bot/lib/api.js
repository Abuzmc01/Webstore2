// Kirim data ke website (mineidhost.com/api/keuangan). Catatan baru yang gagal terkirim disimpan di antrean.
import fs from "node:fs";
import path from "node:path";
import { cfg } from "./config.js";

const QUEUE = path.join(cfg.dataDir, "antrean.json");
fs.mkdirSync(cfg.dataDir, { recursive: true });

let queue = [];
try { if (fs.existsSync(QUEUE)) queue = JSON.parse(fs.readFileSync(QUEUE, "utf8")); } catch { queue = []; }
const saveQueue = () => fs.writeFileSync(QUEUE, JSON.stringify(queue));

export async function call(body, timeoutMs = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(cfg.siteUrl + "/api/keuangan", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Fin-Secret": cfg.botSecret },
      body: JSON.stringify(body),
      signal: ctl.signal
    });
    const j = await r.json().catch(() => ({ ok: false, error: "Respon website tidak valid (HTTP " + r.status + ")" }));
    j.status = r.status;
    return j;
  } catch (e) {
    return { ok: false, network: true, error: e.name === "AbortError" ? "Website tidak menjawab (timeout)" : "Website tidak bisa dihubungi" };
  } finally {
    clearTimeout(t);
  }
}

// catatan baru: kalau website sedang tidak bisa dihubungi, simpan dan kirim ulang nanti.
// "kunci" (ID pesan WhatsApp) mencegah catatan ganda saat dikirim ulang.
export async function addTx(tx, oleh, kunci) {
  const r = await call({ action: "add", tx, oleh, kunci });
  if (r.network) {
    queue.push({ tx, oleh, kunci, waktu: Date.now() });
    saveQueue();
    r.queued = true;
  }
  return r;
}

export async function flushQueue(onSent) {
  while (queue.length) {
    const job = queue[0];
    const r = await call({ action: "add", tx: job.tx, oleh: job.oleh, kunci: job.kunci });
    if (r.network) return;
    queue.shift();
    saveQueue();
    if (onSent) await onSent(job, r).catch(() => {});
  }
}
export const queueSize = () => queue.length;
