/*
 * Asisten MineIDHost
 * - Mencari jawaban di data paket + semua tutorial /docs (assets/data/assistant-index.json)
 * - Kalau tidak ketemu: live chat dengan admin (tiket) lewat /api/livechat -> bot di VPS
 *   (notifikasi grup WhatsApp admin, admin membalas di /admin-chat, transkrip ke email saat ditutup)
 * - Kalau server live chat tidak tersedia: buka WhatsApp support dengan pesan siap kirim
 */
(function () {
  "use strict";
  if (window.__mdhAssistant) return;
  window.__mdhAssistant = true;

  var INDEX_URL = "/assets/data/assistant-index.json";
  var STORE_KEY = "mdh-assistant-v1";
  var DATA = null, loading = null;
  var history = [];

  /* ---------------------------------------------------------- style */
  var css = "" +
    "#mdhA-btn{position:fixed;right:20px;bottom:20px;z-index:99990;width:58px;height:58px;border:0;border-radius:50%;cursor:pointer;" +
    "background:linear-gradient(135deg,#ff1e3c,#b4001c);color:#fff;box-shadow:0 6px 24px rgba(255,0,40,.45);display:flex;align-items:center;justify-content:center;transition:transform .2s}" +
    "#mdhA-btn:hover{transform:scale(1.07)}#mdhA-btn svg{width:28px;height:28px}" +
    "#mdhA{position:fixed;right:20px;bottom:90px;z-index:99991;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);" +
    "display:none;flex-direction:column;background:#0b0b0e;border:1px solid rgba(255,255,255,.1);border-radius:16px;overflow:hidden;" +
    "box-shadow:0 20px 60px rgba(0,0,0,.65);font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#e8e8ee}" +
    "#mdhA.open{display:flex}" +
    "#mdhA .h{display:flex;align-items:center;gap:10px;padding:13px 14px;background:linear-gradient(135deg,rgba(255,23,63,.22),rgba(11,11,14,1));border-bottom:1px solid rgba(255,255,255,.08)}" +
    "#mdhA .h img{width:30px;height:30px}#mdhA .h b{display:block;font-size:15px;color:#fff}#mdhA .h small{color:#9a9aa4;font-size:12px}" +
    "#mdhA .h button{margin-left:auto;background:none;border:0;color:#aaa;font-size:24px;cursor:pointer;line-height:1;padding:0 4px}" +
    "#mdhA .m{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}" +
    "#mdhA .b{max-width:88%;padding:10px 12px;border-radius:12px;font-size:14px;line-height:1.55;word-wrap:break-word}" +
    "#mdhA .b.bot{align-self:flex-start;background:#15151a;border:1px solid rgba(255,255,255,.06);color:#d6d6de}" +
    "#mdhA .b.me{align-self:flex-end;background:#ff173f;color:#fff}" +
    "#mdhA .b a{color:#ff5a72}#mdhA .b b{color:#fff}" +
    "#mdhA .r{display:block;margin-top:8px;padding:9px 10px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0e0e12;text-decoration:none}" +
    "#mdhA .r strong{display:block;color:#fff;font-size:13.5px}#mdhA .r span{display:block;color:#9a9aa4;font-size:12.5px;margin-top:2px}" +
    "#mdhA .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}" +
    "#mdhA .acts button,#mdhA .acts a,#mdhA .chips button{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,49,80,.4);background:rgba(255,49,80,.08);" +
    "color:#ff8b9c;font-size:12.5px;cursor:pointer;text-decoration:none;font-family:inherit}" +
    "#mdhA .acts button:hover,#mdhA .chips button:hover{background:rgba(255,49,80,.18)}" +
    "#mdhA .chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px}" +
    "#mdhA form.i{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.08);background:#09090c}" +
    "#mdhA form.i input{flex:1;min-width:0;padding:11px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:#121217;color:#fff;font-size:14px;outline:none}" +
    "#mdhA form.i input:focus{border-color:rgba(255,49,80,.6)}" +
    "#mdhA form.i button.att{width:42px;background:#16161b;border:1px solid rgba(255,255,255,.1);font-size:17px}#mdhA form.i button.att[hidden]{display:none}" +
    "#mdhA img.ph{display:block;max-width:100%;max-height:260px;border-radius:9px;margin-top:4px;cursor:zoom-in;min-height:50px;background:#222;object-fit:cover}" +
    "#mdhA-lb{position:fixed;inset:0;z-index:99995;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;padding:14px}#mdhA-lb img{max-width:100%;max-height:100%;border-radius:8px}" +
    "#mdhA form.i button{width:44px;border:0;border-radius:10px;background:#ff173f;color:#fff;cursor:pointer;font-size:18px}" +
    "#mdhA .t input,#mdhA .t textarea{width:100%;box-sizing:border-box;margin-top:7px;padding:9px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.12);" +
    "background:#0e0e12;color:#fff;font-size:13.5px;font-family:inherit;outline:none}" +
    "#mdhA .t textarea{min-height:70px;resize:vertical}" +
    "#mdhA .t .hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}" +
    "#mdhA .t button{margin-top:9px;width:100%;padding:10px;border:0;border-radius:9px;background:#ff173f;color:#fff;font-weight:700;cursor:pointer;font-size:14px}" +
    "#mdhA .t button[disabled]{opacity:.6;cursor:wait}" +
    "#mdhA .dots span{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:#888;animation:mdhAd 1s infinite}" +
    "#mdhA .dots span:nth-child(2){animation-delay:.15s}#mdhA .dots span:nth-child(3){animation-delay:.3s}" +
    "#mdhA-btn .bd{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#fff;color:#ff173f;font-size:11px;font-weight:800;display:none;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.4)}" +
    "#mdhA .b.adm{border-color:rgba(255,49,80,.35)}#mdhA form.i input:disabled{opacity:.5}" +
    "@keyframes mdhAd{0%,80%,100%{opacity:.3}40%{opacity:1}}" +
    "@media(max-width:520px){#mdhA{right:8px;left:8px;width:auto;max-width:none;bottom:84px;height:calc(100vh - 168px)}#mdhA-btn{right:14px;bottom:14px}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------------------------------------------------------- markup */
  var btn = document.createElement("button");
  btn.id = "mdhA-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Buka asisten MineIDHost");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>';

  var box = document.createElement("div");
  box.id = "mdhA";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Asisten MineIDHost");
  box.innerHTML =
    '<div class="h"><img src="/assets/images/logo.svg" alt=""><div><b>Asisten MineIDHost</b><small>Jawab dari tutorial & info layanan</small></div>' +
    '<button type="button" aria-label="Tutup">&times;</button></div>' +
    '<div class="m" aria-live="polite"></div>' +
    '<div class="chips"></div>' +
    '<form class="i"><button type="button" class="att" aria-label="Kirim foto" title="Kirim foto" hidden>📷</button><input type="file" accept="image/*" hidden>' +
    '<input type="text" maxlength="400" placeholder="Tulis pertanyaan..." aria-label="Pertanyaan"><button type="submit" aria-label="Kirim">➤</button></form>';

  function mount() {
    document.body.appendChild(btn);
    document.body.appendChild(box);
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  var msgs = box.querySelector(".m");
  var chips = box.querySelector(".chips");
  var form = box.querySelector("form.i");
  var input = form.querySelector('input[type="text"]');
  var attBtn = form.querySelector(".att"), fileIn = form.querySelector('input[type="file"]');

  /* ---------------------------------------------------------- helpers */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-30))); } catch (e) {}
  }
  function scroll() { msgs.scrollTop = msgs.scrollHeight; }

  function addBubble(who, htmlOrText, isHtml, keep) {
    var d = document.createElement("div");
    d.className = "b " + (who === "me" ? "me" : "bot");
    if (isHtml) d.innerHTML = htmlOrText; else d.textContent = htmlOrText;
    msgs.appendChild(d);
    if (keep !== false) {
      history.push({ w: who, h: isHtml ? htmlOrText : esc(htmlOrText) });
      save();
    }
    scroll();
    return d;
  }

  function typing() {
    var d = document.createElement("div");
    d.className = "b bot dots";
    d.innerHTML = "<span></span><span></span><span></span>";
    msgs.appendChild(d);
    scroll();
    return d;
  }

  function setChips(list) {
    chips.innerHTML = "";
    list.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = c;
      b.addEventListener("click", function () { ask(c); });
      chips.appendChild(b);
    });
  }

  /* ---------------------------------------------------------- data */
  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (!loading) {
      loading = fetch(INDEX_URL, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error("index " + r.status);
        return r.json();
      }).then(function (d) {
        DATA = d;
        var stop = {}; d.stop.forEach(function (w) { stop[w] = 1; });
        d._stop = stop;
        d.docs.forEach(function (doc) {
          doc._t = toks(doc.t + " " + doc.s, true);
          doc._h = toks(doc.h.join(" "), true);
          doc._d = toks(doc.d, true);
          doc._x = " " + norm(doc.x) + " ";
        });
        d.answers.forEach(function (a) {
          a._kw = a.kw.map(function (g) { return g.map(function (w) { return canon(w); }); });
        });
        return d;
      }).catch(function (e) { loading = null; throw e; });
    }
    return loading;
  }

  function norm(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9.\s]/g, " ").replace(/\.(?!\d)/g, " ").replace(/\s+/g, " ").trim();
  }
  function canon(w) { return (DATA && DATA.syn[w]) || w; }
  function toks(s, asSet) {
    var out = norm(s).split(" ").filter(function (w) {
      return w.length > 1 && !(DATA && DATA._stop && DATA._stop[w]);
    }).map(canon);
    if (!asSet) return out;
    var set = {}; out.forEach(function (w) { set[w] = 1; }); return set;
  }

  function matchAnswers(q) {
    var set = {}; q.forEach(function (w) { set[w] = 1; });
    var res = [];
    DATA.answers.forEach(function (a) {
      var ok = a._kw.every(function (g) { return g.some(function (w) { return set[w]; }); });
      if (!ok) return;
      var hits = 0;
      a._kw.forEach(function (g) { g.forEach(function (w) { if (set[w]) hits++; }); });
      res.push({ a: a, s: hits });
    });
    res.sort(function (x, y) { return y.s - x.s; });
    return res.slice(0, 2).map(function (r) { return r.a; });
  }

  function matchDocs(q) {
    if (!q.length) return [];
    var uniq = q.filter(function (w, i) { return q.indexOf(w) === i; });
    var scored = DATA.docs.map(function (doc) {
      var score = 0, hit = 0;
      uniq.forEach(function (w) {
        var s = 0;
        if (doc._t[w]) s = 4;
        else if (doc._h[w]) s = 2.5;
        else if (doc._d[w]) s = 2;
        else {
          var n = doc._x.split(" " + w + " ").length - 1;
          if (!n && w.length >= 5) n = doc._x.split(w).length - 1;
          if (n) s = Math.min(1 + n / 4, 2);
        }
        if (s) { hit++; score += s; }
      });
      var cov = hit / uniq.length;
      return { doc: doc, s: score * (0.4 + cov), cov: cov, raw: score };
    }).filter(function (r) { return r.cov >= 0.5 && r.raw >= 2; });
    scored.sort(function (a, b) { return b.s - a.s; });
    if (!scored.length) return [];
    var best = scored[0].s;
    return scored.filter(function (r) { return r.s >= best * 0.55; }).slice(0, 3).map(function (r) { return r.doc; });
  }

  function snippet(doc, q) {
    var text = doc.x, low = text.toLowerCase();
    for (var i = 0; i < q.length; i++) {
      var p = low.indexOf(q[i]);
      if (p > -1) {
        var dot = low.lastIndexOf(". ", p);
        var start = dot < 0 ? 0 : dot + 2;
        if (p - start > 120) start = p - 60;
        var s = text.slice(start, start + 170).trim();
        return s + (start + 170 < text.length ? "…" : "");
      }
    }
    return doc.d;
  }

  /* ---------------------------------------------------------- flow */
  var lastQuestion = "";

  function actions(withTicket) {
    var q = encodeURIComponent((lastQuestion || "") + " minecraft");
    var h = '<div class="acts">';
    if (withTicket !== false) h += '<button type="button" data-act="ticket">Hubungi tim teknis</button>';
    h += '<a href="https://www.google.com/search?q=' + q + '" target="_blank" rel="noopener">Cari di Google</a></div>';
    return h;
  }

  function answer(question) {
    var q = toks(question);
    var ans = matchAnswers(q);
    var docs = matchDocs(q);
    var wantsHuman = ans.some(function (a) { return a.ticket; });

    if (!ans.length && !docs.length) {
      addBubble("bot", "Maaf, saya belum menemukan jawabannya di dokumentasi MineIDHost. " +
        "Saya bisa teruskan pertanyaan ini ke <b>tim teknis</b>, nanti mereka akan segera merespon kamu.", true);
      ticketForm(question);
      return;
    }
    var h = "";
    ans.forEach(function (a, i) {
      if (i) h += "<br><br>";
      h += a.a;
      if (a.links && a.links.length) {
        h += '<div class="acts">' + a.links.map(function (l) {
          var ext = /^https?:/.test(l[1]);
          return '<a href="' + esc(l[1]) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + esc(l[0]) + "</a>";
        }).join("") + "</div>";
      }
    });
    if (docs.length) {
      if (h) h += "<br>";
      h += ans.length ? "Tutorial terkait:" : "Ini tutorial yang paling cocok:";
      docs.forEach(function (d) {
        h += '<a class="r" href="' + esc(d.u) + '"><strong>' + esc(d.t) + "</strong><span>" + esc(snippet(d, q)) + "</span></a>";
      });
    }
    h += '<div style="margin-top:9px;font-size:12.5px;color:#8a8a94">Belum terjawab?</div>' + actions(true);
    addBubble("bot", h, true);
    if (wantsHuman) ticketForm(question);
  }

  function ask(text) {
    text = String(text || "").trim();
    if (!text) return;
    lastQuestion = text;
    addBubble("me", text, false);
    input.value = "";
    var t = typing();
    load().then(function () {
      setTimeout(function () { t.remove(); answer(text); }, 350);
    }).catch(function () {
      t.remove();
      addBubble("bot", "Data tutorial gagal dimuat. Kamu tetap bisa menghubungi tim teknis di bawah.", true);
      ticketForm(text);
    });
  }

  /* ---------------------------------------------------------- live chat (tiket) */
  var API = "/api/livechat";
  var LIVE_KEY = "mdh-livechat-v1";
  var live = null;          // { id, token, since, status, name }
  var pollTimer = null, unread = 0;
  var TRUSTPILOT = "https://www.trustpilot.com/evaluate/mineidhost.com";

  function api(body) {
    return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return { ok: false, error: "Respon tidak valid" }; })
          .then(function (j) { if (!r.ok && j.ok !== false) j.ok = false; j._status = r.status; return j; });
      });
  }
  function saveLive() { try { live ? localStorage.setItem(LIVE_KEY, JSON.stringify(live)) : localStorage.removeItem(LIVE_KEY); } catch (e) {} }
  function loadLive() { try { return JSON.parse(localStorage.getItem(LIVE_KEY) || "null"); } catch (e) { return null; } }

  function linkify(s) {
    return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, "<br>");
  }

  function transcript() {
    return history.slice(-12).map(function (m) {
      var div = document.createElement("div");
      div.innerHTML = m.h;
      var t = (div.textContent || "").replace(/\s+/g, " ").trim();
      return (m.w === "me" ? "Pengunjung: " : "Asisten: ") + t.slice(0, 300);
    }).join("\n");
  }

  function waFallback(name, contact, message) {
    var wa = (DATA && DATA.wa) || "6282377658840";
    var txt = "Halo MineIDHost, saya " + name + " (" + contact + ").\n" + message;
    return "https://wa.me/" + wa + "?text=" + encodeURIComponent(txt);
  }

  function setHeader(sub) { box.querySelector(".h small").textContent = sub; }

  function renderLive(m) {
    if (box.querySelector('[data-mi="' + m.i + '"]')) return;
    var d = document.createElement("div");
    var ph = m.kind === "image" ? '<img class="ph" alt="Foto">' : "";
    if (m.from === "user") {
      d.className = "b me";
      d.innerHTML = ph + linkify(m.text);
    } else if (m.from === "admin") {
      d.className = "b bot adm";
      d.innerHTML = '<div style="font-size:11.5px;color:#ff8b9c;margin-bottom:3px;font-weight:600">' + esc(m.name || "Admin") + " | MineIDHost</div>" + ph + linkify(m.text);
    } else {
      d.className = "b bot";
      d.innerHTML = linkify(m.text);
    }
    d.setAttribute("data-mi", m.i);
    msgs.appendChild(d);
    if (m.kind === "image" && live) loadImg(d.querySelector("img.ph"), m.file);
  }

  var blobs = {};
  function loadImg(img, file) {
    var key = live.id + "/" + file;
    var show = function (u) { img.src = u; img.onload = scroll; };
    if (blobs[key]) show(blobs[key]);
    else fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "file", id: live.id, token: live.token, file: file }) })
      .then(function (r) { if (!r.ok) throw new Error(); return r.blob(); })
      .then(function (b) { blobs[key] = URL.createObjectURL(b); show(blobs[key]); })
      .catch(function () { img.alt = "Foto gagal dimuat"; img.style.minHeight = "0"; });
    img.addEventListener("click", function () {
      if (!img.src) return;
      var lb = document.createElement("div"); lb.id = "mdhA-lb"; lb.innerHTML = '<img alt="">';
      lb.querySelector("img").src = img.src; lb.addEventListener("click", function () { lb.remove(); });
      document.body.appendChild(lb);
    });
  }

  // kecilkan foto di browser sebelum dikirim (maks 1600px, JPEG)
  function compressImage(file, cb) {
    if (!/^image\//.test(file.type)) return cb("File harus berupa foto.");
    if (file.size > 25 * 1024 * 1024) return cb("Foto terlalu besar (maks 25 MB).");
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var max = 1600, w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      var cv = document.createElement("canvas"); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      var cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      var q = 0.82, data = cv.toDataURL("image/jpeg", q);
      while (data.length > 3000000 && q > 0.4) { q -= 0.12; data = cv.toDataURL("image/jpeg", q); }
      if (data.length > 3000000) return cb("Foto terlalu besar setelah dikompres.");
      cb(null, data);
    };
    im.onerror = function () { URL.revokeObjectURL(url); cb("Foto tidak bisa dibaca."); };
    im.src = url;
  }

  attBtn.addEventListener("click", function () { if (live && live.status !== "closed") fileIn.click(); });
  fileIn.addEventListener("change", function () {
    var f = fileIn.files && fileIn.files[0]; fileIn.value = "";
    if (!f || !live) return;
    var tmp = addBubble("me", "📷 Mengirim foto...", false, false);
    tmp.style.opacity = ".6";
    compressImage(f, function (err, data) {
      if (err) { tmp.remove(); addBubble("bot", esc(err), true, false); return; }
      var caption = input.value.trim(); input.value = "";
      api({ action: "send_image", id: live.id, token: live.token, data: data, caption: caption, since: live.since }).then(function (r) {
        tmp.remove();
        if (r.messages) applyLive(r);
        if (!r.ok && r.error) addBubble("bot", esc(r.error), true, false);
      }).catch(function () {
        tmp.remove();
        addBubble("bot", "Foto gagal terkirim, cek koneksi lalu coba lagi.", true, false);
      });
    });
  });

  function applyLive(res) {
    if (!live || !res) return;
    var list = res.messages || [];
    var newAdmin = 0;
    list.forEach(function (m) {
      if (m.i > live.since) {
        renderLive(m);
        live.since = m.i;
        if (m.from !== "user") newAdmin++;
      }
    });
    if (res.status) live.status = res.status;
    saveLive();
    if (list.length) scroll();
    if (newAdmin && !box.classList.contains("open")) { unread += newAdmin; badge(); }
    liveControls();
  }

  function badge() {
    var b = btn.querySelector(".bd");
    if (!b) { b = document.createElement("span"); b.className = "bd"; btn.appendChild(b); }
    b.textContent = unread > 9 ? "9+" : String(unread);
    b.style.display = unread ? "flex" : "none";
  }

  function liveControls() {
    chips.innerHTML = "";
    attBtn.hidden = !live || live.status === "closed";
    if (!live) { setChips(["Harga paket", "Cara bayar", "Setup Geyser", "Server lag", "Hubungi admin"]); return; }
    if (live.status === "confirming") {
      setHeader("Tiket " + live.id + " · menunggu konfirmasi kamu");
      [["Sudah selesai, terima kasih", "Sudah selesai ✅"], ["Masih ada pertanyaan", "Masih ada pertanyaan"]].forEach(function (c) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = c[1];
        b.addEventListener("click", function () { liveSend(c[0]); });
        chips.appendChild(b);
      });
      input.disabled = false;
    } else if (live.status === "closed") {
      setHeader("Tiket " + live.id + " · ditutup");
      var a = document.createElement("button"); a.type = "button"; a.textContent = "⭐ Beri rating di Trustpilot";
      a.addEventListener("click", function () { window.open(TRUSTPILOT, "_blank", "noopener"); });
      var n = document.createElement("button"); n.type = "button"; n.textContent = "Mulai chat baru";
      n.addEventListener("click", resetLive);
      chips.appendChild(a); chips.appendChild(n);
      input.disabled = true;
      input.placeholder = "Tiket sudah ditutup";
      stopPoll();
    } else {
      setHeader("Live chat · Tiket " + live.id);
      input.disabled = false;
      input.placeholder = "Tulis pesan ke tim MineIDHost...";
    }
  }

  function resetLive() {
    live = null; saveLive(); stopPoll();
    input.disabled = false; input.placeholder = "Tulis pertanyaan...";
    setHeader("Jawab dari tutorial & info layanan");
    msgs.innerHTML = ""; history = []; save();
    addBubble("bot", "Ada lagi yang bisa dibantu? Tanyakan saja di sini 😊", true);
    liveControls();
  }

  function poll() {
    if (!live || live.status === "closed") return;
    api({ action: "poll", id: live.id, token: live.token, since: live.since }).then(function (r) {
      if (r.ok) applyLive(r);
      else if (r._status === 404) { live.status = "closed"; saveLive(); liveControls(); }
    }).catch(function () {});
  }
  function startPoll() {
    stopPoll();
    if (!live || live.status === "closed") return;
    var ms = box.classList.contains("open") ? 3000 : 20000;
    pollTimer = setInterval(poll, ms);
  }
  function stopPoll() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

  function liveSend(text) {
    text = String(text || "").trim();
    if (!text || !live) return;
    input.value = "";
    var tmp = addBubble("me", text, false, false);
    tmp.style.opacity = ".6";
    api({ action: "send", id: live.id, token: live.token, text: text, since: live.since }).then(function (r) {
      tmp.remove();
      if (r.messages) applyLive(r);
      if (!r.ok && r.error) addBubble("bot", esc(r.error), true, false);
    }).catch(function () {
      tmp.style.opacity = "1";
      addBubble("bot", "Pesan gagal terkirim, cek koneksi lalu coba lagi.", true, false);
    });
  }

  function enterLive(res, name) {
    live = { id: res.id, token: res.token, since: 0, status: res.status || "open", name: name };
    saveLive();
    msgs.querySelectorAll(".t").forEach(function (n) { n.remove(); });
    addBubble("bot", "<b>Terhubung ke live chat MineIDHost</b> · Tiket " + esc(res.id), true, false);
    applyLive(res);
    startPoll();
  }

  function ticketForm(question) {
    if (live && live.status !== "closed") { input.focus(); return; }
    var d = document.createElement("div");
    d.className = "b bot t";
    d.innerHTML =
      "<b>Chat dengan tim teknis</b>" +
      '<div style="font-size:12.5px;color:#9a9aa4;margin-top:2px">Admin akan membalas langsung di chat ini. Transkrip dikirim ke email kamu setelah selesai.</div>' +
      "<form novalidate>" +
      '<input name="name" maxlength="60" placeholder="Nama kamu" autocomplete="name">' +
      '<input name="email" type="email" maxlength="120" placeholder="Email (untuk transkrip)" autocomplete="email">' +
      '<input name="whatsapp" maxlength="30" placeholder="No. WhatsApp (opsional)" autocomplete="tel">' +
      '<textarea name="message" maxlength="1500" placeholder="Jelaskan masalahnya"></textarea>' +
      '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<button type="submit">Mulai live chat</button>' +
      '<div class="e" style="color:#ff8b9c;font-size:12.5px;margin-top:6px"></div>' +
      "</form>";
    msgs.appendChild(d);
    var f = d.querySelector("form");
    f.message.value = question || lastQuestion || "";
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY + "-me") || "{}");
      if (saved.n) f.name.value = saved.n;
      if (saved.e) f.email.value = saved.e;
      if (saved.w) f.whatsapp.value = saved.w;
    } catch (e) {}
    scroll();

    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var err = f.querySelector(".e");
      var name = f.name.value.trim(), email = f.email.value.trim(), wa = f.whatsapp.value.trim(), message = f.message.value.trim();
      if (name.length < 2) { err.textContent = "Isi nama kamu."; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = "Isi email yang valid, transkrip chat dikirim ke sini."; return; }
      if (wa && wa.replace(/\D/g, "").length < 9) { err.textContent = "Nomor WhatsApp belum lengkap (boleh dikosongkan)."; return; }
      if (message.length < 3) { err.textContent = "Tulis pertanyaan kamu."; return; }
      err.textContent = "";
      try { localStorage.setItem(STORE_KEY + "-me", JSON.stringify({ n: name, e: email, w: wa })); } catch (e) {}
      var b = f.querySelector("button");
      b.disabled = true; b.textContent = "Menghubungkan...";
      api({ action: "create", name: name, email: email, whatsapp: wa, message: message, transcript: transcript(), page: location.href, website: f.website.value })
        .then(function (r) {
          if (!r.ok) throw new Error(r.error || "gagal");
          enterLive(r, name);
        }).catch(function (e) {
          b.disabled = false; b.textContent = "Mulai live chat";
          var msg = e && e.message && !/fetch|network/i.test(e.message) && !/tersedia|dikonfigurasi/i.test(e.message) ? esc(e.message) + " " : "Live chat sedang tidak tersedia. ";
          err.innerHTML = msg + '<a href="' + waFallback(name, email, message) + '" target="_blank" rel="noopener" style="color:#ff5a72">Kirim lewat WhatsApp</a> saja, pesannya sudah disiapkan.';
          scroll();
        });
    });
  }

  msgs.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest('[data-act="ticket"]');
    if (t) ticketForm(lastQuestion);
  });

  /* ---------------------------------------------------------- open/close */
  var started = false;
  function open() {
    box.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    unread = 0; badge();
    if (!started) {
      started = true;
      live = loadLive();
      if (live) {
        msgs.innerHTML = "";
        addBubble("bot", "<b>Live chat MineIDHost</b> · Tiket " + esc(live.id), true, false);
        var since = 0; live.since = 0;
        api({ action: "poll", id: live.id, token: live.token, since: since }).then(function (r) {
          if (r.ok) applyLive(r); else { live = null; saveLive(); resetLive(); }
        }).catch(function () {});
      } else {
        var old = [];
        try { old = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch (e) {}
        if (old.length) {
          old.forEach(function (m) { addBubble(m.w, m.h, true, false); history.push(m); });
        } else {
          addBubble("bot", "Hai! 👋 Saya asisten MineIDHost. Tanyakan soal paket, pembayaran, atau masalah server. " +
            "Saya carikan jawabannya dari tutorial kami, dan kalau tidak ketemu kamu bisa langsung live chat dengan tim teknis.", true);
        }
      }
      liveControls();
      load().catch(function () {});
    } else if (live) {
      poll();
    }
    startPoll();
    setTimeout(function () { if (!input.disabled) input.focus(); }, 50);
  }
  function close() {
    box.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    startPoll();
  }
  btn.addEventListener("click", function () { box.classList.contains("open") ? close() : open(); });
  box.querySelector(".h button").addEventListener("click", close);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (live && live.status !== "closed") liveSend(input.value); else ask(input.value);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  // lanjutkan polling di latar belakang kalau ada tiket aktif (untuk badge balasan admin)
  (function () {
    var l = loadLive();
    if (l && l.status !== "closed") { live = l; startPoll(); }
  })();

  window.MDHAssistant = { open: open, ask: function (q) { open(); ask(q); } };
})();
