// Kirim transkrip chat lewat Gmail (App Password)
import nodemailer from "nodemailer";
import { cfg } from "./config.js";
import { uploadPath } from "./store.js";

let transport = null;
function getTransport() {
  if (transport) return transport;
  if (!cfg.gmailUser || !cfg.gmailAppPassword) return null;
  transport = cfg.smtpHost
    ? nodemailer.createTransport({ host: cfg.smtpHost, port: cfg.smtpPort, secure: cfg.smtpPort === 465, auth: { user: cfg.gmailUser, pass: cfg.gmailAppPassword } })
    : nodemailer.createTransport({ service: "gmail", auth: { user: cfg.gmailUser, pass: cfg.gmailAppPassword } });
  return transport;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (t) => new Date(t).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
const who = (m) => (m.from === "user" ? m.name || "Pelanggan" : m.from === "admin" ? `${m.name || "Admin"} | MineIDHost` : "Asisten MineIDHost");

const body = (m) => (m.kind === "image" ? `📷 Foto (lampiran ${m.file})${m.text ? "\n" + m.text : ""}` : m.text);

function transcriptText(t) {
  return t.messages.map((m) => `[${fmt(m.t)}] ${who(m)}:\n${body(m)}`).join("\n\n");
}

function attachments(t) {
  return t.messages
    .filter((m) => m.kind === "image")
    .map((m) => ({ filename: m.file, path: uploadPath(t, m.file) }))
    .filter((a) => a.path)
    .slice(0, 15);
}

function transcriptHtml(t, forSupport) {
  const rows = t.messages.map((m) => {
    const bg = m.from === "user" ? "#fff5f6" : m.from === "admin" ? "#f4f6ff" : "#f6f6f6";
    return `<tr><td style="padding:10px 12px;background:${bg};border-bottom:1px solid #eee">
      <div style="font-size:12px;color:#777">${esc(fmt(m.t))} · <b style="color:#222">${esc(who(m))}</b></div>
      <div style="margin-top:4px;white-space:pre-wrap;color:#222;font-size:14px">${esc(body(m))}</div></td></tr>`;
  }).join("");
  const extra = forSupport
    ? `<p style="font-size:13px;color:#555">Pelanggan: <b>${esc(t.name)}</b> · ${esc(t.email)}${t.whatsapp ? " · WA " + esc(t.whatsapp) : ""}<br>
       Halaman: ${esc(t.page || "-")} · IP: ${esc(t.ip || "-")} · Ditutup oleh: ${esc(t.closedBy || "-")}</p>
       ${t.assistant ? `<p style="font-size:13px;color:#555"><b>Riwayat dengan asisten sebelum tiket:</b><br><span style="white-space:pre-wrap">${esc(t.assistant)}</span></p>` : ""}`
    : `<p style="font-size:14px;color:#333">Halo ${esc(t.name)}, terima kasih sudah menghubungi MineIDHost. Berikut transkrip percakapan kamu dengan tim kami.</p>`;
  const rating = forSupport ? "" : `
    <div style="margin:22px 0;padding:18px;border:1px solid #ffd0d7;border-radius:10px;background:#fff7f8;text-align:center">
      <p style="margin:0 0 12px;font-size:14px;color:#333">Bagaimana pelayanan kami? Ulasan kamu sangat membantu MineIDHost berkembang.</p>
      <a href="${esc(cfg.trustpilotUrl)}" style="display:inline-block;padding:11px 20px;border-radius:8px;background:#ff173f;color:#fff;font-weight:bold;text-decoration:none">Beri rating di Trustpilot ⭐</a>
    </div>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222">
    <h2 style="margin:0 0 6px;color:#ff173f">MineIDHost Support</h2>
    <p style="margin:0 0 14px;font-size:13px;color:#777">Tiket <b>${esc(t.id)}</b> · dibuka ${esc(fmt(t.created))} · ditutup ${esc(fmt(t.closedAt || Date.now()))}</p>
    ${extra}${rating}
    <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px">${rows}</table>
    <p style="margin-top:18px;font-size:12px;color:#999">Butuh bantuan lagi? Buka chat di ${esc(cfg.siteUrl)} atau Discord dsc.gg/mineidhost.</p>
  </div>`;
}

export async function sendTranscript(t) {
  const tr = getTransport();
  if (!tr) return "email belum dikonfigurasi";
  const from = `"MineIDHost Support" <${cfg.gmailUser}>`;
  const results = [];
  try {
    await tr.sendMail({
      from, to: t.email, replyTo: cfg.supportEmail,
      subject: `Transkrip chat MineIDHost – Tiket ${t.id}`,
      text: `Halo ${t.name},\n\nTerima kasih sudah menghubungi MineIDHost. Berikut transkrip chat tiket ${t.id}.\n\n${transcriptText(t)}\n\nBeri rating pelayanan kami di Trustpilot: ${cfg.trustpilotUrl}\n`,
      html: transcriptHtml(t, false),
      attachments: attachments(t),
    });
    results.push("pelanggan: terkirim");
  } catch (e) { results.push("pelanggan: gagal (" + e.message + ")"); }
  try {
    await tr.sendMail({
      from, to: cfg.supportEmail, replyTo: t.email,
      subject: `[Tiket ditutup] ${t.id} – ${t.name}`,
      text: `Tiket ${t.id} ditutup oleh ${t.closedBy}.\nPelanggan: ${t.name} <${t.email}> ${t.whatsapp}\n\n${transcriptText(t)}`,
      html: transcriptHtml(t, true),
      attachments: attachments(t),
    });
    results.push("support: terkirim");
  } catch (e) { results.push("support: gagal (" + e.message + ")"); }
  return results.join(", ");
}

export async function sendLoginCode(email, code, name) {
  const tr = getTransport();
  if (!tr) throw new Error("Gmail bot belum dikonfigurasi (GMAIL_APP_PASSWORD)");
  await tr.sendMail({
    from: `"MineIDHost Admin" <${cfg.gmailUser}>`,
    to: email,
    subject: `Kode login admin MineIDHost: ${code}`,
    text: `Kode login admin chat MineIDHost untuk ${name || email}: ${code}\n\nBerlaku 10 menit. Jangan berikan kode ini ke siapa pun. Abaikan email ini kalau kamu tidak mencoba login.`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#222">
      <h2 style="color:#ff173f;margin:0 0 10px">MineIDHost Admin</h2>
      <p>Kode login admin chat untuk <b>${esc(name || email)}</b>:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px;text-align:center;background:#fff5f6;border:1px solid #ffd0d7;border-radius:10px">${esc(code)}</div>
      <p style="font-size:13px;color:#666">Berlaku 10 menit. Jangan berikan kode ini ke siapa pun. Abaikan email ini kalau kamu tidak mencoba login.</p></div>`,
  });
}
