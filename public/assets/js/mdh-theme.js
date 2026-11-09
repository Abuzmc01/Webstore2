/* Pilihan tema terang / gelap MineIDHost (lihat /assets/css/mdh-theme.css) */
(function () {
  "use strict";
  if (window.__mdhTheme) return;
  window.__mdhTheme = true;

  var KEY = "mdh-theme";
  var root = document.documentElement;
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/></svg>';
  var buttons = [];

  function current() { return root.getAttribute("data-theme") === "light" ? "light" : "dark"; }

  function render() {
    var light = current() === "light";
    buttons.forEach(function (b) {
      // di tema gelap tampilkan matahari (pindah ke terang), di tema terang tampilkan bulan
      b.innerHTML = (light ? MOON : SUN) + '<span class="lbl">' + (light ? "Gelap" : "Terang") + "</span>";
      b.title = light ? "Ganti ke tema gelap" : "Ganti ke tema terang";
      b.setAttribute("aria-label", b.title);
      b.setAttribute("aria-pressed", String(light));
    });
  }

  function apply(t) {
    if (t === "light") root.setAttribute("data-theme", "light");
    else root.setAttribute("data-theme", "dark");
    try { localStorage.setItem(KEY, t); } catch (e) {}
    if (t === "light") scan();
    render();
  }

  // Elemen yang warnanya dikembalikan ke asli di tema terang:
  // - punya gambar latar (foto), atau
  // - berlatar merah khas MineIDHost (tombol, badge), supaya tidak berubah jadi pink pucat
  var RED = /rgba?\(\s*(2[0-5]\d|1[89]\d)\s*,\s*(\d{1,2}|[1-8]\d)\s*,\s*(\d{1,2}|1[01]\d|[2-9]\d)\s*(,\s*(1|0?\.[3-9]\d*))?\s*\)/;
  function needsRestore(el) {
    var cs = getComputedStyle(el);
    var bg = cs.backgroundImage || "";
    if (bg.indexOf("url(") > -1) return true;
    if (bg.indexOf("gradient") > -1 && RED.test(bg)) return true;
    return RED.test(cs.backgroundColor || "");
  }
  // warna teks "berwarna" (tidak abu-abu) -> diberi garis tepi lebih tebal
  function saturated(c) {
    var m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(c || "");
    if (!m) return false;
    var r = +m[1], g = +m[2], b = +m[3];
    return Math.max(r, g, b) - Math.min(r, g, b) > 60;
  }
  function ownText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return n.nodeValue.trim();
    return "";
  }

  // ikon gambar putih/transparan: jangan dikembalikan warnanya (biar jadi gelap di tema terang)
  function checkWhiteIcon(img) {
    if (img.classList.contains("mdh-keep") || img.dataset.mdhChecked || img.closest(".mdh-ri")) return;
    if (!img.complete || !img.naturalWidth) { img.addEventListener("load", function () { checkWhiteIcon(img); }, { once: true }); return; }
    img.dataset.mdhChecked = "1";
    try {
      var cv = document.createElement("canvas"); cv.width = cv.height = 24;
      var cx = cv.getContext("2d"); cx.drawImage(img, 0, 0, 24, 24);
      var d = cx.getImageData(0, 0, 24, 24).data, n = 0, lum = 0, trans = 0;
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 40) { trans++; continue; }
        n++; lum += (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      }
      if (n && trans > 576 * 0.15 && lum / n > 205) img.classList.add("mdh-keep");
    } catch (e) { /* gambar dari domain lain: lewati */ }
  }

  // emoji (termasuk bendera) dikembalikan ke warna asli
  var EMOJI = /(\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u;
  function wrapEmoji(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || !EMOJI.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|TITLE)$/.test(p.nodeName) || p.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (p.closest && (p.closest(".mdh-ri") || p.closest(".mdh-emo"))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(function (n) {
      var parts = n.nodeValue.split(new RegExp(EMOJI.source, "gu"));
      if (parts.length < 2) return;
      var frag = document.createDocumentFragment();
      parts.forEach(function (s, i) {
        if (!s) return;
        if (i % 2) { var sp = document.createElement("span"); sp.className = "mdh-ri mdh-emo"; sp.textContent = s; frag.appendChild(sp); }
        else frag.appendChild(document.createTextNode(s));
      });
      n.parentNode.replaceChild(frag, n);
    });
  }

  function scanNode(node) {
    if (!node || node.nodeType !== 1) return;
    var list = [node];
    var inner = node.getElementsByTagName("*");
    for (var i = 0; i < inner.length; i++) list.push(inner[i]);
    for (var j = 0; j < list.length; j++) {
      var el = list[j], tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "path" || tag === "VIDEO") continue;
      if (el.classList.contains("mdh-ri") || el.classList.contains("mdh-theme-btn")) continue;
      if (el.parentElement && el.parentElement.closest(".mdh-ri")) continue;
      if (tag === "IMG") { checkWhiteIcon(el); continue; }
      var cs = getComputedStyle(el);
      if (tag === "svg") {
        // ikon SVG merah / bergradasi tetap merah asli
        var paint = (cs.stroke || "") + " " + (cs.fill || "") + " " + (cs.color || "");
        if (RED.test(paint) || el.querySelector("linearGradient,radialGradient")) el.classList.add("mdh-ri");
        continue;
      }
      if (needsRestore(el)) { el.classList.add("mdh-ri"); continue; }
      var txt = ownText(el);
      // ikon font / simbol kecil berwarna merah
      if (txt && txt.length <= 2 && RED.test(cs.color)) { el.classList.add("mdh-ri"); continue; }
      if (txt && (saturated(cs.color) || cs.webkitBackgroundClip === "text" || cs.backgroundClip === "text")) el.classList.add("mdh-tx");
    }
    try { wrapEmoji(node); } catch (e) {}
  }
  function scan() { if (document.body) scanNode(document.body); }

  // elemen baru (chat, slider) ikut diperiksa saat tema terang aktif
  var pending = [], timer = null;
  var mo = new MutationObserver(function (muts) {
    if (current() !== "light") return;
    muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) pending.push(n); }); });
    if (!timer) timer = setTimeout(function () { timer = null; var l = pending; pending = []; l.forEach(scanNode); }, 120);
  });

  function makeButton(extraClass) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "mdh-theme-btn" + (extraClass ? " " + extraClass : "");
    b.addEventListener("click", function () { apply(current() === "light" ? "dark" : "light"); });
    buttons.push(b);
    return b;
  }

  function place() {
    var nav = document.querySelector(".navbar > .container");
    var docs = document.querySelector(".mdh-doc-top-actions");
    var cmp = document.querySelector("header.top > nav");
    var admin = document.querySelector("header.top");
    if (nav) {
      var toggler = nav.querySelector(".navbar-toggler");
      nav.insertBefore(makeButton(), toggler || null);
    } else if (docs) {
      docs.insertBefore(makeButton(), docs.firstChild);
    } else if (cmp) {
      cmp.insertBefore(makeButton(), cmp.firstChild);
    } else if (admin) {
      admin.appendChild(makeButton());
    } else {
      document.body.appendChild(makeButton("float"));
    }
    render();
  }

  function init() {
    place();
    if (current() === "light") scan();
    window.addEventListener("load", function () { if (current() === "light") scan(); });
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.MDHTheme = { set: apply, get: current };
})();
