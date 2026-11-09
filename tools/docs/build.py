# -*- coding: utf-8 -*-
"""
Generator halaman dokumentasi MineIDHost.

Cara pakai (dari folder repo):
    python3 tools/docs/build.py

Hasil:
    public/docs/index.html          -> https://mineidhost.com/docs
    public/docs/<slug>.html         -> https://mineidhost.com/docs/<slug>
    public/sitemap.xml              -> diperbarui otomatis

Isi artikel ada di content.py, urutan menu dan judul SEO ada di daftar CATEGORIES di bawah.
"""
import html, json, pathlib, re, sys, datetime

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from content import A  # noqa: E402
import assistant_data  # noqa: E402

SITE = "https://mineidhost.com"
TODAY = datetime.date.today().isoformat()

# (id, slug, label menu, judul SEO, meta description, ikon kartu, deskripsi kartu)
CATEGORIES = [
    ("Getting Started", [
        ("akses-panel", "cara-akses-panel", "Cara Akses Panel", "Cara Akses Panel Server Minecraft MineIDHost",
         "Cara login dan memakai panel MineIDHost untuk mengelola console, file, backup, port, dan versi server Minecraft.", "↗", "Login dan kenali menu panel server."),
        ("buat-server", "cara-membuat-server-minecraft", "Membuat Server Minecraft", "Cara Membuat Server Minecraft untuk Pemula",
         "Langkah membuat server Minecraft dari nol: pilih Paper, Purpur, Velocity atau Fabric, pilih versi, start, dan join server.", "+", "Pilih software, versi, dan join pertama kali."),
    ]),
    ("Minecraft Java", [
        ("install-plugin", "cara-install-plugin-minecraft", "Install Plugin", "Cara Install Plugin di Server Minecraft (Paper/Purpur)",
         "Cara install plugin Minecraft di server Paper atau Purpur: download dari sumber resmi, upload ke folder plugins, pasang dependency, dan cek error.", "⬆", "Upload plugin dan pasang dependency."),
        ("upload-world", "cara-upload-world-minecraft", "Upload World", "Cara Upload World Minecraft ke Server",
         "Cara memindahkan world singleplayer atau dari hosting lain ke server Minecraft: struktur folder, level-name, Nether dan End.", "◎", "Pindahkan world ke server."),
        ("change-version", "cara-ganti-versi-server-minecraft", "Ganti Versi Server", "Cara Ganti Versi Server Minecraft Tanpa Hilang Data",
         "Cara upgrade atau ganti versi server Minecraft dan software (Paper ke Purpur) dengan aman: backup, cek plugin, ganti Java, reinstall.", "↻", "Upgrade versi dengan aman."),
        ("operator", "cara-op-server-minecraft", "Menjadi Operator", "Cara OP dan Deop Pemain di Server Minecraft",
         "Cara memberi dan mencabut OP di server Minecraft lewat console, termasuk pemain Bedrock, dan alternatif yang lebih aman dengan LuckPerms.", "★", "Beri akses admin lewat console."),
        ("whitelist", "cara-whitelist-server-minecraft", "Whitelist Server", "Cara Whitelist Server Minecraft (Java & Bedrock)",
         "Cara mengaktifkan whitelist server Minecraft, menambah dan menghapus pemain, enforce-whitelist, serta whitelist pemain Bedrock dengan Floodgate.", "✓", "Batasi siapa yang bisa join."),
        ("optimasi", "cara-optimasi-server-minecraft", "Optimasi Server", "Cara Optimasi Server Minecraft Agar Tidak Lag",
         "Cara optimasi server Minecraft agar tidak lag: setelan view distance dan simulation distance, pre-generate world, limit entity, dan profiling Spark.", "⚡", "Setelan agar server tidak lag."),
        ("velocity-proxy", "cara-setup-velocity-proxy", "Setup Velocity Proxy", "Cara Setup Velocity Proxy Minecraft (Modern Forwarding)",
         "Cara setup Velocity untuk menggabungkan server Minecraft menjadi network: velocity.toml, modern forwarding, forwarding secret, dan paper-global.yml.", "⇄", "Gabungkan beberapa server jadi network."),
    ]),
    ("Crossplay Bedrock", [
        ("java-bedrock-crossplay", "crossplay-minecraft-java-bedrock", "Java + Bedrock", "Cara Membuat Server Minecraft Crossplay Java & Bedrock",
         "Cara membuat server Minecraft Java yang bisa dimasuki pemain Bedrock (HP, Windows, konsol) dengan GeyserMC, Floodgate, dan ViaVersion.", "⇋", "Ringkasan crossplay Java dan Bedrock."),
        ("geyser", "cara-setup-geysermc", "Setup GeyserMC", "Cara Setup GeyserMC Terbaru (Bedrock 26.60 NetherNet)",
         "Tutorial setup GeyserMC terbaru untuk Bedrock 26.60: NetherNet, Geyser build 1273+, port TCP dan UDP, clone-remote-port, dan solusi error.", "◆", "Setup Geyser versi NetherNet terbaru."),
        ("geyser-velocity", "setup-geyser-velocity-bungeecord", "Geyser di Velocity", "Cara Setup Geyser di Velocity dan BungeeCord",
         "Cara memasang GeyserMC dan Floodgate di proxy Velocity atau BungeeCord, berbagi key.pem ke backend, dan ViaVersion untuk backend versi lama.", "◇", "Crossplay untuk network dengan proxy."),
        ("floodgate", "cara-setup-floodgate", "Setup Floodgate", "Cara Setup Floodgate agar Pemain Bedrock Tanpa Akun Java",
         "Cara memasang Floodgate agar pemain Bedrock bisa join server Java tanpa akun Java: auth-type, username prefix, key.pem, dan fwhitelist.", "◈", "Bedrock join tanpa akun Java."),
        ("viaversion", "cara-pasang-viaversion", "Multi Version", "Cara Pasang ViaVersion, ViaBackwards, dan ViaRewind",
         "Cara membuat server Minecraft multi versi dengan ViaVersion, ViaBackwards, dan ViaRewind, termasuk untuk crossplay Geyser.", "⧉", "Server bisa dimasuki banyak versi."),
        ("bedrock-custom-item", "bedrock-disconnect-item-custom-geyser", "Item Custom Bedrock", "Pemain Bedrock Disconnect Karena Item Custom (Geyser)",
         "Solusi pemain Bedrock disconnect atau item custom tidak muncul di server dengan ItemsAdder, MMOItems, atau ModelEngine lewat Geyser.", "✦", "Atasi disconnect dan model rusak."),
    ]),
    ("Plugin Populer", [
        ("luckperms", "tutorial-luckperms", "LuckPerms", "Tutorial LuckPerms: Membuat Rank dan Permission",
         "Tutorial LuckPerms bahasa Indonesia: install, editor web, membuat rank VIP, memberi rank sementara, prefix, dan cek permission.", "⚿", "Buat rank dan atur permission."),
        ("essentialsx", "tutorial-essentialsx", "EssentialsX", "Tutorial EssentialsX: Home, Warp, Spawn, TPA, Kit",
         "Tutorial EssentialsX bahasa Indonesia: install, setspawn, warp, sethome, tpa, kit, ekonomi, permission, dan konfigurasi penting.", "⌂", "Home, warp, spawn, tpa, ekonomi."),
        ("vulcan", "cara-setup-vulcan-anticheat", "Vulcan Anticheat", "Cara Setup Vulcan Anticheat di Server Minecraft",
         "Cara install dan setting Vulcan anticheat: PacketEvents, mengatur hukuman per check, alert staff, dan tips menghindari false ban.", "⛊", "Pasang dan atur anticheat Vulcan."),
        ("voicechat", "cara-setup-simple-voice-chat", "Simple Voice Chat", "Cara Setup Simple Voice Chat di Server Minecraft",
         "Cara setup Simple Voice Chat di server Minecraft: allocation port UDP, voicechat-server.properties, dan solusi voice chat not connected.", "♪", "Voice chat jarak dekat."),
        ("spark", "cara-pakai-spark-profiler", "Spark Profiler", "Cara Pakai Spark untuk Mencari Penyebab Lag Minecraft",
         "Cara memakai Spark profiler: cek TPS dan MSPT, profiling saat lag, membaca laporan, dan cek pemakaian RAM server Minecraft.", "◔", "Cari plugin penyebab lag."),
    ]),
    ("Plugin MineIDHost", [
        ("mdhsecurity", "plugin-mdhsecurity", "MDHSecurity", "MDHSecurity: Plugin Login, Anti-Bot, Anti-Grief & Rollback",
         "Dokumentasi MDHSecurity: login dan auto-login premium, anti-bot, anti-grief, log blok, rollback, dan anticheat dasar untuk Velocity, BungeeCord, Paper, Purpur.", "⛨", "Login, anti-bot, anti-grief, rollback."),
        ("mdhoptimized", "plugin-mdhoptimized", "MDHOptimized", "MDHOptimized: Plugin Pregen, Clear Lag & Limit Redstone",
         "Dokumentasi MDHOptimized: pre-generate chunk pintar, clear lag terjadwal, limit redstone dan entity per chunk, serta notifikasi lokasi lag.", "⚙", "Pregen, clear lag, limit redstone."),
        ("mdhantimalware", "plugin-mdhantimalware", "MDHAntiMalware", "MDHAntiMalware: Antivirus Plugin Minecraft",
         "MDHAntiMalware mendeteksi plugin Minecraft berisi malware, menonaktifkannya otomatis, dan memberi notifikasi. Satu jar untuk Paper, Purpur, BungeeCord, Velocity.", "⚠", "Deteksi plugin berisi malware."),
    ]),
    ("Panel", [
        ("file-manager", "file-manager-panel", "File Manager", "Cara Memakai File Manager Panel Minecraft",
         "Cara memakai File Manager di panel MineIDHost: upload, edit config, zip dan unzip, serta file server Minecraft yang sering diedit.", "▤", "Kelola file langsung dari browser."),
        ("console", "console-server-minecraft", "Console", "Console Server Minecraft dan Command yang Sering Dipakai",
         "Fungsi console server Minecraft, perbedaan Stop dan Kill, serta daftar command console yang sering dipakai admin.", "›", "Log dan command server."),
        ("allocation", "cara-menambah-port-allocation", "Allocation / Port", "Cara Menambah Port (Allocation) Server Minecraft",
         "Cara menambah port allocation di panel untuk Geyser, Simple Voice Chat, Dynmap, dan plugin lain yang butuh port sendiri.", "#", "Tambah port untuk plugin."),
        ("backup", "cara-backup-server-minecraft", "Backup", "Cara Backup dan Restore Server Minecraft",
         "Cara membuat, memulihkan, dan download backup server Minecraft di panel, serta kapan sebaiknya melakukan backup.", "◫", "Buat dan pulihkan backup."),
        ("sftp", "cara-sftp-server-minecraft", "SFTP", "Cara Upload File Server Minecraft Lewat SFTP (FileZilla/WinSCP)",
         "Cara login SFTP ke server Minecraft dengan FileZilla atau WinSCP untuk upload world dan file besar.", "⇅", "Transfer file besar dengan cepat."),
    ]),
    ("Troubleshooting", [
        ("server-error", "server-minecraft-tidak-bisa-start", "Server Tidak Start", "Server Minecraft Tidak Bisa Start? Ini Solusinya",
         "Solusi server Minecraft tidak bisa start atau crash: UnsupportedClassVersionError, Failed to bind to port, EULA, OutOfMemoryError, dan plugin error.", "!", "Server crash atau tidak menyala."),
        ("lag", "server-minecraft-lag", "Server Lag", "Penyebab Server Minecraft Lag dan Cara Mengatasinya",
         "Cara mengetahui penyebab server Minecraft lag: cek TPS dan MSPT, cari chunk bermasalah, profiling Spark, dan penyebab umum lag.", "≋", "Temukan penyebab lag."),
        ("connection", "tidak-bisa-join-server-minecraft", "Tidak Bisa Join", "Tidak Bisa Join Server Minecraft (Java & Bedrock)",
         "Solusi tidak bisa join server Minecraft: Connection refused, Outdated server, Failed to verify username, dan Unable to connect to world di Bedrock.", "×", "Error saat join server."),
        ("plugin-error", "cara-memperbaiki-plugin-error", "Plugin Error", "Cara Memperbaiki Plugin Error di Server Minecraft",
         "Cara membaca dan memperbaiki plugin error: missing dependency, Unsupported API version, NoSuchMethodError, dan Ambiguous plugin name.", "!", "Baca dan perbaiki error plugin."),
        ("java-version", "versi-java-server-minecraft", "Versi Java Server", "Versi Java untuk Server Minecraft (Tabel Lengkap)",
         "Tabel versi Java untuk setiap versi server Minecraft, dari 1.8 sampai 26.x (Java 25), dan cara mengganti Java di panel.", "J", "Java yang cocok tiap versi."),
    ]),
]

ITEMS = {}
ORDER = []
for cat, items in CATEGORIES:
    for it in items:
        aid, slug, label, seo, desc, icon, card = it
        assert aid in A, f"artikel {aid} tidak ada di content.py"
        ITEMS[aid] = dict(id=aid, slug=slug, label=label, seo=seo, desc=desc, icon=icon, card=card, cat=cat)
        ORDER.append(aid)
missing = set(A) - set(ITEMS)
assert not missing, f"artikel belum terdaftar di CATEGORIES: {missing}"

CSS = (HERE / "style.css").read_text(encoding="utf-8")
CSS += """
/* ===== Halaman per artikel & perbaikan menu ===== */
.mdh-doc-article { display: block; }
.mdh-doc-code { white-space: pre; }
.mdh-doc-logo-mark { padding: 4px; background: #0d0d10; border: 1px solid rgba(255,255,255,.08); }
.mdh-doc-logo-mark img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 0 6px rgba(255,0,0,.6)); }
.mdh-doc-sidebar { background: #08080b; }
.mdh-doc-sidebar-title { margin-top: 6px; color: #8a8a93; }
.mdh-doc-nav { margin-bottom: 22px; }
.mdh-doc-nav a { color: #b5b5bd; }
.mdh-doc-overlay { display: none; }
.mdh-doc-crumb { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 18px; color: #666; font-size: 13px; }
.mdh-doc-crumb a { color: #888; text-decoration: none; }
.mdh-doc-crumb a:hover { color: #ff3150; }
.mdh-doc-pager { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 45px; }
.mdh-doc-pager a { display: block; padding: 16px 18px; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: #0b0b0e; color: #fff; text-decoration: none; }
.mdh-doc-pager a:hover { border-color: rgba(255,49,80,.45); }
.mdh-doc-pager small { display: block; margin-bottom: 4px; color: #777; font-size: 12px; }
.mdh-doc-pager .next { text-align: right; grid-column: 2; }
.mdh-doc-cta { margin-top: 40px; padding: 22px 24px; border: 1px solid rgba(255,49,80,.25); border-radius: 14px; background: linear-gradient(135deg, rgba(255,23,63,.10), rgba(10,10,13,.9)); }
.mdh-doc-cta h3 { margin: 0 0 6px; color: #fff; font-size: 18px; }
.mdh-doc-cta p { margin: 0 0 14px; color: #aaa; line-height: 1.6; }
.mdh-doc-cta a { display: inline-block; padding: 10px 18px; border-radius: 9px; background: #ff173f; color: #fff; font-weight: 700; text-decoration: none; }
.mdh-doc-empty { display: none; color: #888; padding: 20px 0; }
@media (max-width: 850px) {
  .mdh-doc-sidebar { width: 280px; left: -290px; background: #08080b; box-shadow: 10px 0 40px rgba(0,0,0,.7); padding-bottom: 60px; }
  .mdh-doc-sidebar.open { left: 0; }
  .mdh-doc-overlay.open { display: block; position: fixed; inset: 70px 0 0 0; z-index: 800; background: rgba(0,0,0,.6); }
  .mdh-doc-nav a { padding: 11px 12px; font-size: 14px; }
  .mdh-doc-pager { grid-template-columns: 1fr; }
  .mdh-doc-pager .next { grid-column: 1; }
}
"""


def esc(s):
    return html.escape(s, quote=True)


def url(aid):
    return f"/docs/{ITEMS[aid]['slug']}"


def fix_links(h):
    h = h.replace('href="#home"', 'href="/docs"')
    return re.sub(r'href="#([a-z0-9-]+)"', lambda m: f'href="{url(m.group(1))}"' if m.group(1) in ITEMS else m.group(0), h)


def sidebar(active=None):
    out = ['<aside class="mdh-doc-sidebar" id="mdhDocSidebar">',
           '    <nav class="mdh-doc-nav"><a href="/docs"' + (' class="active"' if active is None else "") + '>Semua Dokumentasi</a>'
           '<a href="/hosting-minecraft-terbaik">Host Comparison</a></nav>']
    for cat, items in CATEGORIES:
        out.append(f'    <div class="mdh-doc-sidebar-title">{esc(cat)}</div>\n    <nav class="mdh-doc-nav">')
        for it in items:
            cls = ' class="active"' if it[0] == active else ""
            out.append(f'        <a href="{url(it[0])}"{cls}>{esc(it[2])}</a>')
        out.append("    </nav>")
    out.append("</aside>")
    return "\n".join(out)


def page(title, desc, canonical, body, active=None, jsonld=None, og_type="website"):
    ld = "".join(f'\n<script type="application/ld+json">{json.dumps(j, ensure_ascii=False)}</script>' for j in (jsonld or []))
    return f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="MineIDHost">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:locale" content="id_ID">
<link rel="icon" href="/assets/images/logo.svg" type="image/svg+xml">{ld}
<script>(function(){{try{{var t=localStorage.getItem("mdh-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}}catch(e){{}}}})()</script>
<link rel="stylesheet" href="/assets/css/mdh-theme.css">
<style>
{CSS}
</style>
</head>
<body>

<header class="mdh-doc-topbar">
    <button class="mdh-doc-menu" id="mdhDocMenu" aria-label="Buka menu">☰</button>
    <a href="/" class="mdh-doc-logo">
        <span class="mdh-doc-logo-mark"><img src="/assets/images/logo.svg" alt="MineIDHost"></span>
        <span>MineIDHost<small>Documentation</small></span>
    </a>
    <div class="mdh-doc-top-actions">
        <a href="/minecraft-hosting">Hosting</a>
        <a href="/hosting-minecraft-terbaik">Host Comparison</a>
        <a href="https://panel.mineidhost.com" target="_blank" rel="noopener">Panel</a>
        <a href="https://dsc.gg/mineidhost" target="_blank" rel="noopener">Discord</a>
    </div>
</header>

<div class="mdh-doc-overlay" id="mdhDocOverlay"></div>

<div class="mdh-doc-layout">
{sidebar(active)}

<main class="mdh-doc-main">
{body}
</main>
</div>

<script>
(function () {{
    var sb = document.getElementById("mdhDocSidebar");
    var ov = document.getElementById("mdhDocOverlay");
    function toggle(open) {{ sb.classList.toggle("open", open); ov.classList.toggle("open", open); }}
    document.getElementById("mdhDocMenu").addEventListener("click", function () {{ toggle(!sb.classList.contains("open")); }});
    ov.addEventListener("click", function () {{ toggle(false); }});
    var act = sb.querySelector("a.active");
    if (act && act.scrollIntoView) {{ act.scrollIntoView({{ block: "center" }}); window.scrollTo(0, 0); }}
}})();
</script>
<script src="/assets/js/mdh-assistant.js" defer></script>
<script src="/assets/js/mdh-theme.js" defer></script>
</body>
</html>
"""


CTA = """<div class="mdh-doc-cta">
    <h3>Butuh server Minecraft yang siap pakai?</h3>
    <p>Hosting Minecraft MineIDHost mulai Rp10.000/bulan dengan AMD EPYC, anti DDoS, panel lengkap, dan support bahasa Indonesia.</p>
    <a href="/minecraft-hosting">Lihat Paket Hosting</a>
</div>"""


def build_article(aid):
    it = ITEMS[aid]
    h = fix_links(A[aid])
    # breadcrumb di atas judul, ganti tombol kembali
    h = re.sub(r'\s*<a href="/docs" class="mdh-doc-back">.*?</a>\n',
               f'\n    <nav class="mdh-doc-crumb"><a href="/docs">Docs</a><span>/</span><span>{esc(it["cat"])}</span></nav>\n', h, count=1)
    i = ORDER.index(aid)
    prev_a = ORDER[i - 1] if i > 0 else None
    next_a = ORDER[i + 1] if i + 1 < len(ORDER) else None
    pager = '<nav class="mdh-doc-pager">'
    if prev_a:
        pager += f'<a href="{url(prev_a)}"><small>← Sebelumnya</small>{esc(ITEMS[prev_a]["label"])}</a>'
    if next_a:
        pager += f'<a class="next" href="{url(next_a)}"><small>Selanjutnya →</small>{esc(ITEMS[next_a]["label"])}</a>'
    pager += "</nav>"
    h = h.replace("</article>", CTA + "\n" + pager + "\n</article>", 1)

    canonical = SITE + url(aid)
    title = f'{it["seo"]} | MineIDHost Docs'
    steps = re.findall(r'<div class="mdh-doc-step">\s*<h2>(.*?)</h2>', A[aid])
    jsonld = [
        {"@context": "https://schema.org", "@type": "TechArticle", "headline": it["seo"], "description": it["desc"],
         "inLanguage": "id-ID", "url": canonical, "dateModified": TODAY,
         "author": {"@type": "Organization", "name": "MineIDHost", "url": SITE + "/"},
         "publisher": {"@type": "Organization", "name": "MineIDHost", "logo": {"@type": "ImageObject", "url": SITE + "/assets/images/logo.svg"}},
         "articleSection": it["cat"], "about": [re.sub("<[^>]+>", "", s) for s in steps][:8]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Docs", "item": SITE + "/docs"},
            {"@type": "ListItem", "position": 2, "name": it["label"], "item": canonical}]},
    ]
    return page(title, it["desc"], canonical, h, active=aid, jsonld=jsonld, og_type="article")


def plain(h, n=500):
    t = re.sub(r"<[^>]+>", " ", h)
    t = html.unescape(re.sub(r"\s+", " ", t)).strip()
    return t[:n]


def build_index():
    parts = ["""<div class="mdh-doc-home" id="home">
<section class="mdh-doc-hero">
    <span class="mdh-doc-eyebrow">MINEIDHOST DOCS</span>
    <h1>Tutorial &amp; dokumentasi server Minecraft.</h1>
    <p>Panduan bahasa Indonesia untuk membuat dan mengelola server Minecraft: install plugin, crossplay Java &amp; Bedrock dengan Geyser,
    optimasi agar tidak lag, setup plugin populer, sampai troubleshooting.</p>
    <div class="mdh-doc-search">
        <input type="search" id="mdhDocSearch" placeholder="Cari tutorial, misalnya: geyser, lag, luckperms..." aria-label="Cari tutorial">
    </div>
</section>
<p class="mdh-doc-empty" id="mdhDocEmpty">Tidak ada tutorial yang cocok. Coba kata lain atau tanya di Discord MineIDHost.</p>
"""]
    for n, (cat, items) in enumerate(CATEGORIES, 1):
        parts.append(f"""
<section class="mdh-doc-category">
    <div class="mdh-doc-category-title"><span>{n:02d}</span><h2>{esc(cat)}</h2></div>
    <div class="mdh-doc-cards">""")
        for it in items:
            aid = it[0]
            kw = esc(plain(A[aid]).lower())
            parts.append(f"""        <a href="{url(aid)}" class="mdh-doc-card" data-search="{kw}">
            <div class="mdh-doc-card-icon">{it[5]}</div>
            <h3>{esc(it[2])}</h3>
            <p>{esc(it[6])}</p>
        </a>""")
        parts.append("    </div>\n</section>")
    parts.append("</div>")
    # redirect link lama docs#id -> /docs/slug dan pencarian
    mapping = json.dumps({k: url(k) for k in ITEMS})
    parts.append(f"""
<script>
(function () {{
    var map = {mapping};
    var h = location.hash.slice(1);
    if (map[h]) {{ location.replace(map[h]); return; }}
    var input = document.getElementById("mdhDocSearch");
    var empty = document.getElementById("mdhDocEmpty");
    input.addEventListener("input", function () {{
        var q = this.value.toLowerCase().trim(), shown = 0;
        document.querySelectorAll(".mdh-doc-category").forEach(function (sec) {{
            var any = 0;
            sec.querySelectorAll(".mdh-doc-card").forEach(function (c) {{
                var ok = !q || (c.innerText + " " + c.getAttribute("data-search")).toLowerCase().indexOf(q) > -1;
                c.style.display = ok ? "" : "none"; if (ok) {{ any++; shown++; }}
            }});
            sec.style.display = any ? "" : "none";
        }});
        empty.style.display = shown ? "none" : "block";
    }});
}})();
</script>""")
    jsonld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": "Tutorial Server Minecraft MineIDHost",
               "url": SITE + "/docs", "inLanguage": "id-ID",
               "hasPart": [{"@type": "TechArticle", "headline": ITEMS[a]["seo"], "url": SITE + url(a)} for a in ORDER]}]
    return page("Tutorial Server Minecraft Bahasa Indonesia | MineIDHost Docs",
                "Kumpulan tutorial server Minecraft bahasa Indonesia: install plugin, setup GeyserMC crossplay Bedrock, optimasi anti lag, LuckPerms, EssentialsX, Vulcan, dan troubleshooting.",
                SITE + "/docs", "".join(parts), active=None, jsonld=jsonld)


def update_sitemap():
    sm = ROOT / "public" / "sitemap.xml"
    s = sm.read_text(encoding="utf-8")
    s = re.sub(r"\s*<url><loc>https://mineidhost\.com/docs/[^<]+</loc>.*?</url>", "", s)
    s = re.sub(r"(<url><loc>https://mineidhost\.com/docs</loc><lastmod>)[^<]+", r"\g<1>" + TODAY, s)
    add = "".join(f"\n  <url><loc>{SITE}{url(a)}</loc><lastmod>{TODAY}</lastmod><priority>0.7</priority></url>" for a in ORDER)
    s = s.replace("\n</urlset>", add + "\n</urlset>")
    sm.write_text(s, encoding="utf-8")


def main():
    out = ROOT / "public" / "docs"
    out.mkdir(exist_ok=True)
    for f in out.glob("*.html"):
        f.unlink()
    (out / "index.html").write_text(build_index(), encoding="utf-8")
    for aid in ORDER:
        (out / f"{ITEMS[aid]['slug']}.html").write_text(build_article(aid), encoding="utf-8")
    update_sitemap()
    data_dir = ROOT / "public" / "assets" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "assistant-index.json").write_text(assistant_data.build(A, ITEMS, ORDER, url), encoding="utf-8")
    print(f"OK: {len(ORDER)} artikel + index -> public/docs/, assistant-index.json diperbarui")


if __name__ == "__main__":
    main()
