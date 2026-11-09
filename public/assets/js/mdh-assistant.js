/*
 * Asisten MineIDHost
 * - Mencari jawaban di data paket + semua tutorial /docs (assets/data/assistant-index.json)
 * - Kalau tidak ketemu: buat tiket -> /api/ticket -> bot WhatsApp -> grup admin (tag semua)
 * - Kalau server tiket tidak tersedia: buka WhatsApp support dengan pesan siap kirim
 */
(function () {
  "use strict";
  if (window.__mdhAssistant) return;
  window.__mdhAssistant = true;

  var INDEX_URL = "/assets/data/assistant-index.json";
  var TICKET_URL = "/api/ticket";
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
    "#mdhA form.i button{width:44px;border:0;border-radius:10px;background:#ff173f;color:#fff;cursor:pointer;font-size:18px}" +
    "#mdhA .t input,#mdhA .t textarea{width:100%;box-sizing:border-box;margin-top:7px;padding:9px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.12);" +
    "background:#0e0e12;color:#fff;font-size:13.5px;font-family:inherit;outline:none}" +
    "#mdhA .t textarea{min-height:70px;resize:vertical}" +
    "#mdhA .t .hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}" +
    "#mdhA .t button{margin-top:9px;width:100%;padding:10px;border:0;border-radius:9px;background:#ff173f;color:#fff;font-weight:700;cursor:pointer;font-size:14px}" +
    "#mdhA .t button[disabled]{opacity:.6;cursor:wait}" +
    "#mdhA .dots span{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:#888;animation:mdhAd 1s infinite}" +
    "#mdhA .dots span:nth-child(2){animation-delay:.15s}#mdhA .dots span:nth-child(3){animation-delay:.3s}" +
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
    '<form class="i"><input type="text" maxlength="400" placeholder="Tulis pertanyaan..." aria-label="Pertanyaan"><button type="submit" aria-label="Kirim">➤</button></form>';

  function mount() {
    document.body.appendChild(btn);
    document.body.appendChild(box);
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  var msgs = box.querySelector(".m");
  var chips = box.querySelector(".chips");
  var form = box.querySelector("form.i");
  var input = form.querySelector("input");

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

  /* ---------------------------------------------------------- ticket */
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

  function ticketForm(question) {
    var d = document.createElement("div");
    d.className = "b bot t";
    d.innerHTML =
      "<b>Hubungi tim teknis</b>" +
      '<form novalidate>' +
      '<input name="name" maxlength="60" placeholder="Nama kamu" required autocomplete="name">' +
      '<input name="contact" maxlength="80" placeholder="Nomor WhatsApp atau email" required autocomplete="tel">' +
      '<textarea name="message" maxlength="1500" placeholder="Jelaskan masalahnya" required></textarea>' +
      '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<button type="submit">Kirim ke tim teknis</button>' +
      '<div class="e" style="color:#ff8b9c;font-size:12.5px;margin-top:6px"></div>' +
      "</form>";
    msgs.appendChild(d);
    var f = d.querySelector("form");
    f.message.value = question || lastQuestion || "";
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY + "-me") || "{}");
      if (saved.n) f.name.value = saved.n;
      if (saved.c) f.contact.value = saved.c;
    } catch (e) {}
    scroll();

    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var err = f.querySelector(".e");
      var name = f.name.value.trim(), contact = f.contact.value.trim(), message = f.message.value.trim();
      var isMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
      var digits = contact.replace(/[^\d]/g, "");
      if (name.length < 2) { err.textContent = "Isi nama kamu."; return; }
      if (!isMail && digits.length < 9) { err.textContent = "Isi nomor WhatsApp (contoh 0812xxxx) atau email yang valid."; return; }
      if (message.length < 5) { err.textContent = "Jelaskan masalahnya sedikit lebih detail."; return; }
      err.textContent = "";
      try { localStorage.setItem(STORE_KEY + "-me", JSON.stringify({ n: name, c: contact })); } catch (e) {}

      var b = f.querySelector("button");
      b.disabled = true; b.textContent = "Mengirim...";
      fetch(TICKET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name, contact: contact, message: message,
          transcript: transcript(), page: location.href, website: f.website.value
        })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, j: j }; });
      }).then(function (res) {
        if (!res.ok) throw new Error(res.j && res.j.error || "gagal");
        d.innerHTML = "<b>Tiket " + esc(res.j.id || "") + " terkirim ✅</b><br>" +
          "Pertanyaan kamu sudah diteruskan ke tim teknis MineIDHost. Tim kami akan <b>segera merespon</b> lewat " +
          (isMail ? "email" : "WhatsApp") + " <b>" + esc(contact) + "</b>.";
        history.push({ w: "bot", h: d.innerHTML }); save();
        scroll();
      }).catch(function () {
        b.disabled = false; b.textContent = "Kirim ke tim teknis";
        err.innerHTML = 'Server tiket sedang tidak tersedia. <a href="' + waFallback(name, contact, message) +
          '" target="_blank" rel="noopener" style="color:#ff5a72">Kirim lewat WhatsApp</a> saja, pesannya sudah disiapkan.';
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
    if (!started) {
      started = true;
      var old = [];
      try { old = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch (e) {}
      if (old.length) {
        old.forEach(function (m) { addBubble(m.w, m.h, true, false); history.push(m); });
      } else {
        addBubble("bot", "Hai! 👋 Saya asisten MineIDHost. Tanyakan soal paket, pembayaran, atau masalah server. " +
          "Saya carikan jawabannya dari tutorial kami, dan kalau tidak ketemu saya teruskan ke tim teknis.", true);
      }
      setChips(["Harga paket", "Cara bayar", "Setup Geyser", "Server lag", "Hubungi admin"]);
      load().catch(function () {});
    }
    setTimeout(function () { input.focus(); }, 50);
  }
  function close() {
    box.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }
  btn.addEventListener("click", function () { box.classList.contains("open") ? close() : open(); });
  box.querySelector(".h button").addEventListener("click", close);
  form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  window.MDHAssistant = { open: open, ask: function (q) { open(); ask(q); } };
})();
