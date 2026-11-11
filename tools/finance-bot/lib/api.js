// Membaca data dari website (mineidhost.com/api/keuangan). Bot tidak bisa mencatat.
import { cfg } from "./config.js";

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
